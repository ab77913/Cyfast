// src/contexts/ProjectContext.jsx
import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';

const SelectedProjectContext = createContext();

export const SelectedProjectProvider = ({ children }) => {
  const [selectedProjectInContext, setSelectedProjectInContext] = useState(() => {
    const saved = localStorage.getItem('selectedProjectInContext');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    try {
      if (selectedProjectInContext) {
        localStorage.setItem('selectedProjectInContext', JSON.stringify(selectedProjectInContext));
      } else {
        localStorage.removeItem('selectedProjectInContext');
      }
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
  }, [selectedProjectInContext]);

  const value = useMemo(() => ({ selectedProjectInContext, setSelectedProjectInContext }), [selectedProjectInContext]);

  return <SelectedProjectContext.Provider value={value}>{children}</SelectedProjectContext.Provider>;
};

export const useSelectedProject = () => {
  const ctx = useContext(SelectedProjectContext);
  if (!ctx) throw new Error('useSelectedProject must be used within SelectedProjectProvider');
  return ctx;
};
