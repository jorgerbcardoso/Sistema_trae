import React from 'react';
import { ENVIRONMENT } from '../config/environment';

const EnvironmentBadge: React.FC = () => {
  // Não mostrar em produção
  if (ENVIRONMENT.isProduction) {
    return null;
  }

  const getBadgeColor = () => {
    if (ENVIRONMENT.isFigmaMake) {
      return 'bg-purple-600 text-white';
    }
    return 'bg-yellow-600 text-white';
  };

  const getBadgeText = () => {
    if (ENVIRONMENT.isFigmaMake) {
      return '🎨 FIGMA MAKE (MOCK)';
    }
    return '🔧 DEV MODE (MOCK)';
  };

  return (
    <div className="fixed bottom-4 left-4 z-[9999] pointer-events-none">
      <div className={`${getBadgeColor()} px-3 py-1.5 rounded-full shadow-lg text-xs font-medium flex items-center gap-2`}>
        <span className="animate-pulse w-2 h-2 bg-white rounded-full"></span>
        {getBadgeText()}
      </div>
    </div>
  );
};

export default EnvironmentBadge;
