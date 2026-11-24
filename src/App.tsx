import { useState, useEffect, useRef } from 'react';
import {
  AppView,
  BeneficiaryProfile,
  SupportedLanguage,
  Opportunity,
  SummaryModalData,
  LocationLivelihoodData,
} from './types';
import { DEMO, JOBS } from './data/mockData';
import { storageService } from './services/storageService';
import { authService, AppUser, firestoreService } from './services/firebase';
import { locationIntelligenceService } from './services/locationIntelligenceService';
import { mediaStorageService } from './services/cloudinaryService';
import { Navbar } from './components/Navbar';
import { Home } from './components/Home';
import { Assessment } from './components/Assessment';
import { Dashboard } from './components/Dashboard';
import { OpportunitiesView } from './components/OpportunitiesView';
import { TrainingView } from './components/TrainingView';
import { SkillGapView } from './components/SkillGapView';
import { SavedView } from './components/SavedView';
import { HistoryView } from './components/HistoryView';
import { ProfileView } from './components/ProfileView';
import { NotificationSettingsView } from './components/NotificationSettingsView';
import { HelpFAQView } from './components/HelpFAQView';
import { AdminCMSView } from './components/AdminCMSView';
import { LocalBusinessUpload } from './components/LocalBusinessUpload';
import { SellerAnalytics } from './components/SellerAnalytics';
import { Footer } from './components/Footer';
import { OpportunityDetailModal } from './components/OpportunityDetailModal';
import { SummaryModal } from './components/SummaryModal';
import { FloatingVoiceAssistant } from './components/FloatingVoiceAssistant';
import { VoiceStartModal } from './components/VoiceStartModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AssistedAccountModal, AccountMode } from './components/AssistedAccountModal';
import { AppWelcome } from './components/AppWelcome';
import { BottomNav } from './components/BottomNav';
import { Logo } from './components/Logo';
import { Icon } from './components/Icons';

export function App() {
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );

  const [currentView, setCurrentView] = useState<AppView>(() => {
    try {
      const savedProf = storageService.loadProfile();
      if (isStandalone && savedProf) {
        return 'dashboard';
      }
    } catch {}
    return 'home';
  });

  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(() => {
    try {
      return (localStorage.getItem('jeevika_lang') as SupportedLanguage) || 'hi';
    } catch {
      return 'hi';
    }
  });

  const [profile, setProfile] = useState<BeneficiaryProfile | null>(() => storageService.loadProfile());
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [shortlist, setShortlist] = useState<Record<string, boolean>>(() => storageService.loadShortlist());
  const [savedItems, setSavedItems] = useState<Record<string, Opportunity>>(() => storageService.loadShortlistItems());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('jeevika_theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [toastMessage, setToastMessage] = useState<string>('');
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [summaryModalData, setSummaryModalData] = useState<SummaryModalData | null>(null);
  const [autoStartAssessment, setAutoStartAssessment] = useState<boolean>(false);
  const [showVoiceStartModal, setShowVoiceStartModal] = useState<boolean>(false);
  const [adminLoginModalOpen, setAdminLoginModalOpen] = useState<boolean>(false);
  const [accountMode, setAccountMode] = useState<AccountMode | null>(null);
  const [isAnalyzingProfile, setIsAnalyzingProfile] = useState<boolean>(false);
  const [analysisStep, setAnalysisStep] = useState<number>(1);

  const [activeLocation, setActiveLocation] = useState<string>(() => {
    return storageService.loadProfile()?.location || locationIntelligenceService.getActiveLocation() || 'Maharajganj, Uttar Pradesh';
  });
  const [locationData, setLocationData] = useState<LocationLivelihoodData | null>(() => {
    const initialProfileLoc = storageService.loadProfile()?.location;
    return locationIntelligenceService.getCachedData(initialProfileLoc);
  });
  const [isRefreshingLocationData, setIsRefreshingLocationData] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    return Boolean(isStandalone && !sessionStorage.getItem('jeevika_pwa_splashed'));
  });

  const pendingSectionRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoDetectedGpsRef = useRef<boolean>(false);

  useEffect(() => {
    try {
      document.documentElement.classList.toggle('dark', isDarkMode);
      localStorage.setItem('jeevika_theme', isDarkMode ? 'dark' : 'light');
    } catch {}
  }, [isDarkMode]);

  const notify = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(''), 4500);
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      notify(
        currentLang === 'bho'
          ? 'इंटरनेट कनेक्ट हो गइल! लाइव डेटा सिंक भइल।'
          : 'इंटरनेट पुनः कनेक्ट हुआ! लाइव डेटा सिंक हो गया है।'
      );
    };
    const handleOffline = () => {
      setIsOffline(true);
      notify(
        currentLang === 'bho'
          ? 'ऑफ़लाइन मोड सक्रिय: सहेजल अवसर व आवश्यक डेटा उपलब्ध बा।'
          : 'ऑफ़लाइन मोड सक्रिय: सहेजे गए अवसर व आवश्यक आजीविका डेटा उपलब्ध है।'
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentLang]);

  useEffect(() => {
    const unsub = locationIntelligenceService.subscribe((data) => {
      setLocationData(data);
    });
    const locToFetch = profile?.location?.trim() || activeLocation;
    if (profile?.location && profile.location.trim() !== activeLocation) {
      setActiveLocation(profile.location.trim());
    }
    locationIntelligenceService.fetchLocationData(locToFetch, currentLang, profile);
    return () => unsub();
  }, [profile?.location, activeLocation, currentLang]);

  useEffect(() => {
    const accuracy = locationIntelligenceService.getLocationAccuracy();
    if (hasAutoDetectedGpsRef.current || (accuracy.source === 'gps' && accuracy.latitude)) {
      return;
    }

    if (['dashboard', 'opportunities', 'training', 'skill-gap', 'saved'].includes(currentView)) {
      hasAutoDetectedGpsRef.current = true;
      locationIntelligenceService
        .detectGpsLocation()
        .then(async (detected) => {
          if (detected && detected.location) {
            setActiveLocation(detected.location);
            locationIntelligenceService.setActiveLocation(detected.location);
            setProfile((prev) => {
              if (!prev) return prev;
              const updatedProf = {
                ...prev,
                location: detected.location,
                locationAccuracy: detected.accuracyLevel,
                locationConfidence: detected.confidenceScore,
                locationAccuracyMeters: detected.accuracyMeters,
              };
              storageService.saveProfile(updatedProf);
              return updatedProf;
            });
            const fresh = await locationIntelligenceService.fetchLocationData(
              detected.location,
              currentLang,
              profile
            );
            setLocationData(fresh);
          }
        })
        .catch(() => {});
    }
  }, [currentView]);

  useEffect(() => {
    mediaStorageService.syncLocalMediaToFirestore();
  }, []);

  useEffect(() => {
    if (showSplash) {
      sessionStorage.setItem('jeevika_pwa_splashed', 'true');
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  useEffect(() => {
    const unsubscribe = authService.subscribe((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const navigateTo = (v: AppView | string, sectionId?: string) => {
    const targetView = (v as AppView) || 'home';

    if (
      currentUser &&
      !currentUser.isAnonymous &&
      (!profile || !profile.skills || !profile.education || profile.status === 'pending') &&
      ['dashboard', 'opportunities', 'training', 'saved', 'skill-gap'].includes(targetView)
    ) {
      notify(
        currentLang === 'bho'
          ? 'पहिले AI हुनर व प्रोफ़ाइल पूरा करीं ताकि सही अवसर मिले!'
          : 'कृपया पहले AI हुनर व प्रोफ़ाइल प्रक्रिया पूरी करें ताकि सही अवसर मिल सकें!'
      );
      setAutoStartAssessment(true);
      setCurrentView('assessment');
      return;
    }

    if (targetView === currentView) {
      if (sectionId) {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    pendingSectionRef.current = sectionId || null;
    setCurrentView(targetView);
  };

  useEffect(() => {
    const sec = pendingSectionRef.current;
    pendingSectionRef.current = null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (sec) {
          const el = document.getElementById(sec);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      });
    });
  }, [currentView]);

  useEffect(() => {
    const handlePopState = () => {
      if (profile && currentView === 'dashboard') {
        window.history.pushState(null, '', window.location.pathname);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [profile, currentView]);

  const handleAssessmentComplete = async (newProfile: BeneficiaryProfile) => {
    setCurrentView('dashboard');
    window.scrollTo({ top: 0, behavior: 'instant' });

    const targetLoc = (newProfile.location && newProfile.location.trim())
      ? newProfile.location.trim()
      : (activeLocation || 'Maharajganj, Uttar Pradesh');
    setActiveLocation(targetLoc);
    locationIntelligenceService.setActiveLocation(targetLoc);

    setProfile(newProfile);
    await storageService.saveProfile(newProfile);

    try {
      localStorage.removeItem('jeevika_current_step_v1');
      sessionStorage.removeItem('jeevika_current_step_v1');
      window.history.replaceState({ view: 'dashboard' }, '', window.location.pathname);
    } catch {}

    setIsAnalyzingProfile(true);
    setAnalysisStep(1);
    const step1Timer = setTimeout(() => setAnalysisStep(2), 500);
    const step2Timer = setTimeout(() => setAnalysisStep(3), 1000);

    let analyzedProfile = { ...newProfile };

    try {
      const [profileAnalysisRes, locationDataRes] = await Promise.allSettled([
        fetch('/api/analyze-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile: newProfile, language: currentLang }),
        }).then((res) => (res.ok ? res.json() : null)),
        locationIntelligenceService.fetchLocationData(targetLoc, currentLang, newProfile),
      ]);

      if (profileAnalysisRes.status === 'fulfilled' && profileAnalysisRes.value?.analysis) {
        analyzedProfile = {
          ...analyzedProfile,
          aiAnalysis: profileAnalysisRes.value.analysis,
        };
        await storageService.saveProfile(analyzedProfile);
      }

      if (locationDataRes.status === 'fulfilled' && locationDataRes.value) {
        setLocationData(locationDataRes.value);
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 1600));
    clearTimeout(step1Timer);
    clearTimeout(step2Timer);

    setProfile(analyzedProfile);
    setIsAnalyzingProfile(false);

    notify(
      currentLang === 'bho'
        ? `रोडमैप तैयार भइल! ${analyzedProfile.name} खातिर ${targetLoc} के अनुसार अवसर लोड हो गइल बा।`
        : currentLang === 'en'
        ? `Personalized dashboard ready for ${analyzedProfile.name} with opportunities in ${targetLoc}!`
        : `रोडमैप तैयार हुआ! ${analyzedProfile.name} के लिए ${targetLoc} के अवसर लोड हो गए हैं।`
    );
  };

  const handleLoadDemoBeneficiary = async () => {
    const demoProf = { ...DEMO, location: activeLocation || DEMO.location };
    setProfile(demoProf);
    storageService.saveProfile(demoProf);
    navigateTo('dashboard');

    try {
      const detected = await locationIntelligenceService.detectGpsLocation();
      if (detected && detected.location) {
        const syncedDemo = {
          ...demoProf,
          location: detected.location,
          locationAccuracy: detected.accuracyLevel,
          locationConfidence: detected.confidenceScore,
          locationAccuracyMeters: detected.accuracyMeters,
        };
        setActiveLocation(detected.location);
        setProfile(syncedDemo);
        storageService.saveProfile(syncedDemo);
        const fresh = await locationIntelligenceService.fetchLocationData(
          detected.location,
          currentLang,
          syncedDemo
        );
        setLocationData(fresh);
        notify(`डेमो प्रोफ़ाइल आपकी वर्तमान लोकेशन (${detected.location}) के साथ सिंक हो गई है!`);
        return;
      }
    } catch {}
    notify(`डेमो प्रोफ़ाइल लोड हो गई (${demoProf.location})।`);
  };

  const handleShortlistToggle = (id: string, item?: Opportunity) => {
    const willSave = !shortlist[id];
    const updatedShortlist = { ...shortlist, [id]: willSave };
    setShortlist(updatedShortlist);
    storageService.saveShortlist(updatedShortlist);

    setSavedItems((prevItems) => {
      const nextItems = { ...prevItems };
      if (willSave) {
        const resolved =
          item ||
          locationData?.opportunities?.find((o) => o.id === id) ||
          locationData?.trainingCenters?.find((t) => t.id === id) ||
          JOBS.find((j) => j.id === id);
        if (resolved) {
          nextItems[id] = resolved;
        }
      } else {
        delete nextItems[id];
      }
      storageService.saveShortlistItems(nextItems);
      return nextItems;
    });

    const msg = willSave
      ? currentLang === 'bho'
        ? 'अवसर सहेज लिहल गइल!'
        : currentLang === 'en'
        ? 'Saved to your shortlist.'
        : 'सहेजे गए अवसरों में जोड़ दिया गया।'
      : currentLang === 'bho'
      ? 'सहेजल सूची से हटा दिहल गइल।'
      : currentLang === 'en'
      ? 'Removed from shortlist.'
      : 'सहेजे गए अवसरों से हटाया गया।';
    notify(msg);
  };

  useEffect(() => {
    const activeIds = Object.keys(shortlist).filter((id) => shortlist[id]);
    if (activeIds.length === 0) return;

    setSavedItems((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of activeIds) {
        if (!next[id]) {
          const found =
            locationData?.opportunities?.find((o) => o.id === id) ||
            locationData?.trainingCenters?.find((t) => t.id === id) ||
            JOBS.find((j) => j.id === id);
          if (found) {
            next[id] = found;
            changed = true;
          }
        }
      }
      if (changed) {
        storageService.saveShortlistItems(next);
        return next;
      }
      return prev;
    });
  }, [shortlist, locationData]);

  const handleProfileUpdate = async (updated: BeneficiaryProfile) => {
    setProfile(updated);
    storageService.saveProfile(updated);

    try {
      await firestoreService.syncLocalProfileToFirestore(updated);
    } catch (err) {
      console.error('Error syncing profile change to Firestore:', err);
    }

    try {
      fetch('/api/analyze-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: updated, language: currentLang }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.analysis) {
            const enriched = { ...updated, aiAnalysis: data.analysis };
            setProfile(enriched);
            storageService.saveProfile(enriched);
          }
        })
        .catch(() => {});
    } catch {}
  };

  const handleLocationChange = async (newLocation: string) => {
    setActiveLocation(newLocation);
    const accuracy = locationIntelligenceService.getLocationAccuracy();
    locationIntelligenceService.setActiveLocation(newLocation);

    if (profile) {
      const updated = {
        ...profile,
        location: newLocation,
        locationAccuracy: accuracy.level,
        locationConfidence: accuracy.confidenceScore,
        locationAccuracyMeters: accuracy.accuracyMeters,
      };
      setProfile(updated);
      storageService.saveProfile(updated);
    }

    setIsRefreshingLocationData(true);
    try {
      const fresh = await locationIntelligenceService.fetchLocationData(newLocation, currentLang, profile);
      setLocationData(fresh);
      notify(
        currentLang === 'bho'
          ? `स्थान बदलल गइल: ${newLocation} (${accuracy.level})`
          : currentLang === 'en'
          ? `Location updated to: ${newLocation} (${accuracy.level})`
          : `स्थान अपडेट हुआ: ${newLocation} (${accuracy.level})`
      );
    } catch {} finally {
      setIsRefreshingLocationData(false);
    }
  };

  const handleRefreshLocationAi = async () => {
    setIsRefreshingLocationData(true);
    try {
      const fresh = await locationIntelligenceService.fetchLocationData(activeLocation, currentLang, profile);
      setLocationData(fresh);
      notify(
        currentLang === 'bho'
          ? 'AI से लाइव डेटा अपडेट हो गइल!'
          : currentLang === 'en'
          ? 'Live location data refreshed via Gemini AI!'
          : 'AI द्वारा लाइव लोकेशन डेटा सफलतापूर्वक लोड हुआ!'
      );
    } catch {
      notify('Curated district data is active.');
    } finally {
      setIsRefreshingLocationData(false);
    }
  };

  const handleStartVoiceAssessment = (lang: SupportedLanguage) => {
    setCurrentLang(lang);
    try { localStorage.setItem('jeevika_lang', lang); } catch {}
    setShowVoiceStartModal(false);

    const isLogged = (currentUser && !currentUser.isAnonymous) || Boolean(profile);
    if (!isLogged) {
      setAccountMode('create');
    } else {
      setAutoStartAssessment(true);
      setCurrentView('assessment');
    }
  };

  const handleAccountCreated = async (_user: AppUser) => {
    setCurrentUser(_user);
    setProfile(null);
    storageService.clearProfile();
    notify(
      currentLang === 'bho'
        ? `खाता बन गइल! अब आपन हुनर के मूल्यांकन शुरू करीं।`
        : `खाता बन गया! अब अपने हुनर का मूल्यांकन शुरू करें।`
    );
    setAccountMode(null);
    setAutoStartAssessment(true);
    navigateTo('assessment');
  };

  const handleAccountLoggedIn = async (user: AppUser): Promise<boolean> => {
    setCurrentUser(user);
    try {
      let saved = await firestoreService.getUserProfile(user.uid);
      if (!saved || !saved.skills || !saved.education || saved.status === 'pending') {
        const localProf = storageService.loadProfile();
        if (localProf && localProf.skills && localProf.education) {
          saved = localProf;
          await firestoreService.saveUserProfile(user.uid, localProf, true, true);
        }
      }

      const isComplete = Boolean(
        saved &&
        saved.name &&
        !saved.name.toLowerCase().startsWith('user') &&
        !saved.name.includes('नागरिक (') &&
        saved.skills &&
        String(saved.skills).trim().length > 2 &&
        saved.education &&
        String(saved.education).trim().length > 1
      );

      if (isComplete && saved) {
        const { consentSaved: _c, updatedAt: _u, ...restored } = saved as any;
        const restoredProfile = restored as BeneficiaryProfile;
        setProfile(restoredProfile);
        await storageService.saveProfile(restoredProfile);
        if (restoredProfile.location) {
          setActiveLocation(restoredProfile.location);
          locationIntelligenceService.setActiveLocation(restoredProfile.location);
        }
        notify(
          currentLang === 'bho'
            ? `स्वागत बा, ${restoredProfile.name}! राउर डैशबोर्ड लोड हो गइल।`
            : `स्वागत है, ${restoredProfile.name}! आपका डैशबोर्ड लोड हो गया है।`
        );
        navigateTo('dashboard');
        return true;
      }

      const fallbackProf = storageService.loadProfile();
      if (fallbackProf && fallbackProf.skills && fallbackProf.education) {
        setProfile(fallbackProf);
        await firestoreService.saveUserProfile(user.uid, fallbackProf, true, true);
        navigateTo('dashboard');
        return true;
      }

      setProfile(null);
      storageService.clearProfile();
      notify(
        currentLang === 'bho'
          ? `खाता मिल गइल! बाकिर AI प्रोफाइल बाकी बा — चलीं, हुनर मूल्यांकन पूरा करीं।`
          : `खाता मिल गया! लेकिन आपकी AI प्रोफाइल अधूरी है — कृपया हुनर व प्रोफ़ाइल मूल्यांकन पूरा करें।`
      );
      setAccountMode(null);
      setAutoStartAssessment(true);
      navigateTo('assessment');
      return false;
    } catch (err) {
      console.warn('Could not load saved profile after login:', err);
      const localProf = storageService.loadProfile();
      if (localProf && localProf.skills && localProf.education) {
        setProfile(localProf);
        navigateTo('dashboard');
        return true;
      }
      setProfile(null);
      storageService.clearProfile();
      setAccountMode(null);
      setAutoStartAssessment(true);
      navigateTo('assessment');
      return false;
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {}
    storageService.clearProfile();
    try {
      localStorage.removeItem('jeevika_auth_user_v1');
    } catch {}
    setProfile(null);
    setCurrentUser(null);
    notify(
      currentLang === 'bho'
        ? 'सफलतापूर्वक लॉगआउट हो गइल।'
        : 'सफलतापूर्वक लॉगआउट हो गया (Signed out successfully).'
    );
    navigateTo('home');
  };

  const activeProfile = profile || { ...DEMO, isDemo: true };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC] text-[#202B36]">
      {/* PWA Splash Screen */}
      {showSplash && (
        <div className="fixed inset-0 z-50 bg-[#17365D] text-white flex flex-col items-center justify-center p-6">
          <div className="gov-tricolor-line absolute top-0 left-0 right-0" />
          <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-6">
            <Logo size={48} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-center mb-2 font-['Bricolage_Grotesque']">
            JeevikaAI
          </h1>
          <p className="text-xs sm:text-sm text-white/80 text-center max-w-xs mb-8">
            Voice-First NSQF Livelihood &amp; Skill Guidance Platform
          </p>
          <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          <div className="absolute bottom-8 text-[11px] text-white/60 font-medium">
            Loading your session...
          </div>
        </div>
      )}

      {/* Offline Status Bar */}
      {isOffline && (
        <div className="bg-[#9E2A2B] text-white text-xs font-bold py-2 px-3 text-center flex items-center justify-center gap-2 sticky top-0 z-[70]">
          <Icon name="wifiOff" size={15} />
          <span>
            {currentLang === 'bho'
              ? 'ऑफ़लाइन मोड: सहेजल अवसर, सरकारी योजना व आजीविका डेटा उपलब्ध बा (Offline Cache Active)'
              : 'ऑफ़लाइन मोड: सहेजे गए अवसर, सरकारी योजनाएं व आवश्यक आजीविका डेटा उपलब्ध है (Offline Cache Active)'}
          </span>
        </div>
      )}

      {/* Navigation Bar */}
      {!showSplash && (!isStandalone || profile) && (
        <Navbar
          currentView={currentView}
          currentLang={currentLang}
          currentUser={currentUser}
          profileName={profile?.name}
          avatarUrl={profile?.avatarUrl}
          onLanguageChange={(l) => {
            setCurrentLang(l);
            try { localStorage.setItem('jeevika_lang', l); } catch {}
          }}
          go={navigateTo}
          onLogout={handleLogout}
          onStartVoiceAssessment={() => setShowVoiceStartModal(true)}
          onOpenAdminLogin={() => setAdminLoginModalOpen(true)}
          onOpenAccount={setAccountMode}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
        />
      )}

      {/* Primary Route Views */}
      <div className={`flex-1 ${isStandalone && !profile ? 'pt-0' : 'pt-16 sm:pt-20'} pb-20 sm:pb-24`}>
        {currentView === 'home' && (
          isStandalone && !profile ? (
            <AppWelcome
              currentLang={currentLang}
              onOpenAccount={setAccountMode}
              onLoadDemo={handleLoadDemoBeneficiary}
            />
          ) : (
            <Home
              go={navigateTo}
              onLoadDemo={handleLoadDemoBeneficiary}
              onStartVoiceAssessment={handleStartVoiceAssessment}
              onOpenAccount={setAccountMode}
              currentLang={currentLang}
              hasProfile={Boolean(profile)}
              onNotify={notify}
              userName={profile?.name}
              userPhone={profile?.phone}
              userLocation={profile?.location}
            />
          )
        )}

        {currentView === 'assessment' && (
          <Assessment
            initialProfile={profile}
            currentLang={currentLang}
            onLanguageChange={setCurrentLang}
            onSubmit={handleAssessmentComplete}
            onNotify={notify}
            go={navigateTo}
            autoStart={autoStartAssessment}
            onResetAutoStart={() => setAutoStartAssessment(false)}
          />
        )}

        {currentView === 'dashboard' && (
          <Dashboard
            profile={activeProfile}
            hasAssessment={Boolean(profile)}
            currentLang={currentLang}
            go={navigateTo}
            onNotify={notify}
            onOpenSummary={setSummaryModalData}
            onSelectDetail={setSelectedOpportunity}
            onUpdateProfile={handleProfileUpdate}
            onLocationChange={handleLocationChange}
            locationData={locationData}
            onRefreshLocationAi={handleRefreshLocationAi}
            isRefreshingLocationData={isRefreshingLocationData}
            shortlist={shortlist}
            onShortlistToggle={handleShortlistToggle}
            currentUser={currentUser}
            onOpenAccount={setAccountMode}
          />
        )}

        {currentView === 'opportunities' && (
          <OpportunitiesView
            shortlist={shortlist}
            onShortlistToggle={handleShortlistToggle}
            onSelectDetail={setSelectedOpportunity}
            go={navigateTo}
            currentLang={currentLang}
            locationData={locationData}
            onLocationChange={handleLocationChange}
            onRefreshAi={handleRefreshLocationAi}
            isRefreshingAi={isRefreshingLocationData}
            userProfile={activeProfile}
          />
        )}

        {currentView === 'training' && (
          <TrainingView
            shortlist={shortlist}
            onShortlistToggle={handleShortlistToggle}
            onSelectDetail={setSelectedOpportunity}
            go={navigateTo}
            currentLang={currentLang}
            locationData={locationData}
            onLocationChange={handleLocationChange}
            onRefreshAi={handleRefreshLocationAi}
            isRefreshingAi={isRefreshingLocationData}
            userProfile={activeProfile}
          />
        )}

        {currentView === 'skill-gap' && (
          <SkillGapView
            profile={activeProfile}
            go={navigateTo}
          />
        )}

        {currentView === 'saved' && (
          <SavedView
            shortlist={shortlist}
            savedItems={savedItems}
            locationData={locationData}
            currentLang={currentLang}
            onShortlistToggle={handleShortlistToggle}
            onSelectDetail={setSelectedOpportunity}
            go={navigateTo}
          />
        )}

        {currentView === 'history' && (
          <HistoryView
            currentProfile={activeProfile}
            go={navigateTo}
            onRestoreProfile={(p) => {
              setProfile(p);
              storageService.saveProfile(p);
              notify('Restored profile as active.');
              navigateTo('dashboard');
            }}
          />
        )}

        {currentView === 'profile' && (
          <ProfileView
            profile={activeProfile}
            onUpdateProfile={handleProfileUpdate}
            onNotify={notify}
            go={navigateTo}
            onLogout={handleLogout}
            currentLang={currentLang}
          />
        )}

        {currentView === 'notifications' && (
          <NotificationSettingsView
            onNotify={notify}
            go={navigateTo}
          />
        )}

        {currentView === 'faq' && (
          <HelpFAQView
            initialTab="faq"
            go={navigateTo}
            currentLang={currentLang}
          />
        )}

        {currentView === 'accessibility' && (
          <HelpFAQView
            initialTab="accessibility"
            go={navigateTo}
            currentLang={currentLang}
          />
        )}

        {currentView === 'privacy' && (
          <HelpFAQView
            initialTab="privacy"
            go={navigateTo}
            currentLang={currentLang}
          />
        )}

        {currentView === 'about' && (
          <HelpFAQView
            initialTab="about"
            go={navigateTo}
            currentLang={currentLang}
          />
        )}

        {currentView === 'admin' && (
          <AdminCMSView
            currentUser={currentUser}
            onNotify={notify}
            go={navigateTo}
            onOpenLogin={() => setAdminLoginModalOpen(true)}
            onLogout={handleLogout}
          />
        )}

        {currentView === 'business-upload' && (
          <LocalBusinessUpload
            currentUser={currentUser}
            onOpenAccount={setAccountMode}
            onOpenGoogleLogin={async () => {
              try {
                await authService.loginWithGoogle();
                notify('सफलतापूर्वक गूगल लॉगिन हो गया!');
              } catch (err: any) {
                notify('लॉगिन विफल: ' + err.message);
              }
            }}
            onNotify={notify}
            go={navigateTo}
            userName={profile?.name}
            userPhone={profile?.phone}
            userLocation={profile?.location}
            onClose={() => navigateTo('home')}
          />
        )}

        {currentView === 'seller-analytics' && (
          <SellerAnalytics
            currentUser={currentUser}
            onNotify={notify}
            go={navigateTo}
          />
        )}
      </div>

      {/* Footer */}
      {!isStandalone && <Footer go={navigateTo} currentLang={currentLang} />}

      {/* Bottom Navigation Bar */}
      {!showSplash && profile && currentView !== 'assessment' && currentView !== 'home' && (
        <BottomNav
          currentView={currentView}
          go={navigateTo}
          currentLang={currentLang}
          shortlistCount={Object.values(shortlist).filter(Boolean).length}
        />
      )}

      {/* Floating AI Voice Assistant */}
      {!showSplash && !(isStandalone && !profile && currentView === 'home') && (
        <FloatingVoiceAssistant
          currentView={currentView}
          currentLang={currentLang}
          profile={activeProfile}
          locationData={locationData}
          go={navigateTo}
          onNotify={notify}
          onUpdateProfile={handleProfileUpdate}
          activeLocation={activeLocation}
          onLocationChange={handleLocationChange}
        />
      )}

      {/* Opportunity Detail Modal */}
      {selectedOpportunity && (
        <OpportunityDetailModal
          opp={selectedOpportunity}
          onClose={() => setSelectedOpportunity(null)}
          onShortlistToggle={handleShortlistToggle}
          isShortlisted={Boolean(shortlist[selectedOpportunity.id])}
          activeLocation={activeLocation}
          locationData={locationData}
          currentLang={currentLang}
        />
      )}

      {/* Export / Summary Modal */}
      {summaryModalData && (
        <SummaryModal
          data={summaryModalData}
          onClose={() => setSummaryModalData(null)}
          onNotify={notify}
          currentLang={currentLang}
        />
      )}

      {/* Global Voice Assessment Start Modal */}
      <VoiceStartModal
        isOpen={showVoiceStartModal}
        currentLang={currentLang}
        onClose={() => setShowVoiceStartModal(false)}
        onConfirm={handleStartVoiceAssessment}
      />

      {/* Assisted Account Modal */}
      <AssistedAccountModal
        isOpen={accountMode !== null}
        mode={accountMode || 'create'}
        currentLang={currentLang}
        profileName={profile?.name}
        onClose={() => setAccountMode(null)}
        onSwitchMode={setAccountMode}
        onCreated={handleAccountCreated}
        onLoggedIn={handleAccountLoggedIn}
      />

      {/* Dedicated Admin Login Modal */}
      <AdminLoginModal
        isOpen={adminLoginModalOpen}
        onClose={() => setAdminLoginModalOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          navigateTo('admin');
        }}
        onNotify={notify}
      />

      {/* AI Profile Analysis & Livelihood Synthesis Overlay */}
      {isAnalyzingProfile && (
        <div className="fixed inset-0 z-50 bg-[#17365D]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white">
          <div className="max-w-md w-full bg-white text-[#202B36] rounded-2xl p-6 sm:p-8 border border-[#DCE3EA] text-center space-y-5">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-[#17365D] text-white flex items-center justify-center">
              <Icon name="sparkles" size={28} className="text-[#F4B966]" />
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
                {currentLang === 'bho'
                  ? 'AI प्रोफाइल विश्लेषण जारी बा...'
                  : currentLang === 'en'
                  ? 'AI Profile Analysis in Progress...'
                  : 'AI प्रोफाइल विश्लेषण जारी है...'}
              </h3>
              <p className="text-xs text-[#5F6B76] mt-1">
                {currentLang === 'bho'
                  ? 'रउआ हुनर, पढ़ाई अउर रुचि के आधार पर सही आजीविका रोडमैप तैयार हो रहल बा।'
                  : currentLang === 'en'
                  ? 'Synthesizing your NSQF skills and hyperlocal livelihood roadmap.'
                  : 'आपकी योग्यता, रुचि और दूरी के अनुसार आजीविका रोडमैप तैयार किया जा रहा है।'}
              </p>
            </div>

            <div className="space-y-2.5 text-left text-xs bg-[#F7F9FC] p-4 rounded-xl border border-[#DCE3EA]">
              <div className="flex items-center gap-2.5">
                {analysisStep >= 1 ? (
                  <span className="w-5 h-5 rounded-full bg-[#287D73] text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                ) : (
                  <span className="w-5 h-5 rounded-full border-2 border-slate-300" />
                )}
                <span className={analysisStep >= 1 ? 'font-bold text-[#17365D]' : 'text-[#5F6B76]'}>
                  {currentLang === 'bho' ? 'प्रोफ़ाइल डेटा सत्यापन' : 'Profile Data Verification'}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {analysisStep >= 2 ? (
                  <span className="w-5 h-5 rounded-full bg-[#287D73] text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                ) : analysisStep === 1 ? (
                  <span className="w-5 h-5 rounded-full border-2 border-[#245A91] border-t-transparent animate-spin" />
                ) : (
                  <span className="w-5 h-5 rounded-full border-2 border-slate-300" />
                )}
                <span className={analysisStep >= 2 ? 'font-bold text-[#17365D]' : 'text-[#5F6B76]'}>
                  {currentLang === 'bho' ? 'NSQF स्तर अउर हुनर मैपिंग' : 'NSQF Skill & Interest Matching'}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {analysisStep >= 3 ? (
                  <span className="w-5 h-5 rounded-full bg-[#287D73] text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                ) : analysisStep === 2 ? (
                  <span className="w-5 h-5 rounded-full border-2 border-[#245A91] border-t-transparent animate-spin" />
                ) : (
                  <span className="w-5 h-5 rounded-full border-2 border-slate-300" />
                )}
                <span className={analysisStep >= 3 ? 'font-bold text-[#17365D]' : 'text-[#5F6B76]'}>
                  {currentLang === 'bho'
                    ? `हाइपरलोकल रोजगार अउर ट्रेनिंग केंद्र (${activeLocation})`
                    : currentLang === 'en'
                    ? `Hyperlocal Jobs & Certified Centers (${activeLocation})`
                    : `हाइपरलोकल रोजगार व ट्रेनिंग केंद्र (${activeLocation})`}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-[#5F6B76] font-medium flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-[#245A91] border-t-transparent animate-spin" />
              <span>
                {currentLang === 'bho'
                  ? 'कृपया तनी इंतज़ार करीं, डैशबोर्ड खुल रहल बा...'
                  : currentLang === 'en'
                  ? 'Redirecting to your personalized dashboard...'
                  : 'कृपया प्रतीक्षा करें, व्यक्तिगत डैशबोर्ड खुल रहा है...'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#17365D] text-white px-5 py-3 rounded-xl border border-white/20 text-xs sm:text-sm font-semibold max-w-[92vw] text-center"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default App;
