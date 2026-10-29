"""Minimal placeholder GLB (single box) so the viewer never blocks before the
real Luma capture lands. Replaced by the real model.glb from the Luma app.
Usage: python3 tools/make_placeholder_glb.py --skill gen_ladipo_001
"""
import argparse
import json
import os
import struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def make_glb(path):
    # 8-vertex box, 36 indices
    verts = [(-0.2, 0, -0.15), (0.2, 0, -0.15), (0.2, 0, 0.15), (-0.2, 0, 0.15),
             (-0.2, 0.25, -0.15), (0.2, 0.25, -0.15), (0.2, 0.25, 0.15), (-0.2, 0.25, 0.15)]
    idx = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1,
           1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0]
    vbin = b''.join(struct.pack('<3f', *v) for v in verts)
    ibin = b''.join(struct.pack('<H', i) for i in idx)
    gltf = {
        'asset': {'version': '2.0', 'generator': 'handLens placeholder'},
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': 'subject-placeholder'}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0}, 'indices': 1}]}],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': 8, 'type': 'VEC3',
             'min': [-0.2, 0, -0.15], 'max': [0.2, 0.25, 0.15]},
            {'bufferView': 1, 'componentType': 5123, 'count': 36, 'type': 'SCALAR'},
        ],
        'bufferViews': [
            {'buffer': 0, 'byteOffset': 0, 'byteLength': len(vbin)},
            {'buffer': 0, 'byteOffset': len(vbin), 'byteLength': len(ibin)},
        ],
        'buffers': [{'byteLength': len(vbin) + len(ibin)}],
    }
    jchunk = json.dumps(gltf).encode()
    while len(jchunk) % 4:
        jchunk += b' '
    bchunk = vbin + ibin
    total = 12 + 8 + len(jchunk) + 8 + len(bchunk)
    glb = struct.pack('<III', 0x46546C67, 2, total)
    glb += struct.pack('<II', len(jchunk), 0x4E4F534A) + jchunk
    glb += struct.pack('<II', len(bchunk), 0x004E4942) + bchunk
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(glb)
    print(f'placeholder GLB -> {path} ({len(glb)} bytes)')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skill', default='gen_ladipo_001')
    args = ap.parse_args()
    make_glb(os.path.join(ROOT, 'public', 'models', args.skill, 'model.glb'))


if __name__ == '__main__':
    main()
