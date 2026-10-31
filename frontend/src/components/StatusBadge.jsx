import React from 'react';
import { GoogleSignInButton } from './GoogleSignInButton';

export function StatusBadge({ authState, onSignIn, onOpenSetup }) {
  const isAuthenticated = Boolean(authState?.authenticated && authState?.user);

  if (isAuthenticated) {
    return (
      <button
        type="button"
        className="header-account-button"
        onClick={onOpenSetup}
        title="Manage your connected Google account"
      >
        {authState.user.picture ? (
          <img src={authState.user.picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="header-account-initial" aria-hidden="true">
            {(authState.user.name || authState.user.email || 'G').charAt(0).toUpperCase()}
          </span>
        )}
        <span className="header-account-email">{authState.user.email || 'Google account connected'}</span>
        <span className="header-account-dot" aria-hidden="true" />
      </button>
    );
  }

  return (
    <GoogleSignInButton
      className="header-google-signin"
      onClick={onSignIn}
      loading={Boolean(authState?.loading && authState?.configured)}
      label="Sign in with Google"
    />
  );
}
