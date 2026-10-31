import React, { useState } from 'react';
import { StatusBadge } from './components/StatusBadge';
import { LandingScreen } from './screens/LandingScreen';
import { SetupScreen } from './screens/SetupScreen';
import { GameScreen } from './screens/GameScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { fetchInbox, classifyEmails, isBackendConnected } from './api';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('landing'); // 'landing' | 'setup' | 'game' | 'results'
  const [emails, setEmails] = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [missionResults, setMissionResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usingDemoInbox, setUsingDemoInbox] = useState(false);
  const [setupError, setSetupError] = useState('');

  const handleStart = () => {
    setCurrentScreen('setup');
  };

  const handleBeginMission = async (batchSize) => {
    setLoading(true);
    setSetupError('');
    try {
      const { emails: fetchedEmails, fromBackend: inboxFromBackend } = await fetchInbox(batchSize);
      setEmails(fetchedEmails);
      if (fetchedEmails.length === 0) {
        throw new Error('No emails were available for this mission. Please try again.');
      }
      const { classifications: classified, fromBackend: classificationsFromBackend } =
        await classifyEmails(fetchedEmails);
      setClassifications(classified);
      setUsingDemoInbox(!inboxFromBackend || !classificationsFromBackend || !isBackendConnected);
      setCurrentScreen('game');
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Unable to prepare the mission. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMissionComplete = (results) => {
    setMissionResults(results);
    setCurrentScreen('results');
  };

  const handlePlayAgain = () => {
    setEmails([]);
    setClassifications([]);
    setMissionResults(null);
    setSetupError('');
    setCurrentScreen('setup');
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-icon">IQ</div>
          <span className="logo-title">Inbox Quest</span>
          <span className="logo-tagline">A calmer inbox, one mission at a time</span>
        </div>
        <StatusBadge />
      </header>

      <main className="main-content">
        {currentScreen === 'landing' && <LandingScreen onStart={handleStart} />}
        {currentScreen === 'setup' && (
          <SetupScreen
            onBeginMission={handleBeginMission}
            loading={loading}
            usingDemoInbox={usingDemoInbox}
            error={setupError}
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
          />
        )}
      </main>
    </div>
  );
}
