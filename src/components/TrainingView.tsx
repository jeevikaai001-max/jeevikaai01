import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from './Icons';
import { Opportunity, SupportedLanguage, LocationLivelihoodData, BeneficiaryProfile } from '../types';
import { JOBS } from '../data/mockData';
import { t } from '../services/translationService';
import { contentService, OperationType, handleFirestoreError } from '../services/firebase';
import { speechService } from '../services/speechService';
import { POPULAR_INDIAN_REGIONS, locationIntelligenceService } from '../services/locationIntelligenceService';

interface TrainingViewProps {
  onShortlistToggle: (id: string) => void;
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

interface EnrichedTrainingItem extends Opportunity {
  isLiveFirestore?: boolean;
  fromLocationData?: boolean;
}

export const TrainingView: React.FC<TrainingViewProps> = ({
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
  const [filterPathway, setFilterPathway] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Real-time Firestore state
  const [firestoreTrainingCenters, setFirestoreTrainingCenters] = useState<Opportunity[]>([]);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState<boolean>(true);
  const [isLiveSyncing, setIsLiveSyncing] = useState<boolean>(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Audio narration state for low-literacy beneficiaries
  const [speakingItemId, setSpeakingItemId] = useState<string | null>(null);
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);

  // District state (handles "Locality, District, State" or "District, State")
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
      // Ignore if permission denied
    } finally {
      setIsDetectingGps(false);
    }
  };

  // Real-time subscription to 'training_centers' & 'opportunities' collections in Firestore
  useEffect(() => {
    let isSubscribed = true;
    setIsLoadingFirestore(true);

    let oppTraining: Opportunity[] = [];
    const unsubOpp = contentService.subscribe<Opportunity>(
      'opportunities',
      (items) => {
        if (!isSubscribed) return;
        oppTraining = (items || []).filter((item) => item.type === 'Training');
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'opportunities');
      }
    );

    const unsubCenters = contentService.subscribe<Opportunity>(
      'training_centers',
      (items) => {
        if (!isSubscribed) return;
        const combined = [...(items || []), ...oppTraining];
        const uniqueMap = new Map<string, Opportunity>();
        combined.forEach((c) => uniqueMap.set(c.id, c));
        setFirestoreTrainingCenters(Array.from(uniqueMap.values()));
        setIsLiveSyncing(true);
        setIsLoadingFirestore(false);
        setFirestoreError(null);
      },
      (err) => {
        if (!isSubscribed) return;
        setIsLoadingFirestore(false);
        setIsLiveSyncing(false);
        handleFirestoreError(err, OperationType.LIST, 'training_centers');
        setFirestoreError(
          currentLang === 'bho'
            ? 'प्रशिक्षण केंद्र के लाइव डेटा सिंक धीमा बा, स्थानीय केंद्र देखावल जात बा।'
            : currentLang === 'en'
            ? 'Live Firestore training centers slow or offline; showing verified catalog.'
            : 'प्रशिक्षण केंद्रों का लाइव डेटा सिंक धीमा है, स्थानीय प्रमाणित केंद्र दिखाए जा रहे हैं।'
        );
      }
    );

    return () => {
      isSubscribed = false;
      unsubOpp();
      unsubCenters();
    };
  }, [currentLang]);

  // Merge Firestore training items with locationData / mock fallback
  const combinedTrainingItems = useMemo<EnrichedTrainingItem[]>(() => {
    const list: EnrichedTrainingItem[] = [];
    const seenKeys = new Set<string>();

    if (locationData?.trainingCenters && locationData.trainingCenters.length > 0) {
      locationData.trainingCenters.forEach((item) => {
        const key = `${item.title.toLowerCase().trim()}|${item.org.toLowerCase().trim()}`;
        if (!seenKeys.has(key) && !seenKeys.has(item.id)) {
          seenKeys.add(key);
          seenKeys.add(item.id);
          list.push({
            ...item,
            km: typeof item.km === 'number' ? item.km : 6,
            isLiveFirestore: false,
            fromLocationData: true,
          });
        }
      });
    }

    firestoreTrainingCenters.forEach((item) => {
      const key = `${item.title.toLowerCase().trim()}|${item.org.toLowerCase().trim()}`;
      if (!seenKeys.has(key) && !seenKeys.has(item.id)) {
        seenKeys.add(key);
        seenKeys.add(item.id);
        list.push({ ...item, isLiveFirestore: true, fromLocationData: false });
      }
    });

    JOBS.filter((j) => j.type === 'Training').forEach((item) => {
      const key = `${item.title.toLowerCase().trim()}|${item.org.toLowerCase().trim()}`;
      if (!seenKeys.has(key) && !seenKeys.has(item.id)) {
        seenKeys.add(key);
        seenKeys.add(item.id);
        list.push({ ...item, isLiveFirestore: false, fromLocationData: false });
      }
    });

    return list;
  }, [firestoreTrainingCenters, locationData]);

  const matchesDistrict = (item: EnrichedTrainingItem, districtName: string): boolean => {
    if (!districtName || districtName === 'all' || districtName.toLowerCase() === 'all india') {
      return true;
    }
    if (
      item.fromLocationData &&
      (!locationData?.district ||
        locationData.district.toLowerCase().trim() === districtName.toLowerCase().trim() ||
        (locationData.location || '').toLowerCase().includes(districtName.toLowerCase().trim()))
    ) {
      return true;
    }
    const dLower = districtName.toLowerCase().trim();
    const locLower = (item.loc || '').toLowerCase();
    const titleLower = (item.title || '').toLowerCase();
    const orgLower = (item.org || '').toLowerCase();
    const explicitDistrict = ((item as any).district || '').toLowerCase();

    if (
      locLower.includes(dLower) ||
      titleLower.includes(dLower) ||
      orgLower.includes(dLower) ||
      explicitDistrict.includes(dLower)
    ) {
      return true;
    }
    if (locLower.includes('all india') || locLower.includes('statewide') || locLower.includes('anywhere')) {
      return true;
    }
    return false;
  };

  const filtered = useMemo(() => {
    const applyPathwayAndSearch = (item: EnrichedTrainingItem, enforceDistrict: boolean) => {
      if (filterPathway !== 'all' && item.path !== filterPathway) {
        return false;
      }
      if (enforceDistrict && !matchesDistrict(item, selectedDistrict)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.org.toLowerCase().includes(q) ||
          item.loc.toLowerCase().includes(q) ||
          (item.eligibility && item.eligibility.toLowerCase().includes(q))
        );
      }
      return true;
    };

    const strictMatches = combinedTrainingItems.filter((item) => applyPathwayAndSearch(item, true));
    if (strictMatches.length > 0 || searchQuery.trim()) {
      return strictMatches;
    }
    const locationDataMatches = combinedTrainingItems.filter(
      (item) => item.fromLocationData && applyPathwayAndSearch(item, false)
    );
    if (locationDataMatches.length > 0) {
      return locationDataMatches;
    }
    return combinedTrainingItems.filter((item) => applyPathwayAndSearch(item, false));
  }, [combinedTrainingItems, filterPathway, selectedDistrict, searchQuery, locationData]);

  const handleListen = (item: Opportunity) => {
    if (speakingItemId === item.id) {
      speechService.stopSpeaking();
      setSpeakingItemId(null);
      return;
    }

    setSpeakingItemId(item.id);
    let textToSpeak = '';
    if (currentLang === 'bho') {
      textToSpeak = `प्रशिक्षण केंद्र: ${item.title}। संस्था: ${item.org}। कोर्स व सहायता: ${item.pay}। जगह: ${item.loc}। दूरी: ${item.km} किलोमीटर। पात्रता: ${item.eligibility}।`;
    } else if (currentLang === 'en') {
      textToSpeak = `Training Center: ${item.title}. Institute: ${item.org}. Program Support: ${item.pay}. Location: ${item.loc}, ${item.km} km away. Eligibility: ${item.eligibility}.`;
    } else {
      textToSpeak = `प्रशिक्षण केंद्र: ${item.title}। संस्थान: ${item.org}। कोर्स व भत्ता: ${item.pay}। स्थान: ${item.loc}। दूरी: ${item.km} किलोमीटर। पात्रता: ${item.eligibility}।`;
    }

    speechService.speak(textToSpeak, currentLang, () => {
      setSpeakingItemId(null);
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
      onLocationChange(`${dist}, ${stateName}`);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#DCE3EA] mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#287D73]/12 text-[#287D73] border border-[#287D73]/25 mb-2">
            <Icon name="cap" size={14} />
            <span>{t('train.badge', currentLang)}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
            {t('train.title', currentLang)}
          </h1>
        </div>
      </div>

      {/* Location Synced Civic Banner */}
      <div className="bg-[#F7F9FC] border border-[#DCE3EA] rounded-2xl p-4 sm:p-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#287D73] text-white flex items-center justify-center flex-shrink-0">
              <Icon name="cap" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-[#5F6B76] uppercase tracking-wider">
                  {currentLang === 'en' ? 'Certified District Centers' : 'जिला अनुसार मान्यता प्राप्त केंद्र'}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#287D73]/12 text-[#287D73] border border-[#287D73]/25 tabular-nums">
                  {filtered.length} {currentLang === 'en' ? 'centers active' : 'केंद्र सक्रिय'}
                </span>
                {isLiveSyncing && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-[#245A91] border border-[#DCE3EA]">
                    {currentLang === 'en' ? 'Catalog Synced' : 'डेटा सिंक'}
                  </span>
                )}
              </div>
              <div className="text-lg font-extrabold text-[#17365D] flex items-center gap-2 mt-0.5">
                <Icon name="pin" size={18} className="text-[#287D73]" />
                <span>{selectedDistrict === 'all' ? 'समस्त जिले (All India)' : selectedDistrict}</span>
                {locationData?.state && selectedDistrict !== 'all' && (
                  <span className="text-xs text-[#5F6B76] font-normal">({locationData.state})</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowDistrictModal(true)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DCE3EA] bg-white text-xs font-bold text-[#17365D] hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            >
              <Icon name="mapPin" size={14} className="text-[#245A91]" />
              <span>{currentLang === 'en' ? 'Change District' : 'जिला चुनें'}</span>
            </button>

            <button
              type="button"
              onClick={handleAutoDetectCurrentLocation}
              disabled={isDetectingGps}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#287D73] hover:bg-[#17365D] text-white text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-60"
              title="अपनी वर्तमान जीपीएस लोकेशन से प्रशिक्षण केंद्र सिंक करें"
            >
              <Icon name={isDetectingGps ? 'refresh' : 'crosshair'} size={14} className={isDetectingGps ? 'animate-spin' : ''} />
              <span>
                {isDetectingGps
                  ? currentLang === 'en'
                    ? 'Detecting GPS...'
                    : 'लोकेशन खोजी जा रही है...'
                  : currentLang === 'en'
                  ? 'Sync Current GPS'
                  : 'वर्तमान लोकेशन सिंक करें'}
              </span>
            </button>

            {onRefreshAi && (
              <button
                type="button"
                onClick={onRefreshAi}
                disabled={isRefreshingAi}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                <Icon name="refresh" size={14} className={isRefreshingAi ? 'animate-spin' : ''} />
                <span>{isRefreshingAi ? 'AI अपडेट...' : currentLang === 'en' ? 'AI Refresh' : 'AI ताज़ा करें'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => go('dashboard')}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DCE3EA] bg-white text-xs font-bold text-[#17365D] hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            >
              <Icon name="user" size={14} />
              <span>{currentLang === 'en' ? 'Dashboard' : 'डैशबोर्ड'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fallback notification banner if Firestore is offline */}
      {firestoreError && (
        <div className="mb-6 p-3 rounded-xl bg-[#FFF8EE] border border-[#D9822B]/30 text-xs text-[#8F5517] flex items-center gap-2 font-semibold">
          <Icon name="info" size={16} />
          <span>{firestoreError}</span>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6">
        <div className="flex items-center gap-2 pb-1 overflow-x-auto text-xs font-bold w-full sm:w-auto">
          {[
            { id: 'all', label: t('train.tabAll', currentLang) },
            { id: 'digital', label: t('train.tabDigital', currentLang) },
            { id: 'tailoring', label: t('train.tabTailoring', currentLang) },
            { id: 'solar', label: t('train.tabSolar', currentLang) },
            { id: 'retail', label: t('train.tabRetail', currentLang) },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterPathway(f.id)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
                filterPathway === f.id
                  ? 'bg-[#17365D] text-white'
                  : 'bg-[#F7F9FC] text-[#5F6B76] border border-[#DCE3EA] hover:border-[#245A91] hover:text-[#17365D]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={currentLang === 'en' ? 'Search center or course...' : 'केंद्र या कोर्स खोजें (Search)...'}
            className="w-full min-h-[42px] px-3.5 py-2 text-xs rounded-xl border border-[#DCE3EA] bg-white focus:outline-none focus:border-[#287D73] pr-8 text-[#17365D]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Loading State (Crisp spinner card — no pulsing gray blocks) */}
      {isLoadingFirestore && (
        <div className="bg-[#F7F9FC] border border-[#DCE3EA] rounded-2xl p-8 mb-8 flex items-center justify-center gap-3 text-sm font-bold text-[#17365D]">
          <Icon name="refresh" size={18} className="animate-spin text-[#287D73]" />
          <span>{currentLang === 'en' ? 'Loading certified training centers...' : 'मान्यता प्राप्त प्रशिक्षण केंद्र लोड हो रहे हैं...'}</span>
        </div>
      )}

      {/* Training Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((item) => {
          const isBookmarked = Boolean(shortlist[item.id]);
          const isAudioPlaying = speakingItemId === item.id;

          return (
            <article
              key={item.id}
              className="bg-white border border-[#DCE3EA] rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-[#287D73] transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#287D73]/12 text-[#287D73] border border-[#287D73]/20 flex items-center gap-1">
                      <Icon name="check" size={12} />
                      प्रमाणित केंद्र
                    </span>

                    {item.isLiveFirestore && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E3F1FA] text-[#245A91] border border-[#245A91]/20">
                        <span>नवीनतम केंद्र</span>
                      </span>
                    )}

                    {item.lastVerifiedDate && (
                      <span className="text-[11px] text-[#5F6B76] font-medium hidden sm:inline tabular-nums">
                        Verified: {item.lastVerifiedDate}
                      </span>
                    )}
                  </div>

                  {/* Audio Listen Button for Low-Literacy Beneficiaries */}
                  <button
                    onClick={() => handleListen(item)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors min-h-[36px] ${
                      isAudioPlaying
                        ? 'bg-[#D9822B] text-white'
                        : 'bg-[#F7F9FC] text-[#17365D] hover:bg-[#EBF3FA] border border-[#DCE3EA]'
                    }`}
                    title="बोलकर सुनें (Listen to training center details in audio)"
                    aria-label="Listen center details"
                  >
                    <Icon name={isAudioPlaying ? 'volumeX' : 'volume2'} size={14} />
                    <span>{isAudioPlaying ? 'बोल रहा है...' : 'सुनें'}</span>
                  </button>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-[#17365D] leading-snug font-['Bricolage_Grotesque']">
                    {item.title}
                  </h3>
                  <div className="text-xs text-[#5F6B76] font-semibold mt-0.5">
                    {item.org}
                  </div>
                </div>

                <div className="text-xs font-bold text-[#287D73] flex items-center gap-1.5 flex-wrap">
                  <Icon name="mapPin" size={14} className="text-[#245A91]" />
                  <span>{item.loc}</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#287D73]/10 text-[#287D73] text-[11px] font-extrabold tabular-nums">
                    आपके स्थान से {typeof item.km === 'number' && item.km > 0 ? item.km : 6} km दूर
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] text-xs font-bold text-[#17365D] flex items-center justify-between gap-2">
                  <span>{currentLang === 'bho' ? 'सुविधा / छात्रवृत्ति' : 'कोर्स शुल्क व सुविधा'}</span>
                  <span className="text-[#287D73] font-extrabold text-right tabular-nums">{item.pay}</span>
                </div>

                <p className="text-xs text-[#5F6B76] leading-relaxed">
                  <strong className="text-[#17365D]">
                    {currentLang === 'bho' ? 'पात्रता:' : 'योग्यता / पात्रता:'}
                  </strong>{' '}
                  {item.eligibility}
                </p>
              </div>

              <div className="pt-3 border-t border-[#DCE3EA] flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={() => onSelectDetail(item)}
                  className="px-3.5 py-2 rounded-xl bg-[#287D73] text-white hover:bg-[#17365D] text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[44px] transition-colors"
                >
                  <Icon name="mapPin" size={13} />
                  <span>
                    {currentLang === 'bho'
                      ? 'मैप व नामांकन देखीं'
                      : currentLang === 'en'
                      ? 'View Map & Apply'
                      : 'मैप, रास्ता व नामांकन देखें'}
                  </span>
                </button>

                <button
                  onClick={() => onShortlistToggle(item.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 min-h-[44px] ${
                    isBookmarked
                      ? 'bg-[#17365D] text-white border-[#17365D]'
                      : 'bg-white text-[#5F6B76] border-[#DCE3EA] hover:border-[#245A91] hover:text-[#17365D]'
                  }`}
                >
                  <Icon name="bookmark" size={13} />
                  <span>
                    {isBookmarked
                      ? currentLang === 'bho'
                        ? 'सुरक्षित'
                        : currentLang === 'en'
                        ? 'Saved'
                        : 'सहेजा गया'
                      : currentLang === 'bho'
                      ? 'सहेजीं'
                      : currentLang === 'en'
                      ? 'Shortlist'
                      : 'सहेजें'}
                  </span>
                </button>
              </div>
            </article>
          );
        })}

        {!isLoadingFirestore && filtered.length === 0 && (
          <div className="col-span-full py-16 text-center bg-[#F7F9FC] rounded-2xl border border-[#DCE3EA] p-6 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-[#DCE3EA] text-[#5F6B76] mx-auto flex items-center justify-center">
              <Icon name="cap" size={24} />
            </div>
            <h3 className="text-base font-bold text-[#17365D]">
              {selectedDistrict === 'all'
                ? 'कोई प्रशिक्षण केंद्र नहीं मिला'
                : `${selectedDistrict} जिले में इस श्रेणी का कोई केंद्र नहीं मिला`}
            </h3>
            <p className="text-xs text-[#5F6B76] max-w-md mx-auto">
              {currentLang === 'bho'
                ? 'फ़िल्टर बदल के देखीं या नज़दीकी ज़िला के केंद्र देखीं।'
                : 'फ़िल्टर बदलकर देखें या "समस्त जिले" का चयन करें ताकि आसपास के सरकारी प्रशिक्षण केंद्र दिख सकें।'}
            </p>
            <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => handleSelectDistrictChange('all')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#287D73] text-white text-xs font-bold hover:bg-[#17365D]"
              >
                समस्त जिले के केंद्र देखें
              </button>
              <button
                onClick={() => {
                  setFilterPathway('all');
                  setSearchQuery('');
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-[#DCE3EA] text-xs font-bold text-[#17365D]"
              >
                फ़िल्टर रीसेट करें
              </button>
            </div>
          </div>
        )}
      </div>

      {/* District Selection Modal */}
      {showDistrictModal && (
        <div className="fixed inset-0 z-50 bg-[#17365D]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#DCE3EA] space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#DCE3EA] pb-3">
              <div className="flex items-center gap-2">
                <Icon name="mapPin" size={20} className="text-[#287D73]" />
                <h3 className="text-lg font-bold text-[#17365D] font-['Bricolage_Grotesque']">
                  {currentLang === 'bho' ? 'प्रशिक्षण केंद्र खातिर जिला चुनीं' : 'प्रशिक्षण केंद्र हेतु जिला चुनें'}
                </h3>
              </div>
              <button
                onClick={() => setShowDistrictModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#5F6B76]">
              {currentLang === 'bho'
                ? 'चयनित जिला के अनुसार सभी मान्यता प्राप्त केंद्र देखावल जाई।'
                : 'चयनित जिले के अनुसार सभी मान्यता प्राप्त केंद्र दिखाए जाएंगे।'}
            </p>

            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              <button
                onClick={() => handleSelectDistrictChange('all')}
                className={`w-full p-3 rounded-xl border text-left text-xs font-bold transition-colors flex items-center justify-between ${
                  selectedDistrict === 'all'
                    ? 'bg-[#17365D] text-white border-[#17365D]'
                    : 'bg-[#F7F9FC] text-[#17365D] border-[#DCE3EA] hover:border-[#287D73]'
                }`}
              >
                <span>🌍 समस्त जिले (All India Training Centers)</span>
                {selectedDistrict === 'all' && <span>✓</span>}
              </button>

              {POPULAR_INDIAN_REGIONS.map((stateGroup) => (
                <div key={stateGroup.state} className="space-y-1.5">
                  <div className="text-[11px] font-extrabold text-[#287D73] uppercase tracking-wider">
                    {stateGroup.state} ({stateGroup.stateHi})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {stateGroup.districts.map((d) => {
                      const isSelected = selectedDistrict.toLowerCase() === d.name.toLowerCase();
                      return (
                        <button
                          key={d.name}
                          onClick={() => handleSelectDistrictChange(d.name)}
                          className={`p-2.5 rounded-xl border text-xs text-left transition-colors ${
                            isSelected
                              ? 'bg-[#287D73] text-white font-bold border-[#287D73]'
                              : 'bg-white text-[#202B36] border-[#DCE3EA] hover:border-[#287D73]'
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
