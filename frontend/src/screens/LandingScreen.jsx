import React, { useEffect, useRef, useState } from 'react';

const introPhrases = [
  'a calmer inbox',
  'a smarter route',
  'a safer clean-up',
  'a three-minute win',
];

export function LandingScreen({ onStart }) {
  const pageRef = useRef(null);
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return undefined;

    const phraseTimer = window.setInterval(() => {
      setPhraseIndex(index => (index + 1) % introPhrases.length);
    }, 3200);

    return () => window.clearInterval(phraseTimer);
  }, []);

  useEffect(() => {
    const page = pageRef.current;
    if (!page || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    page.classList.add('has-scroll-reveal');
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -32px 0px' });

    page.querySelectorAll('.scroll-reveal').forEach((element) => revealObserver.observe(element));
    return () => {
      revealObserver.disconnect();
      page.classList.remove('has-scroll-reveal');
    };
  }, []);

  return (
    <div className="landing-page" id="home" ref={pageRef}>
      {/* CINEMATIC STAGE 1: ORIGIN — ARJUN SINGH */}
      <section className="origin-intro" aria-label="Project Origin and Creator">
        <div className="origin-signature-badge">
          <span className="origin-pulse-dot" aria-hidden="true" />
          <span className="origin-kicker">INDEPENDENT CREATION BY</span>
          <div className="origin-creator-wrap">
            <span className="origin-creator-name" tabIndex="0">
              ARJUN SINGH
            </span>
          </div>
          <span className="origin-subtitle">ARCHITECT OF INBOX QUEST</span>
        </div>
        <div className="origin-light-thread" aria-hidden="true">
          <div className="light-thread-line" />
          <div className="light-thread-spark" />
        </div>
      </section>

      <section className="intro-spotlight" aria-labelledby="intro-spotlight-title">
        <span className="eyebrow"><span className="eyebrow-dot" /> YOUR THREE-MINUTE INBOX RESET</span>
        <h2 id="intro-spotlight-title" aria-label="Make room for a calmer inbox">
          <span className="intro-heading-lead">Make room for</span>
          <span className="phrase-window">
            <span className="rotating-phrase" key={phraseIndex} aria-hidden="true">
              {introPhrases[phraseIndex]}
            </span>
          </span>
        </h2>
        <p>
          Inbox Quest turns cleanup into a courier mission: triage a small simulated batch,
          play the route, and review every safe, reversible action when you land.
        </p>
      </section>

      <div className="landing-layout">
        <section className="landing-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> YOUR INBOX, WITH A GAME PLAN</span>
          <h1 className="title-hero">Inbox zero.<br /><span>Make it a mission.</span></h1>
          <p className="subtitle-hero">
            Pick a small batch, guide a courier through your inbox, and review safe, simulated actions when you land.
          </p>
          <div className="feature-pills">
            <span className="feature-pill">↗ No automatic deletion</span>
            <span className="feature-pill">↩ Reversible actions</span>
            <span className="feature-pill">◉ Uncertain stays for review</span>
          </div>
          <button className="btn-primary landing-cta" onClick={onStart}>
            Start Game <span aria-hidden="true">→</span>
          </button>
          <p className="landing-footnote">A playful prototype using a demo inbox. No email account connection.</p>
        </section>

        <div className="mission-illustration" aria-label="Illustration of inbox emails becoming a courier mission">
          <div className="illustration-glow" />
          <div className="planet-scene" aria-hidden="true">
            <span className="planet-orbit planet-orbit-one" />
            <span className="planet-orbit planet-orbit-two" />
            <span className="planet">
              <span className="planet-texture" />
              <span className="planet-atmosphere" />
            </span>
            <span className="planet-satellite" />
            <span className="planet-star planet-star-one" />
            <span className="planet-star planet-star-two" />
          </div>
          <div className="glass-note glass-note-top"><span className="glass-note-icon">✦</span><span><strong>Mission ready</strong><small>25 emails · safe mode</small></span><i /></div>
          <div className="illustration-topline"><span>MISSION PREVIEW</span><span>03:00</span></div>
          <div className="illustration-inbox">
            <span className="illustration-icon">✉</span>
            <span><strong>Inbox</strong><small>One small batch at a time</small></span>
            <span className="mail-count">25</span>
          </div>
          <div className="illustration-route"><span /><span /><span /></div>
          <div className="illustration-runner">
            <span className="runner-robot" aria-hidden="true">▣</span>
            <span className="runner-email email-blue">✉</span>
            <span className="runner-email email-amber">?</span>
            <span className="runner-email email-navy">✉</span>
            <span className="runner-ground" />
          </div>
          <div className="illustration-caption">
            <span><i className="legend-dot blue" /> Suggested action</span>
            <span><i className="legend-dot amber" /> Needs a human look</span>
          </div>
          <div className="glass-note glass-note-bottom"><span className="glass-sparkle">↗</span><span><strong>Nothing deleted</strong><small>Every action is reversible</small></span></div>
        </div>
      </div>

      <section className="content-section about-section scroll-reveal" id="about" aria-labelledby="about-title">
        <div className="section-intro">
          <span className="eyebrow"><span className="eyebrow-dot" /> ABOUT THE PROJECT</span>
          <h2 id="about-title">A little less inbox.<br /><span>A little more play.</span></h2>
        </div>
        <div className="about-copy">
          <p>
            Inbox Quest makes inbox cleanup feel lighter. Choose a small batch of sample emails,
            guide a courier through a quick runner game, then review the simulated cleanup summary.
          </p>
          <p>
            It is a safe prototype, not an email account connection: nothing is deleted, uncertain
            messages stay for review, and demo actions can be undone from the results screen.
          </p>
        </div>
      </section>

      <section className="content-section help-section scroll-reveal" id="help" aria-labelledby="help-title">
        <div className="section-intro">
          <span className="eyebrow"><span className="eyebrow-dot" /> HELP & HOW TO PLAY</span>
          <h2 id="help-title">Ready in<br /><span>three quick steps.</span></h2>
          <p>Pick a batch, play the route, and review what happened.</p>
        </div>
        <div className="help-list">
          <article className="help-item">
            <span className="help-index">01</span>
            <div><h3>Choose your batch</h3><p>Select 10, 25, or 50 sample emails to set up a short run.</p></div>
          </article>
          <article className="help-item">
            <span className="help-index">02</span>
            <div><h3>Guide your courier</h3><p>Jump with Space, ↑, or tap. Hold ↓ or S to crouch under overhead mail.</p></div>
          </article>
          <article className="help-item">
            <span className="help-index">03</span>
            <div><h3>Review and undo</h3><p>Check the simulated actions in your report. Use Undo Mission to reverse completed demo actions.</p></div>
          </article>
        </div>
      </section>

      <section className="mission-steps content-section scroll-reveal" id="game" aria-labelledby="mission-steps-title">
        <div className="steps-heading scroll-reveal">
          <span className="eyebrow"><span className="eyebrow-dot" /> THE GAME</span>
          <h2 id="mission-steps-title">Jump in.<br /><span>Clear the route.</span></h2>
          <p className="game-section-copy">A quick runner game gives inbox cleanup a playful rhythm. Your score never decides how an email is handled.</p>
        </div>
        <div className="steps-grid">
          <article className="step-card scroll-reveal">
            <span className="step-number">01</span>
            <span className="step-symbol">▤</span>
            <h3>Pick your batch</h3>
            <p>Start with 10, 25, or 50 sample messages. The mission stays small and manageable.</p>
          </article>
          <article className="step-card scroll-reveal">
            <span className="step-number">02</span>
            <span className="step-symbol">⌁</span>
            <h3>Run the route</h3>
            <p>Jump gaps, duck under incoming mail, and make the three-minute cleanup feel like play.</p>
          </article>
          <article className="step-card scroll-reveal">
            <span className="step-number">03</span>
            <span className="step-symbol">↶</span>
            <h3>Review every move</h3>
            <p>See what was simulated, keep uncertain messages for review, and undo the mission in one tap.</p>
          </article>
        </div>
        <button className="btn-primary section-start-button" onClick={onStart}>
          Start Game <span aria-hidden="true">→</span>
        </button>
      </section>

      {/* CINEMATIC STAGE 7: CREATOR END — ECHOES THE ORIGIN */}
      <footer className="site-footer scroll-reveal" id="credits">
        <div className="footer-topline">
          <span className="eyebrow"><span className="eyebrow-dot" /> CREDITS</span>
          <p>A small game for a calmer inbox.</p>
        </div>
        <div className="footer-credit">
          <div className="footer-origin-thread" aria-hidden="true" />
          <span className="footer-credit-label">Conceived, Designed &amp; Crafted by</span>
          <div className="creator-name-wrap">
            <span className="creator-name" tabIndex="0">ARJUN SINGH</span>
          </div>
          <span className="footer-credit-sub">INBOX QUEST · SAFE MONOCHROME COURIER EXPERIENCE</span>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Wdymarjun. All rights reserved.</span>
          <span>Inbox Quest · Safe simulated inbox cleanup</span>
        </div>
      </footer>
    </div>
  );
}
