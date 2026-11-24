import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { AppView, MediaAssetRecord } from '../types';
import { mediaStorageService } from '../services/cloudinaryService';

interface SkillTrainingGalleryProps {
  go: (view: AppView) => void;
}

interface DefaultTradeCategory {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  nsqf: string;
  duration: string;
  imageUrl: string;
  textColor: string;
}

const DEFAULT_TRADES: DefaultTradeCategory[] = [
  {
    id: 'tr_1',
    title: 'सिलाई मशीन ऑपरेटर व परिधान निर्माण',
    category: 'tailoring',
    categoryLabel: 'सिलाई व कढ़ाई',
    nsqf: 'NSQF Level 4',
    duration: '3 माह (240 घंटे)',
    imageUrl: '/src/assets/images/trade_tailoring_1795513566462.jpg',
    textColor: 'text-[#9E2A2B]',
  },
  {
    id: 'tr_2',
    title: 'कंप्यूटर साक्षरता, टाइपिंग व डिजिटल सेवा',
    category: 'computer',
    categoryLabel: 'डिजिटल कौशल',
    nsqf: 'NSQF Level 3',
    duration: '2 माह (180 घंटे)',
    imageUrl: '/src/assets/images/trade_computer_1795513567280.jpg',
    textColor: 'text-[#245A91]',
  },
  {
    id: 'tr_3',
    title: 'सोलर रूफटॉप इंस्टॉलेशन व इन्वर्टर रिपेयर',
    category: 'solar',
    categoryLabel: 'सोलर ऊर्जा',
    nsqf: 'NSQF Level 4',
    duration: '3 माह (300 घंटे)',
    imageUrl: '/src/assets/images/trade_solar_1795513567205.jpg',
    textColor: 'text-[#B8691A]',
  },
  {
    id: 'tr_4',
    title: 'घरेलू वायरिंग, मोटर वाइंडिंग व विद्युत मरम्मत',
    category: 'electric',
    categoryLabel: 'विद्युत तकनीशियन',
    nsqf: 'NSQF Level 4',
    duration: '3 माह (250 घंटे)',
    imageUrl: '/src/assets/images/trade_electrical_1795513568671.jpg',
    textColor: 'text-[#B8691A]',
  },
  {
    id: 'tr_5',
    title: 'जैविक खेती, बागवानी व डेयरी पशुपालन',
    category: 'agriculture',
    categoryLabel: 'कृषि व डेयरी',
    nsqf: 'NSQF Level 3',
    duration: '1 माह (120 घंटे)',
    imageUrl: '/src/assets/images/trade_agri_retail_1795513568658.jpg',
    textColor: 'text-[#287D73]',
  },
  {
    id: 'tr_6',
    title: 'रिटेल सेल्स एवं ग्राहक सेवा सहायक',
    category: 'retail',
    categoryLabel: 'रिटेल व्यापार',
    nsqf: 'NSQF Level 3',
    duration: '2 माह (160 घंटे)',
    imageUrl: '/src/assets/images/hero_livelihood_banner_1795513568498.jpg',
    textColor: 'text-[#17365D]',
  },
];

export const SkillTrainingGallery: React.FC<SkillTrainingGalleryProps> = ({ go }) => {
  const [trainingMedia, setTrainingMedia] = useState<MediaAssetRecord[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  useEffect(() => {
    let isMounted = true;
    mediaStorageService.getMediaAssets().then((assets) => {
      if (isMounted) {
        const filtered = assets.filter((m) => m.folder === 'training');
        setTrainingMedia(filtered);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const hasAdminImages = trainingMedia.length > 0;

  return (
    <section className="py-12 bg-white border-b border-[#DCE3EA]" id="training-gallery">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#245A91] uppercase tracking-wider mb-1.5">
              <Icon name="cap" size={14} />
              <span>कौशल प्रशिक्षण गैलरी · Verified NSQF Trades</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#17365D] tracking-tight font-['Bricolage_Grotesque']">
              सिलाई, कंप्यूटर, सोलर एवं स्वरोजगार प्रशिक्षण
            </h2>
            <p className="text-sm text-[#5F6B76] max-w-xl mt-1">
              सरकारी कौशल विकास केंद्रों (PMKVY/RSETI) में संचालित राष्ट्रीय कौशल योग्यता ढाँचा (NSQF) ट्रेड।
            </p>
          </div>

          <button
            type="button"
            onClick={() => go('training')}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl border border-[#DCE3EA] hover:border-[#17365D] bg-white font-bold text-xs text-[#17365D] transition-colors flex-shrink-0"
          >
            <span>सभी केंद्र देखें</span>
            <Icon name="arrowR" size={14} />
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
          {[
            { id: 'all', label: 'सभी ट्रेड (All Trades)' },
            { id: 'tailoring', label: 'सिलाई व कढ़ाई' },
            { id: 'computer', label: 'कंप्यूटर व डिजिटल' },
            { id: 'solar', label: 'सोलर ऊर्जा' },
            { id: 'electric', label: 'इलेक्ट्रिकल' },
            { id: 'agriculture', label: 'कृषि व डेयरी' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedFilter(cat.id)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border ${
                selectedFilter === cat.id
                  ? 'bg-[#17365D] text-white border-[#17365D]'
                  : 'bg-[#F7F9FC] text-[#5F6B76] border-[#DCE3EA] hover:border-[#245A91] hover:text-[#17365D]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {hasAdminImages ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {trainingMedia.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-[#DCE3EA] overflow-hidden bg-white hover:border-[#245A91] transition-colors group flex flex-col"
              >
                <div className="h-48 bg-[#F7F9FC] relative overflow-hidden border-b border-[#DCE3EA]">
                  <img
                    src={m.url}
                    alt={m.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        '/src/assets/images/trade_computer_1795513567280.jpg';
                    }}
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#17365D]/90 text-white">
                    एडमिन प्रमाणित
                  </span>
                </div>

                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                  <h3 className="font-extrabold text-sm sm:text-base text-[#17365D] leading-snug line-clamp-2">
                    {m.name}
                  </h3>

                  {m.ctaUrl ? (
                    <a
                      href={m.ctaUrl}
                      className="w-full min-h-[44px] py-2.5 rounded-xl bg-[#17365D] hover:bg-[#245A91] text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>{m.ctaLabel || 'विवरण देखें'}</span>
                      <Icon name="arrowR" size={14} />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => go('training')}
                      className="w-full min-h-[44px] py-2.5 rounded-xl bg-[#F7F9FC] hover:bg-[#17365D] hover:text-white border border-[#DCE3EA] text-[#17365D] font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Icon name="cap" size={14} />
                      <span>प्रशिक्षण केंद्र विवरण</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {DEFAULT_TRADES.filter(
              (t) => selectedFilter === 'all' || t.category === selectedFilter
            ).map((trade) => (
              <div
                key={trade.id}
                className="rounded-2xl border border-[#DCE3EA] overflow-hidden bg-white hover:border-[#245A91] transition-colors flex flex-col group"
              >
                <div className="h-48 bg-[#F7F9FC] relative overflow-hidden border-b border-[#DCE3EA]">
                  <img
                    src={trade.imageUrl}
                    alt={trade.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        '/src/assets/images/trade_computer_1795513567280.jpg';
                    }}
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#17365D]/90 text-white">
                    {trade.nsqf}
                  </span>
                </div>

                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${trade.textColor}`}>
                      {trade.categoryLabel}
                    </span>
                    <h3 className="font-extrabold text-sm sm:text-base text-[#17365D] leading-snug">
                      {trade.title}
                    </h3>
                    <div className="text-xs text-[#5F6B76] font-medium flex items-center gap-1.5 pt-1 tabular-nums">
                      <Icon name="clock" size={13} className="text-[#287D73]" />
                      <span>अवधि: {trade.duration}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => go('training')}
                    className="w-full min-h-[44px] py-2.5 rounded-xl bg-[#F7F9FC] hover:bg-[#17365D] hover:text-white border border-[#DCE3EA] text-[#17365D] font-bold text-xs transition-colors flex items-center justify-center gap-1.5 mt-auto"
                  >
                    <Icon name="cap" size={14} />
                    <span>प्रशिक्षण केंद्र विवरण</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
