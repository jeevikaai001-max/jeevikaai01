import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { ShowcaseProduct, AppView } from '../types';
import { mediaStorageService } from '../services/cloudinaryService';

interface LocalBusinessShowcaseProps {
  onNotify: (msg: string) => void;
  go: (view: AppView | string) => void;
  userPhone?: string;
  userName?: string;
  userLocation?: string;
}

export const LocalBusinessShowcase: React.FC<LocalBusinessShowcaseProps> = ({
  go,
}) => {
  const [products, setProducts] = useState<ShowcaseProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    const unsubscribe = mediaStorageService.subscribeShowcaseProducts((data) => {
      if (!isMounted) return;
      setProducts(data || []);
      setLoading(false);
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <section className="py-12 bg-[#F7F9FC] border-b border-[#DCE3EA]" id="local-showcase">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#287D73] uppercase tracking-wider mb-1.5">
              <Icon name="store" size={14} />
              <span>ग्रामीण उत्पाद प्रदर्शनी · Local Business Showcase</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#17365D] tracking-tight font-['Bricolage_Grotesque']">
              स्थानीय स्वरोजगार व हस्तशिल्प बाज़ार
            </h2>
            <p className="text-sm text-[#5F6B76] max-w-xl mt-1">
              ग्रामीण हुनरमंद, स्वयं सहायता समूह एवं महिला उद्यमी अपने उत्पादों की तस्वीरें यहाँ सीधे अपलोड कर सकते हैं।
            </p>
          </div>

          <button
            type="button"
            onClick={() => go('business-upload')}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white font-bold text-sm transition-colors flex-shrink-0"
          >
            <Icon name="plus" size={16} />
            <span>अपना उत्पाद जोड़ें</span>
          </button>
        </div>

        {/* Product Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-white border border-[#DCE3EA] flex items-center justify-center text-xs text-[#5F6B76]"
              >
                <span className="w-5 h-5 border-2 border-[#287D73] border-t-transparent rounded-full animate-spin mr-2" />
                <span>लोड हो रहा है...</span>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white border border-dashed border-[#C5D1DD] rounded-2xl p-8 sm:p-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#287D73]/10 text-[#287D73] mx-auto flex items-center justify-center">
              <Icon name="store" size={26} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-extrabold text-[#17365D]">
                कोई उत्पाद उपलब्ध नहीं है (No Showcase Items Yet)
              </h3>
              <p className="text-xs sm:text-sm text-[#5F6B76] max-w-md mx-auto">
                केवल एडमिन या पंजीकृत उद्यमियों द्वारा अपलोड किए गए असली उत्पाद ही यहाँ दिखाई देंगे। अपना उत्पाद जोड़ने के लिए नीचे दिए गए बटन पर क्लिक करें।
              </p>
            </div>
            <button
              type="button"
              onClick={() => go('business-upload')}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white font-bold text-xs transition-colors"
            >
              <Icon name="plus" size={15} />
              <span>पहला उत्पाद जोड़ें</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-[#DCE3EA] overflow-hidden hover:border-[#245A91] transition-colors flex flex-col group"
              >
                <div className="h-52 bg-[#F7F9FC] relative overflow-hidden border-b border-[#DCE3EA]">
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        '/src/assets/images/trade_agri_retail_1795513568658.jpg';
                    }}
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-[#17365D]/85 text-white">
                    {p.category}
                  </span>
                  {p.price && (
                    <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg text-xs font-extrabold tabular-nums bg-[#17365D] text-white border border-white/20">
                      {p.price}
                    </span>
                  )}
                </div>

                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-extrabold text-base text-[#17365D] leading-snug line-clamp-1">
                      {p.title}
                    </h3>
                    <p className="text-xs text-[#5F6B76] mt-1.5 line-clamp-2 leading-relaxed">
                      {p.description || 'हस्तनिर्मित ग्रामीण उत्पाद।'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#DCE3EA] flex items-center justify-between text-xs text-[#5F6B76]">
                    <div className="min-w-0">
                      <div className="font-bold text-[#17365D] truncate">{p.artisanName}</div>
                      <div className="text-[11px] flex items-center gap-1 text-[#5F6B76] truncate">
                        <Icon name="pin" size={11} className="flex-none" />
                        <span className="truncate">{p.location}</span>
                      </div>
                    </div>
                    {p.contactPhone && (
                      <a
                        href={`tel:${p.contactPhone.replace(/\s+/g, '')}`}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#F7F9FC] border border-[#DCE3EA] hover:bg-[#287D73] hover:text-white hover:border-[#287D73] font-bold text-xs text-[#17365D] transition-colors flex items-center gap-1 flex-none"
                        title="संपर्क करें"
                      >
                        <Icon name="phone" size={12} />
                        <span>संपर्क</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
