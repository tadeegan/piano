import { useState, useEffect, useRef, useCallback } from 'react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function useSpeechRecognition() {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => !!SpeechRecognition);
  const [transcript, setTranscript] = useState([]);
  const recognitionRef = useRef(null);
  const currentChunkRef = useRef('');
  const onSendRef = useRef(null);

  const start = useCallback(() => {
    if (!supported || recognitionRef.current) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        const chunk = finalTranscript.trim();
        currentChunkRef.current += (currentChunkRef.current ? ' ' : '') + chunk;

        setTranscript((prev) => [
          ...prev,
          { text: chunk, time: Date.now(), type: 'final' },
        ]);

        // Check if "send" is in the finalized text
        if (/\bsend\b/i.test(chunk)) {
          // Remove the word "send" from the chunk to get clean text
          const messageText = currentChunkRef.current
            .replace(/\bsend\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

          if (messageText && onSendRef.current) {
            onSendRef.current(messageText);
          }
          currentChunkRef.current = '';
        }
      }

      if (interimTranscript) {
        setTranscript((prev) => {
          const filtered = prev.filter((e) => e.type !== 'interim');
          return [...filtered, { text: interimTranscript.trim(), time: Date.now(), type: 'interim' }];
        });
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        setListening(false);
        recognitionRef.current = null;
      }
    };

    recognition.onend = () => {
      // Auto-restart if we're still supposed to be listening
      if (recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          setListening(false);
          recognitionRef.current = null;
        }
      } else {
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [supported]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      recognitionRef.current = null;
      r.stop();
    }
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  const setOnSend = useCallback((fn) => {
    onSendRef.current = fn;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return { listening, supported, transcript, toggle, setOnSend };
}
