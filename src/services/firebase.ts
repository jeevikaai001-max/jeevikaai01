import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  EmailAuthProvider,
  linkWithCredential,
  updateProfile,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  getDocFromServer,
  query,
  where
} from 'firebase/firestore';
import { BeneficiaryProfile } from '../types';
import appletConfig from '../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  role?: 'beneficiary' | 'admin' | 'sub_admin';
  /** 10-digit mobile number for accounts created through the assisted (mobile + PIN) flow */
  phone?: string;
  /** true when the user was created by the offline/local fallback and has no real Firebase session */
  isLocal?: boolean;
}

export type AdminActivityAction = 'ADD' | 'UPDATE' | 'DELETE';

export interface SubAdminRecord {
  email: string;
  name: string;
  note?: string;
  active: boolean;
  addedBy: string;
  addedAt: string;
  lastLoginAt?: string;
  updatedAt?: string;
}

export interface AdminActivityRecord {
  id: string;
  actorEmail: string;
  actorName: string;
  actorRole: 'admin' | 'sub_admin';
  action: AdminActivityAction;
  section: string;
  targetTitle: string;
  targetId?: string;
  details?: string;
  createdAt: string;
  timestampMs: number;
}

export interface PushNotificationRecord {
  id: string;
  target: 'all' | 'specific';
  targetUserId?: string;
  targetPhone?: string;
  targetName?: string;
  title: string;
  body: string;
  url?: string;
  sentBy?: string;
  pushDeliveredCount?: number;
  createdAt: string;
  timestampMs: number;
}

export interface PushSubscriptionDoc {
  id: string;
  endpoint: string;
  subscription: {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  uid?: string;
  phone?: string;
  name?: string;
  location?: string;
  isStandalone?: boolean;
  updatedAt: string;
}

// Primary Super Administrator accounts (full control including Sub-Admin management).
export const SUPER_ADMIN_EMAILS: string[] = [
  'ayushgupt640@gmail.com',
  'admin@jeevikaai.org',
  'admin@jeevika.gov.in',
  'support@jeevikaai.org'
];

export const ADMIN_EMAILS: string[] = SUPER_ADMIN_EMAILS;

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const cleanEmail = String(email).trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.includes(cleanEmail);
};

export const isAdminEmail = isSuperAdminEmail;

export const isSuperAdminUser = (user?: AppUser | null): boolean =>
  Boolean(user) && (user?.role === 'admin' || isSuperAdminEmail(user?.email));

export const isSubAdminUser = (user?: AppUser | null): boolean =>
  Boolean(user) && user?.role === 'sub_admin' && !isSuperAdminEmail(user?.email);

/** True ONLY for verified Super Admins or active registered Sub-Admins */
export const isAdminUser = (user?: AppUser | null): boolean =>
  Boolean(user) && (user?.role === 'admin' || user?.role === 'sub_admin' || isSuperAdminEmail(user?.email));

// --- Assisted accounts (mobile number + 4-digit PIN) -------------------------------------------
// People who cannot manage e-mail/passwords get an account from the JeevikaAI assistant using only
// their mobile number and a 4-digit PIN. Firebase Auth needs an e-mail and a 6+ character password,
// so both are derived from those two values. No SMS is sent and no real e-mail is involved.
export const PHONE_EMAIL_DOMAIN = 'phone.jeevikaai.app';
export const normalizePhone = (raw: string): string => String(raw || '').replace(/\D/g, '').slice(-10);
export const isValidIndianMobile = (phone: string): boolean => /^[6-9]\d{9}$/.test(phone);
const phoneToEmail = (phone: string) => `${phone}@${PHONE_EMAIL_DOMAIN}`;
const pinToPassword = (phone: string, pin: string) => `jv${pin}${phone}`;

export interface PhoneCheckResult {
  exists: boolean;
  name?: string;
  uid?: string;
  isProfileComplete?: boolean;
  status?: string;
  source?: 'firestore' | 'local';
}

export type AccountErrorKind = 'exists' | 'wrong' | 'offline' | 'disabled' | 'locked' | 'unknown';
export class AccountError extends Error {
  kind: AccountErrorKind;
  constructor(kind: AccountErrorKind) {
    super(kind);
    this.kind = kind;
    this.name = 'AccountError';
  }
}

const env = (import.meta.env || {}) as Record<string, string | undefined>;

// Web API keys are public identifiers for Firebase; access is controlled by Auth + firestore.rules.
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || appletConfig?.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig?.authDomain || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || appletConfig?.projectId || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig?.storageBucket || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig?.messagingSenderId || '',
  appId: env.VITE_FIREBASE_APP_ID || appletConfig?.appId || ''
};

// The Firestore database provisioned for this project is a *named* database
// (see firebase-applet-config.json). getFirestore(app) alone would point at "(default)".
const FIRESTORE_DATABASE_ID =
  env.VITE_FIRESTORE_DATABASE_ID || appletConfig?.firestoreDatabaseId || '';

export const isRealFirebaseConfigured = true;

const LOCAL_USER_KEY = 'jeevika_auth_user_v1';
const DEVICE_UID_KEY = 'jeevika_device_uid_v1';

let cachedApp: any = null;
let cachedDb: any = null;

export function getFirebaseApp() {
  if (!cachedApp) {
    cachedApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  }
  return cachedApp;
}

export function getDb() {
  if (!cachedDb) {
    cachedDb = getFirestore(getFirebaseApp(), FIRESTORE_DATABASE_ID);
  }
  return cachedDb;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  let fbAuth: any = null;
  try {
    fbAuth = getAuth(getFirebaseApp());
  } catch {}
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: fbAuth?.currentUser?.uid,
      email: fbAuth?.currentUser?.email,
      emailVerified: fbAuth?.currentUser?.emailVerified,
      isAnonymous: fbAuth?.currentUser?.isAnonymous,
      tenantId: fbAuth?.currentUser?.tenantId,
      providerInfo: fbAuth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// Bootstrapped connection verification as required by skill guidelines
async function testConnection() {
  if (typeof window === 'undefined') return;
  try {
    const db = getDb();
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline:', error.message);
    }
  }
}
if (typeof window !== 'undefined') {
  setTimeout(() => {
    testConnection();
  }, 100);
}

/** Firestore rejects `undefined` values; drop them (and keep the data JSON-safe). */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

const PHONE_ACCOUNTS_KEY = 'jeevika_phone_accounts_v1';

interface LocalPhoneAccount {
  phone: string;
  pin: string;
  name?: string;
  uid: string;
  createdAt: string;
}

function getLocalPhoneAccounts(): Record<string, LocalPhoneAccount> {
  try {
    const raw = localStorage.getItem(PHONE_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalPhoneAccount(account: LocalPhoneAccount) {
  try {
    const accounts = getLocalPhoneAccounts();
    accounts[account.phone] = account;
    localStorage.setItem(PHONE_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {}
}

class AuthService {
  private listeners: ((user: AppUser | null) => void)[] = [];
  private currentUser: AppUser | null = null;
  private auth: any = null;
  private authReady: Promise<void>;
  private resolveReady: () => void = () => {};

  constructor() {
    this.authReady = new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });
    this.init();
  }

  private toAppUser(fbUser: FirebaseUser, resolvedRole?: 'beneficiary' | 'admin' | 'sub_admin', displayNameOverride?: string): AppUser {
    const email = fbUser.email;
    const phone = email && email.endsWith('@' + PHONE_EMAIL_DOMAIN) ? email.split('@')[0] : undefined;
    const role = resolvedRole || (isSuperAdminEmail(email) ? 'admin' : 'beneficiary');
    return {
      uid: fbUser.uid,
      email,
      displayName: fbUser.displayName || displayNameOverride || null,
      isAnonymous: fbUser.isAnonymous,
      role,
      phone
    };
  }

  private async resolveAppUser(fbUser: FirebaseUser): Promise<AppUser> {
    const email = fbUser.email ? fbUser.email.trim().toLowerCase() : '';
    if (isSuperAdminEmail(email)) {
      return this.toAppUser(fbUser, 'admin');
    }
    if (email && !email.endsWith('@' + PHONE_EMAIL_DOMAIN) && fbUser.emailVerified) {
      const subAdmin = await subAdminService.checkSubAdminAccess(email);
      if (subAdmin && subAdmin.active) {
        return this.toAppUser(fbUser, 'sub_admin', subAdmin.name || undefined);
      }
    }
    return this.toAppUser(fbUser, 'beneficiary');
  }

  private mapAccountError(err: any): AccountError {
    const code: string = err?.code || '';
    if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use') return new AccountError('exists');
    if (code === 'auth/network-request-failed') return new AccountError('offline');
    if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') return new AccountError('disabled');
    if (code === 'auth/too-many-requests') return new AccountError('locked');
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-login-credentials'
    ) {
      return new AccountError('wrong');
    }
    return new AccountError('unknown');
  }

  /**
   * Checks whether a 10-digit mobile number is already registered in Firestore or local device storage.
   * Also verifies if the user already has a completed AI profile or is still pending.
   */
  public async checkPhoneExists(rawPhone: string): Promise<PhoneCheckResult> {
    const phone = normalizePhone(rawPhone);
    if (!isValidIndianMobile(phone)) {
      return { exists: false };
    }

    // 1. Check local phone accounts first (instant)
    try {
      const localAccs = getLocalPhoneAccounts();
      if (localAccs[phone]) {
        const acc = localAccs[phone];
        let isComplete = false;
        let storedProf: any = null;
        try {
          const raw = localStorage.getItem(`jeevika_firestore_user_${acc.uid}`);
          if (raw) storedProf = JSON.parse(raw);
        } catch {}
        if (storedProf && storedProf.skills && storedProf.education && storedProf.status === 'completed') {
          isComplete = true;
        }
        return {
          exists: true,
          name: storedProf?.name || acc.name || `नागरिक (${phone.slice(-4)})`,
          uid: acc.uid,
          isProfileComplete: isComplete,
          status: storedProf?.status || 'pending',
          source: 'local'
        };
      }
    } catch {}

    // 2. Query Firestore users collection
    if (isRealFirebaseConfigured) {
      try {
        const db = getDb();
        // Check by direct query
        const q = query(collection(db, 'users'), where('phone', '==', phone));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docData = snap.docs[0].data();
          const docId = snap.docs[0].id;
          const isComplete = Boolean(
            docData.skills && String(docData.skills).trim().length > 2 &&
            docData.education && String(docData.education).trim().length > 1 &&
            docData.status === 'completed'
          );
          return {
            exists: true,
            name: docData.name || `नागरिक (${phone.slice(-4)})`,
            uid: docId,
            isProfileComplete: isComplete,
            status: docData.status || (isComplete ? 'completed' : 'pending'),
            source: 'firestore'
          };
        }

        // Also check direct document key user_phone_{phone}
        const directSnap = await getDoc(doc(db, 'users', 'user_phone_' + phone));
        if (directSnap.exists()) {
          const docData = directSnap.data();
          const isComplete = Boolean(
            docData.skills && String(docData.skills).trim().length > 2 &&
            docData.education && String(docData.education).trim().length > 1 &&
            docData.status === 'completed'
          );
          return {
            exists: true,
            name: docData.name || `नागरिक (${phone.slice(-4)})`,
            uid: 'user_phone_' + phone,
            isProfileComplete: isComplete,
            status: docData.status || (isComplete ? 'completed' : 'pending'),
            source: 'firestore'
          };
        }
      } catch (err) {
        console.warn('Firestore phone lookup notice:', err);
      }
    }

    return { exists: false };
  }

  /**
   * Creates an account from a mobile number + PIN. If the person already has an anonymous guest session
   * (created when their profile was first saved), the account is linked to it so nothing is lost.
   * Resilient fallback to local storage ensures uneducated users are never blocked by network hiccups.
   */
  public async registerWithPhone(phone: string, pin: string, name?: string): Promise<AppUser> {
    await this.authReady;
    const email = phoneToEmail(phone);
    const password = pinToPassword(phone, pin);

    // 1. Try Firebase Auth first
    if (this.auth && isRealFirebaseConfigured) {
      try {
        let fbUser: FirebaseUser;
        const current = this.auth.currentUser;
        if (current && current.isAnonymous) {
          const res = await linkWithCredential(current, EmailAuthProvider.credential(email, password));
          fbUser = res.user;
        } else {
          const res = await createUserWithEmailAndPassword(this.auth, email, password);
          fbUser = res.user;
        }
        if (name) {
          try { await updateProfile(fbUser, { displayName: name }); } catch (e) {}
        }
        const user: AppUser = { ...this.toAppUser(fbUser), displayName: name || fbUser.displayName };
        this.currentUser = user;
        saveLocalPhoneAccount({ phone, pin, name: user.displayName || undefined, uid: user.uid, createdAt: new Date().toISOString() });

        // Save initial record to Firestore users collection so admin sees live registration immediately
        if (isRealFirebaseConfigured) {
          try {
            await setDoc(doc(getDb(), 'users', user.uid), clean({
              uid: user.uid,
              phone,
              name: name || `नागरिक (${phone.slice(-4)})`,
              status: 'pending',
              education: '',
              skills: '',
              location: '',
              state: 'Uttar Pradesh',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastActive: new Date().toISOString(),
              activeNow: true
            }), { merge: true });
          } catch (err) {
            console.warn('Initial firestore user sync notice:', err);
          }
        }

        this.notifyListeners();
        return user;
      } catch (err: any) {
        const code: string = err?.code || '';
        if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use') {
          throw new AccountError('exists');
        }
        console.warn('Firebase registerWithPhone notice:', err?.message || err);
      }
    }

    // 2. Resilient local fallback: Create account locally so the user is never blocked
    const existingAccounts = getLocalPhoneAccounts();
    if (existingAccounts[phone] && existingAccounts[phone].pin !== pin) {
      // Account exists locally with different PIN
      throw new AccountError('exists');
    }

    const uid = existingAccounts[phone]?.uid || ('user_phone_' + phone);
    const localUser: AppUser = {
      uid,
      email,
      displayName: name || `नागरिक (${phone.slice(-4)})`,
      isAnonymous: false,
      role: 'beneficiary',
      phone,
      isLocal: true
    };
    saveLocalPhoneAccount({ phone, pin, name: localUser.displayName || undefined, uid, createdAt: new Date().toISOString() });

    // Save initial record locally & attempt cloud save
    try {
      const initialPayload = clean({
        uid,
        phone,
        name: name || `नागरिक (${phone.slice(-4)})`,
        status: 'pending',
        education: '',
        skills: '',
        location: '',
        state: 'Uttar Pradesh',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        activeNow: true
      });
      localStorage.setItem(`jeevika_firestore_user_${uid}`, JSON.stringify(initialPayload));
      if (isRealFirebaseConfigured) {
        setDoc(doc(getDb(), 'users', uid), initialPayload, { merge: true }).catch(() => {});
      }
    } catch {}

    this.currentUser = localUser;
    this.notifyListeners();
    return localUser;
  }

  public async loginWithPhone(phone: string, pin: string): Promise<AppUser> {
    await this.authReady;
    const email = phoneToEmail(phone);
    const password = pinToPassword(phone, pin);

    // 1. Try real Firebase Auth first
    if (this.auth && isRealFirebaseConfigured) {
      try {
        const res = await signInWithEmailAndPassword(this.auth, email, password);
        const user = this.toAppUser(res.user);
        this.currentUser = user;
        saveLocalPhoneAccount({ phone, pin, name: user.displayName || undefined, uid: user.uid, createdAt: new Date().toISOString() });
        this.notifyListeners();
        return user;
      } catch (err: any) {
        const code: string = err?.code || '';
        if (
          code === 'auth/invalid-credential' ||
          code === 'auth/wrong-password' ||
          code === 'auth/invalid-login-credentials'
        ) {
          // Check if user has local matching pin before failing
          const accounts = getLocalPhoneAccounts();
          if (accounts[phone] && accounts[phone].pin === pin) {
            const localUser: AppUser = {
              uid: accounts[phone].uid,
              email,
              displayName: accounts[phone].name || `User ${phone.slice(-4)}`,
              isAnonymous: false,
              role: 'beneficiary',
              phone,
              isLocal: true
            };
            this.currentUser = localUser;
            this.notifyListeners();
            return localUser;
          }
          throw new AccountError('wrong');
        }
        console.warn('Firebase loginWithPhone notice:', err?.message || err);
      }
    }

    // 2. Resilient local fallback: Check local device accounts
    const accounts = getLocalPhoneAccounts();
    if (accounts[phone]) {
      if (accounts[phone].pin === pin) {
        const localUser: AppUser = {
          uid: accounts[phone].uid,
          email,
          displayName: accounts[phone].name || `User ${phone.slice(-4)}`,
          isAnonymous: false,
          role: 'beneficiary',
          phone,
          isLocal: true
        };
        this.currentUser = localUser;
        this.notifyListeners();
        return localUser;
      }
      throw new AccountError('wrong');
    }

    // If no local account and Firebase failed, check if device UID exists
    const savedLocal = localStorage.getItem(LOCAL_USER_KEY);
    if (savedLocal) {
      try {
        const parsed = JSON.parse(savedLocal) as AppUser;
        if (parsed && (parsed.phone === phone || !parsed.phone)) {
          const user: AppUser = {
            ...parsed,
            phone,
            isAnonymous: false,
            role: 'beneficiary',
            isLocal: true
          };
          this.currentUser = user;
          saveLocalPhoneAccount({ phone, pin, name: user.displayName || undefined, uid: user.uid, createdAt: new Date().toISOString() });
          this.notifyListeners();
          return user;
        }
      } catch {}
    }

    throw new AccountError('wrong');
  }

  private init() {
    if (typeof window === 'undefined') {
      this.resolveReady();
      return;
    }

    // Restore a previously created *local* (offline) user only. Real sessions come from Firebase below,
    // and an admin role is never restored from localStorage.
    try {
      const saved = localStorage.getItem(LOCAL_USER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AppUser;
        if (parsed && parsed.isLocal) {
          this.currentUser = { ...parsed, role: 'beneficiary' };
        } else {
          localStorage.removeItem(LOCAL_USER_KEY);
        }
      }
    } catch (e) {}

    if (isRealFirebaseConfigured) {
      try {
        this.auth = getAuth(getFirebaseApp());

        onAuthStateChanged(this.auth, async (fbUser: FirebaseUser | null) => {
          if (fbUser) {
            this.currentUser = await this.resolveAppUser(fbUser);
          } else if (!this.currentUser?.isLocal) {
            this.currentUser = null;
          }
          this.resolveReady();
          this.notifyListeners();
        });
      } catch (err) {
        console.warn('Firebase init error, using local-only mode:', err);
        this.resolveReady();
      }
    } else {
      this.resolveReady();
    }
  }

  public subscribe(callback: (user: AppUser | null) => void) {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners() {
    try {
      if (this.currentUser?.isLocal) {
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(this.currentUser));
      } else {
        localStorage.removeItem(LOCAL_USER_KEY);
      }
    } catch (e) {}
    this.listeners.forEach((cb) => cb(this.currentUser));
  }

  public getCurrentUser(): AppUser | null {
    return this.currentUser;
  }

  /**
   * Returns the uid of a real Firebase user, signing in anonymously when nobody is signed in.
   * Resolves to null when Firebase Auth is unavailable (offline, Anonymous sign-in disabled, ...).
   * Anonymous sign-in is what lets guests save progress without creating an account.
   */
  public async ensureCloudUid(): Promise<string | null> {
    if (!this.auth) return null;
    try {
      await this.authReady;
      if (this.auth.currentUser) return this.auth.currentUser.uid;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
      const res = await signInAnonymously(this.auth);
      return res.user.uid;
    } catch (e: any) {
      console.warn('Anonymous Firebase sign-in unavailable, keeping data on device:', e?.code || e?.message || e);
      return null;
    }
  }

  public async loginWithEmail(email: string, pass: string): Promise<AppUser> {
    const cleanEmail = email.trim().toLowerCase();
    const adminAttempt = isAdminEmail(cleanEmail);

    if (adminAttempt) {
      if (!pass || pass.length < 4) {
        throw new Error('कृपया वैध एडमिन पासवर्ड दर्ज करें।');
      }
    }

    if (isRealFirebaseConfigured && this.auth) {
      try {
        const res = await signInWithEmailAndPassword(this.auth, cleanEmail, pass);
        const user = await this.resolveAppUser(res.user);
        if (adminAttempt && !isAdminUser(user)) {
          throw new Error('इस खाते के पास प्रशासनिक अनुमति नहीं है।');
        }
        this.currentUser = user;
        this.notifyListeners();
        return user;
      } catch (err: any) {
        if (adminAttempt) {
          throw new Error('गलत एडमिन ईमेल या पासवर्ड। (Invalid admin email or password)');
        }
        console.warn('Firebase signIn failed, attempting local fallback:', err?.message);
      }
    }

    if (adminAttempt) {
      throw new Error('अमान्य एडमिन ईमेल या पासवर्ड। कृपया Google 1-क्लिक लॉगिन का उपयोग करें।');
    }

    // Local simulated auth: beneficiary only, never admin.
    const user: AppUser = {
      uid: 'user_' + Math.abs(cleanEmail.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)),
      email: cleanEmail,
      displayName: cleanEmail.split('@')[0],
      isAnonymous: false,
      role: 'beneficiary',
      isLocal: true
    };
    this.currentUser = user;
    this.notifyListeners();
    return user;
  }

  /**
   * Google sign-in. Strictly authorizes Super Admins and active Sub-Admins registered in /sub_admins.
   * Unauthorized Google accounts receive role 'beneficiary' and are blocked from Admin Panel.
   */
  public async loginWithGoogle(): Promise<AppUser> {
    if (!this.auth) {
      throw new Error('Google लॉगिन के लिए इंटरनेट आवश्यक है। (Google sign-in needs an online Firebase connection)');
    }
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const res = await signInWithPopup(this.auth, provider);
      const user = await this.resolveAppUser(res.user);
      if (user.role === 'sub_admin' && user.email) {
        subAdminService.recordSubAdminLogin(user.email).catch(() => {});
      }
      this.currentUser = user;
      this.notifyListeners();
      return user;
    } catch (err: any) {
      const code: string = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        throw new Error('Google विंडो बंद कर दी गई। (Sign-in cancelled)');
      }
      if (code === 'auth/unauthorized-domain') {
        throw new Error('यह वेबसाइट Firebase Authorized domains में नहीं है। (Add this domain in Firebase Authentication → Settings → Authorized domains)');
      }
      if (code === 'auth/operation-not-allowed') {
        throw new Error('Firebase Console में Google sign-in चालू करें। (Enable Google provider in Firebase Authentication)');
      }
      throw new Error('Google लॉगिन विफल रहा। (Google sign-in failed)');
    }
  }

  public async registerWithEmail(email: string, pass: string, name?: string): Promise<AppUser> {
    if (isRealFirebaseConfigured && this.auth) {
      const res = await createUserWithEmailAndPassword(this.auth, email.trim(), pass);
      const user: AppUser = { ...this.toAppUser(res.user), displayName: name || res.user.displayName };
      this.currentUser = user;
      this.notifyListeners();
      return user;
    }

    const user: AppUser = {
      uid: 'user_' + Date.now(),
      email,
      displayName: name || email.split('@')[0],
      isAnonymous: false,
      role: 'beneficiary',
      isLocal: true
    };
    this.currentUser = user;
    this.notifyListeners();
    return user;
  }

  public async loginAsGuest(): Promise<AppUser> {
    if (isRealFirebaseConfigured && this.auth) {
      try {
        const res = await signInAnonymously(this.auth);
        const user: AppUser = { ...this.toAppUser(res.user), displayName: 'Guest Beneficiary' };
        this.currentUser = user;
        this.notifyListeners();
        return user;
      } catch (e) {
        console.warn('Anonymous sign-in failed, using local guest:', e);
      }
    }

    const user: AppUser = {
      uid: 'guest_' + Math.random().toString(36).substring(2, 9),
      email: null,
      displayName: 'Guest Beneficiary',
      isAnonymous: true,
      role: 'beneficiary',
      isLocal: true
    };
    this.currentUser = user;
    this.notifyListeners();
    return user;
  }

  public async logout(): Promise<void> {
    if (isRealFirebaseConfigured && this.auth) {
      await fbSignOut(this.auth);
    }
    this.currentUser = null;
    this.notifyListeners();
  }

  public async deleteAccount(): Promise<void> {
    if (isRealFirebaseConfigured && this.auth && this.auth.currentUser) {
      await this.auth.currentUser.delete();
    }
    this.currentUser = null;
    this.notifyListeners();
  }
}

export const authService = new AuthService();

function deviceUid(): string {
  try {
    const stored = localStorage.getItem(DEVICE_UID_KEY);
    if (stored) return stored;
    const uid = 'device_user_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
    localStorage.setItem(DEVICE_UID_KEY, uid);
    return uid;
  } catch {
    return 'device_user_default';
  }
}

export interface AdminUserRecord {
  id: string;
  uid: string;
  name: string;
  phone: string;
  status: 'pending' | 'completed';
  education: string;
  skills: string;
  interests: string;
  location: string;
  state: string;
  occupation: string;
  workType: string;
  mobility: string;
  matchedPathwayName: string;
  matchScore: number;
  completionPercent: number;
  missingFields: string[];
  createdAt: string;
  updatedAt: string;
  lastActive: string;
  activeNow: boolean;
  avatarUrl?: string;
}

export function computeAdminUserRecord(data: any, docId: string): AdminUserRecord {
  const uid = data?.uid || docId;
  let phone = data?.phone || '';
  if (!phone && data?.email && data.email.endsWith('@' + PHONE_EMAIL_DOMAIN)) {
    phone = data.email.split('@')[0];
  }
  if (!phone && docId.startsWith('user_phone_')) {
    phone = docId.replace('user_phone_', '');
  }

  const rawName = (data?.name || data?.displayName || '').trim();
  const isGenericName = !rawName || rawName.toLowerCase().startsWith('user') || rawName.includes('नागरिक');
  const name = rawName || (phone ? `नागरिक (${phone.slice(-4)})` : 'पंजीकृत नागरिक');

  const education = (data?.education || '').trim();
  const skills = (data?.skills || '').trim();
  const location = (data?.location || '').trim();

  const missingFields: string[] = [];
  if (isGenericName) missingFields.push('नाम');
  if (!education) missingFields.push('शिक्षा स्तर');
  if (!skills) missingFields.push('हुनर / अनुभव');
  if (!location) missingFields.push('जिला व क्षेत्र');

  // Calculate profile completion percentage based on core livelihood parameters
  let scoreParts = 0;
  if (!isGenericName && rawName.length > 1) scoreParts += 25;
  if (education.length > 1) scoreParts += 25;
  if (skills.length > 1) scoreParts += 25;
  if (location.length > 1) scoreParts += 25;

  const isComplete = missingFields.length === 0;
  const status: 'pending' | 'completed' = isComplete ? 'completed' : 'pending';

  // Region / State detection
  let state = (data?.state || '').trim();
  if (!state && location) {
    // If location is formatted as "District, State", extract the state directly
    if (location.includes(',')) {
      const parts = location.split(',').map((p: string) => p.trim());
      if (parts.length >= 2 && parts[1].length > 1) {
        state = parts[1];
      }
    }

    if (!state) {
      const locLower = location.toLowerCase();
      if (locLower.includes('bihar') || locLower.includes('बिहार') || locLower.includes('patna') || locLower.includes('gaya') || locLower.includes('muzaffarpur')) {
        state = 'Bihar';
      } else if (locLower.includes('delhi') || locLower.includes('दिल्ली')) {
        state = 'Delhi NCR';
      } else if (locLower.includes('maharashtra') || locLower.includes('महाराष्ट्र') || locLower.includes('pune') || locLower.includes('mumbai') || locLower.includes('nagpur')) {
        state = 'Maharashtra';
      } else if (locLower.includes('rajasthan') || locLower.includes('राजस्थान') || locLower.includes('jaipur') || locLower.includes('jodhpur')) {
        state = 'Rajasthan';
      } else if (locLower.includes('madhya') || locLower.includes('मध्य') || locLower.includes('bhopal') || locLower.includes('indore')) {
        state = 'Madhya Pradesh';
      } else if (locLower.includes('jharkhand') || locLower.includes('झारखंड') || locLower.includes('ranchi') || locLower.includes('dhanbad')) {
        state = 'Jharkhand';
      } else if (locLower.includes('haryana') || locLower.includes('हरियाणा') || locLower.includes('gurugram') || locLower.includes('karnal') || locLower.includes('faridabad')) {
        state = 'Haryana';
      } else if (locLower.includes('west bengal') || locLower.includes('बंगाल') || locLower.includes('kolkata')) {
        state = 'West Bengal';
      } else if (locLower.includes('punjab') || locLower.includes('पंजाब') || locLower.includes('amritsar') || locLower.includes('ludhiana')) {
        state = 'Punjab';
      } else if (locLower.includes('gujarat') || locLower.includes('गुजरात') || locLower.includes('ahmedabad') || locLower.includes('surat')) {
        state = 'Gujarat';
      } else if (locLower.includes('uttarakhand') || locLower.includes('उत्तराखंड') || locLower.includes('dehradun')) {
        state = 'Uttarakhand';
      } else if (locLower.includes('chhattisgarh') || locLower.includes('छत्तीसगढ़') || locLower.includes('raipur')) {
        state = 'Chhattisgarh';
      } else if (locLower.includes('odisha') || locLower.includes('ओडिशा') || locLower.includes('bhubaneswar')) {
        state = 'Odisha';
      } else if (locLower.includes('himachal') || locLower.includes('शिमला') || locLower.includes('shimla')) {
        state = 'Himachal Pradesh';
      } else if (locLower.includes('karnataka') || locLower.includes('कर्नाटक') || locLower.includes('bengaluru') || locLower.includes('bangalore')) {
        state = 'Karnataka';
      } else if (locLower.includes('tamil') || locLower.includes('तमिल') || locLower.includes('chennai')) {
        state = 'Tamil Nadu';
      } else if (locLower.includes('telangana') || locLower.includes('तेलंगाना') || locLower.includes('hyderabad')) {
        state = 'Telangana';
      } else if (locLower.includes('andhra') || locLower.includes('आंध्र') || locLower.includes('visakhapatnam')) {
        state = 'Andhra Pradesh';
      } else if (locLower.includes('kerala') || locLower.includes('केरल') || locLower.includes('kochi')) {
        state = 'Kerala';
      } else if (locLower.includes('assam') || locLower.includes('असम') || locLower.includes('guwahati')) {
        state = 'Assam';
      } else if (locLower.includes('uttar') || locLower.includes('उत्तर') || locLower.includes('gorakhpur') || locLower.includes('lucknow') || locLower.includes('varanasi') || locLower.includes('maharajganj') || locLower.includes('ghaziabad')) {
        state = 'Uttar Pradesh';
      } else {
        state = 'Uttar Pradesh';
      }
    }
  } else if (!state) {
    state = 'Uttar Pradesh';
  }

  // Active status calculation
  const lastActiveTimestamp = data?.lastActive || data?.updatedAt || data?.createdAt || '';
  let activeNow = Boolean(data?.activeNow);
  if (lastActiveTimestamp) {
    const elapsedMinutes = (Date.now() - new Date(lastActiveTimestamp).getTime()) / (1000 * 60);
    if (!isNaN(elapsedMinutes) && elapsedMinutes <= 20) {
      activeNow = true;
    }
  }

  return {
    id: docId,
    uid,
    name,
    phone,
    status,
    education: education || 'जानकारी दर्ज नहीं',
    skills: skills || 'हुनर दर्ज नहीं (मूल्यांकन बाकी)',
    interests: data?.interests || 'सामान्य आजीविका व कौशल',
    location: location || 'जिला अनिर्धारित',
    state,
    occupation: data?.occupation || 'रोजगार / स्वरोजगार आकांक्षी',
    workType: data?.workType || 'रोजगार / स्वरोजगार',
    mobility: data?.mobility || 'अपने जिले में',
    matchedPathwayName: data?.matchedPathwayName || (isComplete ? 'डिजिटल सेवा व स्वरोजगार केंद्र' : 'कौशल मूल्यांकन लंबित'),
    matchScore: data?.matchScore || (isComplete ? 92 : 35),
    completionPercent: scoreParts,
    missingFields,
    createdAt: data?.createdAt || data?.updatedAt || new Date().toISOString(),
    updatedAt: data?.updatedAt || new Date().toISOString(),
    lastActive: lastActiveTimestamp || new Date().toISOString(),
    activeNow,
    avatarUrl: data?.avatarUrl || '',
  };
}

// Firestore User Profile Sync
export const firestoreService = {
  /**
   * Saves the profile under users/{uid}. Cloud writes only happen for a real Firebase session
   * (signed-in or anonymous guest) because firestore.rules require request.auth.uid == userId.
   * Without one, the profile stays on the device.
   */
  async syncLocalProfileToFirestore(profile: BeneficiaryProfile): Promise<string> {
    const cloudUid = await authService.ensureCloudUid();
    const uid = authService.getCurrentUser()?.uid || cloudUid || deviceUid();
    await this.saveUserProfile(uid, profile, true, true);
    return uid;
  },

  async saveUserProfile(
    uid: string,
    profile: BeneficiaryProfile,
    consentSaved: boolean = true,
    cloudAllowed: boolean = true
  ) {
    const isComplete = Boolean(
      profile.name && profile.name.trim() && !profile.name.toLowerCase().startsWith('user') &&
      profile.skills && profile.skills.trim() &&
      profile.location && profile.location.trim() &&
      profile.education && profile.education.trim()
    );
    const phone = profile.phone || authService.getCurrentUser()?.phone;

    const payload = clean({
      ...profile,
      uid,
      phone: phone || profile.phone || undefined,
      status: isComplete ? 'completed' : 'pending',
      consentSaved,
      updatedAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      activeNow: true
    });

    // 1. Always update local storage first so offline experience is immediate
    try {
      localStorage.setItem(`jeevika_firestore_user_${uid}`, JSON.stringify(payload));
    } catch (e) {}

    // 2. Persist to real Firebase Firestore
    if (isRealFirebaseConfigured && cloudAllowed) {
      try {
        await setDoc(doc(getDb(), 'users', uid), payload, { merge: true });
        return true;
      } catch (e: any) {
        handleFirestoreError(e, OperationType.WRITE, `users/${uid}`);
        console.warn('Firestore cloud save notice:', e?.code || e?.message || e);
      }
    }

    return true;
  },

  async getUserProfile(uid: string): Promise<BeneficiaryProfile | null> {
    if (isRealFirebaseConfigured) {
      try {
        const snap = await getDoc(doc(getDb(), 'users', uid));
        if (snap.exists()) {
          return snap.data() as BeneficiaryProfile;
        }
      } catch (e: any) {
        console.warn('Firestore fetch failed:', e?.code || e?.message || e);
      }
    }

    try {
      const data = localStorage.getItem(`jeevika_firestore_user_${uid}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Retrieves all live user accounts from Firestore, local phone registration store, and device state.
   * Strips out duplicate accounts and returns clean, unified AdminUserRecord array.
   */
  async getAllUsers(): Promise<AdminUserRecord[]> {
    const userMap = new Map<string, AdminUserRecord>();

    // 1. Query Firestore users collection
    if (isRealFirebaseConfigured) {
      try {
        const snap = await getDocs(collection(getDb(), 'users'));
        snap.forEach((d) => {
          const rec = computeAdminUserRecord(d.data(), d.id);
          userMap.set(rec.uid, rec);
        });
      } catch (e: any) {
        handleFirestoreError(e, OperationType.LIST, 'users');
        console.warn('Could not fetch users collection from firestore:', e);
      }
    }

    // 2. Merge local phone accounts registered on this terminal / device
    try {
      const localAccs = getLocalPhoneAccounts();
      Object.values(localAccs).forEach((acc) => {
        let prof: any = null;
        try {
          const raw = localStorage.getItem(`jeevika_firestore_user_${acc.uid}`);
          if (raw) prof = JSON.parse(raw);
        } catch {}
        const merged = {
          ...prof,
          uid: acc.uid,
          phone: acc.phone,
          name: prof?.name || acc.name || `नागरिक (${acc.phone.slice(-4)})`,
          createdAt: prof?.createdAt || acc.createdAt
        };
        const rec = computeAdminUserRecord(merged, acc.uid);
        if (!userMap.has(acc.uid)) {
          userMap.set(acc.uid, rec);
        } else {
          // If firestore doc was incomplete but local has phone, ensure phone is set
          const existing = userMap.get(acc.uid)!;
          if (!existing.phone && acc.phone) {
            existing.phone = acc.phone;
          }
        }
      });
    } catch {}

    // 3. Merge active session profile if available
    try {
      const liveProfRaw = localStorage.getItem('jeevika_profile_v2');
      if (liveProfRaw) {
        const p = JSON.parse(liveProfRaw);
        const currUid = authService.getCurrentUser()?.uid || 'device_active_user';
        if (p && (p.name || p.phone)) {
          const rec = computeAdminUserRecord({ ...p, uid: currUid, activeNow: true }, currUid);
          if (!userMap.has(currUid)) {
            userMap.set(currUid, rec);
          }
        }
      }
    } catch {}

    return Array.from(userMap.values()).sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  },

  /**
   * Real-time subscription to the Firestore users collection.
   */
  subscribeUsers(onUpdate: (users: AdminUserRecord[]) => void): () => void {
    if (!isRealFirebaseConfigured) {
      this.getAllUsers().then(onUpdate);
      return () => {};
    }
    try {
      const colRef = collection(getDb(), 'users');
      const unsubscribe = onSnapshot(
        colRef,
        async () => {
          const allUsers = await this.getAllUsers();
          onUpdate(allUsers);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'users');
          this.getAllUsers().then(onUpdate);
        }
      );
      return unsubscribe;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, 'users');
      this.getAllUsers().then(onUpdate);
      return () => {};
    }
  },

  async deleteUserData(uid: string): Promise<boolean> {
    if (isRealFirebaseConfigured) {
      try {
        await deleteDoc(doc(getDb(), 'users', uid));
      } catch (e) {}
    }

    try {
      localStorage.removeItem(`jeevika_firestore_user_${uid}`);
      return true;
    } catch (e) {
      return false;
    }
  }
};

export type ContentCollection = 'opportunities' | 'pathways' | 'training_centers';

/**
 * Admin-managed content. Reads are public (see firestore.rules); writes require an admin session.
 * Every call fails soft so the app keeps working offline with its built-in data.
 */
export const contentService = {
  async list<T = any>(name: ContentCollection): Promise<T[]> {
    try {
      const snap = await getDocs(collection(getDb(), name));
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }) as T);
    } catch (e: any) {
      console.warn(`Could not load ${name} from Firestore:`, e?.code || e?.message || e);
      return [];
    }
  },

  /**
   * Real-time subscription to a Firestore content collection.
   * Invokes onUpdate with array of documents on snapshot updates.
   * Includes strict handleFirestoreError callback per Firebase skill directives.
   */
  subscribe<T = any>(
    name: ContentCollection,
    onUpdate: (items: T[]) => void,
    onError?: (error: any) => void
  ): () => void {
    if (!isRealFirebaseConfigured) {
      return () => {};
    }
    try {
      const colRef = collection(getDb(), name);
      const unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          const items = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }) as T);
          onUpdate(items);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, name);
          if (onError) onError(error);
        }
      );
      return unsubscribe;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, name);
      if (onError) onError(err);
      return () => {};
    }
  },

  async upsert(name: ContentCollection, id: string, data: Record<string, any>): Promise<boolean> {
    try {
      await setDoc(doc(getDb(), name, id), clean({ ...data, id, updatedAt: new Date().toISOString() }), { merge: true });
      return true;
    } catch (e: any) {
      console.warn(`Could not save ${name}/${id}:`, e?.code || e?.message || e);
      return false;
    }
  },

  async remove(name: ContentCollection, id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(getDb(), name, id));
      return true;
    } catch (e: any) {
      console.warn(`Could not delete ${name}/${id}:`, e?.code || e?.message || e);
      return false;
    }
  }
};

// ============================================================================
// Sub-Admin RBAC Management & Immutable 7-Day Activity Audit Trail
// ============================================================================
const EMAIL_REGEX = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const subAdminService = {
  normalizeEmail(raw: string): string {
    return String(raw || '').trim().toLowerCase();
  },

  isValidEmail(raw: string): boolean {
    const email = this.normalizeEmail(raw);
    return email.length >= 5 && email.length <= 150 && EMAIL_REGEX.test(email);
  },

  /** Checks whether an email is an active Sub-Admin in Firestore /sub_admins/{email} */
  async checkSubAdminAccess(rawEmail: string): Promise<SubAdminRecord | null> {
    const email = this.normalizeEmail(rawEmail);
    if (!this.isValidEmail(email) || !isRealFirebaseConfigured) return null;
    try {
      const snap = await getDoc(doc(getDb(), 'sub_admins', email));
      if (!snap.exists()) return null;
      const data = snap.data() as SubAdminRecord;
      if (data.active !== true) return null;
      return { ...data, email: data.email || email };
    } catch (err: any) {
      console.warn('Sub-admin lookup notice:', err?.code || err?.message || err);
      return null;
    }
  },

  /** Updates lastLoginAt timestamp when an active Sub-Admin logs in via Google */
  async recordSubAdminLogin(rawEmail: string): Promise<void> {
    const email = this.normalizeEmail(rawEmail);
    if (!this.isValidEmail(email) || !isRealFirebaseConfigured) return;
    try {
      const now = new Date().toISOString();
      await setDoc(
        doc(getDb(), 'sub_admins', email),
        clean({ lastLoginAt: now, updatedAt: now }),
        { merge: true }
      );
    } catch (err: any) {
      console.warn('Sub-admin login stamp notice:', err?.code || err?.message || err);
    }
  },

  /** Real-time subscription to all Sub-Admins (Super Admin only) */
  subscribeSubAdmins(
    onUpdate: (items: SubAdminRecord[]) => void,
    onError?: (error: any) => void
  ): () => void {
    if (!isRealFirebaseConfigured) {
      onUpdate([]);
      return () => {};
    }
    try {
      return onSnapshot(
        collection(getDb(), 'sub_admins'),
        (snapshot) => {
          const list = snapshot.docs
            .map((d) => {
              const data = d.data() as Partial<SubAdminRecord>;
              return {
                email: data.email || d.id,
                name: data.name || (data.email || d.id).split('@')[0],
                note: data.note || '',
                active: data.active !== false,
                addedBy: data.addedBy || 'Super Admin',
                addedAt: data.addedAt || new Date().toISOString(),
                lastLoginAt: data.lastLoginAt,
                updatedAt: data.updatedAt,
              } as SubAdminRecord;
            })
            .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
          onUpdate(list);
        },
        (error) => {
          console.warn('Sub-admins subscription error:', error?.code || error?.message);
          if (onError) onError(error);
        }
      );
    } catch (err) {
      if (onError) onError(err);
      return () => {};
    }
  },

  /** Adds or reactivates a Sub-Admin by Gmail address (Super Admin only) */
  async addSubAdmin(input: {
    email: string;
    name?: string;
    note?: string;
    addedBy: string;
  }): Promise<SubAdminRecord> {
    const email = this.normalizeEmail(input.email);
    if (!this.isValidEmail(email)) {
      throw new Error('कृपया एक वैध Gmail / Email पता दर्ज करें। (Please enter a valid Gmail address)');
    }
    if (isSuperAdminEmail(email)) {
      throw new Error('यह ईमेल पहले से ही Super Admin है।');
    }
    const now = new Date().toISOString();
    const record: SubAdminRecord = {
      email,
      name: (input.name || '').trim().slice(0, 120) || email.split('@')[0],
      note: (input.note || '').trim().slice(0, 200),
      active: true,
      addedBy: this.normalizeEmail(input.addedBy) || 'super-admin',
      addedAt: now,
      updatedAt: now,
    };

    if (!isRealFirebaseConfigured) {
      throw new Error('Firebase कनेक्शन उपलब्ध नहीं है।');
    }

    await setDoc(doc(getDb(), 'sub_admins', email), clean(record));
    return record;
  },

  /** Enables or pauses a Sub-Admin's access */
  async toggleSubAdminStatus(rawEmail: string, active: boolean): Promise<void> {
    const email = this.normalizeEmail(rawEmail);
    if (!this.isValidEmail(email) || !isRealFirebaseConfigured) return;
    await setDoc(
      doc(getDb(), 'sub_admins', email),
      clean({ active: Boolean(active), updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  },

  /** Permanently revokes and deletes a Sub-Admin */
  async removeSubAdmin(rawEmail: string): Promise<void> {
    const email = this.normalizeEmail(rawEmail);
    if (!this.isValidEmail(email) || !isRealFirebaseConfigured) return;
    await deleteDoc(doc(getDb(), 'sub_admins', email));
  },

  /** Records an immutable ADD / UPDATE / DELETE activity log entry for the current admin or sub-admin */
  async logAdminActivity(entry: {
    action: AdminActivityAction;
    section: string;
    targetTitle: string;
    targetId?: string;
    details?: string;
    actor?: AppUser | null;
  }): Promise<void> {
    if (!isRealFirebaseConfigured) return;
    const actor = entry.actor || authService.getCurrentUser();
    if (!actor || !actor.email || !isAdminUser(actor)) return;

    const actorEmail = this.normalizeEmail(actor.email);
    const actorRole: 'admin' | 'sub_admin' = isSuperAdminUser(actor) ? 'admin' : 'sub_admin';
    const nowMs = Date.now();
    const logId = `act_${nowMs}_${Math.random().toString(36).slice(2, 8)}`;

    const payload: AdminActivityRecord = {
      id: logId,
      actorEmail,
      actorName: (actor.displayName || actorEmail.split('@')[0]).slice(0, 120),
      actorRole,
      action: entry.action,
      section: String(entry.section || 'general').slice(0, 64),
      targetTitle: String(entry.targetTitle || 'Item').trim().slice(0, 240) || 'Item',
      targetId: entry.targetId ? String(entry.targetId).slice(0, 128) : undefined,
      details: entry.details ? String(entry.details).trim().slice(0, 500) : undefined,
      createdAt: new Date(nowMs).toISOString(),
      timestampMs: nowMs,
    };

    try {
      await setDoc(doc(getDb(), 'admin_activity_logs', logId), clean(payload));
    } catch (err: any) {
      console.warn('Could not write admin activity log:', err?.code || err?.message || err);
    }
  },

  /**
   * Real-time subscription to the last N days (default 7 days) of admin activity logs.
   * When actorEmailFilter is provided, queries only that actor's logs (safe for Sub-Admin rules & zero composite index needed).
   */
  subscribeRecentActivity(
    days: number,
    onUpdate: (logs: AdminActivityRecord[]) => void,
    onError?: (error: any) => void,
    actorEmailFilter?: string
  ): () => void {
    if (!isRealFirebaseConfigured) {
      onUpdate([]);
      return () => {};
    }
    const windowMs = (days > 0 ? days : 7) * 24 * 60 * 60 * 1000;
    try {
      const colRef = collection(getDb(), 'admin_activity_logs');
      const sourceRef = actorEmailFilter
        ? query(colRef, where('actorEmail', '==', this.normalizeEmail(actorEmailFilter)))
        : colRef;

      return onSnapshot(
        sourceRef,
        (snapshot) => {
          const cutoff = Date.now() - Math.min(windowMs, SEVEN_DAYS_MS * 4);
          const logs = snapshot.docs
            .map((d) => {
              const data = d.data() as Partial<AdminActivityRecord>;
              const ts = typeof data.timestampMs === 'number'
                ? data.timestampMs
                : (data.createdAt ? new Date(data.createdAt).getTime() : 0);
              return {
                id: data.id || d.id,
                actorEmail: this.normalizeEmail(data.actorEmail || ''),
                actorName: data.actorName || (data.actorEmail || '').split('@')[0] || 'Admin',
                actorRole: data.actorRole === 'admin' ? 'admin' : 'sub_admin',
                action: (data.action === 'ADD' || data.action === 'DELETE' || data.action === 'UPDATE') ? data.action : 'UPDATE',
                section: data.section || 'general',
                targetTitle: data.targetTitle || 'Activity',
                targetId: data.targetId,
                details: data.details,
                createdAt: data.createdAt || new Date(ts || Date.now()).toISOString(),
                timestampMs: ts,
              } as AdminActivityRecord;
            })
            .filter((item) => item.timestampMs >= cutoff)
            .sort((a, b) => b.timestampMs - a.timestampMs);
          onUpdate(logs);
        },
        (error) => {
          console.warn('Activity logs subscription error:', error?.code || error?.message);
          if (onError) onError(error);
        }
      );
    } catch (err) {
      if (onError) onError(err);
      return () => {};
    }
  }
};

// ============================================================================
// Cross-Device Push Notification Broadcasts & Web Push Subscription Registry
// ============================================================================
const LOCAL_NOTIF_QUEUE_KEY = 'jeevika_push_queue';

export const notificationService = {
  /** Publishes a broadcast or targeted citizen notification to Firestore /notifications/{id} */
  async publishNotification(input: {
    target: 'all' | 'specific';
    targetUserId?: string;
    targetPhone?: string;
    targetName?: string;
    title: string;
    body: string;
    url?: string;
    sentBy?: string;
    pushDeliveredCount?: number;
  }): Promise<{ record: PushNotificationRecord; syncedToCloud: boolean }> {
    const nowMs = Date.now();
    const id = `notif_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;
    const record: PushNotificationRecord = {
      id,
      target: input.target === 'specific' ? 'specific' : 'all',
      targetUserId: input.targetUserId ? String(input.targetUserId).trim().slice(0, 128) : undefined,
      targetPhone: input.targetPhone ? normalizePhone(input.targetPhone) || undefined : undefined,
      targetName: input.targetName ? String(input.targetName).trim().slice(0, 150) : undefined,
      title: String(input.title || '').trim().slice(0, 200),
      body: String(input.body || '').trim().slice(0, 1000),
      url: String(input.url || '/').trim().slice(0, 300),
      sentBy: input.sentBy ? String(input.sentBy).trim().slice(0, 150) : 'Admin',
      pushDeliveredCount: typeof input.pushDeliveredCount === 'number' ? input.pushDeliveredCount : 0,
      createdAt: new Date(nowMs).toISOString(),
      timestampMs: nowMs,
    };

    try {
      const existing = JSON.parse(localStorage.getItem(LOCAL_NOTIF_QUEUE_KEY) || '[]');
      const next = [record, ...(Array.isArray(existing) ? existing : [])].slice(0, 50);
      localStorage.setItem(LOCAL_NOTIF_QUEUE_KEY, JSON.stringify(next));
    } catch {}

    let syncedToCloud = false;
    if (isRealFirebaseConfigured) {
      try {
        await setDoc(doc(getDb(), 'notifications', id), clean(record));
        syncedToCloud = true;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `notifications/${id}`);
      }
    }

    return { record, syncedToCloud };
  },

  /** Real-time subscription to all broadcast and targeted notifications */
  subscribeNotifications(
    onUpdate: (items: PushNotificationRecord[]) => void,
    onError?: (error: any) => void
  ): () => void {
    if (!isRealFirebaseConfigured) {
      try {
        const local = JSON.parse(localStorage.getItem(LOCAL_NOTIF_QUEUE_KEY) || '[]');
        onUpdate(Array.isArray(local) ? local : []);
      } catch {
        onUpdate([]);
      }
      return () => {};
    }

    try {
      return onSnapshot(
        collection(getDb(), 'notifications'),
        (snapshot) => {
          const items = snapshot.docs
            .map((d) => {
              const data = d.data() as Partial<PushNotificationRecord>;
              const ts =
                typeof data.timestampMs === 'number'
                  ? data.timestampMs
                  : data.createdAt
                  ? new Date(data.createdAt).getTime()
                  : 0;
              return {
                id: data.id || d.id,
                target: data.target === 'specific' ? 'specific' : 'all',
                targetUserId: data.targetUserId,
                targetPhone: data.targetPhone,
                targetName: data.targetName,
                title: data.title || 'JeevikaAI Update',
                body: data.body || '',
                url: data.url || '/',
                sentBy: data.sentBy,
                pushDeliveredCount: data.pushDeliveredCount ?? 0,
                createdAt: data.createdAt || new Date(ts || Date.now()).toISOString(),
                timestampMs: ts,
              } as PushNotificationRecord;
            })
            .sort((a, b) => b.timestampMs - a.timestampMs);
          onUpdate(items);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'notifications');
          if (onError) onError(error);
        }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'notifications');
      if (onError) onError(err);
      return () => {};
    }
  },

  /** Saves or updates a citizen device Web Push subscription in Firestore /push_subscriptions/{id} */
  async savePushSubscription(docData: PushSubscriptionDoc): Promise<boolean> {
    if (!isRealFirebaseConfigured || !docData?.id || !docData?.endpoint) return false;
    try {
      await setDoc(doc(getDb(), 'push_subscriptions', docData.id), clean(docData), { merge: true });
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `push_subscriptions/${docData.id}`);
      return false;
    }
  },

  /** Lists all stored Web Push subscriptions from Firestore */
  async getPushSubscriptions(): Promise<PushSubscriptionDoc[]> {
    if (!isRealFirebaseConfigured) return [];
    try {
      const snap = await getDocs(collection(getDb(), 'push_subscriptions'));
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<PushSubscriptionDoc, 'id'>) }) as PushSubscriptionDoc)
        .filter((s) => Boolean(s.endpoint && s.subscription?.keys?.p256dh));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'push_subscriptions');
      return [];
    }
  },

  /** Real-time subscription to registered Web Push devices for AdminCMSView */
  subscribePushSubscriptions(
    onUpdate: (items: PushSubscriptionDoc[]) => void,
    onError?: (error: any) => void
  ): () => void {
    if (!isRealFirebaseConfigured) {
      onUpdate([]);
      return () => {};
    }
    try {
      return onSnapshot(
        collection(getDb(), 'push_subscriptions'),
        (snap) => {
          const items = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<PushSubscriptionDoc, 'id'>) }) as PushSubscriptionDoc)
            .filter((s) => Boolean(s.endpoint && s.subscription?.keys?.p256dh));
          onUpdate(items);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'push_subscriptions');
          if (onError) onError(error);
        }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'push_subscriptions');
      if (onError) onError(err);
      return () => {};
    }
  },

  async removePushSubscription(id: string): Promise<void> {
    if (!isRealFirebaseConfigured || !id) return;
    try {
      await deleteDoc(doc(getDb(), 'push_subscriptions', id));
    } catch {}
  },
};


