import { useState, useCallback } from 'react';
import { useMidi } from './hooks/useMidi';
import { useAudio } from './hooks/useAudio';
import { useKeyboard } from './hooks/useKeyboard';
import Piano from './components/Piano';
import Toggle from './components/Toggle';
import './App.css';

function App() {
  const { playNote, stopNote, stopAllNotes } = useAudio();
  const [keyboardEnabled, setKeyboardEnabled] = useState(false);
  const [manualActiveNotes, setManualActiveNotes] = useState(new Set());

  const handlePanic = useCallback(() => {
    stopAllNotes();
    setManualActiveNotes(new Set());
  }, [stopAllNotes]);

  const handleMidiNoteOn = useCallback((note, velocity) => {
    playNote(note);
  }, [playNote]);

  const handleMidiNoteOff = useCallback((note) => {
    stopNote(note);
  }, [stopNote]);

  const { activeNotes: midiActiveNotes, midiStatus, error } = useMidi(
    handleMidiNoteOn,
    handleMidiNoteOff
  );

  const handleNoteOn = useCallback((note) => {
    playNote(note);
    setManualActiveNotes((prev) => new Set([...prev, note]));
  }, [playNote]);

  const handleNoteOff = useCallback((note) => {
    stopNote(note);
    setManualActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, [stopNote]);

  useKeyboard(keyboardEnabled, handleNoteOn, handleNoteOff);

  // Combine MIDI notes and manually played notes
  const allActiveNotes = new Set([...midiActiveNotes, ...manualActiveNotes]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Web MIDI Piano</h1>

        <div className="controls-container">
          <div className={`status-indicator ${midiStatus}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {midiStatus === 'connected' && 'MIDI Connected'}
              {midiStatus === 'disconnected' && 'Connecting to MIDI...'}
              {midiStatus === 'unsupported' && 'MIDI Not Supported'}
              {midiStatus === 'error' && 'MIDI Error'}
            </span>
          </div>

          <Toggle
            enabled={keyboardEnabled}
            onChange={setKeyboardEnabled}
            label="Keyboard Mode"
          />

          <button className="panic-button" onClick={handlePanic} title="Stop all stuck notes">
            Panic (Stop All)
          </button>
        </div>

        {error && <p className="error-message">{error}</p>}

        <p className="instructions">
          {keyboardEnabled
            ? 'Use your computer keyboard to play! (Q-] for upper octave, Z-/ for lower octave)'
            : 'Click piano keys to play, or enable keyboard mode above'}
        </p>

        <div className="active-notes-display">
          Active Notes: {allActiveNotes.size > 0 ? allActiveNotes.size : 'None'}
        </div>
      </header>

      <Piano
        activeNotes={allActiveNotes}
        onNoteOn={handleNoteOn}
        onNoteOff={handleNoteOff}
      />
    </div>
  );
}

export default App;
