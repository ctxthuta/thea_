'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Sparkles, X, RotateCcw, Zap } from 'lucide-react';
import './chat-widget.css';

type Message = { role: 'user' | 'assistant'; text: string };

const GREETING = "What do you want? If you're looking for cheap templates or free homework help, close this tab. Thea Solutions builds elite bespoke software and enterprise AI for companies with real budgets. What's your project, or are you just wasting my time? (English, ไทย, မြန်မာ, 中文, Русский — no filter)";

const QUICK_PROMPTS = [
  '⚡ What do you build?',
  '🔥 How do 2-week delivery cycles work?',
  '💼 Are you hiring?',
  '💰 What are your pricing models?',
  '📅 Schedule a Consultation',
  '🇲🇲 ဘာတွေလုပ်ပေးလဲ',
];

function MessageContent({ text }: { text: string }) {
  // Strip asterisks directly wrapping URLs or emails:
  // e.g. **https://...** -> https://...
  // e.g. **sales@...** -> sales@...
  let cleaned = text.replace(/\*\*(https?:\/\/[^\s*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*\*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\*\*/g, '$1');

  // Regex matches:
  // 1 & 2: [markdown link](url)
  // 3: raw https?:// url
  // 4: email address
  // 5: **bold text**
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<*]+[^<.,:;"\x27)\]\s*])|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  const parts: Array<{ type: 'text' | 'link' | 'email' | 'bold'; label?: string; url?: string; value?: string }> = [];

  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: cleaned.slice(lastIndex, match.index) });
    }
    if (match[1] && match[2]) {
      parts.push({ type: 'link', label: match[1], url: match[2] });
    } else if (match[3]) {
      parts.push({ type: 'link', label: match[3], url: match[3] });
    } else if (match[4]) {
      parts.push({ type: 'email', label: match[4], url: `mailto:${match[4]}` });
    } else if (match[5]) {
      parts.push({ type: 'bold', value: match[5] });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < cleaned.length) {
    parts.push({ type: 'text', value: cleaned.slice(lastIndex) });
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'link' || part.type === 'email') {
          return (
            <a
              key={i}
              href={part.url}
              target={part.type === 'link' ? '_blank' : undefined}
              rel={part.type === 'link' ? 'noopener noreferrer' : undefined}
              className="thea-chat-link"
            >
              {part.label}
            </a>
          );
        }
        if (part.type === 'bold') {
          return <strong key={i} className="font-semibold">{part.value}</strong>;
        }
        return <span key={i}>{part.value}</span>;
      })}
    </>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: GREETING }]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages, open, busy]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  async function sendMessage(textToSend: string) {
    const text = textToSend.trim();
    if (!text || busy) return;

    const next: Message[] = [...messages, { role: 'user', text }];
    setMessages(next);
    setDraft('');
    setError('');
    setBusy(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next
            .filter((message) => message.role === 'user')
            .slice(-6)
            .map((message) => message.text),
        }),
      });

      const data = await response.json();
      if (!response.ok || typeof data.reply !== 'string') {
        throw new Error(data.error || 'Please try again.');
      }
      setMessages((current) => [...current, { role: 'assistant', text: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat is temporarily unavailable. Please try again.');
      setDraft(text);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(draft);
  }

  function resetChat() {
    setMessages([{ role: 'assistant', text: GREETING }]);
    setDraft('');
    setError('');
  }

  return (
    <div className="thea-chat">
      {open && (
        <section className="thea-chat-panel animate-in fade-in slide-in-from-bottom-4 duration-200" aria-label="Chat with Thea" role="dialog">
          {/* Header */}
          <div className="thea-chat-header">
            <div className="thea-chat-avatar">
              <Sparkles size={18} aria-hidden="true" />
            </div>
            <div className="thea-chat-header-info">
              <div className="thea-chat-title-row">
                <strong>Ask Thea</strong>
              </div>
              <span>Bespoke Engineering & Enterprise AI</span>
            </div>
            <div className="thea-chat-header-actions">
              <button
                className="thea-chat-icon-btn"
                type="button"
                onClick={resetChat}
                title="Restart conversation"
                aria-label="Restart conversation"
              >
                <RotateCcw size={16} aria-hidden="true" />
              </button>
              <button
                className="thea-chat-icon-btn"
                type="button"
                onClick={() => setOpen(false)}
                title="Close chat"
                aria-label="Close chat"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="thea-chat-messages" aria-live="polite" aria-relevant="additions">
            {messages.map((message, index) => (
              <div key={index} className={`thea-chat-bubble ${message.role}`}>
                <MessageContent text={message.text} />
              </div>
            ))}

            {busy && (
              <div className="thea-chat-bubble assistant thea-chat-typing" role="status" aria-label="Thinking">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick Prompts (shown when only greeting exists) */}
          {messages.length === 1 && !busy && (
            <div className="thea-chat-quick-prompts">
              <div className="thea-chat-quick-label">
                <Zap size={12} aria-hidden="true" />
                <span>Quick Questions</span>
              </div>
              <div className="thea-chat-chips">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    className="thea-chat-chip"
                    onClick={() => sendMessage(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && <p className="thea-chat-error" role="alert">{error}</p>}

          {/* Input Form */}
          <form className="thea-chat-form" onSubmit={submit}>
            <label className="sr-only" htmlFor="thea-chat-input">
              Your message
            </label>
            <input
              ref={inputRef}
              id="thea-chat-input"
              maxLength={1200}
              placeholder="Ask anything about Thea..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={busy}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label="Send message"
              className="thea-chat-send-btn"
            >
              <Send size={16} aria-hidden="true" />
            </button>
          </form>

          <p className="thea-chat-disclaimer">
            Thea AI ships reality, not fluff. Zero internal leaks.
          </p>
        </section>
      )}

      {/* Floating Launcher Button */}
      <button
        type="button"
        className="thea-chat-launcher"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? 'Close chat' : 'Open chat with Thea'}
      >
        <span className="thea-chat-launcher-beacon" aria-hidden="true" />
        {open ? <X size={20} aria-hidden="true" /> : <MessageCircle size={20} aria-hidden="true" />}
        <span>{open ? 'Close' : 'Ask Thea'}</span>
      </button>
    </div>
  );
}
