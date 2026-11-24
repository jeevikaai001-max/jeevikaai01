import { SupportedLanguage, BeneficiaryProfile, StepOption } from '../types';
import { EDU, WORK, MOB, SKILL_CHIPS, INTEREST_CHIPS } from '../data/mockData';
import { voiceVocabularyCache } from './voiceVocabularyCache';
import { aiGateway } from './aiGateway';

export interface SpeechRecognitionResultWrapper {
  transcript: string;
  isFinal: boolean;
}

export type AssessmentTurnAction =
  | 'save_and_next'
  | 'go_back'
  | 'go_next'
  | 'jump_to_step'
  | 'edit_field'
  | 'repeat_question'
  | 'chat_and_stay'
  | 'confirm_submit'
  | 'start_affirmative'
  | 'start_negative';

export interface ExtractedAIResponse {
  action?: AssessmentTurnAction;
  recognizedIntent?: string;
  cleanValue?: string;
  multiFieldUpdates?: Partial<Record<keyof BeneficiaryProfile, string>>;
  targetStep?: keyof BeneficiaryProfile | null;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion?: string;
  acknowledgment?: string;
  spokenReply?: string;
  suggestedNextTopic?: string;
}

export type SpeechCallback = (result: SpeechRecognitionResultWrapper) => void;
export type SpeechErrorCallback = (error: string, code?: string) => void;
export type SpeechEndCallback = () => void;

class SpeechService {
  private recognition: any = null;
  private isListening: boolean = false;
  private isSpeaking: boolean = false;
  private currentSpokenText: string = '';
  private lastSpokenText: string = '';
  private lastSpokenEndTime: number = 0;
  private speechTimeout: any = null;
  private speakStartTimer: any = null;
  private activeSessionId: number = 0;
  private activeSpeakId: number = 0;
  private audioCtx: AudioContext | null = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private activeAudioNodes: Array<AudioScheduledSourceNode> = [];
  private interruptionHandler: (() => void) | null = null;
  private isOfflineMode: boolean = typeof navigator !== 'undefined' ? !navigator.onLine : false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', () => {
        this.isOfflineMode = true;
      });
      window.addEventListener('online', () => {
        this.isOfflineMode = false;
      });
      // Pre-warm speechSynthesis voices list in browser
      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.getVoices();
          window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
          };
        } catch {
          // Ignore
        }
      }
    }
  }

  /**
   * Registers an interruption callback invoked when the user explicitly interrupts AI audio.
   */
  public setInterruptionHandler(handler: (() => void) | null): void {
    this.interruptionHandler = handler;
  }

  /**
   * Immediately halts any active AI audio playback, flushes the synthesis & Web Audio
   * buffers, and notifies the registered interruption handler so UI transitions to 'listening'.
   */
  public interruptAndClearAudioBuffer(triggerCallback: boolean = true): boolean {
    const wasSpeaking = this.isCurrentlySpeaking();
    this.stopSpeaking();

    // Flush any active Web Audio nodes/buffers
    if (this.activeAudioNodes.length > 0) {
      for (const node of this.activeAudioNodes) {
        try {
          node.stop();
          node.disconnect();
        } catch {
          // Ignore already stopped nodes
        }
      }
      this.activeAudioNodes = [];
    }

    if (wasSpeaking && triggerCallback && this.interruptionHandler) {
      try {
        this.interruptionHandler();
      } catch {
        // Non-blocking callback
      }
    }

    return wasSpeaking;
  }

  /**
   * Checks if a recognized transcript is actually echo from the AI's own recent speech.
   */
  private isLikelyEchoOfAiSpeech(heardText: string): boolean {
    if (this.isCurrentlySpeaking()) {
      return true;
    }

    const normHeard = heardText.toLowerCase().replace(/[?,.!।\-"]/g, '').trim();
    if (!normHeard) return true;

    const elapsedSinceSpeechEnd = Date.now() - this.lastSpokenEndTime;
    const referenceTexts: string[] = [];
    if (this.currentSpokenText) referenceTexts.push(this.currentSpokenText);
    if (this.lastSpokenText && elapsedSinceSpeechEnd < 2400) {
      referenceTexts.push(this.lastSpokenText);
    }

    for (const ref of referenceTexts) {
      const normRef = ref.toLowerCase().replace(/[?,.!।\-"]/g, '').trim();
      if (!normRef) continue;
      if (normHeard.length >= 2 && normRef.includes(normHeard)) {
        return true;
      }
      const heardWords = normHeard.split(/\s+/).filter((w) => w.length >= 2);
      if (heardWords.length >= 1) {
        const refWords = new Set(normRef.split(/\s+/));
        const matchCount = heardWords.filter((w) => refWords.has(w)).length;
        if (elapsedSinceSpeechEnd < 900 && matchCount >= 1) {
          return true;
        }
        if (heardWords.length >= 2 && matchCount / heardWords.length >= 0.65) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Deduplicates repeated words and repeated multi-word sequences from spoken transcripts.
   * For example:
   * - "राहुल कुमार राहुल कुमार" -> "राहुल कुमार"
   * - "मेरा नाम सुनीता देवी है सुनीता देवी" -> "सुनीता देवी"
   * - "सिलाई सिलाई कढ़ाई" -> "सिलाई कढ़ाई"
   */
  public deduplicateSpokenText(rawText: string, isNameField: boolean = false): string {
    if (!rawText || !rawText.trim()) return '';

    let text = rawText.trim().replace(/\s+/g, ' ');

    if (isNameField) {
      // Remove conversational prefixes/suffixes around names in Hindi, Bhojpuri, Hinglish, and English
      text = text
        .replace(
          /(?:जी\s+|सर\s+|मैडम\s+|हाँ\s+|हां\s+|हेलो\s+|नमस्ते\s+|hello\s+|hi\s+|ji\s+|sir\s+)?(?:मेरा\s+नाम|मेरा\s+नेम|हमार\s+नाम|हमर\s+नाम|नाम\s+है|नाम\s+बा|नाम|मैं|हम|my\s+name\s+is|my\s+name|mera\s+naam|mera\s+name|hamar\s+naam|hamaar\s+naam|naam\s+hai|name\s+is|i\s+am|this\s+is)\s+/gi,
          ' '
        )
        .replace(
          /\s+(?:है|बा|हवे|हूँ|हूं|जी|सर|बोल\s+रहा\s+हूँ|बोल\s+रही\s+हूँ|बोल\s+रहा|बोल\s+रही|कहते\s+हैं|hai|he|ba|hu|hun|hoon|ji|bol\s+raha\s+hu|bol\s+raha\s+hoon|bol\s+rahi\s+hu)\b\.?/gi,
          ' '
        )
        .replace(/\s+/g, ' ')
        .trim();
    }

    const words = text.split(' ').filter(Boolean);
    if (words.length <= 1) return words.join(' ');

    // 1. Remove consecutive duplicate single words (case-insensitive)
    const singleDedup: string[] = [];
    for (const w of words) {
      const cleanW = w.replace(/[.,!?।]/g, '').toLowerCase();
      const prevW = singleDedup.length > 0 ? singleDedup[singleDedup.length - 1].replace(/[.,!?।]/g, '').toLowerCase() : '';
      if (cleanW && cleanW !== prevW) {
        singleDedup.push(w);
      }
    }

    // 2. Remove repeated 2-word or 3-word sequences (e.g. "Sunita Devi Sunita Devi")
    const nGramDedup = (arr: string[], n: number): string[] => {
      if (arr.length < n * 2) return arr;
      const out: string[] = [];
      let i = 0;
      while (i < arr.length) {
        if (i + n * 2 <= arr.length) {
          const chunk1 = arr.slice(i, i + n).map((x) => x.toLowerCase()).join(' ');
          const chunk2 = arr.slice(i + n, i + n * 2).map((x) => x.toLowerCase()).join(' ');
          if (chunk1 === chunk2) {
            out.push(...arr.slice(i, i + n));
            i += n * 2;
            while (
              i + n <= arr.length &&
              arr.slice(i, i + n).map((x) => x.toLowerCase()).join(' ') === chunk1
            ) {
              i += n;
            }
            continue;
          }
        }
        out.push(arr[i]);
        i++;
      }
      return out;
    };

    let cleaned = nGramDedup(singleDedup, 3);
    cleaned = nGramDedup(cleaned, 2);
    cleaned = nGramDedup(cleaned, 1);

    // 3. For name fields, ensure unique tokens if someone said "Rahul Kumar Rahul"
    if (isNameField && cleaned.length > 1) {
      const seen = new Set<string>();
      const uniqueNameTokens: string[] = [];
      for (const token of cleaned) {
        const key = token.replace(/[.,!?।]/g, '').toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          uniqueNameTokens.push(token.replace(/[.,!?।]/g, ''));
        }
      }
      return uniqueNameTokens.slice(0, 3).join(' ').trim();
    }

    return cleaned.join(' ').trim();
  }

  public isSpeechRecognitionSupported(): boolean {
    return typeof window !== 'undefined' && Boolean(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    );
  }

  public isOffline(): boolean {
    if (typeof navigator !== 'undefined') {
      return !navigator.onLine || this.isOfflineMode;
    }
    return this.isOfflineMode;
  }

  public setOfflineMode(enabled: boolean): void {
    this.isOfflineMode = enabled;
  }

  public getCachedVocabulary() {
    return voiceVocabularyCache.getAll();
  }

  public getVocabCategories() {
    return voiceVocabularyCache.getCategories();
  }

  public matchCachedCommand(query: string) {
    return voiceVocabularyCache.findBestMatch(query);
  }

  public isSpeechSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public isCurrentlySpeaking(): boolean {
    return this.isSpeaking || (typeof window !== 'undefined' && Boolean(window.speechSynthesis?.speaking));
  }

  public isCurrentlyListening(): boolean {
    return this.isListening;
  }

  public async requestMicrophonePermission(): Promise<boolean> {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  public playAudioCue(type: 'listen_start' | 'success' | 'clarify' = 'listen_start') {
    try {
      if (typeof window === 'undefined') return;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      this.activeAudioNodes.push(osc);
      osc.onended = () => {
        this.activeAudioNodes = this.activeAudioNodes.filter((n) => n !== osc);
      };

      const now = this.audioCtx.currentTime;
      gain.gain.setValueAtTime(0.001, now);

      if (type === 'listen_start') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.06, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.06, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'clarify') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(370, now + 0.14);
        gain.gain.exponentialRampToValueAtTime(0.05, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch {
      // Non-blocking cue
    }
  }

  /**
   * Starts speech recognition cleanly AFTER AI speech has stopped,
   * preventing speaker feedback/self-transcription and browser audio channel conflicts.
   */
  public startListening(
    lang: SupportedLanguage,
    onResult: SpeechCallback,
    onError: SpeechErrorCallback,
    onEnd: SpeechEndCallback,
    _keepSpeaking: boolean = false
  ) {
    if (!this.isSpeechRecognitionSupported()) {
      onError('इस ब्राउज़र में वॉइस सपोर्ट नहीं है। कृपया लिखकर जवाब दें।', 'unsupported');
      return;
    }

    // Ensure TTS is completely stopped before opening the microphone so the mic never hears the AI's own voice
    this.stopSpeaking();
    this.stopListening();

    const sessionId = ++this.activeSessionId;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    try {
      this.recognition = new SpeechRec();
    } catch {
      onError('माइक शुरू नहीं हो सका। कृपया लिखकर जवाब दें।', 'init_fail');
      return;
    }

    const langCode = (lang === 'hi' || lang === 'bho' || lang === 'hin') ? 'hi-IN' : 'en-IN';
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    this.recognition.lang = langCode;
    this.recognition.interimResults = true;
    this.recognition.continuous = !isMobile;
    this.recognition.maxAlternatives = 1;

    const SpeechGrammarListClass = (window as any).SpeechGrammarList || (window as any).webkitSpeechGrammarList;
    if (SpeechGrammarListClass) {
      try {
        const grammarList = new SpeechGrammarListClass();
        const jsgf = voiceVocabularyCache.generateJSGFGrammar(lang);
        grammarList.addFromString(jsgf, 1);
        this.recognition.grammars = grammarList;
      } catch {
        // Safe fallback
      }
    }

    let lastKnownTranscript = '';

    this.recognition.onstart = () => {
      if (sessionId !== this.activeSessionId) return;
      this.isListening = true;
      lastKnownTranscript = '';
      if (!isMobile) {
        this.playAudioCue('listen_start');
      }
    };

    this.recognition.onresult = (event: any) => {
      if (sessionId !== this.activeSessionId) return;

      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const rawText = (finalTranscript || interimTranscript).trim();
      if (!rawText) return;

      // Strict echo filter: never write the AI's own spoken prompt if room echo was picked up
      if (this.isLikelyEchoOfAiSpeech(rawText)) {
        return;
      }

      const dedupedText = this.deduplicateSpokenText(rawText, false);
      const isFinal = Boolean(event.results[event.results.length - 1]?.isFinal);

      if (dedupedText) {
        lastKnownTranscript = dedupedText;
        if (isFinal) {
          voiceVocabularyCache.addPhrase(dedupedText, 'navigation', lang);
        }
        onResult({ transcript: dedupedText, isFinal });
      }
    };

    this.recognition.onerror = (event: any) => {
      if (sessionId !== this.activeSessionId) return;

      const code = event && event.error;
      let msg = lang === 'en'
        ? 'Voice capture encountered an issue. Please tap the mic again.'
        : 'आवाज़ सुनने में समस्या आई। कृपया माइक दबाकर दोबारा बोलें।';

      if (code === 'not-allowed' || code === 'service-not-allowed') {
        msg = lang === 'en'
          ? 'Microphone access is blocked. Please allow microphone permission.'
          : 'माइक की अनुमति बंद है। कृपया ब्राउज़र में माइक की अनुमति दें।';
      } else if (code === 'no-speech') {
        msg = lang === 'en'
          ? 'No speech heard. Please tap the mic and speak.'
          : 'कोई आवाज़ नहीं सुनाई दी। कृपया माइक दबाकर बोलें।';
      } else if (code === 'audio-capture') {
        msg = lang === 'en'
          ? 'No microphone found on this device.'
          : 'इस डिवाइस पर माइक नहीं मिला।';
      } else if (code === 'network') {
        this.isOfflineMode = true;
        if (lastKnownTranscript) {
          const salvaged = voiceVocabularyCache.findBestMatch(lastKnownTranscript);
          if (salvaged && salvaged.score >= 0.35) {
            this.isListening = false;
            onResult({ transcript: salvaged.item.phrase, isFinal: true });
            return;
          }
        }
        msg = lang === 'en'
          ? 'Network connection lost. Offline Voice Cache active.'
          : 'इंटरनेट कनेक्शन नहीं है। ऑफ़लाइन वॉइस कैश सक्रिय है।';
      }

      if (code !== 'no-speech' && code !== 'aborted') {
        this.isListening = false;
        onError(msg, code);
      }
    };

    this.recognition.onend = () => {
      if (sessionId !== this.activeSessionId) return;

      if (this.isListening && !this.isSpeaking) {
        setTimeout(() => {
          if (sessionId === this.activeSessionId && this.isListening && !this.isSpeaking) {
            try {
              this.recognition.start();
            } catch {
              // Soft catch
            }
          }
        }, 150);
        return;
      }

      this.isListening = false;
      onEnd();
    };

    try {
      this.recognition.start();
    } catch {
      this.isListening = false;
      onError(lang === 'en' ? 'Unable to open microphone.' : 'माइक शुरू नहीं हो सका।', 'start_fail');
    }
  }

  public stopListening() {
    this.activeSessionId++;
    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onspeechstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        if (typeof this.recognition.abort === 'function') {
          this.recognition.abort();
        } else if (typeof this.recognition.stop === 'function') {
          this.recognition.stop();
        }
      } catch {
        // Safe ignore
      }
      this.recognition = null;
    }
    this.isListening = false;
  }

  /**
   * Speak aloud using browser Text-to-Speech (TTS).
   * Stops active SpeechRecognition first so microphone never conflicts with or records TTS output,
   * and waits 60ms after cancel() to avoid Chromium's synchronous cancel+speak bug.
   */
  public speak(text: string, lang: SupportedLanguage, onEnd?: () => void) {
    if (!this.isSpeechSynthesisSupported() || !text || !text.trim()) {
      if (onEnd) onEnd();
      return;
    }

    // Stop listening while AI is speaking so mic does not record AI's own voice or abort TTS
    this.stopListening();
    this.stopSpeaking();

    const speakId = ++this.activeSpeakId;
    const cleanText = text.replace(/\*\*/g, '').replace(/[#•]/g, '').trim();
    this.currentSpokenText = cleanText;
    this.isSpeaking = true;

    this.speakStartTimer = setTimeout(() => {
      if (speakId !== this.activeSpeakId) return;

      try {
        if (this.speechTimeout) clearTimeout(this.speechTimeout);

        const utterance = new SpeechSynthesisUtterance(cleanText);
        this.activeUtterance = utterance;

        const isIndic = lang === 'hi' || lang === 'bho' || lang === 'hin';
        utterance.lang = isIndic ? 'hi-IN' : 'en-IN';
        utterance.rate = 0.96;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          if (isIndic) {
            // Only assign a voice if an actual Hindi/Indian voice exists; never force an English-only voice on Devanagari text
            const hindiVoice =
              voices.find((v) => v.lang.toLowerCase().includes('hi-in') || v.lang.toLowerCase().startsWith('hi')) ||
              voices.find((v) => v.name.toLowerCase().includes('hindi') || v.name.toLowerCase().includes('सहायक'));
            if (hindiVoice) {
              utterance.voice = hindiVoice;
            }
          } else {
            const englishVoice =
              voices.find((v) => v.lang.toLowerCase().includes('en-in')) ||
              voices.find((v) => v.lang.toLowerCase().startsWith('en'));
            if (englishVoice) {
              utterance.voice = englishVoice;
            }
          }
        }

        const speakStartedAt = Date.now();
        let hasFinished = false;

        const finishExecution = () => {
          if (hasFinished || speakId !== this.activeSpeakId) return;

          // If the browser speech synthesis engine is still actively speaking, wait until it genuinely finishes
          if (
            typeof window !== 'undefined' &&
            window.speechSynthesis?.speaking &&
            Date.now() - speakStartedAt < 45000
          ) {
            this.speechTimeout = setTimeout(finishExecution, 250);
            return;
          }

          hasFinished = true;
          this.isSpeaking = false;
          this.lastSpokenText = cleanText;
          this.lastSpokenEndTime = Date.now();
          this.currentSpokenText = '';
          this.activeUtterance = null;
          if (this.speechTimeout) {
            clearTimeout(this.speechTimeout);
            this.speechTimeout = null;
          }
          // Wait 450ms after hardware speech synthesis completely ends so speaker buffer & room echo dissipate before mic opens
          this.speechTimeout = setTimeout(() => {
            if (speakId === this.activeSpeakId && !this.isSpeaking && onEnd) {
              onEnd();
            }
          }, 450);
        };

        utterance.onend = () => {
          finishExecution();
        };

        utterance.onerror = (event: any) => {
          const errType = event?.error || '';
          // If speech was explicitly canceled/interrupted by stopSpeaking, do not trigger auto-listen onEnd
          if (errType === 'canceled' || errType === 'interrupted') {
            return;
          }
          const elapsed = Date.now() - speakStartedAt;
          if (elapsed < 150) {
            this.speechTimeout = setTimeout(finishExecution, 600);
          } else {
            finishExecution();
          }
        };

        const estimatedDurationMs = Math.max(3000, cleanText.length * 105 + 2000);
        this.speechTimeout = setTimeout(finishExecution, estimatedDurationMs);

        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch {
        this.isSpeaking = false;
        this.currentSpokenText = '';
        this.activeUtterance = null;
        if (speakId === this.activeSpeakId && onEnd) onEnd();
      }
    }, 80);
  }

  public stopSpeaking() {
    this.activeSpeakId++;
    if (this.speakStartTimer) {
      clearTimeout(this.speakStartTimer);
      this.speakStartTimer = null;
    }
    if (this.currentSpokenText) {
      this.lastSpokenText = this.currentSpokenText;
      this.lastSpokenEndTime = Date.now();
    }
    this.currentSpokenText = '';
    if (this.activeUtterance) {
      try {
        this.activeUtterance.onend = null;
        this.activeUtterance.onerror = null;
      } catch {
        // Ignore
      }
      this.activeUtterance = null;
    }
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
    if (this.isSpeechSynthesisSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Safe ignore
      }
      this.isSpeaking = false;
    }
  }

  /**
   * Conversational Gemini-first profile interpretation:
   * Always sends the raw spoken utterance + conversation context to Gemini (/api/assessment-turn via Worker/Express)
   * so natural sentences ("मेरा नाम आयुष है"), casual questions ("कैसे हो"), corrections ("नाम बदलकर आयुष गुप्ता कर दो"),
   * and voice navigation ("पीछे चलो", "आगे बढ़ो", "शहर बदलना है") are understood accurately.
   * Falls back cleanly to the upgraded local Indic engine ONLY when offline or API is unreachable.
   */
  public async extractWithGemini(
    message: string,
    language: SupportedLanguage,
    currentStepKey: string,
    existingProfile: BeneficiaryProfile,
    stepQuestion: string,
    conversationHistory: Array<{ role: 'user' | 'ai'; text: string }> = []
  ): Promise<ExtractedAIResponse> {
    const rawSpoken = String(message || '').trim().replace(/\s+/g, ' ');
    if (!rawSpoken) {
      return {
        action: 'repeat_question',
        confidence: 0,
        needsClarification: true,
        clarificationQuestion: stepQuestion,
        spokenReply: stepQuestion,
      };
    }

    if (!this.isOffline()) {
      try {
        const data = await aiGateway.assessmentTurn({
          message: rawSpoken,
          language,
          currentStep: currentStepKey,
          existingProfile,
          stepQuestion,
          conversationHistory,
        });

        if (data && !data.fallback && data.result) {
          const r = data.result;
          const action: AssessmentTurnAction = (r.action as AssessmentTurnAction) || 'save_and_next';
          const rawClean = typeof r.cleanValue === 'string' ? r.cleanValue.trim() : '';
          const cleanedVal =
            rawClean && currentStepKey === 'name'
              ? this.deduplicateSpokenText(rawClean, true)
              : rawClean;

          const multiUpdates: Partial<Record<keyof BeneficiaryProfile, string>> = {};
          if (r.multiFieldUpdates && typeof r.multiFieldUpdates === 'object') {
            for (const [k, v] of Object.entries(r.multiFieldUpdates)) {
              if (typeof v === 'string' && v.trim()) {
                (multiUpdates as any)[k] =
                  k === 'name' ? this.deduplicateSpokenText(v.trim(), true) : v.trim();
              }
            }
          }

          return {
            action,
            recognizedIntent: r.recognizedIntent || currentStepKey,
            cleanValue: cleanedVal,
            multiFieldUpdates: Object.keys(multiUpdates).length > 0 ? multiUpdates : undefined,
            targetStep: r.targetStep || null,
            confidence: typeof r.confidence === 'number' ? r.confidence : 0.94,
            needsClarification: Boolean(r.needsClarification || action === 'chat_and_stay'),
            clarificationQuestion: r.clarificationQuestion || r.spokenReply || '',
            acknowledgment: r.acknowledgment || r.spokenReply || '',
            spokenReply: r.spokenReply || r.acknowledgment || r.clarificationQuestion || '',
          };
        }
      } catch {
        // Fall through to resilient Indic rule engine below
      }
    }

    return this.fallbackIndicExtraction(rawSpoken, language, currentStepKey);
  }

  /**
   * Upgraded Indic + English Fallback Engine (used only when offline or Gemini API is unavailable).
   * Handles voice navigation (back/next/repeat/jump), casual chitchat detection, clean name extraction,
   * and fuzzy matching across Hindi, Bhojpuri, Hinglish, and English.
   */
  public fallbackIndicExtraction(
    speech: string,
    lang: SupportedLanguage,
    stepKey: string
  ): ExtractedAIResponse {
    const rawUnstripped = String(speech || '').trim().replace(/\s+/g, ' ');
    const lowerRaw = rawUnstripped.toLowerCase();

    // 0A. Voice Navigation & Edit Commands (work on any step)
    const backTriggers = ['पीछे', 'पिछला', 'बैक', 'गलत हो गया', 'piche', 'peeche', 'pichla', 'go back', 'previous', 'back'];
    if (backTriggers.some((w) => lowerRaw.includes(w))) {
      const reply =
        lang === 'bho'
          ? 'ठीक बा, पिछला सवाल पर चलत बानी।'
          : lang === 'en'
          ? 'Sure, going back to the previous question.'
          : 'ठीक है, पिछले सवाल पर वापस चलते हैं।';
      return {
        action: 'go_back',
        recognizedIntent: 'go_back',
        confidence: 0.92,
        needsClarification: false,
        acknowledgment: reply,
        spokenReply: reply,
      };
    }

    const repeatTriggers = ['दोबारा', 'फिर से', 'समझ नहीं आया', 'dobara', 'fir se', 'phir se', 'repeat', 'again'];
    if (repeatTriggers.some((w) => lowerRaw.includes(w))) {
      const reply =
        lang === 'bho'
          ? 'जी, फिर से पूछत बानी।'
          : lang === 'en'
          ? 'Sure, let me repeat the question.'
          : 'जी बिल्कुल, मैं फिर से सवाल पूछता हूँ।';
      return {
        action: 'repeat_question',
        recognizedIntent: 'repeat_question',
        confidence: 0.92,
        needsClarification: false,
        acknowledgment: reply,
        spokenReply: reply,
      };
    }

    const changeIntent = ['बदल', 'चेंज', 'गलत', 'सुधार', 'change', 'edit', 'galat', 'badal', 'update'].some((w) =>
      lowerRaw.includes(w)
    );
    if (changeIntent) {
      let targetStep: keyof BeneficiaryProfile | null = null;
      if (lowerRaw.includes('नाम') || lowerRaw.includes('name') || lowerRaw.includes('naam')) targetStep = 'name';
      else if (lowerRaw.includes('पढ़ाई') || lowerRaw.includes('शिक्षा') || lowerRaw.includes('education') || lowerRaw.includes('padhai'))
        targetStep = 'education';
      else if (lowerRaw.includes('हुनर') || lowerRaw.includes('कौशल') || lowerRaw.includes('skill') || lowerRaw.includes('hunar'))
        targetStep = 'skills';
      else if (lowerRaw.includes('रुचि') || lowerRaw.includes('पसंद') || lowerRaw.includes('interest')) targetStep = 'interests';
      else if (lowerRaw.includes('शहर') || lowerRaw.includes('गाँव') || lowerRaw.includes('जिला') || lowerRaw.includes('location') || lowerRaw.includes('jagah'))
        targetStep = 'location';
      else if (lowerRaw.includes('काम') || lowerRaw.includes('नौकरी') || lowerRaw.includes('work')) targetStep = 'workType';

      if (targetStep) {
        const reply =
          lang === 'bho'
            ? 'ठीक बा, ओह जानकारी के बदल देत बानी। बताईं नया जवाब का बा?'
            : lang === 'en'
            ? `Sure, let's update your ${targetStep}.`
            : 'ठीक है, चलिए उस जानकारी को बदलते हैं।';
        return {
          action: 'jump_to_step',
          targetStep,
          recognizedIntent: 'jump_to_step',
          confidence: 0.9,
          needsClarification: false,
          acknowledgment: reply,
          spokenReply: reply,
        };
      }
    }

    const skipTriggers = ['आगे बढ़', 'आगे चल', 'नेक्स्ट', 'छोड़ो', 'aage badh', 'aage chal', 'next step', 'skip'];
    if (stepKey !== 'readback' && skipTriggers.some((w) => lowerRaw.includes(w))) {
      const reply =
        lang === 'bho'
          ? 'ठीक बा, अगला सवाल पर चलत बानी।'
          : lang === 'en'
          ? 'Okay, moving to the next question.'
          : 'ठीक है, अगले सवाल पर चलते हैं।';
      return {
        action: 'go_next',
        recognizedIntent: 'go_next',
        confidence: 0.9,
        needsClarification: false,
        acknowledgment: reply,
        spokenReply: reply,
      };
    }

    // 0B. Casual chitchat / off-topic questions should NEVER be saved as profile values
    const chitchatTriggers = [
      'कैसे हो',
      'क्या कर रहे',
      'तुम कौन हो',
      'आप कौन हैं',
      'kaise ho',
      'kya kar rahe',
      'who are you',
      'how are you',
      'what are you doing',
      'ka hal ba',
      'का हाल बा',
    ];
    if (chitchatTriggers.some((w) => lowerRaw.includes(w))) {
      const reply =
        lang === 'bho'
          ? 'हम बिल्कुल बढ़िया बानी जी! रउआ खातिर प्रोफ़ाइल बनावे में मदद करत बानी। चलीं, ई सवाल के जवाब बताईं।'
          : lang === 'en'
          ? "I'm doing great! I'm JeevikaAI, here to build your career profile. Please tell me your answer to the current question."
          : 'मैं बिल्कुल बढ़िया हूँ जी! मैं आपकी आजीविका प्रोफ़ाइल बनाने में मदद कर रहा हूँ। कृपया इस सवाल का जवाब बताइए।';
      return {
        action: 'chat_and_stay',
        recognizedIntent: 'chitchat',
        cleanValue: '',
        confidence: 0.5,
        needsClarification: true,
        clarificationQuestion: reply,
        spokenReply: reply,
      };
    }

    // 0C. Readback Review Step
    if (stepKey === 'readback') {
      const rejectWords = ['नहीं', 'ना', 'गलत', 'बदल', 'no', 'wrong', 'galat', 'nahi', 'change'];
      if (rejectWords.some((w) => lowerRaw.includes(w))) {
        const reply =
          lang === 'bho'
            ? 'कवन जानकारी बदले के बा — नाम, पढ़ाई, हुनर या जिला? बोलीं, तुरंत सुधार देब।'
            : lang === 'en'
            ? 'Which detail would you like to change — name, education, skills, or location?'
            : 'कौन सी जानकारी बदलनी है — नाम, पढ़ाई, हुनर या शहर? बोलिए, मैं तुरंत सुधार दूँगा।';
        return {
          action: 'chat_and_stay',
          recognizedIntent: 'readback_reject',
          confidence: 0.85,
          needsClarification: true,
          clarificationQuestion: reply,
          spokenReply: reply,
        };
      }
      const reply =
        lang === 'bho'
          ? 'बहुत बढ़िया! अब रउआ रोडमैप तैयार करत बानी।'
          : lang === 'en'
          ? 'Awesome! Generating your personalized roadmap now.'
          : 'बहुत बढ़िया! अब आपका व्यक्तिगत रोडमैप तैयार किया जा रहा है।';
      return {
        action: 'confirm_submit',
        recognizedIntent: 'confirm_submit',
        confidence: 0.95,
        needsClarification: false,
        acknowledgment: reply,
        spokenReply: reply,
      };
    }

    const raw = this.deduplicateSpokenText(rawUnstripped, stepKey === 'name');
    const lower = raw.toLowerCase();

    // 1. Intro Step check
    if (stepKey === 'intro') {
      const negativeWords = ['nahi', 'no', 'mat', 'ruko', 'later', 'नहीं', 'ना', 'रुको', 'बाद में'];
      if (negativeWords.some((w) => lower === w || lower.startsWith(w + ' '))) {
        const reply = lang === 'bho' ? 'कोई बात नइखे, जब तइयार होखब तब बोलीं।' : 'कोई बात नहीं, जब आप तैयार हों तब बताइएगा।';
        return {
          action: 'start_negative',
          recognizedIntent: 'start_negative',
          confidence: 0.9,
          needsClarification: false,
          acknowledgment: reply,
          spokenReply: reply,
        };
      }

      const reply = lang === 'bho' ? 'बहुत बढ़िया! आईं शुरू करीं।' : 'बहुत बढ़िया! चलिए शुरू करते हैं।';
      return {
        action: 'start_affirmative',
        recognizedIntent: 'start_affirmative',
        confidence: 0.96,
        needsClarification: false,
        acknowledgment: reply,
        spokenReply: reply,
      };
    }

    // 2. Name extraction (strips filler phrases and deduplicates cleanly)
    if (stepKey === 'name') {
      const cleanName = this.deduplicateSpokenText(rawUnstripped, true);
      const finalName = cleanName || raw;
      const reply =
        lang === 'bho'
          ? `नमस्ते ${finalName} जी!`
          : lang === 'en'
          ? `Welcome ${finalName}!`
          : `नमस्ते ${finalName} जी, स्वागत है!`;
      return {
        action: 'save_and_next',
        recognizedIntent: 'name',
        cleanValue: finalName,
        confidence: 0.9,
        needsClarification: false,
        acknowledgment: reply,
        spokenReply: reply,
      };
    }

    // 3. Education extraction (fuzzy matching nearby words)
    if (stepKey === 'education') {
      let matchedOpt: StepOption | null = null;

      if (
        lower.includes('iti') ||
        lower.includes('diploma') ||
        lower.includes('polytechnic') ||
        lower.includes('डिप्लोमा') ||
        lower.includes('आईटीआई') ||
        lower.includes('पॉलिटेक्निक') ||
        lower.includes('टेक्निकल')
      ) {
        matchedOpt = EDU.find((e) => e.v.includes('ITI')) || null;
      } else if (
        lower.includes('grad') ||
        lower.includes('ba') ||
        lower.includes('b.a') ||
        lower.includes('bsc') ||
        lower.includes('bcom') ||
        lower.includes('b.sc') ||
        lower.includes('ma') ||
        lower.includes('mba') ||
        lower.includes('degree') ||
        lower.includes('college') ||
        lower.includes('बीए') ||
        lower.includes('बीएससी') ||
        lower.includes('बीकॉम') ||
        lower.includes('स्नातक') ||
        lower.includes('ग्रेजुएट') ||
        lower.includes('कॉलेज') ||
        lower.includes('डिग्री')
      ) {
        matchedOpt = EDU.find((e) => e.v.includes('Graduate')) || null;
      } else if (
        lower.includes('12') ||
        lower.includes('11') ||
        lower.includes('baarah') ||
        lower.includes('barah') ||
        lower.includes('twelfth') ||
        lower.includes('twelve') ||
        lower.includes('inter') ||
        lower.includes('बारह') ||
        lower.includes('12वीं') ||
        lower.includes('इंटर') ||
        lower.includes('हायर')
      ) {
        matchedOpt = EDU.find((e) => e.v.includes('12th')) || null;
      } else if (
        lower.includes('10') ||
        lower.includes('9') ||
        lower.includes('das') ||
        lower.includes('tenth') ||
        lower.includes('ten') ||
        lower.includes('matric') ||
        lower.includes('high school') ||
        lower.includes('highschool') ||
        lower.includes('दस') ||
        lower.includes('10वीं') ||
        lower.includes('मैट्रिक') ||
        lower.includes('हाई स्कूल') ||
        lower.includes('हाईस्कूल')
      ) {
        matchedOpt = EDU.find((e) => e.v.includes('10th')) || null;
      } else if (
        lower.includes('8') ||
        lower.includes('aath') ||
        lower.includes('eight') ||
        lower.includes('middle') ||
        lower.includes('आठ') ||
        lower.includes('8वीं') ||
        lower.includes('मिडिल')
      ) {
        matchedOpt = EDU.find((e) => e.v.includes('8th class pass')) || null;
      } else if (
        lower.includes('below') ||
        lower.includes('5') ||
        lower.includes('6') ||
        lower.includes('7') ||
        lower.includes('paanch') ||
        lower.includes('chhah') ||
        lower.includes('saat') ||
        lower.includes('nahi') ||
        lower.includes('unpadh') ||
        lower.includes('anpadh') ||
        lower.includes('kam') ||
        lower.includes('अनपढ़') ||
        lower.includes('नहीं पढ़') ||
        lower.includes('कम') ||
        lower.includes('पांच') ||
        lower.includes('सात')
      ) {
        matchedOpt = EDU.find((e) => e.v.includes('Below 8th')) || null;
      }

      if (!matchedOpt) {
        // Fallback to any keyword overlap or default to 10th pass if user spoke something
        for (const opt of EDU) {
          if (opt.kw.some((k) => lower.includes(k.toLowerCase()))) {
            matchedOpt = opt;
            break;
          }
        }
      }

      const finalOpt = matchedOpt || EDU[2]; // Default to 10th pass if approximate speech
      const ack =
        lang === 'bho'
          ? `अच्छा, ${finalOpt.bho || finalOpt.hi}। नोट हो गइल।`
          : lang === 'en'
          ? `Got it, ${finalOpt.v}.`
          : `अच्छा, ${finalOpt.hi}। नोट कर लिया है।`;

      return {
        recognizedIntent: 'education',
        cleanValue: finalOpt.v,
        confidence: 0.94,
        needsClarification: false,
        acknowledgment: ack,
      };
    }

    // 4. Skills & Interests fuzzy matching ("aspaas ka kuch bhi word match kare likhde")
    if (stepKey === 'skills' || stepKey === 'interests') {
      const matchedItems: string[] = [];
      const addUnique = (val: string) => {
        if (!matchedItems.some((x) => x.toLowerCase() === val.toLowerCase())) {
          matchedItems.push(val);
        }
      };

      const fuzzyMap: Array<{ keywords: string[]; labelHi: string; labelEn: string }> = [
        {
          keywords: ['सिलाई', 'कढ़ाई', 'दर्जी', 'कपड़ा', 'बुटीक', 'मशीन', 'silai', 'kadhai', 'tailor', 'stitch', 'sewing', 'garment', 'boutique'],
          labelHi: 'सिलाई-कढ़ाई',
          labelEn: 'Tailoring & Stitching',
        },
        {
          keywords: ['कंप्यूटर', 'टाइपिंग', 'ऑनलाइन', 'डाटा', 'डिजिटल', 'सीएससी', 'फॉर्म', 'computer', 'typing', 'online', 'digital', 'data', 'csc', 'cyber'],
          labelHi: 'कंप्यूटर व डिजिटल सेवाएँ',
          labelEn: 'Computers & Digital Services',
        },
        {
          keywords: ['मोबाइल', 'फोन', 'रिपेयर', 'व्हाट्सएप', 'ऐप', 'mobile', 'phone', 'app', 'smartphone'],
          labelHi: 'मोबाइल चलाना व रिपेयर',
          labelEn: 'Using a phone & Mobile apps',
        },
        {
          keywords: ['सोलर', 'बिजली', 'इलेक्ट्रीशियन', 'वायरिंग', 'इन्वर्टर', 'बैटरी', 'मोटर', 'solar', 'bijli', 'electric', 'wiring', 'inverter'],
          labelHi: 'सोलर ऊर्जा व इलेक्ट्रिकल',
          labelEn: 'Solar energy & Electrical work',
        },
        {
          keywords: ['दुकान', 'बिक्री', 'सेल्स', 'व्यापार', 'हिसाब', 'किराना', 'रिटेल', 'dukan', 'dukaan', 'shop', 'sales', 'retail', 'billing', 'account', 'business'],
          labelHi: 'दुकान और बिक्री (हिसाब-किताब)',
          labelEn: 'Shop, sales & billing',
        },
        {
          keywords: ['खेती', 'किसान', 'कृषि', 'डेयरी', 'पशुपालन', 'गाय', 'भैंस', 'बागवानी', 'kheti', 'farm', 'agri', 'dairy', 'milk'],
          labelHi: 'कृषि व डेयरी पशुपालन',
          labelEn: 'Agriculture & Dairy',
        },
        {
          keywords: ['खाना', 'रसोई', 'पकवान', 'टिफिन', 'अचार', 'पापड़', 'khana', 'cook', 'food', 'kitchen', 'catering'],
          labelHi: 'खाना बनाना व फूड प्रोसेसिंग',
          labelEn: 'Cooking & Food processing',
        },
        {
          keywords: ['बातचीत', 'बोलना', 'ग्राहक', 'सहायता', 'communication', 'speaking', 'customer', 'talking'],
          labelHi: 'बातचीत करना',
          labelEn: 'Basic communication',
        },
        {
          keywords: ['ब्यूटी', 'पार्लर', 'मेहंदी', 'मेकअप', 'सैलून', 'beauty', 'parlor', 'parlour', 'salon', 'makeup'],
          labelHi: 'ब्यूटी पार्लर व वेलनेस',
          labelEn: 'Beauty & Wellness',
        },
        {
          keywords: ['बढ़ई', 'लकड़ी', 'फर्नीचर', 'राजमिस्त्री', 'पेंटिंग', 'वेल्डिंग', 'प्लंबर', 'ड्राइविंग', 'गाड़ी', 'carpenter', 'mason', 'welding', 'plumber', 'driving', 'driver'],
          labelHi: 'तकनीकी व कारीगरी कार्य',
          labelEn: 'Skilled Trade & Craft',
        },
      ];

      for (const entry of fuzzyMap) {
        if (entry.keywords.some((kw) => lower.includes(kw))) {
          addUnique(lang === 'en' ? entry.labelEn : entry.labelHi);
        }
      }

      // Also check SKILL_CHIPS / INTEREST_CHIPS directly
      const sourceChips = stepKey === 'skills' ? SKILL_CHIPS : INTEREST_CHIPS;
      for (const chip of sourceChips) {
        if (
          lower.includes(chip.en.toLowerCase()) ||
          lower.includes(chip.hi.toLowerCase()) ||
          (chip.bho && lower.includes(chip.bho.toLowerCase()))
        ) {
          addUnique(lang === 'en' ? chip.en : lang === 'bho' ? chip.bho || chip.hi : chip.hi);
        }
      }

      const finalVal = matchedItems.length > 0 ? matchedItems.join(', ') : raw;
      return {
        recognizedIntent: stepKey,
        cleanValue: finalVal,
        confidence: 0.92,
        needsClarification: false,
        acknowledgment:
          lang === 'bho'
            ? `बहुत बढ़िया, ${finalVal} नोट हो गइल।`
            : lang === 'en'
            ? `Great, noted ${finalVal}.`
            : `बहुत बढ़िया, ${finalVal} नोट कर लिया है।`,
      };
    }

    // 5. Work Type extraction (Job / Self / Either)
    if (stepKey === 'workType') {
      let matched = WORK[0].v;
      if (
        lower.includes('self') ||
        lower.includes('business') ||
        lower.includes('dukan') ||
        lower.includes('dukaan') ||
        lower.includes('apna') ||
        lower.includes('khud') ||
        lower.includes('vyapar') ||
        lower.includes('dhandha') ||
        lower.includes('दुकान') ||
        lower.includes('स्वरोजगार') ||
        lower.includes('खुद') ||
        lower.includes('अपना') ||
        lower.includes('बिजनेस') ||
        lower.includes('व्यापार')
      ) {
        matched = 'Self-employment';
      } else if (
        lower.includes('dono') ||
        lower.includes('any') ||
        lower.includes('either') ||
        lower.includes('kuch bhi') ||
        lower.includes('kavano') ||
        lower.includes('कोई भी') ||
        lower.includes('दोनों') ||
        lower.includes('कुछ भी') ||
        lower.includes('कवनो')
      ) {
        matched = 'Either';
      } else {
        matched = 'Job';
      }

      const ack =
        lang === 'bho'
          ? `ठीक बा, ${matched === 'Job' ? 'नौकरी' : matched === 'Self-employment' ? 'खुद के काम' : 'कवनो भी काम'} दर्ज हो गइल।`
          : `ठीक है, ${matched === 'Job' ? 'नौकरी' : matched === 'Self-employment' ? 'स्वरोजगार (अपना काम)' : 'कोई भी काम'} नोट कर लिया है।`;

      return {
        recognizedIntent: 'workType',
        cleanValue: matched,
        confidence: 0.94,
        needsClarification: false,
        acknowledgment: ack,
      };
    }

    // 6. Mobility extraction
    if (stepKey === 'mobility') {
      let matched = MOB[0].v;
      if (
        lower.includes('anywhere') ||
        lower.includes('state') ||
        lower.includes('door') ||
        lower.includes('bahar') ||
        lower.includes('pardes') ||
        lower.includes('बाहर') ||
        lower.includes('कहीं भी') ||
        lower.includes('राज्य') ||
        lower.includes('दूर')
      ) {
        matched = MOB[2].v;
      } else if (
        lower.includes('district') ||
        lower.includes('zila') ||
        lower.includes('jila') ||
        lower.includes('shahar') ||
        lower.includes('city') ||
        lower.includes('जिला') ||
        lower.includes('जिले') ||
        lower.includes('शहर')
      ) {
        matched = MOB[1].v;
      } else {
        matched = MOB[0].v;
      }

      return {
        recognizedIntent: 'mobility',
        cleanValue: matched,
        confidence: 0.92,
        needsClarification: false,
        acknowledgment:
          lang === 'bho'
            ? 'समझ गइनी, दूरी के प्राथमिकता नोट हो गइल।'
            : 'समझ गए, दूरी की प्राथमिकता नोट कर ली गई है।',
      };
    }

    // 7. Occupation or Location
    const ack =
      lang === 'bho'
        ? 'बहुत बढ़िया, ई नोट हो गइल बा।'
        : lang === 'en'
        ? 'Great, noted.'
        : 'बहुत बढ़िया, यह नोट कर लिया है।';
    return {
      recognizedIntent: stepKey,
      cleanValue: raw,
      confidence: 0.9,
      needsClarification: false,
      acknowledgment: ack,
    };
  }

  /**
   * Converts internal English choice keys (e.g. '10th pass (Secondary)', 'Job') into the user's selected language.
   */
  public localizeProfileValue(stepKey: string, val: string | undefined, lang: SupportedLanguage): string {
    if (!val || !val.trim()) return '';
    if (lang === 'en') return val;

    if (stepKey === 'education') {
      const found = EDU.find((e) => e.v.toLowerCase() === val.toLowerCase());
      if (found) return lang === 'bho' ? found.bho || found.hi : found.hi;
    }
    if (stepKey === 'workType') {
      const found = WORK.find((w) => w.v.toLowerCase() === val.toLowerCase());
      if (found) return lang === 'bho' ? found.bho || found.hi : found.hi;
    }
    if (stepKey === 'mobility') {
      const found = MOB.find((m) => m.v.toLowerCase() === val.toLowerCase());
      if (found) return lang === 'bho' ? found.bho || found.hi : found.hi;
    }
    return val;
  }

  /**
   * Request verbal readback summary from backend or generate clean localized summary
   */
  public async generateReadback(profile: BeneficiaryProfile, lang: SupportedLanguage): Promise<string> {
    const eduLabel = this.localizeProfileValue('education', profile.education, lang) || (lang === 'en' ? 'Not specified' : 'उपलब्ध नहीं');
    const workLabel = this.localizeProfileValue('workType', profile.workType || 'Job', lang);

    try {
      const data = await aiGateway.generateReadback({
        profile: {
          ...profile,
          education: eduLabel,
          workType: workLabel,
        },
        language: lang,
      });
      if (data && !data.fallback && data.readbackText) {
        return data.readbackText;
      }
    } catch {
      // Fallback below
    }

    if (lang === 'bho') {
      return `रउआ नाम ${profile.name || 'लाभार्थी'} बा। रउआ शिक्षा ${eduLabel}, हुनर ${profile.skills || 'उपलब्ध नहीं'}, पसंदीदा काम ${profile.interests || 'उपलब्ध नहीं'}, स्थान ${profile.location || 'उपलब्ध नहीं'} अउर कार्य प्राथमिकता ${workLabel} बा। का ई सब जानकारी सही बा?`;
    }
    if (lang === 'en') {
      return `Your name is ${profile.name || 'Beneficiary'}. Education: ${eduLabel}. Skills: ${profile.skills || 'Not specified'}. Interests: ${profile.interests || 'Not specified'}. Location: ${profile.location || 'Not specified'}. Work preference: ${workLabel}. Is all this information correct?`;
    }
    return `आपका नाम ${profile.name || 'लाभार्थी'} है। आपकी शिक्षा ${eduLabel}, हुनर ${profile.skills || 'उपलब्ध नहीं'}, पसंदीदा काम ${profile.interests || 'उपलब्ध नहीं'}, स्थान ${profile.location || 'उपलब्ध नहीं'}, और कार्य प्रकार ${workLabel} है। क्या यह सभी जानकारी सही है?`;
  }
}

export const speechService = new SpeechService();
