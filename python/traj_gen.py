"""skill.json -> trajectories/traj_stepXX.yaml (P1 sim stub).

Positions are joint-space placeholders for sim replay ONLY (zeros with a
small per-step variation). Real target poses live in metadata.target_pose.
Never claim ROS execution from these files; metadata.sim_stub is True until
real IK is solved.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

JOINTS = ['joint1', 'joint2', 'joint3', 'joint4', 'joint5', 'joint6']


def yaml_dump(traj):
    lines = ['joint_names: [%s]' % ', '.join(traj['joint_names'])]
    lines.append('sim_stub: true')
    lines.append('points:')
    for p in traj['points']:
        pos = ', '.join(f'{v:.3f}' for v in p['positions'])
        lines.append(f"  - positions: [{pos}]")
        lines.append(f"    time_from_start: {p['time_from_start']}")
    lines.append('metadata:')
    for k, v in traj['metadata'].items():
        lines.append(f'  {k}: {json.dumps(v)}')
    lines.append('cartesian_path:')
    for wp in traj['cartesian_path']:
        lines.append(f"  - frame: {wp['frame']}")
        lines.append(f"    position_m: [{', '.join(f'{v:.3f}' for v in wp['position_m'])}]")
    return '\n'.join(lines) + '\n'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skill', default='gen_ladipo_001')
    args = ap.parse_args()
    sdir = config.skill_dir(args.skill)
    with open(os.path.join(sdir, 'skill.json')) as f:
        skill = json.load(f)
    tdir = os.path.join(sdir, 'trajectories')
    os.makedirs(tdir, exist_ok=True)
    for step in skill['steps']:
        n = step['step_id'] * 0.05
        target = step['spatial_3d']['position_m']
        approach = [round(target[0], 3), round(target[1], 3), round(target[2] + 0.1, 3)]
        traj = {
            'joint_names': JOINTS,
            'points': [
                {'positions': [0, 0, 0, 0, 0, 0], 'time_from_start': 0},
                {'positions': [n, n, 0, 0, 0, 0], 'time_from_start': 2},
                {'positions': [n, n, n, 0, 0, 0], 'time_from_start': 5},
            ],
            'cartesian_path': [
                {'frame': 'approach', 'position_m': approach},
                {'frame': 'target', 'position_m': [round(v, 3) for v in target]},
            ],
            'metadata': dict(step['robot'], sim_stub=True),
        }
        path = os.path.join(tdir, 'traj_step%02d.yaml' % step['step_id'])
        with open(path, 'w') as f:
            f.write(yaml_dump(traj))
    print(f'trajectories -> {tdir}: {len(skill["steps"])} files (sim_stub)')


if __name__ == '__main__':
    main()
