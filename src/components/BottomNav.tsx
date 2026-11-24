import React from 'react';
import { Icon } from './Icons';
import { AppView, SupportedLanguage } from '../types';
import { t } from '../services/translationService';

interface BottomNavProps {
  currentView: AppView;
  go: (view: AppView) => void;
  shortlistCount: number;
  currentLang: SupportedLanguage;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, go, shortlistCount, currentLang }) => {
  const tabs = [
    { id: 'dashboard', label: t('nav.roadmap', currentLang), icon: 'route' },
    { id: 'opportunities', label: t('nav.jobs', currentLang), icon: 'briefcase' },
    { id: 'training', label: t('nav.training', currentLang), icon: 'cap' },
    { id: 'saved', label: t('nav.saved', currentLang), icon: 'star', badge: shortlistCount },
    { id: 'profile', label: t('nav.profile', currentLang), icon: 'user' },
  ];

  return (
    <nav
      aria-label="App Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#DCE3EA] py-1.5 px-3"
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = currentView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => go(tab.id as AppView)}
              className={`min-h-[44px] flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors relative ${
                isActive ? 'text-[#245A91] font-bold' : 'text-[#5F6B76] hover:text-[#17365D]'
              }`}
            >
              <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-[#EBF3FB] text-[#245A91]' : 'text-[#5F6B76]'}`}>
                <Icon name={tab.icon} size={20} />
              </div>
              <span className="text-[10px] mt-0.5 font-bold tracking-tight">
                {tab.label}
              </span>
              {tab.badge && tab.badge > 0 ? (
                <span className="absolute top-0.5 right-1 w-4 h-4 bg-[#D9822B] text-white text-[9px] font-bold rounded-full flex items-center justify-center tabular-nums">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
