"""Workshop audio -> transcript.json.

Live mode calls POST {BASE}/v1/asr/transcribe with model muse-voice-transcribe-1.0
(the /v1/audio/transcriptions path is NOT supported). The API wants a mono 16-bit
PCM WAV (16 or 24 kHz, <=10 min, <=32 MB) plus a JSON `request` part, and returns
`turns` with millisecond timestamps. Muse Voice supports 25 languages; Nigerian
Pidgin and Yoruba are not among them, so those get best-effort recognition.
Sample mode writes the launch-skill transcript so the pipeline runs with no key.
"""
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

SAMPLE_TRANSCRIPT = [
    {'start': 10.2, 'end': 16.8, 'text': 'Make sure battery don disconnect before you touch anything', 'lang': 'pcm-en', 'is_warning': False},
    {'start': 38.5, 'end': 44.5, 'text': 'No use 13, e go spoil am', 'lang': 'pcm', 'is_warning': False},
    {'start': 45.0, 'end': 58.0, 'text': 'Loosen alternator bolt with 14 spanner, turn am counter-clockwise', 'lang': 'pcm-en', 'is_warning': False},
    {'start': 92.0, 'end': 99.5, 'text': 'Careful, engine still hot, make you no burn hand', 'lang': 'pcm-en', 'is_warning': False},
    {'start': 118.0, 'end': 126.0, 'text': 'Tighten everything back, then test run am small', 'lang': 'pcm-en', 'is_warning': False},
]


def tag_warnings(entries, skill_id):
    phrases = config.warnings_for(skill_id)
    for e in entries:
        low = e['text'].lower()
        if e.get('is_warning') or any(p in low for p in phrases):
            e['is_warning'] = True
        else:
            e['is_warning'] = False
    return entries


def to_wav(src, dst):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', '24000',
                    '-c:a', 'pcm_s16le', '-map_metadata', '-1', dst], check=True)


def post_audio(wav_path, mode, language_bias=None):
    boundary = '----handlens' + uuid.uuid4().hex
    settings = {'model': 'muse-voice-transcribe-1.0', 'audioEncoding': 'WAV', 'mode': mode}
    if language_bias:
        settings['languageBias'] = language_bias
    with open(wav_path, 'rb') as f:
        audio = f.read()
    body = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="request"\r\n'
        f'Content-Type: application/json\r\n\r\n'.encode() + json.dumps(settings).encode() +
        f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="audio"; filename="audio.wav"\r\n'
        f'Content-Type: audio/wav\r\n\r\n'.encode() + audio + f'\r\n--{boundary}--\r\n'.encode()
    )
    url = f'{config.MODEL_API_BASE}/asr/transcribe?sessionId=handlens-{uuid.uuid4().hex[:8]}'
    for attempt in range(4):
        req = urllib.request.Request(url, data=body, headers={
            'Authorization': f'Bearer {config.MODEL_API_KEY}',
            'Accept': 'application/json',
            'Content-Type': f'multipart/form-data; boundary={boundary}'})
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors='replace')[:400]
            if e.code == 429 and attempt < 3:
                time.sleep(float(e.headers.get('Retry-After', 2 ** attempt)))
                continue
            raise SystemExit(f'Muse Voice HTTP {e.code} (mode {mode}): {detail}')


def live_transcript(skill_id, audio_path, mode):
    wav = os.path.join(os.path.dirname(audio_path), 'audio.wav')
    to_wav(audio_path, wav)
    try:
        data = post_audio(wav, mode, config.language_bias_for(skill_id))
    finally:
        if os.path.exists(wav):
            os.remove(wav)
    turns = data.get('turns') or []
    entries = [{
        'start': round(t['startMs'] / 1000, 2),
        'end': round(t['endMs'] / 1000, 2),
        'text': t.get('transcript', '').strip(),
        'lang': 'und',  # the API does not report a language per turn
    } for t in turns if t.get('transcript', '').strip()]
    if not entries and data.get('transcript', '').strip():
        entries = [{'start': 0.0, 'end': round(data.get('audioDurationMs', 0) / 1000, 2),
                    'text': data['transcript'].strip(), 'lang': 'und'}]
    return entries, data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skill', default='gen_ladipo_001')
    ap.add_argument('--sample', action='store_true')
    ap.add_argument('--mode', default='ENDPOINTING',
                    choices=['ENDPOINTING', 'PUSH_TO_TALK', 'DIARIZATION'],
                    help='ENDPOINTING gives turn-by-turn segments without speaker labels')
    args = ap.parse_args()
    sdir = config.skill_dir(args.skill)
    os.makedirs(sdir, exist_ok=True)
    audio = os.path.join(sdir, 'audio.m4a')
    if args.sample or not os.path.exists(audio) or not config.MODEL_API_KEY:
        entries = tag_warnings([dict(e) for e in SAMPLE_TRANSCRIPT], args.skill)
        mode = 'sample'
    else:
        entries, raw = live_transcript(args.skill, audio, args.mode)
        entries = tag_warnings(entries, args.skill)
        with open(os.path.join(sdir, 'transcript.raw.json'), 'w') as f:
            json.dump(raw, f, indent=1)
        mode = 'live'
    path = os.path.join(sdir, 'transcript.json')
    with open(path, 'w') as f:
        json.dump(entries, f, indent=1)
    config.record_mode(args.skill, 'transcript', mode)
    print(f'transcript.json [{mode}] -> {path}: {len(entries)} segments')


if __name__ == '__main__':
    main()
