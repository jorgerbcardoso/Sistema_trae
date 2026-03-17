/**
 * ============================================
 * COMPONENTE - CustomTooltip
 * ============================================
 * Tooltip customizado para gráficos Recharts com suporte a tema escuro
 */

import React, { useEffect, useState } from 'react';

export function useTooltipStyle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Detectar tema inicial
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkTheme();

    // Observar mudanças no tema
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  return {
    backgroundColor: isDark ? '#1e293b' : '#fff',
    border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
    borderRadius: '8px',
    color: isDark ? '#f1f5f9' : '#0f172a'
  };
}
