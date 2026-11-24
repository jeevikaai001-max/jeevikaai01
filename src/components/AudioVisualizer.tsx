import React, { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
  statusText?: string;
  barCount?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isListening,
  isSpeaking,
  statusText,
  barCount = 24,
}) => {
  const [bars, setBars] = useState<number[]>(() => Array(barCount).fill(10));
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let phase = 0;
    let isCancelled = false;

    if (!isListening && !isSpeaking) {
      setBars(Array(barCount).fill(8));
      return;
    }

    const animateWave = () => {
      if (isCancelled) return;

      phase += isListening ? 0.12 : 0.08;

      const newBars = Array.from({ length: barCount }, (_, i) => {
        const centerOffset = Math.abs(i - barCount / 2) / (barCount / 2);
        const centerMultiplier = 1 - centerOffset * 0.45;

        let wave = 0;
        if (isListening) {
          wave = Math.sin(phase + i * 0.4) * 0.45 + Math.cos(phase * 1.5 + i * 0.25) * 0.35 + 0.5;
          return Math.max(12, Math.min(95, Math.round(wave * centerMultiplier * 75 + 12)));
        } else {
          wave = Math.sin(phase + i * 0.3) * 0.5 + 0.5;
          return Math.max(10, Math.min(70, Math.round(wave * centerMultiplier * 50 + 10)));
        }
      });

      setBars(newBars);
      animationFrameRef.current = requestAnimationFrame(animateWave);
    };

    animationFrameRef.current = requestAnimationFrame(animateWave);

    return () => {
      isCancelled = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isListening, isSpeaking, barCount]);

  return (
    <div className="w-full bg-[#F7F9FC] border border-[#DCE3EA] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3 text-xs">
        <div className="flex items-center gap-2">
          {isListening ? (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#245A91] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#245A91]" />
            </span>
          ) : isSpeaking ? (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#287D73] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#287D73]" />
            </span>
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#5F6B76]/50" />
          )}

          <span className="font-bold text-[#17365D] tracking-wide uppercase text-[11px]">
            {isListening
              ? 'VOICE DETECTED · आवाज़ पहचानी जा रही है'
              : isSpeaking
              ? 'Assistant Speaking · सहायक बोल रहा है'
              : 'Microphone Standby · माइक तैयार है'}
          </span>
        </div>

        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
            isListening
              ? 'bg-white text-[#245A91] border-[#245A91]/30'
              : isSpeaking
              ? 'bg-[#E9F4F2] text-[#287D73] border-[#287D73]/30'
              : 'bg-white text-[#5F6B76] border-[#DCE3EA]'
          }`}
        >
          {isListening ? 'LIVE AUDIO' : isSpeaking ? 'VOICE OUT' : 'READY'}
        </span>
      </div>

      <div className="relative h-16 w-full flex items-end justify-center gap-1 px-2 py-1 bg-white rounded-xl border border-[#DCE3EA] overflow-hidden">
        <div className="absolute inset-x-0 bottom-2 h-[1px] bg-[#DCE3EA] pointer-events-none" />

        {bars.map((height, idx) => {
          const isHighPeak = height > 60;
          const isMidPeak = height > 35;

          return (
            <div
              key={idx}
              style={{ height: `${height}%` }}
              className={`w-1.5 sm:w-2 rounded-t-sm transition-all duration-75 flex-shrink-0 ${
                isListening
                  ? isHighPeak
                    ? 'bg-[#17365D]'
                    : isMidPeak
                    ? 'bg-[#245A91]'
                    : 'bg-[#6B90B5]'
                  : isSpeaking
                  ? isHighPeak
                    ? 'bg-[#1D5E56]'
                    : isMidPeak
                    ? 'bg-[#287D73]'
                    : 'bg-[#76ACA4]'
                  : 'bg-[#DCE3EA]'
              }`}
            />
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-[#5F6B76]">
        <span>
          {statusText || (isListening ? 'Speak naturally into your device microphone' : 'Tap microphone to speak')}
        </span>
        <span className="font-medium text-[#245A91] text-[10px]">
          {isListening ? 'Auto end-of-speech active' : ''}
        </span>
      </div>
    </div>
  );
};
