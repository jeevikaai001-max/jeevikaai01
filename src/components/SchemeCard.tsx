import React, { useState } from 'react';
import { AppView, GovernmentScheme, SupportedLanguage } from '../types';
import { DEFAULT_SCHEME_IMAGE } from '../services/locationIntelligenceService';
import { dt, schemeName, isEnglishLike } from '../services/dashboardLocale';
import { Icon } from './Icons';

interface SchemeCardProps {
  scheme: GovernmentScheme;
  lang: SupportedLanguage;
  onNavigate?: (view: AppView) => void;
}

const CATEGORY_LABELS: Record<GovernmentScheme['category'], Record<SupportedLanguage, string>> = {
  central: {
    hi: 'केंद्रीय योजना',
    bho: 'केंद्रीय योजना',
    en: 'Central Scheme',
    hin: 'Central Scheme',
  },
  state: {
    hi: 'राज्य योजना',
    bho: 'राज्य योजना',
    en: 'State Scheme',
    hin: 'State Scheme',
  },
  toolkit: {
    hi: 'टूलकिट व प्रशिक्षण अनुदान',
    bho: 'टूलकिट अउर ट्रेनिंग अनुदान',
    en: 'Toolkit & Training Grant',
    hin: 'Toolkit & Training Grant',
  },
  loan: {
    hi: 'स्वरोजगार ऋण योजना',
    bho: 'स्वरोजगार लोन योजना',
    en: 'Business Loan Scheme',
    hin: 'Business Loan Scheme',
  },
};

const KNOWN_INTERNAL_VIEWS = new Set([
  'home',
  'assessment',
  'dashboard',
  'opportunities',
  'training',
  'skill-gap',
  'saved',
  'history',
  'profile',
  'notifications',
  'faq',
  'accessibility',
  'privacy',
  'about',
  'admin',
  'business-upload',
  'seller-analytics',
]);

export const SchemeCard: React.FC<SchemeCardProps> = ({ scheme, lang, onNavigate }) => {
  const [expanded, setExpanded] = useState(false);

  const schemeImg = scheme.imageUrl || DEFAULT_SCHEME_IMAGE;
  const title = schemeName(scheme, lang);
  const primaryBenefit = scheme.financialSupport || scheme.benefit;
  const hasSecondaryBenefit =
    Boolean(scheme.benefit) &&
    Boolean(scheme.financialSupport) &&
    scheme.benefit.trim() !== scheme.financialSupport.trim();

  const categoryText =
    CATEGORY_LABELS[scheme.category]?.[lang] ||
    CATEGORY_LABELS.central[lang] ||
    scheme.category;

  const moreLabel =
    lang === 'bho'
      ? expanded
        ? 'कम देखीं'
        : 'पूरा विवरण देखीं'
      : isEnglishLike(lang)
      ? expanded
        ? 'Show less'
        : 'View full eligibility & details'
      : expanded
      ? 'संक्षिप्त करें'
      : 'पात्रता व पूरी जानकारी देखें';

  const trimmedCta = scheme.ctaUrl?.trim() || '';
  const internalTarget =
    trimmedCta && !/^https?:\/\//i.test(trimmedCta)
      ? trimmedCta.replace(/^[/#]+/, '').toLowerCase()
      : '';
  const isInternalRoute = Boolean(internalTarget && KNOWN_INTERNAL_VIEWS.has(internalTarget));

  return (
    <article className="rounded-2xl border border-[#DCE3EA] bg-white flex flex-col overflow-hidden transition-colors hover:border-[#245A91]">
      <div className="w-full h-36 sm:h-40 bg-[#F7F9FC] relative overflow-hidden flex-none border-b border-[#DCE3EA]">
        <img
          src={schemeImg}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover object-center"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (!img.dataset.fallbackApplied) {
              img.dataset.fallbackApplied = '1';
              img.src = DEFAULT_SCHEME_IMAGE;
            }
          }}
        />
        {scheme.isAdminUploaded && (
          <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#17365D]/90 text-white border border-white/15">
            {lang === 'en' ? 'Featured Update' : 'विशेष योजना'}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[#5F6B76]">
          <span>{categoryText}</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#287D73] font-semibold">
            {lang === 'bho' ? 'सक्रिय' : isEnglishLike(lang) ? 'Verified' : 'सक्रिय योजना'}
          </span>
        </div>

        <h3
          className={`text-base font-extrabold text-[#17365D] leading-snug ${
            expanded ? '' : 'line-clamp-2'
          }`}
          title={title}
        >
          {title}
        </h3>

        <div className="pt-0.5">
          <div className="text-xs font-semibold text-[#5F6B76]">{dt('benefit', lang)}</div>
          <p
            className={`text-sm font-bold text-[#287D73] leading-snug mt-0.5 ${
              expanded ? '' : 'line-clamp-2'
            }`}
          >
            {primaryBenefit}
          </p>
          {expanded && hasSecondaryBenefit && (
            <p className="text-xs text-[#202B36] leading-relaxed mt-1">{scheme.benefit}</p>
          )}
        </div>

        {scheme.eligibility && (
          <div className="text-xs">
            <span className="font-semibold text-[#245A91]">{dt('eligible', lang)}: </span>
            <span
              className={`text-[#5F6B76] leading-relaxed ${
                expanded ? 'block mt-0.5' : 'line-clamp-1'
              }`}
            >
              {scheme.eligibility}
            </span>
          </div>
        )}

        <div className="mt-auto pt-2.5 border-t border-[#DCE3EA] flex flex-col gap-2">
          <div className="text-xs">
            <span className="font-semibold text-[#5F6B76]">{dt('applyAt', lang)}: </span>
            <span
              className={`font-bold text-[#17365D] ${
                expanded ? 'block mt-0.5' : 'line-clamp-1'
              }`}
            >
              {scheme.applyOffice}
            </span>
          </div>

          {trimmedCta && (
            isInternalRoute && onNavigate ? (
              <button
                type="button"
                onClick={() => onNavigate(internalTarget as AppView)}
                className="min-h-[40px] w-full px-3 py-1.5 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>{scheme.ctaLabel || (lang === 'en' ? 'Open Details' : 'योजना देखें')}</span>
                <Icon name="arrowR" size={13} />
              </button>
            ) : (
              <a
                href={trimmedCta}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] w-full px-3 py-1.5 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>{scheme.ctaLabel || (lang === 'en' ? 'Apply / View More' : 'आवेदन / जानकारी देखें')}</span>
                <Icon name="arrowR" size={13} />
              </a>
            )
          )}

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="min-h-[40px] w-full px-3 py-1.5 rounded-xl bg-[#F7F9FC] hover:bg-slate-200/70 border border-[#DCE3EA] text-xs font-bold text-[#17365D] flex items-center justify-between transition-colors"
          >
            <span>{moreLabel}</span>
            <Icon
              name="chev"
              size={14}
              className={`text-[#245A91] transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>
    </article>
  );
};
