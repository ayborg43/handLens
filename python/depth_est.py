"""Depth refinement stub (optional).

The bboxTo3D heuristic fixes y at table height. When a Depth Anything V2
Small depth map is precomputed offline (M4 MPS), this script adjusts each
step's y from the sampled mask-center depth. Without a depth map it is a
pass-through that leaves skill.json untouched.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skill', default='gen_ladipo_001')
    args = ap.parse_args()
    sdir = config.skill_dir(args.skill)
    depth_map = os.path.join(sdir, 'depth.json')
    if not os.path.exists(depth_map):
        print('depth_est: no depth.json, keeping heuristic y (pass-through)')
        return
    with open(os.path.join(sdir, 'skill.json')) as f:
        skill = json.load(f)
    with open(depth_map) as f:
        depth = json.load(f)
    bounds = config.bounds_for(args.skill)
    span = bounds['max'][1] - bounds['min'][1]
    for step in skill['steps']:
        sample = depth.get(str(step['step_id']))
        if sample is not None:
            step['spatial_3d']['position_m'][1] = round(bounds['min'][1] + sample * span, 3)
    with open(os.path.join(sdir, 'skill.json'), 'w') as f:
        json.dump(skill, f, indent=1)
    print('depth_est: refined y from depth.json')


if __name__ == '__main__':
    main()
