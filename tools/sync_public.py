"""Publish a skill's AI evidence and honesty status to the web-served folder.

Copies transcript.json / masks.json (the evidence behind each step) and the
WebXR page into public/models/<id>/, and writes status.json so the viewer can
label every output as captured, live, sample, placeholder, or stub.

Usage: python3 tools/sync_public.py --skill gen_ladipo_001 | --all
"""
import argparse
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'python'))
import config  # noqa: E402

PLACEHOLDER_GLB_BYTES = 5000


def clip_status(pub):
    clips = sorted(
        os.path.join(pub, 'clips', f)
        for f in os.listdir(os.path.join(pub, 'clips')) if f.endswith('.mp4')
    ) if os.path.isdir(os.path.join(pub, 'clips')) else []
    if not clips:
        return 'missing'
    digests = set()
    for c in clips:
        with open(c, 'rb') as f:
            digests.add(hashlib.sha256(f.read()).hexdigest())
    return 'placeholder' if len(clips) > 1 and len(digests) == 1 else 'captured'


def model_status(pub):
    glb = os.path.join(pub, 'model.glb')
    if not os.path.exists(glb):
        return 'missing'
    return 'placeholder' if os.path.getsize(glb) < PLACEHOLDER_GLB_BYTES else 'captured'


def sync(skill_id):
    sdir = config.skill_dir(skill_id)
    pub = config.public_dir(skill_id)
    os.makedirs(pub, exist_ok=True)

    ai = os.path.join(pub, 'ai')
    os.makedirs(ai, exist_ok=True)
    glossary_src = os.path.join(sdir, 'glossary.json')
    if os.path.exists(glossary_src):
        shutil.copy(glossary_src, os.path.join(pub, 'glossary.json'))
    for name in ('transcript.json', 'masks.json'):
        src = os.path.join(sdir, name)
        if not os.path.exists(src):
            continue
        if name == 'masks.json':
            # the browser only draws boxes; keep the heavy mask pixels out of the served copy
            with open(src) as f:
                frames = json.load(f)
            for fr in frames:
                for o in fr.get('objects', []):
                    o.pop('mask', None)
            with open(os.path.join(ai, name), 'w') as f:
                json.dump(frames, f)
        else:
            shutil.copy(src, os.path.join(ai, name))

    xr_src = os.path.join(sdir, 'webxr')
    if os.path.isdir(xr_src):
        xr_dst = os.path.join(pub, 'webxr')
        os.makedirs(xr_dst, exist_ok=True)
        for f in os.listdir(xr_src):
            shutil.copy(os.path.join(xr_src, f), os.path.join(xr_dst, f))

    prov = {}
    prov_path = os.path.join(sdir, 'provenance.json')
    if os.path.exists(prov_path):
        with open(prov_path) as f:
            prov = json.load(f)

    status = {
        'model': model_status(pub),
        'clips': clip_status(pub),
        'masks': prov.get('masks', 'unknown'),
        'transcript': prov.get('transcript', 'unknown'),
        'reasoning': prov.get('reasoning', 'unknown'),
        'robot': 'stub',
        'vr': 'stub',
    }
    with open(os.path.join(pub, 'status.json'), 'w') as f:
        json.dump(status, f, indent=1)
    print(f'{skill_id}: {status}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skill')
    ap.add_argument('--all', action='store_true')
    args = ap.parse_args()
    if args.all:
        ids = [d for d in os.listdir(os.path.join(ROOT, 'public', 'models'))
               if os.path.isdir(os.path.join(ROOT, 'public', 'models', d))]
    elif args.skill:
        ids = [args.skill]
    else:
        ap.error('pass --skill <id> or --all')
    for i in sorted(ids):
        sync(i)


if __name__ == '__main__':
    main()
