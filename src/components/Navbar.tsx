import React, { useState, useEffect } from 'react';
import { Logo } from './Logo';
import { Icon } from './Icons';
import { SupportedLanguage, AppView } from '../types';
import { LANG_CONFIG } from '../data/mockData';
import { AppUser, isAdminUser } from '../services/firebase';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface NavbarProps {
  currentView: AppView;
  currentLang: SupportedLanguage;
  currentUser: AppUser | null;
  profileName?: string;
  avatarUrl?: string;
  onLanguageChange: (lang: SupportedLanguage) => void;
  go: (view: AppView, sectionId?: string) => void;
  onLogout: () => void;
  onStartVoiceAssessment?: () => void;
  onOpenAdminLogin?: () => void;
  onOpenAccount?: (mode: 'create' | 'login') => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  currentLang,
  currentUser,
  profileName,
  avatarUrl,
  onLanguageChange,
  go,
  onLogout,
  onStartVoiceAssessment,
  onOpenAdminLogin,
  onOpenAccount,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);

  const { canInstall, isInstalled, promptInstall } = usePWAInstall();

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof window !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleNav = (v: AppView, s?: string) => {
    setMobileMenuOpen(false);
    setLangMenuOpen(false);
    go(v, s);
  };

  const isAdmin = isAdminUser(currentUser);
  const activeLangConfig = LANG_CONFIG.find((l) => l.k === currentLang) || LANG_CONFIG[0];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white">
      <div className="gov-tricolor-line" />

      {!isOnline && (
        <div className="bg-[#D9822B] text-white text-[11px] font-bold py-1 px-3 text-center flex items-center justify-center gap-1.5">
          <Icon name="wifiOff" size={13} className="text-white flex-shrink-0" />
          <span className="truncate">
            ऑफलाइन मोड: आप सहेजा हुआ डेटा देख रहे हैं (Offline — Viewing Cached Data)
          </span>
        </div>
      )}

      <div className="bg-white/95 backdrop-blur-md border-b border-[#DCE3EA]">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center flex-shrink-0">
            <Logo size={32} userName={profileName} avatarUrl={avatarUrl} onClick={() => handleNav('home')} />
          </div>

          <nav className="hidden lg:flex items-center gap-1 text-xs font-bold text-[#5F6B76]" aria-label="Main navigation">
            {[
              { id: 'home', label: 'Home' },
              { id: 'dashboard', label: 'Roadmap' },
              { id: 'opportunities', label: 'Jobs' },
              { id: 'training', label: 'Training Centers' },
              { id: 'skill-gap', label: 'Skill Gaps' },
              { id: 'saved', label: 'Saved' },
              { id: 'faq', label: 'Help & FAQ' },
              { id: 'about', label: 'About' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => handleNav(item.id as AppView)}
                className={`px-3 py-2 rounded-lg transition-colors hover:text-[#17365D] ${
                  currentView === item.id ? 'text-[#245A91] font-extrabold bg-[#F7F9FC]' : ''
                }`}
              >
                {item.label}
              </button>
            ))}

            {isAdmin && (
              <button
                onClick={() => handleNav('admin')}
                className="px-2.5 py-1.5 rounded-lg transition-colors bg-[#17365D] text-white text-[11px] font-bold flex items-center gap-1.5"
              >
                <Icon name="shield" size={13} />
                <span>Admin CMS</span>
              </button>
            )}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isOnline && (
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold bg-[#FFF8EB] text-[#B45309] border border-[#FDE68A] flex-shrink-0"
                title="You are offline and viewing cached data"
              >
                <Icon name="wifiOff" size={12} className="text-[#B45309]" />
                <span className="hidden xs:inline">Offline</span>
              </span>
            )}

            {canInstall && (
              <button
                onClick={promptInstall}
                className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D9822B] bg-[#FFF8EB] text-[#B45309] text-xs font-bold hover:bg-[#FCECC3] transition-colors"
                title="Install JeevikaAI as a native app on your home screen"
              >
                <Icon name="download" size={14} />
                <span>Install</span>
              </button>
            )}

            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                title={isDarkMode ? 'लाइट मोड (Light Mode)' : 'डार्क मोड (Dark Mode)'}
                className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-[#DCE3EA] bg-white text-[#17365D] hover:border-[#245A91] transition-colors flex items-center gap-1.5 flex-shrink-0 text-xs font-bold"
              >
                <Icon
                  name={isDarkMode ? 'sun' : 'moon'}
                  size={15}
                  className={isDarkMode ? 'text-[#F4B966]' : 'text-[#245A91]'}
                />
                <span className="hidden xl:inline">{isDarkMode ? 'Light' : 'Dark'}</span>
              </button>
            )}

            {(profileName || currentUser) && (
              <div className="relative">
                <button
                  onClick={() => setLangMenuOpen(!langMenuOpen)}
                  className="min-h-[38px] flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-[#DCE3EA] bg-white text-[#202B36] hover:border-[#245A91] transition-colors"
                  aria-label="Change language"
                  title="भाषा बदलें (Change Language)"
                >
                  <Icon name="globe" size={14} className="text-[#245A91]" />
                  <span className="font-bold text-[11px] sm:text-xs">{activeLangConfig.label}</span>
                  <Icon name="chev" size={11} className="text-[#5F6B76]" />
                </button>

                {langMenuOpen && (
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-[#DCE3EA] rounded-xl shadow-lg py-1 z-50">
                    {LANG_CONFIG.map((lang) => (
                      <button
                        key={lang.k}
                        onClick={() => {
                          onLanguageChange(lang.k as SupportedLanguage);
                          setLangMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[#F7F9FC] ${
                          currentLang === lang.k
                            ? 'font-bold text-[#245A91] bg-[#F7F9FC]'
                            : 'text-[#202B36]'
                        }`}
                      >
                        <span>{lang.label}</span>
                        <span className="text-[10px] text-[#5F6B76]">{lang.sub}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isInstalled && !isStandalone && (
              <button
                onClick={async () => {
                  const res = await promptInstall();
                  if (res === 'ios') {
                    setShowIosGuide(true);
                  }
                }}
                className="lg:hidden min-h-[38px] px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-[#D9822B] hover:bg-[#C27120] text-white font-extrabold text-[11px] sm:text-xs transition-colors flex items-center gap-1.5 flex-shrink-0"
                title="ऐप इंस्टॉल करें (Install App)"
              >
                <Icon name="download" size={14} />
                <span>{currentLang === 'en' ? 'Install App' : currentLang === 'bho' ? 'ऐप इंस्टॉल करीं' : 'ऐप इंस्टॉल करें'}</span>
              </button>
            )}

            {onOpenAccount && (!currentUser || currentUser.isAnonymous) && (
              <button
                onClick={() => onOpenAccount('login')}
                className="hidden sm:flex min-h-[40px] px-3.5 text-xs font-extrabold rounded-xl bg-[#287D73] text-white hover:bg-[#1E6058] transition-colors items-center gap-1.5"
              >
                <Icon name="user" size={14} />
                <span>
                  {currentLang === 'en' ? 'Account & Login' : currentLang === 'bho' ? 'खाता / लॉगइन' : 'खाता / लॉगिन'}
                </span>
              </button>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden min-h-[38px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] text-[#17365D] hover:bg-slate-100 font-bold text-xs transition-colors flex-shrink-0"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              <Icon name={mobileMenuOpen ? 'x' : 'menu'} size={16} />
              <span className="text-[11px] font-extrabold tracking-tight hidden sm:inline">
                {mobileMenuOpen ? 'बंद' : 'मेनू'}
              </span>
            </button>
          </div>
        </div>

        {/* Inline iOS Guide Strip */}
        {showIosGuide && (
          <div className="bg-[#FFF8EB] border-b border-[#FDE68A] px-4 py-2 text-xs text-[#9A4E0B] flex items-center justify-between gap-2">
            <span>iOS (iPhone/iPad) पर इंस्टॉल करने के लिए Safari में Share बटन पर टैप करके "Add to Home Screen" चुनें।</span>
            <button onClick={() => setShowIosGuide(false)} className="font-bold underline flex-shrink-0">बंद</button>
          </div>
        )}

        {mobileMenuOpen && (
          <div
            className="fixed inset-0 top-16 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 z-50 bg-white border-b border-[#DCE3EA] shadow-xl max-h-[calc(100vh-6rem)] overflow-y-auto px-4 py-4 space-y-3 text-xs font-semibold">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                if (onStartVoiceAssessment) onStartVoiceAssessment();
                else handleNav('assessment');
              }}
              className="w-full min-h-[56px] px-4 py-3 rounded-xl bg-[#17365D] text-white text-sm font-extrabold flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-3 text-left">
                <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Icon name="mic" size={20} className="text-[#F4B966]" />
                </span>
                <div>
                  <div className="font-extrabold text-white text-sm leading-tight">
                    {currentLang === 'bho'
                      ? 'बोल के शुरू करीं (Voice Assessment)'
                      : currentLang === 'en'
                      ? 'Start Voice Assessment'
                      : 'बोलकर शुरू करें (Voice Assessment)'}
                  </div>
                  <div className="text-[11px] text-white/75 font-normal mt-0.5">
                    {currentLang === 'bho'
                      ? '8 आसान सवाल के आवाज से जवाब दीं'
                      : '8 सरल सवालों के आवाज से जवाब दें'}
                  </div>
                </div>
              </span>
              <Icon name="arrowR" size={16} className="text-white/80" />
            </button>

            {(profileName || currentUser) ? (
              <div className="p-3.5 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-9 h-9 rounded-full bg-[#17365D] text-white flex items-center justify-center font-extrabold text-sm flex-shrink-0">
                      {(profileName || currentUser?.displayName || currentUser?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="font-extrabold text-[#17365D] text-sm truncate">
                        {profileName || currentUser?.displayName || 'लाभार्थी'}
                      </div>
                      <div className="text-[10px] text-[#5F6B76] font-medium truncate">
                        सक्रिय प्रोफ़ाइल · Active Profile
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-white bg-[#9E2A2B] hover:bg-[#7E1F20] transition-colors flex items-center gap-1.5 flex-shrink-0"
                  >
                    <Icon name="logout" size={14} />
                    <span>लॉगआउट</span>
                  </button>
                </div>
              </div>
            ) : (
              onOpenAccount && (
                <div className="p-3.5 bg-[#F7F9FC] border border-[#DCE3EA] rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#17365D] text-white flex items-center justify-center font-bold flex-shrink-0">
                      <Icon name="user" size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-[#17365D] text-xs">
                        {currentLang === 'en' ? 'Registered Account?' : 'पंजीकृत उपयोगकर्ता?'}
                      </div>
                      <div className="text-[10px] text-[#5F6B76] truncate">
                        {currentLang === 'en' ? 'Log in to sync profile' : 'लॉगिन करके प्रोफ़ाइल सिंक करें'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAccount('login');
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-extrabold text-white bg-[#287D73] hover:bg-[#1E6058] transition-colors flex-shrink-0"
                  >
                    {currentLang === 'en' ? 'Account / Login' : currentLang === 'bho' ? 'खाता / लॉगइन' : 'खाता / लॉगिन'}
                  </button>
                </div>
              )
            )}

            <div className="space-y-1 pt-1 border-t border-[#DCE3EA]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#5F6B76] px-2 py-1">
                नेविगेशन मेनू (Navigation)
              </div>
              {[
                { id: 'home', label: 'मुख्य पृष्ठ (Home)' },
                { id: 'dashboard', label: 'आजीविका रोडमैप (Livelihood Roadmap)' },
                { id: 'opportunities', label: 'रोजगार अवसर (Jobs Directory)' },
                { id: 'training', label: 'प्रशिक्षण केंद्र (PMKVY / RSETI)' },
                { id: 'skill-gap', label: 'कौशल अंतर विश्लेषण (Skill Gap)' },
                { id: 'saved', label: 'सहेजे गए अवसर (Saved Items)' },
                { id: 'business-upload', label: '+ अपना उत्पाद जोड़ें (Seller Portal)' },
                { id: 'faq', label: 'सहायता व प्रश्नोत्तर (Help & FAQ)' },
                { id: 'about', label: 'हमारे बारे में (About Us)' },
              ].map((link) => (
                <button
                  key={link.id}
                  onClick={() => handleNav(link.id as AppView)}
                  className={`w-full min-h-[42px] text-left px-3 py-2 rounded-xl flex items-center justify-between ${
                    currentView === link.id ? 'bg-[#EBF3FB] text-[#245A91] font-bold' : 'hover:bg-[#F7F9FC] text-[#202B36]'
                  }`}
                >
                  <span>{link.label}</span>
                  <Icon name="arrowR" size={13} className="opacity-40" />
                </button>
              ))}
            </div>

            {canInstall && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  promptInstall();
                }}
                className="w-full text-left p-3 rounded-xl bg-[#FFF8EB] border border-[#FDE68A] text-[#B45309] font-bold flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Icon name="download" size={16} />
                  <span>ऐप इंस्टॉल करें (Install App)</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#D9822B] text-white">
                  Only 1MB
                </span>
              </button>
            )}

            <div className="pt-2 border-t border-[#DCE3EA]">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (isAdmin) {
                    handleNav('admin');
                  } else if (onOpenAdminLogin) {
                    onOpenAdminLogin();
                  } else {
                    handleNav('admin');
                  }
                }}
                className="w-full text-left p-2.5 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] hover:border-[#245A91] text-[#5F6B76] hover:text-[#17365D] transition-colors flex items-center justify-between text-[11px]"
              >
                <span className="flex items-center gap-2">
                  <Icon name="shield" size={13} className="text-[#5F6B76]" />
                  <span>प्रशासनिक पोर्टल (Admin Portal)</span>
                </span>
                <span className="font-bold underline text-[#245A91]">
                  {isAdmin ? 'CMS' : 'Login'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
