import React from 'react';
import './Toggle.css';

const Toggle = ({ enabled, onChange, label }) => {
  return (
    <label className="toggle-container">
      <span className="toggle-label">{label}</span>
      <div className="toggle-switch">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle-slider"></span>
      </div>
    </label>
  );
};

export default Toggle;
