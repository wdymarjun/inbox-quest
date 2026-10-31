import React, { useEffect, useRef } from 'react';

export function LandingScreen({ onStart }) {
  const pageRef = useRef(null);

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
    <div className="landing-page" ref={pageRef}>
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
            Start Mission <span aria-hidden="true">→</span>
          </button>
          <p className="landing-footnote">A playful prototype using a demo inbox. No email account connection.</p>
        </section>

        <div className="mission-illustration" aria-label="Illustration of inbox emails becoming a courier mission">
          <div className="illustration-glow" />
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

      <section className="mission-steps" aria-labelledby="mission-steps-title">
        <div className="steps-heading scroll-reveal">
          <span className="eyebrow"><span className="eyebrow-dot" /> SMALL BATCH. BIG RELIEF.</span>
          <h2 id="mission-steps-title">A better kind of<br /><span>inbox break.</span></h2>
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
      </section>
    </div>
  );
}
