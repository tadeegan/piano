import React from 'react';
import './Piano.css';

const Piano = ({ activeNotes, onNoteOn, onNoteOff }) => {
  const octaves = 7;
  const startNote = 21;
  const [isMouseDown, setIsMouseDown] = React.useState(false);

  const isBlackKey = (note) => {
    const noteInOctave = note % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
  };

  const getNotePosition = (note) => {
    const noteInOctave = note % 12;
    const octave = Math.floor((note - startNote) / 12);
    const whiteKeyPositions = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
    return octave * 7 + whiteKeyPositions[noteInOctave];
  };

  const getNoteName = (note) => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteInOctave = note % 12;
    const octave = Math.floor((note - 12) / 12);
    return `${names[noteInOctave]}${octave}`;
  };

  const handleMouseDown = (note) => {
    setIsMouseDown(true);
    onNoteOn(note);
  };

  const handleMouseUp = (note) => {
    setIsMouseDown(false);
    onNoteOff(note);
  };

  const handleMouseEnter = (note) => {
    if (isMouseDown) {
      onNoteOn(note);
    }
  };

  const handleMouseLeave = (note) => {
    if (isMouseDown) {
      onNoteOff(note);
    }
  };

  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsMouseDown(false);
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const renderKeys = () => {
    const keys = [];
    const totalKeys = octaves * 12 + 3;

    for (let i = 0; i < totalKeys; i++) {
      const note = startNote + i;
      const isActive = activeNotes.has(note);

      if (!isBlackKey(note)) {
        keys.push(
          <div
            key={`white-${note}`}
            className={`piano-key white-key ${isActive ? 'active' : ''}`}
            style={{ left: `${getNotePosition(note) * 30}px` }}
            title={getNoteName(note)}
            onMouseDown={() => handleMouseDown(note)}
            onMouseUp={() => handleMouseUp(note)}
            onMouseEnter={() => handleMouseEnter(note)}
            onMouseLeave={() => handleMouseLeave(note)}
          >
            <span className="note-label">{getNoteName(note)}</span>
          </div>
        );
      }
    }

    for (let i = 0; i < totalKeys; i++) {
      const note = startNote + i;
      const isActive = activeNotes.has(note);

      if (isBlackKey(note)) {
        const position = getNotePosition(note) * 30;
        keys.push(
          <div
            key={`black-${note}`}
            className={`piano-key black-key ${isActive ? 'active' : ''}`}
            style={{ left: `${position + 20}px` }}
            title={getNoteName(note)}
            onMouseDown={() => handleMouseDown(note)}
            onMouseUp={() => handleMouseUp(note)}
            onMouseEnter={() => handleMouseEnter(note)}
            onMouseLeave={() => handleMouseLeave(note)}
          />
        );
      }
    }

    return keys;
  };

  return (
    <div className="piano-container">
      <div className="piano">
        {renderKeys()}
      </div>
    </div>
  );
};

export default Piano;
