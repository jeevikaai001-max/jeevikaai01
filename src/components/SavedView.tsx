import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icons';
import { LocationLivelihoodData, Opportunity, SupportedLanguage } from '../types';
import { JOBS } from '../data/mockData';
import { contentService } from '../services/firebase';
import { speechService } from '../services/speechService';

interface SavedViewProps {
  shortlist: Record<string, boolean>;
  savedItems?: Record<string, Opportunity>;
  locationData?: LocationLivelihoodData | null;
  currentLang?: SupportedLanguage;
  onShortlistToggle: (id: string, item?: Opportunity) => void;
  onSelectDetail: (opp: Opportunity) => void;
  go: (route: string) => void;
}

export const SavedView: React.FC<SavedViewProps> = ({
  shortlist,
  savedItems = {},
  locationData,
  currentLang = 'hi',
  onShortlistToggle,
  onSelectDetail,
  go,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'opportunities' | 'training'>('all');
  const [firestoreItems, setFirestoreItems] = useState<Opportunity[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let oppList: Opportunity[] = [];
    let centerList: Opportunity[] = [];

    const mergeAndSet = () => {
      if (!active) return;
      const map = new Map<string, Opportunity>();
      oppList.forEach((item) => {
        if (item?.id) map.set(item.id, item);
      });
      centerList.forEach((item) => {
        if (item?.id) map.set(item.id, { ...item, type: 'Training' });
      });
      setFirestoreItems(Array.from(map.values()));
    };

    const unsubOpp = contentService.subscribe<Opportunity>(
      'opportunities',
      (items) => {
        oppList = items || [];
        mergeAndSet();
      },
      () => {}
    );

    const unsubCenters = contentService.subscribe<Opportunity>(
      'training_centers',
      (items) => {
        centerList = items || [];
        mergeAndSet();
      },
      () => {}
    );

    return () => {
      active = false;
      unsubOpp();
      unsubCenters();
    };
  }, []);

  const savedOpportunities = useMemo(() => {
    const catalogMap = new Map<string, Opportunity>();

    // 1. Static catalog
    JOBS.forEach((item) => {
      if (item?.id) catalogMap.set(item.id, item);
    });

    // 2. Live Firestore opportunities & training centers
    firestoreItems.forEach((item) => {
      if (item?.id) catalogMap.set(item.id, item);
    });

    // 3. Active location opportunities & training centers
    (locationData?.opportunities || []).forEach((item) => {
      if (item?.id) catalogMap.set(item.id, item);
    });
    (locationData?.trainingCenters || []).forEach((item) => {
      if (item?.id) catalogMap.set(item.id, { ...item, type: 'Training' });
    });

    // 4. Persisted snapshots of items saved by the user
    Object.values(savedItems).forEach((item) => {
      if (item?.id) catalogMap.set(item.id, item);
    });

    const list: Opportunity[] = [];
    Object.entries(shortlist).forEach(([id, isSaved]) => {
      if (isSaved) {
        const found = catalogMap.get(id);
        if (found) {
          list.push(found);
        }
      }
    });

    return list;
  }, [shortlist, savedItems, locationData, firestoreItems]);

  const savedJobsList = useMemo(
    () => savedOpportunities.filter((o) => o.type !== 'Training'),
    [savedOpportunities]
  );

  const savedTrainingList = useMemo(
    () => savedOpportunities.filter((o) => o.type === 'Training'),
    [savedOpportunities]
  );

  const handleListen = (opp: Opportunity) => {
    if (speakingId === opp.id) {
      speechService.stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(opp.id);
    const label = opp.type === 'Training' ? 'प्रशिक्षण केंद्र' : 'रोजगार अवसर';
    const text =
      currentLang === 'en'
        ? `${opp.type}: ${opp.title}. Organization: ${opp.org}. Pay or support: ${opp.pay}. Location: ${opp.loc}.`
        : `${label}: ${opp.title}। संस्थान: ${opp.org}। लाभ या वेतन: ${opp.pay}। स्थान: ${opp.loc}।`;

    speechService.speak(text, currentLang, () => {
      setSpeakingId(null);
    });
  };

  const renderSavedCard = (opp: Opportunity) => {
    const isAudioPlaying = speakingId === opp.id;
    const typeBadgeLabel =
      opp.type === 'Training'
        ? currentLang === 'en'
          ? 'PMKVY / RSETI Training'
          : 'PMKVY / RSETI प्रशिक्षण'
        : opp.type === 'Self-employment'
        ? currentLang === 'en'
          ? 'Self-Employment'
          : 'स्वरोजगार'
        : currentLang === 'en'
        ? 'Job Opportunity'
        : 'रोजगार / नौकरी';

    return (
      <div
        key={opp.id}
        className="bg-white border border-[#DCE3EA] rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-[#245A91] transition-colors"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                opp.type === 'Job'
                  ? 'bg-[#F7F9FC] text-[#245A91] border-[#DCE3EA]'
                  : opp.type === 'Training'
                  ? 'bg-[#287D73]/10 text-[#287D73] border-[#287D73]/25'
                  : 'bg-[#FFF8EB] text-[#B45309] border-[#FDE68A]'
              }`}
            >
              {typeBadgeLabel}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleListen(opp)}
                className={`min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-colors ${
                  isAudioPlaying
                    ? 'bg-[#D9822B] text-white'
                    : 'bg-[#F7F9FC] text-[#17365D] hover:bg-[#EBF3FA] border border-[#DCE3EA]'
                }`}
              >
                <Icon name={isAudioPlaying ? 'volumeX' : 'volume2'} size={13} />
                <span>{isAudioPlaying ? 'रोकें' : 'सुनें'}</span>
              </button>

              <button
                type="button"
                onClick={() => onShortlistToggle(opp.id, opp)}
                className="min-h-[36px] px-2 text-xs text-[#9E2A2B] font-semibold hover:underline flex items-center gap-1"
              >
                <Icon name="x" size={12} />
                <span>{currentLang === 'en' ? 'Remove' : 'हटाएं'}</span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#17365D] leading-snug">
              {opp.title}
            </h3>
            <div className="text-xs text-[#5F6B76] font-semibold mt-0.5">
              {opp.org}
            </div>
          </div>

          <div className="p-3.5 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA] text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-[#17365D] font-bold tabular-nums">
              <Icon name="pin" size={14} className="text-[#245A91]" />
              <span>
                {opp.loc} ({typeof opp.km === 'number' && opp.km > 0 ? opp.km : 4} km दूर)
              </span>
            </div>
            <div className="text-[#287D73] font-bold tabular-nums">
              {opp.pay}
            </div>
          </div>

          {opp.eligibility && (
            <p className="text-xs text-[#5F6B76] leading-relaxed line-clamp-2">
              <strong className="text-[#17365D]">
                {currentLang === 'en' ? 'Eligibility:' : 'पात्रता:'}
              </strong>{' '}
              {opp.eligibility}
            </p>
          )}
        </div>

        <div className="pt-3 border-t border-[#DCE3EA] flex items-center justify-between">
          <button
            type="button"
            onClick={() => onSelectDetail(opp)}
            className="min-h-[44px] inline-flex items-center gap-1 text-xs font-bold text-[#245A91] hover:underline"
          >
            <span>
              {currentLang === 'en'
                ? 'View Map, Criteria & Apply'
                : 'मैप, पात्रता व आवेदन विवरण देखें'}
            </span>
            <Icon name="arrowR" size={13} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#DCE3EA] mb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#D9822B] mb-1.5">
            <Icon name="star" size={14} className="fill-[#D9822B]" />
            <span>
              {currentLang === 'bho'
                ? 'सहेजल सूची'
                : currentLang === 'en'
                ? 'Personal Bookmarks'
                : 'व्यक्तिगत सहेजी गई सूची'}
            </span>
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
            {currentLang === 'bho'
              ? 'सहेजल रोजगार अउर PMKVY / RSETI केंद्र'
              : currentLang === 'en'
              ? 'Saved Job Directory & PMKVY / RSETI Centers'
              : 'सहेजे गए रोजगार अवसर व PMKVY / RSETI केंद्र'}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => go('opportunities')}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#DCE3EA] bg-white text-[#17365D] text-xs font-bold hover:bg-[#F7F9FC] transition-colors"
          >
            <Icon name="briefcase" size={14} className="text-[#245A91]" />
            <span>
              {currentLang === 'bho'
                ? 'रोजगार अवसर देखीं'
                : currentLang === 'en'
                ? 'Job Directory'
                : 'रोजगार अवसर देखें'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => go('training')}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#DCE3EA] bg-white text-[#17365D] text-xs font-bold hover:bg-[#F7F9FC] transition-colors"
          >
            <Icon name="cap" size={14} className="text-[#287D73]" />
            <span>
              {currentLang === 'bho'
                ? 'PMKVY / RSETI देखीं'
                : currentLang === 'en'
                ? 'PMKVY / RSETI Centers'
                : 'PMKVY / RSETI केंद्र देखें'}
            </span>
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      {savedOpportunities.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-6 text-xs font-bold">
          {[
            {
              id: 'all',
              label:
                currentLang === 'en'
                  ? `All Sections (${savedOpportunities.length})`
                  : `सभी अनुभाग (${savedOpportunities.length})`,
            },
            {
              id: 'opportunities',
              label:
                currentLang === 'en'
                  ? `Job Directory (${savedJobsList.length})`
                  : `रोजगार अवसर / Job Directory (${savedJobsList.length})`,
            },
            {
              id: 'training',
              label:
                currentLang === 'en'
                  ? `PMKVY / RSETI (${savedTrainingList.length})`
                  : `PMKVY / RSETI प्रशिक्षण (${savedTrainingList.length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id as 'all' | 'opportunities' | 'training')}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-[#17365D] text-white'
                  : 'bg-white text-[#5F6B76] border border-[#DCE3EA] hover:border-[#245A91]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {savedOpportunities.length > 0 ? (
        <div className="space-y-10">
          {/* Section 1: Job Directory / रोजगार अवसर */}
          {(filterType === 'all' || filterType === 'opportunities') && (
            <section aria-labelledby="saved-jobs-heading" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F7F9FC] border border-[#DCE3EA] rounded-2xl px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#245A91] text-white flex items-center justify-center flex-shrink-0">
                    <Icon name="briefcase" size={20} />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#245A91]">
                      Job Directory · रोजगार निदेशिका
                    </div>
                    <h2
                      id="saved-jobs-heading"
                      className="text-lg sm:text-xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']"
                    >
                      {currentLang === 'bho'
                        ? 'सहेजल रोजगार अवसर'
                        : currentLang === 'en'
                        ? 'Saved Job & Self-Employment Opportunities'
                        : 'सहेजे गए रोजगार व स्वरोजगार अवसर'}
                    </h2>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-white text-[#245A91] border border-[#DCE3EA] tabular-nums">
                  {savedJobsList.length} {currentLang === 'en' ? 'saved' : 'सहेजे गए'}
                </span>
              </div>

              {savedJobsList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {savedJobsList.map((opp) => renderSavedCard(opp))}
                </div>
              ) : (
                <div className="bg-white border border-dashed border-[#DCE3EA] rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-[#5F6B76] text-center sm:text-left">
                    {currentLang === 'en'
                      ? 'No job opportunities saved in this section yet.'
                      : 'इस अनुभाग में अभी कोई रोजगार अवसर सहेजा नहीं गया है।'}
                  </div>
                  <button
                    type="button"
                    onClick={() => go('opportunities')}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    {currentLang === 'en' ? 'Browse Job Directory' : 'रोजगार अवसर देखें'}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Section 2: PMKVY / RSETI Training Centers */}
          {(filterType === 'all' || filterType === 'training') && (
            <section aria-labelledby="saved-training-heading" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F7F9FC] border border-[#DCE3EA] rounded-2xl px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#287D73] text-white flex items-center justify-center flex-shrink-0">
                    <Icon name="cap" size={20} />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#287D73]">
                      PMKVY / RSETI · कौशल प्रशिक्षण केंद्र
                    </div>
                    <h2
                      id="saved-training-heading"
                      className="text-lg sm:text-xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']"
                    >
                      {currentLang === 'bho'
                        ? 'सहेजल PMKVY / RSETI प्रशिक्षण केंद्र'
                        : currentLang === 'en'
                        ? 'Saved PMKVY / RSETI Training Centers'
                        : 'सहेजे गए PMKVY / RSETI प्रशिक्षण केंद्र'}
                    </h2>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-white text-[#287D73] border border-[#DCE3EA] tabular-nums">
                  {savedTrainingList.length} {currentLang === 'en' ? 'saved' : 'सहेजे गए'}
                </span>
              </div>

              {savedTrainingList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {savedTrainingList.map((opp) => renderSavedCard(opp))}
                </div>
              ) : (
                <div className="bg-white border border-dashed border-[#DCE3EA] rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-[#5F6B76] text-center sm:text-left">
                    {currentLang === 'en'
                      ? 'No PMKVY / RSETI training centers saved in this section yet.'
                      : 'इस अनुभाग में अभी कोई PMKVY / RSETI प्रशिक्षण केंद्र सहेजा नहीं गया है।'}
                  </div>
                  <button
                    type="button"
                    onClick={() => go('training')}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#287D73] hover:bg-[#17365D] text-white text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    {currentLang === 'en' ? 'Browse PMKVY / RSETI' : 'PMKVY / RSETI केंद्र देखें'}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-[#DCE3EA] rounded-2xl p-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#F7F9FC] border border-[#DCE3EA] text-[#5F6B76] flex items-center justify-center mx-auto">
            <Icon name="star" size={28} />
          </div>
          <h3 className="text-lg font-bold text-[#17365D]">
            {currentLang === 'bho'
              ? 'अभी तक कवनो अवसर भा केंद्र सहेजल नइखे गइल'
              : currentLang === 'en'
              ? 'No jobs or training centers saved yet'
              : 'अभी तक कोई रोजगार अवसर या प्रशिक्षण केंद्र नहीं सहेजा गया है'}
          </h3>
          <p className="text-xs text-[#5F6B76] max-w-md mx-auto leading-relaxed">
            {currentLang === 'bho'
              ? 'रोजगार अवसर भा PMKVY / RSETI प्रशिक्षण केंद्र देखत समय "सहेजीं" बटन दबाईं — ऊ सब कार्ड इहाँ अलग-अलग अनुभाग में दिखाई दी।'
              : currentLang === 'en'
              ? 'While browsing the Job Directory or PMKVY / RSETI centers, tap "Shortlist / Save" to see them organized section by section here.'
              : 'रोजगार अवसर (Job Directory) या PMKVY / RSETI प्रशिक्षण केंद्र देखते समय "सहेजें" बटन दबाएं — वे सभी कार्ड यहाँ अलग-अलग अनुभाग में दिखाई देंगे।'}
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={() => go('opportunities')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white text-xs font-bold transition-colors"
            >
              {currentLang === 'en' ? 'Browse Job Directory' : 'रोजगार अवसर देखें'}
            </button>
            <button
              type="button"
              onClick={() => go('training')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#287D73] hover:bg-[#17365D] text-white text-xs font-bold transition-colors"
            >
              {currentLang === 'en' ? 'Browse PMKVY / RSETI' : 'PMKVY / RSETI केंद्र देखें'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
