import React from 'react';

export function LandingScreen({ onStart }) {
  return (
    <div className="screen-card landing-card">
      <h1 className="title-hero">Turn inbox cleanup into a 3-minute mission</h1>
      <p className="subtitle-hero">
        Inbox Quest turns your boring email triage into a fast-paced space courier mini-game.
        Every jump and pickup maps directly to a safe, reversible inbox action.
      </p>

      <div className="feature-pills">
        <span className="feature-pill">⚡ 3-Minute Mini-Game</span>
        <span className="feature-pill">🛡️ Zero Deletions Guarantee</span>
        <span className="feature-pill">↩️ 1-Click Complete Undo</span>
        <span className="feature-pill">🤖 Heuristics + Gemini</span>
      </div>

      <button className="btn-primary" onClick={onStart}>
        Start Mission →
      </button>
    </div>
  );
}
