# handLens — Soul

Product: handLens copies any hands-on skill from one S23 capture into human, robot, and VR outputs. Ladipo generator repair is the launch skill, not the limit.

## Phase 0 — Capture (Day 1)

- Record `skill.mp4`, `orbit.mp4`, `audio.m4a` into `skills/<skill_id>/`.
- Cut 5 clips (5-10s, 640px, under 5MB) to `public/models/<skill_id>/clips/`.
- Luma export to `public/models/<skill_id>/model.glb` with placeholder fallback.
- Done when viewer has a model and clips to load.

## Phase 1 — AI pipeline (Day 2-3)

- `sam_api.py`: frames to `masks.json` with skill-specific prompts from `config.py`.
- `transcribe.py`: audio to `transcript.json` with per-skill language pack and warning phrases.
- `reason.py`: transcript plus masks to 5-step `skill.json` with human, spatial_3d, robot, and vr blocks.
- Done when `skill.json` validates and every step links a timestamp, object, position, action, and voice prompt.

## Phase 2 — Human viewer, live (Day 3-5)

- `skillLoader.js` plus `bboxTo3D.js` with per-skill calibration.
- `Viewer3D`, `Hotspot`, `StepList`, skill picker.
- `npm run dev` clean, mobile touch works, clips play.
- Vercel deploy from `handlens/`. Done when the URL works on phone with no login.

## Phase 3 — Robot stub (Day 4) — done

- Sim clip recorded headless in MuJoCo (495 frames, 16.5s) and embedded in the app with `sim_stub` caption plus URDF/trajectory downloads.

- `urdf_gen.py` to valid `workshop.urdf` with base link and revolute joints from `action_type`.
- `traj_gen.py` to 5 trajectory YAMLs, sim-stub labeled.
- One 15-20s MuJoCo or viewer screen recording embedded as video.
- Done when URDF parses and the clip plays. No live ROS2.

## Phase 4 — VR stub (Day 5) — done

- Static page verified in headless Chromium at desktop + phone: zero console errors, 60fps, anchors + subject frame + voice prompt + headset/Cardboard hint render. Phone run exit 0; desktop "blank" flag is a dark-scene heuristic false positive overruled by screenshots.

- `webxr_gen.py` to `webxr/index.html`, `anchors.json`, `manifest.json`.
- Importmap `three@0.160.0`, `VRButton`, 5 anchors, voice prompt panel.
- Chrome plus emulator tested, Cardboard fallback noted.
- Done when the page opens with zero JS errors.

## Phase 5 — Ship (Day 6-8)

- 3-minute video (hackathon requirement): problem and impact, capture, AI, live viewer, triple split-screen.
- README with any-skill instructions, release tag, submission form.
- Done when Vercel URL, repo, and video are submitted.
