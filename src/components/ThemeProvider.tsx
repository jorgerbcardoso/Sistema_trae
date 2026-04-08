import React, { createContext, useContext, ReactNode, useEffect } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Detectar tema baseado no navegador
  const [theme, setTheme] = React.useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      return isLight ? 'light' : 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const applyTheme = () => {
      const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      const currentTheme = isLight ? 'light' : 'dark';
      
      setTheme(currentTheme);
      
      if (currentTheme === 'light') {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
        document.documentElement.style.setProperty('color-scheme', 'light');
      } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        document.documentElement.style.setProperty('color-scheme', 'dark');
      }
    };
    
    applyTheme();
    
    // Ouvir mudanças no sistema operacional/navegador
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    mediaQuery.addEventListener('change', applyTheme);
    
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}