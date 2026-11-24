import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icon } from './Icons';
import { Opportunity, Pathway, AppView, MediaAssetRecord, ShowcaseProduct } from '../types';
import { JOBS, PATHWAYS } from '../data/mockData';
import {
  AppUser,
  isAdminUser,
  isSuperAdminUser,
  isSubAdminUser,
  contentService,
  firestoreService,
  subAdminService,
  AdminUserRecord,
  SubAdminRecord,
  AdminActivityRecord,
  AdminActivityAction,
} from '../services/firebase';
import { mediaStorageService, uploadToCloudinary } from '../services/cloudinaryService';
import appletConfig from '../../firebase-applet-config.json';

interface AdminCMSViewProps {
  currentUser?: AppUser | null;
  onNotify: (msg: string) => void;
  go: (route: AppView | string) => void;
  onOpenLogin?: () => void;
  onLogout?: () => void;
}

export interface DistrictIntelligenceItem {
  district: string;
  state: string;
  users: number;
  jobs: number;
  topSkill: string;
  pmkvyCenter: string;
  isDynamicUserDistrict?: boolean;
}

const BASE_DISTRICT_INTELLIGENCE: DistrictIntelligenceItem[] = [
  { district: 'Maharajganj', state: 'Uttar Pradesh', users: 142, jobs: 18, topSkill: 'Digital Typing & CSC', pmkvyCenter: 'Active (2 Centers)' },
  { district: 'Gorakhpur', state: 'Uttar Pradesh', users: 284, jobs: 35, topSkill: 'Solar PV & Electrical', pmkvyCenter: 'Active (5 Centers)' },
  { district: 'Varanasi', state: 'Uttar Pradesh', users: 310, jobs: 42, topSkill: 'Handloom & Garment', pmkvyCenter: 'Active (4 Centers)' },
  { district: 'Patna', state: 'Bihar', users: 395, jobs: 54, topSkill: 'Computer & Office Assistant', pmkvyCenter: 'Active (6 Centers)' },
  { district: 'Gaya', state: 'Bihar', users: 165, jobs: 21, topSkill: 'Solar & Agri-Machinery', pmkvyCenter: 'Active (2 Centers)' },
  { district: 'South Delhi', state: 'Delhi NCR', users: 520, jobs: 88, topSkill: 'Retail, Delivery & IT Support', pmkvyCenter: 'Active (8 Centers)' },
  { district: 'Pune', state: 'Maharashtra', users: 412, jobs: 76, topSkill: 'Accounts, CAD & Manufacturing', pmkvyCenter: 'Active (7 Centers)' },
  { district: 'Jaipur', state: 'Rajasthan', users: 290, jobs: 46, topSkill: 'EV Technician & Handicrafts', pmkvyCenter: 'Active (4 Centers)' },
  { district: 'Bhopal', state: 'Madhya Pradesh', users: 210, jobs: 31, topSkill: 'Food Processing & Dairy', pmkvyCenter: 'Active (3 Centers)' },
];

export const AdminCMSView: React.FC<AdminCMSViewProps> = ({
  currentUser,
  onNotify,
  go,
  onOpenLogin,
  onLogout,
}) => {
  const isAdmin = isAdminUser(currentUser);
  const isSuperAdmin = isSuperAdminUser(currentUser);
  const isSubAdmin = isSubAdminUser(currentUser);

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'jobs' | 'pathways' | 'districts' | 'media' | 'notifications' | 'sub_admins'>('users');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Sub-Admin management & 7-day activity state
  const [subAdmins, setSubAdmins] = useState<SubAdminRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<AdminActivityRecord[]>([]);
  const [subAdminEmailInput, setSubAdminEmailInput] = useState<string>('');
  const [subAdminNameInput, setSubAdminNameInput] = useState<string>('');
  const [subAdminNoteInput, setSubAdminNoteInput] = useState<string>('');
  const [subAdminSubmitting, setSubAdminSubmitting] = useState<boolean>(false);
  const [subAdminError, setSubAdminError] = useState<string>('');
  const [subAdminRulesError, setSubAdminRulesError] = useState<boolean>(false);
  const [selectedSubAdminEmail, setSelectedSubAdminEmail] = useState<string | null>(null);
  const [activityActionFilter, setActivityActionFilter] = useState<'ALL' | AdminActivityAction>('ALL');
  const activityPanelRef = useRef<HTMLDivElement | null>(null);

  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('All India');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserRecord | null>(null);
  const [confirmActionKey, setConfirmActionKey] = useState<string | null>(null);
  const [waPreviewLink, setWaPreviewLink] = useState<{ name: string; phone: string; url: string } | null>(null);

  const [mediaAssets, setMediaAssets] = useState<MediaAssetRecord[]>([]);
  const [showcaseProducts, setShowcaseProducts] = useState<ShowcaseProduct[]>([]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [mediaDirectUrl, setMediaDirectUrl] = useState<string>('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaFolder, setMediaFolder] = useState<string>('banner');
  const [mediaUploading, setMediaUploading] = useState<boolean>(false);
  const [mediaUploadProgress, setMediaUploadProgress] = useState<number>(0);
  const [uploadBatchStatus, setUploadBatchStatus] = useState<string>('');
  const [mediaCtaUrl, setMediaCtaUrl] = useState('');
  const [mediaCtaLabel, setMediaCtaLabel] = useState('');
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [mediaCategoryFilter, setMediaCategoryFilter] = useState<string>('all');
  const [mediaStatusNotice, setMediaStatusNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [opportunities, setOpportunities] = useState<Opportunity[]>(() => {
    try {
      const saved = localStorage.getItem('jeevika_admin_jobs_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [...JOBS];
  });

  const [pathways, setPathways] = useState<Pathway[]>(() => {
    try {
      const saved = localStorage.getItem('jeevika_admin_pathways_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [...PATHWAYS];
  });

  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [showAddPathwayModal, setShowAddPathwayModal] = useState(false);

  const [jobTitle, setJobTitle] = useState('');
  const [jobOrg, setJobOrg] = useState('');
  const [jobType, setJobType] = useState<'Job' | 'Training' | 'Self-employment'>('Job');
  const [jobState, setJobState] = useState('Uttar Pradesh');
  const [jobLoc, setJobLoc] = useState('');
  const [jobPay, setJobPay] = useState('');
  const [jobMinEdu] = useState('10th Pass');
  const [jobEligibility, setJobEligibility] = useState('');
  const [jobContact, setJobContact] = useState('');

  const [pathwayName, setPathwayName] = useState('');
  const [pathwayHi, setPathwayHi] = useState('');
  const [pathwayRole, setPathwayRole] = useState('');
  const [pathwayNsqf, setPathwayNsqf] = useState<number>(3);
  const [pathwayDuration, setPathwayDuration] = useState('3 months (about 240 hours)');
  const [pathwayDemand] = useState<number>(3);

  const [notifTarget, setNotifTarget] = useState<'all' | 'specific'>('all');
  const [notifTargetUserId, setNotifTargetUserId] = useState<string>('');
  const [notifTitle, setNotifTitle] = useState<string>('JeevikaAI Livelihood Update');
  const [notifBody, setNotifBody] = useState<string>('आपके क्षेत्र में नए रोजगार और कौशल प्रशिक्षण अवसर जोड़े गए हैं।');
  const [notifSending, setNotifSending] = useState<boolean>(false);

  useEffect(() => {
    setIsLoadingUsers(true);
    firestoreService.getAllUsers().then((initialUsers) => {
      setUsers(initialUsers);
      setIsLoadingUsers(false);
    }).catch(() => {
      setIsLoadingUsers(false);
    });

    const unsubscribe = firestoreService.subscribeUsers((liveUsers) => {
      setUsers(liveUsers);
      setIsLoadingUsers(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadMediaAndShowcase = async () => {
    await mediaStorageService.syncLocalMediaToFirestore();
    const assets = await mediaStorageService.getMediaAssets();
    setMediaAssets(assets);
    const prods = await mediaStorageService.getShowcaseProducts();
    setShowcaseProducts(prods);
  };

  useEffect(() => {
    loadMediaAndShowcase();
    const unsub = mediaStorageService.subscribeMediaAssets((liveAssets) => {
      setMediaAssets(liveAssets);
    });
    const unsubJobs = contentService.subscribe<Opportunity>('opportunities', (liveJobs) => {
      if (liveJobs.length > 0) {
        setOpportunities((prev) => {
          const map = new Map<string, Opportunity>();
          liveJobs.forEach((j) => map.set(j.id, j));
          prev.forEach((j) => {
            if (!map.has(j.id)) map.set(j.id, j);
          });
          return Array.from(map.values());
        });
      }
    });
    const unsubPaths = contentService.subscribe<Pathway>('pathways', (livePaths) => {
      if (livePaths.length > 0) {
        setPathways((prev) => {
          const map = new Map<string, Pathway>();
          livePaths.forEach((p) => map.set(p.id, p));
          prev.forEach((p) => {
            if (!map.has(p.id)) map.set(p.id, p);
          });
          return Array.from(map.values());
        });
      }
    });
    return () => {
      unsub();
      unsubJobs();
      unsubPaths();
    };
  }, []);

  // Subscribe to Sub-Admins (Super Admin only) & Last 7 Days Activity Logs
  useEffect(() => {
    if (!isAdmin || !currentUser?.email) return;

    let unsubSubAdmins = () => {};
    if (isSuperAdmin) {
      unsubSubAdmins = subAdminService.subscribeSubAdmins(
        (list) => {
          setSubAdmins(list);
          setSubAdminRulesError(false);
        },
        (err) => {
          if (err?.code === 'permission-denied') {
            setSubAdminRulesError(true);
          }
        }
      );
    }

    const unsubLogs = subAdminService.subscribeRecentActivity(
      7,
      (logs) => {
        setActivityLogs(logs);
      },
      (err) => {
        if (err?.code === 'permission-denied') {
          setSubAdminRulesError(true);
        }
      },
      isSuperAdmin ? undefined : currentUser.email
    );

    return () => {
      unsubSubAdmins();
      unsubLogs();
    };
  }, [isAdmin, isSuperAdmin, currentUser?.email]);

  const logActivity = (
    action: AdminActivityAction,
    section: string,
    targetTitle: string,
    details?: string,
    targetId?: string
  ) => {
    subAdminService.logAdminActivity({
      action,
      section,
      targetTitle,
      targetId,
      details,
      actor: currentUser,
    });
  };

  useEffect(() => {
    try {
      localStorage.setItem('jeevika_admin_jobs_v2', JSON.stringify(opportunities));
    } catch {}
  }, [opportunities]);

  useEffect(() => {
    try {
      localStorage.setItem('jeevika_admin_pathways_v2', JSON.stringify(pathways));
    } catch {}
  }, [pathways]);

  const pendingUsersCount = useMemo(() => users.filter((u) => u.status === 'pending').length, [users]);
  const completedUsersCount = useMemo(() => users.filter((u) => u.status === 'completed').length, [users]);
  const activeNowUsersCount = useMemo(() => users.filter((u) => u.activeNow).length, [users]);

  const availableStates = useMemo<string[]>(() => {
    const stateSet = new Set<string>();
    ['Uttar Pradesh', 'Bihar', 'Delhi NCR', 'Maharashtra', 'Rajasthan', 'Madhya Pradesh'].forEach((s) => stateSet.add(s));
    users.forEach((u) => {
      const st = (u.state || '').trim();
      if (st && st !== 'All India' && st.toLowerCase() !== 'all') {
        stateSet.add(st);
      }
      if (u.location && u.location.includes(',')) {
        const parts = u.location.split(',').map((p) => p.trim());
        if (parts.length >= 2 && parts[1] && parts[1].length > 1) {
          stateSet.add(parts[1]);
        }
      }
    });
    opportunities.forEach((opp) => {
      if (opp.loc && opp.loc.includes(',')) {
        const parts = opp.loc.split(',').map((p) => p.trim());
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart.length > 1) {
          stateSet.add(lastPart);
        }
      }
    });
    const sorted = Array.from(stateSet).sort((a, b) => a.localeCompare(b));
    return ['All India', ...sorted];
  }, [users, opportunities]);

  const dynamicDistrictIntelligence = useMemo<DistrictIntelligenceItem[]>(() => {
    const map = new Map<string, DistrictIntelligenceItem>();
    BASE_DISTRICT_INTELLIGENCE.forEach((item) => {
      map.set(item.district.toLowerCase(), { ...item });
    });

    const cleanDistrictName = (raw: string): string => {
      if (!raw) return '';
      let d = raw.split(',')[0].trim();
      d = d.replace(/^(district|dist|city|town|तहसील|जिला)\s+/i, '');
      d = d.replace(/\s+(district|dist|city|town|तहसील|जिला)$/i, '');
      return d.trim();
    };

    users.forEach((u) => {
      const loc = (u.location || '').trim();
      if (!loc || loc === 'जिला अनिर्धारित') return;
      const districtName = cleanDistrictName(loc);
      if (!districtName || districtName.length < 2) return;

      const key = districtName.toLowerCase();
      const userState = u.state || (loc.includes(',') ? loc.split(',')[1].trim() : 'Uttar Pradesh');
      const existing = map.get(key);
      if (existing) {
        existing.users += 1;
        if (u.skills && !u.skills.includes('हुनर दर्ज नहीं')) {
          const primarySkill = u.skills.split(',')[0].trim();
          if (primarySkill && !existing.topSkill.toLowerCase().includes(primarySkill.toLowerCase())) {
            existing.topSkill = `${primarySkill}, ${existing.topSkill}`;
          }
        }
      } else {
        const userSkill = u.skills && !u.skills.includes('हुनर दर्ज नहीं')
          ? u.skills.split(',')[0].trim()
          : 'सामान्य आजीविका व कौशल (General Vocational)';
        map.set(key, {
          district: districtName,
          state: userState,
          users: 1,
          jobs: 0,
          topSkill: userSkill,
          pmkvyCenter: 'सक्रिय (Live District Center / PMKVY Node)',
          isDynamicUserDistrict: true,
        });
      }
    });

    opportunities.forEach((opp) => {
      if (!opp.loc) return;
      const districtName = cleanDistrictName(opp.loc);
      if (!districtName) return;
      const key = districtName.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.jobs += 1;
      } else {
        const oppState = opp.loc.includes(',') ? opp.loc.split(',')[1].trim() : 'Uttar Pradesh';
        map.set(key, {
          district: districtName,
          state: oppState,
          users: 0,
          jobs: 1,
          topSkill: opp.title,
          pmkvyCenter: 'सक्रिय रोजगार नोड (Live Job Center)',
          isDynamicUserDistrict: true,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.users - a.users);
  }, [users, opportunities]);

  const filteredDistricts = useMemo(() => {
    return dynamicDistrictIntelligence.filter((d) => {
      if (selectedStateFilter === 'All India') return true;
      return (
        d.state.toLowerCase().includes(selectedStateFilter.toLowerCase()) ||
        selectedStateFilter.toLowerCase().includes(d.state.toLowerCase())
      );
    });
  }, [dynamicDistrictIntelligence, selectedStateFilter]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (userStatusFilter === 'pending' && u.status !== 'pending') return false;
      if (userStatusFilter === 'completed' && u.status !== 'completed') return false;

      const matchState =
        selectedStateFilter === 'All India' ||
        u.state === selectedStateFilter ||
        u.location?.toLowerCase().includes(selectedStateFilter.toLowerCase());
      if (!matchState) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const cleanQPhone = q.replace(/\D/g, '');
      return (
        u.name?.toLowerCase().includes(q) ||
        (cleanQPhone && u.phone?.includes(cleanQPhone)) ||
        u.phone?.toLowerCase().includes(q) ||
        u.skills?.toLowerCase().includes(q) ||
        u.location?.toLowerCase().includes(q) ||
        u.education?.toLowerCase().includes(q) ||
        u.uid?.toLowerCase().includes(q)
      );
    });
  }, [users, userStatusFilter, selectedStateFilter, searchQuery]);

  const filteredJobs = useMemo(() => {
    return opportunities.filter((opp) => {
      const matchState =
        selectedStateFilter === 'All India' ||
        opp.loc.toLowerCase().includes(selectedStateFilter.toLowerCase());
      const matchSearch =
        !searchQuery.trim() ||
        opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opp.org.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opp.loc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchState && matchSearch;
    });
  }, [opportunities, selectedStateFilter, searchQuery]);

  const filteredMediaAssets = useMemo(() => {
    const list = mediaAssets.filter((m) => {
      const matchCat =
        mediaCategoryFilter === 'any' ||
        mediaCategoryFilter === 'all' ||
        m.folder === mediaCategoryFilter ||
        (mediaCategoryFilter === 'banner' && m.folder === 'hero_banner') ||
        (mediaCategoryFilter === 'general' && (m.folder === 'schemes' || m.folder === 'scheme'));
      const matchSearch =
        !searchQuery.trim() ||
        m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.folder?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });

    if (mediaCategoryFilter === 'banner' || mediaCategoryFilter === 'general') {
      return [...list].sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 999;
        const orderB = typeof b.order === 'number' ? b.order : 999;
        if (orderA !== orderB) return orderA - orderB;
        return (b.time || 0) - (a.time || 0);
      });
    }
    return list;
  }, [mediaAssets, mediaCategoryFilter, searchQuery]);

  const heroBannerAssets = useMemo(() => {
    return mediaAssets
      .filter((m) => m.folder === 'banner' || m.folder === 'hero_banner')
      .sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 999;
        const orderB = typeof b.order === 'number' ? b.order : 999;
        if (orderA !== orderB) return orderA - orderB;
        return (b.time || 0) - (a.time || 0);
      });
  }, [mediaAssets]);

  const generalSchemeAssets = useMemo(() => {
    return mediaAssets
      .filter((m) => m.folder === 'general' || m.folder === 'schemes' || m.folder === 'scheme')
      .sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 999;
        const orderB = typeof b.order === 'number' ? b.order : 999;
        if (orderA !== orderB) return orderA - orderB;
        return (b.time || 0) - (a.time || 0);
      });
  }, [mediaAssets]);

  const handleMoveSlide = async (id: string, direction: 'up' | 'down') => {
    const targetItem = mediaAssets.find((m) => m.id === id);
    const isSchemeGroup =
      targetItem?.folder === 'general' ||
      targetItem?.folder === 'schemes' ||
      targetItem?.folder === 'scheme';
    const items = isSchemeGroup ? [...generalSchemeAssets] : [...heroBannerAssets];
    const currentIndex = items.findIndex((b) => b.id === id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const temp = items[currentIndex];
    items[currentIndex] = items[targetIndex];
    items[targetIndex] = temp;

    const reorderedItems = items.map((item, idx) => ({
      id: item.id,
      order: idx + 1,
    }));

    const orderMap = new Map(reorderedItems.map((r) => [r.id, r.order]));
    setMediaAssets((prev) =>
      prev.map((m) => (orderMap.has(m.id) ? { ...m, order: orderMap.get(m.id)! } : m))
    );

    await mediaStorageService.reorderMedia(reorderedItems);
    logActivity(
      'UPDATE',
      'media',
      targetItem?.name || 'Media Slide',
      `${isSchemeGroup ? 'Scheme banner' : 'Hero banner'} order moved ${direction}`,
      id
    );
    onNotify(
      isSchemeGroup
        ? 'योजना कार्ड इमेज का क्रम बदल दिया गया!'
        : 'हीरो स्लाइडर में बैनर की स्थिति बदल दी गई! (Position updated)'
    );
  };

  const handleSetSlideOrder = async (id: string, newOrder: number) => {
    if (isNaN(newOrder) || newOrder < 1) return;
    const targetItem = mediaAssets.find((m) => m.id === id);
    setMediaAssets((prev) =>
      prev.map((m) => (m.id === id ? { ...m, order: newOrder } : m))
    );
    await mediaStorageService.updateMediaAsset(id, { order: newOrder });
    logActivity('UPDATE', 'media', targetItem?.name || 'Media Banner', `Set slide position to #${newOrder}`, id);
    onNotify(`बैनर क्रम #${newOrder} पर सेट किया गया!`);
    loadMediaAndShowcase();
  };

  const handleToggleMediaActive = async (id: string, currentActive?: boolean) => {
    const newActive = currentActive === false;
    const targetItem = mediaAssets.find((m) => m.id === id);
    setMediaAssets((prev) =>
      prev.map((m) => (m.id === id ? { ...m, active: newActive } : m))
    );
    await mediaStorageService.updateMediaAsset(id, { active: newActive });
    logActivity(
      'UPDATE',
      'media',
      targetItem?.name || 'Media Banner',
      newActive ? 'Activated banner on live site' : 'Hidden banner from live site',
      id
    );
    onNotify(newActive ? 'बैनर हीरो स्लाइडर में सक्रिय (Active) किया गया!' : 'बैनर हीरो स्लाइडर से छिपाया गया (Hidden)!');
  };

  const handleSendWhatsAppReminder = (user: AdminUserRecord) => {
    const rawPhone = user.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      onNotify('इस नागरिक के पास वैध 10-अंक का मोबाइल नंबर दर्ज नहीं है।');
      return;
    }

    const missingText = user.missingFields.length > 0
      ? user.missingFields.join(', ')
      : 'हुनर व शिक्षा';

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://jeevikaai.app';
    const message = `नमस्ते ${user.name || 'साथी'} जी,\nJeevikaAI पोर्टल पर आपका खाता बना हुआ है। आपकी आजीविका प्रोफ़ाइल अभी अधूरी (${user.completionPercent}% पूर्ण) है।\n\nकृपया अपने मोबाइल से लॉगिन कर ${missingText} की जानकारी दर्ज करें ताकि आपको जिले के नजदीकी सरकारी रोजगार, PMKVY प्रशिक्षण और स्वरोजगार योजनाएं मिल सकें:\n${origin}\n\n- जीविका एआई (JeevikaAI Admin)`;
    const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;

    try {
      const existingQueue = JSON.parse(localStorage.getItem('jeevika_push_queue') || '[]');
      existingQueue.unshift({
        id: 'wa_notif_' + Date.now(),
        target: 'specific',
        targetUserId: user.uid,
        targetPhone: cleanPhone,
        title: 'प्रोफ़ाइल पूर्णता अनुस्मारक (Profile Reminder)',
        body: `WhatsApp रिमाइंडर भेजा गया: ${missingText} दर्ज करें।`,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('jeevika_push_queue', JSON.stringify(existingQueue));
    } catch {}

    setWaPreviewLink({
      name: user.name || 'नागरिक',
      phone: cleanPhone,
      url: waUrl,
    });
    onNotify(`WhatsApp रिमाइंडर लिंक तैयार! ${cleanPhone} के लिए नीचे लिंक पर क्लिक करें।`);
  };

  const handleDeleteUser = async (uid: string) => {
    const targetUser = users.find((u) => u.uid === uid);
    await firestoreService.deleteUserData(uid);
    setUsers((prev) => prev.filter((u) => u.uid !== uid));
    if (selectedUserDetail?.uid === uid) {
      setSelectedUserDetail(null);
    }
    setConfirmActionKey(null);
    logActivity(
      'DELETE',
      'users',
      targetUser?.name || uid,
      `Deleted citizen profile (${targetUser?.phone ? `+91 ${targetUser.phone}` : 'No phone'}, ${targetUser?.location || 'India'})`,
      uid
    );
    onNotify('नागरिक खाता सफलतापूर्वक हटा दिया गया।');
  };

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim() || !jobOrg.trim()) return;

    const newJob: Opportunity = {
      id: 'opp_' + Date.now(),
      title: jobTitle.trim(),
      org: jobOrg.trim(),
      type: jobType,
      loc: `${jobLoc || 'District Center'}, ${jobState}`,
      km: 6,
      pay: jobPay || '₹9,000 - ₹14,000 / month',
      path: 'digital',
      verified: true,
      source: isSuperAdmin ? 'Super Administrator Direct Entry' : `Sub-Admin (${currentUser?.email || 'Portal'})`,
      lastVerifiedDate: 'October 2026',
      eligibility: jobEligibility || `${jobMinEdu} with basic technical training.`,
      documentsRequired: ['Aadhaar Card', 'Mark sheet', 'Bank Passbook'],
      contactInfo: jobContact || 'District Livelihood Coordinator Office',
    };

    setOpportunities((prev) => [newJob, ...prev]);
    contentService.upsert('opportunities', newJob.id, newJob);
    if (newJob.type === 'Training') {
      contentService.upsert('training_centers', newJob.id, newJob);
    }
    logActivity(
      'ADD',
      'jobs',
      newJob.title,
      `Added ${newJob.type} at ${newJob.org} (${newJob.loc}) · ${newJob.pay}`,
      newJob.id
    );

    setShowAddJobModal(false);
    setJobTitle('');
    setJobOrg('');
    setJobLoc('');
    setJobPay('');
    setJobEligibility('');
    setJobContact('');
    onNotify('New Job Opportunity published successfully to Firestore!');
  };

  const handleCreatePathway = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pathwayName.trim()) return;

    const newPath: Pathway = {
      id: 'path_' + Date.now(),
      name: pathwayName.trim(),
      hi: pathwayHi.trim() || pathwayName.trim(),
      role: pathwayRole.trim() || 'Certified Technical Specialist',
      icon: 'layers',
      duration: pathwayDuration,
      nsqf: pathwayNsqf,
      minEdu: 1,
      workTypes: ['job', 'self'],
      reach: 'regional',
      demand: pathwayDemand,
      demandNote: 'High regional hiring demand verified across state clusters',
      interestTags: [pathwayName.toLowerCase(), 'certified', 'technical'],
      skillTags: [pathwayName.toLowerCase(), 'skills', 'operations'],
      stages: [
        ['Foundation Principles', 'Learn core tools, measurements and safety protocols.', 'Weeks 1 to 4'],
        ['Practical Apprenticeship', 'Hands-on equipment assembly and diagnostics.', 'Weeks 5 to 9'],
        ['Industry Placement', 'NSQF certification assessment and job readiness.', 'Weeks 10 to 12'],
      ],
    };

    setPathways((prev) => [newPath, ...prev]);
    contentService.upsert('pathways', newPath.id, newPath);
    logActivity(
      'ADD',
      'pathways',
      `${newPath.name} (${newPath.hi})`,
      `Created NSQF Level ${newPath.nsqf} pathway · ${newPath.duration}`,
      newPath.id
    );
    setShowAddPathwayModal(false);
    setPathwayName('');
    setPathwayHi('');
    setPathwayRole('');
    onNotify('New NSQF Skill Pathway added to curriculum & Firestore!');
  };

  const handleDeleteJob = (id: string) => {
    const targetJob = opportunities.find((o) => o.id === id);
    setOpportunities((prev) => prev.filter((o) => o.id !== id));
    contentService.remove('opportunities', id);
    contentService.remove('training_centers', id);
    setConfirmActionKey(null);
    logActivity(
      'DELETE',
      'jobs',
      targetJob?.title || id,
      targetJob ? `Removed ${targetJob.type} (${targetJob.org}, ${targetJob.loc})` : 'Removed opportunity listing',
      id
    );
    onNotify('Opportunity removed from Firestore.');
  };

  const handleToggleVerify = (id: string) => {
    const targetJob = opportunities.find((o) => o.id === id);
    const nextVerified = targetJob ? !targetJob.verified : true;
    setOpportunities((prev) =>
      prev.map((o) => {
        if (o.id === id) {
          const updated = { ...o, verified: !o.verified };
          contentService.upsert('opportunities', id, updated);
          return updated;
        }
        return o;
      })
    );
    logActivity(
      'UPDATE',
      'jobs',
      targetJob?.title || id,
      nextVerified ? 'Marked opportunity as Verified' : 'Marked opportunity as Unverified',
      id
    );
    onNotify('Verification state updated in Firestore.');
  };

  const handleExportCSV = () => {
    const headers = ['UID', 'Name', 'Phone', 'Status', 'Completion', 'State', 'Location', 'Education', 'Skills', 'Interests', 'Matched Pathway', 'Score', 'Last Active'];
    const rows = users.map((u) => [
      u.uid,
      `"${u.name}"`,
      `"${u.phone}"`,
      u.status,
      `${u.completionPercent}%`,
      `"${u.state}"`,
      `"${u.location}"`,
      `"${u.education}"`,
      `"${u.skills?.replace(/"/g, '""')}"`,
      `"${u.interests?.replace(/"/g, '""')}"`,
      `"${u.matchedPathwayName}"`,
      u.matchScore,
      u.lastActive,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `jeevika_live_users_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify('Live user assessment registry exported as CSV!');
  };

  const resetMediaForm = () => {
    mediaPreviews.forEach((u) => {
      if (u.startsWith('blob:')) {
        try { URL.revokeObjectURL(u); } catch {}
      }
    });
    if (mediaPreview && mediaPreview.startsWith('blob:')) {
      try { URL.revokeObjectURL(mediaPreview); } catch {}
    }
    setMediaFile(null);
    setMediaFiles([]);
    setMediaPreview('');
    setMediaPreviews([]);
    setMediaDirectUrl('');
    setMediaTitle('');
    setMediaCtaUrl('');
    setMediaCtaLabel('');
    setUploadBatchStatus('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadNewMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    setMediaStatusNotice(null);

    if (!mediaTitle.trim()) {
      onNotify('कृपया शीर्षक दर्ज करें।');
      setMediaStatusNotice({ type: 'error', text: 'कृपया शीर्षक (Title / Caption) दर्ज करें।' });
      return;
    }

    if (!editingMediaId && !mediaFile && mediaFiles.length === 0 && !mediaDirectUrl.trim() && !mediaPreview) {
      const msg = 'कृपया अपलोड करने के लिए एक या अधिक तस्वीरें चुनें अथवा इमेज URL दर्ज करें।';
      onNotify(msg);
      setMediaStatusNotice({ type: 'error', text: msg });
      return;
    }

    const matchesSameGroup = (folder: string) => {
      if (mediaFolder === 'banner' || mediaFolder === 'hero_banner') {
        return folder === 'banner' || folder === 'hero_banner';
      }
      if (mediaFolder === 'general' || mediaFolder === 'schemes' || mediaFolder === 'scheme') {
        return folder === 'general' || folder === 'schemes' || folder === 'scheme';
      }
      return folder === mediaFolder;
    };

    setMediaUploading(true);
    setMediaUploadProgress(10);
    try {
      if (editingMediaId) {
        let url = mediaPreview;
        if (mediaFile) {
          url = await uploadToCloudinary(mediaFile, mediaFolder, (pct) => {
            setMediaUploadProgress(Math.max(10, pct));
          });
        } else if (mediaDirectUrl.trim()) {
          url = mediaDirectUrl.trim();
        }
        await mediaStorageService.updateMediaAsset(editingMediaId, {
          url,
          folder: mediaFolder,
          name: mediaTitle.trim(),
          ctaUrl: mediaCtaUrl.trim() || undefined,
          ctaLabel: mediaCtaLabel.trim() || undefined,
        });
        logActivity('UPDATE', 'media', mediaTitle.trim(), `Updated media asset in folder "${mediaFolder}"`, editingMediaId);
        const msg = 'मीडिया सफलतापूर्वक अपडेट किया गया!';
        onNotify(msg);
        setMediaStatusNotice({ type: 'success', text: msg });
        setEditingMediaId(null);
      } else if (mediaFiles.length > 0) {
        const total = mediaFiles.length;
        const currentCategoryAssets = mediaAssets.filter((m) => matchesSameGroup(m.folder));
        const maxOrder = currentCategoryAssets.length > 0
          ? Math.max(...currentCategoryAssets.map((b) => b.order ?? 0))
          : 0;

        for (let i = 0; i < total; i++) {
          const file = mediaFiles[i];
          setUploadBatchStatus(`Cloudinary पर अपलोड हो रहा है (${i + 1}/${total}): ${file.name}...`);
          const baseProgress = Math.round((i / total) * 100);
          setMediaUploadProgress(Math.max(10, baseProgress));

          const uploadedUrl = await uploadToCloudinary(file, mediaFolder, (pct) => {
            const overall = Math.round(((i + pct / 100) / total) * 100);
            setMediaUploadProgress(Math.max(10, overall));
          });

          const itemTitle = total > 1
            ? `${mediaTitle.trim()} #${i + 1}`
            : mediaTitle.trim();

          await mediaStorageService.saveMediaAsset({
            url: uploadedUrl,
            folder: mediaFolder,
            name: itemTitle,
            tags:
              mediaFolder === 'general' || mediaFolder === 'schemes'
                ? ['सरकारी योजना', 'जीविका अपडेट']
                : ['जीविका अवसर'],
            used: 1,
            time: Date.now() + i,
            createdAt: new Date().toISOString(),
            ctaUrl: mediaCtaUrl.trim() || undefined,
            ctaLabel: mediaCtaLabel.trim() || undefined,
            order: maxOrder + i + 1,
            active: true,
          });
        }
        logActivity('ADD', 'media', mediaTitle.trim(), `Uploaded ${total} media file(s) to folder "${mediaFolder}"`);
        const msg = `सफलतापूर्वक ${total} तस्वीर(ें) Cloudinary पर अपलोड हो गईं और वेबसाइट पर लाइव हैं!`;
        onNotify(msg);
        setMediaStatusNotice({ type: 'success', text: msg });
      } else {
        let url = mediaDirectUrl.trim();
        if (mediaFile) {
          url = await uploadToCloudinary(mediaFile, mediaFolder, (pct) => {
            setMediaUploadProgress(Math.max(15, pct));
          });
        } else if (mediaPreview && !url) {
          url = mediaPreview;
        }
        if (!url) {
          throw new Error('तस्वीर अपलोड नहीं हो सकी या अमान्य URL है।');
        }

        const currentCategoryAssets = mediaAssets.filter((m) => matchesSameGroup(m.folder));
        const maxOrder = currentCategoryAssets.length > 0
          ? Math.max(...currentCategoryAssets.map((b) => b.order ?? 0))
          : 0;

        await mediaStorageService.saveMediaAsset({
          url,
          folder: mediaFolder,
          name: mediaTitle.trim(),
          tags:
            mediaFolder === 'general' || mediaFolder === 'schemes'
              ? ['सरकारी योजना', 'जीविका अपडेट']
              : ['जीविका अवसर'],
          used: 1,
          time: Date.now(),
          createdAt: new Date().toISOString(),
          ctaUrl: mediaCtaUrl.trim() || undefined,
          ctaLabel: mediaCtaLabel.trim() || undefined,
          order: maxOrder + 1,
          active: true,
        });
        logActivity('ADD', 'media', mediaTitle.trim(), `Uploaded media asset to folder "${mediaFolder}"`);
        const msg = 'तस्वीर Cloudinary पर अपलोड हो गई और वेबसाइट पर लाइव कर दी गई!';
        onNotify(msg);
        setMediaStatusNotice({ type: 'success', text: msg });
      }

      resetMediaForm();
      await loadMediaAndShowcase();
    } catch (err: any) {
      const errMsg = 'अपलोड विफल: ' + (err?.message || 'त्रुटि हुई');
      onNotify(errMsg);
      setMediaStatusNotice({ type: 'error', text: errMsg });
    } finally {
      setMediaUploading(false);
      setMediaUploadProgress(0);
      setUploadBatchStatus('');
    }
  };

  const handleDeleteMedia = async (id: string) => {
    const targetMedia = mediaAssets.find((m) => m.id === id);
    await mediaStorageService.deleteMediaAsset(id);
    setConfirmActionKey(null);
    logActivity('DELETE', 'media', targetMedia?.name || id, `Deleted media asset from folder "${targetMedia?.folder || 'gallery'}"`, id);
    onNotify('तस्वीर गैलरी से स्थायी रूप से हटा दी गई।');
    loadMediaAndShowcase();
  };

  const handleEditMedia = (m: MediaAssetRecord) => {
    setEditingMediaId(m.id);
    setMediaTitle(m.name);
    setMediaFolder(m.folder || 'banner');
    setMediaPreview(m.url);
    setMediaPreviews([]);
    setMediaFiles([]);
    setMediaFile(null);
    setMediaDirectUrl(m.url.startsWith('http') ? m.url : '');
    setMediaCtaUrl(m.ctaUrl || '');
    setMediaCtaLabel(m.ctaLabel || '');
    setMediaStatusNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const formEl = document.getElementById('cloudinary-uploader-form');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    onNotify(`संपादक मोड सक्रिय: "${m.name}"`);
  };

  const handleDeleteShowcase = async (id: string) => {
    const targetProd = showcaseProducts.find((p) => p.id === id);
    await mediaStorageService.deleteShowcaseProduct(id);
    setConfirmActionKey(null);
    logActivity(
      'DELETE',
      'showcase',
      targetProd?.title || id,
      targetProd ? `Removed showcase listing by ${targetProd.artisanName}` : 'Removed showcase product',
      id
    );
    onNotify('Product removed from showcase.');
    loadMediaAndShowcase();
  };

  const handleSendPushNotification = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) {
      onNotify('कृपया शीर्षक और संदेश दोनों दर्ज करें।');
      return;
    }
    if (notifTarget === 'specific' && !notifTargetUserId) {
      onNotify('कृपया विशिष्ट नागरिक का चयन करें।');
      return;
    }
    setNotifSending(true);
    try {
      if ('Notification' in window && Notification.permission !== 'granted') {
        await Notification.requestPermission();
      }
      const newNotif = {
        id: 'notif_' + Date.now(),
        target: notifTarget,
        targetUserId: notifTargetUserId,
        title: notifTitle,
        body: notifBody,
        createdAt: new Date().toISOString(),
      };
      const existingQueue = JSON.parse(localStorage.getItem('jeevika_push_queue') || '[]');
      localStorage.setItem('jeevika_push_queue', JSON.stringify([newNotif, ...existingQueue]));

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification(notifTitle, {
          body: notifBody,
          icon: '/icons/icon-192.svg',
          badge: '/icons/icon-192.svg',
        });
      }
      logActivity(
        'ADD',
        'notifications',
        notifTitle.trim(),
        notifTarget === 'all'
          ? `Broadcast sent to all ${users.length} citizens`
          : `Notification sent to citizen ${notifTargetUserId}`
      );
      onNotify(
        notifTarget === 'all'
          ? `सभी ${users.length} नागरिकों को पुश नोटिफिकेशन भेज दिया गया!`
          : 'चयनित नागरिक को पुश नोटिफिकेशन भेज दिया गया!'
      );
    } catch {
      onNotify('पुश नोटिफिकेशन कतार में सहेजा गया!');
    } finally {
      setNotifSending(false);
    }
  };

  // Sub-Admin CRUD Handlers
  const handleAddSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubAdminError('');
    const cleanEmail = subAdminService.normalizeEmail(subAdminEmailInput);
    if (!subAdminService.isValidEmail(cleanEmail)) {
      setSubAdminError('कृपया सही Gmail / Email पता दर्ज करें (जैसे: name@gmail.com)।');
      return;
    }

    setSubAdminSubmitting(true);
    try {
      const created = await subAdminService.addSubAdmin({
        email: cleanEmail,
        name: subAdminNameInput.trim(),
        note: subAdminNoteInput.trim(),
        addedBy: currentUser?.email || 'Super Admin',
      });
      logActivity(
        'ADD',
        'sub_admins',
        `${created.name} (${created.email})`,
        created.note ? `Added Sub-Admin · ${created.note}` : 'Granted Sub-Admin portal access',
        created.email
      );
      setSubAdminEmailInput('');
      setSubAdminNameInput('');
      setSubAdminNoteInput('');
      setSelectedSubAdminEmail(created.email);
      setSubAdminRulesError(false);
      onNotify(`सब-एडमिन ${created.email} सफलतापूर्वक जोड़ा गया! अब वे Google लॉगिन से प्रवेश कर सकते हैं।`);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'permission-denied') {
        setSubAdminRulesError(true);
        setSubAdminError('Firestore Rules अपडेट नहीं हैं। कृपया Firebase Console में नई firestore.rules पब्लिश करें।');
      } else {
        setSubAdminError(err?.message || 'सब-एडमिन जोड़ने में त्रुटि हुई।');
      }
    } finally {
      setSubAdminSubmitting(false);
    }
  };

  const handleToggleSubAdmin = async (sa: SubAdminRecord) => {
    const nextActive = !sa.active;
    try {
      await subAdminService.toggleSubAdminStatus(sa.email, nextActive);
      logActivity(
        'UPDATE',
        'sub_admins',
        `${sa.name} (${sa.email})`,
        nextActive ? 'Re-activated Sub-Admin access' : 'Paused Sub-Admin access',
        sa.email
      );
      onNotify(
        nextActive
          ? `${sa.email} का सब-एडमिन एक्सेस पुनः चालू किया गया।`
          : `${sa.email} का सब-एडमिन एक्सेस रोका गया (Paused)।`
      );
    } catch (err: any) {
      onNotify(err?.message || 'स्टेटस बदलने में त्रुटि हुई।');
    }
  };

  const handleRemoveSubAdmin = async (sa: SubAdminRecord) => {
    try {
      await subAdminService.removeSubAdmin(sa.email);
      logActivity(
        'DELETE',
        'sub_admins',
        `${sa.name} (${sa.email})`,
        'Revoked and removed Sub-Admin account',
        sa.email
      );
      if (selectedSubAdminEmail === sa.email) {
        setSelectedSubAdminEmail(null);
      }
      setConfirmActionKey(null);
      onNotify(`सब-एडमिन ${sa.email} को हटा दिया गया।`);
    } catch (err: any) {
      onNotify(err?.message || 'सब-एडमिन हटाने में त्रुटि हुई।');
    }
  };

  const getActorActivityStats = (email: string) => {
    const normalized = subAdminService.normalizeEmail(email);
    let added = 0;
    let updated = 0;
    let deleted = 0;
    activityLogs.forEach((log) => {
      if (log.actorEmail === normalized) {
        if (log.action === 'ADD') added += 1;
        else if (log.action === 'UPDATE') updated += 1;
        else if (log.action === 'DELETE') deleted += 1;
      }
    });
    return { total: added + updated + deleted, added, updated, deleted };
  };

  const visibleActivityLogs = useMemo(() => {
    const targetEmail = isSuperAdmin
      ? selectedSubAdminEmail
      : (currentUser?.email ? subAdminService.normalizeEmail(currentUser.email) : null);

    return activityLogs.filter((log) => {
      if (targetEmail && log.actorEmail !== subAdminService.normalizeEmail(targetEmail)) {
        return false;
      }
      if (activityActionFilter !== 'ALL' && log.action !== activityActionFilter) {
        return false;
      }
      return true;
    });
  }, [activityLogs, isSuperAdmin, selectedSubAdminEmail, currentUser?.email, activityActionFilter]);

  const formatActivityTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
      const formatted = d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      if (diffMin < 1) return `अभी · ${formatted}`;
      if (diffMin < 60) return `${diffMin} मिनट पहले · ${formatted}`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} घंटे पहले · ${formatted}`;
      const diffDays = Math.floor(diffHr / 24);
      return `${diffDays} दिन पहले · ${formatted}`;
    } catch {
      return iso;
    }
  };

  const getSectionLabel = (section: string) => {
    const labels: Record<string, string> = {
      jobs: 'रोजगार व अवसर (Jobs)',
      pathways: 'NSQF पाठ्यक्रम (Pathways)',
      media: 'मीडिया व बैनर (Media)',
      users: 'नागरिक रजिस्ट्री (Users)',
      showcase: 'लोकल शोकेस (Showcase)',
      notifications: 'पुश ब्रॉडकास्ट (Alerts)',
      sub_admins: 'सब-एडमिन प्रबंधन (Sub-Admins)',
    };
    return labels[section] || section;
  };

  const navTabs = [
    { id: 'users', label: 'नागरिक व पंजीकरण', sub: 'User Registry', icon: 'users', badge: users.length },
    { id: 'overview', label: 'जिला विश्लेषण', sub: 'Overview & KPI', icon: 'trending' },
    { id: 'jobs', label: 'रोजगार व योजनाएं', sub: 'Jobs & Schemes', icon: 'briefcase', badge: opportunities.length },
    { id: 'pathways', label: 'NSQF पाठ्यक्रम', sub: 'Skill Pathways', icon: 'layers', badge: pathways.length },
    { id: 'districts', label: 'जिला कवरेज', sub: 'District Nodes', icon: 'map', badge: dynamicDistrictIntelligence.length },
    { id: 'media', label: 'क्लाउडिनरी मीडिया', sub: 'बैनर व गैलरी', icon: 'sparkles', badge: mediaAssets.length },
    { id: 'notifications', label: 'पुश ब्रॉडकास्ट', sub: 'अलर्ट व रिमाइंडर', icon: 'bell' },
    {
      id: 'sub_admins',
      label: isSuperAdmin ? 'सब-एडमिन (Sub-Admins)' : 'मेरी 7-दिन गतिविधि',
      sub: isSuperAdmin ? 'Gmail Access & 7-Day Logs' : 'My 7-Day Activity Log',
      icon: 'shieldCheck',
      badge: isSuperAdmin ? subAdmins.length : activityLogs.length,
    },
  ];

  if (!isAdmin) {
    return (
      <main className="max-w-md mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="bg-white border border-[#DCE3EA] rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-[#9E2A2B] border border-red-200 mx-auto flex items-center justify-center">
            <Icon name="shield" size={32} />
          </div>
          <div className="space-y-1.5">
            <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-red-50 text-[#9E2A2B] border border-red-200">
              Restricted Area · सुरक्षित प्रशासनिक क्षेत्र
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
              प्रशासनिक प्रमाणीकरण आवश्यक
            </h2>
            <p className="text-xs text-[#5F6B76]">
              Authorized Administrative Access Only
            </p>
          </div>
          <p className="text-xs text-[#202B36] leading-relaxed">
            यह पोर्टल केवल अधिकृत प्रशासक (Admin) के लिए सुरक्षित है। पोर्टल का डेटाबेस, नागरिक सूची और रोजगार प्रबंधन देखने के लिए कृपया लॉगिन करें।
          </p>
          <div className="space-y-2 pt-2">
            <button
              onClick={() => {
                if (onOpenLogin) onOpenLogin();
                else go('home');
              }}
              className="w-full min-h-[48px] py-3 rounded-xl bg-[#17365D] hover:bg-[#245A91] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Icon name="lock" size={16} />
              <span>अधिकृत एडमिन लॉगिन (Admin Login)</span>
            </button>
            <button
              onClick={() => go('home')}
              className="w-full min-h-[44px] py-2.5 rounded-xl border border-[#DCE3EA] text-[#5F6B76] hover:text-[#17365D] font-bold text-xs transition-colors"
            >
              ← मुख्य पृष्ठ पर लौटें (Return Home)
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-7 space-y-5">
      {/* Top Banner */}
      <div className="bg-[#17365D] text-white rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#F4B966]">
            <Icon name="shieldCheck" size={14} />
            <span>
              {isSuperAdmin
                ? 'Super Administrator Console · लाइव प्रशासनिक केंद्र'
                : 'Sub-Administrator Console · अधिकृत सब-एडमिन पैनल'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight font-['Bricolage_Grotesque']">
            National Skill &amp; Livelihood Intelligence Platform
          </h1>
          <p className="text-xs sm:text-sm text-white/80 flex flex-wrap items-center gap-2">
            <span>
              लॉगिन: <strong>{currentUser?.displayName || (isSuperAdmin ? 'Super Admin' : 'Sub-Admin')}</strong> ({currentUser?.email || 'Admin Portal'})
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
              isSuperAdmin
                ? 'bg-[#F4B966]/20 text-[#F4B966] border border-[#F4B966]/35'
                : 'bg-[#287D73]/30 text-[#A7F3D0] border border-[#287D73]/50'
            }`}>
              {isSubAdmin ? 'Sub-Admin' : 'Super Admin'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddJobModal(true)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Icon name="plus" size={14} />
            <span>Add Job</span>
          </button>
          <button
            onClick={() => setShowAddPathwayModal(true)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#245A91] hover:bg-[#1C4673] text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Icon name="layers" size={14} />
            <span>Add Pathway</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
            title="Download CSV report"
          >
            <Icon name="download" size={13} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={() => {
              if (onLogout) onLogout();
              go('home');
            }}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#9E2A2B] hover:bg-[#7E1F20] text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Icon name="logout" size={13} />
            <span>लॉगआउट</span>
          </button>
        </div>
      </div>

      {/* WhatsApp Reminder Link Banner (replaces popup window.open) */}
      {waPreviewLink && (
        <div className="bg-[#E9F4F2] border border-[#287D73]/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-[#17365D]">
            <strong>{waPreviewLink.name}</strong> (+91 {waPreviewLink.phone}) के लिए WhatsApp रिमाइंडर संदेश तैयार है।
          </div>
          <div className="flex items-center gap-2">
            <a
              href={waPreviewLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white font-bold inline-flex items-center gap-1.5"
            >
              <Icon name="external" size={13} />
              <span>WhatsApp में खोलें</span>
            </a>
            <button
              type="button"
              onClick={() => setWaPreviewLink(null)}
              className="px-2.5 py-2 rounded-xl border border-[#DCE3EA] bg-white text-[#5F6B76] font-bold"
            >
              बंद करें
            </button>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex flex-col md:flex-row gap-5 items-start">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 shrink-0 bg-white border border-[#DCE3EA] rounded-2xl p-3 space-y-1.5 sticky top-20">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5F6B76] border-b border-[#DCE3EA] mb-1">
            Admin Modules
          </div>
          {navTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full min-h-[48px] text-left p-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#17365D] text-white'
                  : 'text-[#5F6B76] hover:bg-[#F7F9FC] hover:text-[#17365D]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon name={tab.icon} size={16} className={activeTab === tab.id ? 'text-[#F4B966]' : 'text-[#245A91]'} />
                <div className="truncate">
                  <div className="truncate">{tab.label}</div>
                  <div className={`text-[10px] font-medium ${activeTab === tab.id ? 'text-white/70' : 'text-[#5F6B76]'}`}>
                    {tab.sub}
                  </div>
                </div>
              </div>
              {tab.badge !== undefined && (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-[#F7F9FC] border border-[#DCE3EA] text-[#17365D]'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}

          <div className="pt-3 mt-2 border-t border-[#DCE3EA] px-2 space-y-1.5 text-[11px] text-[#5F6B76]">
            <div className="flex items-center justify-between">
              <span>कुल पंजीकृत:</span>
              <strong className="text-[#17365D] tabular-nums">{users.length}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>लंबित प्रोफ़ाइल:</span>
              <strong className="text-[#D9822B] tabular-nums">{pendingUsersCount}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>लाइव सक्रिय:</span>
              <strong className="text-[#287D73] tabular-nums">{activeNowUsersCount}</strong>
            </div>
          </div>
        </aside>

        {/* Mobile Nav Bar */}
        <div className="md:hidden w-full bg-white border border-[#DCE3EA] rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xs text-[#17365D]">
              <span className="text-[#5F6B76]">सेक्शन:</span>
              <span className="px-2.5 py-1 rounded-lg bg-[#17365D] text-white text-xs font-bold flex items-center gap-1.5">
                <Icon name={navTabs.find((t) => t.id === activeTab)?.icon || 'user'} size={13} />
                <span>{navTabs.find((t) => t.id === activeTab)?.label}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F7F9FC] hover:bg-slate-100 border border-[#DCE3EA] text-xs font-bold text-[#17365D] flex items-center gap-1.5"
            >
              <Icon name="menu" size={14} />
              <span>{mobileMenuOpen ? 'बंद करें' : 'मेनू बदलें'}</span>
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-[#DCE3EA]">
              {navTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setMobileMenuOpen(false);
                  }}
                  className={`min-h-[44px] p-2.5 rounded-xl text-left font-bold text-xs flex items-center justify-between transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#17365D] text-white'
                      : 'bg-[#F7F9FC] text-[#5F6B76] hover:text-[#17365D] border border-[#DCE3EA]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Icon name={tab.icon} size={14} />
                    <span className="truncate">{tab.label}</span>
                  </div>
                  {tab.badge !== undefined && (
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded-md bg-white/20 tabular-nums">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Content Container */}
        <div className="flex-1 min-w-0 w-full space-y-5">
          {/* Global Filter & Search Bar */}
          <div className="bg-white border border-[#DCE3EA] rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="font-bold text-[#17365D] flex items-center gap-1 mr-1 whitespace-nowrap">
                <Icon name="pin" size={13} /> क्षेत्र ({availableStates.length - 1} राज्य):
              </span>
              {availableStates.map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStateFilter(st)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap text-xs border ${
                    selectedStateFilter === st
                      ? 'bg-[#245A91] text-white border-[#245A91]'
                      : 'bg-[#F7F9FC] text-[#5F6B76] hover:text-[#17365D] border-[#DCE3EA]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="मोबाइल, नाम, हुनर या जिला खोजें..."
                className="w-full min-h-[42px] pl-9 pr-8 py-2 rounded-xl border border-[#DCE3EA] text-xs font-medium focus:outline-none focus:border-[#245A91] bg-white text-[#17365D]"
              />
              <span className="absolute left-3 top-3 text-[#5F6B76]">
                <Icon name="search" size={14} />
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-3 text-xs text-[#5F6B76] hover:text-[#17365D] font-bold"
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
          </div>

          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <div className="bg-white border border-[#DCE3EA] rounded-2xl overflow-hidden space-y-4 p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#DCE3EA]">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-extrabold text-[#17365D]">
                      लाइव नागरिक व प्रोफ़ाइल स्थिति (Live Citizen Registry)
                    </h3>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E9F4F2] text-[#287D73] border border-[#287D73]/25">
                      लाइव फ़ायरबेस
                    </span>
                  </div>
                  <p className="text-xs text-[#5F6B76] mt-0.5">
                    वास्तविक पंजीकृत नागरिक, 4-अंक PIN खाते, प्रोफ़ाइल पूर्णता और WhatsApp रिमाइंडर प्रबंधन।
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F7F9FC] border border-[#DCE3EA] rounded-xl self-start lg:self-auto text-xs font-bold">
                  <button
                    onClick={() => setUserStatusFilter('all')}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      userStatusFilter === 'all'
                        ? 'bg-[#17365D] text-white'
                        : 'text-[#5F6B76] hover:text-[#17365D]'
                    }`}
                  >
                    <span>सभी नागरिक</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${userStatusFilter === 'all' ? 'bg-white/20' : 'bg-white border border-[#DCE3EA] text-[#17365D]'}`}>
                      {users.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setUserStatusFilter('pending')}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      userStatusFilter === 'pending'
                        ? 'bg-[#D9822B] text-white'
                        : 'text-[#B45309] hover:text-[#17365D]'
                    }`}
                  >
                    <span>अधूरा (Pending)</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${userStatusFilter === 'pending' ? 'bg-white/20' : 'bg-[#FFF8EB] text-[#B45309]'}`}>
                      {pendingUsersCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setUserStatusFilter('completed')}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      userStatusFilter === 'completed'
                        ? 'bg-[#287D73] text-white'
                        : 'text-[#287D73] hover:text-[#17365D]'
                    }`}
                  >
                    <span>पूर्ण (Completed)</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${userStatusFilter === 'completed' ? 'bg-white/20' : 'bg-[#E9F4F2] text-[#287D73]'}`}>
                      {completedUsersCount}
                    </span>
                  </button>
                </div>
              </div>

              {isLoadingUsers && (
                <div className="p-10 text-center space-y-2">
                  <div className="w-8 h-8 border-2 border-[#17365D] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold text-[#17365D]">फ़ायरबेस से लाइव नागरिक डेटा लोड हो रहा है...</p>
                </div>
              )}

              {!isLoadingUsers && filteredUsers.length === 0 && (
                <div className="p-8 text-center bg-[#F7F9FC] rounded-xl border border-dashed border-[#DCE3EA] space-y-2">
                  <p className="font-bold text-sm text-[#17365D]">कोई नागरिक रिकॉर्ड नहीं मिला</p>
                  <p className="text-xs text-[#5F6B76]">
                    जब कोई नया नागरिक खाता बनाएगा, तो उसका विवरण स्वतः यहाँ दिखेगा।
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="px-3.5 py-1.5 rounded-xl bg-white border border-[#DCE3EA] text-xs font-bold text-[#17365D]"
                    >
                      खोज साफ़ करें
                    </button>
                  )}
                </div>
              )}

              {!isLoadingUsers && filteredUsers.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F9FC] text-[#5F6B76] border-y border-[#DCE3EA]">
                      <tr>
                        <th className="p-3">नागरिक (Citizen)</th>
                        <th className="p-3">प्रोफ़ाइल स्थिति (Status)</th>
                        <th className="p-3">सक्रियता (Activity)</th>
                        <th className="p-3">जिला व राज्य</th>
                        <th className="p-3">शिक्षा व हुनर</th>
                        <th className="p-3 text-right">कार्रवाई (Actions)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE3EA]">
                      {filteredUsers.map((u) => {
                        const isPending = u.status === 'pending';
                        return (
                          <tr key={u.id} className="hover:bg-[#F7F9FC] transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-[#17365D] text-sm flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-[#F7F9FC] border border-[#DCE3EA] flex-shrink-0 flex items-center justify-center font-bold text-xs text-[#17365D]">
                                  {u.avatarUrl ? (
                                    <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                                  ) : (
                                    (u.name || 'U').charAt(0).toUpperCase()
                                  )}
                                </div>
                                <span>{u.name}</span>
                              </div>
                              <div className="text-[11px] text-[#5F6B76] flex items-center gap-1 mt-0.5 tabular-nums">
                                <Icon name="phone" size={11} className="text-[#245A91]" />
                                <span className="font-mono font-semibold">
                                  {u.phone ? `+91 ${u.phone}` : 'नंबर अनुपलब्ध'}
                                </span>
                              </div>
                              <div className="text-[10px] text-[#5F6B76] font-mono mt-0.5 truncate max-w-[140px]">
                                UID: {u.uid.slice(0, 14)}...
                              </div>
                            </td>

                            <td className="p-3">
                              {isPending ? (
                                <div className="space-y-1.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FFF8EB] text-[#B45309] border border-[#FDE68A]">
                                    अधूरा (Pending)
                                  </span>
                                  <div className="w-24 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                    <div className="h-full bg-[#D9822B]" style={{ width: `${u.completionPercent}%` }} />
                                  </div>
                                  <div className="text-[10px] text-[#B45309] font-semibold tabular-nums">
                                    {u.completionPercent}% ({u.missingFields.join(', ') || 'अधूरा'})
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E9F4F2] text-[#287D73] border border-[#287D73]/25">
                                    पूर्ण (100%)
                                  </span>
                                  <div className="text-[10px] text-[#287D73] font-semibold tabular-nums">
                                    {u.matchedPathwayName} ({u.matchScore}%)
                                  </div>
                                </div>
                              )}
                            </td>

                            <td className="p-3">
                              {u.activeNow ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#E9F4F2] text-[#287D73] border border-[#287D73]/25">
                                  Active Now
                                </span>
                              ) : (
                                <span className="text-[11px] text-[#5F6B76] font-medium tabular-nums">
                                  {u.lastActive}
                                </span>
                              )}
                            </td>

                            <td className="p-3">
                              <div className="font-semibold text-[#17365D]">{u.location}</div>
                              <div className="text-[11px] text-[#5F6B76]">{u.state}</div>
                            </td>

                            <td className="p-3 max-w-[200px]">
                              <div className="font-semibold text-[#17365D] truncate">{u.education}</div>
                              <div className="text-[11px] text-[#5F6B76] truncate">{u.skills}</div>
                            </td>

                            <td className="p-3 text-right">
                              <div className="inline-flex items-center gap-1.5 justify-end flex-wrap">
                                <button
                                  onClick={() => handleSendWhatsAppReminder(u)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#E9F4F2] hover:bg-[#287D73]/20 text-[#287D73] border border-[#287D73]/30 font-bold text-[11px] transition-colors"
                                >
                                  WhatsApp
                                </button>
                                <button
                                  onClick={() => setSelectedUserDetail(u)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#17365D] hover:bg-[#245A91] text-white font-bold text-[11px] transition-colors"
                                >
                                  देखें
                                </button>
                                {confirmActionKey === `user:${u.uid}` ? (
                                  <span className="inline-flex items-center gap-1">
                                    <button
                                      onClick={() => handleDeleteUser(u.uid)}
                                      className="px-2 py-1.5 rounded-lg bg-[#9E2A2B] text-white font-bold text-[11px]"
                                    >
                                      हटाएं
                                    </button>
                                    <button
                                      onClick={() => setConfirmActionKey(null)}
                                      className="px-2 py-1.5 rounded-lg border border-[#DCE3EA] text-[#5F6B76] font-bold text-[11px]"
                                    >
                                      रद्द
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setConfirmActionKey(`user:${u.uid}`)}
                                    className="px-2 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-[#9E2A2B] font-bold text-[11px]"
                                    title="हटाएं"
                                  >
                                    <Icon name="trash" size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-white border border-[#DCE3EA] rounded-2xl space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6B76]">
                    Total Assessed Beneficiaries
                  </span>
                  <div className="text-3xl font-extrabold text-[#17365D] tabular-nums font-['Bricolage_Grotesque']">
                    {users.length}
                  </div>
                  <div className="text-xs text-[#287D73] font-semibold tabular-nums">
                    {completedUsersCount} पूर्ण · {pendingUsersCount} अधूरा (Live Firestore)
                  </div>
                </div>

                <div className="p-5 bg-white border border-[#DCE3EA] rounded-2xl space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6B76]">
                    Verified Local Opportunities
                  </span>
                  <div className="text-3xl font-extrabold text-[#245A91] tabular-nums font-['Bricolage_Grotesque']">
                    {opportunities.length}
                  </div>
                  <div className="text-xs text-[#5F6B76] font-medium tabular-nums">
                    {opportunities.filter((o) => o.verified).length} Verified Employer Nodes
                  </div>
                </div>

                <div className="p-5 bg-white border border-[#DCE3EA] rounded-2xl space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6B76]">
                    NSQF Curriculum Pathways
                  </span>
                  <div className="text-3xl font-extrabold text-[#287D73] tabular-nums font-['Bricolage_Grotesque']">
                    {pathways.length}
                  </div>
                  <div className="text-xs text-[#5F6B76] font-medium">
                    Standardized national vocational frameworks
                  </div>
                </div>

                <div className="p-5 bg-white border border-[#DCE3EA] rounded-2xl space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6B76]">
                    Active Districts Mapped
                  </span>
                  <div className="text-3xl font-extrabold text-[#D9822B] tabular-nums font-['Bricolage_Grotesque']">
                    {dynamicDistrictIntelligence.length}
                  </div>
                  <div className="text-xs text-[#5F6B76] font-medium tabular-nums">
                    नागरिकों व अवसरों से स्वतः सिंक ({availableStates.length - 1} राज्य)
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#DCE3EA] rounded-2xl overflow-hidden space-y-4 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[#17365D]">
                      District-wise Livelihood Intelligence &amp; Skill Demand ({filteredDistricts.length} जिले)
                    </h3>
                    <p className="text-xs text-[#5F6B76]">
                      Real-time aggregation of local candidate supply versus registered industry openings.
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#F7F9FC] border border-[#DCE3EA] text-[#17365D]">
                    Scope: {selectedStateFilter}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F9FC] text-[#5F6B76] border-y border-[#DCE3EA]">
                      <tr>
                        <th className="p-3">District</th>
                        <th className="p-3">State</th>
                        <th className="p-3">Assessed Users</th>
                        <th className="p-3">Active Jobs</th>
                        <th className="p-3">Primary Demanded Skill</th>
                        <th className="p-3">PMKVY / RSETI Center</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE3EA]">
                      {filteredDistricts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-[#5F6B76] font-medium">
                            इस राज्य ({selectedStateFilter}) के लिए अभी कोई जिला रिकॉर्ड उपलब्ध नहीं है।
                          </td>
                        </tr>
                      ) : (
                        filteredDistricts.map((d) => (
                          <tr key={d.district} className="hover:bg-[#F7F9FC] transition-colors">
                            <td className="p-3 font-bold text-[#17365D]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{d.district}</span>
                                {d.isDynamicUserDistrict && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F7F9FC] text-[#245A91] border border-[#DCE3EA]">
                                    नागरिक जिला
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-[#5F6B76]">{d.state}</td>
                            <td className="p-3 font-semibold text-[#245A91] tabular-nums">{d.users} candidates</td>
                            <td className="p-3 font-semibold text-[#287D73] tabular-nums">{d.jobs} openings</td>
                            <td className="p-3 text-[#202B36] font-medium">{d.topSkill}</td>
                            <td className="p-3 text-[#287D73] font-bold">{d.pmkvyCenter}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: JOBS */}
          {activeTab === 'jobs' && (
            <div className="bg-white border border-[#DCE3EA] rounded-2xl overflow-hidden space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#17365D]">
                    Published Opportunities &amp; Schemes ({filteredJobs.length})
                  </h3>
                  <p className="text-xs text-[#5F6B76]">
                    Manage verified local employment vacancies, training schemes, and self-employment units.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddJobModal(true)}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Icon name="plus" size={14} />
                  <span>Add Opportunity</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F9FC] text-[#5F6B76] border-y border-[#DCE3EA]">
                    <tr>
                      <th className="p-3">Title &amp; Org</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Location</th>
                      <th className="p-3">Pay / Stipend</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE3EA]">
                    {filteredJobs.map((opp) => (
                      <tr key={opp.id} className="hover:bg-[#F7F9FC] transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-[#17365D]">{opp.title}</div>
                          <div className="text-[#5F6B76] text-[11px]">{opp.org}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#F7F9FC] border border-[#DCE3EA] text-[#17365D]">
                            {opp.type}
                          </span>
                        </td>
                        <td className="p-3 text-[#5F6B76]">{opp.loc}</td>
                        <td className="p-3 font-semibold text-[#287D73] tabular-nums">{opp.pay}</td>
                        <td className="p-3">
                          <button
                            onClick={() => handleToggleVerify(opp.id)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                              opp.verified
                                ? 'bg-[#E9F4F2] text-[#287D73] border-[#287D73]/30'
                                : 'bg-[#FFF8EB] text-[#B45309] border-[#FDE68A]'
                            }`}
                          >
                            {opp.verified ? 'Verified' : 'Pending Review'}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          {confirmActionKey === `job:${opp.id}` ? (
                            <span className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleDeleteJob(opp.id)}
                                className="px-2.5 py-1 rounded bg-[#9E2A2B] text-white font-bold text-[11px]"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmActionKey(null)}
                                className="px-2 py-1 rounded border border-[#DCE3EA] text-[#5F6B76] font-bold text-[11px]"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmActionKey(`job:${opp.id}`)}
                              className="text-[#9E2A2B] font-bold hover:underline text-[11px]"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: PATHWAYS */}
          {activeTab === 'pathways' && (
            <div className="bg-white border border-[#DCE3EA] rounded-2xl overflow-hidden space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#17365D]">
                    NSQF Skill Development Pathways ({pathways.length})
                  </h3>
                  <p className="text-xs text-[#5F6B76]">
                    Manage curriculum tracks, qualification levels, and demand indices.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddPathwayModal(true)}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Icon name="plus" size={14} />
                  <span>Add Pathway</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pathways.map((path) => (
                  <div key={path.id} className="p-4 bg-[#F7F9FC] border border-[#DCE3EA] rounded-xl flex flex-col justify-between space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-[#DCE3EA] text-[#245A91] tabular-nums">
                          NSQF Level {path.nsqf}
                        </span>
                        <h4 className="font-bold text-sm text-[#17365D] mt-1">{path.name}</h4>
                        <div className="text-xs text-[#287D73] font-semibold">{path.hi}</div>
                      </div>
                      <span className="text-[11px] font-bold text-[#5F6B76]">{path.duration}</span>
                    </div>

                    <div className="text-xs text-[#5F6B76]">{path.demandNote}</div>

                    <div className="pt-2 border-t border-[#DCE3EA] flex items-center justify-between text-xs">
                      <span className="text-[11px] font-semibold text-[#5F6B76] tabular-nums">
                        {path.stages.length} Learning Stages
                      </span>
                      {confirmActionKey === `path:${path.id}` ? (
                        <span className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setPathways((prev) => prev.filter((p) => p.id !== path.id));
                              contentService.remove('pathways', path.id);
                              logActivity(
                                'DELETE',
                                'pathways',
                                `${path.name} (${path.hi})`,
                                `Removed NSQF Level ${path.nsqf} pathway`,
                                path.id
                              );
                              setConfirmActionKey(null);
                              onNotify('Pathway removed from Firestore.');
                            }}
                            className="px-2.5 py-1 rounded bg-[#9E2A2B] text-white font-bold text-[11px]"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmActionKey(null)}
                            className="px-2 py-1 rounded border border-[#DCE3EA] bg-white text-[#5F6B76] font-bold text-[11px]"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmActionKey(`path:${path.id}`)}
                          className="text-[#9E2A2B] font-bold hover:underline text-[11px]"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: DISTRICTS */}
          {activeTab === 'districts' && (
            <div className="bg-white border border-[#DCE3EA] rounded-2xl overflow-hidden space-y-4 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE3EA]">
                <div>
                  <h3 className="text-base font-bold text-[#17365D] flex items-center gap-2">
                    <Icon name="map" size={18} className="text-[#245A91]" />
                    <span>All-India Operational District Nodes ({filteredDistricts.length} जिले उपलब्ध)</span>
                  </h3>
                  <p className="text-xs text-[#5F6B76] mt-0.5">
                    पंजीकृत नागरिकों व योजनाओं से गतिशील रूप से जुड़ते जिले।
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#F7F9FC] border border-[#DCE3EA] text-[#17365D]">
                    क्षेत्र: {selectedStateFilter}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#E9F4F2] text-[#287D73] border border-[#287D73]/25 tabular-nums">
                    कुल सक्रिय: {dynamicDistrictIntelligence.length}
                  </span>
                </div>
              </div>

              {filteredDistricts.length === 0 ? (
                <div className="p-8 text-center bg-[#F7F9FC] rounded-xl border border-dashed border-[#DCE3EA] space-y-2">
                  <p className="font-bold text-xs text-[#17365D]">
                    इस राज्य ({selectedStateFilter}) में अभी कोई जिला रिकॉर्ड नहीं है।
                  </p>
                  <p className="text-xs text-[#5F6B76]">
                    जैसे ही कोई नागरिक इस राज्य के किसी जिले से रजिस्टर करेगा, वह जिला यहाँ स्वचालित रूप से दिखाई देगा।
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDistricts.map((item) => (
                    <div key={item.district} className="p-4 bg-[#F7F9FC] border border-[#DCE3EA] rounded-xl space-y-2 hover:border-[#245A91] transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-[#17365D] flex items-center gap-1.5 flex-wrap">
                            <span>{item.district}</span>
                            {item.isDynamicUserDistrict && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white text-[#245A91] border border-[#DCE3EA]">
                                नया जिला
                              </span>
                            )}
                          </h4>
                          <span className="text-[11px] text-[#5F6B76] font-medium">
                            {item.state}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#E9F4F2] text-[#287D73] shrink-0">
                          {item.state}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="p-2.5 bg-white rounded-lg border border-[#DCE3EA]">
                          <div className="text-[10px] text-[#5F6B76]">Registered Candidates</div>
                          <div className="font-bold text-[#17365D] flex items-center gap-1 tabular-nums">
                            <span>{item.users}</span>
                            <span className="text-[10px] font-normal text-[#5F6B76]">नागरिक</span>
                          </div>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-[#DCE3EA]">
                          <div className="text-[10px] text-[#5F6B76]">Active Openings</div>
                          <div className="font-bold text-[#287D73] flex items-center gap-1 tabular-nums">
                            <span>{item.jobs}</span>
                            <span className="text-[10px] font-normal text-[#5F6B76]">अवसर</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] text-[#5F6B76] pt-1 border-t border-[#DCE3EA]">
                        <strong className="text-[#17365D]">Top Skill Demand:</strong> {item.topSkill}
                      </div>
                      <div className="text-[11px] text-[#287D73] font-semibold flex items-center gap-1.5">
                        <Icon name="check" size={12} />
                        <span>{item.pmkvyCenter}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: MEDIA */}
          {activeTab === 'media' && (
            <div className="space-y-6">
              <div id="cloudinary-uploader-form" className="bg-white border border-[#DCE3EA] rounded-2xl p-6 space-y-4">
                <div className="pb-2 border-b border-[#DCE3EA] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-[#17365D]">
                      मीडिया अपलोडर (Cloudinary Media Upload)
                    </h3>
                    <p className="text-xs text-[#5F6B76]">
                      हीरो बैनर, सरकारी योजनाएं (General / Schemes), कौशल प्रशिक्षण गैलरी या उत्पाद चित्र अपलोड करें।
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => go('home')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F7F9FC] hover:bg-slate-100 text-[#17365D] border border-[#DCE3EA] flex items-center gap-1"
                    >
                      <Icon name="eye" size={13} />
                      <span>होम पेज पर देखें</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => go('opportunities')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F7F9FC] hover:bg-slate-100 text-[#245A91] border border-[#DCE3EA] flex items-center gap-1"
                    >
                      <Icon name="shieldCheck" size={13} />
                      <span>योजनाएं देखें</span>
                    </button>
                  </div>
                </div>

                {mediaStatusNotice && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
                      mediaStatusNotice.type === 'success'
                        ? 'bg-[#E9F4F2] border-[#287D73]/30 text-[#287D73]'
                        : 'bg-[#FDEDEC] border-[#9E2A2B]/30 text-[#9E2A2B]'
                    }`}
                  >
                    <span>{mediaStatusNotice.text}</span>
                    <button
                      type="button"
                      onClick={() => setMediaStatusNotice(null)}
                      className="text-[11px] underline flex-none"
                    >
                      बंद
                    </button>
                  </div>
                )}

                {editingMediaId && (
                  <div className="p-3 bg-[#FFF8EB] border border-[#FDE68A] rounded-xl flex items-center justify-between text-xs text-[#B45309] font-bold">
                    <span>संपादक मोड: आप विवरण अपडेट कर रहे हैं</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMediaId(null);
                        resetMediaForm();
                      }}
                      className="px-2.5 py-1 rounded bg-white border border-[#FDE68A] text-[#B45309] font-bold text-[11px]"
                    >
                      रद्द करें
                    </button>
                  </div>
                )}

                <form onSubmit={handleUploadNewMedia} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-[#17365D] mb-1">
                        शीर्षक (Title / Caption) *
                      </label>
                      <input
                        type="text"
                        value={mediaTitle}
                        onChange={(e) => setMediaTitle(e.target.value)}
                        placeholder="उदा: पीएम कौशल विकास योजना 2026"
                        required
                        className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] bg-white text-[#17365D] font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#17365D] mb-1">
                        विभाग / सेक्शन (Section Folder) *
                      </label>
                      <select
                        value={mediaFolder}
                        onChange={(e) => setMediaFolder(e.target.value)}
                        className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] bg-white text-[#17365D] font-bold"
                      >
                        <option value="banner">हीरो बैनर (Hero Banner Slider)</option>
                        <option value="general">सामान्य व सरकारी योजनाएं (General / Schemes)</option>
                        <option value="schemes">सरकारी योजना विशेष (Government Schemes)</option>
                        <option value="training">कौशल प्रशिक्षण गैलरी (Training Gallery)</option>
                        <option value="showcase">ग्रामीण उत्पाद शोकेस (Showcase)</option>
                        <option value="job">रोजगार अवसर (Job Thumbnail)</option>
                        <option value="user_avatars">प्रोफ़ाइल अवतार (User Avatars)</option>
                      </select>
                      <p className="text-[11px] text-[#5F6B76] mt-1">
                        {mediaFolder === 'banner'
                          ? 'यह इमेज होम पेज के टॉप हीरो बैनर स्लाइडर में दिखेगी।'
                          : mediaFolder === 'general' || mediaFolder === 'schemes'
                          ? 'यह इमेज डैशबोर्ड और अवसर पेज के वास्तविक सरकारी योजना कार्ड्स (पीएम विश्वकर्मा, कौशल विकास 4.0, मुद्रा योजना आदि) में इमेज की जगह दिखेगी।'
                          : mediaFolder === 'training'
                          ? 'यह इमेज होम पेज की कौशल प्रशिक्षण गैलरी में दिखेगी।'
                          : 'यह इमेज चयनित गैलरी फ़ोल्डर में सहेजी जाएगी।'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-[#17365D] mb-1">
                        क्लिक लिंक URL (CTA Link - ऐच्छिक)
                      </label>
                      <input
                        type="text"
                        value={mediaCtaUrl}
                        onChange={(e) => setMediaCtaUrl(e.target.value)}
                        placeholder="उदा: /opportunities या https://..."
                        className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] bg-white text-[#17365D] font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#17365D] mb-1">
                        बटन लेबल (CTA Button Text - ऐच्छिक)
                      </label>
                      <input
                        type="text"
                        value={mediaCtaLabel}
                        onChange={(e) => setMediaCtaLabel(e.target.value)}
                        placeholder="उदा: अभी आवेदन करें, जानकारी देखें"
                        className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] bg-white text-[#17365D] font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 bg-[#F7F9FC] border border-[#DCE3EA] rounded-xl">
                    <div>
                      <label className="block font-bold text-[#17365D] mb-1.5">
                        तस्वीरें चुनें (Select Files)
                      </label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                          const files = e.target.files ? Array.from(e.target.files) : [];
                          if (files.length > 0) {
                            mediaPreviews.forEach((u) => {
                              if (u.startsWith('blob:')) {
                                try { URL.revokeObjectURL(u); } catch {}
                              }
                            });
                            const nextPreviews = files.map((f) => URL.createObjectURL(f));
                            setMediaDirectUrl('');
                            setMediaFiles(files);
                            setMediaPreviews(nextPreviews);
                            setMediaFile(files[0]);
                            setMediaPreview(nextPreviews[0]);
                            if (!mediaTitle.trim()) {
                              const cleanedName = files[0].name
                                .replace(/\.[^/.]+$/, '')
                                .replace(/[_-]+/g, ' ')
                                .trim();
                              if (cleanedName) setMediaTitle(cleanedName);
                            }
                          }
                        }}
                        className="w-full p-2 rounded-xl border border-[#DCE3EA] bg-white text-[#17365D]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#17365D] mb-1.5">
                        इमेज URL पेस्ट करें (Direct URL)
                      </label>
                      <input
                        type="url"
                        value={mediaDirectUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMediaDirectUrl(val);
                          if (val.trim()) {
                            mediaPreviews.forEach((u) => {
                              if (u.startsWith('blob:')) {
                                try { URL.revokeObjectURL(u); } catch {}
                              }
                            });
                            setMediaFiles([]);
                            setMediaPreviews([]);
                            setMediaFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                            setMediaPreview(val.trim());
                          } else if (mediaFiles.length === 0) {
                            setMediaPreview('');
                          }
                        }}
                        placeholder="https://..."
                        className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] bg-white text-[#17365D] font-medium"
                      />
                    </div>
                  </div>

                  {mediaPreviews.length > 0 && (
                    <div className="p-3 bg-white border border-[#DCE3EA] rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-[#17365D]">
                        <span className="tabular-nums">चुनी गई तस्वीरें ({mediaPreviews.length}):</span>
                        <button
                          type="button"
                          onClick={() => {
                            mediaPreviews.forEach((u) => {
                              if (u.startsWith('blob:')) {
                                try { URL.revokeObjectURL(u); } catch {}
                              }
                            });
                            setMediaFiles([]);
                            setMediaPreviews([]);
                            setMediaFile(null);
                            setMediaPreview('');
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-[#9E2A2B] hover:underline text-[11px]"
                        >
                          सभी हटाएं
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {mediaPreviews.map((prev, pIdx) => (
                          <div key={pIdx} className="relative rounded-lg overflow-hidden border border-[#DCE3EA] h-24 bg-[#F7F9FC] group">
                            <img src={prev} alt={`Preview ${pIdx + 1}`} className="w-full h-full object-cover" />
                            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#17365D] text-white tabular-nums">
                              #{pIdx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const removed = mediaPreviews[pIdx];
                                if (removed?.startsWith('blob:')) {
                                  try { URL.revokeObjectURL(removed); } catch {}
                                }
                                const newFiles = mediaFiles.filter((_, i) => i !== pIdx);
                                const newPrev = mediaPreviews.filter((_, i) => i !== pIdx);
                                setMediaFiles(newFiles);
                                setMediaPreviews(newPrev);
                                if (newFiles.length > 0) {
                                  setMediaFile(newFiles[0]);
                                  setMediaPreview(newPrev[0]);
                                } else {
                                  setMediaFile(null);
                                  setMediaPreview('');
                                  if (fileInputRef.current) fileInputRef.current.value = '';
                                }
                              }}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#9E2A2B] text-white flex items-center justify-center text-[10px] font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!mediaPreviews.length && mediaPreview && (
                    <div className="p-3 bg-[#F7F9FC] border border-[#DCE3EA] rounded-xl space-y-2">
                      <span className="text-[11px] font-bold text-[#17365D]">छवि पूर्वावलोकन (Preview):</span>
                      <div className="max-h-48 overflow-hidden rounded-lg">
                        <img src={mediaPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                      </div>
                    </div>
                  )}

                  {mediaUploading && (
                    <div className="space-y-1.5 p-3 bg-[#E9F4F2] rounded-xl border border-[#287D73]/25">
                      <div className="flex justify-between text-xs font-bold text-[#287D73] tabular-nums">
                        <span>{uploadBatchStatus || 'अपलोड हो रहा है...'}</span>
                        <span>{mediaUploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-[#287D73] transition-all duration-300"
                          style={{ width: `${mediaUploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={mediaUploading}
                      className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white font-bold transition-colors disabled:opacity-50"
                    >
                      {mediaUploading
                        ? 'अपलोड हो रहा है...'
                        : editingMediaId
                        ? 'बदलाव सहेजें (Save Changes)'
                        : 'मीडिया अपलोड करें (Upload)'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Media Gallery Grid */}
              <div className="bg-white border border-[#DCE3EA] rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE3EA]">
                  <h3 className="text-base font-bold text-[#17365D] tabular-nums">
                    अपलोड की गई मीडिया सामग्री ({filteredMediaAssets.length})
                  </h3>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {[
                      { id: 'all', label: `सभी (${mediaAssets.length})` },
                      { id: 'banner', label: `होम बैनर (${heroBannerAssets.length})` },
                      { id: 'general', label: `योजनाएं / सामान्य (${generalSchemeAssets.length})` },
                      { id: 'training', label: 'कौशल गैलरी' },
                      { id: 'showcase', label: 'उत्पाद' },
                      { id: 'job', label: 'नौकरी' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setMediaCategoryFilter(cat.id)}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap border ${
                          mediaCategoryFilter === cat.id
                            ? 'bg-[#17365D] text-white border-[#17365D]'
                            : 'bg-[#F7F9FC] text-[#5F6B76] hover:text-[#17365D] border-[#DCE3EA]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={async () => {
                        const count = await mediaStorageService.syncLocalMediaToFirestore();
                        await loadMediaAndShowcase();
                        onNotify(
                          count > 0
                            ? `${count} स्थानीय तस्वीरें क्लाउड में सुरक्षित सिंक की गईं!`
                            : 'सभी तस्वीरें सिंक और अद्यतन हैं!'
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg font-bold bg-[#E9F4F2] hover:bg-[#287D73]/20 text-[#287D73] border border-[#287D73]/30 flex items-center gap-1"
                    >
                      <Icon name="refresh" size={13} />
                      <span>क्लाउड सिंक</span>
                    </button>
                  </div>
                </div>

                {filteredMediaAssets.length === 0 ? (
                  <div className="p-8 text-center bg-[#F7F9FC] rounded-xl border border-dashed border-[#DCE3EA] space-y-1">
                    <p className="font-bold text-sm text-[#17365D]">कोई मीडिया उपलब्ध नहीं है।</p>
                    <p className="text-xs text-[#5F6B76]">ऊपर दिए गए फ़ॉर्म से तस्वीरें चुनें और अपलोड करें।</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredMediaAssets.map((m, idx) => {
                      const isBanner = m.folder === 'banner' || m.folder === 'hero_banner';
                      const isScheme = m.folder === 'general' || m.folder === 'schemes' || m.folder === 'scheme';
                      const supportsOrder = isBanner || isScheme;
                      const groupList = isBanner ? heroBannerAssets : generalSchemeAssets;
                      const bannerIdx = supportsOrder ? groupList.findIndex((b) => b.id === m.id) : -1;
                      const displayOrder = typeof m.order === 'number'
                        ? m.order
                        : (bannerIdx >= 0 ? bannerIdx + 1 : idx + 1);

                      return (
                        <div
                          key={m.id}
                          className={`rounded-2xl border overflow-hidden bg-white flex flex-col ${
                            m.active === false
                              ? 'border-dashed border-slate-300 opacity-60 bg-[#F7F9FC]'
                              : 'border-[#DCE3EA] hover:border-[#245A91]'
                          }`}
                        >
                          <div className="h-44 bg-slate-900 relative group overflow-hidden">
                            <img
                              src={m.url}
                              alt={m.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/70 text-white uppercase">
                                {m.folder}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  m.active !== false
                                    ? 'bg-[#287D73] text-white'
                                    : 'bg-slate-700 text-slate-200'
                                }`}
                              >
                                {m.active !== false ? 'सक्रिय' : 'छिपा हुआ'}
                              </span>
                            </div>

                            {supportsOrder && (
                              <div className="absolute top-2.5 right-2.5">
                                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-[#17365D] text-white tabular-nums">
                                  स्थान #{displayOrder}
                                </span>
                              </div>
                            )}

                            <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                              <p className="font-bold text-sm line-clamp-1">{m.name}</p>
                              {m.ctaUrl && (
                                <p className="text-[10px] text-cyan-200 truncate mt-0.5 font-semibold">
                                  {m.ctaLabel || 'लिंक'}: {m.ctaUrl}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3 bg-[#F7F9FC]">
                            {supportsOrder && (
                              <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-[#DCE3EA]">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-[#17365D]">क्रम (Pos):</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="99"
                                    value={displayOrder}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10);
                                      if (!isNaN(val)) handleSetSlideOrder(m.id, val);
                                    }}
                                    className="w-12 p-1 text-center font-bold text-xs rounded-lg border border-[#DCE3EA] bg-[#F7F9FC] text-[#17365D] tabular-nums"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={bannerIdx <= 0}
                                    onClick={() => handleMoveSlide(m.id, 'up')}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#17365D] text-white hover:bg-[#245A91] disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
                                  >
                                    <Icon name="arrowUp" size={13} />
                                    <span>ऊपर</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={bannerIdx < 0 || bannerIdx >= groupList.length - 1}
                                    onClick={() => handleMoveSlide(m.id, 'down')}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#17365D] text-white hover:bg-[#245A91] disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
                                  >
                                    <Icon name="arrowDown" size={13} />
                                    <span>नीचे</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center flex-wrap gap-1.5 pt-1 border-t border-[#DCE3EA]">
                              <button
                                type="button"
                                onClick={() => handleToggleMediaActive(m.id, m.active)}
                                className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold border flex items-center gap-1 ${
                                  m.active !== false
                                    ? 'bg-white hover:bg-slate-100 text-[#5F6B76] border-[#DCE3EA]'
                                    : 'bg-[#E9F4F2] text-[#287D73] border-[#287D73]/30'
                                }`}
                              >
                                <Icon name={m.active !== false ? 'eyeOff' : 'eye'} size={13} />
                                <span>{m.active !== false ? 'छिपाएं' : 'सक्रिय'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditMedia(m)}
                                className="py-1.5 px-2.5 rounded-lg text-[11px] font-bold bg-white hover:bg-slate-100 text-[#17365D] border border-[#DCE3EA] flex items-center gap-1"
                              >
                                <Icon name="edit" size={12} />
                                <span>संपादित</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(m.url);
                                  onNotify('URL कॉपी हो गया!');
                                }}
                                className="py-1.5 px-2.5 rounded-lg text-[11px] font-bold bg-white hover:bg-slate-100 text-[#245A91] border border-[#DCE3EA] flex items-center gap-1"
                              >
                                <Icon name="copy" size={12} />
                                <span>URL</span>
                              </button>
                              {confirmActionKey === `media:${m.id}` ? (
                                <span className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMedia(m.id)}
                                    className="py-1.5 px-2 rounded-lg text-[11px] font-bold bg-[#9E2A2B] text-white"
                                  >
                                    पुष्टि
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmActionKey(null)}
                                    className="py-1.5 px-2 rounded-lg text-[11px] font-bold bg-white border border-[#DCE3EA] text-[#5F6B76]"
                                  >
                                    रद्द
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmActionKey(`media:${m.id}`)}
                                  className="py-1.5 px-2.5 rounded-lg text-[11px] font-bold bg-red-50 hover:bg-red-100 text-[#9E2A2B] border border-red-200 flex items-center gap-1"
                                >
                                  <Icon name="trash" size={12} />
                                  <span>हटाएं</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Showcase Moderation */}
              {showcaseProducts.length > 0 && (
                <div className="bg-white border border-[#DCE3EA] rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-bold text-[#17365D] tabular-nums">
                    ग्रामीण उत्पाद प्रदर्शनी प्रबंधन (Showcase Moderation · {showcaseProducts.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {showcaseProducts.map((p) => (
                      <div key={p.id} className="p-3 bg-[#F7F9FC] border border-[#DCE3EA] rounded-xl flex items-center gap-3">
                        <img src={p.imageUrl} alt={p.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-[#DCE3EA]" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs text-[#17365D] truncate">{p.title}</div>
                          <div className="text-[11px] text-[#5F6B76] truncate">{p.artisanName} · {p.location}</div>
                          <div className="pt-1">
                            {confirmActionKey === `show:${p.id}` ? (
                              <span className="inline-flex items-center gap-2 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteShowcase(p.id)}
                                  className="text-[#9E2A2B] font-extrabold hover:underline"
                                >
                                  हटाएं
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmActionKey(null)}
                                  className="text-[#5F6B76] font-bold hover:underline"
                                >
                                  रद्द
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmActionKey(`show:${p.id}`)}
                                className="text-[11px] text-[#9E2A2B] font-bold hover:underline"
                              >
                                Remove Listing
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: PUSH NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="bg-white border border-[#DCE3EA] rounded-2xl overflow-hidden space-y-6 p-6 sm:p-8 max-w-3xl text-left">
              <div>
                <h3 className="text-lg font-extrabold text-[#17365D] flex items-center gap-2">
                  <Icon name="bell" size={20} className="text-[#245A91]" />
                  <span>Background Push Notification &amp; Alert Center</span>
                </h3>
                <p className="text-xs sm:text-sm text-[#5F6B76] mt-1">
                  Send background push notifications and WhatsApp reminders to registered citizens.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-[#17365D] uppercase mb-1.5">
                    Target Recipient (प्राप्तकर्ता)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNotifTarget('all')}
                      className={`min-h-[48px] p-3 rounded-xl border text-left font-bold text-xs sm:text-sm flex items-center justify-between transition-colors ${
                        notifTarget === 'all'
                          ? 'border-[#245A91] bg-[#245A91]/10 text-[#17365D]'
                          : 'border-[#DCE3EA] bg-white text-[#5F6B76] hover:border-[#245A91]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon name="users" size={16} className="text-[#245A91]" />
                        <span>All Citizens (सभी नागरिक)</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#245A91] text-white text-[10px] tabular-nums">
                        {users.length} citizens
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNotifTarget('specific')}
                      className={`min-h-[48px] p-3 rounded-xl border text-left font-bold text-xs sm:text-sm flex items-center justify-between transition-colors ${
                        notifTarget === 'specific'
                          ? 'border-[#245A91] bg-[#245A91]/10 text-[#17365D]'
                          : 'border-[#DCE3EA] bg-white text-[#5F6B76] hover:border-[#245A91]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon name="user" size={16} className="text-[#245A91]" />
                        <span>Specific Citizen (विशिष्ट नागरिक)</span>
                      </span>
                    </button>
                  </div>
                </div>

                {notifTarget === 'specific' && (
                  <div>
                    <label className="block text-xs font-bold text-[#17365D] uppercase mb-1">
                      Select Target Citizen
                    </label>
                    <select
                      value={notifTargetUserId}
                      onChange={(e) => setNotifTargetUserId(e.target.value)}
                      className="w-full min-h-[44px] p-3 rounded-xl border border-[#DCE3EA] text-xs sm:text-sm font-semibold bg-white text-[#17365D]"
                    >
                      <option value="">-- Choose Citizen --</option>
                      {users.map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {u.name} ({u.phone ? `+91 ${u.phone}` : 'No phone'} - {u.location || 'India'} - {u.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#17365D] uppercase mb-1">
                    Notification Title (शीर्षक)
                  </label>
                  <input
                    type="text"
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    placeholder="e.g. नया रोजगार अवसर उपलब्ध है!"
                    className="w-full min-h-[44px] p-3 rounded-xl border border-[#DCE3EA] text-xs sm:text-sm font-semibold bg-white text-[#17365D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17365D] uppercase mb-1">
                    Notification Message Body (संदेश)
                  </label>
                  <textarea
                    rows={3}
                    value={notifBody}
                    onChange={(e) => setNotifBody(e.target.value)}
                    placeholder="Enter notification message..."
                    className="w-full p-3 rounded-xl border border-[#DCE3EA] text-xs sm:text-sm font-medium bg-white text-[#17365D]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSendPushNotification}
                    disabled={notifSending}
                    className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Icon name="bell" size={16} />
                    <span>{notifSending ? 'Broadcasting...' : 'Push Notification Broadcast'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: SUB-ADMINS MANAGEMENT & 7-DAY ACTIVITY LOGS */}
          {activeTab === 'sub_admins' && (
            <div className="space-y-5">
              {subAdminRulesError && (
                <div className="bg-[#FFF8EB] border border-[#D9822B]/40 rounded-2xl p-4 text-xs text-[#7C4A03] space-y-2">
                  <div className="font-extrabold flex items-center gap-1.5 text-[#9A5B04]">
                    <Icon name="info" size={15} />
                    <span>Firebase Firestore Rules पब्लिश करना आवश्यक है (Rules Deployment Notice)</span>
                  </div>
                  <p className="leading-relaxed">
                    सब-एडमिन और 7-दिन एक्टिविटी लॉग्स को लाइव Firestore में सेव करने के लिए कृपया अपने प्रोजेक्ट की अपडेटेड <code className="px-1.5 py-0.5 bg-white rounded border border-[#D9822B]/30 font-mono">firestore.rules</code> फाइल को Firebase Console → Firestore Database → Rules में पब्लिश करें।
                  </p>
                  <a
                    href={`https://console.firebase.google.com/project/${appletConfig.projectId}/firestore/databases/${appletConfig.firestoreDatabaseId}/rules`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D9822B] hover:bg-[#B86A1E] text-white font-bold text-[11px] transition-colors"
                  >
                    <Icon name="external" size={13} />
                    <span>Firebase Firestore Rules खोलें (Open Console)</span>
                  </a>
                </div>
              )}

              {/* Super Admin: Add Sub-Admin by Gmail Card */}
              {isSuperAdmin && (
                <div className="bg-white border border-[#DCE3EA] rounded-2xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DCE3EA]">
                    <div>
                      <h2 className="text-base sm:text-lg font-extrabold text-[#17365D] flex items-center gap-2 font-['Bricolage_Grotesque']">
                        <Icon name="shieldCheck" size={18} className="text-[#287D73]" />
                        <span>नया सब-एडमिन जोड़ें (Add Sub-Admin by Gmail)</span>
                      </h2>
                      <p className="text-xs text-[#5F6B76] mt-0.5">
                        यहाँ जोड़ा गया Gmail खाता Admin Login में <strong>Google से 1-क्लिक लॉगिन</strong> करके तुरंत एडमिन पैनल चला सकता है। उनकी हर Add/Edit/Delete गतिविधि 7 दिनों तक नीचे रिकॉर्ड होती है।
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-[#E9F4F2] text-[#287D73] border border-[#287D73]/25 text-[11px] font-bold self-start sm:self-center whitespace-nowrap">
                      कुल सब-एडमिन: {subAdmins.length}
                    </span>
                  </div>

                  {subAdminError && (
                    <div className="p-3 rounded-xl bg-[#FDEDEC] text-[#9E2A2B] border border-[#9E2A2B]/20 text-xs font-semibold flex items-center gap-2">
                      <Icon name="info" size={14} className="shrink-0" />
                      <span>{subAdminError}</span>
                    </div>
                  )}

                  <form onSubmit={handleAddSubAdmin} className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                    <div className="md:col-span-4">
                      <label className="block font-bold text-[#17365D] mb-1">
                        Sub-Admin Gmail ID *
                      </label>
                      <input
                        type="email"
                        required
                        value={subAdminEmailInput}
                        onChange={(e) => setSubAdminEmailInput(e.target.value)}
                        placeholder="example@gmail.com"
                        className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-[#DCE3EA] focus:border-[#245A91] focus:outline-none text-[#17365D] font-medium"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block font-bold text-[#17365D] mb-1">
                        नाम (Name)
                      </label>
                      <input
                        type="text"
                        value={subAdminNameInput}
                        onChange={(e) => setSubAdminNameInput(e.target.value)}
                        placeholder="जैसे: राहुल वर्मा"
                        className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-[#DCE3EA] focus:border-[#245A91] focus:outline-none text-[#17365D]"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block font-bold text-[#17365D] mb-1">
                        जिम्मेदारी / जिला (Note)
                      </label>
                      <input
                        type="text"
                        value={subAdminNoteInput}
                        onChange={(e) => setSubAdminNoteInput(e.target.value)}
                        placeholder="जैसे: गोरखपुर Jobs & Media"
                        className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-[#DCE3EA] focus:border-[#245A91] focus:outline-none text-[#17365D]"
                      />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <button
                        type="submit"
                        disabled={subAdminSubmitting}
                        className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Icon name="plus" size={14} />
                        <span>{subAdminSubmitting ? 'जोड़ रहे...' : 'जोड़ें'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Main Split Grid: Sub-Admins List (Left) + Last 7 Days Activity Inspector (Right) */}
              <div className={`grid grid-cols-1 ${isSuperAdmin ? 'lg:grid-cols-12' : ''} gap-5 items-start`}>
                {isSuperAdmin && (
                  <div className="lg:col-span-5 bg-white border border-[#DCE3EA] rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#DCE3EA]">
                      <div>
                        <h3 className="text-sm font-extrabold text-[#17365D]">
                          जोड़े गए सब-एडमिन ({subAdmins.length})
                        </h3>
                        <p className="text-[11px] text-[#5F6B76]">
                          किसी भी सब-एडमिन पर टैप करें और उनकी 7 दिन की गतिविधि देखें
                        </p>
                      </div>
                      {selectedSubAdminEmail && (
                        <button
                          type="button"
                          onClick={() => setSelectedSubAdminEmail(null)}
                          className="text-[11px] font-bold text-[#245A91] hover:underline"
                        >
                          सभी देखें
                        </button>
                      )}
                    </div>

                    {subAdmins.length === 0 ? (
                      <div className="py-10 px-4 text-center bg-[#F7F9FC] rounded-xl border border-dashed border-[#DCE3EA] space-y-2">
                        <div className="w-11 h-11 rounded-xl bg-white border border-[#DCE3EA] text-[#245A91] mx-auto flex items-center justify-center">
                          <Icon name="users" size={20} />
                        </div>
                        <div className="text-xs font-bold text-[#17365D]">अभी कोई सब-एडमिन नहीं जोड़ा गया है</div>
                        <p className="text-[11px] text-[#5F6B76]">
                          ऊपर Gmail पता डालकर पहला सब-एडमिन जोड़ें। जुड़ते ही वे यहाँ लिस्ट में दिखाई देंगे।
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {subAdmins.map((sa) => {
                          const stats = getActorActivityStats(sa.email);
                          const isSelected = selectedSubAdminEmail === sa.email;
                          return (
                            <div
                              key={sa.email}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setSelectedSubAdminEmail(sa.email);
                                setActivityActionFilter('ALL');
                                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                                  setTimeout(() => {
                                    activityPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }, 80);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedSubAdminEmail(sa.email);
                                }
                              }}
                              className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                                isSelected
                                  ? 'bg-[#EEF5FC] border-[#245A91] ring-1 ring-[#245A91]'
                                  : 'bg-[#F7F9FC] border-[#DCE3EA] hover:border-[#245A91]/60 hover:bg-white'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`w-9 h-9 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 ${
                                    sa.active
                                      ? 'bg-[#17365D] text-white'
                                      : 'bg-slate-200 text-slate-600'
                                  }`}>
                                    {(sa.name || sa.email).slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-extrabold text-[#17365D] truncate flex items-center gap-1.5">
                                      <span className="truncate">{sa.name || sa.email.split('@')[0]}</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                                        sa.active
                                          ? 'bg-[#E9F4F2] text-[#287D73] border border-[#287D73]/25'
                                          : 'bg-slate-200 text-slate-600'
                                      }`}>
                                        {sa.active ? 'Active' : 'Paused'}
                                      </span>
                                    </div>
                                    <div className="text-[11px] font-mono text-[#245A91] truncate">{sa.email}</div>
                                    {sa.note && (
                                      <div className="text-[10px] text-[#5F6B76] truncate mt-0.5">{sa.note}</div>
                                    )}
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold text-[#245A91] shrink-0">
                                  {isSelected ? 'चयनित ✓' : 'लॉग देखें →'}
                                </span>
                              </div>

                              {/* 7-Day Activity Summary Strip */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#DCE3EA]/80 text-[10px]">
                                <div className="flex items-center gap-1.5 tabular-nums font-bold">
                                  <span className="px-2 py-0.5 rounded bg-[#E9F4F2] text-[#287D73]">
                                    +{stats.added} जोड़ा
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-[#EEF5FC] text-[#245A91]">
                                    ✎{stats.updated} बदला
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-[#FDEDEC] text-[#9E2A2B]">
                                    ✕{stats.deleted} हटाया
                                  </span>
                                </div>

                                <div
                                  className="flex items-center gap-1.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSubAdmin(sa)}
                                    className="px-2 py-1 rounded-lg border border-[#DCE3EA] bg-white hover:bg-slate-50 text-[#17365D] font-bold text-[10px]"
                                  >
                                    {sa.active ? 'रोकें' : 'चालू करें'}
                                  </button>
                                  {confirmActionKey === `remove-sa:${sa.email}` ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveSubAdmin(sa)}
                                        className="px-2 py-1 rounded-lg bg-[#9E2A2B] text-white font-bold text-[10px]"
                                      >
                                        हटाएं
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmActionKey(null)}
                                        className="px-2 py-1 rounded-lg border border-[#DCE3EA] bg-white text-[#5F6B76] font-bold text-[10px]"
                                      >
                                        रद्द
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmActionKey(`remove-sa:${sa.email}`)}
                                      className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-[#9E2A2B] border border-red-200 font-bold text-[10px]"
                                    >
                                      हटाएं
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-[#5F6B76]">
                                <span>जोड़ा गया: {new Date(sa.addedAt).toLocaleDateString('en-IN')}</span>
                                <span>
                                  {sa.lastLoginAt
                                    ? `अंतिम लॉगिन: ${new Date(sa.lastLoginAt).toLocaleDateString('en-IN')}`
                                    : 'अभी तक लॉगिन नहीं किया'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Right Column: Last 7 Days Activity Audit Trail */}
                <div
                  ref={activityPanelRef}
                  className={`${isSuperAdmin ? 'lg:col-span-7' : 'w-full'} bg-white border border-[#DCE3EA] rounded-2xl p-4 sm:p-5 space-y-4`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DCE3EA]">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#287D73]">
                        Last 7 Days Audit Trail · पिछले 7 दिनों की गतिविधि
                      </div>
                      <h3 className="text-base font-extrabold text-[#17365D] mt-0.5">
                        {isSuperAdmin
                          ? selectedSubAdminEmail
                            ? `${subAdmins.find((s) => s.email === selectedSubAdminEmail)?.name || selectedSubAdminEmail}`
                            : 'सभी एडमिन और सब-एडमिन गतिविधि (All Activity)'
                          : `मेरी गतिविधि (${currentUser?.email})`}
                      </h3>
                      {isSuperAdmin && selectedSubAdminEmail && (
                        <p className="text-[11px] font-mono text-[#245A91]">{selectedSubAdminEmail}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {(['ALL', 'ADD', 'UPDATE', 'DELETE'] as const).map((act) => {
                        const labels = {
                          ALL: 'सभी (All)',
                          ADD: '+ जोड़ा (Added)',
                          UPDATE: '✎ बदला (Updated)',
                          DELETE: '✕ हटाया (Deleted)',
                        };
                        return (
                          <button
                            key={act}
                            type="button"
                            onClick={() => setActivityActionFilter(act)}
                            className={`px-2.5 py-1.5 rounded-lg font-bold border transition-colors ${
                              activityActionFilter === act
                                ? 'bg-[#17365D] text-white border-[#17365D]'
                                : 'bg-[#F7F9FC] text-[#5F6B76] border-[#DCE3EA] hover:text-[#17365D]'
                            }`}
                          >
                            {labels[act]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary Strip */}
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-2.5 rounded-xl bg-[#E9F4F2] border border-[#287D73]/25">
                      <div className="text-lg font-extrabold text-[#287D73] tabular-nums">
                        {visibleActivityLogs.filter((l) => l.action === 'ADD').length}
                      </div>
                      <div className="text-[10px] font-bold text-[#17365D]">जोड़ा (Added)</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#EEF5FC] border border-[#245A91]/25">
                      <div className="text-lg font-extrabold text-[#245A91] tabular-nums">
                        {visibleActivityLogs.filter((l) => l.action === 'UPDATE').length}
                      </div>
                      <div className="text-[10px] font-bold text-[#17365D]">बदला (Updated)</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#FDEDEC] border border-[#9E2A2B]/25">
                      <div className="text-lg font-extrabold text-[#9E2A2B] tabular-nums">
                        {visibleActivityLogs.filter((l) => l.action === 'DELETE').length}
                      </div>
                      <div className="text-[10px] font-bold text-[#17365D]">हटाया (Deleted)</div>
                    </div>
                  </div>

                  {/* Chronological 7-Day Activity Feed */}
                  {visibleActivityLogs.length === 0 ? (
                    <div className="py-12 px-4 text-center bg-[#F7F9FC] rounded-xl border border-dashed border-[#DCE3EA] space-y-1.5">
                      <div className="text-xs font-bold text-[#17365D]">
                        पिछले 7 दिनों में कोई रिकॉर्ड की गई गतिविधि नहीं मिली
                      </div>
                      <p className="text-[11px] text-[#5F6B76]">
                        जब भी यह खाता कोई नौकरी, पाठ्यक्रम, बैनर, या नागरिक रिकॉर्ड जोड़ेगा, बदलेगा या हटाएगा — वह तुरंत यहाँ तारीख और समय के साथ दिखेगा।
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
                      {visibleActivityLogs.map((log) => {
                        const badgeClass =
                          log.action === 'ADD'
                            ? 'bg-[#E9F4F2] text-[#287D73] border-[#287D73]/30'
                            : log.action === 'DELETE'
                            ? 'bg-[#FDEDEC] text-[#9E2A2B] border-[#9E2A2B]/30'
                            : 'bg-[#EEF5FC] text-[#245A91] border-[#245A91]/30';

                        const actionText =
                          log.action === 'ADD'
                            ? 'जोड़ा (ADDED)'
                            : log.action === 'DELETE'
                            ? 'हटाया (DELETED)'
                            : 'बदला (UPDATED)';

                        return (
                          <div
                            key={log.id}
                            className="p-3.5 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] space-y-1.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${badgeClass}`}>
                                  {actionText}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white border border-[#DCE3EA] text-[#17365D]">
                                  {getSectionLabel(log.section)}
                                </span>
                              </div>
                              <span className="text-[10px] font-semibold text-[#5F6B76] tabular-nums">
                                {formatActivityTime(log.createdAt)}
                              </span>
                            </div>

                            <div className="text-xs font-extrabold text-[#17365D]">
                              {log.targetTitle}
                            </div>

                            {log.details && (
                              <div className="text-[11px] text-[#5F6B76] leading-relaxed">
                                {log.details}
                              </div>
                            )}

                            <div className="text-[10px] text-[#5F6B76] flex items-center justify-between pt-1 border-t border-[#DCE3EA]/60">
                              <span>
                                द्वारा: <strong className="text-[#17365D]">{log.actorName}</strong> ({log.actorEmail})
                              </span>
                              <span className="uppercase font-bold text-[9px] text-[#245A91]">
                                {log.actorRole === 'admin' ? 'Super Admin' : 'Sub-Admin'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: ADD JOB */}
      {showAddJobModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#DCE3EA] space-y-4 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EA]">
              <h3 className="text-base font-bold text-[#17365D] flex items-center gap-2">
                <Icon name="plus" size={16} className="text-[#245A91]" />
                <span>Add Verified Job Opportunity</span>
              </h3>
              <button
                onClick={() => setShowAddJobModal(false)}
                className="w-8 h-8 rounded-lg bg-[#F7F9FC] text-[#5F6B76] hover:text-[#17365D] flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#17365D] mb-1">Job Title *</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Solar PV Assistant or CSC Operator"
                  required
                  className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] text-[#17365D] font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-[#17365D] mb-1">Company / Organization *</label>
                <input
                  type="text"
                  value={jobOrg}
                  onChange={(e) => setJobOrg(e.target.value)}
                  placeholder="e.g. Gramin Urja Samiti or CSC Partner"
                  required
                  className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] text-[#17365D] font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#17365D] mb-1">Type</label>
                  <select
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value as any)}
                    className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] bg-white text-[#17365D]"
                  >
                    <option value="Job">Job (नौकरी)</option>
                    <option value="Training">Training (प्रशिक्षण)</option>
                    <option value="Self-employment">Self-employment (स्वरोजगार)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#17365D] mb-1">State</label>
                  <select
                    value={jobState}
                    onChange={(e) => setJobState(e.target.value)}
                    className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] bg-white text-[#17365D] font-medium"
                  >
                    {availableStates.filter((s) => s !== 'All India').map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#17365D] mb-1">District / Town</label>
                  <input
                    type="text"
                    value={jobLoc}
                    onChange={(e) => setJobLoc(e.target.value)}
                    placeholder="e.g. Maharajganj town"
                    className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] text-[#17365D]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#17365D] mb-1">Salary / Remuneration</label>
                  <input
                    type="text"
                    value={jobPay}
                    onChange={(e) => setJobPay(e.target.value)}
                    placeholder="e.g. ₹9,000 - ₹13,000 / month"
                    className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] text-[#17365D]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#17365D] mb-1">Eligibility Criteria</label>
                <input
                  type="text"
                  value={jobEligibility}
                  onChange={(e) => setJobEligibility(e.target.value)}
                  placeholder="e.g. 10th pass with basic smartphone fluency"
                  className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] text-[#17365D]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#17365D] mb-1">Contact Details / Coordinator Office</label>
                <input
                  type="text"
                  value={jobContact}
                  onChange={(e) => setJobContact(e.target.value)}
                  placeholder="e.g. District Coordinator, Vikas Bhavan, Room 102"
                  className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] text-[#17365D]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DCE3EA]">
                <button
                  type="button"
                  onClick={() => setShowAddJobModal(false)}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-[#DCE3EA] font-bold text-[#5F6B76]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white font-bold"
                >
                  Publish Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD PATHWAY */}
      {showAddPathwayModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#DCE3EA] space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EA]">
              <h3 className="text-base font-bold text-[#17365D] flex items-center gap-2">
                <Icon name="layers" size={16} className="text-[#245A91]" />
                <span>Add NSQF Skill Pathway</span>
              </h3>
              <button
                onClick={() => setShowAddPathwayModal(false)}
                className="w-8 h-8 rounded-lg bg-[#F7F9FC] text-[#5F6B76] hover:text-[#17365D] flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePathway} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#17365D] mb-1">Pathway Title (English) *</label>
                <input
                  type="text"
                  value={pathwayName}
                  onChange={(e) => setPathwayName(e.target.value)}
                  placeholder="e.g. Drone Pilot & Agri-Surveyor"
                  required
                  className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] text-[#17365D] font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-[#17365D] mb-1">Hindi Title *</label>
                <input
                  type="text"
                  value={pathwayHi}
                  onChange={(e) => setPathwayHi(e.target.value)}
                  placeholder="उदा. ड्रोन पायलट व कृषि सर्वेक्षक"
                  required
                  className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] text-[#17365D]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#17365D] mb-1">NSQF Level (1 to 8)</label>
                  <select
                    value={pathwayNsqf}
                    onChange={(e) => setPathwayNsqf(Number(e.target.value))}
                    className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] bg-white text-[#17365D]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((lvl) => (
                      <option key={lvl} value={lvl}>Level {lvl}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#17365D] mb-1">Duration</label>
                  <input
                    type="text"
                    value={pathwayDuration}
                    onChange={(e) => setPathwayDuration(e.target.value)}
                    placeholder="e.g. 3 months"
                    className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] text-[#17365D]"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-[#17365D] mb-1">Job Role Description</label>
                <input
                  type="text"
                  value={pathwayRole}
                  onChange={(e) => setPathwayRole(e.target.value)}
                  placeholder="e.g. Certified Drone Operator for Farming"
                  className="w-full min-h-[42px] p-2.5 rounded-xl border border-[#DCE3EA] text-[#17365D]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DCE3EA]">
                <button
                  type="button"
                  onClick={() => setShowAddPathwayModal(false)}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-[#DCE3EA] font-bold text-[#5F6B76]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white font-bold"
                >
                  Create Pathway
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW CITIZEN DOSSIER */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#DCE3EA] space-y-4 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EA]">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${
                    selectedUserDetail.status === 'completed'
                      ? 'bg-[#E9F4F2] text-[#287D73] border-[#287D73]/30'
                      : 'bg-[#FFF8EB] text-[#B45309] border-[#FDE68A]'
                  }`}>
                    {selectedUserDetail.status === 'completed' ? 'पूर्ण प्रोफ़ाइल' : 'अधूरा प्रोफ़ाइल'}
                  </span>
                  {selectedUserDetail.activeNow && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#287D73] bg-[#E9F4F2] px-2 py-0.5 rounded-md border border-[#287D73]/25">
                      Active Now
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-extrabold text-[#17365D] mt-1">
                  {selectedUserDetail.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="w-8 h-8 rounded-lg bg-[#F7F9FC] text-[#5F6B76] hover:text-[#17365D] flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-[#F7F9FC] border border-[#DCE3EA] rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#17365D]">
                <span>प्रोफ़ाइल पूर्णता स्तर (Completion)</span>
                <span className={`tabular-nums ${selectedUserDetail.completionPercent === 100 ? 'text-[#287D73]' : 'text-[#B45309]'}`}>
                  {selectedUserDetail.completionPercent}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full transition-all ${selectedUserDetail.completionPercent === 100 ? 'bg-[#287D73]' : 'bg-[#D9822B]'}`}
                  style={{ width: `${selectedUserDetail.completionPercent}%` }}
                />
              </div>
              {selectedUserDetail.missingFields.length > 0 && (
                <div className="text-[11px] text-[#B45309] font-semibold flex items-center gap-1">
                  <span>बाकी विवरण:</span>
                  <span>{selectedUserDetail.missingFields.join(', ')}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA]">
                  <span className="text-[10px] uppercase font-bold text-[#5F6B76]">मोबाइल नंबर</span>
                  <div className="font-bold text-[#17365D] mt-0.5 flex items-center gap-1 tabular-nums">
                    <Icon name="phone" size={12} className="text-[#245A91]" />
                    <span className="font-mono text-sm">{selectedUserDetail.phone ? `+91 ${selectedUserDetail.phone}` : 'नंबर अनुपलब्ध'}</span>
                  </div>
                  <div className="text-[10px] text-[#287D73] font-semibold mt-0.5">सत्यापित 4-Digit PIN खाता</div>
                </div>
                <div className="p-3 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA]">
                  <span className="text-[10px] uppercase font-bold text-[#5F6B76]">जिला व राज्य</span>
                  <div className="font-bold text-[#17365D] mt-0.5">{selectedUserDetail.location}</div>
                  <div className="text-[10px] text-[#5F6B76]">{selectedUserDetail.state}</div>
                </div>
              </div>

              <div className="p-3 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#5F6B76]">शिक्षा स्तर (Education)</span>
                <div className="font-bold text-[#17365D]">{selectedUserDetail.education}</div>
              </div>

              <div className="p-3 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#5F6B76]">हुनर व कौशल (Recorded Skills)</span>
                <div className="text-[#202B36] font-medium">{selectedUserDetail.skills}</div>
              </div>

              <div className="p-3 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#5F6B76]">कार्य रुचि व मोबिलिटी</span>
                <div className="text-[#202B36] font-medium">
                  {selectedUserDetail.interests} · <strong>प्राथमिकता:</strong> {selectedUserDetail.workType} ({selectedUserDetail.mobility})
                </div>
              </div>

              <div className="p-3.5 bg-[#E9F4F2] border border-[#287D73]/30 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-[#17365D]">
                  <span>अनुशंसित NSQF पाथवे:</span>
                  <span className="text-[#287D73] tabular-nums">{selectedUserDetail.matchScore}% Match Score</span>
                </div>
                <div className="font-bold text-sm text-[#17365D]">
                  {selectedUserDetail.matchedPathwayName}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-[#DCE3EA]">
              <button
                onClick={() => handleSendWhatsAppReminder(selectedUserDetail)}
                className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <span>WhatsApp पर रिमाइंडर भेजें</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {confirmActionKey === `modal-user:${selectedUserDetail.uid}` ? (
                  <>
                    <button
                      onClick={() => handleDeleteUser(selectedUserDetail.uid)}
                      className="min-h-[42px] px-3 py-2 rounded-xl bg-[#9E2A2B] text-white font-bold text-xs"
                    >
                      पुष्टि करें
                    </button>
                    <button
                      onClick={() => setConfirmActionKey(null)}
                      className="min-h-[42px] px-3 py-2 rounded-xl border border-[#DCE3EA] text-[#5F6B76] font-bold text-xs"
                    >
                      रद्द
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmActionKey(`modal-user:${selectedUserDetail.uid}`)}
                    className="min-h-[42px] px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-[#9E2A2B] font-bold text-xs border border-red-200"
                  >
                    खाता मिटाएं
                  </button>
                )}
                <button
                  onClick={() => setSelectedUserDetail(null)}
                  className="flex-1 sm:flex-none min-h-[42px] px-4 py-2 rounded-xl bg-[#17365D] hover:bg-[#245A91] text-white font-bold text-xs"
                >
                  बंद करें
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
