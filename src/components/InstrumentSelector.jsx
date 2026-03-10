import React from 'react';
import './InstrumentSelector.css';

const InstrumentSelector = ({ instruments, selected, onChange }) => {
  return (
    <div className="instrument-selector-container">
      <label htmlFor="instrument-select" className="instrument-label">
        Instrument:
      </label>
      <select
        id="instrument-select"
        className="instrument-select"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        {Object.entries(instruments).map(([key, config]) => (
          <option key={key} value={key}>
            {config.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default InstrumentSelector;
