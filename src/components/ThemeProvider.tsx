import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme] = useState<Theme>('dark'); // Força o tema escuro

  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    
    // ✅ FORÇAR aplicação do tema em múltiplos elementos para garantir compatibilidade
    root.classList.remove('light', 'dark');
    body.classList.remove('light', 'dark');
    
    root.classList.add(theme);
    body.classList.add(theme);
    
    // ✅ FORÇAR atributo data-theme para compatibilidade extra
    root.setAttribute('data-theme', theme);
    
    // localStorage.setItem('nativa-theme', theme); // Não é mais necessário salvar o tema
  }, [theme]);

  // const toggleTheme = () => { // Função de toggle removida
  //   setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  // };

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