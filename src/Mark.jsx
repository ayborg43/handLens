import { useEffect, useRef, useState } from 'react';

// Phone companion for capture: press START the moment recording starts,
// then tap MARK at each step change. Download marks.json and attach it in
// Admin — the pipeline snaps steps to your marks.
export function Mark() {
  const [t0, setT0] = useState(null);
  const [now, setNow] = useState(0);
  const [marks, setMarks] = useState([]);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  const start = () => {
    const t = performance.now();
    setT0(t);
    setNow(0);
    setMarks([]);
    clearInterval(timer.current);
    timer.current = setInterval(() => setNow((performance.now() - t) / 1000), 200);
  };
  const stop = () => { clearInterval(timer.current); setT0(null); };
  const mark = () => {
    if (t0 === null) return;
    setMarks((m) => [...m, Math.round(((performance.now() - t0) / 1000) * 10) / 10]);
  };
  const drop = (i) => setMarks((m) => m.filter((_, j) => j !== i));
  const download = () => {
    const blob = new Blob([JSON.stringify({ marks }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'marks.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;

  return (
    <>
      <header>
        <h1>handLens mark</h1>
        <a href="#/" style={{ color: '#fff' }}>← viewer</a>
      </header>
      <main style={{ display: 'block', maxWidth: 480 }}>
        <div className="detail">
          <h2>{t0 === null ? 'Ready' : fmt(now)}</h2>
          <p>Press <strong>Start</strong> the moment recording starts. Tap <strong>Mark</strong> at each step change. Download <code>marks.json</code> and attach it in Admin next to the video.</p>
          <p>
            {t0 === null
              ? <button type="button" onClick={start}>Start</button>
              : <><button type="button" onClick={mark}>Mark step</button> <button type="button" onClick={stop}>Stop</button></>}
            {' '}
            <button type="button" onClick={download} disabled={marks.length === 0}>Download marks.json</button>
          </p>
        </div>
        {marks.length > 0 && (
          <div className="detail">
            <h2>Marks ({marks.length})</h2>
            <ol>
              {marks.map((s, i) => (
                <li key={i}>{fmt(s)} <button type="button" className="link-btn" onClick={() => drop(i)} aria-label={`Delete mark ${i + 1}`}>delete</button></li>
              ))}
            </ol>
          </div>
        )}
      </main>
    </>
  );
}
