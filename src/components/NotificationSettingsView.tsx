import React, { useState } from 'react';
import { Icon } from './Icons';
import { NotificationPreferences, BeneficiaryProfile } from '../types';
import { AppUser } from '../services/firebase';
import { pushNotificationService } from '../services/pushNotificationService';

interface NotificationSettingsViewProps {
  onNotify: (msg: string) => void;
  go: (route: string) => void;
  currentUser?: AppUser | null;
  profile?: BeneficiaryProfile | null;
  onOpenPermissions?: () => void;
}

export const NotificationSettingsView: React.FC<NotificationSettingsViewProps> = ({
  onNotify,
  go,
  currentUser,
  profile,
  onOpenPermissions,
}) => {
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => {
    try {
      const saved = localStorage.getItem('jeevika_notif_prefs');
      return saved
        ? JSON.parse(saved)
        : {
            smsAlerts: true,
            whatsappAlerts: false,
            pushNotifications: pushNotificationService.getPermission() === 'granted',
            newOpportunitiesAlert: true,
            roadmapReminders: true,
          };
    } catch {
      return {
        smsAlerts: true,
        whatsappAlerts: false,
        pushNotifications: pushNotificationService.getPermission() === 'granted',
        newOpportunitiesAlert: true,
        roadmapReminders: true,
      };
    }
  });

  const [permStatus, setPermStatus] = useState(() => pushNotificationService.getPermission());
  const [subscribing, setSubscribing] = useState(false);

  const toggle = async (key: keyof NotificationPreferences) => {
    const nextVal = !prefs[key];

    if (key === 'pushNotifications' && nextVal) {
      setSubscribing(true);
      try {
        const res = await pushNotificationService.requestAndSubscribePush({
          uid: currentUser?.uid,
          phone: profile?.phone || currentUser?.phone,
          name: profile?.name || currentUser?.displayName || undefined,
          location: profile?.location,
          askIfDefault: true,
        });
        setPermStatus(res.permission);
        if (res.permission !== 'granted') {
          onNotify(
            res.permission === 'denied'
              ? 'नोटिफिकेशन ब्राउज़र सेटिंग्स में ब्लॉक है। कृपया Site Settings में Allow करें।'
              : 'कृपया पुश नोटिफिकेशन की अनुमति दें।'
          );
          return;
        }
      } finally {
        setSubscribing(false);
      }
    }

    setPrefs((prev) => {
      const updated = { ...prev, [key]: nextVal };
      localStorage.setItem('jeevika_notif_prefs', JSON.stringify(updated));
      return updated;
    });
    onNotify(
      key === 'pushNotifications' && nextVal
        ? 'बैकग्राउंड PWA पुश नोटिफिकेशन सक्रिय हो गया!'
        : 'Notification preferences updated.'
    );
  };

  const handleTestNotification = async () => {
    if (pushNotificationService.getPermission() !== 'granted') {
      const res = await pushNotificationService.requestAndSubscribePush({
        uid: currentUser?.uid,
        phone: profile?.phone || currentUser?.phone,
        name: profile?.name || currentUser?.displayName || undefined,
        location: profile?.location,
        askIfDefault: true,
      });
      setPermStatus(res.permission);
      if (res.permission !== 'granted') {
        onNotify('कृपया पहले नोटिफिकेशन की अनुमति दें।');
        return;
      }
    }
    const ok = await pushNotificationService.displayOsNotification({
      title: 'JeevikaAI Push Active',
      body: 'बधाई हो! आपके डिवाइस पर बैकग्राउंड और लाइव नोटिफिकेशन सही तरीके से काम कर रहे हैं।',
      url: '/',
    });
    onNotify(ok ? 'टेस्ट नोटिफिकेशन भेज दिया गया!' : 'नोटिफिकेशन दिखाने में समस्या आई।');
  };

  const rows: { key: keyof NotificationPreferences; title: string; desc: string }[] = [
    {
      key: 'pushNotifications',
      title: 'PWA Background Web Push (वेब पुश नोटिफिकेशन)',
      desc: 'Receive instant device alerts from Admin CMS & livelihood updates even when the app is closed.',
    },
    {
      key: 'smsAlerts',
      title: 'SMS Alerts (एसएमएस सूचना)',
      desc: 'Receive text messages on your registered phone for new local vacancies.',
    },
    {
      key: 'whatsappAlerts',
      title: 'WhatsApp Updates (व्हाट्सएप अपडेट)',
      desc: 'Receive periodic training batch announcements and admin reminders via WhatsApp.',
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
      <div className="pb-6 border-b border-[#DCE3EA] mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#245A91] mb-1.5">
            <Icon name="bell" size={14} />
            <span>Alert Channels &amp; Device Permissions</span>
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
            Notification Preferences · सूचना सेटिंग्स
          </h1>
          <p className="text-sm text-[#5F6B76] mt-1">
            Manage background PWA push alerts, microphone, and GPS permissions for this device.
          </p>
        </div>

        {onOpenPermissions && (
          <button
            type="button"
            onClick={onOpenPermissions}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white text-xs font-extrabold flex items-center gap-1.5 flex-none"
          >
            <Icon name="shieldCheck" size={15} />
            <span>Manage All Permissions</span>
          </button>
        )}
      </div>

      <div className="bg-white border border-[#DCE3EA] rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Live Push Status Banner */}
        <div className="p-4 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                permStatus === 'granted' ? 'bg-[#287D73] text-white' : 'bg-[#FFF8EB] text-[#B45309] border border-[#FDE68A]'
              }`}
            >
              <Icon name="bell" size={18} />
            </span>
            <div>
              <div className="text-xs font-extrabold text-[#17365D]">
                Device Push Status:{' '}
                <span className={permStatus === 'granted' ? 'text-[#287D73]' : 'text-[#B45309]'}>
                  {permStatus === 'granted'
                    ? 'Active & Subscribed'
                    : permStatus === 'denied'
                    ? 'Blocked in Browser/App Settings'
                    : 'Not Yet Enabled'}
                </span>
              </div>
              <p className="text-[11px] text-[#5F6B76]">
                {permStatus === 'granted'
                  ? 'This device can receive All-Citizen and Specific-Citizen background push alerts.'
                  : 'Enable push notifications so Admin announcements reach your installed PWA or browser.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestNotification}
            disabled={subscribing}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#245A91] text-[#245A91] hover:bg-[#245A91] hover:text-white text-xs font-extrabold transition-colors disabled:opacity-60"
          >
            {permStatus === 'granted' ? 'Send Test Push' : 'Enable Push Now'}
          </button>
        </div>

        <div className="space-y-3.5">
          {rows.map((item) => {
            const active =
              item.key === 'pushNotifications'
                ? Boolean(prefs[item.key] && permStatus === 'granted')
                : Boolean(prefs[item.key]);
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
                  disabled={subscribing && item.key === 'pushNotifications'}
                  onClick={() => toggle(item.key)}
                  className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-60 ${
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
          <span className="text-xs text-[#5F6B76]">Preferences and push subscription are synced for this device.</span>
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
