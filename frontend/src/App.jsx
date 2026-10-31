import React, { useState } from 'react';
import { StatusBadge } from './components/StatusBadge';
import { LandingScreen } from './screens/LandingScreen';
import { SetupScreen } from './screens/SetupScreen';
import { fetchInbox, classifyEmails } from './api';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('landing'); // 'landing' | 'setup' | 'game' | 'results'
  const [emails, setEmails] = useState([]);
  const [classifications, setClassifications] = useState([]);
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
          <div className="screen-card">
            <h3>Mission Runner Initializing...</h3>
          </div>
        )}
      </main>
    </div>
  );
}
