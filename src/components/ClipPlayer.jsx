import { useCallback, useEffect, useRef, useState } from 'react';
import { boxesAt, clipOffset } from '../utils/overlay.js';

// A clip with optional SAM detection boxes drawn over it. `frames` is the
// skill's masks.json (live detections only); times are mapped from the clip back
// to the source video so boxes follow the footage.
export function ClipPlayer({ src, step, frames, showBoxes, loop, muted, autoPlay, onEnded, ariaLabel, children, glossary, skillSteps, onJumpStep, sampleNote }) {
  const videoRef = useRef(null);
  const [rect, setRect] = useState(null);
  const [t, setT] = useState(0);
  const [picked, setPicked] = useState(null);
  const [failed, setFailed] = useState(false);
  const targetId = Number(String(step.target_object_id || '').replace(/\D/g, ''));
  const offset = clipOffset(step);
  const overlay = Boolean(showBoxes && frames && frames.length > 0);

  // where the picture actually sits inside the (letterboxed) video element
  const measure = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const W = v.clientWidth;
    const H = v.clientHeight;
    const aspect = v.videoWidth / v.videoHeight;
    let w = W;
    let h = W / aspect;
    if (h > H) { h = H; w = H * aspect; }
    setRect({ left: (W - w) / 2, top: (H - h) / 2, width: w, height: h });
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(v);
    v.addEventListener('loadedmetadata', measure);
    measure();
    return () => { ro.disconnect(); v.removeEventListener('loadedmetadata', measure); };
  }, [measure, src]);

  useEffect(() => {
    if (!overlay) return undefined;
    const v = videoRef.current;
    if (!v) return undefined;
    let raf = 0;
    let last = -1;
    const tick = () => {
      if (Math.abs(v.currentTime - last) > 0.04) { last = v.currentTime; setT(v.currentTime); }
      if (!v.paused && !v.ended) raf = requestAnimationFrame(tick);
    };
    const start = () => { cancelAnimationFrame(raf); tick(); };
    const sync = () => { last = v.currentTime; setT(v.currentTime); };
    v.addEventListener('play', start);
    v.addEventListener('seeked', sync);
    v.addEventListener('timeupdate', sync);
    v.addEventListener('loadeddata', sync);
    if (!v.paused) start(); else sync();
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener('play', start);
      v.removeEventListener('seeked', sync);
      v.removeEventListener('timeupdate', sync);
      v.removeEventListener('loadeddata', sync);
    };
  }, [overlay, src]);

  // target + hands stand out; everything else draws faint so it stays tappable
  const boxes = overlay ? boxesAt(frames, offset + t, targetId) : [];

  // tap-to-identify: smallest drawn box under the tap wins; empty space dismisses
  const identify = (e) => {
    if (!rect || boxes.length === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left - rect.left) / rect.width;
    const py = (e.clientY - r.top - rect.top) / rect.height;
    if (px < 0 || px > 1 || py < 0 || py > 1) { setPicked(null); return; }
    const hit = boxes
      .filter((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h)
      .sort((a, b2) => (a.w * a.h) - (b2.w * b2.h))[0];
    setPicked(hit ? { box: hit, px, py } : null);
  };

  useEffect(() => { setPicked(null); }, [src, step]);
  useEffect(() => { setFailed(false); }, [src]);

  const entry = picked && glossary ? glossary[picked.box.label] : null;
  const related = entry && skillSteps
    ? skillSteps.filter((s) => (entry.steps || []).includes(s.step_id))
    : [];

  return (
    <div className="clip" onClick={identify}>
      <video
        ref={videoRef}
        src={src}
        controls
        loop={loop}
        muted={muted}
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        onEnded={onEnded}
        onError={() => setFailed(true)}
        aria-label={ariaLabel}
        style={failed ? { display: 'none' } : undefined}
      >
        {children}
      </video>
      {failed && (
        <div className="clip-error" role="alert">
          <strong>This clip couldn’t be loaded.</strong>
          <span>The step instructions on the right still apply. Try another step or reload the page.</span>
        </div>
      )}
      {overlay && rect && (
        <div
          className="clip-overlay"
          aria-hidden="true"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        >
          {boxes.map((b) => (
            <div
              key={`${b.id}-${b.label}`}
              className={`box${b.isTarget ? ' box-target' : ''}${!b.isTarget && b.label !== 'hand' ? ' box-dim' : ''}`}
              style={{
                left: `${b.x * 100}%`, top: `${b.y * 100}%`,
                width: `${b.w * 100}%`, height: `${b.h * 100}%`,
                opacity: b.opacity
              }}
            >
              <span>{b.label} {Math.round(b.score * 100)}%</span>
            </div>
          ))}
        </div>
      )}
      {sampleNote && boxes.length > 0 && rect && (
        <div className="clip-chip" style={{ left: rect.left + 8, top: rect.top + 8 }}>
          Sample detections · names are illustrative
        </div>
      )}
      {picked && rect && (
        <div
          className="identify-card"
          role="dialog"
          aria-label={`Identified: ${picked.box.label}`}
          style={{ left: `${rect.left + picked.px * rect.width}px`, top: `${rect.top + picked.py * rect.height}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" className="identify-close" aria-label="Dismiss" onClick={() => setPicked(null)}>×</button>
          <strong className="identify-name">{picked.box.label}</strong>
          <span className="identify-score">{Math.round(picked.box.score * 100)}% sure · {entry && entry.source === 'live' ? 'AI description' : 'basic description'}</span>
          <p>{entry ? entry.blurb : 'Seen here. No description yet.'}</p>
          {related.length > 0 && (
            <div className="identify-steps">
              {related.map((s) => (
                <button
                  key={s.step_id}
                  type="button"
                  className="link-btn"
                  onClick={() => { setPicked(null); onJumpStep && onJumpStep(s.step_id - 1); }}
                >
                  Go to step {s.step_id}: {s.action.slice(0, 40)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
