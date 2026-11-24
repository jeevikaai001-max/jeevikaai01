import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from './Icons';
import { SchemeCard } from './SchemeCard';
import { DistrictMiniMap } from './DistrictMiniMap';
import {
  BeneficiaryProfile,
  SupportedLanguage,
  Opportunity,
  AppView,
  SummaryModalData,
  LocationLivelihoodData,
  MediaAssetRecord,
} from '../types';
import { AppUser } from '../services/firebase';
import { rankPaths, rankJobs, buildSummary, slug } from '../services/recommendationEngine';
import { EDU, WORK, MOB } from '../data/mockData';
import { speechService } from '../services/speechService';
import { storageService } from '../services/storageService';
import { locationIntelligenceService, POPULAR_INDIAN_REGIONS, parseLocationParts } from '../services/locationIntelligenceService';
import {
  mediaStorageService,
  applyAdminSchemeImages,
} from '../services/cloudinaryService';
import {
  dt,
  optionLabel,
  pathwayName,
  pathwayRole,
  stageText,
  STAGE_TITLES_L10N,
  localizeDuration,
  fitText,
  factorLabel,
  factorNote,
  opportunityTypeLabel,
  distanceLabel,
  FALLBACK_SCHEMES,
  isEnglishLike,
} from '../services/dashboardLocale';

interface DashboardProps {
  profile: BeneficiaryProfile;
  hasAssessment: boolean;
  currentLang: SupportedLanguage;
  go: (view: AppView, sectionId?: string) => void;
  onNotify: (msg: string) => void;
  onOpenSummary: (summaryData: SummaryModalData) => void;
  onSelectDetail: (opp: Opportunity) => void;
  onUpdateProfile?: (updated: BeneficiaryProfile) => void;
  onLocationChange?: (newLoc: string) => void;
  locationData?: LocationLivelihoodData | null;
  onRefreshLocationAi?: () => void;
  isRefreshingLocationData?: boolean;
  shortlist?: Record<string, boolean>;
  onShortlistToggle?: (id: string, item?: Opportunity) => void;
  currentUser?: AppUser | null;
  onOpenAccount?: (mode: 'create' | 'login') => void;
}

const Ring: React.FC<{ value: number; size?: number; label: string }> = ({ value, size = 64, label }) => {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`${label}: ${value}/100`} className="flex-none">
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5" className="stroke-[#DCE3EA]" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value / 100)}
        transform="rotate(-90 32 32)"
        className="stroke-[#287D73]"
      />
      <text x="32" y="38" textAnchor="middle" fontSize="16" fontWeight="800" className="fill-[#17365D] tabular-nums">
        {value}
      </text>
    </svg>
  );
};

const SectionHead: React.FC<{ tag?: string; title: string; right?: React.ReactNode; icon?: string }> = ({ tag, title, right, icon }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
    <div className="flex items-start gap-3 min-w-0">
      {icon && (
        <span className="mt-0.5 w-10 h-10 rounded-xl bg-[#17365D] text-white flex items-center justify-center flex-none">
          <Icon name={icon} size={20} />
        </span>
      )}
      <div className="min-w-0">
        {tag && <div className="text-[11px] uppercase font-extrabold tracking-widest text-[#245A91]">{tag}</div>}
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#17365D] leading-tight font-['Bricolage_Grotesque']">{title}</h2>
      </div>
    </div>
    {right}
  </div>
);

const Panel: React.FC<{ id?: string; children: React.ReactNode; className?: string }> = ({ id, children, className = '' }) => (
  <section id={id} className={`bg-white border border-[#DCE3EA] rounded-2xl p-4 sm:p-6 scroll-mt-28 ${className}`}>
    {children}
  </section>
);

export const Dashboard: React.FC<DashboardProps> = ({
  profile,
  hasAssessment,
  currentLang,
  go,
  onNotify,
  onOpenSummary,
  onSelectDetail,
  onUpdateProfile,
  onLocationChange,
  locationData,
  onRefreshLocationAi,
  isRefreshingLocationData = false,
  shortlist: shortlistProp,
  onShortlistToggle,
  currentUser,
  onOpenAccount,
}) => {
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
  const L = currentLang;
  const rankedPaths = useMemo(() => rankPaths(profile), [profile]);
  const topPaths = rankedPaths.slice(0, 3);
  const jobs = useMemo(
    () => rankJobs(profile, rankedPaths, locationData?.opportunities),
    [profile, rankedPaths, locationData?.opportunities]
  );

  const [expandedWhy, setExpandedWhy] = useState<Record<string, boolean>>({});
  const [selectedPathId, setSelectedPathId] = useState<string>(topPaths[0]?.id || rankedPaths[0]?.id);
  const [doneStages, setDoneStages] = useState<Record<string, boolean>>(() => storageService.loadProgress());
  const [jobFilter, setJobFilter] = useState<'All' | 'Job' | 'Self-employment'>('All');
  const [localShortlist, setLocalShortlist] = useState<Record<string, boolean>>(() => storageService.loadShortlist());
  const shortlist = shortlistProp ?? localShortlist;
  const [isReadingRoadmap, setIsReadingRoadmap] = useState(false);
  const [readingJobId, setReadingJobId] = useState<string | null>(null);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [celebratedStageKey, setCelebratedStageKey] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [customAreaInput, setCustomAreaInput] = useState('');

  const displayName = profile.name && profile.name.trim() ? profile.name.trim() : dt('beneficiary', L);
  const displayInitial = displayName.charAt(0).toUpperCase();
  const locationLabel = locationData?.location || profile.location || locationData?.district || '';
  const parsedLoc = parseLocationParts(locationLabel);
  const districtShort = (locationData?.district || parsedLoc.district || '').trim();

  const currentAccuracy = useMemo(() => {
    if (locationData?.accuracyLevel && locationData?.confidenceScore) {
      return {
        level: locationData.accuracyLevel,
        confidenceScore: locationData.confidenceScore,
        accuracyMeters: locationData.accuracyMeters,
        locality: parsedLoc.locality || locationIntelligenceService.getLocationAccuracy().locality,
      };
    }
    if (profile.locationAccuracy && profile.locationConfidence) {
      return {
        level: profile.locationAccuracy,
        confidenceScore: profile.locationConfidence,
        accuracyMeters: profile.locationAccuracyMeters,
        locality: parsedLoc.locality || undefined,
      };
    }
    const a = locationIntelligenceService.getLocationAccuracy();
    return { level: a.level, confidenceScore: a.confidenceScore, accuracyMeters: a.accuracyMeters, locality: a.locality };
  }, [profile.locationAccuracy, profile.locationConfidence, profile.locationAccuracyMeters, locationData, parsedLoc.locality]);

  const handleDetectLocation = async () => {
    if (isDetectingLocation) return;
    setIsDetectingLocation(true);
    onNotify(dt('detecting', L));
    try {
      const res = await locationIntelligenceService.detectGpsLocation();
      if (res && res.location) {
        if (onLocationChange) {
          onLocationChange(res.location);
        } else {
          onUpdateProfile?.({
            ...profile,
            location: res.location,
            locationAccuracy: res.accuracyLevel,
            locationConfidence: res.confidenceScore,
            locationAccuracyMeters: res.accuracyMeters,
          });
        }
        onNotify(`📍 ${res.location} (${res.confidenceScore}%)`);
      }
    } catch (err: any) {
      const isDenied = err?.code === 1 || err?.message?.toLowerCase?.().includes('denied');
      onNotify(
        isDenied
          ? L === 'en' || L === 'hin'
            ? 'Location permission was denied.'
            : 'स्थान की अनुमति नहीं मिली।'
          : L === 'en' || L === 'hin'
          ? 'Could not detect your location.'
          : 'स्थान का पता नहीं चल सका।'
      );
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleSelectManualDistrict = (districtName: string, stateName: string) => {
    locationIntelligenceService.setManualDistrict(districtName, stateName);
    const newLoc = `${districtName}, ${stateName}`;
    setShowDistrictModal(false);
    if (onLocationChange) {
      onLocationChange(newLoc);
    } else {
      onUpdateProfile?.({
        ...profile,
        location: newLoc,
        locationAccuracy: 'District-level',
        locationConfidence: 88,
      });
    }
  };

  const handleCustomAreaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = customAreaInput.trim();
    if (!val) return;
    const parts = parseLocationParts(val);
    const formatted = parts.locality
      ? `${parts.locality}, ${parts.district}, ${parts.state}`
      : `${parts.district}, ${parts.state}`;
    locationIntelligenceService.setManualDistrict(parts.district, parts.state);
    locationIntelligenceService.setActiveLocation(formatted);
    setCustomAreaInput('');
    setShowDistrictModal(false);
    if (onLocationChange) {
      onLocationChange(formatted);
    }
  };

  const selectedPathway = rankedPaths.find((p) => p.id === selectedPathId) || topPaths[0] || rankedPaths[0];
  const completedCount = [0, 1, 2].filter((i) => doneStages[selectedPathway.id + i]).length;
  const filteredJobs = jobs.filter((j) => jobFilter === 'All' || j.type === jobFilter);
  const nearbyCount = jobs.filter((j) => j.inRange).length;
  const schemes = locationData?.schemes?.length ? locationData.schemes : FALLBACK_SCHEMES;
  const schemesAreFallback = !locationData?.schemes?.length;
  const centers = locationData?.trainingCenters || [];

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleWhy = (id: string) => setExpandedWhy((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleStageDone = (key: string) => {
    const willBeDone = !doneStages[key];
    const updated = { ...doneStages, [key]: willBeDone };
    setDoneStages(updated);
    storageService.saveProgress(updated);
    if (willBeDone) {
      speechService.playAudioCue('success');
      setCelebratedStageKey(key);
      onNotify('🎉 ' + dt('stageDone', L));
      setTimeout(() => setCelebratedStageKey(null), 2200);
    }
  };

  const toggleShortlist = (id: string, item?: Opportunity) => {
    if (onShortlistToggle) {
      onShortlistToggle(id, item);
      return;
    }
    const updated = { ...localShortlist, [id]: !localShortlist[id] };
    setLocalShortlist(updated);
    storageService.saveShortlist(updated);
    onNotify(updated[id] ? dt('savedToast', L) : dt('removedToast', L));
  };

  const stopAllSpeech = () => {
    speechService.stopSpeaking();
    setIsReadingRoadmap(false);
    setReadingJobId(null);
  };

  const handleReadAloudRoadmap = () => {
    if (isReadingRoadmap) {
      stopAllSpeech();
      return;
    }
    stopAllSpeech();
    const loc = locationLabel || (L === 'bho' ? 'रउआ इलाका' : 'आपके क्षेत्र');
    const name = pathwayName(selectedPathway, L);
    const st = [0, 1, 2].map((i) => stageText(selectedPathway, i, L));
    const dur = localizeDuration(selectedPathway.duration, L);
    const ai = profile.aiAnalysis?.summary ? profile.aiAnalysis.summary + (L === 'en' || L === 'hin' ? '. ' : '। ') : '';
    const top = filteredJobs[0];
    let text = '';
    if (L === 'bho') {
      text =
        `प्रणाम ${displayName}! रउआ पढ़ाई, हुनर अउर ${loc} के हिसाब से रोडमैप तइयार बा। ${ai}` +
        `रउआ खातिर सबसे बढ़िया कौशल बा ${name}। मेल ${selectedPathway.score} प्रतिशत बा अउर ई ${dur} के बा। ` +
        `पहिला चरण: ${st[0].title}। दूसर चरण: ${st[1].title}। तीसर चरण: ${st[2].title}। ` +
        (top ? `रउआ लगे ${filteredJobs.length} मौका बा, जइसे ${top.title}। ` : '') +
        'हर चरण पूरा होखे पर पूरा भइल दबाईं।';
    } else if (L === 'en') {
      text =
        `Hello ${displayName}! Your roadmap for ${loc} is ready. ${ai}` +
        `Your best skill match is ${name} with a fit score of ${selectedPathway.score} percent. It takes ${dur}. ` +
        `Stage 1: ${st[0].title}. Stage 2: ${st[1].title}. Stage 3: ${st[2].title}. ` +
        (top ? `There are ${filteredJobs.length} openings for you, including ${top.title}. ` : '') +
        'Tap mark done as you finish each stage.';
    } else if (L === 'hin') {
      text =
        `Namaste ${displayName}! ${loc} ke liye aapka roadmap taiyaar hai. ${ai}` +
        `Aapke liye sabse accha skill hai ${name}, match ${selectedPathway.score} percent. Training ${dur} ki hai. ` +
        `Stage 1: ${st[0].title}. Stage 2: ${st[1].title}. Stage 3: ${st[2].title}. ` +
        (top ? `Aapke liye ${filteredJobs.length} openings hain, jaise ${top.title}. ` : '') +
        'Har stage ke baad mark done dabayein.';
    } else {
      text =
        `नमस्ते ${displayName}! ${loc} के अनुसार आपका रोडमैप तैयार है। ${ai}` +
        `आपके लिए सबसे अच्छा कौशल है ${name}। मेल ${selectedPathway.score} प्रतिशत है और प्रशिक्षण ${dur} का है। ` +
        `पहला चरण: ${st[0].title}। दूसरा चरण: ${st[1].title}। तीसरा चरण: ${st[2].title}। ` +
        (top ? `आपके लिए ${filteredJobs.length} अवसर हैं, जैसे ${top.title}। ` : '') +
        'हर चरण पूरा होने पर पूरा हुआ दबाएँ।';
    }
    setIsReadingRoadmap(true);
    speechService.speak(text, L, () => setIsReadingRoadmap(false));
  };

  const handleReadJob = (job: Opportunity) => {
    if (readingJobId === job.id) {
      stopAllSpeech();
      return;
    }
    stopAllSpeech();
    const t = opportunityTypeLabel(job.type, L);
    const dist = distanceLabel(job.km, L);
    let text = '';
    if (isEnglishLike(L)) {
      text = `${job.title}. ${job.org}. ${t}. ${job.loc}, ${dist}. Pay: ${job.pay}.`;
    } else {
      text = `${job.title}। ${job.org}। ${t}। ${job.loc}, ${dist}। कमाई: ${job.pay}।`;
    }
    setReadingJobId(job.id);
    speechService.speak(text, L, () => setReadingJobId(null));
  };

  const handleDownload = () => {
    const text = buildSummary(profile, rankedPaths, jobs, selectedPathId, shortlist);
    onOpenSummary({
      text,
      fname: `JeevikaAI-Roadmap-${slug(displayName)}.txt`,
      profile,
      selectedPathway,
      jobs: filteredJobs,
    });
  };

  const navItems = [
    { id: 'overview-section', icon: 'compass', label: dt('navOverview', L) },
    { id: 'hub-section', icon: 'pin', label: dt('navHub', L) },
    { id: 'schemes-section', icon: 'shieldCheck', label: dt('navSchemes', L) },
    { id: 'pathways-section', icon: 'layers', label: dt('navPathways', L) },
    { id: 'roadmap-section', icon: 'route', label: dt('navRoadmap', L) },
    { id: 'opportunities-section', icon: 'briefcase', label: dt('navOpenings', L) },
    { id: 'centers-section', icon: 'cap', label: dt('navCenters', L) },
  ];

  const coverageText =
    currentAccuracy.level === 'Precise'
      ? dt('covPrecise', L, { m: currentAccuracy.accuracyMeters ? ` (±${currentAccuracy.accuracyMeters}m)` : '' })
      : currentAccuracy.level === 'District-level'
      ? dt('covDistrict', L, { loc: locationLabel || districtShort || '—' })
      : dt('covState', L);

  const eduText = optionLabel(EDU, profile.education, L) || dt('notShared', L);
  const workText = optionLabel(WORK, profile.workType, L) || dt('notShared', L);
  const mobText = optionLabel(MOB, profile.mobility, L) || dt('notShared', L);

  const kpiLabelClass = 'text-[11px] font-bold uppercase tracking-wider';

  return (
    <main className="bg-[#F7F9FC] min-h-screen">
      {/* Breadcrumb strip */}
      <div className="bg-white border-b border-[#DCE3EA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#5F6B76]">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 font-medium">
            <button onClick={() => go('home')} className="hover:text-[#17365D] hover:underline">
              {dt('crumbHome', L)}
            </button>
            <span aria-hidden>›</span>
            <span className="text-[#17365D] font-bold">{dt('crumbDash', L)}</span>
          </nav>
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#17365D]">
            <Icon name="shieldCheck" size={14} className="text-[#287D73]" />
            {dt('portalLabel', L)}
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div className="space-y-5 sm:space-y-6 min-w-0">
          {/* Welcome banner */}
          <section id="overview-section" className="scroll-mt-28 rounded-2xl overflow-hidden border border-[#17365D] bg-[#17365D] text-white">
            <div className="gov-tricolor-line" />
            <div className="p-5 sm:p-7 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center font-extrabold text-2xl flex-none overflow-hidden">
                    {profile.avatarUrl ? (
                      <img src={profile.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      displayInitial
                    )}
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md text-xs font-bold bg-white/12 border border-white/20">
                      <span className="w-2 h-2 rounded-full bg-[#F4B966]" />
                      {dt('planTag', L)}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight !text-white break-words font-['Bricolage_Grotesque']">
                      {dt('hello', L)}, {displayName}!
                    </h1>
                    <p className="text-sm text-white/90 max-w-xl leading-relaxed">{dt('planSub', L)}</p>
                    {!hasAssessment && (
                      <p className="mt-2 text-xs sm:text-sm font-semibold bg-[#D9822B] text-white rounded-xl px-3 py-2 max-w-xl">
                        {dt('demoNote', L)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Primary Actions */}
                <div className="flex flex-wrap items-center gap-2 flex-none">
                  <button
                    type="button"
                    onClick={handleReadAloudRoadmap}
                    className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors ${
                      isReadingRoadmap
                        ? 'bg-[#D9822B] text-white'
                        : 'bg-[#287D73] hover:bg-[#1E6058] text-white'
                    }`}
                  >
                    <Icon name={isReadingRoadmap ? 'volumeX' : 'volume2'} size={15} />
                    <span>{isReadingRoadmap ? dt('stopListen', L) : dt('listenRoadmap', L)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-white text-[#17365D] hover:bg-[#F7F9FC] text-xs font-extrabold flex items-center gap-1.5 transition-colors"
                  >
                    <Icon name="download" size={15} />
                    <span>{dt('exportBtn', L)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => go('assessment')}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/12 hover:bg-white/20 border border-white/25 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Icon name="edit" size={14} />
                    <span>{dt('editProfile', L)}</span>
                  </button>
                </div>
              </div>

              {/* Compact Profile Info Bar + Details Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15">
                    <strong className="text-[#F4B966]">{dt('chipEdu', L)}:</strong> {eduText}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15">
                    <strong className="text-[#F4B966]">{dt('chipLoc', L)}:</strong> {locationLabel || dt('notShared', L)}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15">
                    <strong className="text-[#F4B966]">{dt('chipWork', L)}:</strong> {workText}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowProfileDetails((s) => !s)}
                  className="text-xs font-bold text-[#F4B966] hover:underline inline-flex items-center gap-1"
                >
                  <span>{showProfileDetails ? dt('hideDetails', L) : dt('showDetails', L)}</span>
                  <Icon name="chev" size={13} className={showProfileDetails ? 'rotate-180' : ''} />
                </button>
              </div>

              {profile.aiAnalysis?.summary && (
                <div className="p-3.5 rounded-xl bg-white/10 border border-white/20 text-sm flex items-start gap-2.5">
                  <Icon name="sparkles" size={18} className="text-[#F4B966] flex-none mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-extrabold text-[#F4B966] mr-1">{dt('aiSummary', L)}:</span>
                    <span>{profile.aiAnalysis.summary}</span>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {profile.aiAnalysis.topCareerPathway && (
                        <span className="px-2 py-0.5 rounded-md bg-white/15 font-bold text-xs inline-flex items-center gap-1">
                          <Icon name="target" size={12} className="text-[#F4B966]" />
                          <span>
                            {dt('aiField', L)}: {profile.aiAnalysis.topCareerPathway}
                          </span>
                        </span>
                      )}
                      {profile.aiAnalysis.readinessScore ? (
                        <span className="px-2 py-0.5 rounded-md bg-[#287D73] text-white font-bold text-xs inline-flex items-center gap-1 tabular-nums">
                          <Icon name="zap" size={12} />
                          <span>
                            {dt('aiReady', L)}: {profile.aiAnalysis.readinessScore}%
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              {showProfileDetails && (
                <div className="p-4 rounded-xl bg-white/10 border border-white/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  {[
                    [dt('dSkills', L), profile.skills],
                    [dt('dInterests', L), profile.interests],
                    [dt('dOccupation', L), profile.occupation],
                    [dt('dMobility', L), mobText],
                  ].map(([k, v]) => (
                    <div key={k as string} className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-white/70">{k}</div>
                      <div className="font-semibold mt-0.5 break-words">{v || dt('notShared', L)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Section Jump Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-[#DCE3EA] hover:border-[#245A91] text-xs font-bold text-[#17365D] flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <Icon name={item.icon} size={13} className="text-[#287D73]" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Assisted Account Banner */}
          {hasAssessment && onOpenAccount && (!currentUser || currentUser.isAnonymous) && !bannerDismissed && (
            <section
              id="account-banner"
              className="relative rounded-2xl border-2 border-[#287D73]/40 bg-[#287D73]/5 p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4"
            >
              <button
                onClick={() => setBannerDismissed(true)}
                className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white hover:bg-slate-50 border border-[#DCE3EA] text-[#5F6B76] hover:text-[#17365D] flex items-center justify-center text-xs font-bold transition-colors"
                title="हटाएँ (Dismiss)"
                aria-label="Dismiss banner"
              >
                ✕
              </button>
              <span className="w-12 h-12 rounded-xl bg-[#287D73] text-white flex items-center justify-center flex-none">
                <Icon name="user" size={24} />
              </span>
              <div className="flex-1 min-w-0 pr-6 md:pr-0">
                <h2 className="text-base sm:text-lg font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
                  {dt('accTitle', L)}
                </h2>
                <p className="text-sm text-[#5F6B76] mt-0.5">{dt('accBody', L)}</p>
              </div>
              <div className="flex flex-col sm:flex-row md:flex-col gap-2 md:w-60 flex-none">
                <button
                  onClick={() => onOpenAccount('create')}
                  className="min-h-12 px-4 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white text-sm font-extrabold flex items-center justify-center gap-2"
                >
                  <Icon name="mic" size={18} />
                  {dt('accCreate', L)}
                </button>
                <button
                  onClick={() => onOpenAccount('login')}
                  className="min-h-11 px-4 rounded-xl border border-[#DCE3EA] bg-white text-[#17365D] text-sm font-bold hover:bg-slate-50"
                >
                  {dt('accLogin', L)}
                </button>
              </div>
            </section>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <div className="col-span-2 xl:col-span-1 p-4 rounded-2xl bg-white border border-[#DCE3EA] flex items-center gap-3">
              <Ring value={topPaths[0]?.score || 0} size={56} label={dt('kpiTop', L)} />
              <div className="min-w-0">
                <div className={`${kpiLabelClass} text-[#287D73]`}>{dt('kpiTop', L)}</div>
                <div className="text-base font-extrabold text-[#17365D] leading-tight">
                  {topPaths[0] && pathwayName(topPaths[0], L)}
                </div>
                <div className="text-xs text-[#5F6B76] tabular-nums">
                  {dt('nsqfLevel', L)} {topPaths[0]?.nsqf} · {topPaths[0] && localizeDuration(topPaths[0].duration, L).split('(')[0].trim()}
                </div>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#DCE3EA]">
              <div className={`${kpiLabelClass} text-[#287D73]`}>{dt('kpiProgress', L)}</div>
              <div className="text-base font-extrabold text-[#17365D] mt-1 tabular-nums">
                {dt('stagesOf', L, { n: completedCount })}
              </div>
              <div className="w-full bg-[#F7F9FC] h-2 rounded-full overflow-hidden mt-2 border border-[#DCE3EA]">
                <div className="bg-[#287D73] h-full rounded-full transition-all" style={{ width: `${(completedCount / 3) * 100}%` }} />
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#DCE3EA]">
              <div className={`${kpiLabelClass} text-[#245A91]`}>{dt('kpiOpenings', L)}</div>
              <div className="text-2xl font-extrabold text-[#17365D] mt-0.5 tabular-nums">{jobs.length}</div>
              <div className="text-xs text-[#5F6B76] tabular-nums">
                {dt('nearbyOf', L, { a: nearbyCount, b: jobs.length })}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#DCE3EA]">
              <div className={`${kpiLabelClass} text-[#D9822B]`}>{dt('kpiSchemes', L)}</div>
              <div className="text-2xl font-extrabold text-[#17365D] mt-0.5 tabular-nums">{schemes.length}</div>
              <div className="text-xs text-[#5F6B76]">
                {districtShort ? `${dt('inDistrict', L)}: ${districtShort}` : dt('inDistrict', L)}
              </div>
            </div>
          </div>

          {/* District Hub */}
          <Panel id="hub-section">
            <SectionHead
              icon="pin"
              tag={dt('hubTitle', L)}
              title={locationLabel || '—'}
              right={
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold border ${
                      locationData?.isAiGenerated
                        ? 'bg-[#E3F1FA] text-[#245A91] border-[#245A91]/25'
                        : 'bg-[#F0FDF4] text-[#287D73] border-[#287D73]/25'
                    }`}
                  >
                    <Icon name={locationData?.isAiGenerated ? 'sparkles' : 'check'} size={12} />
                    {locationData?.isAiGenerated ? dt('liveAi', L) : dt('curated', L)}
                  </span>
                  {locationData?.timestamp && (
                    <span className="text-[11px] text-[#5F6B76] font-medium tabular-nums">
                      {dt('updated', L)}: {new Date(locationData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              }
            />

            <div className="flex flex-wrap gap-2">
              <button
                id="detect-my-location-card-btn"
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
                className="min-h-12 px-4 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white text-sm font-extrabold flex items-center gap-2 active:scale-95 disabled:opacity-75 transition-colors"
              >
                <Icon name={isDetectingLocation ? 'refresh' : 'target'} size={18} className={isDetectingLocation ? 'animate-spin' : ''} />
                {isDetectingLocation ? dt('detecting', L) : dt('detectGps', L)}
              </button>

              <button
                type="button"
                onClick={() => setShowDistrictModal(true)}
                className="min-h-12 px-4 rounded-xl bg-white border border-[#DCE3EA] text-[#17365D] hover:bg-[#F7F9FC] text-sm font-bold flex items-center gap-2 transition-colors"
              >
                <Icon name="mapPin" size={16} className="text-[#245A91]" />
                {dt('changeDistrict', L)}
              </button>

              {onRefreshLocationAi && (
                <button
                  onClick={onRefreshLocationAi}
                  disabled={isRefreshingLocationData}
                  className="min-h-12 px-4 rounded-xl bg-white border border-[#245A91]/30 text-[#245A91] hover:bg-[#F7F9FC] text-sm font-bold flex items-center gap-2 disabled:opacity-70 transition-colors"
                >
                  <Icon name={isRefreshingLocationData ? 'refresh' : 'sparkles'} size={16} className={isRefreshingLocationData ? 'animate-spin' : ''} />
                  {isRefreshingLocationData ? dt('refreshing', L) : dt('refreshAi', L)}
                </button>
              )}
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] flex flex-wrap items-start justify-between gap-3 text-sm">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="p-1.5 rounded-lg bg-[#287D73]/15 text-[#287D73] flex-none">
                  <Icon name="target" size={16} />
                </span>
                <div className="min-w-0">
                  <span className="font-bold text-[#17365D]">{dt('coverage', L)}: </span>
                  <span className="text-[#5F6B76]">{coverageText}</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-[#17365D] text-white flex-none tabular-nums">
                {dt('confidence', L, { n: currentAccuracy.confidenceScore })}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl border border-[#DCE3EA] bg-white">
                <div className={`${kpiLabelClass} text-[#287D73]`}>{dt('topSectors', L)}</div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(locationData?.insight?.topSectors?.length ? locationData.insight.topSectors : []).map((s, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-[#F0FDF4] text-[#287D73] font-semibold text-xs border border-[#287D73]/25">
                      {s}
                    </span>
                  ))}
                  {!locationData?.insight?.topSectors?.length && <span className="text-xs text-[#5F6B76]">{dt('notAvailable', L)}</span>}
                </div>
              </div>
              <div className="p-4 rounded-xl border border-[#DCE3EA] bg-white">
                <div className={`${kpiLabelClass} text-[#245A91]`}>{dt('avgWage', L)}</div>
                <div className="text-lg font-extrabold text-[#17365D] mt-1 tabular-nums">
                  {locationData?.insight?.averageMonthlyWage || dt('notAvailable', L)}
                </div>
              </div>
              <div className="p-4 rounded-xl border border-[#DCE3EA] bg-white">
                <div className={`${kpiLabelClass} text-[#17365D]`}>{dt('openVac', L)}</div>
                <div className="text-lg font-extrabold text-[#17365D] mt-1 tabular-nums">
                  {locationData?.insight?.openVacanciesCount ?? jobs.length}
                </div>
              </div>
            </div>

            {/* Interactive District Leaflet Map */}
            <div className="mt-4">
              <DistrictMiniMap
                latitude={locationData?.latitude}
                longitude={locationData?.longitude}
                district={districtShort || 'Maharajganj'}
                state={locationData?.state}
                locality={currentAccuracy.locality}
                accuracyLevel={currentAccuracy.level}
                accuracyMeters={currentAccuracy.accuracyMeters}
                confidenceScore={currentAccuracy.confidenceScore}
                trainingCenters={centers}
                onReDetect={handleDetectLocation}
                isDetecting={isDetectingLocation}
              />
            </div>
          </Panel>

          {/* Schemes */}
          <Panel id="schemes-section">
            <SectionHead icon="shieldCheck" tag={districtShort} title={dt('schemesTitle', L)} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              {applyAdminSchemeImages(schemes.slice(0, 3), mediaAssets).map((s) => (
                <SchemeCard key={s.id} scheme={s} lang={L} onNavigate={go} />
              ))}
            </div>
            {schemesAreFallback && (
              <p className="mt-3 text-xs text-[#5F6B76]">{dt('schemeFallbackNote', L)}</p>
            )}
          </Panel>

          {/* Pathways */}
          <section id="pathways-section" className="scroll-mt-28 space-y-3">
            <SectionHead
              tag={dt('pathTag', L)}
              title={dt('pathTitle', L)}
              right={
                <button
                  onClick={() => go('assessment')}
                  className="min-h-11 px-4 rounded-xl bg-[#245A91] text-white text-sm font-bold hover:bg-[#17365D] flex items-center justify-center gap-2 transition-colors"
                >
                  <Icon name="mic" size={16} />
                  {dt('retake', L)}
                </button>
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topPaths.map((p, index) => (
                <article
                  key={p.id}
                  className="bg-white border border-[#DCE3EA] rounded-2xl p-5 flex flex-col gap-4 hover:border-[#245A91] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-none ${
                        index === 0 ? 'bg-[#287D73]/15 text-[#287D73]' : index === 1 ? 'bg-[#245A91]/15 text-[#245A91]' : 'bg-[#17365D]/10 text-[#17365D]'
                      }`}
                    >
                      <Icon name={p.icon} size={24} />
                    </div>
                    <Ring value={p.score} label={dt('kpiTop', L)} />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#287D73] tabular-nums">
                      {dt('rec', L)} #{index + 1}
                    </div>
                    <h3 className="text-lg font-extrabold text-[#17365D] leading-tight mt-0.5 font-['Bricolage_Grotesque']">
                      {pathwayName(p, L)}
                    </h3>
                    <div className="text-xs text-[#5F6B76] mt-0.5">{pathwayRole(p, L)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#F7F9FC] text-[#5F6B76] border border-[#DCE3EA] flex items-center gap-1 font-medium tabular-nums">
                      <Icon name="clock" size={12} /> {localizeDuration(p.duration, L)}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-[#E3F1FA] text-[#245A91] flex items-center gap-1 font-semibold tabular-nums">
                      <Icon name="layers" size={12} /> {dt('nsqfLevel', L)} {p.nsqf}
                    </span>
                  </div>
                  <p className="text-sm text-[#202B36] leading-relaxed">{fitText(p, L)}</p>

                  <div className="space-y-2 mt-auto pt-3 border-t border-[#DCE3EA]">
                    <button
                      onClick={() => toggleWhy(p.id)}
                      aria-expanded={Boolean(expandedWhy[p.id])}
                      className="w-full min-h-11 px-3 rounded-xl border border-[#DCE3EA] text-sm font-bold text-[#17365D] hover:bg-[#F7F9FC] flex items-center justify-between transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Icon name="bulb" size={16} />
                        {dt('whyBtn', L)}
                      </span>
                      <Icon name="chev" size={14} className={expandedWhy[p.id] ? 'rotate-180' : ''} />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPathId(p.id);
                        scrollToSection('roadmap-section');
                      }}
                      className="w-full min-h-11 px-3 rounded-xl bg-[#245A91] text-white text-sm font-bold hover:bg-[#17365D] flex items-center justify-center gap-2 transition-colors"
                    >
                      <Icon name="route" size={16} />
                      {dt('viewRoad', L)}
                    </button>
                    {expandedWhy[p.id] && (
                      <div className="mt-2 p-3 rounded-xl bg-[#F7F9FC] border border-dashed border-[#DCE3EA] space-y-2">
                        <div className="text-xs font-bold text-[#17365D] tabular-nums">
                          {dt('breakdown', L)}: {p.score}/100
                        </div>
                        {p.factors.map((f) => (
                          <div key={f.k} className="text-xs">
                            <div className="flex justify-between font-semibold">
                              <span>{factorLabel(f.k, f.label, L)}</span>
                              <span className={`tabular-nums ${f.pts < 0 ? 'text-[#9E2A2B]' : 'text-[#287D73]'}`}>
                                {f.pts > 0 ? '+' : ''}
                                {f.pts}
                              </span>
                            </div>
                            <p className="text-[#5F6B76]">{factorNote(f.k, f.pts, f.note, L)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Roadmap */}
          <Panel id="roadmap-section">
            <SectionHead icon="route" tag={dt('roadTag', L)} title={dt('roadTitle', L)} />
            <p className="text-sm text-[#5F6B76] -mt-2 mb-4">{dt('roadSub', L)}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {topPaths.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPathId(p.id)}
                  aria-pressed={selectedPathId === p.id}
                  className={`min-h-11 px-4 rounded-xl text-sm font-bold transition-colors ${
                    selectedPathId === p.id
                      ? 'bg-[#17365D] text-white'
                      : 'bg-[#F7F9FC] text-[#5F6B76] border border-[#DCE3EA] hover:border-[#245A91] hover:text-[#17365D]'
                  }`}
                >
                  {pathwayName(p, L)}
                </button>
              ))}
            </div>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[0, 1, 2].map((idx) => {
                const stageKey = selectedPathway.id + idx;
                const isDone = Boolean(doneStages[stageKey]);
                const st = stageText(selectedPathway, idx, L);
                return (
                  <li
                    key={stageKey}
                    className={`p-4 rounded-xl border flex flex-col gap-3 relative overflow-hidden ${
                      isDone ? 'border-[#287D73] bg-[#287D73]/5' : 'border-[#DCE3EA] bg-[#F7F9FC]'
                    }`}
                  >
                    {celebratedStageKey === stageKey && (
                      <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center bg-[#287D73]/15">
                        <div className="bg-white text-[#287D73] px-3 py-2 rounded-xl shadow-lg border border-[#287D73]/30 font-extrabold text-xs flex items-center gap-1.5">
                          <Icon name="sparkles" size={16} className="text-[#D9822B]" />
                          {dt('stageDone', L)}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#287D73] tabular-nums">
                        {dt('stage', L)} {idx + 1} · {STAGE_TITLES_L10N[L][idx]}
                      </div>
                      <h4 className="text-base font-extrabold text-[#17365D] leading-snug mt-1 font-['Bricolage_Grotesque']">
                        {st.title}
                      </h4>
                      <p className="text-sm text-[#5F6B76] leading-relaxed mt-1">{st.desc}</p>
                    </div>
                    <div className="mt-auto pt-3 flex items-center justify-between gap-2 border-t border-[#DCE3EA]">
                      <span className="text-xs font-bold text-[#17365D] tabular-nums">{st.when}</span>
                      <button
                        onClick={() => toggleStageDone(stageKey)}
                        aria-pressed={isDone}
                        className={`min-h-11 inline-flex items-center gap-1.5 px-3.5 rounded-lg text-sm font-bold transition-colors ${
                          isDone ? 'bg-[#287D73] text-white' : 'bg-white border border-[#DCE3EA] text-[#17365D] hover:border-[#287D73]'
                        }`}
                      >
                        <Icon name="check" size={16} />
                        {isDone ? dt('completed', L) : dt('markDone', L)}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="flex items-center gap-3 pt-4 text-sm font-bold text-[#5F6B76]">
              <span className="whitespace-nowrap tabular-nums">{dt('stagesDoneLine', L, { c: completedCount, n: 3 })}</span>
              <div className="flex-1 bg-[#F7F9FC] border border-[#DCE3EA] h-2 rounded-full overflow-hidden">
                <div className="bg-[#287D73] h-full rounded-full transition-all" style={{ width: `${(completedCount / 3) * 100}%` }} />
              </div>
            </div>
          </Panel>

          {/* Openings */}
          <Panel id="opportunities-section">
            <SectionHead
              icon="briefcase"
              tag={dt('openTag', L, { loc: districtShort || '—' })}
              title={dt('openTitle', L)}
              right={
                <div role="tablist" className="flex items-center gap-1 bg-[#F7F9FC] p-1 rounded-xl border border-[#DCE3EA] text-sm font-bold self-start">
                  {(['All', 'Job', 'Self-employment'] as const).map((f) => (
                    <button
                      key={f}
                      role="tab"
                      aria-selected={jobFilter === f}
                      onClick={() => setJobFilter(f)}
                      className={`min-h-10 px-3 rounded-lg transition-colors ${
                        jobFilter === f ? 'bg-white text-[#17365D] border border-[#DCE3EA]' : 'text-[#5F6B76] hover:text-[#202B36]'
                      }`}
                    >
                      {f === 'All' ? dt('filterAll', L) : f === 'Job' ? dt('filterJob', L) : dt('filterSelf', L)}
                    </button>
                  ))}
                </div>
              }
            />

            {filteredJobs.length === 0 ? (
              <p className="text-sm text-[#5F6B76] py-6 text-center">{dt('noJobs', L)}</p>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto rounded-xl border border-[#DCE3EA]">
                  <table className="w-full text-sm">
                    <thead className="bg-[#17365D] text-white text-left">
                      <tr>
                        <th className="px-4 py-3 font-bold">{dt('colRole', L)}</th>
                        <th className="px-4 py-3 font-bold">{dt('colType', L)}</th>
                        <th className="px-4 py-3 font-bold">{dt('colPlace', L)}</th>
                        <th className="px-4 py-3 font-bold">{dt('colPay', L)}</th>
                        <th className="px-4 py-3 font-bold text-right">{dt('colAction', L)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE3EA]">
                      {filteredJobs.map((job, i) => {
                        const saved = Boolean(shortlist[job.id]);
                        return (
                          <tr key={job.id} className={`${i % 2 ? 'bg-[#FBFCFD]' : 'bg-white'} ${job.inRange ? '' : 'opacity-75'}`}>
                            <td className="px-4 py-3 align-top max-w-[260px]">
                              <div className="font-extrabold text-[#17365D] leading-snug">{job.title}</div>
                              <div className="text-xs text-[#5F6B76]">{job.org}</div>
                              {job.verified && (
                                <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-[#287D73]">
                                  <Icon name="check" size={11} /> {dt('verified', L)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span
                                className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                                  job.type === 'Job' ? 'bg-[#E3F1FA] text-[#245A91]' : 'bg-[#287D73]/15 text-[#287D73]'
                                }`}
                              >
                                {opportunityTypeLabel(job.type, L)}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold text-[#17365D]">{job.loc}</div>
                              <div className="text-xs text-[#5F6B76] tabular-nums">{distanceLabel(job.km, L)}</div>
                              {!job.inRange && <div className="text-[11px] text-[#9E2A2B] font-semibold">{dt('outRange', L)}</div>}
                            </td>
                            <td className="px-4 py-3 align-top font-bold text-[#287D73] tabular-nums">{job.pay}</td>
                            <td className="px-4 py-3 align-top">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleReadJob(job)}
                                  aria-label={`${dt('listen', L)}: ${job.title}`}
                                  className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                                    readingJobId === job.id
                                      ? 'bg-[#D9822B] border-[#D9822B] text-white'
                                      : 'border-[#DCE3EA] text-[#245A91] hover:bg-[#F7F9FC]'
                                  }`}
                                >
                                  <Icon name={readingJobId === job.id ? 'volumeX' : 'volume2'} size={16} />
                                </button>
                                <button
                                  onClick={() => onSelectDetail(job)}
                                  className="min-h-10 px-3 rounded-lg border border-[#DCE3EA] text-xs font-bold text-[#245A91] hover:bg-[#F7F9FC]"
                                >
                                  {dt('details', L)}
                                </button>
                                <button
                                  onClick={() => toggleShortlist(job.id, job)}
                                  aria-pressed={saved}
                                  className={`min-h-10 px-3 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                                    saved
                                      ? 'bg-[#FFF4DB] text-[#B8691A] border border-[#EBCB7A]'
                                      : 'bg-white border border-[#DCE3EA] text-[#5F6B76] hover:border-[#245A91]'
                                  }`}
                                >
                                  <Icon name="star" size={13} className={saved ? 'fill-[#D9822B]' : ''} />
                                  {saved ? dt('savedBtn', L) : dt('saveBtn', L)}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Cards for mobile */}
                <div className="md:hidden grid grid-cols-1 gap-3">
                  {filteredJobs.map((job) => {
                    const saved = Boolean(shortlist[job.id]);
                    return (
                      <article
                        key={job.id}
                        className={`border rounded-xl p-4 space-y-3 ${
                          job.inRange ? 'border-[#DCE3EA]' : 'border-dashed border-[#DCE3EA] opacity-80'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                              job.type === 'Job' ? 'bg-[#E3F1FA] text-[#245A91]' : 'bg-[#287D73]/15 text-[#287D73]'
                            }`}
                          >
                            {opportunityTypeLabel(job.type, L)}
                          </span>
                          {job.verified && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#287D73]">
                              <Icon name="check" size={11} /> {dt('verified', L)}
                            </span>
                          )}
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-[#17365D] leading-snug">{job.title}</h4>
                          <div className="text-xs text-[#5F6B76]">{job.org}</div>
                        </div>
                        <div className="p-3 bg-[#F7F9FC] rounded-lg text-sm space-y-1">
                          <div className="flex items-center gap-1.5 font-semibold text-[#17365D] tabular-nums">
                            <Icon name="pin" size={14} />
                            <span>
                              {job.loc} · {distanceLabel(job.km, L)}
                            </span>
                          </div>
                          {!job.inRange && <div className="text-xs text-[#9E2A2B] font-semibold">{dt('outRange', L)}</div>}
                          <div className="font-extrabold text-[#287D73] tabular-nums">{job.pay}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => handleReadJob(job)}
                            aria-label={`${dt('listen', L)}: ${job.title}`}
                            className={`min-h-11 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 ${
                              readingJobId === job.id ? 'bg-[#D9822B] border-[#D9822B] text-white' : 'border-[#DCE3EA] text-[#245A91]'
                            }`}
                          >
                            <Icon name={readingJobId === job.id ? 'volumeX' : 'volume2'} size={16} />
                            {readingJobId === job.id ? dt('stopListen', L) : dt('listen', L)}
                          </button>
                          <button
                            onClick={() => onSelectDetail(job)}
                            className="min-h-11 rounded-lg border border-[#DCE3EA] text-xs font-bold text-[#245A91]"
                          >
                            {dt('details', L)}
                          </button>
                          <button
                            onClick={() => toggleShortlist(job.id, job)}
                            aria-pressed={saved}
                            className={`min-h-11 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${
                              saved ? 'bg-[#FFF4DB] text-[#B8691A] border border-[#EBCB7A]' : 'bg-white border border-[#DCE3EA] text-[#5F6B76]'
                            }`}
                          >
                            <Icon name="star" size={14} className={saved ? 'fill-[#D9822B]' : ''} />
                            {saved ? dt('savedBtn', L) : dt('saveBtn', L)}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
            <p className="mt-4 text-xs text-[#5F6B76]">{dt('sourceNote', L)}</p>
          </Panel>

          {/* Training centers */}
          <Panel id="centers-section">
            <SectionHead
              icon="cap"
              tag={districtShort}
              title={dt('centersTitle', L)}
              right={
                <button
                  onClick={() => go('training')}
                  className="min-h-11 px-4 rounded-xl bg-white border border-[#DCE3EA] text-[#17365D] hover:bg-[#F7F9FC] text-sm font-bold flex items-center justify-center gap-2 self-start transition-colors"
                >
                  {dt('seeAll', L)}
                  <Icon name="arrowR" size={14} />
                </button>
              }
            />
            {centers.length === 0 ? (
              <p className="text-sm text-[#5F6B76]">{dt('noCenters', L)}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                {centers.slice(0, 3).map((c) => {
                  const centerSaved = Boolean(shortlist[c.id]);
                  return (
                    <article key={c.id} className="p-4 rounded-xl border border-[#DCE3EA] bg-white flex flex-col gap-2">
                      <h3 className="text-base font-extrabold text-[#17365D] leading-snug">{c.title}</h3>
                      <div className="text-xs text-[#5F6B76]">{c.org}</div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-[#17365D] tabular-nums">
                        <Icon name="pin" size={14} />
                        {c.loc} · {distanceLabel(c.km, L)}
                      </div>
                      <div className="text-sm font-bold text-[#287D73] tabular-nums">{c.pay}</div>
                      <div className="mt-auto pt-2 flex items-center gap-2">
                        <button
                          onClick={() => onSelectDetail(c)}
                          className="flex-1 min-h-11 rounded-lg border border-[#DCE3EA] text-sm font-bold text-[#245A91] hover:bg-[#F7F9FC] transition-colors"
                        >
                          {dt('details', L)}
                        </button>
                        <button
                          onClick={() => toggleShortlist(c.id, { ...c, type: 'Training' })}
                          aria-pressed={centerSaved}
                          className={`min-h-11 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                            centerSaved
                              ? 'bg-[#FFF4DB] text-[#B8691A] border border-[#EBCB7A]'
                              : 'bg-white border border-[#DCE3EA] text-[#5F6B76] hover:border-[#287D73]'
                          }`}
                        >
                          <Icon name="star" size={14} className={centerSaved ? 'fill-[#D9822B]' : ''} />
                          {centerSaved ? dt('savedBtn', L) : dt('saveBtn', L)}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* District Picker Modal */}
      {showDistrictModal && (
        <div className="fixed inset-0 z-50 bg-[#17365D]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#DCE3EA] space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#DCE3EA] pb-3">
              <div className="flex items-center gap-2">
                <Icon name="mapPin" size={20} className="text-[#287D73]" />
                <h3 className="text-lg font-bold text-[#17365D] font-['Bricolage_Grotesque']">
                  {dt('selectDistrict', L)}
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
            <p className="text-xs text-[#5F6B76]">{dt('gpsHint', L)}</p>
            <form onSubmit={handleCustomAreaSubmit} className="flex gap-2">
              <input
                type="text"
                value={customAreaInput}
                onChange={(e) => setCustomAreaInput(e.target.value)}
                placeholder={L === 'en' ? 'Type village, town, or district (e.g. Gomti Nagar, Lucknow)...' : 'गाँव, कस्बा या जिला लिखें (जैसे: Gomti Nagar, Lucknow)...'}
                className="flex-1 min-h-[42px] px-3 py-2 rounded-xl border border-[#DCE3EA] text-xs focus:border-[#287D73] focus:outline-none text-[#17365D]"
              />
              <button
                type="submit"
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white text-xs font-bold"
              >
                {L === 'en' ? 'Apply' : 'लागू करें'}
              </button>
            </form>
            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              {POPULAR_INDIAN_REGIONS.map((stateGroup) => (
                <div key={stateGroup.state} className="space-y-1.5">
                  <div className="text-[11px] font-extrabold text-[#287D73] uppercase tracking-wider">
                    {stateGroup.state} ({stateGroup.stateHi})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {stateGroup.districts.map((d) => {
                      const isSelected = districtShort.toLowerCase() === d.name.toLowerCase();
                      return (
                        <button
                          key={d.name}
                          onClick={() => handleSelectManualDistrict(d.name, stateGroup.state)}
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
                {dt('closeBtn', L)}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
