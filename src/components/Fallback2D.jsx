import { spreadPositions } from './Hotspot.jsx';

// Shown when WebGL isn't available: a top-down map of where each step happens.
export function Fallback2D({ steps, activeStep, onSelect }) {
  const pts = spreadPositions(steps);
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[2]);
  const pad = 0.1;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minZ = Math.min(...zs) - pad;
  const maxZ = Math.max(...zs) + pad;
  const w = Math.max(maxX - minX, 0.2);
  const h = Math.max(maxZ - minZ, 0.2);
  const k = 600 / Math.max(w, h);
  return (
    <div className="fallback2d">
      <p className="viewer-note" role="status">
        3D isn’t available in this browser. Here is a top-down map of the steps.
      </p>
      <svg viewBox={`0 0 ${w * k} ${h * k}`} role="group" aria-label="Top-down map of steps">
        <rect width={w * k} height={h * k} rx="14" fill="#eef3f1" stroke="#c3cdc9" />
        {steps.map((s, i) => {
          const cx = (pts[i][0] - minX) * k;
          const cy = (pts[i][2] - minZ) * k;
          const active = i === activeStep;
          return (
            <g
              key={s.step_id}
              tabIndex={0}
              role="button"
              aria-label={`Step ${s.step_id}: ${s.action}`}
              aria-current={active ? 'step' : undefined}
              onClick={() => onSelect(i)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i); } }}
              className="map-pin"
            >
              <circle cx={cx} cy={cy} r={active ? 26 : 20} fill={active ? '#2fe38b' : '#fff'} stroke="#08774a" strokeWidth="3" />
              <text x={cx} y={cy + 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#04140c">{s.step_id}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
