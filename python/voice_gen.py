"""Pre-generate spoken step prompts -> public/models/<skill_id>/voice/stepNN.mp3.

Synthesizer is one function (synthesize()). Today it uses macOS `say` with a
neural voice (offline, free, no key): Meta publishes no TTS endpoint yet
(Muse Voice Transcribe is speech-to-text only; Glimmer TTS is future).
When Meta ships TTS, replace synthesize() with the API call — filenames,
callers, and fallbacks stay unchanged.

Filenames are deterministic: step<step_id:02d>.mp3. The viewer and WebXR page
try the MP3 first and fall back to live speechSynthesis when absent.

Usage: python3 python/voice_gen.py --skill gen_ladipo_001 [--voice Samantha]
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config  # noqa: E402


def synthesize_meta(text, out_mp3, model):
    """Meta TTS path. NOT YET AVAILABLE — verified 2026-10-28:
    dev.meta.ai capability lists cover Speech-to-text only, no TTS recipe or
    model ID exists in the docs, and third-party trackers list Glimmer TTS as
    future. When Meta ships it, implement the HTTP call here with MODEL_API_KEY."""
    raise NotImplementedError(
        'No Meta text-to-speech endpoint exists yet (see dev.meta.ai/docs). '
        'Use the default local synthesizer.'
    )


def synthesize(text, out_mp3, voice):
    """Render one prompt to MP3. Swap this body for the Meta TTS API later."""
    if os.environ.get('TTS_PROVIDER', 'local') == 'meta':
        return synthesize_meta(text, out_mp3, os.environ.get('TTS_MODEL', ''))
    tmp = tempfile.mkdtemp(prefix='handlens_voice_')
    aiff = os.path.join(tmp, 'out.aiff')
    subprocess.run(['say', '-v', voice, '-o', aiff, text], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', aiff,
                    '-c:a', 'libmp3lame', '-q:a', '4', out_mp3], check=True)
    shutil.rmtree(tmp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skill', default='gen_ladipo_001')
    ap.add_argument('--voice', default=os.environ.get('TTS_VOICE', 'Samantha'))
    args = ap.parse_args()

    if shutil.which('say') is None:
        raise SystemExit('voice_gen: macOS `say` not found; nothing generated')
    if shutil.which('ffmpeg') is None:
        raise SystemExit('voice_gen: ffmpeg not found; nothing generated')

    sdir = config.skill_dir(args.skill)
    with open(os.path.join(sdir, 'skill.json')) as f:
        skill = __import__('json').load(f)

    vdir = os.path.join(config.public_dir(args.skill), 'voice')
    os.makedirs(vdir, exist_ok=True)
    made = 0
    for step in skill['steps']:
        out = os.path.join(vdir, 'step%02d.mp3' % step['step_id'])
        if os.path.exists(out):
            continue
        synthesize(step['vr']['voice_prompt'], out, args.voice)
        made += 1
    print(f'voice -> {vdir}: {made} new files (voice={args.voice})')


if __name__ == '__main__':
    main()
