import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from './Icons';
import { SchemeCard } from './SchemeCard';
import {
  Opportunity,
  SupportedLanguage,
  LocationLivelihoodData,
  BeneficiaryProfile,
  MediaAssetRecord,
} from '../types';
import { JOBS } from '../data/mockData';
import { t } from '../services/translationService';
import { contentService, OperationType, handleFirestoreError } from '../services/firebase';
import { speechService } from '../services/speechService';
import { POPULAR_INDIAN_REGIONS, locationIntelligenceService } from '../services/locationIntelligenceService';
import {
  mediaStorageService,
  applyAdminSchemeImages,
} from '../services/cloudinaryService';

interface OpportunitiesViewProps {
  onShortlistToggle: (id: string, item?: Opportunity) => void;
  shortlist: Record<string, boolean>;
  onSelectDetail: (opp: Opportunity) => void;
  go: (route: string) => void;
  currentLang: SupportedLanguage;
  locationData?: LocationLivelihoodData | null;
  onLocationChange?: (newLoc: string) => void;
  onRefreshAi?: () => Promise<void>;
  isRefreshingAi?: boolean;
  userProfile?: BeneficiaryProfile | null;
}

interface EnrichedOpportunity extends Opportunity {
  isLiveFirestore?: boolean;
  fromLocationData?: boolean;
}

export const OpportunitiesView: React.FC<OpportunitiesViewProps> = ({
  onShortlistToggle,
  shortlist,
  onSelectDetail,
  go,
  currentLang,
  locationData,
  onLocationChange,
  onRefreshAi,
  isRefreshingAi = false,
  userProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'nearby' | 'district' | 'self'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [firestoreOpportunities, setFirestoreOpportunities] = useState<Opportunity[]>([]);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState<boolean>(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [speakingJobId, setSpeakingJobId] = useState<string | null>(null);
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [mediaAssets, setMediaAssets] = useState<MediaAssetRecord[]>([]);

  useEffect(() => {
    let isMounted = true;
    const unsub = mediaStorageService.subscribeMediaAssets((assets) => {
      if (!isMounted) return;
      setMediaAssets(assets || []);
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const initialDistrict = useMemo(() => {
    if (locationData?.district) return locationData.district;
    if (userProfile?.location) {
      const parts = userProfile.location.split(',').map((p) => p.trim()).filter(Boolean);
      const dist = parts.length >= 3 ? parts[parts.length - 2] : parts[0];
      return dist || 'Maharajganj';
    }
    return 'Maharajganj';
  }, [locationData?.district, userProfile?.location]);

  const [selectedDistrict, setSelectedDistrict] = useState<string>(initialDistrict);
  const [showDistrictModal, setShowDistrictModal] = useState<boolean>(false);

  useEffect(() => {
    if (locationData?.district && locationData.district !== selectedDistrict) {
      setSelectedDistrict(locationData.district);
    } else if (!locationData?.district && initialDistrict && initialDistrict !== selectedDistrict) {
      setSelectedDistrict(initialDistrict);
    }
  }, [locationData?.district, initialDistrict]);

  const handleAutoDetectCurrentLocation = async () => {
    if (isDetectingGps) return;
    setIsDetectingGps(true);
    try {
      const detected = await locationIntelligenceService.detectGpsLocation();
      if (detected && detected.location) {
        setSelectedDistrict(detected.district || detected.location.split(',')[0].trim());
        if (onLocationChange) {
          onLocationChange(detected.location);
        }
      }
    } catch {
      // Ignore permission denied
    } finally {
      setIsDetectingGps(false);
    }
  };

  useEffect(() => {
    let isSubscribed = true;
    setIsLoadingFirestore(true);

    const unsubscribe = contentService.subscribe<Opportunity>(
      'opportunities',
      (items) => {
        if (!isSubscribed) return;
        setFirestoreOpportunities(items || []);
        setIsLoadingFirestore(false);
        setFirestoreError(null);
      },
      (err) => {
        if (!isSubscribed) return;
        setIsLoadingFirestore(false);
        handleFirestoreError(err, OperationType.LIST, 'opportunities');
        setFirestoreError(
          currentLang === 'bho'
            ? 'फ़ायरबेस से लाइव संपर्क धीमा बा, स्थानीय सुरक्षित डेटा देखावल जात बा।'
            : currentLang === 'en'
            ? 'Live Firestore sync slow or offline; serving verified local catalog.'
            : 'फ़ायरबेस से लाइव संपर्क धीमा है, स्थानीय प्रमाणित डेटा दिखाया जा रहा है।'
        );
      }
    );

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [currentLang]);

  const combinedOpportunities = useMemo<EnrichedOpportunity[]>(() => {
    const list: EnrichedOpportunity[] = [];
    const seenKeys = new Set<string>();

    if (locationData?.opportunities && locationData.opportunities.length > 0) {
      locationData.opportunities.forEach((opp) => {
        if (opp.type === 'Training') return;
        const key = `${opp.title.toLowerCase().trim()}|${opp.org.toLowerCase().trim()}`;
        if (!seenKeys.has(key) && !seenKeys.has(opp.id)) {
          seenKeys.add(key);
          seenKeys.add(opp.id);
          list.push({
            ...opp,
            km: typeof opp.km === 'number' ? opp.km : 4,
            isLiveFirestore: false,
            fromLocationData: true,
          });
        }
      });
    }

    firestoreOpportunities.forEach((opp) => {
      if (opp.type === 'Training') return;
      const key = `${opp.title.toLowerCase().trim()}|${opp.org.toLowerCase().trim()}`;
      if (!seenKeys.has(key) && !seenKeys.has(opp.id)) {
        seenKeys.add(key);
        seenKeys.add(opp.id);
        list.push({ ...opp, isLiveFirestore: true, fromLocationData: false });
      }
    });

    const hasLiveLocationOpportunities = list.length > 0;
    if (!hasLiveLocationOpportunities) {
      JOBS.filter((j) => j.type !== 'Training').forEach((opp) => {
        const key = `${opp.title.toLowerCase().trim()}|${opp.org.toLowerCase().trim()}`;
        if (!seenKeys.has(key) && !seenKeys.has(opp.id)) {
          seenKeys.add(key);
          seenKeys.add(opp.id);
          list.push({ ...opp, isLiveFirestore: false, fromLocationData: false });
        }
      });
    }

    return list;
  }, [firestoreOpportunities, locationData]);

  const matchesDistrict = (opp: EnrichedOpportunity, districtName: string): boolean => {
    if (!districtName || districtName === 'all' || districtName.toLowerCase() === 'all india') {
      return true;
    }
    if (
      opp.fromLocationData &&
      (!locationData?.district ||
        locationData.district.toLowerCase().trim() === districtName.toLowerCase().trim() ||
        (locationData.location || '').toLowerCase().includes(districtName.toLowerCase().trim()))
    ) {
      return true;
    }
    const dLower = districtName.toLowerCase().trim();
    const locLower = (opp.loc || '').toLowerCase();
    const orgLower = (opp.org || '').toLowerCase();
    const explicitDistrict = ((opp as any).district || '').toLowerCase();

    if (locLower.includes(dLower) || orgLower.includes(dLower) || explicitDistrict.includes(dLower)) {
      return true;
    }
    if (locLower.includes('all india') || locLower.includes('statewide') || locLower.includes('anywhere')) {
      return true;
    }
    return false;
  };

  const filtered = useMemo(() => {
    const applyTabAndSearch = (j: EnrichedOpportunity, enforceDistrict: boolean) => {
      if (j.type === 'Training') return false;
      if (activeTab === 'nearby' && (j.km || 0) > 15) return false;
      if (activeTab === 'district' && (j.km || 0) > 45) return false;
      if (activeTab === 'self' && j.type !== 'Self-employment') return false;

      if (enforceDistrict && !matchesDistrict(j, selectedDistrict)) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          j.title.toLowerCase().includes(q) ||
          j.loc.toLowerCase().includes(q) ||
          j.org.toLowerCase().includes(q) ||
          (j.eligibility && j.eligibility.toLowerCase().includes(q))
        );
      }
      return true;
    };

    const strictMatches = combinedOpportunities.filter((j) => applyTabAndSearch(j, true));
    if (strictMatches.length > 0 || searchQuery.trim()) {
      return strictMatches;
    }
    const locationDataMatches = combinedOpportunities.filter(
      (j) => j.fromLocationData && applyTabAndSearch(j, false)
    );
    if (locationDataMatches.length > 0) {
      return locationDataMatches;
    }
    return selectedDistrict === 'all'
      ? combinedOpportunities.filter((j) => applyTabAndSearch(j, false))
      : [];
  }, [combinedOpportunities, activeTab, selectedDistrict, searchQuery, locationData]);

  const handleListen = (job: Opportunity) => {
    if (speakingJobId === job.id) {
      speechService.stopSpeaking();
      setSpeakingJobId(null);
      return;
    }

    setSpeakingJobId(job.id);

    let textToSpeak = '';
    if (currentLang === 'bho') {
      textToSpeak = `काम: ${job.title}। संस्था: ${job.org}। वेतन: ${job.pay}। जगह: ${job.loc}। दूरी: ${job.km} किलोमीटर। योग्यता: ${job.eligibility}।`;
    } else if (currentLang === 'en') {
      textToSpeak = `Position: ${job.title}. Organization: ${job.org}. Estimated Pay: ${job.pay}. Location: ${job.loc}, ${job.km} kilometers away. Eligibility: ${job.eligibility}.`;
    } else {
      textToSpeak = `पद का नाम: ${job.title}। संस्थान: ${job.org}। संभावित वेतन: ${job.pay}। स्थान: ${job.loc}। दूरी: ${job.km} किलोमीटर। योग्यता: ${job.eligibility}।`;
    }

    speechService.speak(textToSpeak, currentLang, () => {
      setSpeakingJobId(null);
    });
  };

  const handleSelectDistrictChange = (dist: string) => {
    setSelectedDistrict(dist);
    setShowDistrictModal(false);
    if (onLocationChange && dist !== 'all') {
      const stateMatch = POPULAR_INDIAN_REGIONS.find((r) =>
        r.districts.some((d) => d.name.toLowerCase() === dist.toLowerCase())
      );
      const stateName = stateMatch ? stateMatch.state : 'Uttar Pradesh';
      locationIntelligenceService.setManualDistrict(dist, stateName);
      onLocationChange(`${dist}, ${stateName}`);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#DCE3EA] mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#245A91] uppercase tracking-wider mb-1.5">
            <Icon name="briefcase" size={14} />
            <span>{t('opp.badge', currentLang)}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
            {t('opp.title', currentLang)}
          </h1>
        </div>
      </div>

      {/* Location Intelligence Banner */}
      <div className="bg-white border border-[#DCE3EA] rounded-2xl p-4 sm:p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#245A91] text-white flex items-center justify-center flex-shrink-0">
              <Icon name="map" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-[#5F6B76] uppercase tracking-wider">
                  {currentLang === 'en' ? 'Selected District' : 'चयनित जिला'}
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold tabular-nums bg-[#F7F9FC] text-[#17365D] border border-[#DCE3EA]">
                  {filtered.length} अवसर उपलब्ध
                </span>
                {locationData?.isAiGenerated && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#E3F1FA] text-[#245A91] border border-[#245A91]/20">
                    Live AI
                  </span>
                )}
              </div>
              <div className="text-lg font-extrabold text-[#17365D] flex items-center gap-1.5 mt-0.5">
                <Icon name="pin" size={16} className="text-[#287D73]" />
                <span>{selectedDistrict === 'all' ? 'समस्त जिले (All India)' : (locationData?.location || selectedDistrict)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={handleAutoDetectCurrentLocation}
              disabled={isDetectingGps}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#287D73] hover:bg-[#17365D] text-white text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              <Icon name={isDetectingGps ? 'refresh' : 'pin'} size={14} className={isDetectingGps ? 'animate-spin' : ''} />
              <span>
                {isDetectingGps
                  ? 'लोकेशन खोजी जा रही है...'
                  : currentLang === 'en'
                  ? 'Sync Current GPS'
                  : 'वर्तमान लोकेशन सिंक करें'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowDistrictModal(true)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#DCE3EA] bg-[#F7F9FC] text-xs font-bold text-[#17365D] hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            >
              <Icon name="compass" size={14} className="text-[#245A91]" />
              <span>{currentLang === 'en' ? 'Change District' : 'जिला बदलें'}</span>
            </button>

            {onRefreshAi && (
              <button
                type="button"
                onClick={onRefreshAi}
                disabled={isRefreshingAi}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#DCE3EA] bg-white text-xs font-bold text-[#245A91] hover:bg-[#F7F9FC] transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                <Icon name="refresh" size={14} className={isRefreshingAi ? 'animate-spin' : ''} />
                <span>{currentLang === 'en' ? 'Refresh' : 'ताज़ा करें'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => go('dashboard')}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#DCE3EA] bg-white text-xs font-bold text-[#17365D] hover:bg-[#F7F9FC] transition-colors flex items-center gap-1.5"
            >
              <Icon name="user" size={14} />
              <span>{currentLang === 'en' ? 'Dashboard' : 'डैशबोर्ड'}</span>
            </button>
          </div>
        </div>
      </div>

      {firestoreError && (
        <div className="mb-6 p-3 rounded-xl bg-[#FFF4DB] border border-[#EBCB7A] text-xs text-[#7D4912] flex items-center gap-2">
          <Icon name="info" size={16} />
          <span>{firestoreError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto text-xs font-bold">
          {[
            { id: 'all', label: t('opp.tabAll', currentLang) },
            { id: 'nearby', label: t('opp.tabNearby', currentLang) },
            { id: 'district', label: t('opp.tabDistrict', currentLang) },
            { id: 'self', label: t('opp.tabSelf', currentLang) },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#17365D] text-white'
                  : 'bg-white text-[#5F6B76] border border-[#DCE3EA] hover:border-[#245A91]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('opp.searchPlaceholder', currentLang)}
            className="w-full min-h-[42px] px-3.5 py-2 text-xs rounded-xl border border-[#DCE3EA] bg-white focus:outline-none focus:border-[#245A91] pr-8"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {isLoadingFirestore && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {[1, 2].map((n) => (
            <div key={n} className="bg-white border border-[#DCE3EA] rounded-2xl p-6 flex items-center gap-3 text-xs text-[#5F6B76]">
              <span className="w-4 h-4 border-2 border-[#245A91] border-t-transparent rounded-full animate-spin" />
              <span>अवसर लोड हो रहे हैं...</span>
            </div>
          ))}
        </div>
      )}

      {/* Opportunity Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map((job) => {
          const isSaved = Boolean(shortlist[job.id]);
          const isAudioPlaying = speakingJobId === job.id;

          return (
            <div
              key={job.id}
              className="bg-white border border-[#DCE3EA] rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-[#245A91] transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-[#17365D]/10 text-[#17365D]">
                      <Icon name="briefcase" size={12} />
                      <span>{job.type}</span>
                    </span>

                    {job.isLiveFirestore && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#E3F1FA] text-[#245A91] border border-[#245A91]/20">
                        <span>नवीनतम अवसर</span>
                      </span>
                    )}

                    {job.verified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Icon name="check" size={12} />
                        <span>सत्यापित</span>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleListen(job)}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-colors ${
                      isAudioPlaying
                        ? 'bg-[#D9822B] text-white'
                        : 'bg-[#F7F9FC] text-[#17365D] hover:bg-[#EBF3FA] border border-[#DCE3EA]'
                    }`}
                    title="बोलकर सुनें"
                    aria-label="Listen details"
                  >
                    <Icon name={isAudioPlaying ? 'volumeX' : 'volume2'} size={14} />
                    <span>{isAudioPlaying ? 'रोकें' : 'सुनें'}</span>
                  </button>
                </div>

                <div>
                  <div className="text-xs font-bold text-[#287D73] mb-1 flex items-center gap-1.5 flex-wrap tabular-nums">
                    <Icon name="pin" size={13} />
                    <span>{job.loc}</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#287D73]/10 text-[#287D73] text-[11px] font-extrabold">
                      {typeof job.km === 'number' && job.km > 0 ? job.km : 4} km दूर
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#17365D] leading-snug">
                    {job.title}
                  </h3>
                  <div className="text-xs font-bold text-[#5F6B76] mt-0.5">
                    {job.org}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] flex items-center justify-between text-xs gap-2">
                  <span className="text-[#5F6B76] font-semibold">
                    {currentLang === 'bho' ? 'वेतन / कमाई' : currentLang === 'en' ? 'Estimated Pay' : 'संभावित वेतन / आय'}
                  </span>
                  <span className="font-extrabold text-[#17365D] tabular-nums">{job.pay}</span>
                </div>

                <p className="text-xs text-[#5F6B76] leading-relaxed line-clamp-2">
                  <strong className="text-[#17365D]">
                    {currentLang === 'bho' ? 'पात्रता:' : currentLang === 'en' ? 'Eligibility:' : 'योग्यता:'}
                  </strong>{' '}
                  {job.eligibility}
                </p>
              </div>

              <div className="pt-3 border-t border-[#DCE3EA] flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => onSelectDetail(job)}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#245A91] text-white hover:bg-[#17365D] text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Icon name="pin" size={13} />
                  <span>
                    {currentLang === 'bho'
                      ? 'मैप व आवेदन देखीं'
                      : currentLang === 'en'
                      ? 'View Map & Apply'
                      : 'मैप, रास्ता व आवेदन देखें'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onShortlistToggle(job.id, job)}
                  className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1 ${
                    isSaved
                      ? 'bg-[#FFF4DB] text-[#B8691A] border-[#EBCB7A]'
                      : 'bg-white text-[#5F6B76] border-[#DCE3EA] hover:border-[#245A91]'
                  }`}
                >
                  <Icon name="star" size={13} className={isSaved ? 'fill-[#D9822B]' : ''} />
                  <span>
                    {isSaved
                      ? currentLang === 'bho' ? 'सुरक्षित' : currentLang === 'en' ? 'Saved' : 'सहेजा गया'
                      : currentLang === 'bho' ? 'सहेजीं' : currentLang === 'en' ? 'Shortlist' : 'सहेजें'}
                  </span>
                </button>
              </div>
            </div>
          );
        })}

        {!isLoadingFirestore && filtered.length === 0 && (
          <div className="col-span-full py-14 text-center bg-white rounded-2xl border border-[#DCE3EA] p-6 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] text-[#5F6B76] mx-auto flex items-center justify-center">
              <Icon name="briefcase" size={24} />
            </div>
            <h3 className="text-base font-bold text-[#17365D]">
              {selectedDistrict === 'all'
                ? 'कोई अवसर नहीं मिला'
                : `${selectedDistrict} जिले में अभी कोई नया अवसर नहीं है`}
            </h3>
            <p className="text-xs text-[#5F6B76] max-w-md mx-auto">
              {currentLang === 'bho'
                ? 'फ़िल्टर बदल के देखीं या नज़दीकी ज़िला के अवसर देखीं।'
                : 'फ़िल्टर बदलकर देखें या "समस्त जिले" का चयन करें ताकि आसपास के अवसर दिख सकें।'}
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectDistrictChange('all')}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#245A91] text-white text-xs font-bold hover:bg-[#17365D]"
              >
                समस्त जिले के अवसर देखें
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('all');
                  setSearchQuery('');
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-white border border-[#DCE3EA] text-xs font-bold text-[#17365D]"
              >
                फ़िल्टर रीसेट करें
              </button>
            </div>
          </div>
        )}
      </div>

      {locationData?.schemes && locationData.schemes.length > 0 && (
        <section className="mt-12 pt-8 border-t border-[#DCE3EA] space-y-4">
          <div>
            <div className="text-xs font-bold text-[#245A91] mb-1">
              सरकारी योजनाएं व अनुदान · Government Support
            </div>
            <h2 className="text-2xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
              {selectedDistrict !== 'all' ? selectedDistrict : 'जिले'} के लिए सक्रिय सरकारी योजनाएं
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {applyAdminSchemeImages(locationData.schemes, mediaAssets).map((scheme) => (
              <SchemeCard key={scheme.id} scheme={scheme} lang={currentLang} onNavigate={go} />
            ))}
          </div>
        </section>
      )}

      {showDistrictModal && (
        <div className="fixed inset-0 z-50 bg-[#0B1B30]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#DCE3EA] space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#DCE3EA] pb-3">
              <div className="flex items-center gap-2">
                <Icon name="pin" size={20} className="text-[#245A91]" />
                <h3 className="text-lg font-bold text-[#17365D]">
                  {currentLang === 'bho' ? 'जिला के चयन करीं' : 'जिला का चयन करें'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDistrictModal(false)}
                className="w-8 h-8 rounded-lg bg-[#F7F9FC] text-slate-500 hover:text-[#17365D] flex items-center justify-center"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            <p className="text-xs text-[#5F6B76]">
              {currentLang === 'bho'
                ? 'चयनित जिला के अनुसार सभी उपलब्ध अवसर देखावल जाई।'
                : 'चयनित जिले के अनुसार सभी उपलब्ध अवसर दिखाए जाएंगे।'}
            </p>

            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              <button
                type="button"
                onClick={() => handleSelectDistrictChange('all')}
                className={`w-full min-h-[44px] p-3 rounded-xl border text-left text-xs font-bold transition-colors flex items-center justify-between ${
                  selectedDistrict === 'all'
                    ? 'bg-[#17365D] text-white border-[#17365D]'
                    : 'bg-[#F7F9FC] text-[#17365D] border-[#DCE3EA] hover:border-[#245A91]'
                }`}
              >
                <span>समस्त जिले (All India Opportunities)</span>
                {selectedDistrict === 'all' && <Icon name="check" size={14} />}
              </button>

              {POPULAR_INDIAN_REGIONS.map((stateGroup) => (
                <div key={stateGroup.state} className="space-y-1.5">
                  <div className="text-[11px] font-extrabold text-[#245A91] uppercase tracking-wider">
                    {stateGroup.state} ({stateGroup.stateHi})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {stateGroup.districts.map((d) => {
                      const isSelected = selectedDistrict.toLowerCase() === d.name.toLowerCase();
                      return (
                        <button
                          key={d.name}
                          type="button"
                          onClick={() => handleSelectDistrictChange(d.name)}
                          className={`p-2 rounded-xl border text-xs text-left transition-colors ${
                            isSelected
                              ? 'bg-[#245A91] text-white font-bold border-[#245A91]'
                              : 'bg-white text-[#202B36] border-[#DCE3EA] hover:border-[#245A91]'
                          }`}
                        >
                          <div className="font-bold leading-tight">{d.name}</div>
                          <div className="text-[10px] opacity-80">{d.hi}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[#DCE3EA] flex justify-end">
              <button
                type="button"
                onClick={() => setShowDistrictModal(false)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] text-[#17365D] text-xs font-bold hover:bg-slate-100"
              >
                बंद करें
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
