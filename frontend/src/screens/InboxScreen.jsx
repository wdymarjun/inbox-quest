import React, { useMemo, useState } from 'react';

const filters = [
  { id: 'all', label: 'All mail' },
  { id: 'important', label: 'Important' },
  { id: 'promotion', label: 'Promotions' },
  { id: 'newsletter', label: 'Newsletters' },
  { id: 'uncertain', label: 'Review' },
];

const categoryLabels = {
  promotion: 'Promotion',
  newsletter: 'Newsletter',
  important: 'Important',
  receipt_bill: 'Receipt',
  read_later: 'Read later',
  uncertain: 'Review',
};

const actionLabels = {
  archive: 'Suggested: archive',
  label_read_later: 'Suggested: save for later',
  flag_important: 'Suggested: protect as important',
  leave_in_inbox: 'Suggested: keep in inbox',
  needs_review: 'Suggested: review manually',
};

function formatMessageDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

export function InboxScreen({ emails, classifications, accountEmail, onStartGame, onBack }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(emails[0]?.id || '');

  const messages = useMemo(() => emails.map(email => ({
    ...email,
    classification: classifications.find(item => item.id === email.id) || {
      category: 'uncertain',
      priority: 'medium',
      confidence: 0,
      reason: 'No classification was returned. Keep this message for manual review.',
      suggested_action: 'needs_review',
    },
  })), [emails, classifications]);

  const visibleMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return messages.filter(({ sender, subject, snippet, classification }) => {
      const filterMatch = activeFilter === 'all' || classification.category === activeFilter;
      const queryMatch = !query || [
        sender,
        subject,
        snippet,
      ].some(value => String(value || '').toLowerCase().includes(query));
      return filterMatch && queryMatch;
    });
  }, [activeFilter, messages, search]);

  const selectedMessage = visibleMessages.find(message => message.id === selectedId) || visibleMessages[0] || null;

  const filterCount = (filterId) => filterId === 'all'
    ? messages.length
    : messages.filter(({ classification }) => classification.category === filterId).length;

  return (
    <section className="inbox-screen" aria-labelledby="inbox-screen-title">
      <header className="inbox-screen-header">
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> CONNECTED MAILBOX</span>
          <h1 id="inbox-screen-title">Your inbox, in focus.</h1>
          <p>Review this batch before the cleanup run. Nothing changes in Gmail until you confirm the action review.</p>
        </div>
        <div className="inbox-account-chip" title={accountEmail}>
          <span className="account-status-dot" />
          <span>{accountEmail || 'Google account connected'}</span>
        </div>
      </header>

      <div className="inbox-toolbar">
        <label className="inbox-search">
          <span aria-hidden="true">⌕</span>
          <span className="screen-reader-only">Search this inbox batch</span>
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search this batch"
          />
          <kbd>/</kbd>
        </label>
        <span className="inbox-batch-count">{messages.length} messages in this batch</span>
      </div>

      <div className="inbox-workspace">
        <nav className="inbox-filters" aria-label="Filter inbox messages">
          <span className="inbox-nav-heading">MAILBOX</span>
          {filters.map(filter => (
            <button
              type="button"
              key={filter.id}
              className={`inbox-filter ${activeFilter === filter.id ? 'active' : ''}`}
              onClick={() => {
                setActiveFilter(filter.id);
                setSelectedId('');
              }}
              aria-pressed={activeFilter === filter.id}
            >
              <span>{filter.label}</span>
              <span className="inbox-filter-count">{filterCount(filter.id)}</span>
            </button>
          ))}
          <div className="inbox-safe-note">
            <span className="safety-shield" aria-hidden="true">✓</span>
            <p>Read-only review here. Gmail changes require your confirmation after the game.</p>
          </div>
        </nav>

        <div className="inbox-message-list" role="list" aria-label="Inbox messages">
          {visibleMessages.length ? visibleMessages.map(({ id, sender, subject, snippet, date, classification }) => (
            <div className="inbox-message-list-item" role="listitem" key={id}>
              <button
                type="button"
                className={`inbox-message-row ${selectedMessage?.id === id ? 'selected' : ''}`}
                onClick={() => setSelectedId(id)}
                aria-pressed={selectedMessage?.id === id}
              >
                <span className="message-avatar" aria-hidden="true">
                  {(sender || '?').trim().charAt(0).toUpperCase()}
                </span>
                <span className="message-main">
                  <span className="message-row-top">
                    <strong className="message-sender">{sender || 'Unknown sender'}</strong>
                    <time className="message-date">{formatMessageDate(date)}</time>
                  </span>
                  <span className="message-subject">{subject || '(No subject)'}</span>
                  <span className="message-snippet">{snippet || 'No preview available.'}</span>
                  <span className={`message-category category-${classification.category}`}>
                    {categoryLabels[classification.category] || 'Review'}
                  </span>
                </span>
              </button>
            </div>
          )) : (
            <div className="inbox-empty-state">
              <span aria-hidden="true">⌕</span>
              <strong>No messages match</strong>
              <p>Try another search or choose a different inbox filter.</p>
            </div>
          )}
        </div>

        <aside className="inbox-message-detail" aria-live="polite">
          {selectedMessage ? (
            <>
              <div className="detail-topline">
                <span className={`message-category category-${selectedMessage.classification.category}`}>
                  {categoryLabels[selectedMessage.classification.category] || 'Review'}
                </span>
                <time>{formatMessageDate(selectedMessage.date)}</time>
              </div>
              <h2>{selectedMessage.subject || '(No subject)'}</h2>
              <div className="detail-sender">
                <span className="message-avatar" aria-hidden="true">
                  {(selectedMessage.sender || '?').trim().charAt(0).toUpperCase()}
                </span>
                <span>
                  <strong>{selectedMessage.sender || 'Unknown sender'}</strong>
                  <small>to me</small>
                </span>
              </div>
              <p className="detail-snippet">{selectedMessage.snippet || 'No message preview was provided.'}</p>
              <div className="detail-suggestion">
                <span className="detail-suggestion-kicker">TRIAGE SUGGESTION</span>
                <strong>{actionLabels[selectedMessage.classification.suggested_action] || actionLabels.needs_review}</strong>
                <p>{selectedMessage.classification.reason || 'Review this suggestion before applying any changes.'}</p>
              </div>
              <p className="detail-no-mutation">This preview does not change your Gmail.</p>
            </>
          ) : (
            <div className="detail-empty">
              <strong>Select a message</strong>
              <p>Choose an email from this batch to inspect its safe triage suggestion.</p>
            </div>
          )}
        </aside>
      </div>

      <footer className="inbox-screen-footer">
        <button type="button" className="btn-secondary" onClick={onBack}>Back to setup</button>
        <div>
          <span>{messages.length} messages ready for review</span>
          <button type="button" className="btn-primary" onClick={onStartGame} disabled={!messages.length}>
            Start Cleanup Game <span aria-hidden="true">→</span>
          </button>
        </div>
      </footer>
    </section>
  );
}
