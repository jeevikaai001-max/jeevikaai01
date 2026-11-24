import React, { useState } from 'react';
import { Icon } from './Icons';
import { SupportedLanguage, LocationInsight } from '../types';
import { POPULAR_INDIAN_REGIONS, locationIntelligenceService } from '../services/locationIntelligenceService';
import { LocationAccuracyBadge } from './LocationAccuracyBadge';

interface LocationBarProps {
  currentLocation: string;
  onLocationChange: (newLocation: string) => void;
  onRefreshAi: () => Promise<void>;
  isRefreshing: boolean;
  isAiGenerated: boolean;
  insight?: LocationInsight | null;
  currentLang: SupportedLanguage;
}

export const LocationBar: React.FC<LocationBarProps> = ({
  currentLocation,
  onLocationChange,
  onRefreshAi,
  isRefreshing,
  isAiGenerated,
  insight,
  currentLang,
}) => {
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [selectedState, setSelectedState] = useState<string>('Uttar Pradesh');
  const [customInput, setCustomInput] = useState<string>('');
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const accuracy = locationIntelligenceService.getLocationAccuracy();

  const handleGpsDetect = async () => {
    setIsDetectingGps(true);
    setGpsError(null);
    try {
      const res = await locationIntelligenceService.detectGpsLocation();
      if (res && res.location) {
        onLocationChange(res.location);
        setShowPicker(false);
      }
    } catch {
      setGpsError(
        currentLang === 'bho'
          ? 'लोकेशन ना मिल पावल। कृपया जिला खुद चुनीं।'
          : currentLang === 'en'
          ? 'Could not access GPS. Please pick your district manually.'
          : 'जीपीएस लोकेशन प्राप्त नहीं हो सकी। कृपया जिला स्वयं चुनें।'
      );
    } finally {
      setIsDetectingGps(false);
    }
  };

  const handleSelectDistrict = (districtName: string, stateName: string) => {
    locationIntelligenceService.setManualDistrict(districtName, stateName);
    const full = `${districtName}, ${stateName}`;
    onLocationChange(full);
    setShowPicker(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    const val = customInput.trim();
    locationIntelligenceService.setActiveLocation(val, {
      level: 'District-level',
      confidenceScore: 82,
      source: 'manual',
      description: `कस्टम स्थान: ${val}`,
    });
    onLocationChange(val);
    setCustomInput('');
    setShowPicker(false);
  };

  const currentStateObj = POPULAR_INDIAN_REGIONS.find((s) => s.state === selectedState) || POPULAR_INDIAN_REGIONS[0];

  return (
    <div className="bg-[#17365D] text-white rounded-2xl p-4 sm:p-5 mb-6 border border-[#245A91]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-white/10 text-white border border-white/15">
              <Icon name="pin" size={12} className="text-[#F4B966]" />
              <span>{currentLang === 'bho' ? 'रउआ जिला / क्षेत्र' : currentLang === 'en' ? 'Active District' : 'सक्रिय कार्यक्षेत्र'}</span>
            </span>

            <LocationAccuracyBadge
              level={accuracy.level}
              confidenceScore={accuracy.confidenceScore}
              accuracyMeters={accuracy.accuracyMeters}
              locality={accuracy.locality}
              isDarkBackground={true}
              currentLang={currentLang}
              onReDetect={handleGpsDetect}
              isDetecting={isDetectingGps}
            />

            {isAiGenerated ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#287D73]/30 text-emerald-100 border border-[#287D73]/50">
                <Icon name="zap" size={11} />
                <span>AI लाइव डेटा सक्रिय (Live Gemini)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-medium bg-white/10 text-white/80">
                <span>स्थानीय सत्यापित डेटा</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight font-['Bricolage_Grotesque']">
              {currentLocation}
            </h2>
            <button
              onClick={() => setShowPicker(true)}
              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors inline-flex items-center gap-1 border border-white/15"
              title="स्थान बदलें"
            >
              <Icon name="search" size={13} />
              <span>बदलें</span>
            </button>
          </div>

          {insight && (
            <p className="text-xs text-white/85 max-w-2xl line-clamp-2">
              {insight.summary}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
          <button
            type="button"
            onClick={handleGpsDetect}
            disabled={isDetectingGps}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors flex items-center gap-1.5 border border-white/20 disabled:opacity-60"
            title="Auto-detect using GPS"
          >
            <Icon name="compass" size={14} className={isDetectingGps ? 'animate-spin' : ''} />
            <span>{isDetectingGps ? 'पहचान रहे हैं...' : 'GPS से पहचानें'}</span>
          </button>

          <button
            type="button"
            onClick={onRefreshAi}
            disabled={isRefreshing}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#D9822B] hover:bg-[#C27120] text-white text-xs font-extrabold transition-colors flex items-center gap-1.5 disabled:opacity-60"
          >
            <Icon name="zap" size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>
              {isRefreshing
                ? 'AI लाइव डेटा खोज रहा है...'
                : 'AI से लाइव डेटा खोजें'}
            </span>
          </button>
        </div>
      </div>

      {insight && (
        <div className="mt-4 pt-3.5 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white/10 rounded-xl p-2.5">
            <span className="text-[10px] text-white/75 block font-medium">औसत मासिक आय / वेतन</span>
            <span className="font-bold text-[#F4B966] text-sm tabular-nums">{insight.averageMonthlyWage}</span>
          </div>

          <div className="bg-white/10 rounded-xl p-2.5">
            <span className="text-[10px] text-white/75 block font-medium">सक्रिय सरकारी योजनाएं</span>
            <span className="font-bold text-white text-sm tabular-nums">{insight.activeSchemesCount}+ योजनाएं</span>
          </div>

          <div className="bg-white/10 rounded-xl p-2.5">
            <span className="text-[10px] text-white/75 block font-medium">अनुमानित खुली रिक्तियां</span>
            <span className="font-bold text-white text-sm tabular-nums">{insight.openVacanciesCount}+ अवसर</span>
          </div>

          <div className="bg-white/10 rounded-xl p-2.5">
            <span className="text-[10px] text-white/75 block font-medium">सत्यापित प्रशिक्षण केंद्र</span>
            <span className="font-bold text-white text-sm tabular-nums">{insight.verifiedCentersCount} सरकारी केंद्र</span>
          </div>
        </div>
      )}

      {/* Location Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-[#202B36]">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 space-y-4 max-h-[85vh] flex flex-col border border-[#DCE3EA] text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EA]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] text-[#245A91] flex items-center justify-center">
                  <Icon name="pin" size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#17365D]">
                    अपना जिला या कस्बा चुनें (Select Location)
                  </h3>
                  <p className="text-[11px] text-[#5F6B76]">
                    आपके जिले के अनुसार वास्तविक नौकरियां, प्रशिक्षण केंद्र व योजनाएं लोड होंगी
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPicker(false)}
                className="w-8 h-8 rounded-lg hover:bg-[#F7F9FC] text-[#5F6B76] flex items-center justify-center"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            {gpsError && (
              <div className="p-2.5 rounded-xl bg-[#FFF8EB] border border-[#FDE68A] text-[#B45309] text-[11px]">
                {gpsError}
              </div>
            )}

            <button
              type="button"
              onClick={handleGpsDetect}
              disabled={isDetectingGps}
              className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-[#F7F9FC] hover:bg-slate-100 text-[#17365D] font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-[#DCE3EA]"
            >
              <Icon name="compass" size={15} className={isDetectingGps ? 'animate-spin' : ''} />
              <span>{isDetectingGps ? 'जीपीएस द्वारा स्थान पहचाना जा रहा है...' : 'फोन के जीपीएस (GPS) से ऑटो-डिटेक्ट करें'}</span>
            </button>

            <form onSubmit={handleCustomSubmit} className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="कस्टम जिला लिखें (उदा. 'Varanasi', 'Patna', 'Ranchi')..."
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DCE3EA] text-xs focus:border-[#245A91] focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#17365D] text-white font-bold hover:bg-[#245A91] transition-colors"
              >
                लागू करें
              </button>
            </form>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 border-b border-[#DCE3EA]">
              {POPULAR_INDIAN_REGIONS.map((region) => (
                <button
                  key={region.state}
                  type="button"
                  onClick={() => setSelectedState(region.state)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors border ${
                    selectedState === region.state
                      ? 'bg-[#17365D] text-white border-[#17365D]'
                      : 'bg-[#F7F9FC] text-[#5F6B76] border-[#DCE3EA] hover:border-[#245A91]'
                  }`}
                >
                  {region.stateHi} ({region.state})
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto max-h-[36vh] pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {currentStateObj.districts.map((d) => (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => handleSelectDistrict(d.name, currentStateObj.state)}
                    className="p-2.5 rounded-xl border border-[#DCE3EA] hover:border-[#245A91] hover:bg-[#F7F9FC] text-left transition-colors group"
                  >
                    <span className="block font-bold text-[#17365D] group-hover:text-[#245A91]">
                      {d.hi}
                    </span>
                    <span className="block text-[10px] text-[#5F6B76]">
                      {d.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[#DCE3EA] flex justify-end">
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] hover:bg-slate-100 text-[#5F6B76] font-bold text-xs"
              >
                रद्द करें
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
