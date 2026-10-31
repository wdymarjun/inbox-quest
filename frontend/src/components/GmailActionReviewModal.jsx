

import React from 'react';

/**
 * Modal to review and explicitly confirm actions before applying to real Gmail.
 * Ensures OAuth consent is never treated as blanket confirmation to mutate email messages.
 */
export function GmailActionReviewModal({
  proposedActions = [],
  onConfirm,
  onCancel,
  applying = false,
  error = '',
}) {
  const archiveCount = proposedActions.filter(a => a.action === 'archive').length;
  const labelLaterCount = proposedActions.filter(a => a.action === 'label_read_later').length;
  const flagImportantCount = proposedActions.filter(a => a.action === 'flag_important').length;
  const leaveInboxCount = proposedActions.filter(a => a.action === 'leave_in_inbox').length;

  return (
    <div className="review-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
      <div className="review-modal-card">
        <div className="review-modal-header">
          <div className="review-modal-badge">REVIEW BEFORE APPLYING</div>
          <h2 id="review-modal-title" className="review-modal-title">
            Confirm Gmail Actions
          </h2>
          <p className="review-modal-subtitle">
            OAuth consent gives Inbox Quest permission, but no changes are made to your Gmail without your explicit approval here.
          </p>
        </div>

        <div className="review-summary-grid">
          <div className="review-summary-card">
            <span className="review-summary-num highlight">{archiveCount}</span>
            <span className="review-summary-label">Move to Archive</span>
            <span className="review-summary-desc">Promotions, bills, digests</span>
          </div>
          <div className="review-summary-card">
            <span className="review-summary-num">{labelLaterCount}</span>
            <span className="review-summary-label">Label Read Later</span>
            <span className="review-summary-desc">Longform articles, essays</span>
          </div>
          <div className="review-summary-card">
            <span className="review-summary-num highlight-blue">{flagImportantCount}</span>
            <span className="review-summary-label">Flag Important</span>
            <span className="review-summary-desc">Protected security & work</span>
          </div>
          <div className="review-summary-card">
            <span className="review-summary-num">{leaveInboxCount}</span>
            <span className="review-summary-label">Keep in Inbox</span>
            <span className="review-summary-desc">Uncertain items untouched</span>
          </div>
        </div>

        <div className="review-safety-callout">
          <span className="safety-shield" aria-hidden="true">✓</span>
          <div>
            <strong>Safety Guarantee:</strong> Zero deletions. Deletions are forbidden by code. You can undo every confirmed action in one click on the results screen.
          </div>
        </div>

        {error && <div className="error-notice review-action-error" role="alert">{error}</div>}

        <div className="review-modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={applying}
          >
            Cancel & Keep All in Inbox
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={applying}
            aria-busy={applying}
          >
            {applying ? 'Applying to Gmail…' : 'Confirm & Apply to Gmail →'}
          </button>
        </div>
      </div>
    </div>
  );
}
