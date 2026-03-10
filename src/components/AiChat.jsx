import { useState, useRef, useEffect, useCallback } from 'react';

const API_URL = 'http://localhost:3001';

function speakText(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis || !text) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.onend = resolve;
    utterance.onerror = resolve;
    window.speechSynthesis.speak(utterance);
  });
}

function playNotesWithDuration(notes, onPlaySequence) {
  return new Promise((resolve) => {
    if (!notes || notes.length === 0) {
      resolve();
      return;
    }
    onPlaySequence(notes);
    const lastEnd = Math.max(...notes.map(n => n.startTime + n.duration));
    setTimeout(resolve, lastEnd + 100);
  });
}

function StepMessage({ step, onPlaySequence }) {
  if (step.type === 'text') {
    return <div className="whitespace-pre-wrap">{step.text}</div>;
  }
  if (step.type === 'notes') {
    return (
      <button
        className="px-2.5 py-1 bg-[#3d6b9e] hover:bg-[#4a7fb5] text-white text-xs rounded-md transition-colors"
        onClick={() => onPlaySequence(step.notes)}
      >
        ▶ Play {step.notes.length} notes
      </button>
    );
  }
  return null;
}

export default function AiChat({ noteRecorder, onPlaySequence, speech }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const loadingRef = useRef(false);
  const messagesRef = useRef([]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const playbackSteps = useCallback(async (steps) => {
    for (const step of steps) {
      if (step.type === 'text') {
        await speakText(step.text);
      } else if (step.type === 'notes') {
        await playNotesWithDuration(step.notes, onPlaySequence);
      }
    }
  }, [onPlaySequence]);

  const doSend = useCallback(async (text) => {
    if (!text || loadingRef.current) return;

    const recordedNotes = noteRecorder.current?.getAndClear() || [];

    setMessages((prev) => [
      ...prev,
      { role: 'user', text, notes: recordedNotes.length > 0 ? recordedNotes : null },
    ]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          noteSequence: recordedNotes,
          history: messagesRef.current,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');

      const steps = data.steps || [];

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', steps },
      ]);

      playbackSteps(steps);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', steps: [{ type: 'text', text: `Error: ${err.message}` }] },
      ]);
    } finally {
      setLoading(false);
    }
  }, [noteRecorder, playbackSteps]);

  // Register voice send callback
  useEffect(() => {
    if (speech?.setOnSend) {
      speech.setOnSend((text) => doSend(text));
    }
  }, [speech, doSend]);

  const sendMessage = () => doSend(input.trim());

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1a2e]">
      {/* Header */}
      <div className="flex flex-col px-4 py-3 bg-[#16213e] border-b border-[#333]">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-semibold text-sm text-gray-200">AI Musician</span>
            <span className="text-[11px] text-gray-500 mt-0.5">Play notes then ask Claude to respond</span>
          </div>
          {speech?.supported && (
            <button
              onClick={speech.toggle}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                speech.listening
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-gray-700/50 text-gray-500 hover:bg-gray-700/70 hover:text-gray-300'
              }`}
              title={speech.listening ? 'Stop listening' : 'Start voice input (say "send" to submit)'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0">
        {messages.length === 0 && (
          <div className="text-gray-500 text-sm text-center px-3 py-6 leading-relaxed">
            Play some notes on the piano, then ask Claude to harmonize, continue the melody, or play something new.
            {speech?.supported && (
              <div className="mt-2 text-[11px] text-gray-600">
                Click the mic icon to use voice — say "send" to submit.
                <br />
                Press Ctrl+Shift+T for debug transcript.
              </div>
            )}
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] px-3 py-2 rounded-lg text-[13px] leading-snug break-words ${
              msg.role === 'user'
                ? 'self-end bg-[#2d4a7a] text-gray-200'
                : 'self-start bg-[#2a2a3e] text-gray-300'
            }`}
          >
            {msg.role === 'user' ? (
              <>
                <div className="whitespace-pre-wrap">{msg.text}</div>
                {msg.notes && (
                  <button
                    className="mt-1.5 px-2.5 py-1 bg-[#3d6b9e] hover:bg-[#4a7fb5] text-white text-xs rounded-md transition-colors"
                    onClick={() => onPlaySequence(msg.notes)}
                  >
                    ▶ Play {msg.notes.length} notes
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                {(msg.steps || []).map((step, j) => (
                  <StepMessage key={j} step={step} onPlaySequence={onPlaySequence} />
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="self-start max-w-[85%] px-3 py-2 rounded-lg bg-[#2a2a3e] text-gray-500 text-[13px] italic">
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 px-3 py-2.5 border-t border-[#333] bg-[#16213e]">
        <input
          type="text"
          className="flex-1 px-3 py-2 bg-[#0f0f23] border border-[#444] rounded-lg text-gray-200 text-[13px] outline-none focus:border-[#5a8abf] placeholder:text-gray-600"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Claude to play something..."
          disabled={loading}
        />
        <button
          className="px-4 py-2 bg-[#3d6b9e] hover:bg-[#4a7fb5] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] rounded-lg transition-colors"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
