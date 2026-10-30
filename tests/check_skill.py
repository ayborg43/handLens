"""Maintained check for handLens skill artifacts (stdlib only).

Covers: skill.json schema per PRD section 7, trajectory cartesian paths
matching recorded positions, URDF validity, and WebXR page contents.
Run: python3 tests/check_skill.py [--skill <id> | --all]
"""
import json
import os
import sys
from xml.etree import ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'python'))
from reason import validate  # noqa: E402


def check_skill(skill_id):
    errors = []
    sdir = os.path.join(ROOT, 'skills', skill_id)
    if not os.path.isdir(sdir):
        return [f'missing skills dir for {skill_id}']

    with open(os.path.join(sdir, 'skill.json')) as f:
        skill = json.load(f)
    errors += validate(skill)

    # What the browser loads must exist: every step's clip, and a served skill.json
    # identical to the source one. (The dev server answers 200 with index.html for
    # missing files, so a missing clip only shows up as a broken player.)
    pub = os.path.join(ROOT, 'public', 'models', skill_id)
    pub_skill_path = os.path.join(pub, 'skill.json')
    if not os.path.exists(pub_skill_path):
        errors.append('missing public/models/%s/skill.json (run the sync step)' % skill_id)
    elif json.load(open(pub_skill_path)) != skill:
        errors.append('public skill.json differs from skills/%s/skill.json' % skill_id)
    for step in skill.get('steps', []):
        clip = (step.get('human') or {}).get('video_clip')
        clip_path = os.path.join(pub, clip) if clip else None
        if not clip_path or not os.path.exists(clip_path):
            errors.append(f'step {step.get("step_id")}: clip file missing: {clip}')
            continue
        with open(clip_path, 'rb') as f:
            if b'ftyp' not in f.read(12):
                errors.append(f'step {step.get("step_id")}: {clip} is not an MP4 file')

    for step in skill.get('steps', []):
        pos = step['spatial_3d']['position_m']
        traj_path = os.path.join(sdir, 'trajectories', 'traj_step%02d.yaml' % step['step_id'])
        if not os.path.exists(traj_path):
            errors.append(f'step {step["step_id"]}: missing trajectory file')
            continue
        body = open(traj_path).read()
        if 'sim_stub: true' not in body:
            errors.append(f'step {step["step_id"]}: trajectory missing sim_stub marker')
        for v in pos:
            if f'{v:.3f}' not in body:
                errors.append(f'step {step["step_id"]}: recorded position {v} not in trajectory')
                break

    try:
        ET.parse(os.path.join(sdir, 'workshop.urdf'))
    except Exception as e:  # noqa: BLE001
        errors.append(f'workshop.urdf invalid: {e}')

    glossary_path = os.path.join(sdir, 'glossary.json')
    if not os.path.exists(glossary_path):
        errors.append('missing glossary.json (run python/object_glossary.py)')
    else:
        glossary = json.load(open(glossary_path))
        with open(os.path.join(sdir, 'masks.json')) as f:
            mask_labels = {o['label'] for fr in json.load(f) for o in fr.get('objects', [])}
        for lab in sorted(mask_labels - set(glossary)):
            errors.append(f'glossary missing label: {lab}')
        for lab, entry in glossary.items():
            if not entry.get('blurb') or entry.get('source') not in ('template', 'live'):
                errors.append(f'glossary entry bad: {lab}')

    html_path = os.path.join(sdir, 'webxr', 'index.html')
    html = open(html_path).read() if os.path.exists(html_path) else ''
    for needle in ('three@0.160.0', 'VRButton', 'makeGhostHand',
                   'speechSynthesis', 'anchors'):
        if needle not in html:
            errors.append(f'webxr/index.html missing {needle}')

    anchors_path = os.path.join(sdir, 'webxr', 'anchors.json')
    if os.path.exists(anchors_path):
        anchors = json.load(open(anchors_path))
        if len(anchors) != len(skill.get('steps', [])):
            errors.append('anchors.json count != steps count')
    else:
        errors.append('missing webxr/anchors.json')
    return errors


def main():
    args = sys.argv[1:]
    if args[:1] == ['--skill']:
        ids = [args[1]]
    elif args[:1] == ['--all']:
        ids = sorted(d for d in os.listdir(os.path.join(ROOT, 'skills'))
                     if os.path.isdir(os.path.join(ROOT, 'skills', d)))
    else:
        ids = ['gen_ladipo_001']
    failed = False
    for skill_id in ids:
        errors = check_skill(skill_id)
        status = 'PASS' if not errors else 'FAIL'
        print(f'{skill_id}: {status}')
        for e in errors:
            print(f'  - {e}')
        failed = failed or bool(errors)
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
