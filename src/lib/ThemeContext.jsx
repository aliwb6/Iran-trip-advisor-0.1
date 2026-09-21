import { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext();

const lightThemeValue = {
  theme: 'light',
  toggleTheme: () => {},
};

export function ThemeProvider({ children }) {
  useEffect(() => {
    localStorage.setItem('ita-theme', 'light');
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }, []);

  return (
    <ThemeContext.Provider value={lightThemeValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
