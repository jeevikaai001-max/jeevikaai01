import { useState, useRef, useCallback, useEffect } from 'react';
import {
  AssessmentStep,
  BeneficiaryProfile,
  ConversationState,
  SupportedLanguage,
} from '../types';
import {
  speechService,
  SpeechRecognitionResultWrapper,
  AssessmentTurnAction,
} from '../services/speechService';

export interface VoiceConversationTurn {
  role: 'user' | 'ai';
  text: string;
}

export interface UseVoiceAssessmentBridgeOptions {
  currentLang: SupportedLanguage;
  inputMode: 'voice' | 'text';
  steps: AssessmentStep[];
  getStepQuestionText: (stepIdx: number, lang: SupportedLanguage) => string;
  getProfile: () => BeneficiaryProfile;
  onApplyProfilePatch: (patch: Partial<BeneficiaryProfile>) => BeneficiaryProfile;
  onStepChange: (nextStepIdx: number) => void;
  onStateChange: (state: ConversationState) => void;
  onTriggerReadback: (lang: SupportedLanguage) => void;
  onConfirmSubmit: () => void;
  getReadbackText: () => string;
  getPrefetchedGps: () => string;
}

/**
 * Persistent voice-to-text bridge connected to the Cloudflare Worker Gemini API
 * (`/api/assessment-turn` via `speechService.extractWithGemini` -> `aiGateway.assessmentTurn`).
 *
 * Manages continuous SpeechRecognition re-arming, silence/final-transcript debouncing,
 * turn-epoch cancellation (preventing stale async responses), rolling conversation memory,
 * and real-time conversational navigation & profile corrections during onboarding.
 */
export function useVoiceAssessmentBridge(options: UseVoiceAssessmentBridgeOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [heardText, setHeardText] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [aiReply, setAiReply] = useState<string>('');
  const [lastCorrectionNotice, setLastCorrectionNotice] = useState<string>('');
  const [lastAction, setLastAction] = useState<AssessmentTurnAction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const activeStepRef = useRef<number>(-1);
  const turnInProgressRef = useRef<boolean>(false);
  const turnEpochRef = useRef<number>(0);
  const speechDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationHistoryRef = useRef<VoiceConversationTurn[]>([]);
  const mountedRef = useRef<boolean>(true);

  const clearTimers = useCallback(() => {
    if (speechDebounceTimerRef.current) {
      clearTimeout(speechDebounceTimerRef.current);
      speechDebounceTimerRef.current = null;
    }
    if (fallbackSilenceTimerRef.current) {
      clearTimeout(fallbackSilenceTimerRef.current);
      fallbackSilenceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      turnEpochRef.current++;
      clearTimers();
      speechService.stopSpeaking();
      speechService.stopListening();
    };
  }, [clearTimers]);

  const recordTurn = useCallback((role: 'user' | 'ai', text: string) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    conversationHistoryRef.current = [
      ...conversationHistoryRef.current.slice(-9),
      { role, text: clean },
    ];
  }, []);

  const setActiveStepIndex = useCallback((idx: number) => {
    activeStepRef.current = idx;
  }, []);

  const getActiveStepIndex = useCallback(() => activeStepRef.current, []);

  const clearTranscript = useCallback(() => {
    setHeardText('');
    setInterimText('');
    setErrorMessage('');
  }, []);

  const stopAllVoice = useCallback(() => {
    turnEpochRef.current++;
    clearTimers();
    speechService.stopSpeaking();
    speechService.stopListening();
    turnInProgressRef.current = false;
  }, [clearTimers]);

  const resetConversation = useCallback(() => {
    stopAllVoice();
    conversationHistoryRef.current = [];
    setHeardText('');
    setInterimText('');
    setAiReply('');
    setLastCorrectionNotice('');
    setLastAction(null);
    setErrorMessage('');
  }, [stopAllVoice]);

  const processUtteranceRef = useRef<(transcript: string, stepIdx: number) => Promise<void>>(
    async () => {}
  );

  const startListeningForStep = useCallback(
    (stepIdx: number, langOverride?: SupportedLanguage) => {
      const opts = optionsRef.current;
      const lang = langOverride || opts.currentLang;
      const sessionEpoch = turnEpochRef.current;

      activeStepRef.current = stepIdx;
      turnInProgressRef.current = false;
      setErrorMessage('');
      opts.onStateChange('listening');

      speechService.startListening(
        lang,
        (result: SpeechRecognitionResultWrapper) => {
          if (
            !mountedRef.current ||
            sessionEpoch !== turnEpochRef.current ||
            turnInProgressRef.current ||
            stepIdx !== activeStepRef.current
          ) {
            return;
          }

          opts.onStateChange('listening');
          setErrorMessage('');

          // Preserve full natural sentence so Cloudflare Worker Gemini understands
          // entity extraction, back/next navigation, in-place corrections & chitchat.
          const rawTranscript = String(result.transcript || '').trim().replace(/\s+/g, ' ');
          if (!rawTranscript) return;

          if (result.isFinal) {
            setInterimText('');
            setHeardText(rawTranscript);
            clearTimers();

            speechDebounceTimerRef.current = setTimeout(() => {
              if (
                mountedRef.current &&
                sessionEpoch === turnEpochRef.current &&
                !turnInProgressRef.current &&
                stepIdx === activeStepRef.current
              ) {
                processUtteranceRef.current(rawTranscript, stepIdx);
              }
            }, 600);
          } else {
            setInterimText(rawTranscript);
            setHeardText(rawTranscript);

            if (fallbackSilenceTimerRef.current) clearTimeout(fallbackSilenceTimerRef.current);
            fallbackSilenceTimerRef.current = setTimeout(() => {
              if (
                mountedRef.current &&
                sessionEpoch === turnEpochRef.current &&
                !turnInProgressRef.current &&
                stepIdx === activeStepRef.current
              ) {
                setHeardText(rawTranscript);
                processUtteranceRef.current(rawTranscript, stepIdx);
              }
            }, 1450);
          }
        },
        (errorMsg: string, code?: string) => {
          if (!mountedRef.current || sessionEpoch !== turnEpochRef.current) return;
          if (code === 'no-speech' || code === 'aborted') {
            if (!speechService.isCurrentlySpeaking()) {
              opts.onStateChange('listening');
            }
          } else {
            opts.onStateChange('recoverable_error');
            setErrorMessage(errorMsg);
          }
        },
        () => {
          // SpeechRecognition handles auto-restart while listening
        }
      );
    },
    [clearTimers]
  );

  const speakPromptAndListen = useCallback(
    (
      targetStepIdx: number,
      promptText: string,
      langOverride?: SupportedLanguage,
      stateOverride?: ConversationState
    ) => {
      const opts = optionsRef.current;
      const lang = langOverride || opts.currentLang;
      const epoch = ++turnEpochRef.current;

      clearTimers();
      speechService.stopListening();
      speechService.stopSpeaking();

      activeStepRef.current = targetStepIdx;
      turnInProgressRef.current = false;
      opts.onStepChange(targetStepIdx);
      opts.onStateChange(stateOverride || (targetStepIdx >= opts.steps.length ? 'readback_review' : 'asking_question'));

      if (promptText) {
        recordTurn('ai', promptText);
      }

      speechService.speak(promptText, lang, () => {
        if (
          mountedRef.current &&
          epoch === turnEpochRef.current &&
          optionsRef.current.inputMode === 'voice' &&
          activeStepRef.current === targetStepIdx &&
          !turnInProgressRef.current
        ) {
          startListeningForStep(targetStepIdx, lang);
        }
      });
    },
    [clearTimers, recordTurn, startListeningForStep]
  );

  const transitionToStep = useCallback(
    (
      targetStepIdx: number,
      leadMessage: string,
      lang: SupportedLanguage,
      includeQuestion = true
    ) => {
      const opts = optionsRef.current;
      if (targetStepIdx >= opts.steps.length) {
        const epoch = ++turnEpochRef.current;
        clearTimers();
        speechService.stopListening();
        speechService.stopSpeaking();
        activeStepRef.current = opts.steps.length;
        turnInProgressRef.current = false;
        opts.onStepChange(opts.steps.length);
        opts.onStateChange('readback_review');

        if (leadMessage) {
          recordTurn('ai', leadMessage);
          speechService.speak(leadMessage, lang, () => {
            if (mountedRef.current && epoch === turnEpochRef.current) {
              optionsRef.current.onTriggerReadback(lang);
            }
          });
        } else {
          opts.onTriggerReadback(lang);
        }
        return;
      }

      const safeIdx = Math.max(0, targetStepIdx);
      setHeardText('');
      setInterimText('');
      setErrorMessage('');

      const qText = includeQuestion ? opts.getStepQuestionText(safeIdx, lang) : '';
      const combined = [leadMessage, qText].filter(Boolean).join(' ').trim();
      speakPromptAndListen(safeIdx, combined, lang, 'asking_question');
    },
    [clearTimers, recordTurn, speakPromptAndListen]
  );

  const processUtterance = useCallback(
    async (transcript: string, stepIdx: number) => {
      const opts = optionsRef.current;
      if (turnInProgressRef.current || stepIdx !== activeStepRef.current) return;

      const rawSpoken = String(transcript || '').trim().replace(/\s+/g, ' ');
      if (!rawSpoken) return;

      turnInProgressRef.current = true;
      const epoch = ++turnEpochRef.current;
      clearTimers();
      speechService.stopListening();
      speechService.stopSpeaking();

      opts.onStateChange('processing_answer');
      setErrorMessage('');

      const lang = opts.currentLang;
      const isIntro = stepIdx === -1;
      const isReadback = stepIdx >= opts.steps.length;
      const currentStepConfig = !isIntro && !isReadback ? opts.steps[stepIdx] : null;
      const stepKey = isIntro ? 'intro' : isReadback ? 'readback' : currentStepConfig!.key;
      const questionText = isReadback
        ? opts.getReadbackText() ||
          (lang === 'en' ? 'Is all this information correct?' : 'क्या यह सभी जानकारी सही है?')
        : opts.getStepQuestionText(stepIdx, lang);

      recordTurn('user', rawSpoken);

      // Fast GPS confirmation shortcut on location step
      const currentProfile = opts.getProfile();
      const prefetchedGps = opts.getPrefetchedGps();
      if (stepKey === 'location' && (currentProfile.location || prefetchedGps)) {
        const lowerIn = rawSpoken.toLowerCase();
        const isConfirmingGps = ['हां', 'हाँ', 'सही', 'ठीक', 'जी', 'yes', 'ok', 'haan', 'sahi', 'theek', 'ha'].some(
          (w) => lowerIn === w || lowerIn === `${w} जी` || lowerIn === `${w} सही है`
        );
        if (isConfirmingGps) {
          const confirmedLoc = currentProfile.location || prefetchedGps;
          opts.onApplyProfilePatch({ location: confirmedLoc });
          speechService.playAudioCue('success');
          setLastAction('save_and_next');
          setLastCorrectionNotice('');
          transitionToStep(stepIdx + 1, '', lang, true);
          return;
        }
      }

      try {
        // Call Cloudflare Worker Gemini API (/api/assessment-turn -> local Express fallback -> Indic fallback)
        const aiResponse = await speechService.extractWithGemini(
          rawSpoken,
          lang,
          stepKey,
          opts.getProfile(),
          questionText,
          conversationHistoryRef.current
        );

        // Ignore stale response if user navigated/interrupted while waiting for Worker
        if (!mountedRef.current || epoch !== turnEpochRef.current) return;

        const action: AssessmentTurnAction =
          aiResponse.action || (aiResponse.needsClarification ? 'chat_and_stay' : 'save_and_next');
        const replyText =
          aiResponse.spokenReply || aiResponse.acknowledgment || aiResponse.clarificationQuestion || '';

        setLastAction(action);
        if (replyText) {
          setAiReply(replyText);
        }

        // Apply any multi-field extractions or real-time voice corrections
        const multiFields = aiResponse.multiFieldUpdates;
        if (multiFields && Object.keys(multiFields).length > 0) {
          opts.onApplyProfilePatch(multiFields as Partial<BeneficiaryProfile>);
        }

        // 1. Navigate backward
        if (action === 'go_back') {
          speechService.playAudioCue('clarify');
          const prevIdx = isReadback ? opts.steps.length - 1 : Math.max(0, stepIdx - 1);
          const lead =
            replyText ||
            (lang === 'bho'
              ? 'ठीक बा, पिछला सवाल पर चलत बानी।'
              : lang === 'en'
              ? 'Sure, going back to the previous question.'
              : 'ठीक है, पिछले सवाल पर चलते हैं।');
          setLastCorrectionNotice(lead);
          transitionToStep(prevIdx, lead, lang, true);
          return;
        }

        // 2. Skip / move forward
        if (action === 'go_next') {
          speechService.playAudioCue('success');
          const nextIdx = isIntro ? 0 : stepIdx + 1;
          const lead =
            replyText ||
            (lang === 'bho'
              ? 'ठीक बा, आगे बढ़त बानी।'
              : lang === 'en'
              ? 'Okay, moving forward.'
              : 'ठीक है, अगले सवाल पर चलते हैं।');
          setLastCorrectionNotice('');
          transitionToStep(nextIdx, lead, lang, true);
          return;
        }

        // 3. Repeat current question aloud
        if (action === 'repeat_question') {
          speechService.playAudioCue('clarify');
          if (isReadback) {
            turnInProgressRef.current = false;
            opts.onTriggerReadback(lang);
            return;
          }
          const q = opts.getStepQuestionText(stepIdx, lang);
          const prompt = replyText && replyText !== q ? `${replyText} ${q}` : q;
          setAiReply(prompt);
          speakPromptAndListen(stepIdx, prompt, lang, 'asking_question');
          return;
        }

        // 4. Jump directly to any named step ("शहर बदलना है", "नाम गलत है")
        if (action === 'jump_to_step' && aiResponse.targetStep) {
          const targetIdx = opts.steps.findIndex((s) => s.key === aiResponse.targetStep);
          if (targetIdx >= 0) {
            speechService.playAudioCue('clarify');
            const lead =
              replyText ||
              (lang === 'en'
                ? `Sure, let's update your ${aiResponse.targetStep}.`
                : 'ठीक है, चलिए उस जानकारी को सुधारते हैं।');
            setLastCorrectionNotice(lead);
            transitionToStep(targetIdx, lead, lang, true);
            return;
          }
        }

        // 5. Real-time in-place field correction ("मेरा नाम बदलकर आयुष गुप्ता कर दो")
        if (action === 'edit_field') {
          speechService.playAudioCue('success');
          if (aiResponse.cleanValue && !isIntro && !isReadback) {
            const cleanEdited =
              stepKey === 'name'
                ? speechService.deduplicateSpokenText(aiResponse.cleanValue, true)
                : aiResponse.cleanValue.trim();
            opts.onApplyProfilePatch({ [stepKey]: cleanEdited } as Partial<BeneficiaryProfile>);
          }
          const lead =
            replyText ||
            (lang === 'bho'
              ? 'जानकारी सुधार दिहल गइल बा।'
              : lang === 'en'
              ? 'Updated that detail for you!'
              : 'जी, आपकी जानकारी सुधार दी गई है।');
          setLastCorrectionNotice(lead);

          if (isReadback) {
            setAiReply(lead);
            recordTurn('ai', lead);
            turnInProgressRef.current = false;
            speechService.speak(lead, lang, () => {
              if (mountedRef.current && epoch === turnEpochRef.current) {
                optionsRef.current.onTriggerReadback(lang);
              }
            });
            return;
          }

          transitionToStep(stepIdx, lead, lang, true);
          return;
        }

        // 6. Readback review confirmation / refinement
        if (isReadback) {
          if (action === 'confirm_submit') {
            speechService.playAudioCue('success');
            setLastCorrectionNotice('');
            opts.onConfirmSubmit();
            return;
          }
          const stayPrompt =
            replyText ||
            (lang === 'en'
              ? 'Which detail would you like to change — name, education, skills, or location?'
              : 'कौन सी जानकारी बदलनी है — नाम, पढ़ाई, हुनर या शहर? बोलकर बताएं।');
          setAiReply(stayPrompt);
          speakPromptAndListen(opts.steps.length, stayPrompt, lang, 'readback_review');
          return;
        }

        // 7. Natural chitchat / off-topic question / unclear utterance -> respond warmly & stay on step
        if (action === 'chat_and_stay' || (aiResponse.needsClarification && !aiResponse.cleanValue)) {
          const clarifyText =
            replyText ||
            aiResponse.clarificationQuestion ||
            (lang === 'en'
              ? `Could you please repeat that? ${questionText}`
              : `कृपया फिर से बताइए। ${questionText}`);
          setAiReply(clarifyText);
          speechService.playAudioCue('clarify');
          setHeardText('');
          setInterimText('');
          speakPromptAndListen(stepIdx, clarifyText, lang, 'asking_question');
          return;
        }

        // 8. Intro greeting turn
        if (isIntro) {
          if (action === 'start_negative' || aiResponse.recognizedIntent === 'start_negative') {
            opts.onStateChange('idle');
            if (replyText) {
              setAiReply(replyText);
              recordTurn('ai', replyText);
              speechService.speak(replyText, lang);
            }
            turnInProgressRef.current = false;
            return;
          }

          speechService.playAudioCue('success');
          setLastCorrectionNotice('');
          const latest = opts.getProfile();
          const firstUnfilledIdx = opts.steps.findIndex((s) => !String(latest[s.key] || '').trim());
          const startIdx = firstUnfilledIdx >= 0 ? firstUnfilledIdx : 0;
          transitionToStep(startIdx, startIdx > 0 ? replyText : '', lang, true);
          return;
        }

        // 9. Standard save_and_next with clean Gemini-extracted value
        const extractedVal = aiResponse.cleanValue
          ? stepKey === 'name'
            ? speechService.deduplicateSpokenText(aiResponse.cleanValue, true)
            : aiResponse.cleanValue.trim()
          : speechService.deduplicateSpokenText(rawSpoken, stepKey === 'name');

        const updatedProfile = opts.onApplyProfilePatch({
          [stepKey]: extractedVal,
        } as Partial<BeneficiaryProfile>);

        speechService.playAudioCue('success');
        setLastCorrectionNotice('');

        const ack =
          replyText ||
          (lang === 'bho' ? 'नोट हो गइल।' : lang === 'en' ? 'Noted.' : 'नोट कर लिया है।');

        // Smoothly skip already-filled future steps if the user shared multiple details in one sentence
        let nextStepIdx = stepIdx + 1;
        if (multiFields && Object.keys(multiFields).length > 1) {
          while (
            nextStepIdx < opts.steps.length &&
            Boolean(String(updatedProfile[opts.steps[nextStepIdx].key] || '').trim()) &&
            opts.steps[nextStepIdx].key !== 'location'
          ) {
            nextStepIdx++;
          }
        }

        transitionToStep(nextStepIdx, ack, lang, true);
      } catch (err) {
        if (!mountedRef.current || epoch !== turnEpochRef.current) return;
        console.error('Voice bridge turn error:', err);
        opts.onStateChange('recoverable_error');
        setErrorMessage(
          lang === 'en'
            ? 'Could not process voice. Please tap the mic and speak again.'
            : 'आवाज़ समझने में समस्या हुई। कृपया माइक दबाकर दोबारा बोलें।'
        );
        turnInProgressRef.current = false;
      }
    },
    [clearTimers, recordTurn, speakPromptAndListen, transitionToStep]
  );

  processUtteranceRef.current = processUtterance;

  return {
    heardText,
    interimText,
    aiReply,
    lastCorrectionNotice,
    lastAction,
    errorMessage,
    setHeardText,
    setInterimText,
    setAiReply,
    setErrorMessage,
    clearTranscript,
    startListeningForStep,
    speakPromptAndListen,
    transitionToStep,
    processUtterance,
    stopAllVoice,
    resetConversation,
    recordTurn,
    setActiveStepIndex,
    getActiveStepIndex,
  };
}
