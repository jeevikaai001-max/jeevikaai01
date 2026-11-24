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

  const hasPromptablePermissions = [
    permissions.notifications,
    permissions.microphone,
    permissions.geolocation,
  ].some((p) => p === 'prompt');

  return {
    permissions,
    allGranted,
    pendingCount,
    hasPromptablePermissions,
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

  const allItems: Array<{
    key: keyof AppPermissionsState;
    icon: string;
    label: string;
    status: PermissionStatus;
    onAllow: () => Promise<PermissionStatus>;
  }> = [
    {
      key: 'notifications',
      icon: 'bell',
      label: isEn ? 'Notifications' : 'नोटिफिकेशन',
      status: permissions.notifications,
      onAllow: onRequestNotification,
    },
    {
      key: 'microphone',
      icon: 'mic',
      label: isEn ? 'Microphone' : 'माइक्रोफ़ोन',
      status: permissions.microphone,
      onAllow: onRequestMicrophone,
    },
    {
      key: 'geolocation',
      icon: 'pin',
      label: isEn ? 'Location' : 'लोकेशन',
      status: permissions.geolocation,
      onAllow: onRequestGeolocation,
    },
  ];

  const promptableItems = allItems.filter((i) => i.status === 'prompt');
  if (promptableItems.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="permissions-modal-title"
    >
      <div className="bg-white w-full max-w-[330px] rounded-2xl border border-[#DCE3EA] shadow-2xl overflow-hidden">
        <div className="p-5 text-center space-y-4">
          <div className="w-11 h-11 mx-auto rounded-full bg-[#EBF3FB] text-[#245A91] flex items-center justify-center">
            <Icon name="shieldCheck" size={22} />
          </div>

          <h2
            id="permissions-modal-title"
            className="text-base font-extrabold text-[#17365D] leading-snug"
          >
            {isEn
              ? 'Allow JeevikaAI permissions?'
              : isBho
              ? 'JeevikaAI के अनुमति दीं?'
              : 'JeevikaAI को अनुमति दें?'}
          </h2>

          {/* Compact single-line permission list */}
          <div className="space-y-1.5 text-left">
            {promptableItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA]"
              >
                <div className="flex items-center gap-2.5">
                  <Icon name={item.icon} size={15} className="text-[#245A91]" />
                  <span className="text-xs font-bold text-[#17365D]">{item.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => item.onAllow()}
                  disabled={isRequestingKey !== null}
                  className="text-[11px] font-extrabold text-[#287D73] hover:underline disabled:opacity-50"
                >
                  {isRequestingKey === item.key ? '...' : isEn ? 'Allow' : 'Allow'}
                </button>
              </div>
            ))}
          </div>

          {/* Native-style action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[42px] px-3 py-2 rounded-xl border border-[#DCE3EA] bg-white hover:bg-[#F7F9FC] text-[#5F6B76] text-xs font-bold transition-colors"
            >
              {isEn ? "Don't allow" : 'अभी नहीं'}
            </button>
            <button
              type="button"
              onClick={async () => {
                await onRequestAll();
                onCancel();
              }}
              disabled={isRequestingKey !== null}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white text-xs font-extrabold transition-colors disabled:opacity-60"
            >
              {isRequestingKey
                ? '...'
                : isEn
                ? 'Allow'
                : 'अनुमति दें'}
            </button>
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
