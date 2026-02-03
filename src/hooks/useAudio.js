import { useRef, useEffect } from 'react';

export function useAudio() {
  const audioContextRef = useRef(null);
  const activeOscillatorsRef = useRef(new Map());

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();

    return () => {
      activeOscillatorsRef.current.forEach((note) => {
        note.oscillators.forEach((osc) => {
          try {
            osc.stop();
          } catch (e) {
            // Already stopped
          }
        });
      });
      activeOscillatorsRef.current.clear();
    };
  }, []);

  const midiToFrequency = (midiNote) => {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  };

  const playNote = (midiNote) => {
    if (!audioContextRef.current) return;

    // If note is already playing, stop it first to allow retriggering
    if (activeOscillatorsRef.current.has(midiNote)) {
      const oldNote = activeOscillatorsRef.current.get(midiNote);

      // Clear any pending stop timeout
      if (oldNote.stopTimeout) {
        clearTimeout(oldNote.stopTimeout);
      }

      // Stop immediately for fast retriggering
      oldNote.oscillators.forEach((osc) => {
        try {
          osc.stop();
        } catch (e) {
          // Already stopped
        }
      });
      activeOscillatorsRef.current.delete(midiNote);
    }

    const context = audioContextRef.current;

    // Resume audio context if suspended (browser autoplay policy)
    if (context.state === 'suspended') {
      context.resume();
    }

    const now = context.currentTime;
    const frequency = midiToFrequency(midiNote);

    // Create multiple oscillators for a richer sound (electric piano style)
    const oscillators = [];
    const gainNodes = [];

    // Main tone
    const osc1 = context.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(frequency, now);

    // Harmonic (octave up, quieter)
    const osc2 = context.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(frequency * 2, now);

    // Harmonic (fifth, even quieter)
    const osc3 = context.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(frequency * 3, now);

    // Create filter for brightness
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.Q.setValueAtTime(1, now);

    // Main gain for osc1
    const gain1 = context.createGain();
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.005);
    gain1.gain.exponentialRampToValueAtTime(0.15, now + 0.1);

    // Gain for osc2
    const gain2 = context.createGain();
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.1, now + 0.005);
    gain2.gain.exponentialRampToValueAtTime(0.05, now + 0.08);

    // Gain for osc3
    const gain3 = context.createGain();
    gain3.gain.setValueAtTime(0, now);
    gain3.gain.linearRampToValueAtTime(0.05, now + 0.005);
    gain3.gain.exponentialRampToValueAtTime(0.02, now + 0.06);

    // Master gain
    const masterGain = context.createGain();
    masterGain.gain.setValueAtTime(1, now);

    // Connect everything
    osc1.connect(gain1);
    osc2.connect(gain2);
    osc3.connect(gain3);

    gain1.connect(filter);
    gain2.connect(filter);
    gain3.connect(filter);

    filter.connect(masterGain);
    masterGain.connect(context.destination);

    // Start oscillators
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    oscillators.push(osc1, osc2, osc3);
    gainNodes.push(gain1, gain2, gain3);

    activeOscillatorsRef.current.set(midiNote, {
      oscillators,
      gainNodes,
      masterGain,
      filter,
      stopTimeout: null
    });
  };

  const stopNote = (midiNote) => {
    const note = activeOscillatorsRef.current.get(midiNote);
    if (!note) return;

    const { oscillators, masterGain, stopTimeout } = note;
    const context = audioContextRef.current;
    const now = context.currentTime;

    // Clear any existing timeout
    if (stopTimeout) {
      clearTimeout(stopTimeout);
    }

    // Fade out
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    const timeoutId = setTimeout(() => {
      oscillators.forEach((osc) => {
        try {
          osc.stop();
        } catch (e) {
          // Oscillator might already be stopped
        }
      });
      activeOscillatorsRef.current.delete(midiNote);
    }, 350);

    // Store timeout ID so we can clear it if note is retriggered
    note.stopTimeout = timeoutId;
  };

  const stopAllNotes = () => {
    const context = audioContextRef.current;
    if (!context) return;

    const now = context.currentTime;

    activeOscillatorsRef.current.forEach((note, midiNote) => {
      const { oscillators, masterGain, stopTimeout } = note;

      // Clear timeout
      if (stopTimeout) {
        clearTimeout(stopTimeout);
      }

      // Quick fade out
      try {
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      } catch (e) {
        // Ignore errors
      }

      // Stop oscillators
      setTimeout(() => {
        oscillators.forEach((osc) => {
          try {
            osc.stop();
          } catch (e) {
            // Already stopped
          }
        });
      }, 60);
    });

    activeOscillatorsRef.current.clear();
  };

  return { playNote, stopNote, stopAllNotes };
}
