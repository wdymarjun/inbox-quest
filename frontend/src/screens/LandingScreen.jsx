import React from 'react';

export function LandingScreen({ onStart }) {
  return (
    <div className="landing-layout">
      <section className="landing-copy">
        <span className="eyebrow"><span className="eyebrow-dot" /> YOUR INBOX, WITH A GAME PLAN</span>
        <h1 className="title-hero">Turn inbox cleanup into a 3-minute mission.</h1>
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
        <div className="illustration-topline"><span>MISSION PREVIEW</span><span>3 MIN</span></div>
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
      </div>
    </div>
  );
}
