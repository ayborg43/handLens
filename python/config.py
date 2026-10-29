"""Shared config for the handLens pipeline. Skill-agnostic: every skill-specific
value (prompts, warning phrases, model bounds) lives here per skill_id so no
generator code hardcodes one trade."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load_env():
    """Read KEY=VALUE lines from <repo>/.env (gitignored) without overriding real env vars."""
    path = os.path.join(ROOT, '.env')
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"\''))


_load_env()
MODEL_API_KEY = os.environ.get('MODEL_API_KEY', '')
MODEL_API_BASE = 'https://api.meta.ai/v1'

SKILL_PROMPTS = {
    # skill_id -> SAM text prompts for that skill's subject
    'gen_ladipo_001': ['hand', 'spanner', 'bolt', 'engine block', 'screwdriver', 'hazard'],
}

WARNING_PHRASES = {
    # skill_id -> phrases that mark a transcript line as a warning
    'gen_ladipo_001': ['no use', 'e go spoil', 'careful', 'disconnect', 'warning', 'battery'],
}

MODEL_BOUNDS = {
    # skill_id -> model space bounds in meters {min, max}
    'gen_ladipo_001': {'min': [-0.25, 0, -0.25], 'max': [0.25, 0.5, 0.25]},
}

DEFAULT_BOUNDS = {'min': [-0.25, 0, -0.25], 'max': [0.25, 0.5, 0.25]}


def skill_dir(skill_id):
    return os.path.join(ROOT, 'skills', skill_id)


def public_dir(skill_id):
    return os.path.join(ROOT, 'public', 'models', skill_id)


def _override(skill_id):
    """Per-skill JSON written by the admin upload server. Wins over builtins."""
    path = os.path.join(ROOT, 'skills', skill_id, 'skill.config.json')
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}


def prompts_for(skill_id):
    override = _override(skill_id)
    if 'prompts' in override:
        return override['prompts']
    return SKILL_PROMPTS.get(skill_id, ['hand', 'tool', 'workpiece', 'hazard'])


def title_for(skill_id):
    return _override(skill_id).get('title') or skill_id


def language_bias_for(skill_id):
    """Optional list of language names to steer Muse Voice (omit to auto-detect)."""
    return _override(skill_id).get('language_bias') or None


def warnings_for(skill_id):
    override = _override(skill_id)
    if 'warnings' in override:
        return override['warnings']
    return WARNING_PHRASES.get(skill_id, ['careful', 'warning', 'danger'])


def bounds_for(skill_id):
    override = _override(skill_id)
    if 'bounds' in override:
        return override['bounds']
    return MODEL_BOUNDS.get(skill_id, DEFAULT_BOUNDS)


def record_mode(skill_id, stage, mode):
    """Remember whether a pipeline stage ran live or on sample/offline data, so
    the viewer can label every output honestly (tools/sync_public.py reads it)."""
    path = os.path.join(skill_dir(skill_id), 'provenance.json')
    data = {}
    if os.path.exists(path):
        with open(path) as f:
            data = json.load(f)
    data[stage] = mode
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=1)
