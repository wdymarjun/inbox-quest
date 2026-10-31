import React, { useEffect, useState } from 'react';
import { subscribeBackendStatus } from '../api';

export function StatusBadge() {
  const [connected, setConnected] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeBackendStatus(status => {
      setConnected(status);
    });
    return unsubscribe;
  }, []);

  return (
    <div className={`status-badge ${connected === null ? 'checking' : connected ? 'connected' : 'offline'}`}>
      <span className="status-dot"></span>
      <span>
        {connected
          ? 'Demo backend connected'
          : connected === null
            ? 'Demo inbox · simulated'
            : 'Prototype mode — using sample inbox data.'}
      </span>
    </div>
  );
}
