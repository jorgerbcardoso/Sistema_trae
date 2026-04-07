/**
 * ============================================
 * COMPONENTE - CustomTooltip
 * ============================================
 * Tooltip customizado para gráficos Recharts com suporte a tema escuro
 */

import React from 'react';

export function useTooltipStyle() {
  // ✅ TEMA ÚNICO: SEMPRE ESCURO
  return {
    backgroundColor: '#1e293b',
    border: `1px solid #475569`,
    borderRadius: '8px',
    color: '#f1f5f9'
  };
}
