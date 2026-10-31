import React, { useState } from 'react';
import { undoActions } from '../api';

export function ResultsScreen({ results, onPlayAgain }) {
  const { appliedActions = [], processedEmails = [] } = results || {};
  const [undone, setUndone] = useState(false);
  const [undoLoading, setUndoLoading] = useState(false);

  // Compute summary stats
  const totalReviewed = processedEmails.length;
  const archived = processedEmails.filter(p => p.actionTaken === 'archive').length;
  const labeledReadLater = processedEmails.filter(p => p.actionTaken === 'label_read_later').length;
  const flaggedImportant = processedEmails.filter(p => p.actionTaken === 'flag_important' || p.priority === 'high').length;
  const protectedUncertain = processedEmails.filter(p => p.category === 'uncertain' || p.actionTaken === 'leave_in_inbox').length;

  const handleUndo = async () => {
    setUndoLoading(true);
    try {
      const actionIds = appliedActions.map(a => a.action_id).filter(Boolean);
      if (actionIds.length > 0) {
        await undoActions(actionIds);
      }
      setUndone(true);
    } catch (err) {
      console.error('Error undoing actions:', err);
    } finally {
      setUndoLoading(false);
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'archive':
        return 'Archived';
      case 'label_read_later':
        return 'Labeled (Read Later)';
      case 'flag_important':
        return 'Flagged Important';
      case 'leave_in_inbox':
        return 'Kept in Inbox (Safe)';
      default:
        return action;
    }
  };

  return (
    <div className="screen-card results-card">
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
        Mission Complete: Inbox Secured
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
        Here is the audit log of all changes applied during your courier mission.
      </p>

      {undone && (
        <div className="undo-confirm-text">
          ✓ All actions undone. Your inbox is back to its original state.
        </div>
      )}

      {/* Stats summary */}
      <div className="summary-stats-grid">
        <div className="stat-box">
          <div className="stat-num highlight">{totalReviewed}</div>
          <div className="stat-label">Total Reviewed</div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{archived}</div>
          <div className="stat-label">Cleaned / Archived</div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{labeledReadLater}</div>
          <div className="stat-label">Read Later</div>
        </div>
        <div className="stat-box">
          <div className="stat-num" style={{ color: '#2563eb' }}>{flaggedImportant}</div>
          <div className="stat-label">High Priority Flagged</div>
        </div>
      </div>

      <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        🛡️ Protected / Untouched Uncertain Emails: <strong>{protectedUncertain}</strong>
      </div>

      {/* Action log table */}
      <div className="actions-table-wrapper">
        <table className="actions-table">
          <thead>
            <tr>
              <th>Sender</th>
              <th>Subject</th>
              <th>Action Taken</th>
              <th>Audit Status</th>
            </tr>
          </thead>
          <tbody>
            {processedEmails.map((email, idx) => (
              <tr key={email.id || idx}>
                <td style={{ fontWeight: 500, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {email.sender}
                </td>
                <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {email.subject}
                </td>
                <td>
                  <span style={{
                    fontWeight: 600,
                    color: undone ? '#9ca3af' : (email.actionTaken === 'flag_important' ? '#b45309' : '#15803d'),
                    textDecoration: undone ? 'line-through' : 'none',
                  }}>
                    {getActionLabel(email.actionTaken)}
                  </span>
                  {undone && <span style={{ marginLeft: '6px', color: '#6b7280', fontSize: '0.75rem' }}>(Restored)</span>}
                </td>
                <td>
                  <span className={`tag-badge ${undone ? 'suggested' : 'applied'}`}>
                    {undone ? 'AI suggestion' : 'Action applied'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Controls */}
      <div className="results-footer">
        <button
          className="btn-secondary"
          onClick={handleUndo}
          disabled={undone || undoLoading || appliedActions.length === 0}
          style={{
            borderColor: undone ? 'var(--border-light)' : '#ef4444',
            color: undone ? 'var(--text-muted)' : '#dc2626',
          }}
        >
          {undoLoading ? 'Reverting Changes...' : (undone ? 'Actions Undone' : '↩️ Undo All Actions')}
        </button>

        <button className="btn-primary" onClick={onPlayAgain}>
          Play Another Mission →
        </button>
      </div>
    </div>
  );
}
