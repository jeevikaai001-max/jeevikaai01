import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icons';
import { HeroSlide, AppView } from '../types';
import {
  mediaStorageService,
  buildHeroSlidesFromMedia,
} from '../services/cloudinaryService';

interface HeroCarouselProps {
  go: (view: AppView) => void;
}

const KNOWN_VIEWS: Set<string> = new Set([
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

function resolveInternalView(ctaUrl?: string): AppView | null {
  if (!ctaUrl) return null;
  const trimmed = ctaUrl.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return null;
  const normalized = trimmed.replace(/^[/#]+/, '').toLowerCase();
  return KNOWN_VIEWS.has(normalized) ? (normalized as AppView) : null;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ go }) => {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firstSlideIdRef = useRef<string>('');

  useEffect(() => {
    let isMounted = true;

    const applySlides = (nextSlides: HeroSlide[]) => {
      if (!isMounted) return;
      const valid = (nextSlides || []).filter((s) => Boolean(s && s.imageUrl && s.imageUrl.trim()));
      setSlides(valid);
      const nextFirstId = valid[0]?.id || '';
      if (nextFirstId !== firstSlideIdRef.current) {
        firstSlideIdRef.current = nextFirstId;
        setCurrentIndex(0);
      }
    };

    mediaStorageService.getHeroSlides().then(applySlides);

    const unsubscribe = mediaStorageService.subscribeMediaAssets((assets) => {
      applySlides(buildHeroSlidesFromMedia(assets));
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (currentIndex >= slides.length && slides.length > 0) {
      setCurrentIndex(0);
    }
  }, [slides.length, currentIndex]);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 4800);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, slides.length]);

  const validSlides = (slides || []).filter((s) => Boolean(s && s.imageUrl && s.imageUrl.trim()));
  if (!validSlides.length) return null;

  const current = validSlides[currentIndex] || validSlides[0];
  if (!current) return null;

  const internalCtaView = resolveInternalView(current.ctaUrl);

  return (
    <section className="bg-[#17365D] border-b border-[#DCE3EA] py-3 sm:py-5">
      <div className="max-w-6xl mx-auto px-3 sm:px-6">
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-[#DCE3EA]/30 bg-[#0F233D] group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="ग्रामीण आजीविका एवं कौशल गैलरी"
    >
      <div className="relative h-[220px] sm:h-[290px] md:h-[330px] lg:h-[360px] w-full overflow-hidden bg-[#0F233D]">
        {validSlides.map((slide, idx) =>
          slide ? (
            <div
              key={slide.id || idx}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              <img
                src={slide.imageUrl}
                alt={slide.title || 'JeevikaAI Banner'}
                className="w-full h-full object-cover object-center"
                loading={idx === 0 ? 'eager' : 'lazy'}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1B30]/90 via-[#0B1B30]/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0B1B30]/65 via-transparent to-transparent hidden sm:block" />
            </div>
          ) : null
        )}

        {/* Top Category & Slide Counter */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#287D73] text-white border border-white/15 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F4B966]" />
            <span>{current?.tag || 'कौशल विकास'}</span>
          </span>
          <span className="px-2 py-1 rounded-lg text-[11px] font-mono font-semibold tabular-nums bg-black/50 text-white/90 border border-white/15">
            {currentIndex + 1} / {validSlides.length}
          </span>
        </div>

        {/* Slide Caption Bottom Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 z-20 text-white flex items-end justify-between gap-4">
          <div className="max-w-xl space-y-1">
            <h3 className="text-base sm:text-xl md:text-2xl font-extrabold text-white tracking-tight leading-snug font-['Bricolage_Grotesque']">
              {current?.title}
            </h3>
            {(() => {
              const cleanSub = (current.subtitle || '')
                .replace(/admin-uploaded/gi, '')
                .replace(/^banner\s*[•·]?\s*/gi, '')
                .replace(/[•·]\s*banner/gi, '')
                .replace(/^[•·\s]+|[•·\s]+$/g, '')
                .trim();
              const displaySub = cleanSub || 'जीविका प्रमाणित अवसर';
              return displaySub && !displaySub.startsWith('#') ? (
                <p className="text-xs sm:text-sm text-white/90 font-medium line-clamp-1 sm:line-clamp-2">
                  {displaySub}
                </p>
              ) : null;
            })()}
          </div>

          {internalCtaView ? (
            <button
              type="button"
              onClick={() => go(internalCtaView)}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-[#F7F9FC] text-[#17365D] text-xs font-extrabold border border-[#DCE3EA] transition-colors flex-shrink-0 mb-1"
            >
              <span>{current.ctaLabel || 'अवसर देखें'}</span>
              <Icon name="arrowR" size={13} />
            </button>
          ) : current.ctaUrl ? (
            <a
              href={current.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-[#F7F9FC] text-[#17365D] text-xs font-extrabold border border-[#DCE3EA] transition-colors flex-shrink-0 mb-1"
            >
              <span>{current.ctaLabel || 'अवसर देखें'}</span>
              <Icon name="arrowR" size={13} />
            </a>
          ) : current.linkView ? (
            <button
              type="button"
              onClick={() => go(current.linkView!)}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-[#F7F9FC] text-[#17365D] text-xs font-extrabold border border-[#DCE3EA] transition-colors flex-shrink-0 mb-1"
            >
              <span>{current.ctaLabel || 'अवसर देखें'}</span>
              <Icon name="arrowR" size={13} />
            </button>
          ) : null}
        </div>

        {/* Carousel Navigation Arrows */}
        {validSlides.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous slide"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-xl bg-[#0B1B30]/60 hover:bg-[#0B1B30]/85 text-white border border-white/20 flex items-center justify-center transition-colors opacity-85 group-hover:opacity-100"
            >
              <Icon name="arrowL" size={16} />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next slide"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-xl bg-[#0B1B30]/60 hover:bg-[#0B1B30]/85 text-white border border-white/20 flex items-center justify-center transition-colors opacity-85 group-hover:opacity-100"
            >
              <Icon name="arrowR" size={16} />
            </button>
          </>
        )}

        {/* Indicators Bar */}
        {validSlides.length > 1 && (
          <div className="absolute bottom-3 right-4 sm:right-6 z-30 flex items-center gap-1.5">
            {validSlides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentIndex ? 'w-6 bg-[#F4B966]' : 'w-2 bg-white/45 hover:bg-white/75'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
      </div>
    </section>
  );
};
