import { useCallback, useMemo, useState, useEffect } from 'react';
import { Chord } from 'tonal';
import { useMidi } from './hooks/useMidi';
import { useKeyboard } from './hooks/useKeyboard';
import { usePersistentState } from './hooks/usePersistentState';
import { useActiveNotes, useSources, useTimeline, useTimeOrigin, useAudioState } from './hooks/useEngine';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import engine, { INSTRUMENTS } from './engine';
import multiplayer from './multiplayer';
import { useMultiplayer } from './hooks/useMultiplayer';
import Piano from './components/Piano';
import Toggle from './components/Toggle';
import InstrumentSelector from './components/InstrumentSelector';
import Metronome from './components/Metronome';
import AiChat from './components/AiChat';
import Timeline from './components/Timeline';
import TranscriptPanel from './components/TranscriptPanel';
import RoomPanel from './components/RoomPanel';
import './App.css';

const handleNoteOn = (note, velocity = 90) => {
  engine.noteOn(note, velocity, 'user');
  multiplayer.broadcast({ t: 'on', m: note, v: velocity });
};
const handleNoteOff = (note) => {
  engine.noteOff(note, 'user');
  multiplayer.broadcast({ t: 'off', m: note });
};
const handlePanic = () => engine.panic();

function App() {
  const [persistentState, updatePersistentState] = usePersistentState();
  const { instrumentType, keyboardEnabled } = persistentState;
  const [pianoLayout, setPianoLayout] = useState({ keyWidth: 30, pianoLeftPadding: 20 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const speech = useSpeechRecognition();

  // Toggle debug transcript panel with Ctrl+Shift+T
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setShowTranscript((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { engine.setInstrument(instrumentType); }, [instrumentType]);

  // Sync BPM / time signature from persistent state to engine
  const { metronomeBpm = 120, metronomeBeats = 4 } = persistentState;
  useEffect(() => { engine.setBpm(metronomeBpm); }, [metronomeBpm]);
  useEffect(() => { engine.setBeatsPerMeasure(metronomeBeats); }, [metronomeBeats]);

  const audioState = useAudioState();
  const activeNotes = useActiveNotes();
  const sources = useSources();
  const { status: mpStatus, isHost: mpIsHost } = useMultiplayer();
  const showAiChat = mpStatus === 'disconnected' || mpIsHost;
  const { events: timelineEvents, heldNotes, breaks, segments, inBreak, bpm: engineBpm, beatsPerMeasure: engineBeats } = useTimeline();
  const timeOrigin = useTimeOrigin();

  useMidi(handleNoteOn, handleNoteOff);
  useKeyboard(keyboardEnabled, handleNoteOn, handleNoteOff);

  const midiToNoteName = (midiNote) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor((midiNote - 12) / 12);
    return `${noteNames[midiNote % 12]}${octave}`;
  };

  const detectedChord = useMemo(() => {
    if (activeNotes.size === 0) return 'None';
    const keys = [...activeNotes.keys()];
    if (keys.length === 1) return midiToNoteName(keys[0]);
    const names = keys.map(midiToNoteName);
    const chord = Chord.detect(names);
    if (chord.length > 0) return chord.join(' / ');
    return names.join(', ');
  }, [activeNotes]);

  const handlePianoLayout = useCallback((layout) => setPianoLayout(layout), []);
  const recorderRef = { current: { getAndClear: engine.getAndClearRecording } };

  return (
    <div className="flex h-screen overflow-hidden bg-[#15171c]">
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden app-bg relative">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 shrink-0 border-b border-[#2a2d35] bg-[#1a1c22]/80 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex flex-col justify-center items-center w-8 h-8 gap-[5px] cursor-pointer"
              title="Controls"
            >
              <span className={`block w-5 h-[2px] bg-gray-400 transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
              <span className={`block w-5 h-[2px] bg-gray-400 transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-[2px] bg-gray-400 transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
            </button>
            <span className="text-sm font-bold tracking-widest uppercase text-gray-400">Web MIDI Piano</span>
            <RoomPanel />
          </div>

          <div className="flex items-center gap-4">
            {/* Audio state indicator — clicking anywhere triggers initAndResume via window listeners */}
            {audioState !== 'running' && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded border text-yellow-400 border-yellow-400/30 bg-yellow-400/10 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                {audioState === 'uninitialized' ? 'Click anywhere to enable audio' : 'Audio suspended — click anywhere'}
              </span>
            )}
            {/* Chord display */}
            <span className="text-sm font-bold tracking-wide text-orange-400">{detectedChord}</span>
            {/* Dynamic source legend */}
            {[...sources.entries()].map(([id, info]) => (
              <span key={id} className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase text-gray-500">
                <span className="inline-block w-2.5 h-1.5 rounded-sm" style={{ backgroundColor: info.color }} /> {info.name}
              </span>
            ))}
          </div>
        </div>

        {/* Dropdown menu panel */}
        {menuOpen && (
          <div className="absolute top-[44px] left-0 right-0 z-30 bg-[#1a1c22] border-b-2 border-[#2a2d35] shadow-[0_8px_24px_rgba(0,0,0,0.6)] p-5 animate-slideDown">
            <div className="controls-container">
              <InstrumentSelector
                instruments={INSTRUMENTS}
                selected={instrumentType}
                onChange={(value) => updatePersistentState({ instrumentType: value })}
              />
              <Toggle
                enabled={keyboardEnabled}
                onChange={(value) => updatePersistentState({ keyboardEnabled: value })}
                label="Keyboard Mode"
              />
              <button className="panic-button" onClick={handlePanic} title="Stop all stuck notes">
                Panic (Stop All)
              </button>
            </div>
            <p className="instructions">
              {keyboardEnabled
                ? 'Use your computer keyboard to play! (Q-] for upper octave, Z-/ for lower octave)'
                : 'Click piano keys to play, or enable keyboard mode above'}
            </p>
            <Metronome />
          </div>
        )}

        {/* Click outside to close menu */}
        {menuOpen && (
          <div className="absolute inset-0 z-10" onClick={() => setMenuOpen(false)} />
        )}

        {/* Timeline + Piano fill remaining space */}
        <Timeline
          events={timelineEvents}
          heldNotes={heldNotes}
          breaks={breaks}
          segments={segments}
          inBreak={inBreak}
          bpm={engineBpm}
          beatsPerMeasure={engineBeats}
          keyWidth={pianoLayout.keyWidth}
          pianoLeftPadding={pianoLayout.pianoLeftPadding}
          timeOrigin={timeOrigin}
          sources={sources}
        />

        <Piano
          activeNotes={activeNotes}
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
          onLayout={handlePianoLayout}
        />
      </div>

      {showAiChat && (
        <div className="w-[340px] shrink-0 border-l-2 border-[#2a2d35] flex flex-col h-screen">
          <AiChat noteRecorder={recorderRef} onPlaySequence={(notes) => {
            engine.playSequence(notes);
            // Broadcast AI notes to peers
            if (notes && notes.length > 0) {
              notes.forEach(n => {
                setTimeout(() => {
                  multiplayer.broadcast({ t: 'on', m: n.midi, v: n.velocity, s: 'ai' });
                  setTimeout(() => {
                    multiplayer.broadcast({ t: 'off', m: n.midi, s: 'ai' });
                  }, n.duration);
                }, n.startTime);
              });
            }
          }} speech={speech} bpm={metronomeBpm} beatsPerMeasure={metronomeBeats} />
        </div>
      )}
      <TranscriptPanel transcript={speech.transcript} listening={speech.listening} visible={showTranscript} />
    </div>
  );
}

export default App;
