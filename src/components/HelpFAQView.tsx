import React, { useState } from 'react';
import { Icon } from './Icons';

interface HelpFAQViewProps {
  initialTab?: 'faq' | 'accessibility' | 'privacy' | 'about';
  go: (route: string) => void;
}

export const HelpFAQView: React.FC<HelpFAQViewProps> = ({
  initialTab = 'faq',
  go,
}) => {
  const [activeTab, setActiveTab] = useState<'faq' | 'accessibility' | 'privacy' | 'about'>(initialTab);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does the automatic voice conversation work?',
      a: 'When you tap Start Assessment, JeevikaAI speaks a question aloud using text-to-speech. You speak your answer in Hindi, Bhojpuri, or English. As soon as you stop speaking, the system automatically recognizes your speech, extracts your skills or preferences, and advances to the next question without requiring manual clicks.',
    },
    {
      q: 'Is JeevikaAI an official government portal?',
      a: 'No. JeevikaAI is an independent, non-commercial public-interest platform. While training pathways are aligned with the National Skills Qualifications Framework (NSQF) standards, JeevikaAI is not operated by, affiliated with, or endorsed by any government ministry. It is free to use and never charges beneficiaries. To learn more about our team and background, visit the About Us tab.',
    },
    {
      q: 'What is an NSQF Level?',
      a: 'The National Skills Qualifications Framework (NSQF) organizes qualifications according to levels of knowledge, skills, and aptitude from Level 1 to 10. For example, Level 3 covers entry-level service assistants and operators, while Level 4 represents skilled technicians.',
    },
    {
      q: 'What if my microphone is not supported or blocked?',
      a: 'JeevikaAI provides a full text alternative. You can tap "Continue with Text" at any point during the assessment to select options or type answers directly.',
    },
    {
      q: 'Can I speak in Bhojpuri or regional Hindi dialects?',
      a: 'Yes. JeevikaAI includes Bhojpuri vocabulary mappings (e.g., “रउआ नाम का बा?”, “हमरा सिलाई सीखे के बा”). If your browser speech recognition interprets words in standard Hindi, the platform displays the recognized text so you can confirm or correct it.',
    },
    {
      q: 'How do I download or share my roadmap summary?',
      a: 'On your dashboard, tap "Download Summary". You can save the summary as a PDF or text (.txt) file, or copy it to WhatsApp to share with a family member, trainer, or Panchayat coordinator.',
    },
  ];

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="pb-6 border-b border-[#DCE3EA] mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
          {activeTab === 'about'
            ? 'About JeevikaAI · हमारे बारे में'
            : 'Help, Accessibility & Privacy · सहायता एवं नीतियाँ'}
        </h1>
        <p className="text-sm text-[#5F6B76] mt-1">
          {activeTab === 'about'
            ? 'The vision, origins, and team behind the voice-first livelihood discovery platform.'
            : 'Everything you need to know about our voice technology, accessibility commitments, and data practices.'}
        </p>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2 mt-4 text-xs font-bold">
          {[
            { id: 'about', label: 'About Us (हमारे बारे में)' },
            { id: 'faq', label: 'Frequently Asked Questions (FAQ)' },
            { id: 'accessibility', label: 'Accessibility Standards' },
            { id: 'privacy', label: 'Privacy & Data Rights' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`min-h-[44px] px-4 py-2 rounded-xl transition-colors border ${
                activeTab === tab.id
                  ? 'bg-[#17365D] text-white border-[#17365D]'
                  : 'bg-[#F7F9FC] text-[#5F6B76] border-[#DCE3EA] hover:border-[#245A91] hover:text-[#17365D]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: FAQ Accordion */}
      {activeTab === 'faq' && (
        <div className="bg-white border border-[#DCE3EA] rounded-2xl p-6 sm:p-8 space-y-3.5">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border border-[#DCE3EA] rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full min-h-[48px] p-4 text-left font-bold text-sm text-[#17365D] flex items-center justify-between gap-4 bg-[#F7F9FC] hover:bg-slate-100 transition-colors"
              >
                <span>{faq.q}</span>
                <Icon
                  name="chev"
                  size={14}
                  className={`flex-shrink-0 transition-transform duration-200 ${
                    openFaq === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openFaq === i && (
                <div className="p-4 text-xs sm:text-sm text-[#5F6B76] leading-relaxed bg-white border-t border-[#DCE3EA]">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Accessibility Information */}
      {activeTab === 'accessibility' && (
        <div className="bg-white border border-[#DCE3EA] rounded-2xl p-6 sm:p-8 space-y-5 text-xs sm:text-sm text-[#5F6B76] leading-relaxed">
          <div className="flex items-center gap-2 text-[#287D73] font-bold text-base">
            <Icon name="check" size={18} />
            <span>Inclusive Design Commitments (सुलभता मानक)</span>
          </div>
          <p>
            JeevikaAI is engineered specifically for individuals with limited literacy, older adults, and rural smartphone users who face digital barriers.
          </p>
          <div className="space-y-3">
            <div className="p-4 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA]">
              <h4 className="font-bold text-[#17365D] mb-1">Voice-First Operability</h4>
              <p>Every core feature can be driven through speech without requiring reading complex menus or forms.</p>
            </div>
            <div className="p-4 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA]">
              <h4 className="font-bold text-[#17365D] mb-1">Auditory Readouts (Text-to-Speech)</h4>
              <p>Questions, status updates, and roadmap summaries are equipped with speaker buttons so non-readers can listen in Hindi or Bhojpuri.</p>
            </div>
            <div className="p-4 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA]">
              <h4 className="font-bold text-[#17365D] mb-1">High Contrast &amp; Large Hitboxes</h4>
              <p>Every interactive touch target is sized to at least 44x44px with WCAG AA compliant contrast ratios (minimum 4.5:1 for body copy).</p>
            </div>
            <div className="p-4 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA]">
              <h4 className="font-bold text-[#17365D] mb-1">Keyboard Navigation &amp; Screen Readers</h4>
              <p>Full focus indicators and ARIA live regions provide real-time status announcements for assistive screen readers.</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Privacy & Data Rights */}
      {activeTab === 'privacy' && (
        <div className="bg-white border border-[#DCE3EA] rounded-2xl p-6 sm:p-8 space-y-5 text-xs sm:text-sm text-[#5F6B76] leading-relaxed">
          <div className="flex items-center gap-2 text-[#17365D] font-bold text-base">
            <Icon name="info" size={18} className="text-[#245A91]" />
            <span>Transparent Data Principles (गोपनीयता नीति)</span>
          </div>
          <p>
            We adhere strictly to the principle of <strong>Data Minimization</strong> and informed consent:
          </p>
          <div className="space-y-3">
            <div className="p-4 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA]">
              <h4 className="font-bold text-[#17365D] mb-1">What We Collect</h4>
              <p>Only education level, existing skills, career interests, preferred work type, and general travel mobility radius. We do not ask for Aadhaar numbers, bank passwords, or sensitive financial data.</p>
            </div>
            <div className="p-4 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA]">
              <h4 className="font-bold text-[#17365D] mb-1">Local Storage vs Cloud Storage</h4>
              <p>By default, your profile is stored locally inside your browser or mobile phone memory. If you choose to create an account, data is stored securely in your private user document protected by Firebase Security Rules.</p>
            </div>
            <div className="p-4 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA]">
              <h4 className="font-bold text-[#17365D] mb-1">Right to Erase &amp; Delete</h4>
              <p>You can erase all locally stored answers or sign out anytime from your Profile page with one tap.</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: About Us & Team Knight Coders Initiative */}
      {activeTab === 'about' && (
        <div className="bg-white border border-[#DCE3EA] rounded-2xl p-6 sm:p-8 space-y-7">
          <div className="bg-[#17365D] text-white rounded-2xl p-6 sm:p-8">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#F4B966] mb-2">
              Team Knight Coders · Livelihood Discovery Initiative
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-['Bricolage_Grotesque']">
              Bridging India's Digital Divide Through Voice-First AI
            </h2>
            <p className="mt-3 text-sm text-[#C9DAEC] max-w-2xl leading-relaxed">
              JeevikaAI was conceptualized and developed by <strong>Team Knight Coders</strong> as an open civic innovation project. Our mission is to make NSQF-aligned vocational discovery and employment pathways accessible to millions of first-time digital users through conversational voice in Hindi, Bhojpuri, and English.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs sm:text-sm text-[#5F6B76]">
            <div className="bg-[#F7F9FC] border border-[#DCE3EA] rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#17365D] font-bold text-base">
                <Icon name="target" size={18} className="text-[#245A91]" />
                <span>The Challenge</span>
              </div>
              <p className="leading-relaxed">
                Over 300 million citizens across semi-urban and rural India face language barriers, complex multi-page online forms, and unfamiliar bureaucratic terminology when seeking skill development programs or local employment opportunities.
              </p>
            </div>

            <div className="bg-[#F7F9FC] border border-[#DCE3EA] rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#287D73] font-bold text-base">
                <Icon name="check" size={18} className="text-[#287D73]" />
                <span>Our Solution</span>
              </div>
              <p className="leading-relaxed">
                JeevikaAI replaces intimidating dropdowns and text inputs with a natural, guided voice conversation. Users simply speak about their education, interests, and preferences, and the system automatically matches them with government-recognized NSQF pathways and local vocational courses.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-[#17365D]">
              Key Architectural Innovations Built for JeevikaAI
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="border border-[#DCE3EA] rounded-xl p-4 space-y-2 bg-white">
                <div className="w-9 h-9 rounded-lg bg-[#EBF3FB] text-[#245A91] flex items-center justify-center">
                  <Icon name="mic" size={18} />
                </div>
                <h4 className="font-bold text-[#17365D] text-sm">Voice-First Turn Engine</h4>
                <p className="text-[#5F6B76] leading-relaxed">
                  Autonomous speech recognition with end-of-speech stability detection, visual frequency analyzers, and zero manual "Next" button friction.
                </p>
              </div>
              <div className="border border-[#DCE3EA] rounded-xl p-4 space-y-2 bg-white">
                <div className="w-9 h-9 rounded-lg bg-[#E9F4F2] text-[#287D73] flex items-center justify-center">
                  <Icon name="globe" size={18} />
                </div>
                <h4 className="font-bold text-[#17365D] text-sm">Dialect &amp; Indic Support</h4>
                <p className="text-[#5F6B76] leading-relaxed">
                  Tailored vocabulary models for Bhojpuri and conversational Hindi, supporting colloquial phrases and regional occupation titles.
                </p>
              </div>
              <div className="border border-[#DCE3EA] rounded-xl p-4 space-y-2 bg-white">
                <div className="w-9 h-9 rounded-lg bg-[#FFF4DB] text-[#D9822B] flex items-center justify-center">
                  <Icon name="device" size={18} />
                </div>
                <h4 className="font-bold text-[#17365D] text-sm">Installable Offline PWA</h4>
                <p className="text-[#5F6B76] leading-relaxed">
                  Progressive Web App architecture that installs directly on budget Android smartphones, cached for offline access and intermittent rural connectivity.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-[#DCE3EA] pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-sm text-[#17365D]">
                Built with dedication by Team Knight Coders
              </h4>
              <p className="text-xs text-[#5F6B76] mt-0.5">
                Open civic technology for empowerment and livelihood discovery.
              </p>
            </div>
            <button
              onClick={() => go('assessment')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <span>Try Voice Assessment Now</span>
              <Icon name="arrowR" size={14} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
