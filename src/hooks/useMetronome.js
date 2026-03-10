import { useRef, useCallback, useEffect } from 'react';

export function useMetronome() {
  const audioContextRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const currentBeatRef = useRef(0);
  const timerIdRef = useRef(null);
  const isPlayingRef = useRef(false);
  const bpmRef = useRef(120);
  const beatsPerMeasureRef = useRef(4);
  const beatCallbackRef = useRef(null);

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();

    return () => {
      if (timerIdRef.current) {
        clearTimeout(timerIdRef.current);
      }
    };
  }, []);

  const playClick = useCallback((time, isAccent) => {
    const context = audioContextRef.current;
    if (!context) return;

    const osc = context.createOscillator();
    const gain = context.createGain();

    // Accented beat (first beat of measure) is higher pitch and louder
    osc.frequency.value = isAccent ? 1200 : 800;
    osc.type = 'sine';

    gain.gain.value = isAccent ? 0.3 : 0.15;
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.03);

    osc.connect(gain);
    gain.connect(context.destination);

    osc.start(time);
    osc.stop(time + 0.03);
  }, []);

  const scheduleNote = useCallback(() => {
    const context = audioContextRef.current;
    if (!context) return;

    const secondsPerBeat = 60.0 / bpmRef.current;

    // Schedule notes 100ms ahead
    while (nextNoteTimeRef.current < context.currentTime + 0.1) {
      const isAccent = currentBeatRef.current === 0;
      playClick(nextNoteTimeRef.current, isAccent);

      // Trigger beat callback for visual indicator
      if (beatCallbackRef.current) {
        const beat = currentBeatRef.current;
        const scheduleDelay = (nextNoteTimeRef.current - context.currentTime) * 1000;
        setTimeout(() => {
          beatCallbackRef.current?.(beat);
        }, scheduleDelay);
      }

      nextNoteTimeRef.current += secondsPerBeat;
      currentBeatRef.current = (currentBeatRef.current + 1) % beatsPerMeasureRef.current;
    }

    if (isPlayingRef.current) {
      timerIdRef.current = setTimeout(scheduleNote, 25);
    }
  }, [playClick]);

  const start = useCallback((bpm, beatsPerMeasure, onBeat) => {
    if (isPlayingRef.current) return;

    const context = audioContextRef.current;
    if (!context) return;

    if (context.state === 'suspended') {
      context.resume();
    }

    bpmRef.current = bpm;
    beatsPerMeasureRef.current = beatsPerMeasure;
    beatCallbackRef.current = onBeat;

    isPlayingRef.current = true;
    currentBeatRef.current = 0;
    nextNoteTimeRef.current = context.currentTime;

    scheduleNote();
  }, [scheduleNote]);

  const stop = useCallback(() => {
    isPlayingRef.current = false;
    if (timerIdRef.current) {
      clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
    }
    beatCallbackRef.current = null;
  }, []);

  const updateTempo = useCallback((bpm) => {
    bpmRef.current = bpm;
  }, []);

  const updateTimeSignature = useCallback((beatsPerMeasure) => {
    beatsPerMeasureRef.current = beatsPerMeasure;
    currentBeatRef.current = 0;
  }, []);

  return { start, stop, updateTempo, updateTimeSignature };
}
