"""Unique detected objects -> glossary.json (names + plain-language blurbs).

Default (template mode) writes only facts already in the repo: how many frames
each label appears in and which steps use it, flagged source='template'.
Live mode (--live, needs MODEL_API_KEY) asks Spark 1.3 for one short blurb per
label and records source='live'. Live failure exits nonzero without writing.

Usage: python3 python/object_glossary.py --skill gen_ladipo_001 [--live]
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config  # noqa: E402


def collect(masks, skill):
    labels = {}
    for fr in masks:
        for o in fr.get('objects', []):
            e = labels.setdefault(o['label'], {'frames': 0, 'scores': []})
            e['frames'] += 1
            e['scores'].append(o.get('score', 0))
    id2label = {}
    for fr in masks:
        for o in fr.get('objects', []):
            id2label.setdefault(o['id'], o['label'])
    used = {}
    for step in skill.get('steps', []):
        tid = step.get('target_object_id', '')
        digits = ''.join(c for c in tid if c.isdigit())
        label = id2label.get(int(digits), None) if digits else None
        if label:
            used.setdefault(label, []).append(step['step_id'])
        tool = (step.get('tool') or '').lower()
        for lab in labels:
            if lab != 'hand' and lab.lower() in tool:
                used.setdefault(lab, [])
                if step['step_id'] not in used[lab]:
                    used[lab].append(step['step_id'])
    return labels, used


def template_glossary(labels, used):
    out = {}
    for label, e in sorted(labels.items()):
        steps = sorted(used.get(label, []))
        where = f"used in step{'s' if len(steps) != 1 else ''} {steps}" if steps else 'not tied to a step yet'
        avg = sum(e['scores']) / max(1, len(e['scores']))
        out[label] = {
            'name': label,
            'blurb': f'Spotted in {e["frames"]} frames ({where}).',
            'frames': e['frames'],
            'avg_score': round(avg, 2),
            'steps': steps,
            'source': 'template',
        }
    return out


def live_glossary(labels, used):
    import urllib.request
    items = [f'- {lab} (seen in {e["frames"]} frames)' for lab, e in sorted(labels.items())]
    payload = {
        'model': 'muse-spark-1.3',
        'input': 'You label workshop objects for apprentices. For each item, write one '
                 'plain sentence under 20 words saying what it is and what it is for. '
                 'Reply ONLY as JSON: {"label": "sentence"}. Items:\n' + '\n'.join(items),
    }
    req = urllib.request.Request(
        f'{config.MODEL_API_BASE}/v1/responses',
        data=json.dumps(payload).encode(),
        headers={'Authorization': f'Bearer {config.MODEL_API_KEY}',
                 'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = json.load(resp)
    text = body.get('output_text') or json.dumps(body)
    start, end = text.find('{'), text.rfind('}')
    blurbs = json.loads(text[start:end + 1])
    out = template_glossary(labels, used)
    for label in out:
        if label in blurbs and isinstance(blurbs[label], str):
            out[label]['blurb'] = blurbs[label][:200]
            out[label]['source'] = 'live'
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skill', default='gen_ladipo_001')
    ap.add_argument('--live', action='store_true')
    args = ap.parse_args()
    sdir = config.skill_dir(args.skill)
    with open(os.path.join(sdir, 'masks.json')) as f:
        masks = json.load(f)
    with open(os.path.join(sdir, 'skill.json')) as f:
        skill = json.load(f)
    labels, used = collect(masks, skill)
    if args.live:
        if not config.MODEL_API_KEY:
            raise SystemExit('object_glossary: --live needs MODEL_API_KEY')
        glossary = live_glossary(labels, used)
    else:
        glossary = template_glossary(labels, used)
    path = os.path.join(sdir, 'glossary.json')
    with open(path, 'w') as f:
        json.dump(glossary, f, indent=1)
    live_n = sum(1 for v in glossary.values() if v['source'] == 'live')
    print(f'glossary -> {path}: {len(glossary)} labels ({live_n} live)')


if __name__ == '__main__':
    main()
