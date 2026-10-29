import { useEffect, useState } from 'react';
import { BrandMark, IconWarning, IconCheck, IconArrowLeft } from './components/Icons.jsx';

const API = 'http://127.0.0.1:5174/api';

export function Admin() {
  const [skillId, setSkillId] = useState('');
  const [title, setTitle] = useState('');
  const [prompts, setPrompts] = useState('hand,tool,workpiece,hazard');
  const [warnings, setWarnings] = useState('careful,warning,danger');
  const [files, setFiles] = useState({});
  const [orbitStart, setOrbitStart] = useState('0');
  const [orbitDuration, setOrbitDuration] = useState('15');
  const [status, setStatus] = useState(null);
  const [running, setRunning] = useState(false);
  const [serverUp, setServerUp] = useState(null);

  useEffect(() => {
    fetch(`${API}/health`).then(() => setServerUp(true)).catch(() => setServerUp(false));
  }, []);

  const pick = (name) => (e) => {
    setFiles((f) => ({ ...f, [name]: e.target.files[0] || null }));
  };

  const upload = async () => {
    setRunning(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append('skill_id', skillId.trim());
      form.append('title', title.trim() || skillId.trim());
      form.append('prompts', prompts);
      form.append('warnings', warnings);
      form.append('orbit_start', orbitStart);
      form.append('orbit_duration', orbitDuration);
      if (files.video_mp4) form.append('video_mp4', files.video_mp4);
      if (files.audio_m4a) form.append('audio_m4a', files.audio_m4a);
      const res = await fetch(`${API}/skills`, { method: 'POST', body: form });
      setStatus(await res.json());
    } catch (e) {
      setStatus({ ok: false, error: `upload failed: ${e.message}. Is the admin server running? (node server/upload.js)` });
    }
    setRunning(false);
  };

  const runPipeline = async (sample) => {
    setRunning(true);
    try {
      const res = await fetch(
        `${API}/skills/${encodeURIComponent(skillId.trim())}/run${sample ? '?sample=1' : ''}`,
        { method: 'POST' }
      );
      setStatus(await res.json());
    } catch (e) {
      setStatus({ ok: false, error: String(e.message || e) });
    }
    setRunning(false);
  };

  const idMissing = !skillId.trim();

  return (
    <>
      <a className="skip-link" href="#content">Skip to content</a>
      <header className="appbar">
        <h1 className="brand">
          <BrandMark />
          <span>handLens <small>admin</small></span>
        </h1>
        <div className="appbar-tools">
          <a className="btn btn-ghost" href="#/"><IconArrowLeft /> Viewer</a>
        </div>
      </header>
      <main id="content" className="page page-narrow">
        {serverUp === false && (
          <div className="callout callout-danger" role="alert">
            <IconWarning />
            <p>
              <strong>Admin server is not running.</strong> Start it with{' '}
              <code>node server/upload.js</code>, then reload.
            </p>
          </div>
        )}

        <section className="panel detail" aria-labelledby="new-skill">
          <h2 id="new-skill">1. New skill</h2>
          <form className="form" onSubmit={(e) => { e.preventDefault(); upload(); }}>
            <label className="field">
              <span>Skill id</span>
              <input className="input" value={skillId} onChange={(e) => setSkillId(e.target.value)} placeholder="ankara_tailor_001" autoComplete="off" spellCheck="false" />
              <small>Lowercase letters, numbers and underscores.</small>
            </label>
            <label className="field">
              <span>Title</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ankara dress assembly" />
            </label>
            <label className="field">
              <span>SAM prompts</span>
              <input className="input" value={prompts} onChange={(e) => setPrompts(e.target.value)} />
              <small>Comma-separated, max 8.</small>
            </label>
            <label className="field">
              <span>Warning phrases</span>
              <input className="input" value={warnings} onChange={(e) => setWarnings(e.target.value)} />
              <small>Comma-separated words the speaker uses to flag danger.</small>
            </label>
            <label className="field">
              <span>Skill video</span>
              <input type="file" accept="video/mp4" onChange={pick('video_mp4')} />
              <small>One upload. Frames, orbit slice and audio all derive from it.</small>
            </label>
            <div className="field-row">
              <label className="field">
                <span>Orbit starts at (s)</span>
                <input className="input" inputMode="decimal" value={orbitStart} onChange={(e) => setOrbitStart(e.target.value)} />
              </label>
              <label className="field">
                <span>Orbit duration (s)</span>
                <input className="input" inputMode="decimal" value={orbitDuration} onChange={(e) => setOrbitDuration(e.target.value)} />
              </label>
            </div>
            <p className="help">Film a slow 15s circle around the subject where the orbit starts.</p>
            <label className="field">
              <span>Separate audio (optional)</span>
              <input type="file" accept="audio/*" onChange={pick('audio_m4a')} />
              <small>Overrides the video’s own sound.</small>
            </label>
            <div className="actions">
              <button type="submit" className="btn btn-primary" disabled={running || idMissing}>
                {running ? 'Working…' : 'Upload footage'}
              </button>
            </div>
          </form>
        </section>

        <section className="panel detail" aria-labelledby="run-pipeline">
          <h2 id="run-pipeline">2. Run pipeline</h2>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => runPipeline(false)} disabled={running || idMissing}>
              Run (live APIs)
            </button>
            <button type="button" className="btn" onClick={() => runPipeline(true)} disabled={running || idMissing}>
              Run (sample data)
            </button>
          </div>
          <p className="help">
            Live needs <code>MODEL_API_KEY</code> and real footage, otherwise stages report a fallback.
            Sample writes demo data like the launch skill. Export the Luma GLB manually to{' '}
            <code>public/models/&lt;id&gt;/model.glb</code>.
          </p>
        </section>

        {status && (
          <section className="panel detail" aria-labelledby="run-result" aria-live="polite">
            <h2 id="run-result">Result</h2>
            <div className={`callout ${status.ok ? 'callout-success' : 'callout-danger'}`} role="status">
              {status.ok ? <IconCheck /> : <IconWarning />}
              <p>{status.ok ? 'Completed.' : <><strong>Failed.</strong> {status.error || 'See details below.'}</>}</p>
            </div>
            <pre className="result">{JSON.stringify(status, null, 2)}</pre>
            {status.ok && status.skill_id && (
              <div className="actions" style={{ marginTop: 'var(--s-3)' }}>
                <a className="btn btn-primary" href={`#/${status.skill_id}`}>Open skill in viewer</a>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
