import {
  notificationService,
  normalizePhone,
  PushNotificationRecord,
  PushSubscriptionDoc,
} from './firebase';

const SEEN_NOTIFS_KEY = 'jeevika_seen_notifications_v1';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function makeSubId(endpoint: string): string {
  try {
    const clean = window.btoa(endpoint).replace(/[^a-zA-Z0-9]/g, '');
    return `sub_${clean.slice(-36)}`;
  } catch {
    return `sub_${endpoint.replace(/[^a-zA-Z0-9]/g, '').slice(-36)}`;
  }
}

function loadSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_NOTIFS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<string>) {
  try {
    localStorage.setItem(SEEN_NOTIFS_KEY, JSON.stringify(Array.from(ids).slice(-100)));
  } catch {}
}

export const pushNotificationService = {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  },

  isPushManagerSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  },

  getPermission(): NotificationPermissionState {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  },

  async ensureServiceWorkerReady(timeoutMs = 5000): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
    try {
      let reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }
      const ready = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<ServiceWorkerRegistration | null>((resolve) => setTimeout(() => resolve(reg || null), timeoutMs)),
      ]);
      return ready || reg || null;
    } catch {
      return null;
    }
  },

  /**
   * Displays an OS-level notification reliably in BOTH installed PWAs (Android/iOS/Desktop)
   * and standard desktop browsers by preferring ServiceWorkerRegistration.showNotification().
   */
  async displayOsNotification(input: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
  }): Promise<boolean> {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return false;
    }

    const title = String(input.title || 'JeevikaAI Update');
    const body = String(input.body || '');
    const tag = input.tag || `jeevika-${Date.now()}`;
    const url = input.url || '/';

    try {
      const reg = await this.ensureServiceWorkerReady(3500);
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: '/icons/icon-192.svg',
          badge: '/icons/icon-192.svg',
          tag,
          data: { url },
        });
        return true;
      }
    } catch {
      // Fall through to direct Notification API
    }

    try {
      new Notification(title, {
        body,
        icon: '/icons/icon-192.svg',
        tag,
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Requests Notification permission (if needed), subscribes the device's PushManager
   * using the server's VAPID public key, and persists the subscription to BOTH backend
   * and Firestore /push_subscriptions so background PWA pushes work even when closed.
   */
  async requestAndSubscribePush(citizen?: {
    uid?: string;
    phone?: string;
    name?: string;
    location?: string;
    askIfDefault?: boolean;
  }): Promise<{ permission: NotificationPermissionState; subscribed: boolean; error?: string }> {
    if (!this.isSupported()) {
      return { permission: 'unsupported', subscribed: false, error: 'Notifications not supported on this device.' };
    }

    let permission = Notification.permission;
    if (permission === 'default' && citizen?.askIfDefault !== false) {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = Notification.permission;
      }
    }

    if (permission !== 'granted') {
      return { permission, subscribed: false };
    }

    if (!this.isPushManagerSupported()) {
      return { permission, subscribed: false };
    }

    try {
      const reg = await this.ensureServiceWorkerReady(5000);
      if (!reg || !reg.pushManager) {
        return { permission, subscribed: false };
      }

      const keyRes = await fetch('/api/push/vapid-public-key', {
        headers: { Accept: 'application/json' },
      });
      const contentType = keyRes.headers.get('content-type') || '';
      if (!keyRes.ok || !contentType.includes('application/json')) {
        // Static hosting (e.g. Cloudflare Pages SPA fallback returning index.html)
        // does not serve Express /api/push/* endpoints; gracefully skip VAPID subscription.
        return { permission, subscribed: false };
      }
      const keyJson = await keyRes.json();
      const vapidPublicKey = String(keyJson?.publicKey || '').trim();
      if (!vapidPublicKey) {
        return { permission, subscribed: false };
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      }

      const subJson = sub.toJSON() as any;
      if (!subJson?.endpoint || !subJson?.keys?.p256dh || !subJson?.keys?.auth) {
        return { permission, subscribed: false };
      }

      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

      const docData: PushSubscriptionDoc = {
        id: makeSubId(subJson.endpoint),
        endpoint: subJson.endpoint,
        subscription: {
          endpoint: subJson.endpoint,
          expirationTime: subJson.expirationTime ?? null,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
        },
        uid: citizen?.uid || undefined,
        phone: citizen?.phone ? normalizePhone(citizen.phone) || undefined : undefined,
        name: citizen?.name || undefined,
        location: citizen?.location || undefined,
        isStandalone,
        updatedAt: new Date().toISOString(),
      };

      // Persist to the backend Web Push registry
      await notificationService.savePushSubscription(docData);

      return { permission, subscribed: true };
    } catch (err: any) {
      console.warn('Web Push subscription notice:', err?.message || err);
      return { permission, subscribed: false, error: err?.message };
    }
  },

  /**
   * Starts a real-time Firestore notification listener for the active citizen.
   * Immediately delivers matching 'all' or 'specific' notifications via OS push + in-app toast.
   */
  startCitizenNotificationListener(options: {
    uid?: string;
    phone?: string;
    onIncomingAlert?: (notif: PushNotificationRecord) => void;
  }): () => void {
    const startedAt = Date.now();
    const myUid = (options.uid || '').trim();
    const myPhone = normalizePhone(options.phone || '');
    const seen = loadSeenIds();

    return notificationService.subscribeNotifications((items) => {
      let seenChanged = false;
      for (const item of items) {
        if (!item?.id || seen.has(item.id)) continue;

        const isRecipient =
          item.target === 'all' ||
          (item.target === 'specific' &&
            ((Boolean(myUid) && item.targetUserId === myUid) ||
              (Boolean(myPhone) && Boolean(item.targetPhone) && normalizePhone(item.targetPhone || '') === myPhone)));

        if (!isRecipient) continue;

        // Avoid re-popping old notifications from days ago on a brand-new browser;
        // deliver anything sent within the last 5 minutes OR arriving live after listener start.
        const isRecent = item.timestampMs >= startedAt - 5 * 60 * 1000;
        seen.add(item.id);
        seenChanged = true;

        if (!isRecent) continue;

        options.onIncomingAlert?.(item);
        this.displayOsNotification({
          title: item.title,
          body: item.body,
          url: item.url || '/',
          tag: item.id,
        }).catch(() => {});
      }

      if (seenChanged) {
        saveSeenIds(seen);
      }
    });
  },
};
