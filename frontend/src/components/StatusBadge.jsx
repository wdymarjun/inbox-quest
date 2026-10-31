import React, { useEffect, useState } from 'react';
import { subscribeBackendStatus } from '../api';

export function StatusBadge() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeBackendStatus(status => {
      setConnected(status);
    });
    return unsubscribe;
  }, []);

  return (
    <div className={`status-badge ${connected ? 'connected' : 'offline'}`}>
      <span className="status-dot"></span>
      <span>
        {connected
          ? 'Connected to Backend (http://localhost:3001)'
          : 'Offline Mode (Local Fallback Active)'}
      </span>
    </div>
  );
}
