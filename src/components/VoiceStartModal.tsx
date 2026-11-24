import React, { useState } from 'react';
import { SupportedLanguage } from '../types';
import { Icon } from './Icons';

interface VoiceStartModalProps {
  isOpen: boolean;
  currentLang: SupportedLanguage;
  onClose: () => void;
  onConfirm: (lang: SupportedLanguage) => void;
}

const LANGUAGES = [
  { id: 'hi' as SupportedLanguage, name: 'हिन्दी', sub: 'Hindi' },
  { id: 'bho' as SupportedLanguage, name: 'भोजपुरी', sub: 'Bhojpuri' },
  { id: 'en' as SupportedLanguage, name: 'English', sub: 'English' },
  { id: 'hin' as SupportedLanguage, name: 'Hinglish', sub: 'हिंग्लिश' },
];

export const VoiceStartModal: React.FC<VoiceStartModalProps> = ({
  isOpen,
  currentLang,
  onClose,
  onConfirm,
}) => {
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(currentLang);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1B30]/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Voice Assessment Language"
        className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 border border-[#DCE3EA] shadow-xl space-y-5 text-left"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#245A91] text-white flex items-center justify-center flex-none">
              <Icon name="mic" size={22} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
                बोलकर शुरू करें (Voice Assessment)
              </h3>
              <p className="text-xs text-[#5F6B76] mt-0.5">
                सीधे बातचीत करें — कोई लंबा फॉर्म भरने की जरूरत नहीं
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#F7F9FC] text-[#5F6B76] hover:text-[#17365D] border border-[#DCE3EA] flex items-center justify-center text-sm font-bold transition-colors"
            aria-label="Close"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-[#17365D] block">
            बातचीत की भाषा चुनें (Select Conversation Language):
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setSelectedLang(lang.id)}
                className={`min-h-[44px] py-2 px-3 rounded-xl border text-center transition-colors ${
                  selectedLang === lang.id
                    ? 'border-[#245A91] bg-[#17365D] text-white font-bold'
                    : 'border-[#DCE3EA] bg-white text-[#5F6B76] hover:border-[#17365D]'
                }`}
              >
                <div className="text-xs font-bold">{lang.name}</div>
                <div className={`text-[10px] ${selectedLang === lang.id ? 'text-white/80' : 'text-[#5F6B76]'}`}>
                  {lang.sub}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-3.5 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA] space-y-2.5 text-xs text-[#202B36]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#287D73] flex-none" />
            <span>
              <strong>माइक अनुमति:</strong> टैप करते ही माइक सक्रिय होगा
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#245A91] flex-none" />
            <span>
              <strong>ऑटोमेटिक बातचीत:</strong> सहायक सवाल खुद बोलकर पूछेंगे
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D9822B] flex-none" />
            <span>
              <strong>स्वाभाविक उत्तर:</strong> आप आराम से बोलिए, जवाब अपने-आप दर्ज होगा
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => onConfirm(selectedLang)}
            className="flex-1 min-h-[46px] py-3 px-4 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Icon name="mic" size={18} />
            <span>बातचीत शुरू करें (Start Now)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] py-3 px-4 rounded-xl border border-[#DCE3EA] text-xs font-bold text-[#5F6B76] hover:bg-[#F7F9FC] transition-colors"
          >
            रद्द करें (Cancel)
          </button>
        </div>
      </div>
    </div>
  );
};
