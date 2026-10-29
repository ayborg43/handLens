"""MuJoCo sim stub -> public/models/<skill_id>/sim_preview.mp4.

Renders a kinematic replay headless: a tool sphere visits each step's
approach pose (target + 10cm) then target pose from skill.json, with the 5
step targets marked green. Encodes ~18s at 30fps with ffmpeg.
Also syncs workshop.urdf + trajectories/ into public for download links.

Usage: PYTHONPATH=/tmp/sim python3 tools/record_sim_clip.py --skill gen_ladipo_001
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'python'))
import config  # noqa: E402


def smooth(t):
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return [ai + (bi - ai) * t for ai, bi in zip(a, b)]


def build_model(steps):
    markers = '\n'.join(
        f'    <site name="t{i}" pos="{p[0]} {p[1]} {p[2]}" size="0.015" rgba="0 1 0 1"/>'
        for i, p in enumerate([s['spatial_3d']['position_m'] for s in steps]))
    return f"""<mujoco>
  <worldbody>
    <light name="top" pos="0 0 2"/>
    <geom name="floor" type="plane" size="1 1 0.1"/>
    <geom name="subject" type="box" size="0.2 0.125 0.15" pos="0 0 0.15" rgba="0.5 0.5 0.55 1"/>
{markers}
    <body name="tool" pos="0 0 0.5">
      <joint name="tx" type="slide" axis="1 0 0"/>
      <joint name="ty" type="slide" axis="0 1 0"/>
      <joint name="tz" type="slide" axis="0 0 1"/>
      <geom name="tcp" type="sphere" size="0.02" rgba="1 0.6 0 1"/>
    </body>
    <camera name="fixed" pos="0.8 -0.9 0.7" xyaxes="0.748 0.664 0 -0.276 0.310 0.910"/>
  </worldbody>
</mujoco>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skill', default='gen_ladipo_001')
    ap.add_argument('--fps', type=int, default=30)
    ap.add_argument('--secs-per-step', type=float, default=3.0)
    args = ap.parse_args()

    import mujoco
    import numpy as np  # noqa: F401

    sdir = config.skill_dir(args.skill)
    with open(os.path.join(sdir, 'skill.json')) as f:
        skill = json.load(f)
    steps = skill['steps']

    model = mujoco.MjModel.from_xml_string(build_model(steps))
    data = mujoco.MjData(model)
    renderer = mujoco.Renderer(model, 360, 640)
    cam = mujoco.MjvCamera()
    cam.fixedcamid = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_CAMERA, 'fixed')
    cam.type = mujoco.mjtCamera.mjCAMERA_FIXED

    home = [0.0, 0.0, 0.5]
    frames_dir = tempfile.mkdtemp(prefix='handlens_sim_')
    n_per = int(args.fps * args.secs_per_step)
    idx = 0
    seq = [home]
    for s in steps:
        target = s['spatial_3d']['position_m']
        approach = [target[0], target[1], target[2] + 0.1]
        seq += [approach, target]
    seq.append(home)
    for a, b in zip(seq, seq[1:]):
        for k in range(n_per // 2):
            pos = lerp(a, b, smooth(k / (n_per // 2 - 1)))
            data.qpos[0:3] = pos
            mujoco.mj_forward(model, data)
            renderer.update_scene(data, camera=cam)
            frame = renderer.render()
            with open(os.path.join(frames_dir, f'f_{idx:05d}.ppm'), 'wb') as fh:
                fh.write(f'P6\n640 360\n255\n'.encode() + frame.tobytes())
            idx += 1
    print(f'rendered {idx} frames')

    pub = config.public_dir(args.skill)
    os.makedirs(pub, exist_ok=True)
    out = os.path.join(pub, 'sim_preview.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(args.fps),
                    '-i', os.path.join(frames_dir, 'f_%05d.ppm'),
                    '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', out], check=True)
    shutil.rmtree(frames_dir)

    files = os.path.join(pub, 'files')
    os.makedirs(files, exist_ok=True)
    shutil.copy(os.path.join(sdir, 'workshop.urdf'), os.path.join(files, 'workshop.urdf'))
    for t in sorted(os.listdir(os.path.join(sdir, 'trajectories'))):
        shutil.copy(os.path.join(sdir, 'trajectories', t), os.path.join(files, t))
    print(f'sim clip -> {out} (+ files/ synced)')


if __name__ == '__main__':
    main()
