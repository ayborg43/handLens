# handLens — any skill, in 3D

Capture any hands-on skill once on a Samsung S23 and compile it into three
usable forms from one canonical `skill.json`: a human 3D manual (this app),
a robot-executable stub (URDF + ROS2-style trajectories + MuJoCo scene),
and a VR overlay stub (WebXR page). It works on any hands-on skill; the repository ships
several real phone-video skills (see `public/models/index.json`).

Spec: [PRD.md](PRD.md) · Roadmap: [soul.md](soul.md)

## Built during the hackathon

Meta Global AI Developer Hackathon, building period Oct 27 – Nov 4, 2026. This repository was
created inside that window and everything in it is the hackathon project:

- **Skill pipeline** (`python/`, `tools/`): SAM 3.1 masks, Muse Voice transcription, step reasoning,
  depth stub, URDF, trajectories, WebXR page generators, MuJoCo clip recorder, and the
  `sync_public.py` honesty-status step.
- **Viewer** (`src/`): landing + skill library, 3D stage with pins, Guide / Compare views,
  AI trace, VR tab with QR, captions, progress, sharing and skill-pack export.
- **Admin upload server** (`server/`), **artifact checker** (`tests/check_skill.py`), the PRD
  and roadmap (`PRD.md`, `soul.md`).
- **Tap-to-identify**: tap any outlined object in a step video to see its name, match
  confidence and a plain-language blurb (`python/object_glossary.py`; `--live` for AI
  blurbs), plus a jump link to the step that uses it.
- Written with AI coding assistance (Claude Code).

**What is real today:** the pipeline, viewer and checker. **What is still placeholder:** the 3D
model and clips are generated stand-ins, and the masks, transcript and reasoning are sample or
offline-builder data until the pipeline is run live with real footage and `MODEL_API_KEY`. The
app labels each of these on screen (see "What the viewer shows" below).

### Third-party software

| Package | License |
|---|---|
| React, React DOM, Three.js, Vite, Express, Multer, fflate, qrcode-generator | MIT |
| Outfit font (via @fontsource/outfit) | SIL OFL 1.1 |
| MuJoCo (sim tooling only, optional) | Apache-2.0 |
| NumPy (sim tooling only, optional) | BSD-3-Clause |

The VR page loads Three.js from unpkg. Captured footage, audio and Luma models are not
included in the repository; anyone filmed must have consented to its use.

License: [MIT](LICENSE).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173/ in a browser. Pick a skill, rotate the model,
click a hotspot or step. No login, no keys in the client.

## Pipeline (one command per stage, all stdlib-only Python)

```bash
python3 -m venv .venv && .venv/bin/pip install mujoco numpy   # sim tooling only; pipeline itself is stdlib-only
python3 tests/check_skill.py --all   # maintained artifact check (schema, trajectories, URDF, WebXR)
python3 python/voice_gen.py --skill gen_ladipo_001  # pre-generate studio voice MP3s (macOS say; Meta TTS later)
python3 python/object_glossary.py --skill gen_ladipo_001  # tap-to-identify names+blurbs (add --live with a key for AI blurbs)
python3 tools/make_placeholder_glb.py --skill gen_ladipo_001
python3 python/sam_api.py --skill gen_ladipo_001 --sample       # needs --sample off + MODEL_API_KEY + frames/ for live SAM
python3 python/transcribe.py --skill gen_ladipo_001 --sample    # live: needs audio.m4a + MODEL_API_KEY
python3 python/reason.py --skill gen_ladipo_001 --sample        # builds + validates skill.json, syncs public copy
python3 python/depth_est.py --skill gen_ladipo_001              # pass-through without depth.json
python3 python/urdf_gen.py --skill gen_ladipo_001               # workshop.urdf (sim stub)
python3 python/traj_gen.py --skill gen_ladipo_001               # trajectories/*.yaml (sim stub)
python3 python/webxr_gen.py --skill gen_ladipo_001              # webxr/ static page
python3 tools/sync_public.py --skill gen_ladipo_001             # publish AI evidence, VR page + status.json to public/
.venv/bin/python tools/record_sim_clip.py --skill gen_ladipo_001  # MuJoCo sim_preview.mp4 + files/ sync
```

Live Meta endpoints (verified, see PRD §9): text/reasoning via
`POST /v1/responses` (`muse-spark-1.3`; Muse Spark Open via a partner as the open-weight option), speech via
`POST /v1/asr/transcribe` (`muse-voice-transcribe-1.0`), SAM 3.1 via
`POST /v1/responses` with `{"model": "sam-3.1"}`.

## What the viewer shows

- **Landing + skill library** at `#/`; each skill deep-links to `#/<skill_id>/<step>`.
- **3D stage** with numbered pins, a step rail, progress tracking (saved in the browser),
  arrow-key navigation, and a top-down map when WebGL is unavailable.
- **Guide / Compare**: the human clip, the MuJoCo robot replay and the WebXR overlay side by side.
- **AI trace tab**: the transcript line, SAM detections and `skill.json` snippet behind each step.
- **Honest status chips** (captured, live, sample data, placeholder, stub). They come from
  `public/models/<id>/status.json`, written by `tools/sync_public.py` from `skills/<id>/provenance.json`,
  which each pipeline stage updates (`live` only when it really called the Meta API).
- **Workshop words / English** toggle, captions on clips, read-aloud, copy-link, and a one-click
  skill pack zip (skill.json, URDF, trajectories, VR page, evidence).

## Run the live pipeline on a skill

The Meta stages need a key. Create `.env` (gitignored; see `.env.example`) with
`MODEL_API_KEY=...`, then for a skill that already has `skill.mp4`, `audio.m4a` and `frames/`
(the admin upload creates all three):

```bash
python3 python/sam_api.py --skill <id>        # SAM 3.1 on frames/ (one request per label per frame)
python3 python/transcribe.py --skill <id>     # Muse Voice on audio.m4a
python3 python/reason.py --skill <id> --live-llm   # Muse Spark 1.3 writes the steps
python3 python/urdf_gen.py --skill <id> && python3 python/traj_gen.py --skill <id> && python3 python/webxr_gen.py --skill <id>
.venv/bin/python tools/record_sim_clip.py --skill <id> && python3 tools/sync_public.py --skill <id>
```

`blender_assembly_001` was ingested from a phone video and run live: SAM 3.1 on every 4th frame
(one request per label), Muse Voice on the audio, and Muse Spark 1.3 writing the steps from
keyframes + detections + transcript (`python/reason.py --live-llm`). The video has almost no
narration, so Muse Voice returned a single word; the trace tab says so. For a skill without an API
key, `python/from_storyboard.py` builds a `skill.json` from a hand-written `storyboard.json` and
labels it "Written from the footage". Muse Voice supports 25 languages; Nigerian Pidgin and
Yoruba are not among them.

## Admin mode (upload in the browser)

```bash
node server/upload.js   # http://127.0.0.1:5174, local only
```

Open the app and click **admin** (or go to `#/admin`). Fill skill id, title,
SAM prompts, and warning phrases, attach the ONE skill video (film a 15s slow
circle first — the orbit slice and audio derive from it), Upload, then Run
pipeline (live APIs with `MODEL_API_KEY`, or sample data). The new skill
appears in the viewer picker with no code changes. Export the Luma GLB
manually to `public/models/<id>/model.glb`. Cut real clips with
`tools/cut_clips.sh`.

## Add a new skill by hand (no code changes)

1. `tools/capture_s23.sh <skill_id>` — record `skill.mp4` + `orbit.mp4` + `audio.m4a` into `skills/<skill_id>/`.
2. Add prompts, warning phrases, and model bounds for `<skill_id>` in `python/config.py`.
3. Export the Luma capture to `public/models/<skill_id>/model.glb`.
4. Cut clips: `tools/cut_clips.sh <skill_id> <seconds> <clip_name>.mp4` per step.
5. Run the pipeline stages above with `--skill <skill_id>`.
6. The viewer lists the new project automatically via `public/models/index.json`.

## Current placeholders (replace with real S23 capture)

- `model.glb` is a generated box; `clips/*.mp4` are ffmpeg test patterns.
- Robot trajectories are joint-space stubs (`sim_stub: true`); the demo uses a
  pre-recorded MuJoCo/viewer clip, never live ROS2 on macOS.
- The WebXR page is static; test in Chrome + WebXR emulator, not Safari.

## Deploy

```bash
npm run build
vercel --prod
```
