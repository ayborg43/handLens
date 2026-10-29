"""Reasoning -> skill.json v2 (canonical, drives human + robot + VR).

Offline builder (default here): maps each transcript segment to one step,
links the nearest SAM object by timestamp, estimates position_m from the bbox
center via the bboxTo3D heuristic, and infers robot.action_type from verbs.
Live LLM mode (with MODEL_API_KEY) posts the same inputs to Muse Spark 1.3
(Muse Spark Open via a partner as the open-weight option) and validates the
returned JSON against the schema. Pass --live-llm to run it.

Usage: python3 python/reason.py --skill gen_ladipo_001 [--sample]
"""
import argparse
import base64
import glob
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

TORQUE_VERBS = ('loosen', 'tighten', 'unscrew', 'screw')
SKILL_TITLES = {'gen_ladipo_001': 'Generator alternator bolt service'}


def bbox_to_3d(bbox, bounds, iw=1920, ih=1080):
    cx = (bbox[0] + bbox[2] / 2) / iw
    cy = (bbox[1] + bbox[3] / 2) / ih
    x = bounds['min'][0] + cx * (bounds['max'][0] - bounds['min'][0])
    z = bounds['min'][2] + cy * (bounds['max'][2] - bounds['min'][2])
    y = bounds['min'][1] + 0.6 * (bounds['max'][1] - bounds['min'][1])
    return [round(x, 3), round(y, 3), round(z, 3)]


def nearest_objects(masks, ts):
    if not masks:
        return []
    best = min(masks, key=lambda fr: abs(fr['timestamp'] - ts))
    return best.get('objects', [])


def pick_target(objects, text):
    low = text.lower()
    for o in objects:
        if o['label'].lower() in low and o['label'] != 'hand':
            return o
    for o in objects:
        if o['label'] != 'hand':
            return o
    return objects[0] if objects else {'id': 0, 'label': 'workpiece', 'bbox': [960, 540, 100, 100]}


def fmt_ts(sec):
    m, s = divmod(int(sec), 60)
    return f'{m:02d}:{s:02d}'


def build_steps(transcript, masks, skill_id):
    bounds = config.bounds_for(skill_id)
    steps = []
    for i, seg in enumerate(transcript[:10]):
        text = seg['text']
        objs = nearest_objects(masks, (seg['start'] + seg['end']) / 2)
        target = pick_target(objs, text)
        low = text.lower()
        if any(v in low for v in TORQUE_VERBS):
            action_type = 'torque'
            robot_extra = {'torque_nm': 8.5, 'direction': 'ccw' if 'loosen' in low else 'cw'}
        elif 'lift' in low or 'remove' in low or 'take' in low:
            action_type = 'pick'
            robot_extra = {}
        else:
            action_type = 'place'
            robot_extra = {}
        m = re.search(r'(\d+)\s*(mm)?\s*(spanner|wrench|key)', low)
        tool = f'{m.group(1)}mm {m.group(3)}' if m else 'hand tool'
        clip_name = 'clips/clip_%04d.mp4' % int(seg["start"])
        tool_id = 'tool_%02d' % (i + 1)
        target_id = 'obj_%02d' % target['id']
        pos = bbox_to_3d(target['bbox'], bounds)
        warning = 'workshop hazard nearby' if seg.get('is_warning') else ''
        step = {
            'step_id': i + 1,
            'timestamp': f"{fmt_ts(seg['start'])}-{fmt_ts(seg['end'])}",
            'action': text[:80],
            'tool': tool,
            'tool_object_id': tool_id,
            'target_object_id': target_id,
            'human': {
                'instruction': text[:120],
                'warning': warning,
                'transcript_local': text,
                'transcript_pidgin': text,
                'video_clip': clip_name,
            },
            'spatial_3d': {
                'anchor_id': target_id,
                'position_m': pos,
                'model_ref': 'model.glb#' + target_id,
            },
            'robot': {
                'action_type': action_type,
                'tool_tcp': tool.replace(' ', '_'),
                'target_pose': {'x': pos[0], 'y': pos[1], 'z': pos[2],
                                'qx': 0, 'qy': 0, 'qz': 0, 'qw': 1},
                'duration_sec': max(3, int(seg['end'] - seg['start'])),
                'urdf_trajectory': 'traj_step%02d.yaml' % (i + 1),
                'ros2_action': 'FollowJointTrajectory',
                'sim_stub': True,
            },
            'vr': {
                'xr_anchor': target_id,
                'overlay_type': 'arrow+highlight',
                'highlight_color': '#00FF00',
                'voice_prompt': text[:60],
                'hand_ghost': 'ghost_hand_step%02d.glb' % (i + 1),
            },
        }
        step['robot'].update(robot_extra)
        steps.append(step)
    return steps


SPARK_MODEL = 'muse-spark-1.3'
ACTION_TYPES = ['inspect', 'pick', 'place', 'press', 'twist', 'pour', 'cut', 'stitch', 'spray', 'torque']


def _spark_text(body):
    """Pull the assistant text out of a Responses API body."""
    if isinstance(body.get('output_text'), str) and body['output_text']:
        return body['output_text']
    parts = []
    for item in body.get('output', []):
        for c in item.get('content', []) or []:
            if c.get('type') == 'output_text' and c.get('text'):
                parts.append(c['text'])
    return ''.join(parts)


def spark_json(content, schema, name):
    """One Muse Spark 1.3 call returning JSON constrained to `schema` (text.format)."""
    payload = {
        'model': SPARK_MODEL,
        'input': [{'role': 'user', 'content': content}],
        'text': {'format': {'type': 'json_schema', 'name': name, 'schema': schema, 'strict': False}},
    }
    for attempt in range(4):
        req = urllib.request.Request(
            f'{config.MODEL_API_BASE}/responses', data=json.dumps(payload).encode(),
            headers={'Authorization': f'Bearer {config.MODEL_API_KEY}', 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                body = json.load(resp)
            return json.loads(_spark_text(body)), body
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors='replace')[:500]
            if e.code == 429 and attempt < 3:
                time.sleep(float(e.headers.get('Retry-After', 2 ** attempt)))
                continue
            raise SystemExit(f'Muse Spark HTTP {e.code}: {detail}')
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt < 3:
                time.sleep(2 * (attempt + 1))
                continue
            raise SystemExit('Muse Spark network error')
        except json.JSONDecodeError as e:
            if attempt < 3:
                continue
            raise SystemExit(f'Muse Spark returned non-JSON text: {e}')


def live_board(skill_id, transcript, masks, n_frames=12, n_steps=5):
    """Ask Muse Spark to write the steps from keyframes + SAM detections + transcript.

    Returns (board, raw) where `board` has the storyboard shape from_storyboard.build() takes.
    """
    sdir = config.skill_dir(skill_id)
    frames = sorted(glob.glob(os.path.join(sdir, 'frames', '*.jpg')))
    if not frames:
        raise SystemExit('live reasoning needs frames/ (the admin upload creates them)')
    fps = 2.0
    duration = len(frames) / fps
    picks = [frames[min(int(i * len(frames) / n_frames), len(frames) - 1)] for i in range(n_frames)]
    labels = config.prompts_for(skill_id)
    label_ids = {lab: 'obj_%02d' % (i * 10) for i, lab in enumerate(labels)}

    content = [{'type': 'input_text', 'text': (
        f'You are documenting a hands-on skill from a phone video ({duration:.0f} seconds long). '
        f'Below are {len(picks)} keyframes in time order, each preceded by its timestamp, then the '
        'speech transcript and SAM object detections. Write the skill as exactly '
        f'{n_steps} consecutive steps covering the whole video. Describe only what is visible or '
        'audible; do not invent tools, narration or safety rules. Use short plain English. '
        '"warning" must be empty unless a real hazard is visible in the footage. '
        f'"object" must be one of: {", ".join(labels)} (the main thing acted on or inspected).')}]
    for path in picks:
        i = frames.index(path)
        with open(path, 'rb') as f:
            b64 = base64.b64encode(f.read()).decode()
        content.append({'type': 'input_text', 'text': f'Keyframe at {i / fps:.1f}s:'})
        content.append({'type': 'input_image', 'image_url': f'data:image/jpeg;base64,{b64}'})
    spoken = '\n'.join(f"{t['start']:.1f}-{t['end']:.1f}s: {t['text']}" for t in transcript) or '(no recognisable speech)'
    content.append({'type': 'input_text', 'text': f'Speech transcript (Muse Voice):\n{spoken}'})
    dets = []
    for fr in masks:
        dets.append(f"{fr['timestamp']:.1f}s: " + ', '.join(f"{o['label']} {o['bbox']}" for o in fr['objects']))
    content.append({'type': 'input_text', 'text': 'SAM 3.1 detections (label, [x,y,w,h] px):\n' + '\n'.join(dets[:40])})

    schema = {
        'type': 'object', 'additionalProperties': False, 'required': ['steps'],
        'properties': {'steps': {'type': 'array', 'minItems': n_steps, 'maxItems': n_steps, 'items': {
            'type': 'object', 'additionalProperties': False,
            'required': ['start', 'end', 'action', 'instruction', 'object', 'action_type', 'warning'],
            'properties': {
                'start': {'type': 'number', 'description': 'step start, seconds'},
                'end': {'type': 'number', 'description': 'step end, seconds'},
                'action': {'type': 'string', 'description': 'title, at most 6 words'},
                'instruction': {'type': 'string', 'description': 'one sentence describing the action shown'},
                'object': {'type': 'string', 'enum': labels},
                'action_type': {'type': 'string', 'enum': ACTION_TYPES},
                'warning': {'type': 'string'},
            }}}},
    }
    result, raw = spark_json(content, schema, 'skill_steps')
    return result['steps'], raw, label_ids, duration


def board_from_spark(skill_id, spark_steps, masks, label_ids, duration):
    """Turn Muse Spark's steps into a storyboard dict; positions come from SAM boxes."""
    bounds = config.bounds_for(skill_id)
    steps = []
    prev_end = 0.0
    for i, st in enumerate(spark_steps):
        start = max(0.0, min(float(st['start']), duration))
        end = max(start + 1.0, min(float(st['end']), duration))
        start = max(start, prev_end) if i else 0.0
        mid = (start + end) / 2
        label = st['object']
        # best-scoring box of that label within the step window, else nearest frame
        cand = [(o['score'], fr, o) for fr in masks if start - 1 <= fr['timestamp'] <= end + 1
                for o in fr['objects'] if o['label'] == label]
        if cand:
            _, fr, obj = max(cand, key=lambda c: c[0])
            iw, ih = fr.get('image_size') or [1920, 1080]
            pos = bbox_to_3d(obj['bbox'], bounds, iw, ih)
        else:
            pos = [0.0, round(bounds['min'][1] + 0.5 * (bounds['max'][1] - bounds['min'][1]), 3), 0.0]
        steps.append({
            'start': round(start, 1), 'end': round(end, 1),
            'action': st['action'].strip(), 'instruction': st['instruction'].strip(),
            'object': label_ids[label], 'action_type': st['action_type'], 'tool': 'hand',
            'warning': (st.get('warning') or '').strip(), 'position_m': pos,
        })
        prev_end = end
    return steps


def validate(skill):
    errors = []
    steps = skill.get('steps', [])
    if not (5 <= len(steps) <= 10):
        errors.append(f'steps must be 5-10, got {len(steps)}')
    for i, st in enumerate(steps):
        for b in ('human', 'spatial_3d', 'robot', 'vr'):
            if b not in st:
                errors.append(f'step {i}: missing {b}')
        pos = st.get('spatial_3d', {}).get('position_m', [])
        if len(pos) != 3 or not all(isinstance(v, (int, float)) for v in pos):
            errors.append(f'step {i}: bad position_m')
        if st.get('robot', {}).get('action_type') == 'torque':
            if not isinstance(st['robot'].get('torque_nm'), (int, float)):
                errors.append(f'step {i}: torque needs torque_nm')
        if not st.get('vr', {}).get('voice_prompt'):
            errors.append(f'step {i}: missing voice_prompt')
    return errors


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skill', default='gen_ladipo_001')
    ap.add_argument('--sample', action='store_true')
    ap.add_argument('--live-llm', action='store_true',
                    help='have Muse Spark 1.3 write the steps from keyframes + SAM + transcript')
    args = ap.parse_args()
    sdir = config.skill_dir(args.skill)
    with open(os.path.join(sdir, 'transcript.json')) as f:
        transcript = json.load(f)
    with open(os.path.join(sdir, 'masks.json')) as f:
        masks = json.load(f)
    if args.live_llm and config.MODEL_API_KEY:
        import from_storyboard
        spark_steps, raw, label_ids, duration = live_board(args.skill, transcript, masks)
        with open(os.path.join(sdir, 'reasoning.raw.json'), 'w') as f:
            json.dump(raw, f, indent=1)
        board = {
            'title': config.title_for(args.skill),
            'capture_device': 'Phone video',
            'language_pack': [],
            'note': (f'Steps written by Muse Spark 1.3 from keyframes, SAM 3.1 detections and the Muse Voice '
                     f'transcript. position_m comes from SAM box centres and is a placeholder until the 3D '
                     f'model is captured and calibrated.'),
            'objects': {oid: lab for lab, oid in label_ids.items()},
            'steps': board_from_spark(args.skill, spark_steps, masks, label_ids, duration),
        }
        skill = from_storyboard.build(board, args.skill)
        steps = skill['steps']
        mode = 'live'
    else:
        steps = build_steps(transcript, masks, args.skill)
        mode = 'offline'
    title = SKILL_TITLES.get(args.skill, args.skill)
    config_path = os.path.join(sdir, 'skill.config.json')
    if os.path.exists(config_path):
        with open(config_path) as f:
            title = json.load(f).get('title', title) or title
    if mode != 'live':
        skill = {
            'project_id': args.skill,
            'skill_title': title,
            'capture_device': 'SM-S911B',
            'language_pack': ['pcm', 'pcm-en'],
            'world_scale': 'meters, table at y=0, subject ~0.5m wide',
            'steps': steps,
        }
    errors = validate(skill)
    if errors:
        raise SystemExit('invalid skill.json: ' + '; '.join(errors))
    out = os.path.join(sdir, 'skill.json')
    with open(out, 'w') as f:
        json.dump(skill, f, indent=1)
    # Sync the web-served copy for the viewer (single source stays in skills/)
    pub = config.public_dir(args.skill)
    os.makedirs(pub, exist_ok=True)
    shutil.copy(out, os.path.join(pub, 'skill.json'))
    idx_path = os.path.join(ROOT_PUB := os.path.join(config.ROOT, 'public', 'models'), 'index.json')
    os.makedirs(ROOT_PUB, exist_ok=True)
    index = {'skills': []}
    if os.path.exists(idx_path):
        with open(idx_path) as f:
            index = json.load(f)
    entry = {'id': args.skill, 'title': skill['skill_title']}
    index['skills'] = [s for s in index['skills'] if s.get('id') != args.skill]
    index['skills'].append(entry)
    with open(idx_path, 'w') as f:
        json.dump(index, f, indent=1)
    config.record_mode(args.skill, 'reasoning', mode)
    print(f'skill.json -> {out} (+ public copy): {len(steps)} steps, valid')


if __name__ == '__main__':
    main()
