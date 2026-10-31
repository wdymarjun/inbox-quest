import React, { useEffect, useState } from 'react';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

export function SetupScreen({
  onBeginMission,
  loading,
  error,
  authState,
  onGoogleSignIn,
  onGoogleSignOut,
  oauthError,
  onClearOauthError,
  onDevPresetChange,
}) {
  const [batchSize, setBatchSize] = useState(25);
  const [selectedSource, setSelectedSource] = useState('demo'); // 'demo' | 'gmail'

  const isAuthenticated = Boolean(authState?.authenticated && authState?.user);
  const isOAuthConfigured = Boolean(authState?.configured);
  const isAuthLoading = Boolean(authState?.loading);

  useEffect(() => {
    if (isAuthenticated) {
      setSelectedSource('gmail');
    }
  }, [isAuthenticated]);

  const handleSourceSelect = (source) => {
    if (source === 'gmail' && !isAuthenticated) {
      return;
    }
    setSelectedSource(source);
  };

  const handleStart = () => {
    onBeginMission(batchSize, selectedSource);
  };

  return (
    <div className="screen-card setup-screen">
      <div className="setup-heading">
        <span className="eyebrow"><span className="eyebrow-dot" /> MISSION BRIEFING</span>
        <h2>Mission Setup</h2>
        <p>Configure your inbox mission parameters. Every triage action is safe, verified, and reversible.</p>
      </div>

      {/* Global setup error if any */}
      {error && <div className="error-notice" role="alert">{error}</div>}

      {/* OAuth return error notice */}
      {oauthError && (
        <div className="error-notice auth-error-alert" role="alert">
          <div className="auth-error-content">
            <strong>Authentication Notice:</strong> {oauthError}
          </div>
          {onClearOauthError && (
            <button
              type="button"
              className="auth-error-dismiss"
              onClick={onClearOauthError}
              aria-label="Dismiss error notice"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* SECTION 1: INBOX SOURCE SELECTION */}
      <div className="setup-group">
        <div className="setup-label-row">
          <label className="setup-label">Select Inbox Source</label>
          <span className="setup-sublabel">Choose sample data or real Gmail</span>
        </div>

        <div className="inbox-source-grid" role="radiogroup" aria-label="Inbox data source">
          {/* Option A: Demo Inbox (Always available) */}
          <div
            className={`source-card ${selectedSource === 'demo' ? 'active' : ''}`}
            onClick={() => handleSourceSelect('demo')}
            role="radio"
            aria-checked={selectedSource === 'demo'}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') handleSourceSelect('demo'); }}
          >
            <div className="source-card-header">
              <span className="source-radio-indicator" />
              <div className="source-title-group">
                <span className="source-title">Demo Inbox</span>
                <span className="source-tag demo-tag">Guaranteed Sandbox</span>
              </div>
            </div>
            <p className="source-desc">
              Safe prototype environment loaded with 50 realistic emails (security alerts, receipts, newsletters, promotions, and ambiguous emails).
            </p>
            <div className="source-meta">
              <span>✓ Zero setup needed</span>
              <span>✓ Never touches real email</span>
            </div>
          </div>

          {/* Option B: Google Gmail (Backend OAuth Managed) */}
          <div
            className={`source-card ${selectedSource === 'gmail' ? 'active' : ''} ${!isAuthenticated ? 'disabled-source' : ''}`}
            onClick={() => isAuthenticated && handleSourceSelect('gmail')}
            role="radio"
            aria-checked={selectedSource === 'gmail'}
            aria-disabled={!isAuthenticated}
            tabIndex={isAuthenticated ? 0 : -1}
            onKeyDown={(e) => { if (isAuthenticated && (e.key === ' ' || e.key === 'Enter')) handleSourceSelect('gmail'); }}
          >
            <div className="source-card-header">
              <span className="source-radio-indicator" />
              <div className="source-title-group">
                <span className="source-title">Live Gmail Account</span>
                {isAuthenticated ? (
                  <span className="source-tag connected-tag">Connected</span>
                ) : (
                  <span className="source-tag signin-tag">Requires Sign-in</span>
                )}
              </div>
            </div>
            <p className="source-desc">
              Connect via Google’s official OAuth flow. Organize your real Gmail triage queue with an explicit action confirmation step before applying changes.
            </p>
            <div className="source-meta">
              <span>{isAuthenticated ? `✓ Signed in: ${authState.user.email}` : '• Sign in below to activate'}</span>
              <span>✓ Action review required</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: GOOGLE ACCOUNT CONNECTION PANEL */}
      <div className="google-auth-card">
        <div className="auth-card-top">
          <div className="auth-card-title-group">
            <h3 className="auth-card-title">Google Account Integration</h3>
            <span className="auth-card-sub">Official Google OAuth 2.0 connection</span>
          </div>

          {/* Connection Status Badge */}
          {isAuthenticated ? (
            <span className="status-badge connected">
              <span className="status-dot" /> Connected to Gmail
            </span>
          ) : isOAuthConfigured ? (
            <span className="status-badge offline">
              <span className="status-dot" /> Not Connected
            </span>
          ) : (
            <span className="status-badge unconfigured">
              <span className="status-dot" /> Backend OAuth Unconfigured
            </span>
          )}
        </div>

        {/* State A: Backend OAuth Not Configured */}
        {!isOAuthConfigured && !isAuthenticated && (
          <div className="auth-unconfigured-box">
            <p className="auth-notice-text">
              The backend server does not currently expose active Google OAuth credentials (<code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code>).
            </p>
            <p className="auth-notice-sub">
              Inbox Quest remains 100% playable using the <strong>Demo Inbox</strong> above with local heuristics and mock action audit logging.
            </p>
          </div>
        )}

        {/* State B: Configured and Signed Out */}
        {isOAuthConfigured && !isAuthenticated && (
          <div className="auth-signed-out-box">
            <div className="auth-scope-disclosure">
              <div className="scope-kicker">PERMISSION DISCLOSURE</div>
              <p className="scope-text">
                Signing in grants <strong>Gmail read and organize access</strong> (<code>gmail.modify</code>) so Inbox Quest can fetch headers and apply your chosen archives or labels.
              </p>
              <ul className="scope-bullets">
                <li><strong>No deletions:</strong> Automatic deletion is permanently forbidden in code.</li>
                <li><strong>Action confirmation:</strong> No email is altered without your explicit review.</li>
                <li><strong>Safe credentials:</strong> Handled entirely on Google-hosted login pages.</li>
              </ul>
            </div>

            <div className="auth-btn-row">
              <GoogleSignInButton
                onClick={onGoogleSignIn}
                loading={isAuthLoading}
                label="Continue with Google"
              />
            </div>
          </div>
        )}

        {/* State C: Authenticated / Signed In */}
        {isAuthenticated && (
          <div className="auth-signed-in-box">
            <div className="auth-user-identity">
              {authState.user.picture ? (
                <img
                  src={authState.user.picture}
                  alt={authState.user.name || 'User avatar'}
                  className="auth-avatar"
                />
              ) : (
                <div className="auth-avatar-placeholder" aria-hidden="true">
                  {(authState.user.name || authState.user.email || 'G')[0].toUpperCase()}
                </div>
              )}
              <div className="auth-user-details">
                <span className="auth-user-name">{authState.user.name || 'Google User'}</span>
                <span className="auth-user-email">{authState.user.email}</span>
                <span className="auth-scope-badge">Scope: Read & Organize (No Delete)</span>
              </div>
            </div>

            <div className="auth-user-controls">
              <button
                type="button"
                className="btn-disconnect"
                onClick={onGoogleSignOut}
                disabled={isAuthLoading}
              >
                Disconnect Account
              </button>
            </div>
          </div>
        )}

        {/* Developer preview switcher for testing all states without live Google Cloud project */}
        {import.meta.env.DEV && onDevPresetChange && (
          <div className="dev-preview-toggle">
            <span className="dev-preview-label">UI State Preview (Dev Test):</span>
            <div className="dev-btn-group">
              <button
                type="button"
                className={`dev-btn ${!isOAuthConfigured && !isAuthenticated ? 'active' : ''}`}
                onClick={() => onDevPresetChange('unconfigured')}
              >
                Unconfigured
              </button>
              <button
                type="button"
                className={`dev-btn ${isOAuthConfigured && !isAuthenticated ? 'active' : ''}`}
                onClick={() => onDevPresetChange('signed_out')}
              >
                Signed Out
              </button>
              <button
                type="button"
                className={`dev-btn ${isAuthenticated ? 'active' : ''}`}
                onClick={() => {
                  onDevPresetChange('signed_in');
                  setSelectedSource('gmail');
                }}
              >
                Signed In (Gmail)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: BATCH SIZE SELECTION */}
      <div className="setup-group">
        <label className="setup-label">Choose batch size</label>
        <div className="batch-selector">
          {[10, 25, 50].map(size => (
            <button
              key={size}
              type="button"
              className={`batch-btn ${batchSize === size ? 'active' : ''}`}
              onClick={() => setBatchSize(size)}
            >
              <span className="batch-size">{size}</span>
              <span className="batch-unit">emails</span>
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 4: SAFETY GUARANTEES */}
      <div className="safety-notice-box">
        <div className="safety-notice-title">
          <span><span className="safety-shield" aria-hidden="true">✓</span> Safe by design</span>
        </div>
        <ul className="safety-list">
          <li><strong>Zero email deletion:</strong> Deletions are permanently blocked in code.</li>
          <li><strong>High priority protected:</strong> Critical correspondence is never archived.</li>
          <li><strong>Uncertain emails untouched:</strong> Low confidence messages are left in inbox for manual review.</li>
          <li><strong>Explicit confirmation:</strong> Live Gmail runs show a proposed action breakdown before execution.</li>
        </ul>
      </div>

      {/* SECTION 5: START ACTION */}
      <div className="setup-actions">
        <button
          className="btn-primary"
          style={{ flex: 1 }}
          onClick={handleStart}
          disabled={loading || (selectedSource === 'gmail' && !isAuthenticated)}
        >
          {loading
            ? 'Preparing mission…'
            : selectedSource === 'gmail'
            ? `Review Gmail Inbox (${batchSize} emails) →`
            : `Start Demo Mission (${batchSize} emails) →`}
        </button>
      </div>
    </div>
  );
}
