# 3D reconstruction experiment — Video3 (drying rack)

Date: 2026-10-29. Question: can the orbit-style footage in `videos/Video3.mp4`
be combined into 3D? Answer: yes for camera poses + sparse points, blocked at
dense mesh on this machine.

## What ran (all outputs in /tmp/reconv3, only sparse.ply kept here)

1. `ffmpeg -ss 0 -t 70 -i videos/Video3.mp4 -vf fps=2,scale=720:-1` → 140 frames.
2. `colmap feature_extractor` (SIFT, 8192 features, single camera).
3. `colmap sequential_matcher` (overlap 10).
4. `colmap mapper` → model 1.

## Result (honest numbers)

- Images registered: 140/140.
- 3D points: 11,205, mean reprojection error 1.02px.
- Extent ~62 x 36 x 81 units: this is the whole scene (rack + ground + walls +
  houses), in arbitrary COLMAP scale — NOT an isolated rack model.

## Blocker

`colmap patch_match_stereo` aborts: "Dense stereo reconstruction requires CUDA,
which is not available on your system." The Homebrew COLMAP bottle has no CUDA
MVS on Apple Silicon, so no dense cloud and no mesh could be built here.

## What would unblock a real model.glb

- A CUDA machine (or cloud GPU) running dense stereo + fusion + Poisson meshing
  from /tmp/reconv3, then scale/calibrate and clean the rack out of the scene; or
- A Luma orbit capture (still the supported path); or
- A CPU dense pipeline (e.g. OpenMVS) — untested here.

`sparse.ply` (164 KB) is the raw experiment output. It is deliberately NOT wired
into public/models: the viewer must never present it as the skill's 3D model.

## CPU dense attempt (MASt3R, no CUDA) — stopped, with recipe

A CPU-only dense path exists and was started, then stopped on measured cost:

- `pip install torch open3d einops pillow scikit-learn huggingface_hub` (CPU torch
  2.8.0 + open3d 0.18.0 installed fine in a scratch venv; repo stays stdlib-only).
- Weights: `MASt3R_ViTLarge_BaseDecoder_512_catmlpdpt_metric.pth` — the server
  reports 2.6 GB and this connection pulls ~1 MB/s, i.e. ~40 minutes for the
  download alone, before hours of CPU pair inference (ViT-L, ~10-30 s/pair).
- That exceeds a single session, so the download was cancelled. Nothing from
  this attempt is in the repo.

To finish on another machine (or overnight here), run the MASt3R demo global
alignment on /tmp/recon frames, fuse to a cloud, Poisson-mesh with Open3D,
crop/scale to the rack, export GLB (Open3D writes .glb), drop it over
public/models/rack_setup_001/model.glb, re-run sync_public.py, and judge it in
the viewer yourself. Or skip all of this: one Luma orbit capture does the same
job in minutes.

## Update: dense cloud built on-device (Apple M4 MPS, no CUDA)

- MASt3R ViT-L metric checkpoint via `AsymmetricMASt3R.from_pretrained`
  (naver/MASt3R_ViTLarge_BaseDecoder_512_catmlpdpt_metric), device `mps`
  (confirmed `torch.backends.mps.is_available()` on this M4/16GB).
- 35 frames (every 4th of the COLMAP set), swin-3 pairs, sparse global alignment:
  coarse 300 iters (loss 1.52 -> 0.55), fine 200 iters (loss 3.73 -> 0.94).
  Focals converged to a tight 378-389 band. Saved /tmp/mast3r_run/cloud.npz
  (35 views, 91 MB).
- Poisson meshing (Open3D) crashed on thin rails ("Failed to close loop"), so
  the fused cloud (1.14M confident points) was written directly as a GLB POINTS
  cloud instead: /tmp/mast3r_run/points.glb (150k points, 1.7 MB, centered,
  scaled, seated on y=0).
- That file now IS public/models/rack_setup_001/model.glb (placeholder kept at
  /tmp/mast3r_run/placeholder_backup.glb). status.json says model: captured.
  Judge it in the viewer yourself: it is a real reconstruction, but a point
  cloud of the whole scene (rack + yard), not a cleaned rack mesh.

## Update 2: cropped mesh (Poisson depth 8, Open3D, CPU)

- Cropped the fused cloud to 1.2 m around the camera-orbit center (174k/1.14M
  points kept — the yard is gone), voxel 0.008, normals r=0.04, Poisson depth 8:
  86k verts / 172k tris, extent 0.31 x 0.50 x 0.35 m (tall and narrow, like the
  rack). /tmp/mast3r_run/mesh.glb (6.6 MB) is now the live model.glb.
- Untextured grey (vertex colors were dropped as mismatched); thin rails may
  show holes. Still a genuine reconstruction of this rack, not a placeholder.
