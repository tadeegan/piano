import React from 'react';
import './Piano.css';

const Piano = ({ activeNotes, onNoteOn, onNoteOff, onLayout }) => {
  const octaves = 7;
  const startNote = 21;
  const [isMouseDown, setIsMouseDown] = React.useState(false);
  const pianoRef = React.useRef(null);
  const [keyWidth, setKeyWidth] = React.useState(30);

  React.useEffect(() => {
    const updateKeyWidth = () => {
      if (pianoRef.current) {
        const containerWidth = pianoRef.current.offsetWidth - 40; // minus padding
        const totalWhiteKeys = 52; // 7 octaves * 7 white keys + 3
        const calculatedWidth = containerWidth / totalWhiteKeys;
        setKeyWidth(calculatedWidth);
      }
    };

    updateKeyWidth();
    window.addEventListener('resize', updateKeyWidth);
    return () => window.removeEventListener('resize', updateKeyWidth);
  }, []);

  // Report layout to parent for timeline alignment
  React.useEffect(() => {
    if (onLayout && pianoRef.current) {
      // Piano has 20px padding on each side (from CSS)
      onLayout({ keyWidth, pianoLeftPadding: 20 });
    }
  }, [keyWidth, onLayout]);

  const isBlackKey = (note) => {
    const noteInOctave = note % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
  };

  const getNotePosition = (note) => {
    // For black keys, find the white key position to the left
    // For white keys, count white keys from start
    let whiteKeyCount = 0;

    if (isBlackKey(note)) {
      // Find the white key just before this black key
      for (let n = startNote; n < note; n++) {
        if (!isBlackKey(n)) {
          whiteKeyCount++;
        }
      }
      // Return the position of the last white key (the one to the left of this black key)
      return whiteKeyCount - 1;
    } else {
      // For white keys, count all white keys before this one
      for (let n = startNote; n < note; n++) {
        if (!isBlackKey(n)) {
          whiteKeyCount++;
        }
      }
      return whiteKeyCount;
    }
  };

  const getNoteName = (note) => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteInOctave = note % 12;
    const octave = Math.floor((note - 12) / 12);
    return `${names[noteInOctave]}${octave}`;
  };

  const handleMouseDown = (note) => {
    setIsMouseDown(true);
    // Add slight random variation to velocity (85-105) for more natural feel
    const velocity = 85 + Math.floor(Math.random() * 20);
    onNoteOn(note, velocity);
  };

  const handleMouseUp = (note) => {
    setIsMouseDown(false);
    onNoteOff(note);
  };

  const handleMouseEnter = (note) => {
    if (isMouseDown) {
      // Slightly lower velocity for drag (70-90) to feel different from direct clicks
      const velocity = 70 + Math.floor(Math.random() * 20);
      onNoteOn(note, velocity);
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
            style={{
              left: `${getNotePosition(note) * keyWidth}px`,
              width: `${keyWidth}px`
            }}
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
        const position = getNotePosition(note) * keyWidth;
        keys.push(
          <div
            key={`black-${note}`}
            className={`piano-key black-key ${isActive ? 'active' : ''}`}
            style={{
              left: `${position + (keyWidth * 0.67)}px`,
              width: `${keyWidth * 0.67}px`
            }}
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
      <div className="piano" ref={pianoRef}>
        {renderKeys()}
      </div>
    </div>
  );
};

export default Piano;
