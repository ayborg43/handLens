# handLens — Product Requirements Document

**Version:** 1.1 generalized (replaces all prior PRD PDFs)
**Status:** Build-ready
**Date:** 2026-10-27
**Hardware:** Samsung S23 + Mac M4 16GB, no robot arm, no Quest required
**Event:** Meta Global AI Developer Hackathon 2026, virtual Oct 26–Nov 4, submit Nov 4 9pm ET
**Tracks:** Indie. Dual theme: Build for Your World + Push the Frontier
**Deliverable:** Vercel URL with human 3D manual for any captured skill + `workshop.urdf` + `trajectories/` + `webxr/index.html`
**Scope rule:** the platform copies any hands-on skill. Ladipo generator repair is the launch content only, not the limit.

Prior PDFs (`ApprenticeLens Full PRD Robot VR`, `PRD v3 MuseCode Ready`) are superseded by this file and must be deleted. The product is renamed from ApprenticeLens to handLens. This is the single source of truth.

---

## 1. Background and problem

Skilled work is taught by watching: generator repair, tailoring, cooking, hairdressing, plumbing, phone repair. Knowledge leaves when masters leave. Phone video exists but learners cannot search it, rotate it, or practice hands-free.

handLens captures any hands-on skill once on S23 and compiles it to three usable forms from one canonical file. Ladipo generator repair is the launch skill that proves the pipeline, not the product boundary:

1. Human 3D manual on phone/laptop (Three.js).
2. Robot-executable stub (URDF + ROS2-style trajectories + MuJoCo clip).
3. VR overlay stub (WebXR page with anchors + ghost cues + voice prompts).

No extra hardware is needed for the demo. Robot and VR are visible-but-stubbed. Only the human viewer must work live.

---

## 2. Goals and non-goals

### Goals

- G1: From S23 `skill.mp4` + `orbit.mp4` + `audio.m4a` for any hands-on skill, produce valid `skill.json v2` with exactly 5 steps for the hackathon demo (schema supports 5-10 steps generally).
- G2: Human viewer works live on Vercel with no login, on phone and laptop, for any skill project in the same schema.
- G3: Full Meta-tooling coverage: SAM 3.1 for masks, Muse Voice Transcribe for workshop audio in its 25 supported languages (Nigerian Pidgin and Yoruba are not among them; see 9.2), Muse Spark 1.3 for reasoning (Muse Spark Open as the open-weight option), Muse Code as builder.
- G4: Robot and VR outputs exist as inspectable artifacts plus short clips, honestly labeled as stubs, for any skill project.
- G5: 3-minute demo video (the hackathon requires three minutes) with triple split-screen ending. Launch video shows generator repair; platform accepts any skill.

### Non-goals (do not build)

- No real inverse kinematics. No live ROS2/RViz on macOS.
- No immersive Safari WebXR. Chrome + emulator only.
- No 10-step demo cut (schema allows it, demo shows 5), no auth, no Muse Image dependency.
- No live phone capture during judging. Pre-capture everything.
- No skill-specific hardcoding: no generator-only labels, tools, torques, or prompts in code. All skill content comes from `skill.json`.

---

## 3. Users and stories

- U1 Learner: opens Vercel URL on S23, selects a skill project, rotates the 3D model, taps a step hotspot, watches the 8s clip, reads the instruction and warning in their language.
- U2 Skilled owner: captures a new skill with `skill.mp4` + `orbit.mp4` + `audio.m4a`, gets a new `skill.json` project folder without code changes.
- U3 Judge: opens the launch project (generator repair) on laptop, clicks 2 hotspots, sees SAM masks and transcript link to `skill.json`, then watches robot clip and WebXR page.
- U4 Factory engineer (future): downloads `workshop.urdf` + `trajectories/*.yaml` + `scene.xml` for any skill project to replay in their own sim.

---

## 4. Success criteria

- S1: `npm run dev` loads the active skill project `public/models/<skill_id>/model.glb` with 5 clickable hotspots, zero console errors. Switching `skill_id` switches skill with no code change.
- S2: `skill.json` validates for any skill: 5 steps in demo (schema allows 5-10), every step has timestamp from transcript, linked `target_object_id`, `spatial_3d.position_m` (3 floats, meters), `robot.action_type` + pose, `vr.overlay_type` + `voice_prompt`, `human.video_clip` file exists. `torque_nm` + `direction` required only when `action_type` is `torque`.
- S3: `masks.json` valid: 5-frame smoke has 20+ objects, full 2fps run has 100+ objects. Each object has `label`, `bbox`, `score`. Labels come from the skill's prompt list, not a hardcoded generator list.
- S4: `workshop.urdf` parses as XML and opens in a URDF viewer. Articulated parts (bolts, hinges, lids) are revolute joints; rigid parts are fixed.
- S5: `trajectories/` has 5 YAMLs with `joint_names[6]` + points + `metadata.action_type`.
- S6: `webxr/index.html` contains importmap `three@0.160.0` + `VRButton`, renders 5 anchors without JS error.
- S7: Vercel URL + public GitHub repo + 3-min demo video submitted before the deadline (Nov 4, 9:00 PM ET).

---

## 5. Scope: P0 / P1 / P2

- P0 Human path (must work live): ffmpeg frames, Luma GLB, SAM masks, transcript, reasoning, viewer, Vercel.
- P1 Robot stub (pre-recorded): `urdf_gen.py` + `traj_gen.py` produce valid files, one 15-20s MuJoCo/viewer screen recording embedded as `<video>`. No live sim in demo.
- P2 VR stub (static page): `webxr_gen.py` produces `webxr/index.html` + `anchors.json` + `manifest.json`. Tested in Chrome with WebXR emulator extension. Cardboard stereo split as fallback.

If blocked, ship in order P0, then P1 files, then P2 page. Each is independently demoable.

---

## 6. System architecture and data flow

```
S23 capture                M4 pipeline (16GB)                     Outputs
skill.mp4 (5-15min) ───┐
orbit.mp4 (15s circle) ─┼─> ffmpeg fps=2 -> frames/*.jpg
audio.m4a (Interview) ─┘         │
                                 ├─> Luma 3D Capture app/web (manual) -> public/model.glb
                                 ├─> sam_api.py -> masks.json
                                 ├─> transcribe.py -> transcript.json
                                 └─> reason.py -> skill.json v2 (5 steps)
                                          │
                     ┌────────────────────┼────────────────────┐
                     │                    │                    │
              Viewer3D + Hotspot   urdf_gen + traj_gen    webxr_gen.py
              (P0 live)            (P1 files + clip)      (P2 static page)
                     │                    │                    │
              Vercel URL          workshop.urdf +         webxr/index.html
                                  trajectories/*.yaml +   anchors.json
                                  scene.xml               manifest.json
```

Flow rules:

1. `ffmpeg` extracts frames at 2fps. Keep only 5 keyframes in git per skill project. Full `frames/` is gitignored.
2. Luma is a manual pre-step. Film orbit slowly around the skill subject, upload in Luma app, export GLB, save as `public/models/<skill_id>/model.glb`. Launch example: `public/models/gen_ladipo_001/model.glb`. No live Luma API call in demo path.
3. SAM runs on frames with text prompts. Precompute and check in `masks.json`.
4. Transcription runs once, checked in as `transcript.json`.
5. Reasoning runs once, checked in as `skill.json`. Viewer and generators read only the checked-in file at demo time.
6. API keys never ship to client. Browser reads only static JSON + GLB + clips.

---

## 7. Canonical data: skill.json v2

One file drives all three outputs for any skill. Every step MUST have all four blocks. The JSON below shows the launch skill (generator repair); field names stay identical for every other skill.

```json
{
  "project_id": "gen_ladipo_001",
  "skill_title": "Generator alternator bolt service",
  "capture_device": "SM-S911B",
  "language_pack": ["pcm", "pcm-en"],
  "world_scale": "meters, table at y=0, subject ~0.5m wide",
  "steps": [
    {
      "step_id": 2,
      "timestamp": "00:42-00:55",
      "action": "loosen alternator bolt",
      "tool": "14mm spanner",
      "tool_object_id": "tool_02",
      "target_object_id": "bolt_03",
      "human": {
        "instruction": "Loosen bolt counter-clockwise",
        "warning": "disconnect battery",
        "transcript_pidgin": "No use 13, e go spoil am",
        "video_clip": "clips/clip_0042.mp4"
      },
      "spatial_3d": {
        "anchor_id": "bolt_03",
        "position_m": [0.12, 0.45, -0.22],
        "model_ref": "model.glb#bolt_03"
      },
      "robot": {
        "action_type": "torque",
        "tool_tcp": "spanner_14mm",
        "target_pose": {"x": 0.12, "y": 0.45, "z": -0.22, "qx": 0, "qy": 0, "qz": 0, "qw": 1},
        "torque_nm": 8.5,
        "direction": "ccw",
        "duration_sec": 13,
        "urdf_trajectory": "traj_step02.yaml",
        "ros2_action": "FollowJointTrajectory"
      },
      "vr": {
        "xr_anchor": "bolt_03",
        "overlay_type": "arrow+highlight",
        "highlight_color": "#00FF00",
        "voice_prompt": "Loosen this bolt",
        "hand_ghost": "ghost_hand_step02.glb"
      }
    }
  ]
}
```

Field rules (skill-agnostic):

- `project_id` is any slug, for example `gen_ladipo_001`, `ankar_tailor_001`, `jollof_cook_001`. Viewer lists projects by `skill_title`.
- `timestamp` comes from transcript. No invented times.
- `target_object_id` must match a SAM `object_id` with highest overlap near that timestamp.
- `tool` and `target_object_id` are free text per skill: `14mm spanner`, `sewing machine`, `pestle`, `clippers`. Never validate against a generator-only list.
- `position_m` is meters in Luma model space after one manual calibration per skill project. Document calibration offset in `skill.json` notes if adjusted.
- Robot: `action_type` is an open enum: `torque`, `pick`, `place`, `cut`, `pour`, `stitch`, `press`, `twist`, `spray`, plus future verbs. `torque_nm` + `direction` are required only for `torque` (example: 8 Nm for M8, 12 Nm for M10, `ccw` for loosen). Other actions carry their own params in `target_pose` + `duration_sec` and ignore torque fields.
- `human.transcript_pidgin` is the launch locale field name kept for backward compatibility; it holds the verbatim workshop utterance in any language. New projects may also add `transcript_local` but must keep this key populated.
- VR: `overlay_type` is `arrow+highlight`. `voice_prompt` is a short instruction in the skill's spoken language.
- Demo shows exactly 5 steps. Schema supports 5-10. Each `human.video_clip` must exist as a 5-10s file under `clips/<skill_id>/`.

Sample supporting files:

```json
// masks.json entry
{"frame_idx": 21, "timestamp": 42.1, "objects": [
  {"id": 3, "label": "bolt", "bbox": [412, 298, 45, 48], "score": 0.94},
  {"id": 4, "label": "14mm spanner", "bbox": [380, 260, 120, 60], "score": 0.91}
]}
```

```json
// transcript.json entries
[
  {"start": 42.1, "end": 44.5, "text": "No use 13, e go spoil am", "lang": "pcm", "is_warning": true},
  {"start": 45.0, "end": 55.0, "text": "Loosen alternator bolt with 14 spanner", "lang": "pcm-en", "is_warning": false}
]
```

---

## 8. Hardware and software requirements

- S23: stock camera, 1080p60 for any skill demo (launch: generator repair), slow 15s orbit circle around the subject, Interview/Mic mode for audio.
- M4 16GB: `brew install ffmpeg node ollama docker`, `pip3 install torch trimesh pyyaml mujoco`, `npm create vite@latest`.
- Cloud: Meta Model API with `$150` credits, Luma account for one manual capture.
- Browser for demo: Chrome with WebXR emulator extension. Do not promise Safari immersive WebXR or native ROS2 on macOS.

---

## 9. API contracts (corrected, do not use old PRD strings)

Base: `https://api.meta.ai/v1`. Auth: `Authorization: Bearer $MODEL_API_KEY`. Keys start with `LLM_`. Quotas are per team. Over-limit returns HTTP 429 with `Retry-After`; back off with jitter.

### 9.1 Text and reasoning

- `POST /v1/responses` (recommended full-feature surface, carries reasoning + web-search grounding).
- `POST /v1/chat/completions` (OpenAI-compatible).
- `POST /v1/messages` (Anthropic-compatible).
- Models: `muse-spark-1.3`, `muse-spark-1.2`, `muse-spark-1.1`, `muse-wonder-1.0`. Open-weight option: Muse Spark Open, served through a partner (for example Baseten, model `meta-models/muse-spark-open-1026`; the hackathon guide says to use this ID, not the one in Baseten's docs). Muse Spark Open and Muse Glimmer have no Meta Model API ID; they run on partner or own hardware. Using one also makes the project eligible for the Best Build on Meta Open Weight Models bonus.
- Pricing (official): Spark std `$1.25` in / `$4.25` out per 1M tokens. Limits: std 3000 RPM / 4M TPM.

Reasoning request must use `response_format: {"type": "json_object"}`, `temperature: 0.2`, and the system prompt in `python/reason.py` that forces valid `skill.json v2` with 5 steps max.

### 9.2 Speech to text (verified against dev.meta.ai/docs on 2026-10-28)

Do NOT use `/v1/audio/transcriptions`. It is not supported.

- Batch: `POST https://api.meta.ai/v1/asr/transcribe?sessionId=<id>`, multipart with a `request` JSON part and an `audio` part. Request JSON: `{"model":"muse-voice-transcribe-1.0","audioEncoding":"WAV","mode":"ENDPOINTING"}`. `mode` is `PUSH_TO_TALK`, `ENDPOINTING` (turn-by-turn, no speakers) or `DIARIZATION`. Optional `languageBias` is an array of language names.
- Audio must be a mono 16-bit PCM WAV at 16 or 24 kHz, at most 10 minutes and 32 MB. Convert with `ffmpeg -i in.m4a -ac 1 -ar 24000 -c:a pcm_s16le -map_metadata -1 out.wav` (`python/transcribe.py` does this).
- Response: `{sessionId, transcript, audioDurationMs, turns:[{turnId, startMs, endMs, transcript, speaker?}]}`, times in milliseconds. There is no per-turn language or warning flag; warnings are tagged locally from the skill's phrase list.
- Languages: 25 supported. **Nigerian Pidgin and Yoruba are not on the list**, so the earlier claim of a Pidgin + Yoruba + English locale pack is wrong. Pidgin lines that sound close to English may transcribe; Yoruba will not. Plan for this in the demo (clear narration in English, or show the limitation honestly).
- Quiet audio matters: a 74 s kitchen clip with almost no speech returned a single word.
- Streaming: `wss://api.meta.ai/v1/asr/realtime`. Cost reference: about `$0.18`/hr audio.
- Local fallback: `whisper-cpp --model base audio.m4a` plus `ollama run llama3.2:3b` to tag warnings.

### 9.3 SAM 3.1 segmentation (verified against dev.meta.ai/docs on 2026-10-28)

Do NOT use `https://api.meta.ai/v1/sam3.1/segment`. It is invented.

- Correct: `POST https://api.meta.ai/v1/responses`, `Accept: text/event-stream`, body `{"model":"sam-3.1","stream":true,"metadata":{"include_confidence":"true"},"input":[{"role":"user","content":[{"type":"input_text","text":"<one concept>"},{"type":"input_image","image_url":"data:image/jpeg;base64,..."}]}]}`.
- **One concept prompt per request.** Lists (comma, semicolon, "and") return zero matches, so `python/sam_api.py` sends one request per label per frame.
- Response is streamed text, not JSON fields: records `id<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..;c=..|><|mask;x=0;y=0;c=..;data=H,W,<base85>|>`. Read the `response.output_text.done` event. There is no label field (the label is the prompt you sent) and confidence `c` only appears with `include_confidence`.
- Wording matters: "lid", "hand", "power cord" matched; "jar" and "red blender" did not. Smoke-test prompts on a few frames first.
- Billing: `$2.50`/1000 images, `$0.20`/1000 video frames, 50-frame minimum per video request. Limit 3000 RPM. The pipeline samples every 4th frame (one per 2 s).
- Local fallback: `facebookresearch/sam3` checkpoint `facebook/sam3.1-b` on `mps`, batch 4, float16. Single images only for smoke test.

### 9.4 Luma 3D (manual step, no hardcoded private API)

- In Luma app or web: create capture from `orbit.mp4`, wait for complete, export GLB, save as `public/models/<skill_id>/model.glb`.
- Keep each GLB under 50MB. Keep one committed placeholder subject so viewer never blocks.
- Do not hardcode `webapp.engine.lumalabs.ai/api/v2/captures` in shipped code. If scripting is needed, verify against current Luma docs first and keep the key server-side.

---

## 10. Project structure (create exactly this)

```
handlens/
  package.json
  vite.config.js
  index.html
  vercel.json
  public/
    models/<skill_id>/model.glb (launch: public/models/gen_ladipo_001/model.glb)
    models/<skill_id>/clips/clip_0042.mp4 (5 files per skill, 5-10s each, 640px wide max)
  src/
    App.jsx
    main.jsx
    components/Viewer3D.jsx
    components/Hotspot.jsx
    components/StepList.jsx
    utils/skillLoader.js
    utils/bboxTo3D.js
  python/
    requirements.txt
    config.py (reads env, never commits keys)
    sam_api.py
    transcribe.py
    reason.py
    depth_est.py
    urdf_gen.py
    traj_gen.py
    webxr_gen.py
  tools/
    capture_s23.sh
    cut_clips.sh
  skills/<skill_id>/
    frames/ (gitignored, 5 keyframes only in repo as frames_sample/)
    masks.json
    transcript.json
    skill.json
    workshop.urdf
    scene.xml
    trajectories/traj_step01.yaml ... traj_step05.yaml
    webxr/index.html
    webxr/anchors.json
    webxr/manifest.json
```

`frames/`, `*.mp4` sources, and full `masks.json` over 5MB stay out of git except samples. Commit per launch skill `masks_sample.json`, 5 keyframe JPGs, and final `skill.json`. New skills repeat the same folder shape with no code change.

---

## 11. Module specs

### 11.1 Capture helpers

`tools/capture_s23.sh`:

- Records `skill.mp4` 1080p60 5-15min, `orbit.mp4` 15s slow circle, `audio.m4a` Interview mode, into `skills/<skill_id>/`.
- Copies to M4 working folder with fixed names. Takes `skill_id` as argument.

`tools/cut_clips.sh`:

- `ffmpeg -ss 42 -t 8 -i skill.mp4 -vf scale=640:-1 -c:v libx264 -crf 23 public/models/<skill_id>/clips/clip_0042.mp4` per step.
- Each clip 5-10s, muted loop-ready, under 5MB.

### 11.2 python/sam_api.py

- Input: `skills/<skill_id>/frames/*.jpg`. Output: `skills/<skill_id>/masks.json`.
- For each frame: base64 image, call `POST /v1/responses` with `model: sam-3.1`, one text prompt per label from that skill's prompt list in `config.py`.
- Save `{frame_idx, timestamp, objects}`. Timestamp is `frame_idx / 2` for 2fps.
- Must write files even in fallback mode. Never crash demo on API 429; back off and keep partial results.
- 5-frame smoke must yield 20+ objects before full 2fps run.

### 11.3 python/transcribe.py

- Input: `skills/<skill_id>/audio.m4a`. Output: `skills/<skill_id>/transcript.json`.
- Calls `POST /v1/asr/transcribe` with `model: muse-voice-transcribe-1.0`, or local `whisper-cpp` fallback. Language is per skill; launch uses auto Pidgin/Yoruba/English.
- Post-process: `is_warning` uses that skill's warning phrase list from `config.py`. Launch list covers Pidgin workshop warnings.
- Keep `start`, `end` from API. Do not re-time by hand.

### 11.4 python/reason.py

- Input: `transcript.json` + `masks.json` sample + 5 keyframe base64. Output: `skills/<skill_id>/skill.json`.
- Calls Muse Spark 1.3 via `/v1/responses` or `/v1/chat/completions` with `response_format json_object`, Muse Spark Open (partner-served) as the open-weight option.
- System prompt rules: output only valid JSON, 5 steps for demo (schema 5-10), each step has timestamp from transcript, linked SAM id, `position_m` in meters, `robot.action_type` with pose, `overlay_type` + `voice_prompt` for VR, `warning` from `is_warning` lines. Torque fields only for `torque` actions.
- Validate before write: every step has all four blocks. Reject and retry once on schema failure.

### 11.5 src/utils/bboxTo3D.js

- Maps 2D SAM `bbox [x,y,w,h]` from 1920x1080 to model meters.
- Heuristic: `cx` to x, `cy` to z, `y` defaults to table height then refined by `depth_est.py` when available.
- Document that this is approximate. One manual calibration offset per skill project is required. Do not claim photogrammetry gives absolute meters without it. `modelBounds` comes from the skill's subject size, not a generator-only constant.

```js
export function bboxTo3D(bbox, imageWidth = 1920, imageHeight = 1080, modelBounds = {min: [-0.25, 0, -0.25], max: [0.25, 0.5, 0.25]}) {
  const cx = (bbox[0] + bbox[2] / 2) / imageWidth;
  const cy = (bbox[1] + bbox[3] / 2) / imageHeight;
  const x = modelBounds.min[0] + cx * (modelBounds.max[0] - modelBounds.min[0]);
  const z = modelBounds.min[2] + cy * (modelBounds.max[2] - modelBounds.min[2]);
  const y = 0.3;
  return [x, y, z];
}
```

### 11.6 src/components/Viewer3D.jsx + Hotspot.jsx + StepList.jsx

- `Viewer3D`: skill picker plus Canvas + `OrbitControls` + `useGLTF(modelPath)` + `Hotspot` spheres at `spatial_3d.position_m` for the active `skill_id`. Includes `VRButton` element only on `webxr/` page, not required for P0 pass.
- `Hotspot`: sphere `args [0.02, 16, 16]`, emissive green `#00FF00` default, `Html` overlay with action, warning, looping muted video.
- `StepList`: side list of steps for the active skill, click focuses hotspot. Must work on mobile width.
- `skillLoader.js`: fetches `/models/<skill_id>/skill.json`, validates steps, returns typed object. No API keys in client. No hardcoded skill ids, tools, or labels.

### 11.7 python/urdf_gen.py (P1 stub, must still parse)

- Input: `public/models/<skill_id>/model.glb` + `skills/<skill_id>/masks.json`. Output: `skills/<skill_id>/workshop.urdf`.
- Must create `base` link first, then one link per unique `object_id`, `visual` mesh referencing local file, plus `collision` + `inertial` placeholders.
- Articulated parts get `revolute` joint parent `base`, axis `0 0 1`. All else `fixed`. Joint choice derives from `action_type`, never from a generator-only bolt list.
- Must pass `ET.parse` and open in a URDF viewer. This file is sim-only; no real dynamics tuning needed.

### 11.8 python/traj_gen.py + depth_est.py (P1 stub)

- Input: `skills/<skill_id>/skill.json` + `workshop.urdf`. Output: `skills/<skill_id>/trajectories/traj_step01.yaml` through `05`.
- Each YAML: `joint_names: [joint1..joint6]`, 3 points with 6-float `positions` plus `time_from_start`, plus `metadata` copied from `step.robot`.
- Positions are joint-space placeholders for sim replay only. Do NOT put xyz meters directly and claim ROS execution. Label as `sim_stub: true` if IK is not solved.
- `depth_est.py` is optional refine: Depth Anything V2 Small on `mps` to adjust `y` from mask center depth. Precompute offline. Skip if time is short; keep heuristic `y`.

### 11.9 python/webxr_gen.py (P2 stub)

- Input: `skills/<skill_id>/skill.json` + `public/models/<skill_id>/model.glb`. Output: `skills/<skill_id>/webxr/index.html` + `anchors.json` + `manifest.json`.
- `index.html` uses `importmap` with `three@0.160.0` exact, `three/addons/` path, `renderer.xr.enabled = true`, `VRButton.createButton(renderer)`.
- Places 5 anchor spheres from `position_m`, text panel with `voice_prompt`. No headset tracking code required.
- Must open via static serve with zero JS errors. Test in Chrome + WebXR emulator.

---

## 12. UX requirements

- Viewer loads in under 5s on 4G with each `model.glb` under 50MB and clips lazy-loaded per skill.
- Orbit, zoom, tap hotspot all work with touch. No login wall. Skill picker switches projects without reload loss.
- Workshop utterance kept verbatim with translation subtitle where needed. Launch shows Pidgin with English subtitle. Warnings shown in high contrast.
- WebXR page shows `Enter VR` button when supported, else shows stereo Cardboard note. Never blank screen on Safari; show 2D fallback with same anchors.
- Accessibility: keyboard list navigation in `StepList`, alt text per step, captions on all clips.

---

## 13. Build and test checklist (run top-down)

1. `npm install && npm run dev` loads launch `public/models/gen_ladipo_001/model.glb`, hotspots clickable, clip plays, no console error.
2. `python3 python/sam_api.py skills/gen_ladipo_001/frames_sample/` produces `masks.json` with labels, bbox, score.
3. `python3 python/transcribe.py` produces `transcript.json` with `is_warning`.
4. `python3 python/reason.py` produces `skill.json` with 5 steps, each with `position_m`, `action_type`, `overlay_type`.
5. `python3 -c "import xml.etree.ElementTree as ET; ET.parse('skills/gen_ladipo_001/workshop.urdf')"` passes and file opens in URDF viewer.
6. `python3 python/traj_gen.py` creates 5 YAMLs with 6 joint names.
7. `python3 python/webxr_gen.py` creates `webxr/index.html` containing `VRButton` and `three@0.160.0`.
8. `npm run build && npx serve dist` serves production build without JS error on phone.

Ship if P0 greens even if stubs are red. Do not block Vercel on P1/P2.

---

## 14. Deployment

- `vercel.json`: `{buildCommand: "npm run build", outputDirectory: "dist"}`.
- `npm i -g vercel; vercel --prod` from `handlens/`.
- Env keys server-side only. Commit only sample JSON and final `skill.json` per skill.
- Repo must contain launch `skills/gen_ladipo_001/` with `skill.json`, `workshop.urdf`, `trajectories/`, `webxr/`, `public/models/gen_ladipo_001/model.glb` or Luma URL note, plus this PRD. New skills follow the same folder shape.
- Tag release `hackathon-submit` before video record so demo matches code.

---

## 15. Demo video script (3 minutes, record on S23 + M4 screen)

- 0:00-0:30 Problem, impact and platform promise. Apprentice plus mechanic in Ladipo, Pidgin line with subtitles, who loses when skills leave with the master, then one-line overlay: any skill can be copied this way. Text overlay: Build for Your World.
- 0:30-1:10 Capture. S23 filming the skill subject, slow orbit circle, Luma upload to spinning `model.glb` on M4.
- 1:10-1:55 AI. SAM masks overlay on M4, Muse Voice transcript timestamps scrolling into a `skill.json` snippet, then the AI trace tab. Name the open `action_type` enum to show it is not generator-only. Say plainly which stages ran live.
- 1:55-2:35 Live human viewer on Vercel URL. Rotate model, click 2 pins, clips play, switch to Workshop words and read-aloud. Briefly show the skill library as proof of any-skill support.
- 2:35-3:00 Triple montage using Compare view. Left viewer, middle MuJoCo clip, right WebXR page. End card: one video to human plus robot plus VR for any skill, URL plus QR, and a one-line list of what was built during the hackathon.
- Audio: original workshop sound plus subtitles. No copyrighted music.

---

## 16. Submission checklist

- Vercel URL live, no auth, skill picker working.
- GitHub public repo with README (any-skill pitch, architecture diagram with live vs precomputed, setup, test results, how to add a new skill folder).
- Launch `skills/gen_ladipo_001/` with `skill.json`, `workshop.urdf`, `trajectories/`, `webxr/index.html`, `model.glb` present.
- 3-min demo video link, YouTube public or unlisted. The video must show what was built during the hackathon.
- This PRD exported as PDF in repo.
- Submission form names only the Meta models the shipped build actually calls (Muse Spark, Voice Transcribe, SAM 3.1, and Muse Spark Open if it is served via a partner) plus the coding tools actually used, and states Ladipo is launch content for an any-skill platform. Do not list a model that was not used.

---

## 17. Risks and mitigations

- R1 Old PRD endpoints are wrong. Mitigation: this doc replaces them. Verify against `dev.meta.ai/docs` before spending credits.
- R2 SAM video tracking needs H100. Mitigation: precompute masks, live re-run on 1-3 images only.
- R3 Scale ambiguity in Luma GLB. Mitigation: one manual calibration offset per skill project, documented.
- R4 M4 RAM pressure with torch plus Docker. Mitigation: never run depth, SAM local, and Docker at once. Precompute depth.
- R5 No S23 footage yet. Mitigation: capture orbit first so viewer unblocks, then full skill video for the launch skill.
- R6 Safari has no immersive WebXR, ROS2 has no macOS binaries. Mitigation: Chrome demo plus honest stub labels. Judges check these claims.

---

## 18. Timeline (Oct 27 to Nov 4 9pm ET)

- Day 1: capture orbit + skill video + audio for launch skill, cut 5 clips, Luma GLB placeholder in `public/models/gen_ladipo_001/`.
- Day 2: SAM smoke on 5 frames, transcript, checked-in samples.
- Day 3: reasoning to 5-step `skill.json`, viewer with hotspots and skill picker working locally.
- Day 4: URDF + trajectories files valid, MuJoCo clip recorded.
- Day 5: WebXR static page in Chrome emulator, Vercel deploy.
- Day 6: video record, README with any-skill instructions, submission dry run.
- Day 7-8: buffer for API quota, GLB size, and judge feedback fixes. Optional second skill folder only if P0 is already green.

Cut list: do 5 steps, 1 launch skill, heuristic depth. Do not do real IK, ROS2 Docker, Quest build, or auth. A second skill is a stretch goal, not a blocker.

---

## 19. Open questions

- O1: Final Official Rules scoring weights and video length limit. Take portal Rules as authoritative.
- O2: Measured SAM and Depth FPS on base M4 16GB. Needs on-device probe.
- O3: Hackathon tenant quota overrides if any. Check selection notice, default to standard team quotas.
- O4: Launch-skill calibration offset. Fill in after first orbit capture. Same method repeats per skill.

---

*End of PRD v1.1. This file supersedes all prior PRD PDFs.*






