import { useEffect, useState } from 'react';
import { AppBar } from './AppBar.jsx';
import { IconArrowRight } from './Icons.jsx';
import { loadSkillIndex, loadSkill, loadEvidence, langName } from '../utils/skillLoader.js';
import { ADMIN_AVAILABLE } from '../utils/env.js';

// One capture fans out into three outputs. Drawn, not stock iconography.
function FanOut() {
  const out = [
    ['Human manual', '3D model, pins, clips', 36],
    ['Robot script', 'URDF + trajectories', 150],
    ['VR overlay', 'Anchors + voice cues', 264]
  ];
  return (
    <svg className="fanout" viewBox="0 0 520 330" role="img" aria-label="One phone capture becomes a human manual, a robot script and a VR overlay">
      <rect x="8" y="112" width="104" height="106" rx="16" fill="#fff" stroke="#c3cdc9" strokeWidth="2" />
      <rect x="22" y="128" width="76" height="62" rx="8" fill="#e5ebe8" />
      <circle cx="60" cy="159" r="14" fill="#2fe38b" stroke="#08774a" strokeWidth="2" />
      <text x="60" y="206" textAnchor="middle" fontSize="13" fontWeight="600" fill="#121a17">Phone capture</text>

      <rect x="196" y="118" width="108" height="94" rx="14" fill="#121a17" />
      <text x="250" y="154" textAnchor="middle" fontSize="15" fontWeight="700" fill="#2fe38b">skill.json</text>
      <text x="250" y="176" textAnchor="middle" fontSize="11.5" fill="#c3cdc9">one canonical file</text>
      <text x="250" y="194" textAnchor="middle" fontSize="11.5" fill="#c3cdc9">any skill</text>

      <path d="M112 165 H196" stroke="#08774a" strokeWidth="2.5" fill="none" />
      <path d="M190 159 l8 6 -8 6" stroke="#08774a" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {out.map(([title, sub, y]) => (
        <g key={title}>
          <path d={`M304 165 C340 165 340 ${y + 30} 376 ${y + 30}`} stroke="#08774a" strokeWidth="2.5" fill="none" />
          <rect x="376" y={y} width="136" height="60" rx="12" fill="#fff" stroke="#c3cdc9" strokeWidth="2" />
          <text x="392" y={y + 26} fontSize="14" fontWeight="700" fill="#121a17">{title}</text>
          <text x="392" y={y + 45} fontSize="11.5" fill="#55645e">{sub}</text>
        </g>
      ))}
    </svg>
  );
}

function Thumb({ steps }) {
  // iso box with one pin per step: a quick visual fingerprint of the skill
  const n = Math.min(steps, 8);
  return (
    <svg viewBox="0 0 160 100" className="thumb" aria-hidden="true" focusable="false">
      <polygon points="80,26 126,44 80,62 34,44" fill="#3b4c52" stroke="#2fe38b" strokeWidth="1.5" />
      <polygon points="34,44 80,62 80,88 34,70" fill="#27353a" stroke="#2fe38b" strokeWidth="1.5" />
      <polygon points="126,44 80,62 80,88 126,70" fill="#1d292d" stroke="#2fe38b" strokeWidth="1.5" />
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        return <circle key={i} cx={80 + Math.cos(a) * 30} cy={38 + Math.sin(a) * 11} r="4.5" fill="#fff" stroke="#08774a" strokeWidth="2" />;
      })}
    </svg>
  );
}

function Library() {
  const [cards, setCards] = useState(null);

  useEffect(() => {
    let live = true;
    loadSkillIndex()
      .then(async (idx) => {
        const rows = await Promise.all(idx.skills.map(async (s) => {
          try {
            const [skill, ev] = await Promise.all([loadSkill(s.id), loadEvidence(s.id)]);
            return { id: s.id, title: s.title, skill, status: ev.status };
          } catch {
            return { id: s.id, title: s.title, skill: null, status: null };
          }
        }));
        if (live) setCards(rows);
      })
      .catch(() => { if (live) setCards([]); });
    return () => { live = false; };
  }, []);

  if (cards === null) {
    return (
      <div className="library" aria-busy="true">
        {[0, 1].map((i) => <div key={i} className="skeleton skeleton-card" />)}
      </div>
    );
  }
  if (cards.length === 0) {
    return (
      <div className="state">
        <strong>No skills yet</strong>
        {ADMIN_AVAILABLE ? (
          <>
            <p>Upload your first skill video in admin and it will appear here.</p>
            <a className="btn btn-primary" href="#/admin">Open admin</a>
          </>
        ) : (
          <p>No skills have been published to this site yet.</p>
        )}
      </div>
    );
  }
  return (
    <ul className="library">
      {cards.map(({ id, title, skill, status }) => {
        const langs = skill ? skill.language_pack || [] : [];
        const clipsReal = status && status.clips === 'captured';
        const real = clipsReal && status.model === 'captured';
        const chipText = real ? 'Real capture' : clipsReal ? 'Real clips · placeholder 3D model' : 'Placeholder media';
        return (
          <li key={id}>
            <a className="skill-card" href={`#/${id}`}>
              <Thumb steps={skill ? skill.steps.length : 5} />
              <div className="skill-card-body">
                <h3>{title}</h3>
                <p className="skill-meta">
                  {skill ? `${skill.steps.length} steps` : 'Unavailable'}
                  {langs.length > 0 && <> · {langs.map(langName).join(', ')}</>}
                </p>
                <span className={`chip ${real ? 'chip-ok' : 'chip-warn'}`}>
                  <span className="chip-value">{chipText}</span>
                </span>
              </div>
              <span className="skill-card-go" aria-hidden="true"><IconArrowRight /></span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function Landing() {
  const [first, setFirst] = useState(null);
  useEffect(() => {
    loadSkillIndex().then((i) => setFirst(i.skills[0] ? i.skills[0].id : null)).catch(() => {});
  }, []);

  return (
    <>
      <a className="skip-link" href="#content">Skip to content</a>
      <AppBar>
        {ADMIN_AVAILABLE && <a className="btn btn-ghost" href="#/admin">Admin</a>}
      </AppBar>
      <main id="content" className="landing">
        <section className="hero">
          <div className="hero-copy">
            <h2>Film a skill once. Teach it to people, robots and headsets.</h2>
            <p>
              handLens turns one phone video of any hands-on job into a step-by-step guide you can
              follow, plus a robot-ready script and a VR overlay. Meta’s SAM 3.1, Muse Voice and Muse
              Spark read the video; every skill shows which parts ran live and which are still stand-ins.
            </p>
            <div className="hero-actions">
              {first && (
                <a className="btn btn-primary btn-lg" href={`#/${first}`}>
                  Open the demo <IconArrowRight />
                </a>
              )}
              <a className="btn btn-lg" href="#skills">Browse skills</a>
            </div>
          </div>
          <FanOut />
        </section>

        <section id="skills" className="library-section" aria-labelledby="skills-h">
          <div className="section-head">
            <h2 id="skills-h">Skills</h2>
            {ADMIN_AVAILABLE && <a className="btn btn-ghost" href="#/admin">Add a skill</a>}
          </div>
          <Library />
        </section>
      </main>
    </>
  );
}
