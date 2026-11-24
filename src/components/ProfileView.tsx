import React, { useState } from 'react';
import { Icon } from './Icons';
import { BeneficiaryProfile, SupportedLanguage } from '../types';
import { EDU, WORK, MOB, SKILL_CHIPS, INTEREST_CHIPS } from '../data/mockData';
import { splitList } from '../services/recommendationEngine';
import { speechService, SpeechRecognitionResultWrapper } from '../services/speechService';
import { aiGateway } from '../services/aiGateway';
import { locationIntelligenceService } from '../services/locationIntelligenceService';
import { LocationAccuracyBadge } from './LocationAccuracyBadge';
import { uploadToCloudinary } from '../services/cloudinaryService';
import type { AppPermissionsState, PermissionStatus } from './PermissionsPrompt';

interface ProfileViewProps {
  profile: BeneficiaryProfile;
  onUpdateProfile: (updated: BeneficiaryProfile) => void;
  onNotify: (msg: string) => void;
  go: (route: string) => void;
  onLogout?: () => void;
  currentLang?: SupportedLanguage;
  permissions?: AppPermissionsState;
  isRequestingPermissionKey?: 'all' | keyof AppPermissionsState | null;
  onRequestNotification?: () => Promise<PermissionStatus>;
  onRequestMicrophone?: () => Promise<PermissionStatus>;
  onRequestGeolocation?: () => Promise<PermissionStatus>;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  onUpdateProfile,
  onNotify,
  go,
  onLogout,
  currentLang = 'hi',
  permissions,
  isRequestingPermissionKey = null,
  onRequestNotification,
  onRequestMicrophone,
  onRequestGeolocation,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  const [form, setForm] = useState<BeneficiaryProfile>({ ...profile });
  const [activeVoiceField, setActiveVoiceField] = useState<keyof BeneficiaryProfile | null>(null);
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [voiceLiveTranscript, setVoiceLiveTranscript] = useState<string>('');
  const [voiceStatusText, setVoiceStatusText] = useState<string>('');
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const [confirmLogoutStep, setConfirmLogoutStep] = useState<boolean>(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    onNotify(currentLang === 'bho' ? 'प्रोफ़ाइल फोटो अपलोड हो रहल बा...' : 'प्रोफ़ाइल फोटो अपलोड हो रहा है...');
    try {
      const url = await uploadToCloudinary(file, 'user_avatars');
      handleChange('avatarUrl', url);
      onNotify(
        form.isDemo
          ? currentLang === 'en'
            ? 'Demo preview photo updated locally (not saved to database).'
            : 'डेमो फोटो प्रीव्यू अपडेट हुआ (डेटाबेस में खाता नहीं बनेगा)।'
          : currentLang === 'bho'
          ? 'प्रोफ़ाइल फोटो अपडेट हो गइल!'
          : 'प्रोफ़ाइल फोटो सफलतापूर्वक अपडेट हो गई!'
      );
    } catch (err: any) {
      onNotify('अपलोड विफल: ' + (err.message || 'त्रुटि'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleManualSave = () => {
    onUpdateProfile(form);
    setSaveSuccess(true);
    onNotify(
      form.isDemo
        ? currentLang === 'en'
          ? 'Demo preview updated locally. Create an account to save permanently.'
          : 'डेमो प्रीव्यू अपडेट हुआ। स्थायी रूप से सहेजने के लिए अपना खाता बनाएं।'
        : currentLang === 'bho'
        ? 'प्रोफ़ाइल फ़ायरबेस में सहेज दिहल गइल!'
        : 'प्रोफ़ाइल फ़ायरबेस में सफलतापूर्वक सुरक्षित कर ली गई!'
    );
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleGpsDetect = async () => {
    if (isDetectingGps) return;
    setIsDetectingGps(true);
    onNotify(
      currentLang === 'bho'
        ? 'जीपीएस से स्थान खोजल जा रहल बा...'
        : 'जीपीएस द्वारा स्थान पहचाना जा रहा है...'
    );
    try {
      const res = await locationIntelligenceService.detectGpsLocation();
      if (res && res.location) {
        const updated = {
          ...form,
          location: res.location,
          locationAccuracy: res.accuracyLevel,
          locationConfidence: res.confidenceScore,
          locationAccuracyMeters: res.accuracyMeters,
        };
        setForm(updated);
        onUpdateProfile(updated);
        onNotify(
          currentLang === 'bho'
            ? `स्थान मिल गइल: ${res.location} (${res.accuracyLevel} · ${res.confidenceScore}%)`
            : `स्थान प्राप्त हुआ: ${res.location} (${res.accuracyLevel} · ${res.confidenceScore}% विश्वास)`
        );
      }
    } catch {
      onNotify('स्थान का पता नहीं चल सका। कृपया मैन्युअली लिखें।');
    } finally {
      setIsDetectingGps(false);
    }
  };

  const handleChange = (k: keyof BeneficiaryProfile, v: any) => {
    const updated = { ...form, [k]: v };
    setForm(updated);
    onUpdateProfile(updated);
  };

  const handleToggleChip = (field: 'skills' | 'interests', chipText: string) => {
    const list = splitList(form[field]);
    const updatedList = list.includes(chipText)
      ? list.filter((x) => x !== chipText)
      : [...list, chipText];
    handleChange(field, updatedList.join(', '));
  };

  const startVoiceUpdate = async (field: keyof BeneficiaryProfile, promptHindi: string) => {
    if (isListeningVoice && activeVoiceField === field) {
      speechService.stopListening();
      speechService.stopSpeaking();
      setIsListeningVoice(false);
      setActiveVoiceField(null);
      return;
    }

    speechService.stopListening();
    speechService.stopSpeaking();
    setActiveVoiceField(field);
    setIsListeningVoice(true);
    setVoiceLiveTranscript('');
    setVoiceStatusText(`JeevikaAI सुन रहा है: ${promptHindi}...`);

    speechService.speak(promptHindi, currentLang, () => {
      speechService.startListening(
        currentLang,
        async (result: SpeechRecognitionResultWrapper) => {
          if (result.transcript) {
            setVoiceLiveTranscript(result.transcript);
          }
          if (result.isFinal && result.transcript.trim()) {
            const rawText = result.transcript.trim();
            setIsListeningVoice(false);
            setVoiceStatusText('AI उत्तर का विश्लेषण कर रहा है...');

            const aiRes = await speechService.extractWithGemini(
              rawText,
              currentLang,
              field,
              form,
              promptHindi
            );
            const cleanVal = aiRes.cleanValue || rawText;
            handleChange(field, cleanVal);

            const ack = currentLang === 'bho'
              ? 'बहुत बढ़िया, ई जानकारी अपडेट हो गइल बा!'
              : 'बहुत बढ़िया! यह जानकारी अपडेट कर दी गई है।';
            speechService.speak(ack, currentLang);
            onNotify(`${field.toUpperCase()} अपडेट हुआ: ${cleanVal}`);
            setActiveVoiceField(null);
            setVoiceStatusText('');
          }
        },
        (err) => {
          setIsListeningVoice(false);
          setActiveVoiceField(null);
          setVoiceStatusText('');
          onNotify(`माइक त्रुटि: ${err}`);
        },
        () => {
          setIsListeningVoice(false);
        }
      );
    });
  };

  const startFullVoiceUpdate = async () => {
    if (isListeningVoice) {
      speechService.stopListening();
      speechService.stopSpeaking();
      setIsListeningVoice(false);
      setActiveVoiceField(null);
      setVoiceStatusText('');
      return;
    }

    speechService.stopListening();
    speechService.stopSpeaking();
    setIsListeningVoice(true);
    setActiveVoiceField('name');
    setVoiceLiveTranscript('');
    const promptText = currentLang === 'bho'
      ? 'प्रणाम! रउआ आपन नाम, पढ़ाई, हुनर या जिला जवन भी बदले के चाहत बानी, बोल के बताईं।'
      : 'नमस्ते! आप अपना नाम, शिक्षा, हुनर या जिला जो भी बदलना चाहते हैं, बोलिए, JeevikaAI सब अपडेट कर देगा।';
    setVoiceStatusText(promptText);

    speechService.speak(promptText, currentLang, () => {
      speechService.startListening(
        currentLang,
        async (result: SpeechRecognitionResultWrapper) => {
          if (result.transcript) {
            setVoiceLiveTranscript(result.transcript);
          }
          if (result.isFinal && result.transcript.trim()) {
            const rawText = result.transcript.trim();
            setIsListeningVoice(false);
            setVoiceStatusText('JeevikaAI विश्लेषण कर रहा है...');

            try {
              const data = await aiGateway.parseSpeech({
                message: rawText,
                language: currentLang,
                currentProfile: form,
                stepKey: 'skills',
              });
              if (data) {
                const updatedFields = data.updatedProfile || data.updatedProfileFields || {};
                const merged = { ...form, ...updatedFields };
                setForm(merged);
                onUpdateProfile(merged);
                const reply = data.summary || data.reply || 'आपकी जानकारी अपडेट कर दी गई है।';
                speechService.speak(reply, currentLang);
                onNotify(reply);
              } else {
                onNotify(`अपडेट नोट हुआ: ${rawText}`);
              }
            } catch {
              onNotify(`अपडेट नोट हुआ: ${rawText}`);
            }

            setActiveVoiceField(null);
            setVoiceStatusText('');
          }
        },
        (err) => {
          setIsListeningVoice(false);
          setActiveVoiceField(null);
          setVoiceStatusText('');
          onNotify(`माइक त्रुटि: ${err}`);
        },
        () => {
          setIsListeningVoice(false);
        }
      );
    });
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* JeevikaAI Voice Assistant Profile Update Banner */}
      <div className="mb-6 p-5 rounded-2xl bg-[#17365D] text-white border border-[#245A91] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0 text-[#38BDF8]">
            <Icon name="sparkles" size={22} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base font-['Bricolage_Grotesque']">
              JeevikaAI वॉइस से पूरी प्रोफ़ाइल अपडेट करें
            </h3>
            <p className="text-xs text-white/80 mt-0.5">
              सीधे बोलकर नाम, हुनर, जिला या शिक्षा एक साथ बदलें।
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={startFullVoiceUpdate}
            className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-extrabold transition-colors flex items-center justify-center gap-2 ${
              isListeningVoice && !activeVoiceField
                ? 'bg-[#9E2A2B] text-white animate-pulse'
                : 'bg-white text-[#17365D] hover:bg-[#F7F9FC]'
            }`}
          >
            <Icon name="mic" size={16} />
            <span>{isListeningVoice ? 'सुन रहे हैं (बोलिए)...' : 'AI से बोलकर अपडेट करें'}</span>
          </button>

          {activeVoiceField && (
            <div className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-white/15 border border-white/25 text-xs font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span>{voiceStatusText || voiceLiveTranscript || 'बोलिए, सुन रहे हैं...'}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#DCE3EA] rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Profile Avatar Upload Card (Cloudinary) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F9FC] border border-[#DCE3EA] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-[#245A91] bg-white flex-shrink-0 flex items-center justify-center">
              {form.avatarUrl ? (
                <img src={form.avatarUrl} alt={form.name || 'User'} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-extrabold text-[#17365D]">
                  {(form.name || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#17365D]">
                प्रोफ़ाइल फोटो (Profile Photo)
              </h3>
              <p className="text-xs text-[#5F6B76] mt-0.5">
                आपकी पहचान व बायोडाटा कार्ड के लिए फोटो अपलोड करें।
              </p>
            </div>
          </div>

          <label className={`cursor-pointer min-h-[44px] px-4 py-2.5 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white text-xs font-extrabold transition-colors flex items-center gap-2 flex-shrink-0 ${isUploadingAvatar ? 'opacity-70 pointer-events-none' : ''}`}>
            <Icon name={isUploadingAvatar ? 'refresh' : 'upload'} size={15} className={isUploadingAvatar ? 'animate-spin' : ''} />
            <span>{isUploadingAvatar ? 'अपलोड हो रहा है...' : 'फोटो अपलोड करें'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={isUploadingAvatar}
              className="hidden"
            />
          </label>
        </div>

        {/* Full Name & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#5F6B76]">
                Full Name (पूरा नाम)
              </label>
              <button
                type="button"
                onClick={() => startVoiceUpdate('name', 'अपना पूरा नाम बोलिए')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                  activeVoiceField === 'name'
                    ? 'bg-[#9E2A2B] text-white animate-pulse'
                    : 'bg-[#F7F9FC] border border-[#DCE3EA] text-[#245A91] hover:border-[#245A91]'
                }`}
              >
                <Icon name="mic" size={12} />
                <span>AI से बोलें</span>
              </button>
            </div>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full min-h-[44px] p-3 rounded-xl border border-[#DCE3EA] text-sm text-[#17365D] focus:outline-none focus:border-[#245A91]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-bold text-[#5F6B76]">
                District / Town (जिला या कस्बा)
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleGpsDetect}
                  disabled={isDetectingGps}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 bg-[#287D73]/10 text-[#287D73] border border-[#287D73]/25 hover:bg-[#287D73]/20 transition-colors cursor-pointer"
                  title="फोन के जीपीएस से सटीक स्थान पहचानें"
                >
                  <Icon name={isDetectingGps ? 'refresh' : 'target'} size={12} className={isDetectingGps ? 'animate-spin' : ''} />
                  <span>{isDetectingGps ? 'खोज रहे हैं...' : 'GPS पहचानें'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => startVoiceUpdate('location', 'अपना जिला या शहर बोलिए')}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                    activeVoiceField === 'location'
                      ? 'bg-[#9E2A2B] text-white animate-pulse'
                      : 'bg-[#F7F9FC] border border-[#DCE3EA] text-[#245A91] hover:border-[#245A91]'
                  }`}
                >
                  <Icon name="mic" size={12} />
                  <span>AI से बोलें</span>
                </button>
              </div>
            </div>
            <input
              type="text"
              required
              value={form.location}
              onChange={(e) => handleChange('location', e.target.value)}
              className="w-full min-h-[44px] p-3 rounded-xl border border-[#DCE3EA] text-sm text-[#17365D] focus:outline-none focus:border-[#245A91]"
            />
            {form.location && (
              <div className="pt-1 flex items-center gap-2">
                <span className="text-[11px] text-[#5F6B76] font-medium">सटीकता स्तर (Accuracy):</span>
                <LocationAccuracyBadge
                  level={form.locationAccuracy || 'District-level'}
                  confidenceScore={form.locationConfidence || 85}
                  accuracyMeters={form.locationAccuracyMeters}
                  currentLang={currentLang}
                  onReDetect={handleGpsDetect}
                  isDetecting={isDetectingGps}
                />
              </div>
            )}
          </div>
        </div>

        {/* Education Level */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-[#5F6B76]">
              Education Level (शिक्षा स्तर)
            </label>
            <button
              type="button"
              onClick={() => startVoiceUpdate('education', 'अपनी शिक्षा बताइए, जैसे 10वीं, 12वीं या ग्रेजुएट')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                activeVoiceField === 'education'
                  ? 'bg-[#9E2A2B] text-white animate-pulse'
                  : 'bg-[#F7F9FC] border border-[#DCE3EA] text-[#245A91] hover:border-[#245A91]'
              }`}
            >
              <Icon name="mic" size={12} />
              <span>AI से बोलें</span>
            </button>
          </div>
          <select
            value={form.education}
            onChange={(e) => handleChange('education', e.target.value)}
            className="w-full min-h-[44px] p-3 rounded-xl border border-[#DCE3EA] bg-white text-sm text-[#17365D] focus:outline-none focus:border-[#245A91]"
          >
            {EDU.map((opt) => (
              <option key={opt.v} value={opt.v}>
                {opt.v} ({opt.hi})
              </option>
            ))}
          </select>
        </div>

        {/* Existing Skills */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-[#5F6B76]">
              Existing Skills (आपके मौजूदा कौशल / हुनर)
            </label>
            <button
              type="button"
              onClick={() => startVoiceUpdate('skills', 'अपने हुनर या कौशल बोलिए')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                activeVoiceField === 'skills'
                  ? 'bg-[#9E2A2B] text-white animate-pulse'
                  : 'bg-[#F7F9FC] border border-[#DCE3EA] text-[#245A91] hover:border-[#245A91]'
              }`}
            >
              <Icon name="mic" size={12} />
              <span>AI से बोलें</span>
            </button>
          </div>
          <textarea
            rows={2}
            value={form.skills}
            onChange={(e) => handleChange('skills', e.target.value)}
            placeholder="e.g. typing, stitching, phone use, cooking"
            className="w-full p-3 rounded-xl border border-[#DCE3EA] text-sm text-[#17365D] focus:outline-none focus:border-[#245A91]"
          />
          <div className="flex flex-wrap gap-1.5">
            {SKILL_CHIPS.map((chip) => {
              const active = splitList(form.skills).includes(chip.en);
              return (
                <button
                  type="button"
                  key={chip.en}
                  onClick={() => handleToggleChip('skills', chip.en)}
                  className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-[#17365D] text-white border-[#17365D]'
                      : 'bg-[#F7F9FC] border-[#DCE3EA] text-[#5F6B76] hover:border-[#245A91]'
                  }`}
                >
                  {active ? '✓ ' : '+ '}{chip.en} ({chip.hi})
                </button>
              );
            })}
          </div>
        </div>

        {/* Career Interests */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-[#5F6B76]">
              Interests &amp; Ambitions (आपकी रुचि / पसंदीदा काम)
            </label>
            <button
              type="button"
              onClick={() => startVoiceUpdate('interests', 'आपको किस तरह के काम में रुचि है? बोलिए')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                activeVoiceField === 'interests'
                  ? 'bg-[#9E2A2B] text-white animate-pulse'
                  : 'bg-[#F7F9FC] border border-[#DCE3EA] text-[#245A91] hover:border-[#245A91]'
              }`}
            >
              <Icon name="mic" size={12} />
              <span>AI से बोलें</span>
            </button>
          </div>
          <textarea
            rows={2}
            value={form.interests}
            onChange={(e) => handleChange('interests', e.target.value)}
            placeholder="e.g. digital services, computers, tailoring, electrical repair"
            className="w-full p-3 rounded-xl border border-[#DCE3EA] text-sm text-[#17365D] focus:outline-none focus:border-[#245A91]"
          />
          <div className="flex flex-wrap gap-1.5">
            {INTEREST_CHIPS.map((chip) => {
              const active = splitList(form.interests).includes(chip.en);
              return (
                <button
                  type="button"
                  key={chip.en}
                  onClick={() => handleToggleChip('interests', chip.en)}
                  className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-[#17365D] text-white border-[#17365D]'
                      : 'bg-[#F7F9FC] border-[#DCE3EA] text-[#5F6B76] hover:border-[#245A91]'
                  }`}
                >
                  {active ? '✓ ' : '+ '}{chip.en} ({chip.hi})
                </button>
              );
            })}
          </div>
        </div>

        {/* Preferred Work Type & Mobility */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#5F6B76]">
                Preferred Work Type (कार्य का प्रकार)
              </label>
              <button
                type="button"
                onClick={() => startVoiceUpdate('workType', 'आप नौकरी चाहते हैं या खुद का काम?')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                  activeVoiceField === 'workType'
                    ? 'bg-[#9E2A2B] text-white animate-pulse'
                    : 'bg-[#F7F9FC] border border-[#DCE3EA] text-[#245A91] hover:border-[#245A91]'
                }`}
              >
                <Icon name="mic" size={12} />
                <span>AI से बोलें</span>
              </button>
            </div>
            <select
              value={form.workType}
              onChange={(e) => handleChange('workType', e.target.value)}
              className="w-full min-h-[44px] p-3 rounded-xl border border-[#DCE3EA] bg-white text-sm text-[#17365D] focus:outline-none focus:border-[#245A91]"
            >
              {WORK.map((opt) => (
                <option key={opt.v} value={opt.v}>
                  {opt.v} ({opt.hi})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#5F6B76]">
                Travel Range / Mobility (यात्रा सीमा)
              </label>
              <button
                type="button"
                onClick={() => startVoiceUpdate('mobility', 'आप काम के लिए कितनी दूर जा सकते हैं?')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                  activeVoiceField === 'mobility'
                    ? 'bg-[#9E2A2B] text-white animate-pulse'
                    : 'bg-[#F7F9FC] border border-[#DCE3EA] text-[#245A91] hover:border-[#245A91]'
                }`}
              >
                <Icon name="mic" size={12} />
                <span>AI से बोलें</span>
              </button>
            </div>
            <select
              value={form.mobility}
              onChange={(e) => handleChange('mobility', e.target.value)}
              className="w-full min-h-[44px] p-3 rounded-xl border border-[#DCE3EA] bg-white text-sm text-[#17365D] focus:outline-none focus:border-[#245A91]"
            >
              {MOB.map((opt) => (
                <option key={opt.v} value={opt.v}>
                  {opt.v} ({opt.hi})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls & Logout */}
        <div className="pt-4 border-t border-[#DCE3EA] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#287D73] font-semibold">
            <Icon name="shieldCheck" size={15} />
            <span>Auto-saved to device &amp; cloud · सभी बदलाव स्वतः सुरक्षित</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleManualSave}
              className={`flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-xl font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                saveSuccess
                  ? 'bg-[#1E6058] text-white'
                  : 'bg-[#287D73] hover:bg-[#1E6058] text-white'
              }`}
            >
              <Icon name="check" size={15} />
              <span>{saveSuccess ? 'प्रोफ़ाइल सफलतापूर्वक सहेजी गई!' : 'प्रोफ़ाइल सहेजें (Save Profile)'}</span>
            </button>

            {onLogout && !confirmLogoutStep && (
              <button
                type="button"
                onClick={() => setConfirmLogoutStep(true)}
                className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#9E2A2B]/30 text-[#9E2A2B] hover:bg-red-50 text-xs font-extrabold transition-colors flex items-center justify-center gap-1.5"
              >
                <Icon name="logout" size={14} />
                <span>लॉगआउट (Logout)</span>
              </button>
            )}

            {onLogout && confirmLogoutStep && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmLogoutStep(false);
                    onLogout();
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#9E2A2B] text-white text-xs font-extrabold"
                >
                  {currentLang === 'bho' ? 'हाँ, लॉगआउट करीं' : 'हाँ, लॉगआउट करें'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmLogoutStep(false)}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-[#DCE3EA] text-[#5F6B76] text-xs font-bold"
                >
                  रद्द करें
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => go('dashboard')}
              className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-xl bg-[#17365D] text-white text-xs font-bold hover:bg-[#245A91] transition-colors"
            >
              डैशबोर्ड देखें
            </button>
          </div>
        </div>
      </div>

      {/* App Settings: Permissions & Theme Change (Bottom of Profile) */}
      <div className="mt-6 bg-white border border-[#DCE3EA] rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#DCE3EA]">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
              {currentLang === 'en' ? 'App Settings' : currentLang === 'bho' ? 'ऐप सेटिंग्स' : 'ऐप सेटिंग्स (App Settings)'}
            </h3>
            <p className="text-xs text-[#5F6B76] mt-0.5">
              {currentLang === 'en'
                ? 'Manage permissions & app appearance'
                : 'अनुमतियाँ और ऐप की थीम नियंत्रित करें'}
            </p>
          </div>
          <span className="w-9 h-9 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] text-[#245A91] flex items-center justify-center flex-none">
            <Icon name="shieldCheck" size={18} />
          </span>
        </div>

        {/* Permissions Controls */}
        {permissions && (
          <div className="space-y-2.5">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#5F6B76]">
              {currentLang === 'en' ? 'Device Permissions' : 'डिवाइस अनुमतियाँ (Permissions)'}
            </div>
            {(
              [
                {
                  key: 'notifications' as const,
                  icon: 'bell',
                  label: currentLang === 'en' ? 'Push Notifications' : 'पुश नोटिफिकेशन',
                  sub: currentLang === 'en' ? 'Job & scheme alerts' : 'रोजगार व योजना अलर्ट',
                  status: permissions.notifications,
                  onAllow: onRequestNotification,
                },
                {
                  key: 'microphone' as const,
                  icon: 'mic',
                  label: currentLang === 'en' ? 'Microphone' : 'माइक्रोफ़ोन',
                  sub: currentLang === 'en' ? 'Voice assistant' : 'वॉइस असिस्टेंट',
                  status: permissions.microphone,
                  onAllow: onRequestMicrophone,
                },
                {
                  key: 'geolocation' as const,
                  icon: 'pin',
                  label: currentLang === 'en' ? 'GPS Location' : 'जीपीएस लोकेशन',
                  sub: currentLang === 'en' ? 'Nearby jobs & centers' : 'नज़दीकी अवसर व केंद्र',
                  status: permissions.geolocation,
                  onAllow: onRequestGeolocation,
                },
              ] as const
            ).map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-none ${
                      item.status === 'granted'
                        ? 'bg-[#287D73] text-white'
                        : 'bg-white border border-[#DCE3EA] text-[#245A91]'
                    }`}
                  >
                    <Icon name={item.icon} size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-extrabold text-[#17365D] leading-tight">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-[#5F6B76] truncate">
                      {item.status === 'denied'
                        ? currentLang === 'en'
                          ? 'Blocked — enable in browser/app settings'
                          : 'ब्लॉक है — ब्राउज़र/ऐप सेटिंग्स से चालू करें'
                        : item.sub}
                    </div>
                  </div>
                </div>

                <div className="flex-none">
                  {item.status === 'granted' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E9F7F4] text-[#1E6058] border border-[#287D73]/25 text-[11px] font-extrabold">
                      <Icon name="check" size={12} />
                      {currentLang === 'en' ? 'Allowed' : 'चालू'}
                    </span>
                  ) : item.status === 'denied' ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#FEF2F2] text-[#9E2A2B] border border-[#9E2A2B]/25 text-[11px] font-extrabold">
                      {currentLang === 'en' ? 'Blocked' : 'ब्लॉक'}
                    </span>
                  ) : item.status === 'unsupported' ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-bold">
                      N/A
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => item.onAllow?.()}
                      disabled={isRequestingPermissionKey !== null}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white text-xs font-extrabold transition-colors disabled:opacity-60"
                    >
                      {isRequestingPermissionKey === item.key
                        ? '...'
                        : currentLang === 'en'
                        ? 'Allow'
                        : 'चालू करें'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Theme Switch (Light / Dark Mode) */}
        {onToggleDarkMode && (
          <div className="pt-3 border-t border-[#DCE3EA]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#17365D] text-[#F4B966] flex items-center justify-center flex-none">
                  <Icon name={isDarkMode ? 'moon' : 'sun'} size={17} />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-extrabold text-[#17365D]">
                    {currentLang === 'en' ? 'App Theme' : currentLang === 'bho' ? 'ऐप थीम बदलें' : 'ऐप थीम (Theme)'}
                  </div>
                  <div className="text-[11px] text-[#5F6B76]">
                    {isDarkMode
                      ? currentLang === 'en'
                        ? 'Dark Mode active'
                        : 'डार्क मोड सक्रिय है'
                      : currentLang === 'en'
                      ? 'Light Mode active'
                      : 'लाइट मोड सक्रिय है'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white border border-[#DCE3EA]">
                <button
                  type="button"
                  onClick={() => {
                    if (isDarkMode) onToggleDarkMode();
                  }}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors ${
                    !isDarkMode
                      ? 'bg-[#17365D] text-white'
                      : 'text-[#5F6B76] hover:text-[#17365D]'
                  }`}
                >
                  <Icon name="sun" size={14} />
                  <span>{currentLang === 'en' ? 'Light' : 'लाइट'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isDarkMode) onToggleDarkMode();
                  }}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors ${
                    isDarkMode
                      ? 'bg-[#17365D] text-white'
                      : 'text-[#5F6B76] hover:text-[#17365D]'
                  }`}
                >
                  <Icon name="moon" size={14} />
                  <span>{currentLang === 'en' ? 'Dark' : 'डार्क'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
