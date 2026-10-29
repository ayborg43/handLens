import { VrPanel } from './VrPanel.jsx';
import { ClipPlayer } from './ClipPlayer.jsx';

// One skill, three outputs, side by side: the point of handLens.
export function ComparePanel({ base, step, status, frames }) {
  const tag = (key) => (status && status[key] ? status[key] : null);
  return (
    <section className="compare" aria-label="Human, robot and VR outputs side by side">
      <article className="panel compare-card">
        <header>
          <h2>Human</h2>
          <span className="compare-sub">Clip from the capture</span>
        </header>
        {step && step.human.video_clip ? (
          <ClipPlayer
            key={step.human.video_clip}
            src={`${base}/${step.human.video_clip}`}
            step={step}
            frames={frames}
            showBoxes
            loop
            muted
            ariaLabel={`Clip for step ${step.step_id}: ${step.action}`}
          />
        ) : (
          <p className="help">No clip for this step.</p>
        )}
        <p className="media-caption">{step && step.human.instruction}</p>
      </article>

      <article className="panel compare-card">
        <header>
          <h2>Robot</h2>
          <span className="compare-sub">MuJoCo replay · {tag('robot') || 'stub'}</span>
        </header>
        <video
          src={`${base}/sim_preview.mp4`}
          controls loop muted playsInline preload="metadata"
          aria-label="Robot simulation preview"
        />
        <p className="media-caption">
          Action: <code>{step && step.robot.action_type}</code> · tool path from this step’s position.
        </p>
      </article>

      <article className="panel compare-card">
        <header>
          <h2>VR</h2>
          <span className="compare-sub">WebXR overlay · {tag('vr') || 'stub'}</span>
        </header>
        <VrPanel base={base} compact />
        <p className="media-caption">Voice prompt: “{step && step.vr.voice_prompt}”</p>
      </article>
    </section>
  );
}
