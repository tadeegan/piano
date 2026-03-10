/**
 * Core piano engine — plain JS, no React.
 * Owns: AudioContext, MIDI, keyboard input, note recording, timeline events.
 * React subscribes via listeners.
 */

// ─── Instrument configs ───────────────────────────────────────────
const INSTRUMENTS = {
  piano: {
    name: 'Piano',
    oscillators: [
      { type: 'triangle', detune: 0, gain: 0.2, decay: 0.08 },
      { type: 'sine', detune: 0, frequency: 2, gain: 0.1, decay: 0.04 },
      { type: 'sine', detune: 0, frequency: 3, gain: 0.06, decay: 0.02 },
      { type: 'sine', detune: 0, frequency: 4, gain: 0.04, decay: 0.01 }
    ],
    filter: { type: 'lowpass', frequency: 3500, q: 0.8 },
    attack: 0.001, release: 0.8
  },
  epiano: {
    name: 'Electric Piano',
    oscillators: [
      { type: 'triangle', detune: 0, gain: 0.15, decay: 0.08 },
      { type: 'sine', detune: 0, frequency: 2, gain: 0.05, decay: 0.03 },
      { type: 'sine', detune: 0, frequency: 3, gain: 0.025, decay: 0.01 }
    ],
    filter: { type: 'lowpass', frequency: 5000, q: 1 },
    attack: 0.005, release: 0.3
  },
  organ: {
    name: 'Organ',
    oscillators: [
      { type: 'sine', detune: 0, gain: 0.12 },
      { type: 'sine', detune: 0, frequency: 2, gain: 0.1 },
      { type: 'sine', detune: 0, frequency: 3, gain: 0.08 },
      { type: 'sine', detune: 0, frequency: 4, gain: 0.05 }
    ],
    filter: { type: 'lowpass', frequency: 4000, q: 0.5 },
    attack: 0.01, release: 0.1
  },
  synth: {
    name: 'Synth Lead',
    oscillators: [
      { type: 'sawtooth', detune: 0, gain: 0.1 },
      { type: 'sawtooth', detune: -10, gain: 0.1 },
      { type: 'square', detune: 0, frequency: 2, gain: 0.05 }
    ],
    filter: { type: 'lowpass', frequency: 3500, q: 5 },
    attack: 0.02, release: 0.2
  },
  pad: {
    name: 'Soft Pad',
    oscillators: [
      { type: 'sine', detune: 0, gain: 0.08 },
      { type: 'sine', detune: 5, gain: 0.08 },
      { type: 'sine', detune: -5, gain: 0.08 },
      { type: 'triangle', detune: 0, frequency: 2, gain: 0.04 }
    ],
    filter: { type: 'lowpass', frequency: 2500, q: 1 },
    attack: 0.1, release: 0.5
  },
  bell: {
    name: 'Bright Bell',
    oscillators: [
      { type: 'sine', detune: 0, gain: 0.15 },
      { type: 'sine', detune: 0, frequency: 3.5, gain: 0.1 },
      { type: 'sine', detune: 0, frequency: 5, gain: 0.08 },
      { type: 'sine', detune: 0, frequency: 7, gain: 0.05 }
    ],
    filter: { type: 'lowpass', frequency: 5000, q: 2 },
    attack: 0.001, release: 0.8
  }
};

function getEqualLoudnessGain(frequency) {
  if (frequency >= 440) return 1.0;
  if (frequency >= 220) return 1.15;
  if (frequency >= 110) return 1.35;
  if (frequency >= 55) return 1.6;
  return 1.9;
}

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ─── Engine singleton ─────────────────────────────────────────────
function createEngine() {
  // --- Audio ---
  let audioCtx = null;
  let masterGain = null;
  const activeOscillators = new Map();
  let instrumentType = 'piano';

  // --- Audio state subscription ---
  let audioState = 'uninitialized'; // 'uninitialized' | 'suspended' | 'running'
  const audioStateListeners = new Set();

  function setAudioState(s) {
    if (s !== audioState) {
      audioState = s;
      audioStateListeners.forEach(fn => fn(s));
    }
  }

  function onAudioStateChange(fn) {
    audioStateListeners.add(fn);
    return () => audioStateListeners.delete(fn);
  }

  function getAudioState() { return audioState; }

  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    setAudioState(audioCtx.state === 'running' ? 'running' : 'suspended');

    // Listen for state changes on the context itself
    audioCtx.onstatechange = () => {
      setAudioState(audioCtx.state === 'running' ? 'running' : 'suspended');
    };

    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-18, audioCtx.currentTime);
    compressor.knee.setValueAtTime(30, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(6, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.005, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.55, audioCtx.currentTime);
    masterGain.connect(compressor);
    compressor.connect(audioCtx.destination);
  }

  // Init audio + resume on ANY user interaction — registered at engine creation
  function initAndResume() {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }
  window.addEventListener('pointerdown', initAndResume, { capture: true });
  window.addEventListener('keydown', initAndResume, { capture: true });
  // Also try mousedown and touchstart for broader coverage
  window.addEventListener('mousedown', initAndResume, { capture: true });
  window.addEventListener('touchstart', initAndResume, { capture: true });

  function setInstrument(type) {
    instrumentType = type;
  }

  function playNoteAudio(midiNote, velocity = 100) {
    initAudio();
    if (!audioCtx || !masterGain) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // Kill existing
    if (activeOscillators.has(midiNote)) {
      const old = activeOscillators.get(midiNote);
      if (old.stopTimeout) clearTimeout(old.stopTimeout);
      old.oscillators.forEach(o => { try { o.stop(); } catch {} });
      activeOscillators.delete(midiNote);
    }

    const now = audioCtx.currentTime;
    const frequency = midiToFrequency(midiNote);
    const instrument = INSTRUMENTS[instrumentType];

    const velNorm = Math.max(1, Math.min(127, velocity)) / 127;
    const velGain = 0.08 + velNorm * velNorm * 1.42;
    const loudGain = getEqualLoudnessGain(frequency);

    const oscillators = [];
    const gainNodes = [];

    instrument.oscillators.forEach(cfg => {
      const osc = audioCtx.createOscillator();
      osc.type = cfg.type;
      osc.frequency.setValueAtTime(frequency * (cfg.frequency || 1), now);
      if (cfg.detune) osc.detune.setValueAtTime(cfg.detune, now);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0, now);
      const target = cfg.gain * velGain * loudGain;
      gain.gain.linearRampToValueAtTime(target, now + instrument.attack);
      if (cfg.decay !== undefined) {
        gain.gain.exponentialRampToValueAtTime(
          cfg.decay * velGain * loudGain,
          now + instrument.attack + 0.1
        );
      }
      osc.connect(gain);
      oscillators.push(osc);
      gainNodes.push(gain);
    });

    const filter = audioCtx.createBiquadFilter();
    filter.type = instrument.filter.type;
    const fvAmt = frequency < 200 ? 0.15 : 0.5;
    const fvMult = (1 - fvAmt) + velNorm * fvAmt;
    filter.frequency.setValueAtTime(instrument.filter.frequency * fvMult, now);
    filter.Q.setValueAtTime(instrument.filter.q, now);

    const noteGain = audioCtx.createGain();
    const polyGain = Math.min(1.0, Math.max(0.3, 1 / Math.sqrt(activeOscillators.size + 1)) * (frequency < 200 ? 1.3 : 1.0));
    noteGain.gain.setValueAtTime(polyGain, now);

    gainNodes.forEach(g => g.connect(filter));
    filter.connect(noteGain);
    noteGain.connect(masterGain);
    oscillators.forEach(o => o.start(now));

    activeOscillators.set(midiNote, { oscillators, gainNodes, noteGain, filter, stopTimeout: null });
  }

  function stopNoteAudio(midiNote) {
    const note = activeOscillators.get(midiNote);
    if (!note) return;
    const { oscillators, noteGain, stopTimeout } = note;
    const now = audioCtx.currentTime;
    const instrument = INSTRUMENTS[instrumentType];

    if (stopTimeout) clearTimeout(stopTimeout);
    noteGain.gain.setValueAtTime(noteGain.gain.value, now);
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + instrument.release);

    note.stopTimeout = setTimeout(() => {
      oscillators.forEach(o => { try { o.stop(); } catch {} });
      activeOscillators.delete(midiNote);
    }, instrument.release * 1000 + 50);
  }

  function stopAllAudio() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    activeOscillators.forEach(note => {
      if (note.stopTimeout) clearTimeout(note.stopTimeout);
      try {
        note.noteGain.gain.cancelScheduledValues(now);
        note.noteGain.gain.setValueAtTime(note.noteGain.gain.value, now);
        note.noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      } catch {}
      setTimeout(() => {
        note.oscillators.forEach(o => { try { o.stop(); } catch {} });
      }, 60);
    });
    activeOscillators.clear();
  }

  // --- Timeline ---
  let timeOrigin = null; // performance.now() when first note played
  let timelineEvents = []; // completed: { midi, velocity, duration, globalTime, source }
  const heldNotes = new Map(); // midi -> { globalTime, source }
  const timelineListeners = new Set();

  // --- Break detection ---
  const BREAK_THRESHOLD_MS = 2000;
  let breakTimer = null;
  let breaks = []; // { globalTime } — timestamps where breaks occurred
  let totalPauseTime = 0; // cumulative ms paused across all breaks
  let currentBreakStart = null; // globalTime when current break started, or null
  let prevBreakEventIndex = 0; // index into recorderNotes at the break before current
  let lastBreakEventIndex = 0; // index into recorderNotes at last break

  function getTime() {
    const now = performance.now();
    if (timeOrigin === null) timeOrigin = now;
    return Math.round(now - timeOrigin - totalPauseTime - (currentBreakStart !== null ? (now - timeOrigin - totalPauseTime - currentBreakStart) : 0));
  }

  // Effective elapsed for timeline rendering (accounts for pauses)
  function getEffectiveElapsed() {
    if (timeOrigin === null) return 0;
    const raw = performance.now() - timeOrigin;
    if (currentBreakStart !== null) {
      // Frozen: return time up to when break started
      return currentBreakStart;
    }
    return raw - totalPauseTime;
  }

  function getTimeOrigin() { return timeOrigin; }
  function getBreaks() { return breaks; }
  function isInBreak() { return currentBreakStart !== null; }
  function getTotalPauseTime() { return totalPauseTime; }

  function startBreak() {
    if (currentBreakStart !== null) return; // already in break
    const breakTime = performance.now() - timeOrigin - totalPauseTime;
    currentBreakStart = breakTime;
    breaks = [...breaks, { globalTime: breakTime }];
    // Mark recorder break point
    prevBreakEventIndex = lastBreakEventIndex;
    lastBreakEventIndex = recorderNotes.length;
    notifyTimeline();
  }

  function endBreak() {
    if (currentBreakStart === null) return;
    const raw = performance.now() - timeOrigin;
    const pauseDuration = raw - totalPauseTime - currentBreakStart;
    totalPauseTime += pauseDuration;
    currentBreakStart = null;
    notifyTimeline();
  }

  function scheduleBreakCheck() {
    if (breakTimer) clearTimeout(breakTimer);
    breakTimer = setTimeout(() => {
      // Only start break if no notes are currently held
      if (heldNotes.size === 0 && timeOrigin !== null) {
        startBreak();
      }
    }, BREAK_THRESHOLD_MS);
  }

  function cancelBreakCheck() {
    if (breakTimer) {
      clearTimeout(breakTimer);
      breakTimer = null;
    }
  }

  function notifyTimeline() {
    const snapshot = {
      events: timelineEvents,
      heldNotes: new Map(heldNotes),
      breaks,
      inBreak: currentBreakStart !== null,
      totalPauseTime,
      effectiveElapsed: getEffectiveElapsed(),
    };
    timelineListeners.forEach(fn => fn(snapshot));
  }

  function onTimelineChange(fn) {
    timelineListeners.add(fn);
    return () => timelineListeners.delete(fn);
  }

  // --- Note recorder (for AI chat) ---
  let recorderNotes = [];
  let recorderOrigin = null;
  const recorderActive = new Map(); // midi -> { startTime, velocity }

  function getAndClearRecording() {
    // If in a break, return the segment between previous break and current break
    // Otherwise, return notes since the last break
    const startIdx = currentBreakStart !== null ? prevBreakEventIndex : lastBreakEventIndex;
    const endIdx = currentBreakStart !== null ? lastBreakEventIndex : recorderNotes.length;
    const notes = recorderNotes.slice(startIdx, endIdx);
    // Re-base startTimes relative to the first note in this segment
    let rebasedNotes = notes;
    if (notes.length > 0) {
      const segmentOrigin = notes[0].startTime;
      rebasedNotes = notes.map(n => ({ ...n, startTime: n.startTime - segmentOrigin }));
    }
    recorderNotes = [];
    recorderOrigin = null;
    recorderActive.clear();
    prevBreakEventIndex = 0;
    lastBreakEventIndex = 0;
    return rebasedNotes;
  }

  // --- Active notes (for piano key highlighting) ---
  const activeNotes = new Set();
  const activeNotesListeners = new Set();

  function notifyActiveNotes() {
    const snapshot = new Set(activeNotes);
    activeNotesListeners.forEach(fn => fn(snapshot));
  }

  function onActiveNotesChange(fn) {
    activeNotesListeners.add(fn);
    return () => activeNotesListeners.delete(fn);
  }

  // --- Public noteOn / noteOff ---
  function noteOn(midi, velocity = 90, source = 'user') {
    playNoteAudio(midi, velocity);

    // End break if we're in one
    if (currentBreakStart !== null) endBreak();
    cancelBreakCheck();

    // Active notes
    activeNotes.add(midi);
    notifyActiveNotes();

    // Timeline — held
    const t = getTime();
    heldNotes.set(midi, { globalTime: t, source });
    notifyTimeline();

    // Recorder
    if (source === 'user') {
      const now = performance.now();
      if (recorderOrigin === null) recorderOrigin = now;
      recorderActive.set(midi, { startTime: now, velocity });
    }
  }

  function noteOff(midi, source = 'user') {
    stopNoteAudio(midi);

    // Active notes
    activeNotes.delete(midi);
    notifyActiveNotes();

    // Timeline — move from held to completed
    const held = heldNotes.get(midi);
    if (held) {
      heldNotes.delete(midi);
      const duration = Math.max(50, getTime() - held.globalTime);
      timelineEvents = [...timelineEvents, { midi, velocity: 90, duration, globalTime: held.globalTime, source: held.source }];
      notifyTimeline();
    }

    // Recorder
    if (source === 'user') {
      const active = recorderActive.get(midi);
      if (active) {
        recorderActive.delete(midi);
        const now = performance.now();
        recorderNotes.push({
          midi,
          velocity: active.velocity,
          duration: Math.max(50, Math.min(5000, Math.round(now - active.startTime))),
          startTime: Math.round(active.startTime - recorderOrigin),
        });
      }
    }

    // Schedule break check if no notes are held
    if (heldNotes.size === 0 && activeNotes.size === 0) {
      scheduleBreakCheck();
    }
  }

  function panic() {
    stopAllAudio();
    activeNotes.clear();
    heldNotes.clear();
    notifyActiveNotes();
    notifyTimeline();
  }

  // Play a sequence (from AI) — routes through noteOn/noteOff so timeline
  // and break detection work identically to user input.
  function playSequence(notes) {
    if (!notes || notes.length === 0) return;

    notes.forEach(n => {
      setTimeout(() => {
        noteOn(n.midi, n.velocity, 'ai');
        setTimeout(() => {
          noteOff(n.midi, 'ai');
        }, n.duration);
      }, n.startTime);
    });
  }

  return {
    // Audio
    setInstrument,
    panic,
    INSTRUMENTS,

    // Audio state
    onAudioStateChange,
    getAudioState,

    // Notes
    noteOn,
    noteOff,
    playSequence,

    // Timeline subscriptions
    onTimelineChange,
    getTimeOrigin,
    getEffectiveElapsed,

    // Active notes subscriptions
    onActiveNotesChange,

    // Recorder
    getAndClearRecording,
  };
}

// Singleton
const engine = createEngine();
export default engine;
export { INSTRUMENTS };
