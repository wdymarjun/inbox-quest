import React, { useEffect, useState } from 'react';
import { StatusBadge } from './components/StatusBadge';
import { LandingScreen } from './screens/LandingScreen';
import { SetupScreen } from './screens/SetupScreen';
import { GameScreen } from './screens/GameScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { GmailActionReviewModal } from './components/GmailActionReviewModal';
import {
  fetchInbox,
  classifyEmails,
  isBackendConnected,
  checkAuthStatus,
  initiateGoogleSignIn,
  disconnectGoogle,
  subscribeAuthState,
  consumeUrlAuthParams,
  setMockAuthStateForTesting,
  applyActions,
} from './api';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('landing'); // 'landing' | 'setup' | 'game' | 'results'
  const [emails, setEmails] = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [missionResults, setMissionResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usingDemoInbox, setUsingDemoInbox] = useState(false);
  const [inboxSource, setInboxSource] = useState('demo'); // 'demo' | 'gmail'
  const [setupError, setSetupError] = useState('');
  const [oauthError, setOauthError] = useState('');
  const [pendingSection, setPendingSection] = useState('');

  // OAuth authentication state
  const [authState, setAuthState] = useState({
    configured: false,
    authenticated: false,
    user: null,
    scope: null,
    scopeDescription: null,
    statusMessage: '',
    loading: false,
  });

  // Action review modal state (required before live Gmail alterations)
  const [pendingReviewResults, setPendingReviewResults] = useState(null);
  const [applyingReview, setApplyingReview] = useState(false);

  useEffect(() => {
    // 1. Subscribe to auth state updates
    const unsubscribe = subscribeAuthState(setAuthState);

    // 2. Consume any OAuth return parameters from URL (?auth=success or ?auth_error=...)
    const { error: urlAuthError, success: urlAuthSuccess } = consumeUrlAuthParams();
    if (urlAuthError) {
      setOauthError(urlAuthError);
      setCurrentScreen('setup');
    } else if (urlAuthSuccess) {
      setCurrentScreen('setup');
    }

    // 3. Query backend auth status
    checkAuthStatus();

    return unsubscribe;
  }, []);

  const handleStart = () => {
    setCurrentScreen('setup');
  };

  const handleSectionNavigation = (section) => {
    if (section === 'start-game') {
      handleStart();
      return;
    }

    if (currentScreen === 'game' && !window.confirm('Leave this run? Your current run will not have a mission report or undo option.')) {
      return;
    }

    if (currentScreen !== 'landing') {
      setPendingSection(section);
      setCurrentScreen('landing');
      return;
    }

    if (section === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (currentScreen !== 'landing' || !pendingSection) return;

    const frame = window.requestAnimationFrame(() => {
      if (pendingSection === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        document.getElementById(pendingSection)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setPendingSection('');
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentScreen, pendingSection]);

  const handleBeginMission = async (batchSize, selectedSource = 'demo') => {
    setLoading(true);
    setSetupError('');
    setInboxSource(selectedSource);
    try {
      const { emails: fetchedEmails, fromBackend: inboxFromBackend } = await fetchInbox(batchSize, selectedSource);
      setEmails(fetchedEmails);
      if (fetchedEmails.length === 0) {
        throw new Error('No emails were available for this mission. Please try again.');
      }
      const { classifications: classified, fromBackend: classificationsFromBackend } =
        await classifyEmails(fetchedEmails);
      setClassifications(classified);
      setUsingDemoInbox(selectedSource === 'demo' || !inboxFromBackend || !classificationsFromBackend || !isBackendConnected);
      setCurrentScreen('game');
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Unable to prepare the mission. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMissionComplete = (results) => {
    // If playing with a connected Gmail inbox, require explicit confirmation before applying changes
    if (inboxSource === 'gmail' && authState.authenticated) {
      const proposed = results.processedEmails.map(p => ({
        email_id: p.id,
        action: p.actionTaken,
      }));
      setPendingReviewResults({ ...results, proposedActions: proposed });
    } else {
      setMissionResults(results);
      setCurrentScreen('results');
    }
  };

  const handleConfirmGmailActions = async () => {
    if (!pendingReviewResults) return;
    setApplyingReview(true);
    try {
      const actionsToApply = pendingReviewResults.proposedActions || [];
      const res = await applyActions(actionsToApply);

      const updatedProcessed = pendingReviewResults.processedEmails.map(p => {
        const wasApplied = res.applied?.some(a => a.email_id === p.id);
        return {
          ...p,
          actionStatus: wasApplied ? 'applied' : 'needs_review',
        };
      });

      setMissionResults({
        appliedActions: res.applied || [],
        processedEmails: updatedProcessed,
      });
      setPendingReviewResults(null);
      setCurrentScreen('results');
    } catch (err) {
      console.error('Failed to confirm and apply Gmail actions:', err);
    } finally {
      setApplyingReview(false);
    }
  };

  const handleCancelGmailActions = () => {
    if (!pendingReviewResults) return;
    // Safely keep all emails in inbox without mutation
    const cancelledProcessed = pendingReviewResults.processedEmails.map(p => ({
      ...p,
      actionTaken: 'leave_in_inbox',
      actionStatus: 'needs_review',
    }));

    setMissionResults({
      appliedActions: [],
      processedEmails: cancelledProcessed,
    });
    setPendingReviewResults(null);
    setCurrentScreen('results');
  };

  const handlePlayAgain = () => {
    setEmails([]);
    setClassifications([]);
    setMissionResults(null);
    setPendingReviewResults(null);
    setSetupError('');
    setCurrentScreen('setup');
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <button className="logo-area logo-home-button" onClick={() => handleSectionNavigation('home')} aria-label="Inbox Quest home">
          <div className="logo-icon">IQ</div>
          <span className="logo-title">Inbox Quest</span>
          <span className="logo-tagline">A calmer inbox, one mission at a time</span>
        </button>
        <nav className="site-navigation" aria-label="Main navigation">
          {[
            ['home', 'Home'],
            ['about', 'About'],
            ['help', 'Help'],
            ['game', 'Game'],
            ['credits', 'Credits'],
          ].map(([section, label]) => (
            <button
              className="nav-link"
              key={section}
              onClick={() => handleSectionNavigation(section)}
              aria-current={currentScreen === 'landing' && section === 'home' ? 'page' : undefined}
            >
              {label}
            </button>
          ))}
          <button className="nav-start-button" onClick={() => handleSectionNavigation('start-game')}>
            Start Game <span aria-hidden="true">→</span>
          </button>
        </nav>
        <div className="header-status"><StatusBadge /></div>
      </header>

      <main className="main-content">
        {currentScreen === 'landing' && <LandingScreen onStart={handleStart} />}
        {currentScreen === 'setup' && (
          <SetupScreen
            onBeginMission={handleBeginMission}
            loading={loading}
            error={setupError}
            authState={authState}
            onGoogleSignIn={initiateGoogleSignIn}
            onGoogleSignOut={disconnectGoogle}
            oauthError={oauthError}
            onClearOauthError={() => setOauthError('')}
            onDevPresetChange={setMockAuthStateForTesting}
          />
        )}
        {currentScreen === 'game' && (
          <GameScreen
            emails={emails}
            classifications={classifications}
            onMissionComplete={handleMissionComplete}
          />
        )}
        {currentScreen === 'results' && (
          <ResultsScreen
            results={missionResults}
            onPlayAgain={handlePlayAgain}
            usingDemoInbox={usingDemoInbox || !isBackendConnected}
            inboxSource={inboxSource}
            connectedEmail={authState.user?.email}
          />
        )}

        {/* Gmail Action Review Modal: Required before mutating real Gmail messages */}
        {pendingReviewResults && (
          <GmailActionReviewModal
            proposedActions={pendingReviewResults.proposedActions}
            onConfirm={handleConfirmGmailActions}
            onCancel={handleCancelGmailActions}
            applying={applyingReview}
          />
        )}
      </main>
    </div>
  );
}
