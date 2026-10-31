import React, { useState } from 'react';

export function SetupScreen({ onBeginMission, loading }) {
  const [batchSize, setBatchSize] = useState(25);

  return (
    <div className="screen-card">
      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        Mission Setup
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', fontSize: '0.95rem' }}>
        Select your simulated batch size to prepare your courier robot for launch.
      </p>

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
          <li>We classify emails and suggest safe actions.</li>
          <li>We do not delete email automatically.</li>
          <li>Uncertain emails are left for review.</li>
        </ul>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <button
          className="btn-primary"
          style={{ flex: 1 }}
          onClick={() => onBeginMission(batchSize)}
          disabled={loading}
        >
          {loading ? 'Preparing Mission...' : 'Begin Mission →'}
        </button>
        <button
          className="btn-secondary"
          onClick={() => onBeginMission(10)}
          disabled={loading}
        >
          Try Demo Inbox (Quick 10)
        </button>
      </div>
    </div>
  );
}
