const REQUIRED_BLOCKS = ['human', 'spatial_3d', 'robot', 'vr'];

export function validateSkill(skill) {
  const errors = [];
  if (!skill || typeof skill !== 'object') return { ok: false, errors: ['not an object'] };
  if (!skill.project_id) errors.push('missing project_id');
  if (!Array.isArray(skill.steps)) {
    errors.push('missing steps array');
    return { ok: false, errors };
  }
  if (skill.steps.length < 5 || skill.steps.length > 10) {
    errors.push(`steps must be 5-10, got ${skill.steps.length}`);
  }
  skill.steps.forEach((step, i) => {
    REQUIRED_BLOCKS.forEach((block) => {
      if (!step[block]) errors.push(`step ${i}: missing ${block}`);
    });
    const pos = step.spatial_3d && step.spatial_3d.position_m;
    if (!Array.isArray(pos) || pos.length !== 3 || !pos.every(Number.isFinite)) {
      errors.push(`step ${i}: bad spatial_3d.position_m`);
    }
    if (!step.robot || !step.robot.action_type) errors.push(`step ${i}: missing robot.action_type`);
    if (step.robot && step.robot.action_type === 'torque') {
      if (!Number.isFinite(step.robot.torque_nm)) errors.push(`step ${i}: torque needs torque_nm`);
    }
    if (!step.vr || !step.vr.voice_prompt) errors.push(`step ${i}: missing vr.voice_prompt`);
    if (!step.human || !step.human.video_clip) errors.push(`step ${i}: missing human.video_clip`);
  });
  return { ok: errors.length === 0, errors };
}

export async function loadSkillIndex() {
  const res = await fetch('/models/index.json');
  if (!res.ok) throw new Error('skill index not found at /models/index.json');
  return res.json();
}

export async function loadSkill(skillId) {
  const res = await fetch(`/models/${skillId}/skill.json`);
  if (!res.ok) throw new Error(`skill ${skillId} not found`);
  const skill = await res.json();
  const { ok, errors } = validateSkill(skill);
  if (!ok) throw new Error(`invalid skill.json: ${errors.join('; ')}`);
  return skill;
}

async function tryJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (type.includes('text/html')) return null; // SPA fallback, not a real file
    return await res.json();
  } catch {
    return null;
  }
}

async function tryViews(url) {
  const list = await tryJson(url);
  return Array.isArray(list) ? list : null;
}

// Evidence behind a skill: what the AI heard and saw, and how honest each output is.
export async function loadEvidence(skillId) {
  const base = `/models/${skillId}`;
  const [transcript, masks, status, glossary, views] = await Promise.all([
    tryJson(`${base}/ai/transcript.json`),
    tryJson(`${base}/ai/masks.json`),
    tryJson(`${base}/status.json`),
    tryJson(`${base}/glossary.json`),
    tryViews(`${base}/views.json`)
  ]);
  return { transcript: transcript || [], masks: masks || [], status, glossary: glossary || null, views };
}

// "MM:SS-MM:SS" -> [startSec, endSec]
export function parseRange(ts) {
  const m = /(\d+):(\d+)\s*-\s*(\d+):(\d+)/.exec(ts || '');
  if (!m) return [0, 0];
  return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
}

const LANGS = {
  pcm: 'Nigerian Pidgin',
  'pcm-en': 'Pidgin + English',
  yo: 'Yoruba',
  en: 'English',
  und: 'Language auto-detected'
};
export const langName = (code) => LANGS[code] || code;
