import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Viewer3D } from './components/Viewer3D.jsx';
import { StepList } from './components/StepList.jsx';
import { StepNav } from './components/StepNav.jsx';
import { AppBar } from './components/AppBar.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { StatusStrip } from './components/StatusStrip.jsx';
import { TracePanel } from './components/TracePanel.jsx';
import { VrPanel } from './components/VrPanel.jsx';
import { ComparePanel } from './components/ComparePanel.jsx';
import { ClipPlayer } from './components/ClipPlayer.jsx';
import {
  IconWarning, IconDownload, IconArrowLeft, IconArrowRight, IconCheck,
  IconLink, IconVolume, IconStop
} from './components/Icons.jsx';
import { loadSkillIndex, loadSkill, loadEvidence, parseRange, langName } from './utils/skillLoader.js';
import { loadDone, saveDone, loadPref, savePref } from './utils/progress.js';
import { buildCaptionsUrl } from './utils/captions.js';
import { downloadSkillPack } from './utils/pack.js';
import { ADMIN_AVAILABLE } from './utils/env.js';

const TABS = [
  ['guide', 'Guide'],
  ['model', '3D model'],
  ['outputs', 'Robot & VR'],
  ['how', 'How it was made']
];
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

function Toggle({ pressed, onClick, disabled, title, children }) {
  return (
    <button type="button" className="toggle" aria-pressed={pressed} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

function madeBy(status) {
  if (!status) return '';
  if (status.reasoning === 'live') return 'These steps were written by Muse Spark 1.3 from this video.';
  if (status.reasoning === 'manual') return 'These steps were written from the footage.';
  if (status.reasoning === 'offline') return 'Demo steps built from sample data.';
  return '';
}

export default function App({ initialSkill, initialStep }) {
  const [index, setIndex] = useState({ skills: [] });
  const [skillId, setSkillId] = useState(null);
  const [skill, setSkill] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('guide');
  const [evidence, setEvidence] = useState(null);
  const [done, setDone] = useState([]);
  const [lang, setLang] = useState(() => loadPref('lang', 'en'));
  const [captions, setCaptions] = useState(() => loadPref('captions', true));
  const [sound, setSound] = useState(() => loadPref('sound', true));
  const [autoNext, setAutoNext] = useState(() => loadPref('auto', false));
  const [boxes, setBoxes] = useState(() => loadPref('boxes', true));
  const [playOnChange, setPlayOnChange] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const voiceAudio = useRef(null);
  const stopVoice = () => {
    if (voiceAudio.current) { voiceAudio.current.pause(); voiceAudio.current = null; }
    if (canSpeak) window.speechSynthesis.cancel();
    setSpeaking(false);
  };
  const [notice, setNotice] = useState('');
  const [packing, setPacking] = useState(false);
  const pendingStep = useRef(initialStep);

  useEffect(() => {
    loadSkillIndex()
      .then((idx) => {
        setIndex(idx);
        const wanted = initialSkill && idx.skills.some((s) => s.id === initialSkill)
          ? initialSkill
          : idx.skills[0] && idx.skills[0].id;
        if (wanted) setSkillId(wanted);
        setLoading(false);
      })
      .catch((e) => { setError(String(e.message || e)); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!skillId) return undefined;
    let live = true;
    setEvidence(null);
    setShowPlaceholder(false);
    loadSkill(skillId)
      .then((s) => {
        if (!live) return;
        setSkill(s);
        const want = pendingStep.current;
        pendingStep.current = undefined;
        setActiveStep(want ? Math.min(Math.max(want - 1, 0), s.steps.length - 1) : 0);
        setDone(loadDone(skillId));
        setError(null);
      })
      .catch((e) => { if (live) setError(String(e.message || e)); });
    loadEvidence(skillId).then((ev) => { if (live) setEvidence(ev); });
    return () => { live = false; };
  }, [skillId]);

  const step = skill ? skill.steps[activeStep] : null;
  const total = skill ? skill.steps.length : 0;
  const base = skill ? `/models/${skill.project_id}` : '';
  const status = evidence && evidence.status;
  const isDone = step ? done.includes(step.step_id) : false;
  // detection boxes are only honest when they are real SAM output for this footage
  const liveFrames = status && status.masks === 'live' && evidence.masks.length ? evidence.masks : null;
  const detFrames = (evidence && evidence.masks) || [];

  // keep the address bar shareable: #/<skill>/<step>
  useEffect(() => {
    if (skill && skill.project_id === skillId) {
      window.history.replaceState(null, '', `#/${skillId}/${activeStep + 1}`);
    }
  }, [skill, skillId, activeStep]);

  // captions: only what was actually said
  const capUrl = useMemo(() => (step ? buildCaptionsUrl(step, true) : null), [step]);
  useEffect(() => () => { if (capUrl) URL.revokeObjectURL(capUrl); }, [capUrl]);

  useEffect(() => {
    if (voiceAudio.current) { voiceAudio.current.pause(); voiceAudio.current = null; }
    if (canSpeak) { window.speechSynthesis.cancel(); setSpeaking(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, skillId]);
  useEffect(() => () => {
    if (voiceAudio.current) voiceAudio.current.pause();
    if (canSpeak) window.speechSynthesis.cancel();
  }, []);

  // moving between steps counts as a tap, so the next clip may start playing itself
  const pick = useCallback((n) => {
    setPlayOnChange(true);
    setActiveStep(Math.min(Math.max(n, 0), total - 1));
  }, [total]);

  useEffect(() => {
    if (!skill) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest && e.target.closest('input, select, textarea, video, [role="tablist"]')) return;
      if (e.key === 'ArrowRight') { pick(activeStep + 1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { pick(activeStep - 1); e.preventDefault(); }
      else if (/^[1-9]$/.test(e.key)) { pick(Number(e.key) - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [skill, pick, activeStep]);

  const toggleDone = () => {
    const next = isDone ? done.filter((id) => id !== step.step_id) : [...done, step.step_id];
    setDone(next);
    saveDone(skillId, next);
  };

  const setPref = (name, setter) => (value) => { setter(value); savePref(name, value); };

  const verbatim = step ? step.human.transcript_pidgin || step.human.transcript_local : '';
  const seg = step && evidence
    ? evidence.transcript.find((s) => {
      const [a, b] = parseRange(step.timestamp);
      return s.end >= a - 1 && s.start <= b + 1;
    }) || null
    : null;
  const workshopLang = seg ? langName(seg.lang) : 'workshop words';
  const primary = step ? (lang === 'local' && verbatim ? verbatim : step.human.instruction) : '';
  const hasBoth = step && verbatim && verbatim !== step.human.instruction;

  const speakLive = (text) => {
    if (!canSpeak) { setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang === 'en-NG') || voices.find((v) => v.lang.startsWith('en'));
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  const speak = () => {
    if (!step) return;
    if (speaking) { stopVoice(); return; }
    const text = step.human.warning ? `${primary}. Warning: ${step.human.warning}` : primary;
    setSpeaking(true);
    // Prefer the pre-generated studio voice; fall back to live synthesis.
    const url = `${base}/voice/step${String(step.step_id).padStart(2, '0')}.mp3`;
    const audio = new Audio(url);
    voiceAudio.current = audio;
    audio.oncanplaythrough = () => audio.play().catch(() => speakLive(text));
    audio.onerror = () => speakLive(text);
    audio.onended = () => { voiceAudio.current = null; setSpeaking(false); };
    audio.load();
  };

  const flash = (msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 2400);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      flash('Link to this step copied');
    } catch {
      window.prompt('Copy this link', window.location.href);
    }
  };

  const pack = async () => {
    setPacking(true);
    try {
      const n = await downloadSkillPack(skill);
      flash(`Downloaded (${n} files)`);
    } catch (e) {
      flash(`Couldn’t build the download: ${e.message}`);
    }
    setPacking(false);
  };

  const onTabKey = (e) => {
    const i = TABS.findIndex(([id]) => id === tab);
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = TABS.length - 1;
    if (n === null) return;
    e.preventDefault();
    setTab(TABS[n][0]);
    document.getElementById(`tab-${TABS[n][0]}`)?.focus();
  };

  const onClipEnd = () => {
    if (autoNext && activeStep < total - 1) pick(activeStep + 1);
  };

  const modelReady = status && status.model === 'captured';

  return (
    <>
      <a className="skip-link" href="#content">Skip to content</a>
      <AppBar>
        <select
          className="select"
          value={skillId || ''}
          onChange={(e) => { pendingStep.current = undefined; setPlayOnChange(false); setSkillId(e.target.value); }}
          aria-label="Choose skill"
          disabled={index.skills.length === 0}
        >
          {index.skills.length === 0 && <option value="">No skills</option>}
          {index.skills.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
        {ADMIN_AVAILABLE && <a className="btn btn-ghost" href="#/admin">Admin</a>}
      </AppBar>

      <main id="content" className="app">
        {error && (
          <div className="callout callout-danger" role="alert">
            <IconWarning />
            <p><strong>Couldn’t load this skill.</strong> {error}</p>
          </div>
        )}

        {(loading || (!skill && !error && skillId)) && (
          <div className="skeleton skeleton-guide" aria-busy="true" aria-label="Loading" />
        )}

        {!loading && !error && index.skills.length === 0 && (
          <div className="state">
            <strong>No skills yet</strong>
            {ADMIN_AVAILABLE ? (
              <>
                <p>Upload your first skill video in admin and it will show up here.</p>
                <a className="btn btn-primary" href="#/admin">Open admin</a>
              </>
            ) : (
              <p>No skills have been published to this site yet.</p>
            )}
          </div>
        )}

        {skill && step && (
          <>
            <header className="skill-head">
              <div>
                <h2 className="skill-title">{skill.skill_title || skill.project_id}</h2>
                <p className="skill-sub">{total} steps · {done.length} done</p>
              </div>
              <progress value={done.length} max={total} aria-label="Steps completed" />
            </header>

            <div className="tabs tabs-main" role="tablist" aria-label="Sections" onKeyDown={onTabKey}>
              {TABS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={`tabpanel-${id}`}
                  tabIndex={tab === id ? 0 : -1}
                  className="tab"
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab !== 'guide' && (
              <StepNav steps={skill.steps} activeStep={activeStep} onSelect={pick} done={done} variant="pills" />
            )}

            {tab === 'guide' && (
              <div role="tabpanel" id="tabpanel-guide" aria-labelledby="tab-guide" className="guide">
                <section className="guide-media" aria-label="Video for this step">
                  {status && status.clips === 'placeholder' && (
                    <p className="callout" role="note">
                      <IconWarning />
                      <span>These clips are test patterns, not real footage. They show how the page works.</span>
                    </p>
                  )}
                  {step.human.video_clip ? (
                    <ClipPlayer
                      key={`${step.human.video_clip}-${captions}-${playOnChange}`}
                      src={`${base}/${step.human.video_clip}`}
                      step={step}
                      frames={detFrames}
                      sampleNote={!liveFrames}
                      showBoxes={boxes}
                      loop={!autoNext}
                      muted={!sound}
                      autoPlay={playOnChange}
                      onEnded={onClipEnd}
                      ariaLabel={`Clip for step ${step.step_id}: ${step.action}`}
                      glossary={evidence && evidence.glossary}
                      skillSteps={skill.steps}
                      onJumpStep={pick}
                    >
                      {captions && capUrl && (
                        <track kind="captions" srcLang="en" label="Captions" src={capUrl} default />
                      )}
                    </ClipPlayer>
                  ) : (
                    <p className="help">There is no clip for this step.</p>
                  )}
                  <div className="toggles" role="group" aria-label="Video options">
                    <Toggle
                      pressed={boxes && detFrames.length > 0}
                      disabled={detFrames.length === 0}
                      title={detFrames.length > 0 ? 'Outline the objects found in this video' : 'Only available when this video has detections'}
                      onClick={() => setPref('boxes', setBoxes)(!boxes)}
                    >
                      Show objects
                    </Toggle>
                    <Toggle pressed={sound} onClick={() => setPref('sound', setSound)(!sound)}>Sound</Toggle>
                    {capUrl && (
                      <Toggle pressed={captions} onClick={() => setPref('captions', setCaptions)(!captions)}>Captions</Toggle>
                    )}
                    <Toggle pressed={autoNext} onClick={() => setPref('auto', setAutoNext)(!autoNext)}>
                      Play next step automatically
                    </Toggle>
                  </div>
                  {boxes && liveFrames && (
                    <p className="media-caption">
                      Green outline: what this step is about. White outline: hands. Found by SAM 3.1 every 2 seconds, so the outlines follow the video loosely. Tap any outline to identify it.
                    </p>
                  )}
                  {madeBy(status) && <p className="media-caption">{madeBy(status)}</p>}
                </section>

                <div className="guide-side">
                  <section className="panel guide-card" aria-labelledby="step-heading" aria-live="polite">
                    <div className="guide-card-top">
                      <p className="step-count">Step {activeStep + 1} of {total}</p>
                      {verbatim && (
                        <div className="seg" role="group" aria-label="Language">
                          <button type="button" aria-pressed={lang === 'en'} onClick={() => setPref('lang', setLang)('en')}>English</button>
                          <button type="button" aria-pressed={lang === 'local'} onClick={() => setPref('lang', setLang)('local')}>Workshop words</button>
                        </div>
                      )}
                    </div>
                    <h2 id="step-heading">{step.action}</h2>
                    <p className="step-text" lang={lang === 'local' ? 'pcm' : 'en'}>{primary}</p>
                    {step.human.warning && (
                      <p className="callout" role="note">
                        <IconWarning />
                        <span><strong>Warning.</strong> {step.human.warning}</span>
                      </p>
                    )}
                    {hasBoth && (
                      <p className="transcript">
                        {lang === 'local'
                          ? <>English: {step.human.instruction}</>
                          : <>Said in the workshop ({workshopLang}): “{verbatim}”</>}
                      </p>
                    )}

                    <div className="stepper">
                      <button type="button" className="btn" onClick={() => pick(activeStep - 1)} disabled={activeStep === 0}>
                        <IconArrowLeft /> Previous
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => pick(activeStep + 1)} disabled={activeStep === total - 1}>
                        Next step <IconArrowRight />
                      </button>
                    </div>
                    <div className="tools-row">
                      <button type="button" className="btn btn-ghost" onClick={toggleDone} aria-pressed={isDone}>
                        <IconCheck /> {isDone ? 'Marked done' : 'Mark done'}
                      </button>
                      {canSpeak && (
                        <button type="button" className="btn btn-ghost" onClick={speak}>
                          {speaking ? <IconStop /> : <IconVolume />} {speaking ? 'Stop' : 'Read aloud'}
                        </button>
                      )}
                    </div>
                  </section>

                  <section className="panel guide-steps" aria-label="All steps">
                    <h3 className="panel-title">All steps</h3>
                    <StepNav steps={skill.steps} activeStep={activeStep} onSelect={pick} done={done} />
                  </section>

                  <div className="share-row">
                    <button type="button" className="link-btn" onClick={copyLink}><IconLink /> Copy link to this step</button>
                    <button type="button" className="link-btn" onClick={pack} disabled={packing}>
                      <IconDownload /> {packing ? 'Building…' : 'Download everything (.zip)'}
                    </button>
                    <span className="hint">Tip: use ← → to change step.</span>
                  </div>
                  <p className="notice" role="status" aria-live="polite">{notice}</p>
                </div>
              </div>
            )}

            {tab === 'model' && (
              <div role="tabpanel" id="tabpanel-model" aria-labelledby="tab-model">
                {modelReady || showPlaceholder ? (
                  <section className="stage" aria-label="3D model viewer">
                    <ErrorBoundary>
                      <Viewer3D
                        modelUrl={`${base}/model.glb`}
                        steps={skill.steps}
                        activeStep={activeStep}
                        onSelect={pick}
                        done={done}
                      />
                    </ErrorBoundary>
                    <div className="stage-top">
                      <div className="stage-title">
                        <span className="stage-skill">{skill.skill_title || skill.project_id}</span>
                        <span className="stage-count">Step {activeStep + 1} of {total}</span>
                      </div>
                      <div className="stage-controls">
                        {!modelReady && <span className="badge">Placeholder shape</span>}
                        <span className="badge" title="Part positions come from single-phone depth, so absolute size is estimated until you calibrate against a known-size object.">Scale: estimated</span>
                        <span className="stage-hint">Drag to rotate · scroll to zoom</span>
                      </div>
                    </div>
                    <StepList steps={skill.steps} activeStep={activeStep} onSelect={pick} done={done} />
                  </section>
                ) : (
                  <div className="state panel">
                    <strong>No 3D model yet</strong>
                    <p>
                      The guide works without one. To add it, film one slow circle around the finished
                      object, turn it into a model with Luma, and save the file as{' '}
                      <code>public/models/{skill.project_id}/model.glb</code>.
                    </p>
                    <button type="button" className="btn" onClick={() => setShowPlaceholder(true)}>
                      Preview the viewer with a placeholder shape
                    </button>
                    {evidence && evidence.views && evidence.views.length > 0 && (
                      <section className="views" aria-label="All sides of the subject, from the video">
                        <h3 className="panel-title">All sides, from the video</h3>
                        <p className="media-caption">
                          Stills pulled from the capture at the times shown — not a 3D model,
                          but every face of the object as filmed.
                        </p>
                        <ul className="views-grid">
                          {evidence.views.map((v) => (
                            <li key={v.file} className="views-item">
                              <img src={`${base}/${v.file}`} alt={`${v.label}: ${v.note}`} loading="lazy" />
                              <p><strong>{v.label}</strong> · {v.timestamp}</p>
                              <p className="media-caption">{v.note}</p>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === 'outputs' && (
              <div role="tabpanel" id="tabpanel-outputs" aria-labelledby="tab-outputs" className="outputs-tab">
                <p className="lede">
                  The same recording also produces a robot script and a VR overlay. Both are demonstrations,
                  not finished products.
                </p>
                <ComparePanel base={base} step={step} status={status} frames={liveFrames} />
                <section className="panel outputs-extra">
                  <div>
                    <h3>Robot files</h3>
                    <p className="media-caption">
                      The motion path follows this skill’s steps; joint angles are placeholders and nothing here controls a real robot.
                    </p>
                    <div className="link-row">
                      <a className="btn" href={`${base}/files/workshop.urdf`} download>
                        <IconDownload /> workshop.urdf
                      </a>
                      <a className="btn" href={`${base}/files/traj_step01.yaml`} download>
                        <IconDownload /> Sample trajectory
                      </a>
                    </div>
                  </div>
                  <div>
                    <h3>VR on your phone</h3>
                    <VrPanel base={base} shareOnly />
                  </div>
                </section>
              </div>
            )}

            {tab === 'how' && (
              <div role="tabpanel" id="tabpanel-how" aria-labelledby="tab-how" className="how">
                <p className="lede">
                  One video went in. These are the AI steps that turned it into this guide, and how much of each
                  is real.
                </p>
                <StatusStrip status={status} />
                <section className="panel how-trace">
                  <h3>Step {activeStep + 1}: {step.action}</h3>
                  {evidence
                    ? <TracePanel step={step} evidence={evidence} />
                    : <div className="skeleton skeleton-block" aria-busy="true" />}
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
