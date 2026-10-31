import React, { useEffect, useRef, useState } from 'react';
import { askInboxQuestAssistant } from '../api';

const initialMessage = {
  role: 'assistant',
  content: 'Hi! I can help with Inbox Quest gameplay, navigation, and safe inbox cleanup.',
};

const suggestedQuestions = [
  'How do I start a game?',
  'How do I jump and crouch?',
  'What happens to my emails?',
];

export function InboxQuestAssistant({ screen }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([initialMessage]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const conversationRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    if (!window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
      inputRef.current?.focus();
    }
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !isSending) setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSending]);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages, error, isSending]);

  const sendMessage = async (value = draft) => {
    const message = value.trim();
    if (!message || isSending || message.length > 1000) return;

    const conversation = messages.slice(1);
    let historyEnd = conversation.length;
    while (historyEnd > 0 && conversation[historyEnd - 1].role !== 'assistant') {
      historyEnd--;
    }

    const priorMessages = [];
    let historyLength = 0;
    for (const item of conversation.slice(0, historyEnd).slice(-6).reverse()) {
      if (historyLength + item.content.length > 4000) break;
      priorMessages.unshift({ role: item.role, content: item.content });
      historyLength += item.content.length;
    }
    setMessages(current => [...current, { role: 'user', content: message }]);
    setDraft('');
    setError('');
    setIsSending(true);

    try {
      const answer = await askInboxQuestAssistant({
        message,
        history: priorMessages,
        screen,
      });
      setMessages(current => [...current, { role: 'assistant', content: answer }]);
    } catch (requestError) {
      setDraft(message);
      setError(requestError instanceof Error
        ? requestError.message
        : 'The Inbox Quest assistant is temporarily unavailable. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside className="inbox-assistant" aria-label="Inbox Quest help assistant">
      {isOpen && (
        <section
          id="assistant-panel"
          className="assistant-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="assistant-title"
        >
          <header className="assistant-header">
            <div className="assistant-brand">
              <span className="assistant-mark" aria-hidden="true">IQ</span>
              <span>
                <strong id="assistant-title">Quest Guide</strong>
                <small>Inbox Quest help</small>
              </span>
            </div>
            <button
              type="button"
              className="assistant-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close Inbox Quest help"
            >
              ×
            </button>
          </header>

          <div className="assistant-topic-note">
            <span className="assistant-topic-indicator" aria-hidden="true" />
            <span>Focused on Inbox Quest · No access to your emails</span>
          </div>

          <div className="assistant-conversation" ref={conversationRef} aria-live="polite">
            {messages.map((item, index) => (
              <div className={`assistant-message assistant-message-${item.role}`} key={`${index}-${item.role}`}>
                {item.role === 'assistant' && (
                  <span className="assistant-message-avatar" aria-hidden="true">IQ</span>
                )}
                <span className="assistant-message-content">{item.content}</span>
              </div>
            ))}
            {isSending && (
              <div className="assistant-message assistant-message-assistant assistant-thinking-message" role="status" aria-label="Quest Guide is thinking">
                <span className="assistant-message-avatar" aria-hidden="true">IQ</span>
                <span className="assistant-thinking-copy">
                  <span className="assistant-thinking-label">Quest Guide is thinking</span>
                  <span className="assistant-typing" aria-hidden="true"><i /><i /><i /></span>
                </span>
              </div>
            )}
          </div>

          {messages.length === 1 && (
            <div className="assistant-suggestions" aria-label="Suggested questions">
              {suggestedQuestions.map(question => (
                <button
                  type="button"
                  key={question}
                  onClick={() => sendMessage(question)}
                  disabled={isSending}
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          {error && <p className="assistant-error" role="alert">{error}</p>}

          <form
            className="assistant-form"
            onSubmit={event => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <label className="screen-reader-only" htmlFor="assistant-message">Ask about Inbox Quest</label>
            <textarea
              id="assistant-message"
              ref={inputRef}
              value={draft}
              onChange={event => {
                setDraft(event.target.value);
                if (error) setError('');
              }}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              maxLength={1000}
              rows={1}
              placeholder="Ask about the game…"
              disabled={isSending}
            />
            <button
              type="submit"
              className="assistant-send"
              aria-label="Send question"
              disabled={isSending || !draft.trim()}
            >
              <span aria-hidden="true">↑</span>
            </button>
          </form>
          <p className="assistant-disclaimer">Answers are limited to documented Inbox Quest features.</p>
        </section>
      )}

      <button
        type="button"
        className={`assistant-launcher ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(open => !open)}
        aria-expanded={isOpen}
        aria-controls="assistant-panel"
      >
        <span className="assistant-launcher-icon" aria-hidden="true">{isOpen ? '×' : 'IQ'}</span>
        <span>{isOpen ? 'Close help' : 'Ask Quest Guide'}</span>
      </button>
    </aside>
  );
}
