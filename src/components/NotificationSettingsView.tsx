import React, { useState } from 'react';
import { Icon } from './Icons';
import { NotificationPreferences } from '../types';

interface NotificationSettingsViewProps {
  onNotify: (msg: string) => void;
  go: (route: string) => void;
}

export const NotificationSettingsView: React.FC<NotificationSettingsViewProps> = ({
  onNotify,
  go,
}) => {
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => {
    try {
      const saved = localStorage.getItem('jeevika_notif_prefs');
      return saved
        ? JSON.parse(saved)
        : {
            smsAlerts: true,
            whatsappAlerts: false,
            pushNotifications: true,
            newOpportunitiesAlert: true,
            roadmapReminders: true,
          };
    } catch {
      return {
        smsAlerts: true,
        whatsappAlerts: false,
        pushNotifications: true,
        newOpportunitiesAlert: true,
        roadmapReminders: true,
      };
    }
  });

  const toggle = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('jeevika_notif_prefs', JSON.stringify(updated));
      return updated;
    });
    onNotify('Notification preferences updated.');
  };

  const rows: { key: keyof NotificationPreferences; title: string; desc: string }[] = [
    {
      key: 'smsAlerts',
      title: 'SMS Alerts (एसएमएस सूचना)',
      desc: 'Receive text messages on your registered phone for new local vacancies.',
    },
    {
      key: 'whatsappAlerts',
      title: 'WhatsApp Updates (व्हाट्सएप अपडेट)',
      desc: 'Receive periodic training batch announcements via WhatsApp Business API.',
    },
    {
      key: 'pushNotifications',
      title: 'PWA Web Push (वेब पुश नोटिफिकेशन)',
      desc: 'Receive instant device notifications when your roadmap has recommended updates.',
    },
    {
      key: 'roadmapReminders',
      title: 'Learning Roadmap Reminders',
      desc: 'Gentle weekly check-in prompts to help you finish your learning stages.',
    },
  ];

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="pb-6 border-b border-[#DCE3EA] mb-6">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#245A91] mb-1.5">
          <Icon name="phone" size={14} />
          <span>Alert Channels &amp; Reminders</span>
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
          Notification Preferences · सूचना सेटिंग्स
        </h1>
        <p className="text-sm text-[#5F6B76] mt-1">
          Choose how you receive alerts about new vocational training batches and local openings.
        </p>
      </div>

      <div className="bg-white border border-[#DCE3EA] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="space-y-3.5">
          {rows.map((item) => {
            const active = Boolean(prefs[item.key]);
            return (
              <div
                key={item.key}
                className="flex items-center justify-between gap-4 p-4 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA]"
              >
                <div>
                  <div className="text-sm font-bold text-[#17365D]">{item.title}</div>
                  <p className="text-xs text-[#5F6B76] mt-0.5">{item.desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  aria-label={item.title}
                  onClick={() => toggle(item.key)}
                  className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${
                    active ? 'bg-[#287D73]' : 'bg-[#CBD5E1]'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all ${
                      active ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-[#DCE3EA] flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[#5F6B76]">Preferences are saved to this device.</span>
          <button
            onClick={() => go('dashboard')}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white text-xs font-bold transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </main>
  );
};
