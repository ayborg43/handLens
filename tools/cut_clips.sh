#!/bin/bash
# Cut 5-10s looping clips per step, keeping the workshop sound (the viewer plays
# them muted unless the Sound toggle is on).
# Usage: tools/cut_clips.sh <skill_id> <start_seconds> <clip_name>.mp4 [duration]
set -e
SKILL="${1:-gen_ladipo_001}"
SS="${2:-42}"
OUT="${3:-clip_0042.mp4}"
DUR="${4:-8}"
mkdir -p "public/models/$SKILL/clips"
ffmpeg -y -loglevel error -ss "$SS" -t "$DUR" -i "skills/$SKILL/skill.mp4" \
  -vf "scale='min(640,iw)':-2" -r 30 -c:v libx264 -crf 24 -pix_fmt yuv420p \
  -c:a aac -b:a 64k -movflags +faststart \
  "public/models/$SKILL/clips/$OUT"
echo "clip -> public/models/$SKILL/clips/$OUT"
