import React, { useState, useCallback } from 'react';
import { useMetronome } from '../hooks/useMetronome';
import { usePersistentState } from '../hooks/usePersistentState';
import './Metronome.css';

const Metronome = () => {
  const [persistentState, updatePersistentState] = usePersistentState();
  const { metronomeBpm = 120, metronomeBeats = 4 } = persistentState;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(null);

  const { start, stop, updateTempo, updateTimeSignature } = useMetronome();

  const handleBpmChange = useCallback((value) => {
    const newBpm = Math.max(30, Math.min(300, parseInt(value) || 120));
    updatePersistentState({ metronomeBpm: newBpm });
    if (isPlaying) {
      updateTempo(newBpm);
    }
  }, [isPlaying, updateTempo, updatePersistentState]);

  const handleBeatsChange = useCallback((value) => {
    const newBeats = Math.max(1, Math.min(12, parseInt(value) || 4));
    updatePersistentState({ metronomeBeats: newBeats });
    if (isPlaying) {
      updateTimeSignature(newBeats);
    }
  }, [isPlaying, updateTimeSignature, updatePersistentState]);

  const handlePlayStop = useCallback(() => {
    if (isPlaying) {
      stop();
      setIsPlaying(false);
      setCurrentBeat(null);
    } else {
      start(metronomeBpm, metronomeBeats, setCurrentBeat);
      setIsPlaying(true);
    }
  }, [isPlaying, metronomeBpm, metronomeBeats, start, stop]);

  const handleTap = useCallback(() => {
    // Future enhancement: tap tempo
  }, []);

  return (
    <div className="metronome">
      <div className="metronome-controls">
          <div className="metronome-display">
            <div className="beat-indicators">
              {Array.from({ length: metronomeBeats }, (_, i) => (
                <div
                  key={i}
                  className={`beat-indicator ${
                    currentBeat === i ? 'active' : ''
                  } ${i === 0 ? 'accent' : ''}`}
                />
              ))}
            </div>
          </div>

          <div className="control-group">
            <label className="control-label">
              <span>BPM</span>
              <div className="control-input-group">
                <input
                  type="range"
                  min="30"
                  max="300"
                  value={metronomeBpm}
                  onChange={(e) => handleBpmChange(e.target.value)}
                  className="slider"
                />
                <input
                  type="number"
                  min="30"
                  max="300"
                  value={metronomeBpm}
                  onChange={(e) => handleBpmChange(e.target.value)}
                  className="number-input"
                />
              </div>
            </label>
          </div>

          <div className="control-group">
            <label className="control-label">
              <span>Beats per Measure</span>
              <div className="control-input-group">
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={metronomeBeats}
                  onChange={(e) => handleBeatsChange(e.target.value)}
                  className="slider"
                />
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={metronomeBeats}
                  onChange={(e) => handleBeatsChange(e.target.value)}
                  className="number-input"
                />
              </div>
            </label>
          </div>

          <div className="metronome-actions">
            <button
              className={`metronome-button ${isPlaying ? 'stop' : 'start'}`}
              onClick={handlePlayStop}
            >
              {isPlaying ? '⏸ Stop' : '▶ Start'}
            </button>
          </div>
        </div>
    </div>
  );
};

export default Metronome;
