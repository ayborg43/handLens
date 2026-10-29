import { IconCheck } from './Icons.jsx';

// Plain step navigation. variant "list" is the main vertical list; "pills" is a
// compact row used on the secondary tabs.
export function StepNav({ steps, activeStep, onSelect, done = [], variant = 'list' }) {
  return (
    <nav className={`stepnav stepnav-${variant}`} aria-label="Steps">
      <ol>
        {steps.map((step, i) => {
          const isDone = done.includes(step.step_id);
          const active = i === activeStep;
          return (
            <li key={step.step_id}>
              <button
                type="button"
                className={`stepnav-btn${active ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
                aria-current={active ? 'step' : undefined}
                onClick={() => onSelect(i)}
              >
                <span className="stepnav-num" aria-hidden="true">
                  {isDone ? <IconCheck /> : step.step_id}
                </span>
                <span className="stepnav-title">
                  <span className="sr-only">Step {step.step_id}: </span>
                  {step.action}
                  {isDone && <span className="sr-only"> (done)</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
