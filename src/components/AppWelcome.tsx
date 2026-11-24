import React from 'react';
import { LogoMark } from './Logo';
import { Icon } from './Icons';
import { SupportedLanguage } from '../types';

interface AppWelcomeProps {
  currentLang: SupportedLanguage;
  onOpenAccount: (mode: 'create' | 'login') => void;
  onLoadDemo: () => void;
}

export const AppWelcome: React.FC<AppWelcomeProps> = ({
  currentLang,
  onOpenAccount,
  onLoadDemo,
}) => {
  return (
    <div className="fixed inset-0 z-40 bg-[#17365D] flex flex-col items-center justify-between p-3 sm:p-6 overflow-y-auto">
      <div className="gov-tricolor-line absolute top-0 left-0 right-0" />

      {/* Top Banner */}
      <div className="w-full max-w-md mt-2 relative rounded-2xl overflow-hidden border border-white/20 h-24 sm:h-28 flex-shrink-0">
        <img
          src="/src/assets/images/hero_livelihood_banner_1795513568498.jpg"
          alt="Rural Artisan & Skill Empowerment"
          className="w-full h-full object-cover brightness-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#17365D]/90 via-[#17365D]/40 to-transparent flex flex-col justify-end p-3 text-left">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#287D73] text-white w-max">
            <Icon name="award" size={12} className="text-[#F4B966]" />
            <span>राष्ट्रीय कौशल मिशन (NSQF)</span>
          </div>
          <div className="text-white text-xs sm:text-sm font-extrabold mt-0.5">
            ग्रामीण हुनरमंदों व महिला उद्यमियों का डिजिटल सशक्तिकरण
          </div>
        </div>
      </div>

      {/* Center Welcome Card */}
      <div className="max-w-md w-full bg-white rounded-2xl p-5 sm:p-6 border border-[#DCE3EA] text-center space-y-3.5 my-2 flex-shrink-0">
        <div className="mx-auto flex flex-col items-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-[#17365D] text-white flex items-center justify-center border border-[#245A91]">
            <LogoMark size={38} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[#17365D] tracking-tight font-['Bricolage_Grotesque']">
              Jeevika<span className="text-[#245A91]">AI</span>
            </h1>
            <p className="text-[11px] font-bold text-[#287D73] mt-0.5">
              ग्रामीण हुनर व आजीविका सहायक
            </p>
          </div>
        </div>

        {/* Voice-First Summary Box */}
        <div className="p-3 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA] text-left space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#17365D]">
            <Icon name="mic" size={13} className="text-[#287D73]" />
            <span>Voice-First Assistant · बोलकर संवाद करें</span>
          </div>
          <p className="text-[11px] text-[#5F6B76] leading-snug">
            {currentLang === 'bho'
              ? 'हिंदी अउर भोजपुरी में बोलकर आपन शिक्षा आ कौशल दर्ज करीं। बिना फॉर्म भरले सीधे आजीविका रोडमैप पावीं।'
              : 'हिंदी और भोजपुरी में बोलकर अपनी शिक्षा और कौशल दर्ज करें। बिना फॉर्म भरे सीधे आजीविका रोडमैप पाएं।'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={() => onOpenAccount('create')}
            className="w-full min-h-[48px] px-6 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white text-sm font-extrabold transition-colors flex items-center justify-center gap-2"
          >
            <span>
              {currentLang === 'bho' ? 'नया खाता बनाईं (Create Account)' : 'खाता बनाएं (Create Account)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenAccount('login')}
            className="w-full min-h-[48px] px-6 rounded-xl bg-[#17365D] hover:bg-[#245A91] text-white text-sm font-extrabold transition-colors flex items-center justify-center gap-2"
          >
            <span>
              {currentLang === 'bho' ? 'लॉगिन करीं (Log In)' : 'लॉगिन करें (Log In)'}
            </span>
          </button>

          <button
            type="button"
            onClick={onLoadDemo}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-[#DCE3EA] bg-[#F7F9FC] text-[#17365D] hover:bg-slate-100 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Icon name="user" size={14} className="text-[#287D73]" />
            <span>डेमो देखें (Load Demo)</span>
          </button>
        </div>

        <div className="pt-1 text-[11px] text-[#5F6B76] font-medium flex items-center justify-center gap-1.5">
          <Icon name="shieldCheck" size={14} className="text-[#287D73]" />
          <span>सुरक्षित मोबाइल नंबर + PIN आधारित प्रणाली</span>
        </div>
      </div>

      {/* Bottom Banner */}
      <div className="w-full max-w-md mb-1 relative rounded-2xl overflow-hidden border border-white/15 h-16 sm:h-20 flex-shrink-0">
        <img
          src="/src/assets/images/trade_tailoring_1795513566462.jpg"
          alt="Community Livelihood Growth"
          className="w-full h-full object-cover brightness-75"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#17365D]/85 to-[#287D73]/70 flex items-center justify-center px-4 text-center">
          <div className="text-white text-[11px] sm:text-xs font-bold flex items-center gap-2">
            <Icon name="briefcase" size={14} className="text-[#F4B966] flex-shrink-0" />
            <span>स्थानीय स्वयं सहायता समूह (SHG) एवं कारीगरों हेतु समर्पित</span>
          </div>
        </div>
      </div>
    </div>
  );
};
