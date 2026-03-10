import React, { useState, useCallback } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import './ControlPanel.css';

const ControlPanel = ({ children }) => {
  const [persistentState, updatePersistentState] = usePersistentState();
  const { controlPanelExpanded = false } = persistentState;
  const [isExpanded, setIsExpanded] = useState(controlPanelExpanded);

  const handleToggle = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    updatePersistentState({ controlPanelExpanded: newExpanded });
  }, [isExpanded, updatePersistentState]);

  return (
    <div className={`control-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <button className="control-panel-toggle" onClick={handleToggle}>
        <span className="toggle-icon">{isExpanded ? '▲' : '▼'}</span>
        <span className="toggle-text">Controls</span>
        <span className="toggle-icon">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="control-panel-content">
          {children}
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
