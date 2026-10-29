"""storyboard.json -> skill.json v2, for skills whose steps were written by hand.

Use this when footage exists but the Meta pipeline has not been run yet (no
MODEL_API_KEY). It produces the same schema as reason.py, records the
reasoning stage as 'manual', and never invents a transcript or detections.
Running the live pipeline later (sam_api, transcribe, reason) overwrites it.

Usage: python3 python/from_storyboard.py --skill blender_assembly_001
"""
import argparse
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config
from reason import fmt_ts, validate


def build(board, skill_id):
    steps = []
    for i, st in enumerate(board['steps']):
        target = st['object']
        pos = [round(v, 3) for v in st['position_m']]
        tool = st.get('tool', 'hand')
        steps.append({
            'step_id': i + 1,
            'timestamp': f"{fmt_ts(st['start'])}-{fmt_ts(st['end'])}",
            'action': st['action'],
            'tool': tool,
            'tool_object_id': 'tool_%02d' % (i + 1),
            'target_object_id': target,
            'human': {
                'instruction': st['instruction'],
                'warning': st.get('warning', ''),
                'video_clip': 'clips/clip_%04d.mp4' % int(st['start']),
            },
            'spatial_3d': {'anchor_id': target, 'position_m': pos, 'model_ref': 'model.glb#' + target},
            'robot': {
                'action_type': st['action_type'],
                'tool_tcp': tool.replace(' ', '_'),
                'target_pose': {'x': pos[0], 'y': pos[1], 'z': pos[2], 'qx': 0, 'qy': 0, 'qz': 0, 'qw': 1},
                'duration_sec': max(3, int(st['end'] - st['start'])),
                'urdf_trajectory': 'traj_step%02d.yaml' % (i + 1),
                'ros2_action': 'FollowJointTrajectory',
                'sim_stub': True,
            },
            'vr': {
                'xr_anchor': target,
                'overlay_type': 'arrow+highlight',
                'highlight_color': '#00FF00',
                'voice_prompt': st['instruction'][:60],
                'hand_ghost': 'ghost_hand_step%02d.glb' % (i + 1),
            },
        })
    return {
        'project_id': skill_id,
        'skill_title': board['title'],
        'capture_device': board.get('capture_device', 'unknown'),
        'language_pack': board.get('language_pack', []),
        'world_scale': 'meters, table at y=0, subject ~0.5m wide',
        'notes': board.get('note', ''),
        'objects': board.get('objects', {}),
        'steps': steps,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skill', required=True)
    args = ap.parse_args()
    sdir = config.skill_dir(args.skill)
    with open(os.path.join(sdir, 'storyboard.json')) as f:
        board = json.load(f)
    skill = build(board, args.skill)
    errors = validate(skill)
    if errors:
        raise SystemExit('invalid skill.json: ' + '; '.join(errors))
    out = os.path.join(sdir, 'skill.json')
    with open(out, 'w') as f:
        json.dump(skill, f, indent=1)

    pub = config.public_dir(args.skill)
    os.makedirs(pub, exist_ok=True)
    shutil.copy(out, os.path.join(pub, 'skill.json'))

    idx_path = os.path.join(config.ROOT, 'public', 'models', 'index.json')
    index = json.load(open(idx_path)) if os.path.exists(idx_path) else {'skills': []}
    index['skills'] = [s for s in index['skills'] if s.get('id') != args.skill]
    index['skills'].insert(0, {'id': args.skill, 'title': skill['skill_title']})  # real footage first
    with open(idx_path, 'w') as f:
        json.dump(index, f, indent=1)

    config.record_mode(args.skill, 'reasoning', 'manual')
    config.record_mode(args.skill, 'masks', 'none')
    config.record_mode(args.skill, 'transcript', 'none')
    print(f'skill.json [manual] -> {out}: {len(skill["steps"])} steps, valid')


if __name__ == '__main__':
    main()
