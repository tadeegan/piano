import { useState, useEffect, useRef } from 'react';

export function useMidi(onNoteOn, onNoteOff) {
  const [midiAccess, setMidiAccess] = useState(null);
  const [activeNotes, setActiveNotes] = useState(new Set());
  const [midiStatus, setMidiStatus] = useState('disconnected');
  const [error, setError] = useState(null);

  // Use refs to avoid recreating MIDI handlers when callbacks change
  const onNoteOnRef = useRef(onNoteOn);
  const onNoteOffRef = useRef(onNoteOff);

  useEffect(() => {
    onNoteOnRef.current = onNoteOn;
    onNoteOffRef.current = onNoteOff;
  }, [onNoteOn, onNoteOff]);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      setError('Web MIDI API is not supported in this browser');
      setMidiStatus('unsupported');
      return;
    }

    const handleMidiMessage = (event) => {
      const [status, note, velocity] = event.data;

      // Extract command (top 4 bits) and channel (bottom 4 bits)
      const command = status & 0xF0;
      const channel = status & 0x0F;

      // Handle Note On (0x90) - but velocity 0 means Note Off
      if (command === 0x90) {
        if (velocity > 0) {
          // Actual note on
          setActiveNotes((prev) => {
            const next = new Set(prev);
            next.add(note);
            return next;
          });
          if (onNoteOnRef.current) {
            onNoteOnRef.current(note, velocity);
          }
        } else {
          // Note on with velocity 0 = note off
          setActiveNotes((prev) => {
            const next = new Set(prev);
            next.delete(note);
            return next;
          });
          if (onNoteOffRef.current) {
            onNoteOffRef.current(note);
          }
        }
      }
      // Handle Note Off (0x80)
      else if (command === 0x80) {
        setActiveNotes((prev) => {
          const next = new Set(prev);
          next.delete(note);
          return next;
        });
        if (onNoteOffRef.current) {
          onNoteOffRef.current(note);
        }
      }
    };

    navigator.requestMIDIAccess()
      .then((access) => {
        setMidiAccess(access);
        setMidiStatus('connected');
        setError(null);

        // Attach handler to all existing inputs
        access.inputs.forEach((input) => {
          input.onmidimessage = handleMidiMessage;
        });

        // Handle hot-plugging of MIDI devices
        access.onstatechange = (e) => {
          if (e.port.type === 'input') {
            if (e.port.state === 'connected') {
              e.port.onmidimessage = handleMidiMessage;
            }
          }
        };
      })
      .catch((err) => {
        setError(`Failed to get MIDI access: ${err.message}`);
        setMidiStatus('error');
      });

    // Cleanup function
    return () => {
      if (midiAccess) {
        midiAccess.inputs.forEach((input) => {
          input.onmidimessage = null;
        });
      }
    };
  }, []);

  return {
    midiAccess,
    activeNotes,
    midiStatus,
    error,
  };
}
