import React, { useRef, useState } from 'react';
import { undoActions } from '../api';

const actionLabels = {
  archive: 'Archive',
  label_read_later: 'Save for later',
  flag_important: 'Flag important',
  leave_in_inbox: 'Leave for review',
  needs_review: 'Needs review',
};

const categoryLabels = {
  promotion: 'Promotion',
  newsletter: 'Newsletter',
  important: 'Important',
  receipt_bill: 'Receipt / bill',
  read_later: 'Read later',
  uncertain: 'Uncertain',
};

export function ResultsScreen({ results, onPlayAgain, usingDemoInbox }) {
  const { appliedActions = [], processedEmails = [] } = results || {};
  const [undoDone, setUndoDone] = useState(false);
  const [undoLoading, setUndoLoading] = useState(false);
  const [undoMessage, setUndoMessage] = useState('');
  const listRef = useRef(null);

  const appliedEmails = processedEmails.filter(email => email.actionStatus === 'applied');
  const archived = appliedEmails.filter(email => email.actionTaken === 'archive').length;
  const readLater = appliedEmails.filter(email => email.actionTaken === 'label_read_later').length;
  const important = appliedEmails.filter(email => email.actionTaken === 'flag_important').length;
  const reviewed = processedEmails.filter(email => email.actionTaken === 'leave_in_inbox').length;
  const categoryCounts = processedEmails.reduce((counts, email) => {
    counts[email.category] = (counts[email.category] || 0) + 1;
    return counts;
  }, {});

  const handleUndo = async () => {
    setUndoLoading(true);
    setUndoMessage('');
    try {
      const actionIds = appliedActions.map(action => action.action_id).filter(Boolean);
      if (actionIds.length === 0) {
        setUndoMessage('There are no completed actions to undo.');
        return;
      }

      const response = await undoActions(actionIds);
      const failedCount = response.failed?.length || 0;
      const undoneCount = response.undone?.length || 0;
      const missingCount = Math.max(0, actionIds.length - undoneCount - failedCount);
      if (failedCount > 0 || missingCount > 0) {
        const reason = response.failed?.[0]?.reason || `${missingCount} action result${missingCount === 1 ? ' is' : 's are'} missing.`;
        setUndoMessage(`${undoneCount} action${undoneCount === 1 ? '' : 's'} undone; ${failedCount + missingCount} could not be confirmed. ${reason}`);
      } else {
        setUndoDone(true);
        setUndoMessage('Mission actions have been undone.');
      }
    } catch (error) {
      setUndoMessage(error instanceof Error ? error.message : 'Undo could not be completed. Please try again.');
    } finally {
      setUndoLoading(false);
    }
  };

  return (
    <div className="screen-card results-card">
      <div className="results-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> MISSION REPORT</span>
          <h1 className="results-title">Nice run. Inbox checked.</h1>
          <p className="results-intro">Here’s what was suggested and what the demo actually completed. No email was deleted.</p>
        </div>
        <span className="mission-complete-mark" aria-hidden="true">✓</span>
      </div>

      {usingDemoInbox ? (
        <div className="demo-notice" role="status">
          <strong>Demo inbox</strong>
          <span>Prototype mode — using sample inbox data.</span>
        </div>
      ) : (
        <div className="demo-notice" role="status">
          <strong>Demo inbox</strong>
          <span>Simulated inbox batch — no email account connection.</span>
        </div>
      )}

      <section className="before-after" aria-label="Before and after summary">
        <div><span className="summary-kicker">BEFORE</span><strong>{processedEmails.length}</strong><span>emails in this batch</span></div>
        <span className="summary-arrow" aria-hidden="true">→</span>
        <div><span className="summary-kicker">AFTER</span><strong>{archived}</strong><span>archived · {processedEmails.length - archived} kept in inbox</span></div>
      </section>

      <section aria-label="Action totals">
        <h2 className="section-title">Action totals</h2>
        <div className="summary-stats-grid">
          <div className="stat-box"><div className="stat-num highlight">{processedEmails.length}</div><div className="stat-label">Reviewed</div></div>
          <div className="stat-box"><div className="stat-num">{archived}</div><div className="stat-label">Archived</div></div>
          <div className="stat-box"><div className="stat-num">{readLater}</div><div className="stat-label">Saved for later</div></div>
          <div className="stat-box"><div className="stat-num">{important}</div><div className="stat-label">Important protected</div></div>
          <div className="stat-box"><div className="stat-num">{reviewed}</div><div className="stat-label">Left for review</div></div>
        </div>
      </section>

      <section className="category-summary" aria-label="Category totals">
        <h2 className="section-title">What was in the batch</h2>
        <div className="category-chips">
          {Object.entries(categoryLabels).map(([category, label]) => (
            <span className={`category-chip ${category === 'uncertain' ? 'uncertain' : ''}`} key={category}>
              {label} <strong>{categoryCounts[category] || 0}</strong>
            </span>
          ))}
        </div>
      </section>

      <section className="changes-section" ref={listRef}>
        <div className="changes-heading">
          <div>
            <h2 className="section-title">Mission changes</h2>
            <p className="table-caption">Suggestions are separate from completed actions. Rejected actions remain unchanged.</p>
          </div>
          <span className="suggestion-key">AI suggestion</span>
        </div>
        {processedEmails.length === 0 ? (
          <div className="empty-state">No emails were processed in this mission.</div>
        ) : (
          <div className="actions-table-wrapper">
            <table className="actions-table">
              <thead>
                <tr><th>Email</th><th>Category</th><th>AI suggestion</th><th>Completed action</th></tr>
              </thead>
              <tbody>
                {processedEmails.map((email, index) => (
                  <tr key={email.id || index}>
                    <td className="email-cell">
                      <strong>{email.sender}</strong>
                      <span>{email.subject}</span>
                    </td>
                    <td><span className={`category-label ${email.category === 'uncertain' ? 'uncertain' : ''}`}>{categoryLabels[email.category] || 'Uncategorized'}</span></td>
                    <td><span className="tag-badge suggested">{actionLabels[email.suggestedAction] || 'Review'}</span></td>
                    <td>
                      {email.actionStatus === 'applied' ? (
                        <span className={`completed-label ${undoDone ? 'restored' : ''}`}>
                          {undoDone ? 'Undone' : actionLabels[email.actionTaken] || 'Completed'}
                        </span>
                      ) : (
                        <span className="completed-label not-applied" title={email.rejectedReason || undefined}>
                          Not completed{email.rejectedReason ? `: ${email.rejectedReason}` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {undoMessage && <div className={`undo-message ${undoDone ? 'success' : ''}`} role="status">{undoMessage}</div>}

      <div className="results-footer">
        <button
          className="btn-secondary"
          onClick={() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          Review Changes
        </button>
        <button
          className="btn-secondary undo-button"
          onClick={handleUndo}
          disabled={undoDone || undoLoading || appliedActions.length === 0}
        >
          {undoLoading ? 'Undoing mission…' : undoDone ? 'Mission Undone' : '↶ Undo Mission'}
        </button>
        <button className="btn-primary" onClick={onPlayAgain}>Run Another Mission →</button>
      </div>
    </div>
  );
}
