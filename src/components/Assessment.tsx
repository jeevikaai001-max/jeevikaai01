import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from './Icons';
import {
  BeneficiaryProfile,
  SupportedLanguage,
  AssessmentStep,
  ConversationState,
} from '../types';
import { STEPS, DEMO, LANG_CONFIG } from '../data/mockData';
import { speechService } from '../services/speechService';
import { splitList } from '../services/recommendationEngine';
import { storageService } from '../services/storageService';
import { locationIntelligenceService } from '../services/locationIntelligenceService';
import { AudioVisualizer } from './AudioVisualizer';
import { useVoiceAssessmentBridge } from '../hooks/useVoiceAssessmentBridge';

interface AssessmentProps {
  initialProfile?: BeneficiaryProfile | null;
  currentLang: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onSubmit: (profile: BeneficiaryProfile) => void;
  onNotify: (message: string) => void;
  go: (route: string) => void;
  autoStart?: boolean;
  onResetAutoStart?: () => void;
}

const STEP_TITLES: Record<string, { hi: string; bho: string; en: string }> = {
  name: { hi: 'आपका नाम', bho: 'रउआ नाम', en: 'Your Name' },
  education: { hi: 'शिक्षा की जानकारी', bho: 'पढ़ाई-लिखाई', en: 'Education Level' },
  skills: { hi: 'हुनर और कौशल', bho: 'हुनर अउर कौशल', en: 'Existing Skills' },
  interests: { hi: 'काम में रुचि', bho: 'पसंदीदा काम', en: 'Work Interests' },
  occupation: { hi: 'वर्तमान काम', bho: 'अभी के काम', en: 'Current Occupation' },
  location: { hi: 'गाँव / शहर और जिला', bho: 'गाँव / शहर अउर जिला', en: 'Village / City & District' },
  workType: { hi: 'काम का प्रकार', bho: 'काम के प्रकार', en: 'Preferred Work Type' },
  mobility: { hi: 'काम के लिए दूरी', bho: 'काम खातिर दूरी', en: 'Travel Distance Preference' },
};

export const Assessment: React.FC<AssessmentProps> = ({
  initialProfile,
  currentLang,
  onLanguageChange,
  onSubmit,
  onNotify,
  go,
  autoStart = false,
  onResetAutoStart,
}) => {
  const blankProfile: BeneficiaryProfile = {
    name: '',
    education: '',
    skills: '',
    interests: '',
    occupation: '',
    location: '',
    workType: '',
    mobility: '',
    isDemo: false,
  };

  const [answers, setAnswers] = useState<BeneficiaryProfile>(() => {
    return initialProfile ? { ...initialProfile } : { ...blankProfile };
  });

  // -1 indicates the conversational intro/greeting phase; STEPS.length (8) indicates readback review
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [editingTranscriptValue, setEditingTranscriptValue] = useState<string>('');
  const [isEditingTranscript, setIsEditingTranscript] = useState<boolean>(false);
  const [readbackText, setReadbackText] = useState<string>('');
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);

  const [showConsentModal, setShowConsentModal] = useState<boolean>(() => {
    return !localStorage.getItem('jeevika_consent_given');
  });

  const profileRef = useRef<BeneficiaryProfile>(answers);
  const currentLangRef = useRef<SupportedLanguage>(currentLang);
  const prefetchedGpsRef = useRef<string>('');
  const readbackTextRef = useRef<string>('');
  const initiateReadbackRef = useRef<(lang?: SupportedLanguage) => void>(() => {});
  const confirmSubmitRef = useRef<() => void>(() => {});

  useEffect(() => {
    profileRef.current = answers;
  }, [answers]);

  useEffect(() => {
    currentLangRef.current = currentLang;
  }, [currentLang]);

  useEffect(() => {
    readbackTextRef.current = readbackText;
  }, [readbackText]);

  const applyProfilePatch = useCallback((patch: Partial<BeneficiaryProfile>): BeneficiaryProfile => {
    const next: BeneficiaryProfile = { ...profileRef.current, ...patch };
    profileRef.current = next;
    setAnswers(next);
    return next;
  }, []);

  // Silently pre-fetch GPS location in the background so it is ready by Step 6
  useEffect(() => {
    let mounted = true;
    locationIntelligenceService
      .detectGpsLocation()
      .then((res) => {
        if (!mounted || !res?.location) return;
        prefetchedGpsRef.current = res.location;
        if (!profileRef.current.location) {
          applyProfilePatch({
            location: res.location,
            locationAccuracy: res.accuracyLevel,
            locationConfidence: res.confidenceScore,
            locationAccuracyMeters: res.accuracyMeters,
          });
        }
      })
      .catch(() => {
        // Ignore silent background GPS error
      });
    return () => {
      mounted = false;
    };
  }, [applyProfilePatch]);

  const getIntroGreeting = useCallback((langOverride?: SupportedLanguage) => {
    const lang = langOverride || currentLangRef.current;
    if (lang === 'bho') {
      return 'प्रणाम! हम जीविका एआई हईं। रउआ खातिर सही ट्रेनिंग अउर काम के सुझाव देवे खातिर कुछ सवाल पूछब। का हमनी के शुरू कर सकीं?';
    }
    if (lang === 'en') {
      return 'Namaste! I am JeevikaAI. I will ask you a few quick questions to recommend the best training and livelihood options. Shall we begin?';
    }
    if (lang === 'hin') {
      return 'Namaste! Main JeevikaAI hoon. Aapko sahi training aur kaam ke options suggest karne ke liye kuch sawal poochunga. Kya hum shuru kar sakte hain?';
    }
    return 'नमस्ते! मैं जीविका एआई हूँ। आपको सही ट्रेनिंग और काम के विकल्प बताने के लिए कुछ सवाल पूछूँगा। क्या हम शुरू कर सकते हैं?';
  }, []);

  const getStepQuestionText = useCallback(
    (stepIdx: number, langOverride?: SupportedLanguage): string => {
      const lang = langOverride || currentLangRef.current;
      if (stepIdx === -1) return getIntroGreeting(lang);
      const s = STEPS[stepIdx];
      if (!s) return '';
      if (s.key === 'location' && (profileRef.current.location || prefetchedGpsRef.current)) {
        const loc = profileRef.current.location || prefetchedGpsRef.current;
        if (lang === 'bho') {
          return `जीपीएस से रउआ स्थान ${loc} मिलल बा। अगर ई सही बा त आगे बढ़ीं, ना त आपन गाँव या जिला बोलीं।`;
        }
        if (lang === 'en') {
          return `We detected your location as ${loc}. Say yes to continue, or speak your village or district name.`;
        }
        return `जीपीएस से आपका स्थान ${loc} मिला है। यदि यह सही है तो 'हाँ' बोलें, या अपना गाँव और जिला बोलें।`;
      }
      return s.q[lang] || s.q.hi || s.q.en;
    },
    [getIntroGreeting]
  );

  const voiceBridge = useVoiceAssessmentBridge({
    currentLang,
    inputMode,
    steps: STEPS,
    getStepQuestionText,
    getProfile: () => profileRef.current,
    onApplyProfilePatch: applyProfilePatch,
    onStepChange: setCurrentStepIndex,
    onStateChange: setConversationState,
    onTriggerReadback: (lang) => initiateReadbackRef.current(lang),
    onConfirmSubmit: () => confirmSubmitRef.current(),
    getReadbackText: () => readbackTextRef.current,
    getPrefetchedGps: () => prefetchedGpsRef.current,
  });

  const {
    heardText,
    interimText,
    aiReply,
    errorMessage,
    setHeardText,
    setInterimText,
    setAiReply,
    startListeningForStep,
    speakPromptAndListen,
    transitionToStep,
    processUtterance,
    stopAllVoice,
    setActiveStepIndex,
  } = voiceBridge;

  useEffect(() => {
    setActiveStepIndex(currentStepIndex);
  }, [currentStepIndex, setActiveStepIndex]);

  const initiateReadbackSummary = useCallback(
    async (langOverride?: SupportedLanguage) => {
      const lang = langOverride || currentLangRef.current;
      stopAllVoice();
      setCurrentStepIndex(STEPS.length);
      setActiveStepIndex(STEPS.length);
      setConversationState('readback_review');

      const verbalSummary = await speechService.generateReadback(profileRef.current, lang);
      setReadbackText(verbalSummary);
      readbackTextRef.current = verbalSummary;

      speakPromptAndListen(STEPS.length, verbalSummary, lang, 'readback_review');
    },
    [setActiveStepIndex, speakPromptAndListen, stopAllVoice]
  );

  initiateReadbackRef.current = initiateReadbackSummary;

  const startConversation = useCallback(
    async (langOverride?: SupportedLanguage) => {
      const lang = langOverride || currentLangRef.current;
      localStorage.setItem('jeevika_consent_given', 'true');
      setShowConsentModal(false);
      await speechService.requestMicrophonePermission();

      const greetingText = getIntroGreeting(lang);
      setAiReply('');
      speakPromptAndListen(-1, greetingText, lang, 'asking_question');
    },
    [getIntroGreeting, setAiReply, speakPromptAndListen]
  );

  useEffect(() => {
    if (autoStart) {
      localStorage.setItem('jeevika_consent_given', 'true');
      setShowConsentModal(false);
      onResetAutoStart?.();

      const timer = setTimeout(() => {
        startConversation();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [autoStart, onResetAutoStart, startConversation]);

  const askQuestionAloud = useCallback(
    (stepIdx: number, langOverride?: SupportedLanguage) => {
      const lang = langOverride || currentLangRef.current;
      if (stepIdx >= STEPS.length) {
        initiateReadbackSummary(lang);
        return;
      }
      setAiReply('');
      transitionToStep(stepIdx, '', lang, true);
    },
    [initiateReadbackSummary, setAiReply, transitionToStep]
  );

  const handleStopSpeaking = () => {
    stopAllVoice();
    setConversationState('idle');
  };

  const isReadbackScreen =
    currentStepIndex >= STEPS.length ||
    conversationState === 'readback_review' ||
    conversationState === 'confirming_answer';

  const handleMicButtonTap = async () => {
    if (conversationState === 'processing_answer') return;

    const targetStepIdx = isReadbackScreen ? STEPS.length : currentStepIndex;

    if (targetStepIdx === -1 && conversationState === 'idle') {
      await speechService.requestMicrophonePermission();
      askQuestionAloud(0);
      return;
    }

    if (conversationState === 'asking_question' || speechService.isCurrentlySpeaking()) {
      speechService.stopSpeaking();
      startListeningForStep(targetStepIdx);
      return;
    }

    if (conversationState === 'listening') {
      const textToProcess = (interimText || heardText).trim();
      if (textToProcess) {
        processUtterance(textToProcess, targetStepIdx);
      } else {
        startListeningForStep(targetStepIdx);
      }
      return;
    }

    await speechService.requestMicrophonePermission();
    startListeningForStep(targetStepIdx);
  };

  const handleReplayQuestion = () => {
    stopAllVoice();
    if (currentStepIndex === -1) {
      startConversation();
    } else {
      askQuestionAloud(currentStepIndex);
    }
  };

  const handleSelectLanguage = (newLang: SupportedLanguage) => {
    currentLangRef.current = newLang;
    onLanguageChange(newLang);

    if (!showConsentModal) {
      if (isReadbackScreen) {
        initiateReadbackSummary(newLang);
      } else if (currentStepIndex === -1) {
        startConversation(newLang);
      } else if (currentStepIndex >= 0 && currentStepIndex < STEPS.length) {
        askQuestionAloud(currentStepIndex, newLang);
      }
    }
  };

  const handlePreviousStep = () => {
    stopAllVoice();
    if (currentStepIndex > 0) {
      askQuestionAloud(currentStepIndex - 1);
    } else if (currentStepIndex === 0) {
      setCurrentStepIndex(-1);
      setActiveStepIndex(-1);
      setConversationState('idle');
    } else {
      go('home');
    }
  };

  const handleNextStep = () => {
    if (currentStepIndex === -1) {
      askQuestionAloud(0);
      return;
    }
    const nextStepIdx = currentStepIndex + 1;
    if (nextStepIdx < STEPS.length) {
      askQuestionAloud(nextStepIdx);
    } else {
      initiateReadbackSummary();
    }
  };

  const handleStartEditTranscript = () => {
    const rawVal =
      interimText ||
      heardText ||
      (currentStepIndex >= 0 && currentStepIndex < STEPS.length
        ? speechService.localizeProfileValue(
            STEPS[currentStepIndex].key,
            (answers[STEPS[currentStepIndex].key] as string) || '',
            currentLang
          )
        : '');
    setEditingTranscriptValue(rawVal);
    setIsEditingTranscript(true);
    stopAllVoice();
  };

  const handleSaveEditedTranscript = () => {
    const finalVal = editingTranscriptValue.trim();
    setIsEditingTranscript(false);
    setHeardText(finalVal);
    setInterimText('');

    if (finalVal) {
      processUtterance(finalVal, currentStepIndex);
    }
  };

  const handleManualSelectOption = (value: string) => {
    if (currentStepIndex < 0 || currentStepIndex >= STEPS.length) return;
    const currentStepConfig = STEPS[currentStepIndex];

    stopAllVoice();
    applyProfilePatch({ [currentStepConfig.key]: value } as Partial<BeneficiaryProfile>);

    const nextStepIdx = currentStepIndex + 1;
    if (nextStepIdx < STEPS.length) {
      askQuestionAloud(nextStepIdx);
    } else {
      initiateReadbackSummary();
    }
  };

  const handleDetectLocationGps = async () => {
    if (isDetectingGps) return;
    setIsDetectingGps(true);
    const lang = currentLangRef.current;
    onNotify(
      lang === 'bho'
        ? 'जीपीएस से रउआ सटीक गाँव/शहर अउर जिला खोजल जा रहल बा...'
        : lang === 'en'
        ? 'Fetching your exact village/town and district via GPS...'
        : 'जीपीएस द्वारा आपका सटीक गाँव/शहर और जिला खोजा जा रहा है...'
    );

    try {
      const res = await locationIntelligenceService.detectGpsLocation();
      if (!res) {
        onNotify(
          lang === 'en'
            ? 'Could not auto-detect location. Please speak your village and district.'
            : 'स्थान स्वतः प्राप्त नहीं हो सका। कृपया माइक से अपना गाँव/शहर और जिला बोलें।'
        );
        return;
      }

      prefetchedGpsRef.current = res.location;
      applyProfilePatch({
        location: res.location,
        locationAccuracy: res.accuracyLevel,
        locationConfidence: res.confidenceScore,
        locationAccuracyMeters: res.accuracyMeters,
      });

      setHeardText(res.location);
      onNotify(`📍 ${res.location} (${res.confidenceScore}%)`);

      const ackText =
        lang === 'bho'
          ? `रउआ स्थान मिल गइल: ${res.location}।`
          : lang === 'en'
          ? `Exact location detected: ${res.location}.`
          : `आपका सटीक स्थान मिल गया: ${res.location}।`;

      transitionToStep(currentStepIndex + 1, ackText, lang, true);
    } catch (err) {
      console.warn('GPS detection failed:', err);
      onNotify(
        lang === 'en'
          ? 'GPS permission denied. Please speak your village and district.'
          : 'जीपीएस अनुमति नहीं मिली। कृपया अपना गाँव/शहर और जिला बोलकर बताएं।'
      );
    } finally {
      setIsDetectingGps(false);
    }
  };

  const handleConfirmAndGenerateRoadmap = async () => {
    stopAllVoice();
    setCurrentStepIndex(STEPS.length);
    setActiveStepIndex(999);

    setConversationState('saving_profile');
    const finalProfile = profileRef.current || answers;
    storageService.saveProfile(finalProfile);

    // Registration & Firestore persistence are gated strictly inside App.tsx -> handleAssessmentComplete
    // after verifying !isDemo and full profile assessment completion.
    onSubmit(finalProfile);
  };

  confirmSubmitRef.current = handleConfirmAndGenerateRoadmap;

  const handleLoadDemoProfile = () => {
    stopAllVoice();
    const demoData = { ...DEMO, isDemo: true };
    setAnswers(demoData);
    profileRef.current = demoData;
    setCurrentStepIndex(STEPS.length - 1);
    setConversationState('confirming_answer');
    onNotify(
      currentLang === 'en'
        ? 'Demo profile (Sunita Devi) loaded (preview only — not saved to database).'
        : 'डेमो प्रोफाइल (सुनीता देवी) लोड हो गई है (केवल प्रीव्यू — डेटाबेस में सेव नहीं होगी)।'
    );
  };

  const currentStepConfig: AssessmentStep | null =
    currentStepIndex >= 0 && currentStepIndex < STEPS.length ? STEPS[currentStepIndex] : null;

  const currentFieldVal = currentStepConfig ? (answers[currentStepConfig.key] as string) || '' : '';
  const localizedCurrentFieldVal = currentStepConfig
    ? speechService.localizeProfileValue(currentStepConfig.key, currentFieldVal, currentLang)
    : '';

  const stepHeaderTitle = currentStepConfig
    ? STEP_TITLES[currentStepConfig.key]?.[currentLang === 'bho' ? 'bho' : currentLang === 'en' ? 'en' : 'hi'] ||
      currentStepConfig.label
    : '';

  return (
    <main className="max-w-xl mx-auto px-3 sm:px-5 py-3 sm:py-5 space-y-3.5">
      {/* Top Navigation & Progress Header */}
      <div className="bg-white border border-[#DCE3EA] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            handleStopSpeaking();
            go('home');
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#17365D] hover:bg-[#F7F9FC] transition-colors min-h-[40px]"
        >
          <Icon name="arrowL" size={16} />
          <span>{currentLang === 'en' ? 'Home' : 'होम'}</span>
        </button>

        {/* Step Progress Indicator */}
        <div className="flex flex-col items-center">
          <div className="text-xs font-extrabold text-[#17365D] tabular-nums">
            {currentStepIndex === -1
              ? currentLang === 'en'
                ? 'Profile Setup'
                : 'प्रोफ़ाइल शुरुआत'
              : currentStepIndex >= STEPS.length
              ? currentLang === 'en'
                ? 'Profile Review'
                : 'प्रोफ़ाइल समीक्षा'
              : currentLang === 'en'
              ? `Step ${currentStepIndex + 1} / ${STEPS.length}`
              : `चरण ${currentStepIndex + 1} / ${STEPS.length}`}
          </div>
          <div className="w-24 sm:w-32 bg-[#F7F9FC] h-1.5 rounded-full overflow-hidden border border-[#DCE3EA] mt-1">
            <div
              className="bg-[#287D73] h-full rounded-full transition-all duration-300"
              style={{
                width:
                  currentStepIndex === -1
                    ? '10%'
                    : `${Math.min(100, ((currentStepIndex + 1) / STEPS.length) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Quick Demo Data Loader Button */}
        <button
          type="button"
          onClick={() => {
            handleStopSpeaking();
            const demoProfile: BeneficiaryProfile = {
              ...DEMO,
              location: profileRef.current.location || prefetchedGpsRef.current || DEMO.location,
              isDemo: true,
            };
            localStorage.setItem('jeevika_consent_given', 'true');
            storageService.saveProfile(demoProfile);
            onNotify(currentLang === 'en' ? 'Demo profile loaded successfully!' : 'डेमो प्रोफ़ाइल सफलतापूर्वक लोड हो गई!');
            onSubmit(demoProfile);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold bg-[#FFF8EB] hover:bg-[#FCECC3] text-[#B45309] border border-[#FDE68A] transition-colors min-h-[40px] flex-shrink-0"
          title="Load complete mock profile instantly for quick testing"
        >
          <Icon name="sparkles" size={15} />
          <span className="hidden sm:inline">{currentLang === 'en' ? 'Load Demo' : 'डेमो डेटा'}</span>
          <span className="sm:hidden">डेमो</span>
        </button>

        {/* Language Switcher */}
        <div className="flex items-center bg-[#F7F9FC] p-0.5 rounded-xl border border-[#DCE3EA]">
          {LANG_CONFIG.map((l) => (
            <button
              key={l.k}
              type="button"
              onClick={() => handleSelectLanguage(l.k as SupportedLanguage)}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                currentLang === l.k
                  ? 'bg-white text-[#17365D] border border-[#DCE3EA]'
                  : 'text-[#5F6B76] hover:text-[#202B36]'
              }`}
            >
              {l.k === 'hi' ? 'हिन्दी' : l.k === 'bho' ? 'भोजपुरी' : 'EN'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Conversation Canvas */}
      {isReadbackScreen ? (
        /* ======================== CONFIRMATION & VERBAL READBACK REVIEW ======================== */
        <div className="bg-white border border-[#DCE3EA] rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="border-b border-[#DCE3EA] pb-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-[#287D73]">
                {currentLang === 'en' ? 'Profile Ready' : 'प्रोफ़ाइल तैयार है'}
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
                {currentLang === 'en'
                  ? 'Your Livelihood Profile'
                  : currentLang === 'bho'
                  ? 'रउआ आजीविका प्रोफ़ाइल'
                  : 'आपकी आजीविका प्रोफ़ाइल'}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => {
                if (readbackText) {
                  speechService.speak(readbackText, currentLang);
                } else {
                  initiateReadbackSummary();
                }
              }}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DCE3EA] bg-[#F7F9FC] text-xs font-bold text-[#17365D] hover:bg-slate-100"
            >
              <Icon name="volume2" size={14} />
              <span>{currentLang === 'en' ? 'Listen' : 'सुनें'}</span>
            </button>
          </div>

          {readbackText && (
            <div className="p-3.5 bg-[#F7F9FC] border border-[#DCE3EA] rounded-xl text-xs sm:text-sm text-[#17365D] leading-relaxed">
              “{readbackText}”
            </div>
          )}

          {/* Voice Correction Bar on Readback Review */}
          <div className="p-3 rounded-xl bg-[#F0F7F6] border border-[#287D73]/25 flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <div className="text-xs font-bold text-[#17365D]">
                {currentLang === 'en'
                  ? 'Speak to confirm or correct any detail'
                  : currentLang === 'bho'
                  ? 'बोल के सही करीं या आगे बढ़ीं'
                  : 'बोलकर किसी भी जानकारी में सुधार करें या पुष्टि करें'}
              </div>
              <div className="text-[11px] text-[#5F6B76] truncate">
                {interimText || heardText
                  ? `“${interimText || heardText}”`
                  : currentLang === 'en'
                  ? 'Try: "Change my name to Ayush", "Edit city", or "Yes, looks good"'
                  : 'बोलें: "नाम आयुष गुप्ता कर दो", "शहर बदलना है", या "हाँ सही है"'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleMicButtonTap}
              disabled={conversationState === 'processing_answer'}
              className={`w-11 h-11 rounded-full flex items-center justify-center flex-none text-white transition-all ${
                conversationState === 'listening'
                  ? 'bg-[#245A91] ring-4 ring-[#245A91]/25'
                  : 'bg-[#287D73] hover:bg-[#1E6058]'
              }`}
              aria-label="Speak correction on review"
            >
              <Icon
                name={conversationState === 'processing_answer' ? 'refresh' : 'mic'}
                size={18}
                className={conversationState === 'processing_answer' ? 'animate-spin' : ''}
              />
            </button>
          </div>

          {aiReply && (
            <div className="text-xs p-3 rounded-xl bg-[#FFF8EE] border border-[#D9822B]/30 text-[#8F5517]">
              {aiReply}
            </div>
          )}

          {/* Summary Cards Grid (tap any card to edit that step directly) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <button
              type="button"
              onClick={() => askQuestionAloud(STEPS.findIndex((s) => s.key === 'name'))}
              className="p-3 bg-[#F7F9FC] hover:bg-[#EEF4FA] rounded-xl border border-[#DCE3EA] text-left transition-colors"
            >
              <span className="text-[11px] font-semibold text-[#5F6B76]">
                {currentLang === 'en' ? 'Name' : 'नाम'}
              </span>
              <div className="font-bold text-[#17365D] mt-0.5 text-sm">{answers.name || '—'}</div>
            </button>

            <button
              type="button"
              onClick={() => askQuestionAloud(STEPS.findIndex((s) => s.key === 'education'))}
              className="p-3 bg-[#F7F9FC] hover:bg-[#EEF4FA] rounded-xl border border-[#DCE3EA] text-left transition-colors"
            >
              <span className="text-[11px] font-semibold text-[#5F6B76]">
                {currentLang === 'en' ? 'Education' : 'शिक्षा'}
              </span>
              <div className="font-bold text-[#17365D] mt-0.5 text-sm">
                {speechService.localizeProfileValue('education', answers.education, currentLang) || '—'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => askQuestionAloud(STEPS.findIndex((s) => s.key === 'skills'))}
              className="p-3 bg-[#F7F9FC] hover:bg-[#EEF4FA] rounded-xl border border-[#DCE3EA] text-left transition-colors"
            >
              <span className="text-[11px] font-semibold text-[#5F6B76]">
                {currentLang === 'en' ? 'Skills' : 'हुनर / कौशल'}
              </span>
              <div className="font-bold text-[#17365D] mt-0.5">{answers.skills || '—'}</div>
            </button>

            <button
              type="button"
              onClick={() => askQuestionAloud(STEPS.findIndex((s) => s.key === 'interests'))}
              className="p-3 bg-[#F7F9FC] hover:bg-[#EEF4FA] rounded-xl border border-[#DCE3EA] text-left transition-colors"
            >
              <span className="text-[11px] font-semibold text-[#5F6B76]">
                {currentLang === 'en' ? 'Interests' : 'रुचि'}
              </span>
              <div className="font-bold text-[#17365D] mt-0.5">{answers.interests || '—'}</div>
            </button>

            <button
              type="button"
              onClick={() => askQuestionAloud(STEPS.findIndex((s) => s.key === 'location'))}
              className="p-3 bg-[#F7F9FC] hover:bg-[#EEF4FA] rounded-xl border border-[#DCE3EA] text-left transition-colors"
            >
              <span className="text-[11px] font-semibold text-[#5F6B76]">
                {currentLang === 'en' ? 'Exact Location' : 'सटीक स्थान'}
              </span>
              <div className="font-bold text-[#287D73] mt-0.5">{answers.location || '—'}</div>
            </button>

            <button
              type="button"
              onClick={() => askQuestionAloud(STEPS.findIndex((s) => s.key === 'workType'))}
              className="p-3 bg-[#F7F9FC] hover:bg-[#EEF4FA] rounded-xl border border-[#DCE3EA] text-left transition-colors"
            >
              <span className="text-[11px] font-semibold text-[#5F6B76]">
                {currentLang === 'en' ? 'Work Type' : 'काम का प्रकार'}
              </span>
              <div className="font-bold text-[#17365D] mt-0.5">
                {speechService.localizeProfileValue('workType', answers.workType || 'Job', currentLang)}
              </div>
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#DCE3EA]">
            <button
              type="button"
              onClick={() => {
                handleStopSpeaking();
                askQuestionAloud(STEPS.length - 1);
              }}
              className="min-h-[44px] px-4 py-3 rounded-xl border border-[#DCE3EA] text-xs font-bold text-[#17365D] hover:bg-[#F7F9FC] flex items-center gap-1.5"
            >
              <Icon name="arrowL" size={15} />
              <span>{currentLang === 'en' ? 'Back' : 'पीछे जाएँ'}</span>
            </button>

            <button
              type="button"
              onClick={handleConfirmAndGenerateRoadmap}
              className="flex-1 min-h-[44px] py-3.5 px-5 rounded-xl bg-[#17365D] hover:bg-[#245A91] text-white text-sm font-extrabold flex items-center justify-center gap-2 transition-colors"
            >
              <Icon name="check" size={18} />
              <span>
                {currentLang === 'en'
                  ? 'View Roadmap & Schemes →'
                  : 'रोडमैप और योजनाएं देखें →'}
              </span>
            </button>
          </div>
        </div>
      ) : (
        /* ======================== VOICE & QUESTION STUDIO ======================== */
        <div className="bg-white border border-[#DCE3EA] rounded-2xl overflow-hidden flex flex-col">
          {/* Question Header Card */}
          <div className="p-4 sm:p-5 bg-[#F7F9FC] border-b border-[#DCE3EA] space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#245A91]">
              <span className="tabular-nums">
                {currentStepIndex === -1
                  ? currentLang === 'en'
                    ? 'JeevikaAI Introduction'
                    : 'जीविका एआई परिचय'
                  : `${currentStepIndex + 1}. ${stepHeaderTitle}`}
              </span>
              <span className="text-[#287D73]">
                {conversationState === 'asking_question'
                  ? currentLang === 'en'
                    ? 'AI is speaking...'
                    : 'AI बोल रहा है...'
                  : conversationState === 'listening'
                  ? currentLang === 'en'
                    ? 'Mic is ON · Speak now'
                    : 'माइक चालू है · बोलिए'
                  : conversationState === 'processing_answer'
                  ? currentLang === 'en'
                    ? 'Understanding...'
                    : 'समझ रहा है...'
                  : currentLang === 'en'
                  ? 'Tap mic to speak'
                  : 'माइक दबाकर बोलें'}
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-extrabold text-[#17365D] leading-snug font-['Bricolage_Grotesque']">
              {currentStepIndex === -1
                ? getIntroGreeting(currentLang)
                : currentStepConfig
                ? getStepQuestionText(currentStepIndex, currentLang)
                : ''}
            </h1>
          </div>

          {/* Interactive Microphone & Waveform Studio */}
          <div className="px-4 py-5 flex flex-col items-center justify-center bg-white space-y-3">
            <div className="relative flex items-center justify-center">
              <button
                type="button"
                onClick={handleMicButtonTap}
                disabled={conversationState === 'processing_answer'}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                  conversationState === 'listening'
                    ? 'bg-[#245A91] text-white ring-4 ring-[#245A91]/25'
                    : conversationState === 'asking_question'
                    ? 'bg-[#287D73] text-white ring-4 ring-[#287D73]/20'
                    : conversationState === 'processing_answer'
                    ? 'bg-[#D9822B] text-white opacity-90'
                    : 'bg-[#17365D] text-white hover:bg-[#245A91]'
                }`}
                aria-label="Voice microphone control"
              >
                <Icon
                  name={conversationState === 'processing_answer' ? 'refresh' : 'mic'}
                  size={30}
                  className={conversationState === 'processing_answer' ? 'animate-spin' : ''}
                />
              </button>
            </div>

            <div className="w-full max-w-xs mx-auto">
              <AudioVisualizer
                isListening={conversationState === 'listening'}
                isSpeaking={conversationState === 'asking_question'}
                barCount={18}
              />
            </div>

            <p className="text-xs font-semibold text-[#5F6B76] text-center">
              {conversationState === 'asking_question'
                ? currentLang === 'en'
                  ? 'AI is speaking — finish listening or tap the mic to answer immediately'
                  : 'AI सवाल बोल रहा है — पूरा सुनें या तुरंत बोलने के लिए माइक दबाएं'
                : conversationState === 'listening'
                ? currentLang === 'en'
                  ? 'Speak now... your answer is being captured below'
                  : 'अब बोलिए... आपके शब्द नीचे अपने-आप लिखे जा रहे हैं'
                : currentLang === 'en'
                ? 'Tap the microphone to speak your answer'
                : 'अपना उत्तर बोलने के लिए माइक पर टैप करें'}
            </p>
          </div>

          {/* Structured App View Below the Mic */}
          <div className="px-4 pb-4 space-y-3.5">
            {currentStepIndex === -1 && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => askQuestionAloud(0)}
                  className="w-full sm:flex-1 min-h-[44px] py-3 px-5 rounded-xl bg-[#17365D] hover:bg-[#245A91] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Icon name="check" size={16} />
                  <span>
                    {currentLang === 'en'
                      ? 'Yes, Start Now'
                      : currentLang === 'bho'
                      ? 'हँ, शुरू करीं'
                      : 'हाँ, शुरू करें'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadDemoProfile}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-3 rounded-xl border border-[#DCE3EA] bg-[#F7F9FC] text-xs font-bold text-[#17365D] hover:bg-slate-200/70 transition-colors"
                >
                  {currentLang === 'en' ? 'Load Demo Profile' : 'डेमो प्रोफाइल देखें'}
                </button>
              </div>
            )}

            {/* Live Captured Answer Box (Steps 0..7) */}
            {currentStepIndex >= 0 && (
              <div className="rounded-xl border border-[#DCE3EA] bg-[#F7F9FC] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#17365D]">
                    {interimText || heardText
                      ? currentLang === 'en'
                        ? 'Your Spoken Answer'
                        : 'आपका बोला गया उत्तर'
                      : localizedCurrentFieldVal
                      ? currentLang === 'en'
                        ? 'Saved Answer'
                        : 'दर्ज उत्तर'
                      : currentLang === 'en'
                      ? 'Your answer will appear here'
                      : 'आपका उत्तर यहाँ दिखेगा'}
                  </span>
                  {(heardText || interimText || localizedCurrentFieldVal) && !isEditingTranscript && (
                    <button
                      type="button"
                      onClick={handleStartEditTranscript}
                      className="text-xs font-bold text-[#245A91] hover:underline px-2.5 py-1 rounded-lg bg-white border border-[#DCE3EA]"
                    >
                      {currentLang === 'en' ? 'Edit' : 'सुधारें'}
                    </button>
                  )}
                </div>

                {isEditingTranscript ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingTranscriptValue}
                      onChange={(e) => setEditingTranscriptValue(e.target.value)}
                      className="w-full p-2.5 bg-white border border-[#245A91] rounded-lg text-sm font-bold text-[#17365D] focus:outline-none"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingTranscript(false)}
                        className="px-3 py-1.5 text-xs font-bold text-[#5F6B76]"
                      >
                        {currentLang === 'en' ? 'Cancel' : 'रद्द करें'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEditedTranscript}
                        className="px-4 py-1.5 bg-[#17365D] text-white text-xs font-bold rounded-lg"
                      >
                        {currentLang === 'en' ? 'Save & Next' : 'सहेजें व आगे बढ़ें'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-[38px] flex items-center">
                    {interimText || heardText || localizedCurrentFieldVal ? (
                      <div className="w-full bg-white px-3 py-2 rounded-lg border border-[#DCE3EA] text-sm font-bold text-[#17365D] flex items-center justify-between gap-2">
                        <span>{interimText || heardText || localizedCurrentFieldVal}</span>
                        <Icon name="check" size={16} className="text-[#287D73] flex-none" />
                      </div>
                    ) : (
                      <span className="text-xs text-[#5F6B76]">
                        {currentStepConfig?.ph[currentLang] ||
                          currentStepConfig?.ph.hi ||
                          (currentLang === 'en'
                            ? 'Speak directly or choose an option below...'
                            : 'सीधे बोलें या नीचे विकल्प चुनें...')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Choice Options Grid */}
            {currentStepConfig && currentStepConfig.type === 'choice' && currentStepConfig.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentStepConfig.options.map((opt) => {
                  const isSelected = currentFieldVal === opt.v;
                  const label =
                    currentLang === 'bho'
                      ? opt.bho || opt.hi
                      : currentLang === 'en'
                      ? opt.v
                      : opt.hi;

                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => handleManualSelectOption(opt.v)}
                      className={`min-h-[44px] p-3 rounded-xl border text-left flex items-center justify-between text-xs sm:text-sm font-bold transition-colors ${
                        isSelected
                          ? 'border-[#17365D] bg-[#17365D] text-white'
                          : 'border-[#DCE3EA] bg-white text-[#17365D] hover:bg-[#F7F9FC]'
                      }`}
                    >
                      <span>{label}</span>
                      {isSelected && <Icon name="check" size={15} />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Skills / Interests Chips */}
            {currentStepConfig && currentStepConfig.type !== 'choice' && currentStepConfig.chips && (
              <div className="flex flex-wrap gap-1.5">
                {currentStepConfig.chips.map((c) => {
                  const label =
                    currentLang === 'bho' ? c.bho || c.hi : currentLang === 'en' ? c.en : c.hi;
                  const currList = splitList(currentFieldVal);
                  const isPicked = currList.includes(label);

                  return (
                    <button
                      key={c.en}
                      type="button"
                      onClick={() => {
                        const next = isPicked
                          ? currList.filter((x) => x !== label)
                          : [...currList, label];
                        const updated = next.join(', ');
                        setAnswers((prev) => ({
                          ...prev,
                          [currentStepConfig.key]: updated,
                        }));
                        profileRef.current = {
                          ...profileRef.current,
                          [currentStepConfig.key]: updated,
                        };
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        isPicked
                          ? 'border-[#245A91] bg-[#245A91] text-white'
                          : 'border-[#DCE3EA] bg-[#F7F9FC] text-[#17365D] hover:border-[#245A91]'
                      }`}
                    >
                      {isPicked ? '✓ ' : '+ '}
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* LOCATION STEP: Exact Auto-Fetch GPS Card */}
            {currentStepConfig && currentStepConfig.key === 'location' && (
              <div className="rounded-xl border border-[#DCE3EA] bg-[#F7F9FC] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-[#287D73]">
                      {currentLang === 'en'
                        ? 'Automatic GPS Location · Village/City & District'
                        : 'ऑटोमैटिक जीपीएस लोकेशन · सटीक गाँव/शहर और जिला'}
                    </div>
                    <p className="text-xs text-[#5F6B76]">
                      {currentLang === 'en'
                        ? 'Your exact village/town and district is used to show nearby jobs, training centers, and schemes.'
                        : 'डैशबोर्ड पर आपके सटीक गाँव/शहर और जिले की सरकारी योजनाएं व रोजगार दिखाने के लिए ऑटो-फेच चालू है।'}
                    </p>
                  </div>
                </div>

                {answers.location && (
                  <div className="p-3 bg-white border border-[#287D73]/40 rounded-xl flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-[#5F6B76]">
                        {currentLang === 'en' ? 'Detected Location:' : 'आपका सटीक स्थान:'}
                      </div>
                      <div className="text-sm font-extrabold text-[#17365D] truncate">
                        📍 {answers.location}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="min-h-[38px] px-3.5 py-2 bg-[#287D73] hover:bg-[#1E6058] text-white font-bold rounded-lg text-xs flex-none"
                    >
                      {currentLang === 'en' ? 'Continue →' : 'आगे बढ़ें →'}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDetectLocationGps}
                  disabled={isDetectingGps}
                  className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-[#17365D] hover:bg-[#245A91] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-75"
                >
                  <Icon
                    name={isDetectingGps ? 'refresh' : 'target'}
                    size={17}
                    className={isDetectingGps ? 'animate-spin' : ''}
                  />
                  <span>
                    {isDetectingGps
                      ? currentLang === 'en'
                        ? 'Detecting exact village/city & district...'
                        : 'सटीक गाँव/शहर और जिला खोजा जा रहा है...'
                      : currentLang === 'en'
                      ? '📍 Auto-Detect Exact GPS Location'
                      : '📍 सटीक जीपीएस लोकेशन ऑटो-फेच करें'}
                  </span>
                </button>
              </div>
            )}

            {/* Keyboard Input Box when in Text Mode */}
            {currentStepConfig && inputMode === 'text' && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentFieldVal}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAnswers((prev) => ({ ...prev, [currentStepConfig.key]: val }));
                    profileRef.current = { ...profileRef.current, [currentStepConfig.key]: val };
                  }}
                  placeholder={currentStepConfig.ph[currentLang] || currentStepConfig.ph.hi}
                  className="flex-1 p-3 rounded-xl border border-[#DCE3EA] text-sm focus:outline-none focus:border-[#245A91] bg-white text-[#17365D]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (currentFieldVal.trim()) {
                      processUtterance(currentFieldVal.trim(), currentStepIndex);
                    } else {
                      handleNextStep();
                    }
                  }}
                  className="min-h-[44px] px-4 py-3 rounded-xl bg-[#17365D] text-white text-xs font-bold"
                >
                  {currentLang === 'en' ? 'Submit' : 'दर्ज करें'}
                </button>
              </div>
            )}

            {aiReply && (
              <div className="text-xs p-3 rounded-xl bg-[#FFF8EE] border border-[#D9822B]/30 text-[#8F5517]">
                {aiReply}
              </div>
            )}

            {errorMessage && (
              <div className="text-xs p-3 rounded-xl bg-[#FDEDEC] text-[#9E2A2B] border border-[#9E2A2B]/20 font-medium">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Bottom Navigation Bar */}
          <div className="px-4 py-3 bg-[#F7F9FC] border-t border-[#DCE3EA] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handlePreviousStep}
              className="min-h-11 px-3.5 py-2 rounded-xl border border-[#DCE3EA] bg-white hover:bg-slate-100 text-xs font-extrabold text-[#17365D] flex items-center gap-1.5 transition-colors"
            >
              <Icon name="arrowL" size={15} />
              <span>{currentLang === 'en' ? 'Back' : 'पिछला'}</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleReplayQuestion}
                className="min-h-11 px-3 py-2 rounded-xl border border-[#DCE3EA] bg-white hover:bg-slate-100 text-xs font-bold text-[#17365D] flex items-center gap-1 transition-colors"
                title={currentLang === 'en' ? 'Replay Question' : 'सवाल फिर से सुनें'}
              >
                <Icon name="volume2" size={15} />
                <span className="hidden sm:inline">{currentLang === 'en' ? 'Listen' : 'सुनें'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputMode(inputMode === 'voice' ? 'text' : 'voice');
                }}
                className="min-h-11 px-3 py-2 rounded-xl border border-[#DCE3EA] bg-white hover:bg-slate-100 text-xs font-bold text-[#245A91] flex items-center gap-1 transition-colors"
              >
                <Icon name="edit" size={14} />
                <span>
                  {inputMode === 'voice'
                    ? currentLang === 'en'
                      ? 'Type'
                      : 'लिखें'
                    : currentLang === 'en'
                    ? 'Speak'
                    : 'बोलें'}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleNextStep}
              className="min-h-11 px-4 py-2 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors"
            >
              <span>{currentLang === 'en' ? 'Next' : 'अगला'}</span>
              <Icon name="arrowR" size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Privacy & Voice Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 bg-[#17365D]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DCE3EA] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#F7F9FC] text-[#245A91] flex items-center justify-center border border-[#DCE3EA]">
                <Icon name="mic" size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#17365D] font-['Bricolage_Grotesque']">
                  {currentLang === 'en'
                    ? 'Create Profile by Voice'
                    : currentLang === 'bho'
                    ? 'आवाज़ से प्रोफ़ाइल बनाईं'
                    : 'आवाज़ से प्रोफ़ाइल बनाएँ'}
                </h3>
                <p className="text-xs text-[#5F6B76]">
                  {currentLang === 'en'
                    ? 'Voice Livelihood Profile Setup'
                    : 'बोलकर आसान प्रोफ़ाइल निर्माण'}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#5F6B76] leading-relaxed">
              {currentLang === 'en'
                ? 'JeevikaAI will ask you a few simple questions aloud and automatically open the microphone for your answer.'
                : 'जीविका एआई आपसे बोलकर कुछ आसान सवाल पूछेगा और सवाल पूरा होते ही माइक अपने-आप चालू हो जाएगा।'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setInputMode('text');
                  localStorage.setItem('jeevika_consent_given', 'true');
                  setShowConsentModal(false);
                  setCurrentStepIndex(0);
                }}
                className="min-h-[42px] px-3.5 py-2.5 rounded-xl border border-[#DCE3EA] text-xs font-bold text-[#5F6B76] hover:text-[#17365D]"
              >
                {currentLang === 'en' ? 'Type Manually' : 'लिखकर भरें'}
              </button>
              <button
                type="button"
                onClick={() => startConversation()}
                className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#245A91] text-white text-xs font-bold hover:bg-[#17365D] flex items-center gap-1.5"
              >
                <Icon name="mic" size={14} />
                <span>{currentLang === 'en' ? 'Start Speaking' : 'बोलकर शुरू करें'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
