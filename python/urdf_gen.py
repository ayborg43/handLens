"""skill.json + masks.json -> workshop.urdf (P1 sim stub).

Creates the base link FIRST, then one link per unique object id with visual /
collision / inertial placeholders. Objects linked to torque steps get revolute
joints; everything else is fixed. Output must parse as XML and open in a URDF
viewer. Sim-only: no real dynamics tuning.
"""
import argparse
import json
import os
import sys
from xml.etree import ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config


def gen_urdf(glb_name, objects, torque_ids, out_path):
    robot = ET.Element('robot', name='workshop')

    base = ET.SubElement(robot, 'link', name='base')
    inertial = ET.SubElement(base, 'inertial')
    ET.SubElement(inertial, 'mass', value='1.0')
    ET.SubElement(inertial, 'inertia', ixx='0.01', ixy='0', ixz='0', iyy='0.01', iyz='0', izz='0.01')

    for obj in objects:
        oid = 'obj_%02d' % obj['id']
        link = ET.SubElement(robot, 'link', name=oid)
        visual = ET.SubElement(link, 'visual')
        ET.SubElement(visual, 'geometry').append(ET.Element('mesh', filename=glb_name))
        collision = ET.SubElement(link, 'collision')
        ET.SubElement(collision, 'geometry').append(ET.Element('box', size='0.05 0.05 0.05'))
        sub = ET.SubElement(link, 'inertial')
        ET.SubElement(sub, 'mass', value='0.1')
        ET.SubElement(sub, 'inertia', ixx='0.001', ixy='0', ixz='0', iyy='0.001', iyz='0', izz='0.001')
        if oid in torque_ids:
            joint = ET.SubElement(robot, 'joint', name='%s_joint' % oid, type='revolute')
            ET.SubElement(joint, 'parent', link='base')
            ET.SubElement(joint, 'child', link=oid)
            ET.SubElement(joint, 'axis', xyz='0 0 1')
            ET.SubElement(joint, 'limit', lower='-3.14', upper='3.14', effort='10', velocity='1')
        else:
            joint = ET.SubElement(robot, 'joint', name='%s_joint' % oid, type='fixed')
            ET.SubElement(joint, 'parent', link='base')
            ET.SubElement(joint, 'child', link=oid)

    ET.indent(robot)
    ET.ElementTree(robot).write(out_path, xml_declaration=True)
    print(f'URDF written to {out_path}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skill', default='gen_ladipo_001')
    args = ap.parse_args()
    sdir = config.skill_dir(args.skill)
    with open(os.path.join(sdir, 'skill.json')) as f:
        skill = json.load(f)
    masks_path = os.path.join(sdir, 'masks.json')
    masks = json.load(open(masks_path)) if os.path.exists(masks_path) else []
    seen = {}
    for fr in masks:
        for o in fr['objects']:
            seen[o['id']] = o['label']
    if not seen:
        # No SAM output yet: use the objects named in skill.json itself
        for oid in {s['target_object_id'] for s in skill['steps']}:
            seen[int(''.join(c for c in oid if c.isdigit()) or 0)] = skill.get('objects', {}).get(oid, oid)
    objects = [{'id': i, 'label': label} for i, label in sorted(seen.items())]
    torque_ids = {s['target_object_id'] for s in skill['steps']
                  if s['robot'].get('action_type') == 'torque'}
    gen_urdf('model.glb', objects, torque_ids, os.path.join(sdir, 'workshop.urdf'))
    ET.parse(os.path.join(sdir, 'workshop.urdf'))
    print('URDF parses as valid XML')


if __name__ == '__main__':
    main()
