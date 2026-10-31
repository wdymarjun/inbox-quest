import React, { useState } from 'react';

export function SetupScreen({ onBeginMission, loading, usingDemoInbox, error }) {
  const [batchSize, setBatchSize] = useState(25);

  return (
    <div className="screen-card">
      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        Mission Setup
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', fontSize: '0.95rem' }}>
        Choose a small batch. Your runner skills affect the score, never how an email is handled.
      </p>

      {usingDemoInbox ? (
        <div className="demo-notice" role="status">
          <strong>Demo inbox</strong>
          <span>Prototype mode — using sample inbox data.</span>
        </div>
      ) : (
        <div className="demo-notice" role="status">
          <strong>Demo inbox</strong>
          <span>Simulated inbox batch — no email account connection.</span>
        </div>
      )}

      {error && <div className="error-notice" role="alert">{error}</div>}

      <div className="setup-group">
        <label className="setup-label">Select Email Batch Size</label>
        <div className="batch-selector">
          {[10, 25, 50].map(size => (
            <button
              key={size}
              type="button"
              className={`batch-btn ${batchSize === size ? 'active' : ''}`}
              onClick={() => setBatchSize(size)}
            >
              {size} Emails
            </button>
          ))}
        </div>
      </div>

      <div className="safety-notice-box">
        <div className="safety-notice-title">
          <span>🛡️ Safety Guarantees</span>
        </div>
        <ul className="safety-list">
          <li>We do not delete email automatically.</li>
          <li>Important emails are never archived.</li>
          <li>Uncertain emails stay for review.</li>
        </ul>
      </div>

      <div className="setup-actions">
        <button
          className="btn-primary"
          style={{ flex: 1 }}
          onClick={() => onBeginMission(batchSize)}
          disabled={loading}
        >
          {loading ? 'Preparing mission…' : 'Start mission →'}
        </button>
      </div>
    </div>
  );
}
