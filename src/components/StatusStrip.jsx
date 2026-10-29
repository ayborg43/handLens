// Honest labels for every output: captured / live vs sample / placeholder / stub.
const TONES = { ok: 'chip-ok', warn: 'chip-warn', neutral: 'chip-neutral' };

function describe(key, value) {
  const table = {
    model: {
      captured: ['Captured', 'ok'],
      placeholder: ['Placeholder', 'warn'],
      missing: ['Missing', 'warn']
    },
    clips: {
      captured: ['Captured', 'ok'],
      placeholder: ['Placeholder', 'warn'],
      missing: ['Missing', 'warn']
    },
    masks: { live: ['Live', 'ok'], sample: ['Sample data', 'warn'], none: ['Not run yet', 'warn'], unknown: ['Unverified', 'neutral'] },
    transcript: { live: ['Live', 'ok'], sample: ['Sample data', 'warn'], none: ['Not run yet', 'warn'], unknown: ['Unverified', 'neutral'] },
    reasoning: { live: ['Live', 'ok'], offline: ['Offline builder', 'warn'], manual: ['Written from the footage', 'warn'], unknown: ['Unverified', 'neutral'] },
    robot: { stub: ['Stub', 'neutral'] },
    vr: { stub: ['Stub', 'neutral'] }
  };
  return (table[key] && table[key][value]) || [String(value), 'neutral'];
}

const ITEMS = [
  ['model', '3D model'],
  ['clips', 'Clips'],
  ['masks', 'SAM 3.1 masks'],
  ['transcript', 'Muse Voice'],
  ['reasoning', 'Reasoning'],
  ['robot', 'Robot'],
  ['vr', 'VR']
];

export function StatusStrip({ status }) {
  if (!status) return null;
  return (
    <section className="status" aria-label="What is real and what is a stand-in">
      <ul className="status-list">
        {ITEMS.map(([key, label]) => {
          const [text, tone] = describe(key, status[key]);
          return (
            <li key={key} className={`chip ${TONES[tone]}`}>
              <span className="chip-label">{label}</span>
              <span className="chip-value">{text}</span>
            </li>
          );
        })}
      </ul>
      <details className="status-legend">
        <summary>What do these mean?</summary>
        <p>
          <strong>Captured / Live</strong> came from the real recording or a live Meta API call.{' '}
          <strong>Sample data / Placeholder</strong> is a stand-in until real footage is processed.{' '}
          <strong>Stub</strong> is an honest illustration: robot joint angles are placeholders and
          VR is a static preview.
        </p>
      </details>
    </section>
  );
}
