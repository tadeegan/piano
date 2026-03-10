import { useState, useEffect, useRef, useSyncExternalStore, useCallback } from 'react';
import engine from '../engine';

/** Subscribe to active notes (Set of MIDI numbers) */
export function useActiveNotes() {
  const notesRef = useRef(new Set());

  const subscribe = useCallback((cb) => engine.onActiveNotesChange((s) => {
    notesRef.current = s;
    cb();
  }), []);

  const getSnapshot = useCallback(() => notesRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Subscribe to timeline events + held notes + breaks */
export function useTimeline() {
  const snapRef = useRef({ events: [], heldNotes: new Map(), breaks: [], inBreak: false });

  const subscribe = useCallback((cb) => engine.onTimelineChange((s) => {
    snapRef.current = s;
    cb();
  }), []);

  const getSnapshot = useCallback(() => snapRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Subscribe to audio state ('uninitialized' | 'suspended' | 'running') */
export function useAudioState() {
  const stateRef = useRef(engine.getAudioState());

  const subscribe = useCallback((cb) => engine.onAudioStateChange((s) => {
    stateRef.current = s;
    cb();
  }), []);

  const getSnapshot = useCallback(() => stateRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Get the engine's time origin (for the timeline animation) */
export function useTimeOrigin() {
  const [origin, setOrigin] = useState(null);

  useEffect(() => {
    // Poll once on timeline changes since origin is set on first note
    return engine.onTimelineChange(() => {
      const o = engine.getTimeOrigin();
      if (o !== null && origin === null) setOrigin(o);
    });
  }, [origin]);

  return origin;
}
