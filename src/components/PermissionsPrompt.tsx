import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from './Icons';
import { SupportedLanguage } from '../types';
import { pushNotificationService } from '../services/pushNotificationService';
import { locationIntelligenceService, LocationDetectionResult } from '../services/locationIntelligenceService';

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface AppPermissionsState {
  notifications: PermissionStatus;
  microphone: PermissionStatus;
  geolocation: PermissionStatus;
}

const PERM_CACHE_KEY = 'jeevika_perm_hints_v1';
const PWA_CANCEL_SESSION_KEY = 'jeevika_pwa_perm_cancelled_session';
const WEB_BANNER_DISMISSED_KEY = 'jeevika_web_perm_banner_dismissed_session';

function readStoredHints(): Partial<AppPermissionsState> {
  try {
    const raw = localStorage.getItem(PERM_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredHint(key: keyof AppPermissionsState, val: PermissionStatus) {
  try {
    const prev = readStoredHints();
    localStorage.setItem(PERM_CACHE_KEY, JSON.stringify({ ...prev, [key]: val }));
  } catch {}
}

async function queryBrowserPermission(name: 'microphone' | 'geolocation'): Promise<PermissionStatus | null> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return null;
  try {
    const status = await navigator.permissions.query({ name: name as PermissionName });
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state;
    }
    return null;
  } catch {
    return null;
  }
}

export function useAppPermissions(options: {
  uid?: string;
  phone?: string;
  name?: string;
  location?: string;
  onLocationDetected?: (res: LocationDetectionResult) => void;
}) {
  const [permissions, setPermissions] = useState<AppPermissionsState>(() => {
    const hints = readStoredHints();
    const notifPerm: PermissionStatus =
      typeof window === 'undefined' || !('Notification' in window)
        ? 'unsupported'
        : Notification.permission === 'default'
        ? 'prompt'
        : Notification.permission;
    const micPerm: PermissionStatus =
      typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia
        ? 'unsupported'
        : hints.microphone || 'prompt';
    const geoPerm: PermissionStatus =
      typeof navigator === 'undefined' || !navigator.geolocation
        ? 'unsupported'
        : hints.geolocation || 'prompt';

    return {
      notifications: notifPerm,
      microphone: micPerm,
      geolocation: geoPerm,
    };
  });

  const [isRequestingKey, setIsRequestingKey] = useState<'all' | keyof AppPermissionsState | null>(null);

  const refreshPermissions = useCallback(async () => {
    const notifPerm: PermissionStatus =
      typeof window === 'undefined' || !('Notification' in window)
        ? 'unsupported'
        : Notification.permission === 'default'
        ? 'prompt'
        : Notification.permission;

    const hints = readStoredHints();
    const [micQuery, geoQuery] = await Promise.all([
      queryBrowserPermission('microphone'),
      queryBrowserPermission('geolocation'),
    ]);

    const micPerm: PermissionStatus =
      typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia
        ? 'unsupported'
        : micQuery || hints.microphone || 'prompt';

    const geoPerm: PermissionStatus =
      typeof navigator === 'undefined' || !navigator.geolocation
        ? 'unsupported'
        : geoQuery || (locationIntelligenceService.hasLiveGpsCoordinates() ? 'granted' : hints.geolocation || 'prompt');

    setPermissions({
      notifications: notifPerm,
      microphone: micPerm,
      geolocation: geoPerm,
    });
  }, []);

  useEffect(() => {
    refreshPermissions();
    const onFocus = () => {
      refreshPermissions();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshPermissions]);

  const requestNotification = useCallback(async (): Promise<PermissionStatus> => {
    if (!pushNotificationService.isSupported()) return 'unsupported';
    setIsRequestingKey('notifications');
    try {
      const res = await pushNotificationService.requestAndSubscribePush({
        uid: options.uid,
        phone: options.phone,
        name: options.name,
        location: options.location,
        askIfDefault: true,
      });
      const mapped: PermissionStatus =
        res.permission === 'default' ? 'prompt' : (res.permission as PermissionStatus);
      saveStoredHint('notifications', mapped);
      setPermissions((prev) => ({ ...prev, notifications: mapped }));
      return mapped;
    } finally {
      setIsRequestingKey(null);
    }
  }, [options.uid, options.phone, options.name, options.location]);

  const requestMicrophone = useCallback(async (): Promise<PermissionStatus> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return 'unsupported';
    }
    setIsRequestingKey('microphone');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release hardware microphone immediately after securing permission
      stream.getTracks().forEach((t) => t.stop());
      saveStoredHint('microphone', 'granted');
      setPermissions((prev) => ({ ...prev, microphone: 'granted' }));
      return 'granted';
    } catch (err: any) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      const next: PermissionStatus = denied ? 'denied' : 'prompt';
      saveStoredHint('microphone', next);
      setPermissions((prev) => ({ ...prev, microphone: next }));
      return next;
    } finally {
      setIsRequestingKey(null);
    }
  }, []);

  const requestGeolocation = useCallback(async (): Promise<PermissionStatus> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return 'unsupported';
    }
    setIsRequestingKey('geolocation');
    try {
      const detected = await locationIntelligenceService.detectGpsLocation();
      saveStoredHint('geolocation', 'granted');
      setPermissions((prev) => ({ ...prev, geolocation: 'granted' }));
      options.onLocationDetected?.(detected);
      return 'granted';
    } catch (err: any) {
      const denied = err?.code === 1 || String(err?.message || '').toLowerCase().includes('denied');
      const next: PermissionStatus = denied ? 'denied' : 'prompt';
      saveStoredHint('geolocation', next);
      setPermissions((prev) => ({ ...prev, geolocation: next }));
      return next;
    } finally {
      setIsRequestingKey(null);
    }
  }, [options.onLocationDetected]);

  const requestAllPending = useCallback(async (): Promise<AppPermissionsState> => {
    setIsRequestingKey('all');
    const next: AppPermissionsState = { ...permissions };
    try {
      if (next.notifications === 'prompt') {
        next.notifications = await requestNotification();
      }
      if (next.microphone === 'prompt') {
        next.microphone = await requestMicrophone();
      }
      if (next.geolocation === 'prompt') {
        next.geolocation = await requestGeolocation();
      }
    } finally {
      setIsRequestingKey(null);
      await refreshPermissions();
    }
    return next;
  }, [permissions, requestNotification, requestMicrophone, requestGeolocation, refreshPermissions]);

  const allGranted =
    (permissions.notifications === 'granted' || permissions.notifications === 'unsupported') &&
    (permissions.microphone === 'granted' || permissions.microphone === 'unsupported') &&
    (permissions.geolocation === 'granted' || permissions.geolocation === 'unsupported');

  const pendingCount = [permissions.notifications, permissions.microphone, permissions.geolocation].filter(
    (p) => p === 'prompt' || p === 'denied'
  ).length;

  return {
    permissions,
    allGranted,
    pendingCount,
    isRequestingKey,
    refreshPermissions,
    requestNotification,
    requestMicrophone,
    requestGeolocation,
    requestAllPending,
  };
}

interface PermissionsPromptModalProps {
  isOpen: boolean;
  isStandalone: boolean;
  currentLang: SupportedLanguage;
  permissions: AppPermissionsState;
  isRequestingKey: 'all' | keyof AppPermissionsState | null;
  onRequestNotification: () => Promise<PermissionStatus>;
  onRequestMicrophone: () => Promise<PermissionStatus>;
  onRequestGeolocation: () => Promise<PermissionStatus>;
  onRequestAll: () => Promise<AppPermissionsState>;
  onCancel: () => void;
}

export const PermissionsPromptModal: React.FC<PermissionsPromptModalProps> = ({
  isOpen,
  isStandalone,
  currentLang,
  permissions,
  isRequestingKey,
  onRequestNotification,
  onRequestMicrophone,
  onRequestGeolocation,
  onRequestAll,
  onCancel,
}) => {
  if (!isOpen) return null;

  const isEn = currentLang === 'en';
  const isBho = currentLang === 'bho';

  const items: Array<{
    key: keyof AppPermissionsState;
    icon: string;
    title: string;
    desc: string;
    status: PermissionStatus;
    onAllow: () => Promise<PermissionStatus>;
  }> = [
    {
      key: 'notifications',
      icon: 'bell',
      title: isEn
        ? 'Push Notifications'
        : isBho
        ? 'पुश नोटिफिकेशन (सूचना)'
        : 'पुश नोटिफिकेशन (Push Alerts)',
      desc: isEn
        ? 'Get instant job openings, scheme alerts & admin reminders even when the app is closed.'
        : isBho
        ? 'नया नौकरी, सरकारी योजना अउर जरूरी सूचना तुरंत मोबाइल पर पाईं।'
        : 'नए रोजगार अवसर, सरकारी योजनाएं और जरूरी अलर्ट बैकग्राउंड में तुरंत पाएं।',
      status: permissions.notifications,
      onAllow: onRequestNotification,
    },
    {
      key: 'microphone',
      icon: 'mic',
      title: isEn
        ? 'Microphone (Voice Assistant)'
        : isBho
        ? 'माइक्रोफ़ोन (आवाज़ सहायक)'
        : 'माइक्रोफ़ोन (वॉइस असिस्टेंट)',
      desc: isEn
        ? 'Speak in Hindi, Bhojpuri, or English for voice profile setup and hands-free guidance.'
        : isBho
        ? 'हिंदी या भोजपुरी में बोलके आपन प्रोफ़ाइल बनाईं अउर मदद लीं।'
        : 'हिंदी, भोजपुरी या अंग्रेज़ी में बोलकर प्रोफ़ाइल भरें और वॉइस सहायक का उपयोग करें।',
      status: permissions.microphone,
      onAllow: onRequestMicrophone,
    },
    {
      key: 'geolocation',
      icon: 'pin',
      title: isEn
        ? 'GPS Location'
        : isBho
        ? 'जीपीएस लोकेशन (जगह)'
        : 'जीपीएस लोकेशन (GPS Location)',
      desc: isEn
        ? 'Find verified jobs, training centers, and government schemes in your exact area.'
        : isBho
        ? 'रउआ इलाका के सटीक नौकरी, ट्रेनिंग केंद्र अउर योजना खोजे खातिर।'
        : 'आपके सटीक क्षेत्र के नज़दीकी रोजगार, प्रशिक्षण केंद्र और योजनाएं खोजने के लिए।',
      status: permissions.geolocation,
      onAllow: onRequestGeolocation,
    },
  ];

  const anyBlocked = items.some((i) => i.status === 'denied');
  const allDone = items.every((i) => i.status === 'granted' || i.status === 'unsupported');

  const statusBadge = (st: PermissionStatus) => {
    if (st === 'granted') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E9F7F4] text-[#1E6058] border border-[#287D73]/25 text-[11px] font-extrabold">
          <Icon name="check" size={12} />
          {isEn ? 'Allowed' : 'अनुमति मिली'}
        </span>
      );
    }
    if (st === 'denied') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FEF2F2] text-[#9E2A2B] border border-[#9E2A2B]/25 text-[11px] font-extrabold">
          {isEn ? 'Blocked' : 'ब्लॉक है'}
        </span>
      );
    }
    if (st === 'unsupported') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-bold">
          {isEn ? 'Unavailable' : 'उपलब्ध नहीं'}
        </span>
      );
    }
    return null;
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-[#17365D]/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="permissions-modal-title"
    >
      <div className="bg-white w-full max-w-lg rounded-2xl border border-[#DCE3EA] shadow-2xl overflow-hidden">
        <div className="gov-tricolor-line" />
        <div className="p-5 sm:p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#17365D] text-white flex items-center justify-center flex-none">
                <Icon name="shieldCheck" size={22} className="text-[#F4B966]" />
              </div>
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#287D73]">
                  {isStandalone
                    ? isEn
                      ? 'JeevikaAI App Setup'
                      : 'JeevikaAI ऐप सेटअप'
                    : isEn
                    ? 'Required App Permissions'
                    : 'आवश्यक ऐप अनुमतियाँ'}
                </div>
                <h2
                  id="permissions-modal-title"
                  className="text-lg sm:text-xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque'] leading-snug"
                >
                  {isEn
                    ? 'Enable Notifications, Mic & Location'
                    : isBho
                    ? 'सूचना, माइक अउर लोकेशन के अनुमति दीं'
                    : 'नोटिफिकेशन, माइक और लोकेशन की अनुमति दें'}
                </h2>
                <p className="text-xs text-[#5F6B76] mt-0.5">
                  {isEn
                    ? 'Allow these permissions so voice guidance, background alerts, and local GPS jobs work smoothly.'
                    : 'वॉइस असिस्टेंट, बैकग्राउंड नोटिफिकेशन और सटीक GPS अवसरों के लिए ये अनुमतियाँ चालू करें।'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close permissions dialog"
              className="w-9 h-9 rounded-lg border border-[#DCE3EA] text-[#5F6B76] hover:bg-[#F7F9FC] flex items-center justify-center flex-none"
            >
              ✕
            </button>
          </div>

          {/* Permission Cards */}
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.key}
                className="p-3.5 rounded-xl border border-[#DCE3EA] bg-[#F7F9FC] flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none ${
                      item.status === 'granted'
                        ? 'bg-[#287D73] text-white'
                        : 'bg-white border border-[#DCE3EA] text-[#245A91]'
                    }`}
                  >
                    <Icon name={item.icon} size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-[#17365D] leading-tight">{item.title}</div>
                    <p className="text-xs text-[#5F6B76] mt-0.5 leading-snug">{item.desc}</p>
                  </div>
                </div>

                <div className="flex-none">
                  {item.status === 'prompt' ? (
                    <button
                      type="button"
                      onClick={() => item.onAllow()}
                      disabled={isRequestingKey !== null}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white text-xs font-extrabold transition-colors disabled:opacity-60"
                    >
                      {isRequestingKey === item.key || isRequestingKey === 'all'
                        ? '...'
                        : isEn
                        ? 'Allow'
                        : 'अनुमति दें'}
                    </button>
                  ) : (
                    statusBadge(item.status)
                  )}
                </div>
              </div>
            ))}
          </div>

          {anyBlocked && (
            <div className="p-3 rounded-xl bg-[#FFF8EB] border border-[#D9822B]/35 text-[11px] text-[#7C4A03] leading-relaxed">
              {isEn
                ? 'One or more permissions were blocked earlier. Open your browser/app Site Settings (lock icon in the address bar or Android App Info → Permissions) to enable them.'
                : 'कुछ अनुमतियाँ ब्राउज़र/फोन सेटिंग्स में ब्लॉक हैं। इन्हें चालू करने के लिए ब्राउज़र के लॉक आइकन (Site Settings) या फोन की App Settings → Permissions में जाकर Allow करें।'}
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#DCE3EA] bg-white hover:bg-[#F7F9FC] text-[#5F6B76] text-xs font-bold transition-colors order-2 sm:order-1"
            >
              {allDone
                ? isEn
                  ? 'Continue to App'
                  : 'ऐप पर आगे बढ़ें'
                : isEn
                ? 'Cancel / Later'
                : 'अभी नहीं (रद्द करें)'}
            </button>

            {!allDone && (
              <button
                type="button"
                onClick={async () => {
                  const res = await onRequestAll();
                  const finished =
                    (res.notifications === 'granted' || res.notifications === 'unsupported') &&
                    (res.microphone === 'granted' || res.microphone === 'unsupported') &&
                    (res.geolocation === 'granted' || res.geolocation === 'unsupported');
                  if (finished) {
                    onCancel();
                  }
                }}
                disabled={isRequestingKey !== null}
                className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 order-1 sm:order-2"
              >
                <Icon
                  name={isRequestingKey ? 'refresh' : 'check'}
                  size={16}
                  className={isRequestingKey ? 'animate-spin' : ''}
                />
                <span>
                  {isRequestingKey
                    ? isEn
                      ? 'Requesting Permissions...'
                      : 'अनुमतियाँ मांगी जा रही हैं...'
                    : isEn
                    ? 'Allow All Permissions'
                    : 'सभी अनुमतियाँ दें (Allow All)'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface WebsitePermissionsBarProps {
  visible: boolean;
  currentLang: SupportedLanguage;
  pendingCount: number;
  onOpenModal: () => void;
  onDismiss: () => void;
}

export const WebsitePermissionsBar: React.FC<WebsitePermissionsBarProps> = ({
  visible,
  currentLang,
  pendingCount,
  onOpenModal,
  onDismiss,
}) => {
  if (!visible || pendingCount <= 0) return null;
  const isEn = currentLang === 'en';

  return (
    <div className="bg-[#EEF5FC] border-b border-[#C9DDF2] px-3 sm:px-6 py-2.5">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-[#245A91] text-white flex items-center justify-center flex-none">
            <Icon name="bell" size={15} />
          </span>
          <div className="text-xs text-[#17365D] leading-snug">
            <span className="font-extrabold">
              {isEn ? 'Enable App Permissions:' : 'बेहतर अनुभव के लिए अनुमतियाँ चालू करें:'}
            </span>{' '}
            <span className="text-[#475569] font-medium">
              {isEn
                ? 'Allow Notifications, Microphone & GPS for live voice guidance and instant job alerts.'
                : 'नोटिफिकेशन, माइक्रोफ़ोन और GPS की अनुमति दें ताकि वॉइस असिस्टेंट और लाइव अलर्ट काम करें।'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-none">
          <button
            type="button"
            onClick={onOpenModal}
            className="min-h-[34px] px-3.5 py-1.5 rounded-lg bg-[#287D73] hover:bg-[#1E6058] text-white text-xs font-extrabold transition-colors"
          >
            {isEn ? 'Allow Permissions' : 'अनुमतियाँ दें'}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss permissions banner"
            className="min-h-[34px] px-2.5 py-1.5 rounded-lg border border-[#C9DDF2] bg-white text-[#5F6B76] hover:text-[#17365D] text-xs font-bold"
          >
            {isEn ? 'Later' : 'बाद में'}
          </button>
        </div>
      </div>
    </div>
  );
};

export { PWA_CANCEL_SESSION_KEY, WEB_BANNER_DISMISSED_KEY };
