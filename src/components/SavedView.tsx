import React from 'react';
import { Icon } from './Icons';
import { Opportunity } from '../types';
import { JOBS } from '../data/mockData';

interface SavedViewProps {
  shortlist: Record<string, boolean>;
  onShortlistToggle: (id: string) => void;
  onSelectDetail: (opp: Opportunity) => void;
  go: (route: string) => void;
}

export const SavedView: React.FC<SavedViewProps> = ({
  shortlist,
  onShortlistToggle,
  onSelectDetail,
  go,
}) => {
  const savedOpportunities = JOBS.filter((j) => Boolean(shortlist[j.id]));

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#DCE3EA] mb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#D9822B] mb-1.5">
            <Icon name="star" size={14} className="fill-[#D9822B]" />
            <span>Personal Bookmarks</span>
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
            Saved Opportunities &amp; Pathways · सहेजे गए अवसर
          </h1>
        </div>

        <button
          onClick={() => go('opportunities')}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#DCE3EA] bg-white text-[#17365D] text-xs font-bold hover:bg-[#F7F9FC] transition-colors"
        >
          <Icon name="search" size={14} />
          <span>Explore More Opportunities</span>
        </button>
      </div>

      {savedOpportunities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {savedOpportunities.map((opp) => (
            <div
              key={opp.id}
              className="bg-white border border-[#DCE3EA] rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-[#245A91] transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                      opp.type === 'Job'
                        ? 'bg-[#F7F9FC] text-[#245A91] border-[#DCE3EA]'
                        : opp.type === 'Training'
                        ? 'bg-[#287D73]/10 text-[#287D73] border-[#287D73]/25'
                        : 'bg-[#FFF8EB] text-[#B45309] border-[#FDE68A]'
                    }`}
                  >
                    {opp.type}
                  </span>
                  <button
                    onClick={() => onShortlistToggle(opp.id)}
                    className="min-h-[36px] px-2 text-xs text-[#9E2A2B] font-semibold hover:underline flex items-center gap-1"
                  >
                    <Icon name="x" size={12} />
                    <span>Remove</span>
                  </button>
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
                    <span>{opp.loc} ({opp.km} km away)</span>
                  </div>
                  <div className="text-[#287D73] font-bold tabular-nums">
                    {opp.pay}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#DCE3EA] flex items-center justify-between">
                <button
                  onClick={() => onSelectDetail(opp)}
                  className="min-h-[44px] inline-flex items-center gap-1 text-xs font-bold text-[#245A91] hover:underline"
                >
                  <span>View Details &amp; Application Criteria</span>
                  <Icon name="arrowR" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-[#DCE3EA] rounded-2xl p-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#F7F9FC] border border-[#DCE3EA] text-[#5F6B76] flex items-center justify-center mx-auto">
            <Icon name="star" size={28} />
          </div>
          <h3 className="text-lg font-bold text-[#17365D]">No opportunities saved yet</h3>
          <p className="text-xs text-[#5F6B76] max-w-sm mx-auto leading-relaxed">
            While exploring jobs, self-employment ideas, or training programs, tap the "Shortlist" button to save them here for quick review.
          </p>
          <button
            onClick={() => go('opportunities')}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white text-xs font-bold transition-colors"
          >
            Browse Opportunities
          </button>
        </div>
      )}
    </main>
  );
};
