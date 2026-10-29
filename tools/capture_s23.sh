#!/bin/bash
# Capture helper: one video per skill. Film a 15s slow circle at the START
# (the orbit slice), then the repair. Audio comes from the same recording.
# Usage: tools/capture_s23.sh gen_ladipo_001
set -e
SKILL="${1:-gen_ladipo_001}"
DIR="skills/$SKILL"
mkdir -p "$DIR"
echo "Record ONE video on S23 and copy here as:"
echo "  $DIR/skill.mp4   (1080p60: first 15s slow circle, then the repair)"
echo "The pipeline derives orbit.mp4 (first 15s), audio.m4a, and frames/ from it."
echo "Skill dir ready: $DIR"
