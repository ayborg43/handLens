import { IconCheck } from './Icons.jsx';

// Step rail shown over the 3D stage: numbered pills, active one shows its title.
export function StepList({ steps, activeStep, onSelect, done = [] }) {
  return (
    <nav className="rail" aria-label="Skill steps">
      <ol className="rail-list">
        {steps.map((step, i) => {
          const isDone = done.includes(step.step_id);
          const cls = [i === activeStep ? 'is-active' : '', isDone ? 'is-done' : ''].filter(Boolean).join(' ');
          return (
            <li key={step.step_id} className={cls || undefined}>
              <button
                type="button"
                className="rail-btn"
                aria-current={i === activeStep ? 'step' : undefined}
                aria-label={`Step ${step.step_id}: ${step.action}${isDone ? ' (done)' : ''}`}
                onClick={() => onSelect(i)}
              >
                <span className="rail-num" aria-hidden="true">
                  {isDone ? <IconCheck /> : step.step_id}
                </span>
                <span className="rail-title" aria-hidden="true">{step.action}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
