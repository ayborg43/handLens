"""SAM 3.1 segmentation -> masks.json.

Live mode calls POST {BASE}/v1/responses with {"model": "sam-3.1"} (the only
supported SAM path; the old /v1/sam3.1/segment string was invented).
Sample mode (--sample) writes deterministic launch-skill masks so the pipeline
runs with no API key and no footage.
"""
import argparse
import base64
import glob
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

SAMPLE_OBJECTS = [
    {'id': 0, 'label': 'engine block', 'bbox': [600, 300, 700, 500], 'score': 0.96},
    {'id': 1, 'label': 'hand', 'bbox': [900, 500, 180, 220], 'score': 0.93},
    {'id': 2, 'label': 'spanner', 'bbox': [380, 260, 120, 60], 'score': 0.91},
    {'id': 3, 'label': 'bolt', 'bbox': [412, 298, 45, 48], 'score': 0.94},
    {'id': 4, 'label': 'screwdriver', 'bbox': [1050, 620, 200, 40], 'score': 0.89},
]

TIMESTAMPS = [12.0, 42.1, 68.5, 95.0, 121.5]
SAMPLE_SIZE = [1920, 1080]


def sample_masks():
    frames = []
    for i, ts in enumerate(TIMESTAMPS):
        frames.append({'frame_idx': i * 60, 'timestamp': ts,
                       'image_size': SAMPLE_SIZE, 'objects': SAMPLE_OBJECTS})
    return frames


BOX_RE = re.compile(
    r'(\d+)<\|box;x1=(-?[\d.]+);y1=(-?[\d.]+);x2=(-?[\d.]+);y2=(-?[\d.]+);w=(\d+);h=(\d+)(?:;c=([\d.]+))?\|>'
    r'(?:<\|mask;([^|]*)\|>)?')


def parse_sam_text(text):
    """Parse SAM's text grammar: records of `id<|box;...|><|mask;...|>`."""
    found = []
    for m in BOX_RE.finditer(text):
        x1, y1, x2, y2 = (float(m.group(i)) for i in (2, 3, 4, 5))
        found.append({
            'bbox': [round(x1), round(y1), round(x2 - x1), round(y2 - y1)],  # x, y, w, h in source pixels
            'score': round(float(m.group(8)), 3) if m.group(8) else None,
            'image_size': [int(m.group(6)), int(m.group(7))],
            'mask': m.group(9),
        })
    return found


def sam_call(img_b64, prompt):
    """One SAM 3.1 request = one concept prompt on one image (a list of prompts returns nothing)."""
    payload = {
        'model': 'sam-3.1', 'stream': True,
        'metadata': {'include_confidence': 'true'},
        'input': [{'role': 'user', 'content': [
            {'type': 'input_text', 'text': prompt},
            {'type': 'input_image', 'image_url': f'data:image/jpeg;base64,{img_b64}'}]}],
    }
    for attempt in range(5):
        req = urllib.request.Request(
            f'{config.MODEL_API_BASE}/responses', data=json.dumps(payload).encode(),
            headers={'Authorization': f'Bearer {config.MODEL_API_KEY}',
                     'Content-Type': 'application/json', 'Accept': 'text/event-stream'})
        try:
            done_text, deltas = None, []
            with urllib.request.urlopen(req, timeout=180) as resp:
                for raw in resp:
                    line = raw.decode().strip()
                    if not line.startswith('data:'):
                        continue
                    body = line[5:].strip()
                    if body == '[DONE]':
                        break
                    ev = json.loads(body)
                    if ev.get('type') == 'response.output_text.delta':
                        deltas.append(ev.get('delta', ''))
                    elif ev.get('type') == 'response.output_text.done':
                        done_text = ev.get('text', '')
            return parse_sam_text(done_text if done_text is not None else ''.join(deltas))
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 4:
                time.sleep(float(e.headers.get('Retry-After', 2 ** attempt)))
                continue
            raise SystemExit(f'SAM HTTP {e.code} for "{prompt}": {e.read().decode(errors="replace")[:300]}')
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:  # transient network trouble
            if attempt < 4:
                time.sleep(2 * (attempt + 1))
                continue
            raise SystemExit(f'SAM network error for "{prompt}": {e}')
    return []


def jpeg_size(path):
    """Frame dimensions without Pillow (JPEG SOF header). Falls back to 1080p."""
    import struct
    try:
        with open(path, 'rb') as f:
            data = f.read(1 << 20)
        i = 2
        while i < len(data) - 9:
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xC0, 0xC1, 0xC2):
                h, w = struct.unpack('>HH', data[i + 5:i + 9])
                return [w, h]
            i += 2 + struct.unpack('>H', data[i + 2:i + 4])[0]
    except (OSError, struct.error, IndexError):
        pass
    return [1920, 1080]


def live_masks(skill_id, frames_dir, every=4, limit=None):
    paths = sorted(glob.glob(os.path.join(frames_dir, '*.jpg')))
    if not paths:
        raise SystemExit(f'no frames in {frames_dir}; run with --sample or capture first')
    picked = list(enumerate(paths))[::max(every, 1)]
    if limit:
        picked = picked[:limit]
    prompts = config.prompts_for(skill_id)
    jobs = []
    for idx, path in picked:
        with open(path, 'rb') as f:
            img_b64 = base64.b64encode(f.read()).decode()
        for pi, prompt in enumerate(prompts):
            jobs.append((idx, pi, prompt, img_b64))
    print(f'SAM 3.1: {len(picked)} frames x {len(prompts)} prompts = {len(jobs)} calls', flush=True)

    results = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futs = {pool.submit(sam_call, j[3], j[2]): j for j in jobs}
        for fut in as_completed(futs):
            idx, pi, prompt, _ = futs[fut]
            results[(idx, pi)] = fut.result()

    out = []
    for idx, path in picked:
        objs = []
        size = None
        for pi, prompt in enumerate(prompts):
            for k, item in enumerate(results.get((idx, pi), [])):
                size = size or item.get('image_size')
                objs.append({'id': pi * 10 + k, 'label': prompt, 'bbox': item['bbox'],
                             'score': item['score'] if item['score'] is not None else 0.0,
                             'mask': item['mask']})
        out.append({'frame_idx': idx, 'timestamp': idx * 0.5,
                    'image_size': size or jpeg_size(path), 'objects': objs})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skill', default='gen_ladipo_001')
    ap.add_argument('--sample', action='store_true')
    ap.add_argument('--every', type=int, default=4, help='use every Nth frame (2fps frames, so 4 = one per 2s)')
    ap.add_argument('--limit', type=int, default=None, help='cap frames, for a cheap smoke test')
    ap.add_argument('--out', default='masks.json')
    args = ap.parse_args()
    sdir = config.skill_dir(args.skill)
    os.makedirs(sdir, exist_ok=True)
    frames_dir = os.path.join(sdir, 'frames')
    has_frames = bool(glob.glob(os.path.join(frames_dir, '*.jpg')))
    if args.sample or not has_frames or not config.MODEL_API_KEY:
        frames = sample_masks()
        mode = 'sample'
    else:
        frames = live_masks(args.skill, frames_dir, args.every, args.limit)
        mode = 'live'
    path = os.path.join(sdir, args.out)
    with open(path, 'w') as f:
        json.dump(frames, f, indent=1)
    if args.out == 'masks.json':
        config.record_mode(args.skill, 'masks', mode)
    total = sum(len(fr['objects']) for fr in frames)
    print(f'masks.json [{mode}] -> {path}: {len(frames)} frames, {total} objects')


if __name__ == '__main__':
    main()
