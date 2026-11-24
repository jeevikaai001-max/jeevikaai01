import React from 'react';
import { Icon } from './Icons';
import { BeneficiaryProfile } from '../types';

interface HistoryViewProps {
  currentProfile: BeneficiaryProfile;
  go: (route: string) => void;
  onRestoreProfile: (profile: BeneficiaryProfile) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  currentProfile,
  go,
  onRestoreProfile,
}) => {
  const historyRecords = [
    {
      id: 'hist_curr',
      date: 'Current Session (Active)',
      name: currentProfile.name,
      education: currentProfile.education,
      location: currentProfile.location,
      topPathway: 'Digital Services (NSQF Level 3)',
      score: 92,
      isCurrent: true,
      snapshot: currentProfile,
    },
    {
      id: 'hist_demo',
      date: 'Baseline Sample (Sunita Devi)',
      name: 'Sunita Devi',
      education: '10th pass (Secondary)',
      location: 'Maharajganj, Uttar Pradesh',
      topPathway: 'Digital Services (NSQF Level 3)',
      score: 92,
      isCurrent: false,
      snapshot: {
        name: 'Sunita Devi',
        education: '10th pass (Secondary)',
        skills: 'Basic communication, Hindi typing, mobile phone use',
        interests: 'Digital services, computers, mobile apps',
        occupation: 'Homemaker, helps at a family shop',
        location: 'Maharajganj, Uttar Pradesh',
        workType: 'Job',
        mobility: 'Nearby only (within ~10 km)',
        isDemo: true,
      },
    },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#DCE3EA] mb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#245A91] mb-1.5">
            <Icon name="clock" size={14} />
            <span>Session Logs &amp; Previous Assessments</span>
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
            Assessment History · पूर्व संवाद इतिहास
          </h1>
          <p className="text-sm text-[#5F6B76] mt-1">
            Review past voice assessments, evaluate profile updates, and restore earlier evaluations.
          </p>
        </div>

        <button
          onClick={() => go('assessment')}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#245A91] text-white text-xs font-bold hover:bg-[#17365D] transition-colors"
        >
          <Icon name="mic" size={16} />
          <span>Start New Voice Assessment</span>
        </button>
      </div>

      {/* History List */}
      <div className="space-y-4">
        {historyRecords.map((rec) => (
          <div
            key={rec.id}
            className="bg-white border border-[#DCE3EA] rounded-2xl p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#DCE3EA]">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-[#17365D]">{rec.name}</h3>
                  {rec.isCurrent && (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-[#287D73]/10 text-[#287D73] border border-[#287D73]/25">
                      Active Profile
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#5F6B76] mt-0.5">{rec.date}</div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-[#5F6B76]">Match Score: </span>
                <span className="text-base font-extrabold text-[#287D73] tabular-nums">{rec.score}%</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-1 text-xs">
              <div>
                <span className="text-[11px] font-bold text-[#5F6B76] uppercase">Top Match</span>
                <div className="font-semibold text-[#17365D] mt-0.5">{rec.topPathway}</div>
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#5F6B76] uppercase">Education Recorded</span>
                <div className="font-semibold text-[#17365D] mt-0.5">{rec.education}</div>
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#5F6B76] uppercase">Skills Recorded</span>
                <div className="font-semibold text-[#17365D] mt-0.5 truncate">{rec.snapshot.skills}</div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#DCE3EA] flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => go('dashboard')}
                className="min-h-[44px] inline-flex items-center gap-1 text-xs font-bold text-[#245A91] hover:underline"
              >
                <span>View Roadmap for this session</span>
                <Icon name="arrowR" size={13} />
              </button>

              {!rec.isCurrent && (
                <button
                  onClick={() => onRestoreProfile(rec.snapshot)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DCE3EA] text-xs font-bold text-[#17365D] hover:bg-[#F7F9FC] transition-colors"
                >
                  Restore as Active Profile
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
};
