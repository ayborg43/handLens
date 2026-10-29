import { useEffect, useState } from 'react';
import { qrSvg } from '../utils/qr.js';
import { IconExternal } from './Icons.jsx';

// Checks the VR page really exists (the dev server answers 200 for any path).
export function useVrAvailable(url) {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    let live = true;
    setOk(null);
    fetch(url)
      .then((r) => (r.ok ? r.text() : ''))
      .then((t) => { if (live) setOk(t.includes('VRButton')); })
      .catch(() => { if (live) setOk(false); });
    return () => { live = false; };
  }, [url]);
  return ok;
}

export function VrPanel({ base, compact, shareOnly }) {
  const path = `${base}/webxr/index.html`;
  const absolute = new URL(path, window.location.href).href;
  const available = useVrAvailable(path);
  const [qr, setQr] = useState('');
  const isLocal = /^(localhost|127\.|\[::1\])/.test(window.location.hostname);

  useEffect(() => {
    if (compact) return undefined;
    let live = true;
    qrSvg(absolute).then((svg) => { if (live) setQr(svg); }).catch(() => {});
    return () => { live = false; };
  }, [absolute, compact]);

  if (available === false) {
    return <p className="help">No VR page has been generated for this skill yet.</p>;
  }

  return (
    <div className="vr">
      {!shareOnly && (
        <div className="vr-frame">
          {available === null && <div className="skeleton" aria-hidden="true" />}
          {available && (
            <iframe
              title="VR overlay preview"
              src={path}
              loading="lazy"
              allow="xr-spatial-tracking; fullscreen"
            />
          )}
        </div>
      )}
      {!compact && (
        <div className="vr-share">
          {qr && (
            <div className="qr" role="img" aria-label="QR code for the VR page" dangerouslySetInnerHTML={{ __html: qr }} />
          )}
          <div>
            <p className="media-caption">
              Scan to open the VR overlay on a phone or Cardboard viewer. Use Chrome; Safari has no immersive WebXR.
            </p>
            {isLocal && (
              <p className="media-caption">This link points at your computer. Deploy first so it opens on a phone.</p>
            )}
            <a className="btn" href={path} target="_blank" rel="noreferrer">
              <IconExternal /> Open in a new tab
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
