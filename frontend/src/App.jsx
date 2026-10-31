import React, { useState } from 'react';
import { StatusBadge } from './components/StatusBadge';
import { LandingScreen } from './screens/LandingScreen';
import { SetupScreen } from './screens/SetupScreen';
import { GameScreen } from './screens/GameScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { fetchInbox, classifyEmails } from './api';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('landing'); // 'landing' | 'setup' | 'game' | 'results'
  const [emails, setEmails] = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [missionResults, setMissionResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleStart = () => {
    setCurrentScreen('setup');
  };

  const handleBeginMission = async (batchSize) => {
    setLoading(true);
    try {
      const { emails: fetchedEmails } = await fetchInbox(batchSize);
      setEmails(fetchedEmails);
      const classified = await classifyEmails(fetchedEmails);
      setClassifications(classified);
      setCurrentScreen('game');
    } catch (err) {
      console.error('Error preparing mission:', err);
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
    setCurrentScreen('setup');
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-icon">IQ</div>
          <span className="logo-title">Inbox Quest</span>
          <span className="logo-tagline">Save your inbox. Save the world.</span>
        </div>
        <StatusBadge />
      </header>

      <main className="main-content">
        {currentScreen === 'landing' && <LandingScreen onStart={handleStart} />}
        {currentScreen === 'setup' && (
          <SetupScreen onBeginMission={handleBeginMission} loading={loading} />
        )}
        {currentScreen === 'game' && (
          <GameScreen
            emails={emails}
            classifications={classifications}
            onMissionComplete={handleMissionComplete}
          />
        )}
        {currentScreen === 'results' && (
          <ResultsScreen results={missionResults} onPlayAgain={handlePlayAgain} />
        )}
      </main>
    </div>
  );
}
