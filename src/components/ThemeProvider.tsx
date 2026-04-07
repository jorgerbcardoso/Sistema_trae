import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme] = useState<Theme>('dark'); // Força o tema escuro como único estado possível

  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;
      const body = window.document.body;
      
      // ✅ FORÇAR remoção de qualquer vestígio de tema claro
      root.classList.remove('light');
      body.classList.remove('light');
      
      // ✅ GARANTIR que o tema escuro esteja aplicado
      root.classList.add('dark');
      body.classList.add('dark');
      
      // ✅ SOBRESCREVER qualquer preferência no localStorage e sessionStorage
      localStorage.setItem('nativa-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('presto_theme', 'dark');
      sessionStorage.setItem('theme', 'dark');
      
      // ✅ FORÇAR atributos extras para compatibilidade total
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    };

    applyTheme();
    
    // ✅ Intervalo de segurança para garantir que nada mude (BRUTE FORCE)
    const interval = setInterval(applyTheme, 1000);
    
    // ✅ Observador para garantir que nada mude as classes no runtime
    const observer = new MutationObserver(() => {
      if (document.documentElement.classList.contains('light') || !document.documentElement.classList.contains('dark')) {
        applyTheme();
      }
    });
    
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

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