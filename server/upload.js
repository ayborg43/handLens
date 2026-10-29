// handLens local admin server. NOT deployed — runs beside `npm run dev` so the
// in-app admin page can upload footage into skills/<id>/ and run the pipeline.
// Bind: 127.0.0.1:5174 only. Upload cap: 500MB per file.
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import multer from 'multer';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 5174;
const PY = fs.existsSync(path.join(ROOT, '.venv', 'bin', 'python'))
  ? path.join(ROOT, '.venv', 'bin', 'python')
  : 'python3';

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const upload = multer({
  dest: path.join(ROOT, '.upload-tmp'),
  limits: { fileSize: 500 * 1024 * 1024, files: 3 }
});

const SLUG = /^[a-z0-9][a-z0-9_]{2,40}$/;

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: ROOT, timeout: 600000 }, (err, stdout, stderr) => {
      const out = String(stdout || '') + String(stderr || '');
      resolve({
        ok: !err,
        mode: out.includes('[sample]') ? 'sample' : out.includes('[live]') ? 'live' : 'n/a',
        log: out.slice(-2000)
      });
    });
  });
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/skills', (req, res) => {
  const dir = path.join(ROOT, 'skills');
  const ids = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory())
    : [];
  res.json({ skills: ids });
});

const fields = upload.fields([
  { name: 'video_mp4', maxCount: 1 },
  { name: 'skill_mp4', maxCount: 1 },
  { name: 'orbit_mp4', maxCount: 1 },
  { name: 'audio_m4a', maxCount: 1 }
]);

app.post('/api/skills', fields, async (req, res) => {
  const skillId = String(req.body.skill_id || '').trim();
  const title = String(req.body.title || skillId).trim();
  if (!SLUG.test(skillId)) {
    return res.status(400).json({ ok: false, error: 'skill_id must match [a-z0-9_], 3-41 chars' });
  }
  const sdir = path.join(ROOT, 'skills', skillId);
  fs.mkdirSync(sdir, { recursive: true });
  fs.mkdirSync(path.join(sdir, 'frames'), { recursive: true });

  const move = (field, dest) => {
    const f = req.files && req.files[field] && req.files[field][0];
    if (f) fs.renameSync(f.path, path.join(sdir, dest));
  };
  // Single-video journey (default): everything derives from one upload.
  // Legacy three-file upload still works: explicit files win per track.
  const single = req.files && req.files.video_mp4 && req.files.video_mp4[0];
  if (single) fs.renameSync(single.path, path.join(sdir, 'skill.mp4'));
  move('skill_mp4', 'skill.mp4');
  move('orbit_mp4', 'orbit.mp4');
  move('audio_m4a', 'audio.m4a');

  const derived = [];
  const hasSkill = fs.existsSync(path.join(sdir, 'skill.mp4'));
  const orbitStart = String(req.body.orbit_start || '0');
  const orbitDur = String(req.body.orbit_duration || '15');
  if (hasSkill && !fs.existsSync(path.join(sdir, 'orbit.mp4'))) {
    derived.push({ stage: 'orbit-cut', ...(await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-ss', orbitStart, '-t', orbitDur, '-i', path.join(sdir, 'skill.mp4'),
      '-c:v', 'libx264', '-crf', '23', '-an', path.join(sdir, 'orbit.mp4')
    ])) });
  }
  if (hasSkill && !fs.existsSync(path.join(sdir, 'audio.m4a'))) {
    derived.push({ stage: 'audio-extract', ...(await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', path.join(sdir, 'skill.mp4'),
      '-vn', '-c:a', 'aac', path.join(sdir, 'audio.m4a')
    ])) });
  }

  const prompts = String(req.body.prompts || 'hand,tool,workpiece,hazard')
    .split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8);
  const warnings = String(req.body.warnings || 'careful,warning,danger')
    .split(',').map((s) => s.trim()).filter(Boolean);
  fs.writeFileSync(
    path.join(sdir, 'skill.config.json'),
    JSON.stringify({ title, prompts, warnings }, null, 1)
  );

  const steps = [];
  steps.push({ stage: 'frames', ...(await run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', path.join(sdir, 'skill.mp4'),
    '-vf', 'fps=2', path.join(sdir, 'frames', 'frame_%04d.jpg')
  ])) });
  steps.push({ stage: 'placeholder-glb', ...(await run(PY, [
    'tools/make_placeholder_glb.py', '--skill', skillId
  ])) });

  const has = {
    skill_mp4: fs.existsSync(path.join(sdir, 'skill.mp4')),
    orbit_mp4: fs.existsSync(path.join(sdir, 'orbit.mp4')),
    audio_m4a: fs.existsSync(path.join(sdir, 'audio.m4a'))
  };
  res.json({ ok: true, skill_id: skillId, has, steps: [...derived, ...steps] });
});

app.post('/api/skills/:id/run', async (req, res) => {
  const skillId = req.params.id;
  if (!SLUG.test(skillId)) return res.status(400).json({ ok: false, error: 'bad skill id' });
  const sample = req.query.sample === '1' ? ['--sample'] : [];
  const stages = [
    ['sam', ['python/sam_api.py', '--skill', skillId, ...sample]],
    ['transcribe', ['python/transcribe.py', '--skill', skillId, ...sample]],
    ['reason', ['python/reason.py', '--skill', skillId, ...sample]],
    ['depth', ['python/depth_est.py', '--skill', skillId]],
    ['glossary', ['python/object_glossary.py', '--skill', skillId,
      ...((sample.length === 0 && process.env.MODEL_API_KEY) ? ['--live'] : [])]],
    ['urdf', ['python/urdf_gen.py', '--skill', skillId]],
    ['traj', ['python/traj_gen.py', '--skill', skillId]],
    ['webxr', ['python/webxr_gen.py', '--skill', skillId]],
    ['sim', ['tools/record_sim_clip.py', '--skill', skillId]],
    ['voice', ['python/voice_gen.py', '--skill', skillId]],
    ['sync', ['tools/sync_public.py', '--skill', skillId]]
  ];
  const results = [];
  for (const [stage, args] of stages) {
    const py = stage === 'sim' ? PY : 'python3';
    const r = await run(py, args);
    results.push({ stage, ...r });
    if (!r.ok) break;
  }
  res.json({ ok: results.every((r) => r.ok), skill_id: skillId, results });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`handLens admin server: http://127.0.0.1:${PORT}/`);
});
