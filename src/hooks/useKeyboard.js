import { useEffect, useRef } from 'react';

export function useKeyboard(enabled, onNoteOn, onNoteOff) {
  const pressedKeysRef = useRef(new Set());

  // Map keyboard keys to MIDI notes
  // Starting from C4 (MIDI 60)
  const keyMap = {
    // Lower row - C4 to B4
    'z': 60, 's': 61, 'x': 62, 'd': 63, 'c': 64,
    'v': 65, 'g': 66, 'b': 67, 'h': 68, 'n': 69, 'j': 70, 'm': 71,
    ',': 72, 'l': 73, '.': 74, ';': 75, '/': 76,

    // Upper row - C5 to B5
    'q': 72, '2': 73, 'w': 74, '3': 75, 'e': 76,
    'r': 77, '5': 78, 't': 79, '6': 80, 'y': 81, '7': 82, 'u': 83,
    'i': 84, '9': 85, 'o': 86, '0': 87, 'p': 88,
    '[': 89, '=': 90, ']': 91,
  };

  useEffect(() => {
    if (!enabled) {
      // Release all pressed keys when disabled
      pressedKeysRef.current.forEach((note) => {
        onNoteOff(note);
      });
      pressedKeysRef.current.clear();
      return;
    }

    const handleKeyDown = (e) => {
      // Prevent handling if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Ignore repeated keydown events from holding the key
      if (e.repeat) {
        e.preventDefault();
        return;
      }

      const key = e.key.toLowerCase();
      const midiNote = keyMap[key];

      if (midiNote !== undefined && !pressedKeysRef.current.has(key)) {
        pressedKeysRef.current.add(key);
        // Keyboard presses use a fixed medium-high velocity (95)
        onNoteOn(midiNote, 95);
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      const midiNote = keyMap[key];

      if (midiNote !== undefined && pressedKeysRef.current.has(key)) {
        pressedKeysRef.current.delete(key);
        onNoteOff(midiNote);
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      // Clean up any pressed keys
      pressedKeysRef.current.forEach((note) => {
        const midiNote = keyMap[note];
        if (midiNote !== undefined) {
          onNoteOff(midiNote);
        }
      });
      pressedKeysRef.current.clear();
    };
  }, [enabled, onNoteOn, onNoteOff]);

  return keyMap;
}
