import React, { createContext, useContext, ReactNode } from 'react';
import { cyberpunkTheme, Theme } from '../theme/cyberpunk';

interface ThemeContextType {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const CyberpunkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ThemeContext.Provider value={{ theme: cyberpunkTheme }}>
      <div className="cyberpunk-root">{children}</div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within CyberpunkProvider');
  }
  return context;
};
