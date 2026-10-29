// Maps a 2D SAM bbox [x, y, w, h] from frame pixels to meters in model space.
// Heuristic: cx -> x, cy -> z, y fixed at table height. Refined by depth_est.py
// when a depth map is available. modelBounds MUST come from the skill's subject
// size, never from a hardcoded subject.
export function bboxTo3D(
  bbox,
  imageWidth = 1920,
  imageHeight = 1080,
  modelBounds = { min: [-0.25, 0, -0.25], max: [0.25, 0.5, 0.25] }
) {
  const cx = (bbox[0] + bbox[2] / 2) / imageWidth;
  const cy = (bbox[1] + bbox[3] / 2) / imageHeight;
  const x = modelBounds.min[0] + cx * (modelBounds.max[0] - modelBounds.min[0]);
  const z = modelBounds.min[2] + cy * (modelBounds.max[2] - modelBounds.min[2]);
  const y = modelBounds.min[1] + 0.6 * (modelBounds.max[1] - modelBounds.min[1]);
  return [x, y, z];
}
