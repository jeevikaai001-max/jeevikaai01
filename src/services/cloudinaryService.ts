import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import {
  getDb,
  isRealFirebaseConfigured,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  GovernmentScheme,
  HeroSlide,
  MediaAssetRecord,
  ShowcaseProduct,
} from '../types';

// Cloudinary Configuration (Cloud Name and Upload Preset provided by user)
export const CLOUDINARY_CLOUD_NAME =
  (import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME as string) || 'kvyah2au';
export const CLOUDINARY_UPLOAD_PRESET =
  (import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET as string) || 'jeevikaai';

export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

const LOCAL_MEDIA_KEY = 'jeevika_media_assets_v1';
const LOCAL_SHOWCASE_KEY = 'jeevika_showcase_products_v1';
export const MEDIA_UPDATED_EVENT = 'jeevika_media_updated';
export const SHOWCASE_UPDATED_EVENT = 'jeevika_showcase_updated';

function emitWindowEvent(name: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(name));
  }
}

function readLocalJson<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalJson<T>(key: string, items: T[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {}
}

async function fetchServerJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<T | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(url, options);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Merges Firestore, server-mirror, and localStorage media assets without duplicates or data loss.
 * Firestore items take precedence over temporary local/server IDs when URLs match.
 */
function mergeMediaLists(
  remoteList: MediaAssetRecord[],
  serverList: MediaAssetRecord[],
  localList: MediaAssetRecord[]
): MediaAssetRecord[] {
  const byId = new Map<string, MediaAssetRecord>();
  const seenUrls = new Set<string>();

  const pushUnique = (item: MediaAssetRecord, isLocalTemp: boolean) => {
    if (!item || !item.url) return;
    const cleanUrl = String(item.url).trim();
    if (!cleanUrl) return;
    if (byId.has(item.id)) return;
    // If a remote doc already represents this URL, skip duplicate temp entry
    if (isLocalTemp && seenUrls.has(cleanUrl)) return;
    byId.set(item.id, { ...item, url: cleanUrl });
    seenUrls.add(cleanUrl);
  };

  remoteList.forEach((m) => pushUnique(m, false));
  serverList.forEach((m) => pushUnique(m, m.id.startsWith('media_') || m.id.startsWith('srv_media_')));
  localList.forEach((m) => pushUnique(m, m.id.startsWith('media_') || m.id.startsWith('srv_media_')));

  return Array.from(byId.values()).sort((a, b) => {
    const timeA = typeof a.time === 'number' ? a.time : 0;
    const timeB = typeof b.time === 'number' ? b.time : 0;
    return timeB - timeA;
  });
}

function mergeShowcaseLists(
  remoteList: ShowcaseProduct[],
  serverList: ShowcaseProduct[],
  localList: ShowcaseProduct[]
): ShowcaseProduct[] {
  const byId = new Map<string, ShowcaseProduct>();
  const add = (item: ShowcaseProduct) => {
    if (!item || !item.id || byId.has(item.id)) return;
    byId.set(item.id, item);
  };
  remoteList.forEach(add);
  serverList.forEach(add);
  localList.forEach(add);
  return Array.from(byId.values());
}

/**
 * Uploads an image file to Cloudinary with real-time progress callbacks.
 * Returns the secure HTTPS URL of the uploaded image.
 */
export async function uploadToCloudinary(
  file: File,
  folder: string = 'banner',
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!file) {
    throw new Error('कृपया अपलोड करने के लिए एक छवि फ़ाइल चुनें।');
  }
  const hasImageExt = /\.(jpe?g|png|webp|gif|avif|bmp|svg)$/i.test(file.name || '');
  if (file.type && !file.type.startsWith('image/') && !hasImageExt) {
    throw new Error('केवल छवि फ़ाइलें (JPG, PNG, WEBP, GIF) अपलोड की जा सकती हैं।');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('फ़ाइल का आकार 15 MB से कम होना चाहिए।');
  }

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    if (folder) {
      formData.append('folder', `jeevika/${folder}`);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', CLOUDINARY_UPLOAD_URL);
    xhr.timeout = 45000;

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.secure_url) {
            resolve(data.secure_url);
          } else {
            reject(new Error('Cloudinary response did not return secure_url'));
          }
        } catch (err: any) {
          reject(new Error('Failed to parse Cloudinary response: ' + err.message));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData?.error?.message || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.ontimeout = () => reject(new Error('Cloudinary अपलोड समय समाप्त हो गया। कृपया पुनः प्रयास करें।'));
    xhr.onerror = () => reject(new Error('Network error during Cloudinary image upload'));
    xhr.send(formData);
  });
}

/**
 * Extracts AI-style keyword tags from filename.
 */
export function generateTagsFromFilename(filename: string): string[] {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  return nameWithoutExt
    .toLowerCase()
    .split(/[^a-z0-9]/g)
    .filter((w) => w.length > 2);
}

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [];

export const INITIAL_SHOWCASE_PRODUCTS: ShowcaseProduct[] = [];

function cleanForFirestore<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

function docToMediaRecord(id: string, data: Record<string, any>): MediaAssetRecord {
  return {
    id,
    url: data.url,
    folder: data.folder || 'banner',
    name: data.name || 'Untitled',
    tags: Array.isArray(data.tags) ? data.tags : [],
    used: typeof data.used === 'number' ? data.used : 0,
    time: typeof data.time === 'number' ? data.time : Date.now(),
    createdAt: data.createdAt,
    ctaUrl: data.ctaUrl || undefined,
    ctaLabel: data.ctaLabel || undefined,
    order: typeof data.order === 'number' ? data.order : undefined,
    active: data.active !== false,
  };
}

/**
 * Pure transformer: converts media asset list to sorted Hero Carousel slides.
 */
export function buildHeroSlidesFromMedia(media: MediaAssetRecord[]): HeroSlide[] {
  const bannerMedia = (media || []).filter(
    (m) =>
      m &&
      (m.folder === 'banner' || m.folder === 'hero_banner') &&
      m.active !== false &&
      Boolean(m.url)
  );

  bannerMedia.sort((a, b) => {
    const orderA = typeof a.order === 'number' ? a.order : 999;
    const orderB = typeof b.order === 'number' ? b.order : 999;
    if (orderA !== orderB) return orderA - orderB;
    return (b.time || 0) - (a.time || 0);
  });

  if (bannerMedia.length > 0) {
    return bannerMedia.map((m, idx) => {
      const cleanTags = (m.tags || []).filter(
        (t) =>
          t &&
          t !== 'admin-uploaded' &&
          t !== 'banner' &&
          t !== 'hero_banner' &&
          !t.toLowerCase().includes('admin') &&
          !t.toLowerCase().includes('upload')
      );

      return {
        id: m.id,
        imageUrl: m.url,
        title: (m.name || 'जीविका बैनर').replace(/\.[^/.]+$/, ''),
        subtitle:
          cleanTags.length > 0
            ? cleanTags.join(' • ')
            : 'जीविका प्रमाणित अवसर',
        tag: m.folder === 'hero_banner' ? 'विशेष' : 'नवीनतम',
        ctaUrl: m.ctaUrl,
        ctaLabel: m.ctaLabel,
        order: typeof m.order === 'number' ? m.order : idx,
        active: m.active !== false,
      };
    });
  }

  return DEFAULT_HERO_SLIDES;
}

/**
 * Pure transformer: returns active General & Government Scheme media items sorted by order/recency.
 */
export function buildGeneralSchemeMedia(media: MediaAssetRecord[]): MediaAssetRecord[] {
  return (media || [])
    .filter(
      (m) =>
        m &&
        (m.folder === 'general' || m.folder === 'schemes' || m.folder === 'scheme') &&
        m.active !== false &&
        Boolean(m.url)
    )
    .sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : 999;
      const orderB = typeof b.order === 'number' ? b.order : 999;
      if (orderA !== orderB) return orderA - orderB;
      return (b.time || 0) - (a.time || 0);
    });
}

/**
 * Maps uploaded `general` / `schemes` media images onto actual GovernmentScheme cards
 * (PM Vishwakarma, PMKVY 4.0, PMMY, etc.) without creating fake blank scheme cards.
 */
export function applyAdminSchemeImages(
  schemes: GovernmentScheme[],
  media: MediaAssetRecord[]
): GovernmentScheme[] {
  if (!schemes || schemes.length === 0) return [];
  const schemeMedia = buildGeneralSchemeMedia(media);

  // Strip any legacy mock placeholder image from schemes
  const sanitized = schemes.map((s) => {
    const raw = s.imageUrl?.trim() || '';
    const isLegacyMock = raw.includes('hero_livelihood_banner_');
    return {
      ...s,
      imageUrl: isLegacyMock ? undefined : raw || undefined,
    };
  });

  if (schemeMedia.length === 0) {
    return sanitized;
  }

  const usedMediaIds = new Set<string>();
  const matchedBySchemeIdx = new Map<number, MediaAssetRecord>();

  const keywordSets: { match: (s: GovernmentScheme) => boolean; words: string[] }[] = [
    {
      match: (s) => /vishwakarma|विश्वकर्मा/i.test(`${s.name} ${s.hiName}`),
      words: ['vishwakarma', 'विश्वकर्मा', 'toolkit', 'टूलकिट'],
    },
    {
      match: (s) => /kaushal|pmkvy|कौशल/i.test(`${s.name} ${s.hiName}`),
      words: ['kaushal', 'pmkvy', 'कौशल', 'skill'],
    },
    {
      match: (s) => /mudra|pmmy|मुद्रा/i.test(`${s.name} ${s.hiName}`),
      words: ['mudra', 'pmmy', 'मुद्रा', 'loan', 'ऋण'],
    },
    {
      match: (s) => /odop|एक जिला एक उत्पाद/i.test(`${s.name} ${s.hiName}`),
      words: ['odop', 'उत्पाद'],
    },
    {
      match: (s) => /udyami|उद्यमी/i.test(`${s.name} ${s.hiName}`),
      words: ['udyami', 'उद्यमी'],
    },
  ];

  // Pass 1: Explicit title/tag match if admin named the image after a specific scheme
  sanitized.forEach((scheme, sIdx) => {
    const rule = keywordSets.find((k) => k.match(scheme));
    if (!rule) return;
    const matchedMedia = schemeMedia.find((m) => {
      if (usedMediaIds.has(m.id)) return false;
      const haystack = `${m.name || ''} ${(m.tags || []).join(' ')}`.toLowerCase();
      return rule.words.some((w) => haystack.includes(w));
    });
    if (matchedMedia) {
      usedMediaIds.add(matchedMedia.id);
      matchedBySchemeIdx.set(sIdx, matchedMedia);
    }
  });

  // Pass 2: Assign remaining uploaded scheme images in order to remaining scheme cards
  const remainingPool = schemeMedia.filter((m) => !usedMediaIds.has(m.id));
  const fallbackPool = remainingPool.length > 0 ? remainingPool : schemeMedia;
  let poolCursor = 0;

  return sanitized.map((scheme, idx) => {
    const chosen =
      matchedBySchemeIdx.get(idx) ||
      fallbackPool[poolCursor++ % fallbackPool.length];
    if (!chosen) return scheme;
    return {
      ...scheme,
      imageUrl: chosen.url,
      ...(chosen.ctaUrl ? { ctaUrl: chosen.ctaUrl } : {}),
      ...(chosen.ctaLabel ? { ctaLabel: chosen.ctaLabel } : {}),
    };
  });
}

/**
 * Adapts an Admin-uploaded `general` / `schemes` media asset into a GovernmentScheme card.
 */
export function toGovernmentSchemeFromMedia(m: MediaAssetRecord): GovernmentScheme {
  const cleanTitle = (m.name || 'सरकारी योजना व सूचना').replace(/\.[^/.]+$/, '');
  const cleanTags = (m.tags || []).filter(
    (t) =>
      t &&
      t !== 'admin-uploaded' &&
      !t.toLowerCase().includes('admin') &&
      !t.toLowerCase().includes('upload')
  );

  return {
    id: `media_scheme_${m.id}`,
    name: cleanTitle,
    hiName: cleanTitle,
    benefit:
      cleanTags.length > 0
        ? cleanTags.join(' · ')
        : 'जिला स्तर पर सक्रिय सरकारी योजना व नागरिक आजीविका सहायता',
    eligibility: 'पात्र ग्रामीण एवं शहरी नागरिक (आधार व बैंक पासबुक के साथ)',
    applyOffice: m.ctaLabel || 'नजदीकी CSC / जिला आजीविका केंद्र',
    category: m.folder === 'schemes' || m.folder === 'scheme' ? 'central' : 'state',
    financialSupport:
      m.ctaLabel ||
      (m.folder === 'schemes' || m.folder === 'scheme'
        ? 'सरकारी योजना व अनुदान सहायता'
        : 'विशेष योजना एवं जन-सूचना'),
    imageUrl: m.url,
    ctaUrl: m.ctaUrl,
    ctaLabel: m.ctaLabel,
    tags: cleanTags,
    isAdminUploaded: true,
  };
}

export const mediaStorageService = {
  /**
   * Rescues and syncs any orphaned media stored locally or in server mirror to Firestore.
   */
  async syncLocalMediaToFirestore(): Promise<number> {
    if (!isRealFirebaseConfigured) return 0;

    try {
      const localAssets = readLocalJson<MediaAssetRecord>(LOCAL_MEDIA_KEY);
      if (localAssets.length === 0) return 0;

      const snap = await getDocs(collection(getDb(), 'media'));
      const firestoreIds = new Set(snap.docs.map((d) => d.id));
      const firestoreUrls = new Set(snap.docs.map((d) => d.data().url));

      let syncedCount = 0;
      const updatedLocal: MediaAssetRecord[] = [];

      for (const asset of localAssets) {
        const isLocalOnly =
          asset.id.startsWith('media_') ||
          asset.id.startsWith('srv_media_') ||
          (!firestoreIds.has(asset.id) && !firestoreUrls.has(asset.url));
        if (isLocalOnly) {
          try {
            const raw = {
              url: asset.url,
              folder: asset.folder || 'banner',
              name: asset.name || 'Untitled',
              tags: asset.tags || ['जीविका अवसर'],
              used: asset.used || 1,
              time: asset.time || Date.now(),
              ctaUrl: asset.ctaUrl || null,
              ctaLabel: asset.ctaLabel || null,
              order: typeof asset.order === 'number' ? asset.order : 0,
              active: asset.active !== false,
              createdAt: serverTimestamp(),
            };
            const docRef = await addDoc(collection(getDb(), 'media'), cleanForFirestore(raw));
            updatedLocal.push({ ...asset, id: docRef.id });
            firestoreIds.add(docRef.id);
            firestoreUrls.add(asset.url);
            syncedCount++;
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'media');
            updatedLocal.push(asset);
          }
        } else {
          updatedLocal.push(asset);
        }
      }

      if (syncedCount > 0) {
        writeLocalJson(LOCAL_MEDIA_KEY, updatedLocal);
        emitWindowEvent(MEDIA_UPDATED_EVENT);
      }
      return syncedCount;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'media');
      return 0;
    }
  },

  /**
   * Subscribes to real-time changes from Firestore `media`, same-tab local events,
   * and server mirror so Hero Banners, Training Gallery, and General/Schemes sections update immediately.
   */
  subscribeMediaAssets(callback: (assets: MediaAssetRecord[]) => void): () => void {
    let disposed = false;
    let latestFirestore: MediaAssetRecord[] = [];

    const deliverMerged = async () => {
      if (disposed) return;
      const localList = readLocalJson<MediaAssetRecord>(LOCAL_MEDIA_KEY);
      const srvRes = await fetchServerJson<{ items?: MediaAssetRecord[] }>('/api/media');
      const serverList = Array.isArray(srvRes?.items) ? srvRes!.items! : [];
      const merged = mergeMediaLists(latestFirestore, serverList, localList);
      writeLocalJson(LOCAL_MEDIA_KEY, merged);
      if (!disposed) callback(merged);
    };

    // Immediate initial load from merged sources
    this.getMediaAssets().then((assets) => {
      if (!disposed) callback(assets);
    });

    const handleLocalUpdate = () => {
      deliverMerged();
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_MEDIA_KEY) deliverMerged();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(MEDIA_UPDATED_EVENT, handleLocalUpdate);
      window.addEventListener('storage', handleStorage);
    }

    let unsubFirestore: () => void = () => {};
    if (isRealFirebaseConfigured) {
      try {
        unsubFirestore = onSnapshot(
          collection(getDb(), 'media'),
          (snap) => {
            latestFirestore = snap.docs.map((d) => docToMediaRecord(d.id, d.data()));
            deliverMerged();
          },
          (err) => {
            handleFirestoreError(err, OperationType.LIST, 'media');
            deliverMerged();
          }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'media');
      }
    }

    return () => {
      disposed = true;
      unsubFirestore();
      if (typeof window !== 'undefined') {
        window.removeEventListener(MEDIA_UPDATED_EVENT, handleLocalUpdate);
        window.removeEventListener('storage', handleStorage);
      }
    };
  },

  /**
   * Loads all media uploaded by admin or users across Firestore, server mirror, and localStorage.
   */
  async getMediaAssets(): Promise<MediaAssetRecord[]> {
    let remoteList: MediaAssetRecord[] = [];
    if (isRealFirebaseConfigured) {
      try {
        const snap = await getDocs(collection(getDb(), 'media'));
        remoteList = snap.docs.map((d) => docToMediaRecord(d.id, d.data()));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'media');
      }
    }

    const srvRes = await fetchServerJson<{ items?: MediaAssetRecord[] }>('/api/media');
    const serverList = Array.isArray(srvRes?.items) ? srvRes!.items! : [];
    const localList = readLocalJson<MediaAssetRecord>(LOCAL_MEDIA_KEY);

    const merged = mergeMediaLists(remoteList, serverList, localList);
    writeLocalJson(LOCAL_MEDIA_KEY, merged);
    return merged;
  },

  /**
   * Saves a newly uploaded media record to Firestore, server mirror, and localStorage.
   */
  async saveMediaAsset(asset: Omit<MediaAssetRecord, 'id'>): Promise<string> {
    const cleanUrl = String(asset.url || '').trim();
    const rawPayload = {
      url: cleanUrl,
      folder: asset.folder || 'banner',
      name: asset.name || 'Untitled',
      tags: asset.tags || ['जीविका अवसर'],
      used: asset.used ?? 1,
      time: asset.time || Date.now(),
      ctaUrl: asset.ctaUrl ? asset.ctaUrl.trim() : null,
      ctaLabel: asset.ctaLabel ? asset.ctaLabel.trim() : null,
      order: typeof asset.order === 'number' ? asset.order : 0,
      active: asset.active !== false,
      createdAt: serverTimestamp(),
    };

    const payload = cleanForFirestore(rawPayload);

    let id = 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    if (isRealFirebaseConfigured) {
      try {
        const docRef = await addDoc(collection(getDb(), 'media'), payload);
        id = docRef.id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'media');
      }
    }

    const record: MediaAssetRecord = {
      ...asset,
      id,
      url: cleanUrl,
      time: rawPayload.time,
      active: rawPayload.active,
      order: rawPayload.order,
    };

    // Persist to server mirror so it survives browser reloads & separate tabs even if Firestore rules block writes
    await fetchServerJson('/api/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...record,
        createdAt: typeof asset.createdAt === 'string' ? asset.createdAt : new Date().toISOString(),
      }),
    });

    // Update localStorage without duplicating existing ID or URL
    const existingLocal = readLocalJson<MediaAssetRecord>(LOCAL_MEDIA_KEY).filter(
      (m) => m.id !== id && m.url !== cleanUrl
    );
    writeLocalJson(LOCAL_MEDIA_KEY, [record, ...existingLocal]);
    emitWindowEvent(MEDIA_UPDATED_EVENT);

    return id;
  },

  /**
   * Increments the usage count of a media item in Firestore.
   */
  async incrementUsage(id: string): Promise<void> {
    if (isRealFirebaseConfigured && !id.startsWith('media_') && !id.startsWith('srv_media_')) {
      try {
        await updateDoc(doc(getDb(), 'media', id), {
          used: increment(1),
        });
      } catch {}
    }
  },

  /**
   * Deletes a media asset by doc ID across Firestore, server mirror, and localStorage.
   */
  async deleteMediaAsset(id: string): Promise<boolean> {
    if (isRealFirebaseConfigured && !id.startsWith('media_') && !id.startsWith('srv_media_')) {
      try {
        await deleteDoc(doc(getDb(), 'media', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `media/${id}`);
      }
    }

    await fetchServerJson(`/api/media/${encodeURIComponent(id)}`, { method: 'DELETE' });

    const existing = readLocalJson<MediaAssetRecord>(LOCAL_MEDIA_KEY);
    const filtered = existing.filter((m) => m.id !== id);
    writeLocalJson(LOCAL_MEDIA_KEY, filtered);
    emitWindowEvent(MEDIA_UPDATED_EVENT);
    return true;
  },

  /**
   * Updates a media asset by doc ID across Firestore, server mirror, and localStorage.
   */
  async updateMediaAsset(id: string, asset: Partial<MediaAssetRecord>): Promise<void> {
    const cleaned = cleanForFirestore({
      ...asset,
      ctaUrl: asset.ctaUrl !== undefined ? (asset.ctaUrl ? asset.ctaUrl.trim() : null) : undefined,
      ctaLabel: asset.ctaLabel !== undefined ? (asset.ctaLabel ? asset.ctaLabel.trim() : null) : undefined,
    });

    if (isRealFirebaseConfigured && !id.startsWith('media_') && !id.startsWith('srv_media_')) {
      try {
        await updateDoc(doc(getDb(), 'media', id), cleaned as any);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `media/${id}`);
      }
    }

    await fetchServerJson(`/api/media/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asset),
    });

    const existing = readLocalJson<MediaAssetRecord>(LOCAL_MEDIA_KEY);
    const updated = existing.map((m) => (m.id === id ? { ...m, ...asset } : m));
    writeLocalJson(LOCAL_MEDIA_KEY, updated);
    emitWindowEvent(MEDIA_UPDATED_EVENT);
  },

  /**
   * Gets current hero banner slides (combines default with admin uploaded banner / hero_banner media).
   */
  async getHeroSlides(): Promise<HeroSlide[]> {
    const media = await this.getMediaAssets();
    return buildHeroSlidesFromMedia(media);
  },

  /**
   * Gets active general & government scheme media uploaded by admin.
   */
  async getGeneralSchemeMedia(): Promise<MediaAssetRecord[]> {
    const media = await this.getMediaAssets();
    return buildGeneralSchemeMedia(media);
  },

  /**
   * Reorder media assets (e.g. hero banner slides or scheme cards) and persist cleanly.
   */
  async reorderMedia(items: { id: string; order: number }[]): Promise<void> {
    const orderMap = new Map(items.map((it) => [it.id, it.order]));

    const media = readLocalJson<MediaAssetRecord>(LOCAL_MEDIA_KEY);
    const updated = media.map((m) =>
      orderMap.has(m.id) ? { ...m, order: orderMap.get(m.id)! } : m
    );
    writeLocalJson(LOCAL_MEDIA_KEY, updated);
    emitWindowEvent(MEDIA_UPDATED_EVENT);

    await fetchServerJson('/api/media/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });

    if (isRealFirebaseConfigured) {
      try {
        const db = getDb();
        await Promise.allSettled(
          items
            .filter((it) => !it.id.startsWith('media_') && !it.id.startsWith('srv_media_'))
            .map((it) => updateDoc(doc(db, 'media', it.id), { order: it.order }))
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'media');
      }
    }
  },

  /**
   * Local Business Showcase Products CRUD
   */
  subscribeShowcaseProducts(callback: (products: ShowcaseProduct[]) => void): () => void {
    let disposed = false;
    this.getShowcaseProducts().then((list) => {
      if (!disposed) callback(list);
    });

    const handleUpdate = () => {
      this.getShowcaseProducts().then((list) => {
        if (!disposed) callback(list);
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(SHOWCASE_UPDATED_EVENT, handleUpdate);
    }

    let unsubFirestore: () => void = () => {};
    if (isRealFirebaseConfigured) {
      try {
        unsubFirestore = onSnapshot(
          collection(getDb(), 'showcase'),
          () => handleUpdate(),
          (err) => handleFirestoreError(err, OperationType.LIST, 'showcase')
        );
      } catch {}
    }

    return () => {
      disposed = true;
      unsubFirestore();
      if (typeof window !== 'undefined') {
        window.removeEventListener(SHOWCASE_UPDATED_EVENT, handleUpdate);
      }
    };
  },

  async getShowcaseProducts(): Promise<ShowcaseProduct[]> {
    let remoteList: ShowcaseProduct[] = [];
    if (isRealFirebaseConfigured) {
      try {
        const snap = await getDocs(collection(getDb(), 'showcase'));
        remoteList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'showcase');
      }
    }

    const srvRes = await fetchServerJson<{ items?: ShowcaseProduct[] }>('/api/showcase');
    const serverList = Array.isArray(srvRes?.items) ? srvRes!.items! : [];
    const localList = readLocalJson<ShowcaseProduct>(LOCAL_SHOWCASE_KEY);

    const merged = mergeShowcaseLists(remoteList, serverList, localList);
    writeLocalJson(LOCAL_SHOWCASE_KEY, merged);
    return merged.length > 0 ? merged : INITIAL_SHOWCASE_PRODUCTS;
  },

  async addShowcaseProduct(prod: Omit<ShowcaseProduct, 'id'>): Promise<string> {
    let id = 'show_' + Date.now();
    if (isRealFirebaseConfigured) {
      try {
        const docRef = await addDoc(collection(getDb(), 'showcase'), {
          ...cleanForFirestore(prod),
          createdAt: serverTimestamp(),
        });
        id = docRef.id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'showcase');
      }
    }

    const record: ShowcaseProduct = { ...prod, id };
    await fetchServerJson('/api/showcase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });

    const existing = readLocalJson<ShowcaseProduct>(LOCAL_SHOWCASE_KEY).filter((p) => p.id !== id);
    writeLocalJson(LOCAL_SHOWCASE_KEY, [record, ...existing]);
    emitWindowEvent(SHOWCASE_UPDATED_EVENT);
    return id;
  },

  async deleteShowcaseProduct(id: string): Promise<boolean> {
    if (isRealFirebaseConfigured && !id.startsWith('show_') && !id.startsWith('srv_show_')) {
      try {
        await deleteDoc(doc(getDb(), 'showcase', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `showcase/${id}`);
      }
    }

    await fetchServerJson(`/api/showcase/${encodeURIComponent(id)}`, { method: 'DELETE' });

    const existing = readLocalJson<ShowcaseProduct>(LOCAL_SHOWCASE_KEY);
    const filtered = existing.filter((p) => p.id !== id);
    writeLocalJson(LOCAL_SHOWCASE_KEY, filtered);
    emitWindowEvent(SHOWCASE_UPDATED_EVENT);
    return true;
  },

  async updateShowcaseProduct(id: string, prod: Partial<ShowcaseProduct>): Promise<void> {
    if (isRealFirebaseConfigured && !id.startsWith('show_') && !id.startsWith('srv_show_')) {
      try {
        await updateDoc(doc(getDb(), 'showcase', id), cleanForFirestore(prod) as any);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `showcase/${id}`);
      }
    }

    const existing = readLocalJson<ShowcaseProduct>(LOCAL_SHOWCASE_KEY);
    const updated = existing.map((p) => (p.id === id ? { ...p, ...prod } : p));
    writeLocalJson(LOCAL_SHOWCASE_KEY, updated);
    emitWindowEvent(SHOWCASE_UPDATED_EVENT);
  },
};
