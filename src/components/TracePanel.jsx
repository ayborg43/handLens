import { parseRange, langName } from '../utils/skillLoader.js';

const MODEL_ROWS = [
  ['transcript', 'Muse Voice Transcribe', 'workshop audio → transcript'],
  ['masks', 'SAM 3.1', 'frames → object masks'],
  ['reasoning', 'Muse Spark 1.3', 'transcript + masks → skill.json']
];

const MODE_TEXT = {
  live: 'Live API',
  sample: 'Sample data',
  offline: 'Offline builder',
  manual: 'Written from the footage',
  none: 'Not run yet',
  unknown: 'Unverified'
};

// only speech that actually falls inside (or within a second of) the step
function pickSegment(transcript, start, end) {
  const inside = transcript.filter((seg) => seg.end >= start - 1 && seg.start <= end + 1);
  return inside.length ? inside[0] : null;
}

// prefer the frame inside the step where the target was detected most confidently
function pickFrame(masks, mid, start, end, targetId) {
  if (!masks.length) return null;
  let best = null;
  let bestScore = -1;
  masks.forEach((fr) => {
    if (fr.timestamp < start - 0.5 || fr.timestamp > end + 0.5) return;
    fr.objects.forEach((o) => {
      if (o.id === targetId && o.score > bestScore) { best = fr; bestScore = o.score; }
    });
  });
  if (best) return best;
  return masks.reduce((b, fr) => (Math.abs(fr.timestamp - mid) < Math.abs(b.timestamp - mid) ? fr : b));
}

const hue = (label) => {
  let h = 0;
  for (const c of label) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

function Detections({ frame, targetId }) {
  const W = 1920;
  const H = 1080;
  return (
    <svg
      className="det"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${frame.objects.length} objects detected near ${frame.timestamp} seconds`}
    >
      <rect width={W} height={H} fill="#eef3f1" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={`v${i}`} x1={(i + 1) * 160} y1="0" x2={(i + 1) * 160} y2={H} stroke="#dbe4e0" strokeWidth="2" />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <line key={`h${i}`} x1="0" y1={(i + 1) * 180} x2={W} y2={(i + 1) * 180} stroke="#dbe4e0" strokeWidth="2" />
      ))}
      {frame.objects.map((o) => {
        const [x, y, w, h] = o.bbox;
        const target = o.id === targetId;
        const color = target ? '#08774a' : `hsl(${hue(o.label)} 45% 38%)`;
        return (
          <g key={o.id}>
            <rect
              x={x} y={y} width={w} height={h}
              fill={target ? 'rgba(47,227,139,0.28)' : 'rgba(255,255,255,0.35)'}
              stroke={color}
              strokeWidth={target ? 8 : 5}
              rx="6"
            />
            <text x={x + 10} y={Math.max(y - 12, 44)} fontSize="42" fontWeight="600" fill={color}>
              {o.label} {Math.round(o.score * 100)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function TracePanel({ step, evidence }) {
  const { transcript, masks, status } = evidence;
  const [start, end] = parseRange(step.timestamp);
  const seg = pickSegment(transcript, start, end);
  const targetNum = Number(String(step.target_object_id || '').replace(/\D/g, ''));
  const frame = pickFrame(masks, (start + end) / 2, start, end, targetNum);
  const target = frame && frame.objects.find((o) => o.id === targetNum);
  const snippet = JSON.stringify(
    {
      step_id: step.step_id,
      timestamp: step.timestamp,
      action: step.action,
      target_object_id: step.target_object_id,
      spatial_3d: step.spatial_3d,
      robot: step.robot,
      vr: step.vr
    },
    null,
    2
  );

  return (
    <div className="trace">
      <ul className="trace-models">
        {MODEL_ROWS.map(([key, name, what]) => (
          <li key={key}>
            <span className="trace-model-name">{name}</span>
            <span className="trace-model-what">{what}</span>
            <span className="trace-model-mode">{MODE_TEXT[(status && status[key]) || 'unknown']}</span>
          </li>
        ))}
      </ul>

      <h3 className="trace-h">What was said</h3>
      {seg ? (
        <figure className="trace-quote">
          <blockquote>{seg.text}</blockquote>
          <figcaption>
            {seg.start.toFixed(1)}s – {seg.end.toFixed(1)}s · {langName(seg.lang)}
            {seg.is_warning && <span className="badge badge-warn">Warning line</span>}
          </figcaption>
        </figure>
      ) : (
        <p className="help">
          {transcript.length
            ? 'Nothing recognisable was said during this step.'
            : 'No transcript yet. Muse Voice has not been run on this skill’s audio.'}
        </p>
      )}

      <h3 className="trace-h">What was seen</h3>
      {frame ? (
        <>
          <Detections frame={frame} targetId={targetNum} />
          <p className="media-caption">
            {frame.objects.length} objects at {frame.timestamp.toFixed(1)}s
            {target ? <> · linked target: <strong>{target.label}</strong> ({step.target_object_id})</> : null}
          </p>
        </>
      ) : (
        <p className="help">No detections yet. SAM 3.1 has not been run on this skill’s frames.</p>
      )}

      <details className="trace-json">
        <summary>This step in skill.json</summary>
        <pre>{snippet}</pre>
      </details>
    </div>
  );
}
