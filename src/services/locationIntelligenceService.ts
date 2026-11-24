import {
  Opportunity,
  GovernmentScheme,
  LocationInsight,
  LocationLivelihoodData,
  SupportedLanguage,
  BeneficiaryProfile,
  LocationAccuracyLevel,
  LocationAccuracyInfo,
} from '../types';
import { storageService } from './storageService';
import { aiGateway } from './aiGateway';

// Storage keys (v4 drops all legacy curated/demo/offline Maharajganj caches)
const LOCATION_DATA_CACHE_KEY = 'jeevika_location_livelihood_cache_v4';
const LEGACY_CACHE_KEYS = [
  'jeevika_location_livelihood_cache_v1',
  'jeevika_location_livelihood_cache_v2',
  'jeevika_location_livelihood_cache_v3',
];
const ACTIVE_LOCATION_KEY = 'jeevika_active_location_v4';
const ACCURACY_STORAGE_KEY = 'jeevika_location_accuracy_v4';

export const DEFAULT_SCHEME_IMAGE = '';

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt?: number;
}

export interface LocationDetectionResult {
  location: string;
  district: string;
  state: string;
  accuracyLevel: LocationAccuracyLevel;
  confidenceScore: number;
  accuracyMeters?: number;
  latitude: number;
  longitude: number;
  locality?: string;
  pincode?: string;
  source: 'gps' | 'manual' | 'cache' | 'default';
  description: string;
}

export interface IndianStateDistricts {
  state: string;
  stateHi: string;
  districts: { name: string; hi: string }[];
}

export const POPULAR_INDIAN_REGIONS: IndianStateDistricts[] = [
  {
    state: 'Uttar Pradesh',
    stateHi: 'उत्तर प्रदेश',
    districts: [
      { name: 'Maharajganj', hi: 'महराजगंज' },
      { name: 'Gorakhpur', hi: 'गोरखपुर' },
      { name: 'Varanasi', hi: 'वाराणसी' },
      { name: 'Lucknow', hi: 'लखनऊ' },
      { name: 'Prayagraj', hi: 'प्रयागराज' },
      { name: 'Ayodhya', hi: 'अयोध्या' },
      { name: 'Azamgarh', hi: 'आजमगढ़' },
      { name: 'Basti', hi: 'बस्ती' },
      { name: 'Deoria', hi: 'देवरिया' },
      { name: 'Kushinagar', hi: 'कुशीनगर' },
      { name: 'Mirzapur', hi: 'मिर्ज़ापुर' },
      { name: 'Kanpur Nagar', hi: 'कानपुर नगर' },
      { name: 'Agra', hi: 'आगरा' },
      { name: 'Bareilly', hi: 'बरेली' },
      { name: 'Meerut', hi: 'मेरठ' },
    ],
  },
  {
    state: 'Bihar',
    stateHi: 'बिहार',
    districts: [
      { name: 'Patna', hi: 'पटना' },
      { name: 'Gaya', hi: 'गया' },
      { name: 'Muzaffarpur', hi: 'मुजफ्फरपुर' },
      { name: 'Bhagalpur', hi: 'भागलपुर' },
      { name: 'Darbhanga', hi: 'दरभंगा' },
      { name: 'Purnia', hi: 'पूर्णिया' },
      { name: 'Samastipur', hi: 'समस्तीपुर' },
      { name: 'Saran (Chhapra)', hi: 'सारण (छपरा)' },
      { name: 'Siwan', hi: 'सीवान' },
      { name: 'Gopalganj', hi: 'गोपालगंज' },
      { name: 'Vaishali', hi: 'वैशाली' },
      { name: 'Begusarai', hi: 'बेगूसराय' },
      { name: 'Nalanda', hi: 'नालंदा' },
    ],
  },
  {
    state: 'Madhya Pradesh',
    stateHi: 'मध्य प्रदेश',
    districts: [
      { name: 'Bhopal', hi: 'भोपाल' },
      { name: 'Indore', hi: 'इंदौर' },
      { name: 'Gwalior', hi: 'ग्वालियर' },
      { name: 'Jabalpur', hi: 'जबलपुर' },
      { name: 'Ujjain', hi: 'उज्जैन' },
      { name: 'Rewa', hi: 'रीवा' },
      { name: 'Satna', hi: 'सतना' },
      { name: 'Sagar', hi: 'सागर' },
    ],
  },
  {
    state: 'Rajasthan',
    stateHi: 'राजस्थान',
    districts: [
      { name: 'Jaipur', hi: 'जयपुर' },
      { name: 'Jodhpur', hi: 'जोधपुर' },
      { name: 'Udaipur', hi: 'उदयपुर' },
      { name: 'Kota', hi: 'कोटा' },
      { name: 'Bikaner', hi: 'बीकानेर' },
      { name: 'Ajmer', hi: 'अजमेर' },
      { name: 'Alwar', hi: 'अलवर' },
    ],
  },
  {
    state: 'Jharkhand',
    stateHi: 'झारखंड',
    districts: [
      { name: 'Ranchi', hi: 'राँची' },
      { name: 'Dhanbad', hi: 'धनबाद' },
      { name: 'Jamshedpur (East Singhbhum)', hi: 'जमशेदपुर' },
      { name: 'Bokaro', hi: 'बोकारो' },
      { name: 'Deoghar', hi: 'देवघर' },
      { name: 'Hazaribagh', hi: 'हजारीबाग' },
    ],
  },
  {
    state: 'Maharashtra',
    stateHi: 'महाराष्ट्र',
    districts: [
      { name: 'Mumbai Suburban', hi: 'मुंबई' },
      { name: 'Pune', hi: 'पुणे' },
      { name: 'Nagpur', hi: 'नागपुर' },
      { name: 'Nashik', hi: 'नासिक' },
      { name: 'Chhatrapati Sambhajinagar', hi: 'छत्रपति संभाजीनगर' },
      { name: 'Thane', hi: 'ठाणे' },
    ],
  },
  {
    state: 'Haryana',
    stateHi: 'हरियाणा',
    districts: [
      { name: 'Gurugram', hi: 'गुरुग्राम' },
      { name: 'Faridabad', hi: 'फरीदाबाद' },
      { name: 'Hisar', hi: 'हिसार' },
      { name: 'Karnal', hi: 'करनाल' },
      { name: 'Rohtak', hi: 'रोहतक' },
      { name: 'Panipat', hi: 'पानीपत' },
    ],
  },
  {
    state: 'West Bengal',
    stateHi: 'पश्चिम बंगाल',
    districts: [
      { name: 'Kolkata', hi: 'कोलकाता' },
      { name: 'Howrah', hi: 'हावड़ा' },
      { name: 'North 24 Parganas', hi: 'उत्तर 24 परगना' },
      { name: 'Siliguri (Darjeeling)', hi: 'सिलीगुड़ी' },
      { name: 'Murshidabad', hi: 'मुर्शिदाबाद' },
      { name: 'Asansol (Paschim Bardhaman)', hi: 'आसनसोल' },
    ],
  },
  {
    state: 'Delhi NCR',
    stateHi: 'दिल्ली एनसीआर',
    districts: [
      { name: 'North East Delhi', hi: 'उत्तर पूर्व दिल्ली' },
      { name: 'South Delhi', hi: 'दक्षिण दिल्ली' },
      { name: 'West Delhi', hi: 'पश्चिम दिल्ली' },
      { name: 'East Delhi', hi: 'पूर्वी दिल्ली' },
      { name: 'Noida (Gautam Buddha Nagar)', hi: 'नोएडा' },
      { name: 'Ghaziabad', hi: 'गाजियाबाद' },
    ],
  },
];

export function isValidCoordinatePair(lat?: number, lng?: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** Haversine distance in kilometers between two lat/lng points */
export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Normalizes any Hindi or English district/location string to a comparison key.
 */
export function normalizeDistrictKey(districtStr: string): string {
  if (!districtStr) return '';
  const parts = districtStr.split(',').map((p) => p.trim()).filter(Boolean);
  const raw = parts.length >= 3 ? parts[parts.length - 2] : parts[0] || districtStr;
  let s = raw.toLowerCase().trim();
  s = s.replace(/ज़िला|जिला|district|शहर|city|town/gi, '').trim();

  if (s.includes('ghaziabad') || s.includes('गाजियाबाद') || s.includes('ग़ाज़ियाबाद')) return 'ghaziabad';
  if (s.includes('gorakhpur') || s.includes('गोरखपुर')) return 'gorakhpur';
  if (s.includes('lucknow') || s.includes('लखनऊ')) return 'lucknow';
  if (s.includes('varanasi') || s.includes('वाराणसी') || s.includes('बनारस') || s.includes('kashi')) return 'varanasi';
  if (s.includes('patna') || s.includes('पटना')) return 'patna';
  if (s.includes('noida') || s.includes('नोएडा') || s.includes('gautam buddha')) return 'noida';
  if (s.includes('delhi') || s.includes('दिल्ली')) return 'delhi';
  if (s.includes('kanpur') || s.includes('कानपुर')) return 'kanpur';
  if (s.includes('maharajganj') || s.includes('महराजगंज')) return 'maharajganj';

  return s.replace(/[^a-z0-9]/g, '');
}

/**
 * Parses "Locality, District, State" | "District, State" | "District" cleanly
 * and auto-resolves Indian state when only district/city is provided.
 */
export function parseLocationParts(loc?: string): { locality: string; district: string; state: string } {
  const cleaned = String(loc || '').trim();
  if (!cleaned) {
    return { locality: '', district: '', state: '' };
  }
  const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);
  let locality = '';
  let district = '';
  let state = '';

  if (parts.length >= 3) {
    locality = parts[0];
    district = parts[parts.length - 2];
    state = parts[parts.length - 1];
  } else if (parts.length === 2) {
    district = parts[0];
    state = parts[1];
  } else {
    district = parts[0];
  }

  if (!state && district) {
    const dLower = district.toLowerCase();
    const matchedRegion = POPULAR_INDIAN_REGIONS.find((r) =>
      r.districts.some(
        (d) =>
          d.name.toLowerCase() === dLower ||
          d.name.toLowerCase().includes(dLower) ||
          dLower.includes(d.name.toLowerCase().split('(')[0].trim()) ||
          d.hi === district
      )
    );
    state = matchedRegion ? matchedRegion.state : 'India';
  }

  return {
    locality,
    district,
    state: state || 'India',
  };
}

/**
 * Reference coordinates used ONLY when a user manually chooses a district without GPS.
 */
export const DISTRICT_COORDINATES: Record<string, { lat: number; lng: number }> = {
  ghaziabad: { lat: 28.6692, lng: 77.4538 },
  maharajganj: { lat: 27.1439, lng: 83.5619 },
  gorakhpur: { lat: 26.7606, lng: 83.3732 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  varanasi: { lat: 25.3176, lng: 82.9739 },
  prayagraj: { lat: 25.4358, lng: 81.8463 },
  ayodhya: { lat: 26.7922, lng: 82.1998 },
  basti: { lat: 26.8, lng: 82.7667 },
  deoria: { lat: 26.5, lng: 83.78 },
  kushinagar: { lat: 26.74, lng: 83.89 },
  azamgarh: { lat: 26.068, lng: 83.184 },
  mirzapur: { lat: 25.1337, lng: 82.5644 },
  kanpurnagar: { lat: 26.4499, lng: 80.3319 },
  kanpur: { lat: 26.4499, lng: 80.3319 },
  agra: { lat: 27.1767, lng: 78.0081 },
  meerut: { lat: 28.9845, lng: 77.7064 },
  bareilly: { lat: 28.367, lng: 79.4304 },
  noida: { lat: 28.5355, lng: 77.391 },
  patna: { lat: 25.5941, lng: 85.1376 },
  gaya: { lat: 24.7914, lng: 85.0002 },
  muzaffarpur: { lat: 26.1209, lng: 85.3647 },
  bhagalpur: { lat: 25.2425, lng: 86.9842 },
  darbhanga: { lat: 26.1542, lng: 85.8918 },
  ranchi: { lat: 23.3441, lng: 85.3096 },
  dhanbad: { lat: 23.7957, lng: 86.4304 },
  jamshedpur: { lat: 22.8046, lng: 86.2029 },
  delhi: { lat: 28.6139, lng: 77.209 },
  gurugram: { lat: 28.4595, lng: 77.0266 },
  faridabad: { lat: 28.4089, lng: 77.3178 },
  bhopal: { lat: 23.2599, lng: 77.4126 },
  indore: { lat: 22.7196, lng: 75.8577 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  jodhpur: { lat: 26.2389, lng: 73.0243 },
  udaipur: { lat: 24.5854, lng: 73.7125 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  pune: { lat: 18.5204, lng: 73.8567 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  dehradun: { lat: 30.3165, lng: 78.0322 },
  guwahati: { lat: 26.1445, lng: 91.7362 },
  bhubaneswar: { lat: 20.2961, lng: 85.8245 },
};

export function getDistrictCoordinates(districtStr?: string): { lat: number; lng: number } {
  if (!districtStr) return { lat: 28.6139, lng: 77.209 };
  const key = normalizeDistrictKey(districtStr);
  return DISTRICT_COORDINATES[key] || { lat: 26.8467, lng: 80.9462 };
}

export function getNearestDistrict(lat: number, lng: number): { district: string; state: string } {
  let nearestDist = Infinity;
  let bestDistrict = 'Local Area';
  let bestState = 'India';

  const districtStateMap: Record<string, string> = {
    ghaziabad: 'Uttar Pradesh',
    maharajganj: 'Uttar Pradesh',
    gorakhpur: 'Uttar Pradesh',
    lucknow: 'Uttar Pradesh',
    varanasi: 'Uttar Pradesh',
    prayagraj: 'Uttar Pradesh',
    ayodhya: 'Uttar Pradesh',
    basti: 'Uttar Pradesh',
    deoria: 'Uttar Pradesh',
    kushinagar: 'Uttar Pradesh',
    azamgarh: 'Uttar Pradesh',
    mirzapur: 'Uttar Pradesh',
    kanpurnagar: 'Uttar Pradesh',
    kanpur: 'Uttar Pradesh',
    agra: 'Uttar Pradesh',
    meerut: 'Uttar Pradesh',
    bareilly: 'Uttar Pradesh',
    noida: 'Delhi NCR',
    patna: 'Bihar',
    gaya: 'Bihar',
    muzaffarpur: 'Bihar',
    bhagalpur: 'Bihar',
    darbhanga: 'Bihar',
    ranchi: 'Jharkhand',
    dhanbad: 'Jharkhand',
    jamshedpur: 'Jharkhand',
    delhi: 'Delhi NCR',
    gurugram: 'Haryana',
    faridabad: 'Haryana',
    bhopal: 'Madhya Pradesh',
    indore: 'Madhya Pradesh',
    jaipur: 'Rajasthan',
    jodhpur: 'Rajasthan',
    udaipur: 'Rajasthan',
    mumbai: 'Maharashtra',
    pune: 'Maharashtra',
    nagpur: 'Maharashtra',
    kolkata: 'West Bengal',
    bengaluru: 'Karnataka',
    hyderabad: 'Telangana',
    chennai: 'Tamil Nadu',
    ahmedabad: 'Gujarat',
    chandigarh: 'Chandigarh',
    dehradun: 'Uttarakhand',
    guwahati: 'Assam',
    bhubaneswar: 'Odisha',
  };

  for (const [distKey, coords] of Object.entries(DISTRICT_COORDINATES)) {
    const dist = haversineDistanceKm(lat, lng, coords.lat, coords.lng);
    if (dist < nearestDist) {
      nearestDist = dist;
      bestDistrict = distKey.charAt(0).toUpperCase() + distKey.slice(1);
      bestState = districtStateMap[distKey] || 'India';
    }
  }

  return { district: bestDistrict, state: bestState };
}

class LocationIntelligenceService {
  private activeLocation: string = '';
  private cachedData: LocationLivelihoodData | null = null;
  private currentAccuracy: LocationAccuracyInfo | null = null;
  /** Strictly prioritized live GPS coordinates captured during this session */
  private liveGpsCoords: GpsCoordinates | null = null;
  private listeners: ((data: LocationLivelihoodData) => void)[] = [];
  private inFlightRequests = new Map<string, Promise<LocationLivelihoodData>>();

  constructor() {
    this.init();
  }

  private init() {
    try {
      // Purge all legacy cache versions that could contain stale/demo Maharajganj data
      LEGACY_CACHE_KEYS.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });
      try {
        localStorage.removeItem('jeevika_active_location_v2');
        localStorage.removeItem('jeevika_location_accuracy_v2');
      } catch {}

      const savedLoc = localStorage.getItem(ACTIVE_LOCATION_KEY);
      if (savedLoc && savedLoc.trim()) {
        this.activeLocation = savedLoc.trim();
      }

      const savedAcc = localStorage.getItem(ACCURACY_STORAGE_KEY);
      if (savedAcc) {
        const parsedAcc = JSON.parse(savedAcc) as LocationAccuracyInfo;
        if (parsedAcc && isValidCoordinatePair(parsedAcc.latitude, parsedAcc.longitude)) {
          this.currentAccuracy = parsedAcc;
        }
      }

      // Only restore cached data if it is genuinely AI-generated and has valid coordinates
      const cached = localStorage.getItem(LOCATION_DATA_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as LocationLivelihoodData;
        const hasLegacyOfflineDemo =
          Array.isArray(parsed?.opportunities) &&
          parsed.opportunities.some((o) => String(o?.id || '').startsWith('offline-'));
        if (
          parsed &&
          parsed.isAiGenerated === true &&
          !hasLegacyOfflineDemo &&
          isValidCoordinatePair(parsed.latitude, parsed.longitude)
        ) {
          if (Array.isArray(parsed.schemes)) {
            parsed.schemes = parsed.schemes.map((s) =>
              s && typeof s.imageUrl === 'string' && s.imageUrl.includes('hero_livelihood_banner_')
                ? { ...s, imageUrl: undefined }
                : s
            );
          }
          this.cachedData = parsed;
        } else {
          localStorage.removeItem(LOCATION_DATA_CACHE_KEY);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  public getActiveLocation(): string {
    return this.activeLocation;
  }

  public getLiveGpsCoordinates(): GpsCoordinates | null {
    if (this.liveGpsCoords && isValidCoordinatePair(this.liveGpsCoords.latitude, this.liveGpsCoords.longitude)) {
      return this.liveGpsCoords;
    }
    if (
      this.currentAccuracy?.source === 'gps' &&
      isValidCoordinatePair(this.currentAccuracy.latitude, this.currentAccuracy.longitude)
    ) {
      return {
        latitude: this.currentAccuracy.latitude!,
        longitude: this.currentAccuracy.longitude!,
        accuracyMeters: this.currentAccuracy.accuracyMeters,
      };
    }
    return null;
  }

  public hasLiveGpsCoordinates(): boolean {
    return this.getLiveGpsCoordinates() !== null;
  }

  public setActiveLocation(loc: string, accuracyInfo?: LocationAccuracyInfo): void {
    if (!loc || !loc.trim()) return;
    this.activeLocation = loc.trim();
    try {
      localStorage.setItem(ACTIVE_LOCATION_KEY, this.activeLocation);
      if (accuracyInfo) {
        this.currentAccuracy = accuracyInfo;
        localStorage.setItem(ACCURACY_STORAGE_KEY, JSON.stringify(accuracyInfo));
        if (
          accuracyInfo.source === 'gps' &&
          isValidCoordinatePair(accuracyInfo.latitude, accuracyInfo.longitude)
        ) {
          this.liveGpsCoords = {
            latitude: accuracyInfo.latitude!,
            longitude: accuracyInfo.longitude!,
            accuracyMeters: accuracyInfo.accuracyMeters,
            capturedAt: Date.now(),
          };
        } else if (accuracyInfo.source === 'manual') {
          // User explicitly overrode location manually; clear session GPS lock until next GPS sync
          this.liveGpsCoords = null;
        }
      }
    } catch {
      // Ignore
    }
  }

  public getLocationAccuracy(): LocationAccuracyInfo {
    // 1. Live GPS coordinates always take strict priority
    if (this.liveGpsCoords && isValidCoordinatePair(this.liveGpsCoords.latitude, this.liveGpsCoords.longitude)) {
      const base = this.currentAccuracy;
      return {
        level: base?.level || 'Precise',
        confidenceScore: base?.confidenceScore || 95,
        accuracyMeters: this.liveGpsCoords.accuracyMeters ?? base?.accuracyMeters,
        latitude: this.liveGpsCoords.latitude,
        longitude: this.liveGpsCoords.longitude,
        locality: base?.locality,
        pincode: base?.pincode,
        source: 'gps',
        description:
          base?.description ||
          `सटीक जीपीएस स्थान (${this.liveGpsCoords.latitude.toFixed(4)}, ${this.liveGpsCoords.longitude.toFixed(4)})`,
      };
    }

    // 2. Stored accuracy info (if present and valid)
    if (this.currentAccuracy && isValidCoordinatePair(this.currentAccuracy.latitude, this.currentAccuracy.longitude)) {
      return this.currentAccuracy;
    }

    // 3. No GPS captured yet
    const coords = this.activeLocation ? getDistrictCoordinates(this.activeLocation) : undefined;
    return {
      level: 'District-level',
      confidenceScore: coords ? 82 : 0,
      latitude: coords?.lat,
      longitude: coords?.lng,
      source: coords ? 'manual' : 'default',
      description: coords
        ? 'जिला स्तर चयन (सटीक अवसरों के लिए GPS सिंक करें)'
        : 'GPS स्थान प्रतीक्षित है (Awaiting GPS coordinates)',
    };
  }

  public setLocationAccuracy(info: LocationAccuracyInfo): void {
    this.currentAccuracy = info;
    if (info.source === 'gps' && isValidCoordinatePair(info.latitude, info.longitude)) {
      this.liveGpsCoords = {
        latitude: info.latitude!,
        longitude: info.longitude!,
        accuracyMeters: info.accuracyMeters,
        capturedAt: Date.now(),
      };
    }
    try {
      localStorage.setItem(ACCURACY_STORAGE_KEY, JSON.stringify(info));
    } catch {
      // Ignore
    }
  }

  public setManualDistrict(districtName: string, stateName: string): LocationAccuracyInfo {
    const fullLoc = `${districtName}, ${stateName}`;
    const coords = getDistrictCoordinates(districtName);
    const info: LocationAccuracyInfo = {
      level: 'District-level',
      confidenceScore: 88,
      source: 'manual',
      latitude: coords.lat,
      longitude: coords.lng,
      description: `मैनुअल चयन: ${districtName} (${stateName})`,
    };
    this.liveGpsCoords = null;
    this.setActiveLocation(fullLoc, info);
    return info;
  }

  /**
   * Returns cached data ONLY if it is live AI-generated AND matches the current GPS coordinates / location.
   * Never returns hardcoded or demo fallback datasets.
   */
  public getCachedData(locationOverride?: string): LocationLivelihoodData | null {
    if (!this.cachedData || !this.cachedData.isAiGenerated) {
      return null;
    }

    // If live GPS coordinates are present, verify cached data is within 2 km of current GPS fix
    const gps = this.getLiveGpsCoordinates();
    if (gps) {
      if (!isValidCoordinatePair(this.cachedData.latitude, this.cachedData.longitude)) {
        return null;
      }
      const distKm = haversineDistanceKm(
        gps.latitude,
        gps.longitude,
        this.cachedData.latitude!,
        this.cachedData.longitude!
      );
      if (distKm > 2) {
        return null;
      }
      return this.cachedData;
    }

    const loc = (locationOverride && locationOverride.trim()) || this.activeLocation;
    if (loc) {
      const activeKey = normalizeDistrictKey(loc);
      const cachedKey = normalizeDistrictKey(this.cachedData.district || this.cachedData.location || '');
      if (activeKey && cachedKey && activeKey !== cachedKey) {
        return null;
      }
    }
    return this.cachedData;
  }

  public clearCachedData(): void {
    this.cachedData = null;
    try {
      localStorage.removeItem(LOCATION_DATA_CACHE_KEY);
    } catch {}
  }

  public subscribe(cb: (data: LocationLivelihoodData) => void): () => void {
    this.listeners.push(cb);
    if (this.cachedData && this.cachedData.isAiGenerated) {
      cb(this.cachedData);
    }
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify(data: LocationLivelihoodData) {
    this.cachedData = data;
    // Persist ONLY genuine live AI-generated data to cache; never cache empty/error states
    if (data.isAiGenerated) {
      try {
        localStorage.setItem(LOCATION_DATA_CACHE_KEY, JSON.stringify(data));
        storageService.saveCachedLivelihoodData(data);
      } catch {
        // Ignore
      }
    }
    this.listeners.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error('Location listener error:', e);
      }
    });
  }

  /**
   * Resolves human-readable locality, district, state, and pincode from exact GPS coordinates
   * while strictly preserving the captured latitude & longitude.
   */
  public async resolveLocationFromCoordinates(
    latitude: number,
    longitude: number,
    accuracyMeters = 45
  ): Promise<LocationDetectionResult> {
    let rawDistrict = '';
    let locality = '';
    let pincode = '';
    let state = '';
    let isGeocoded = false;

    // 1. OpenStreetMap Nominatim (zoom=18 for exact village/town/suburb precision)
    try {
      const nomController = new AbortController();
      const nomTimer = setTimeout(() => nomController.abort(), 4500);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        { headers: { Accept: 'application/json' }, signal: nomController.signal }
      );
      clearTimeout(nomTimer);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        locality =
          addr.village ||
          addr.hamlet ||
          addr.suburb ||
          addr.neighbourhood ||
          addr.town ||
          addr.city_district ||
          addr.residential ||
          '';
        rawDistrict = addr.state_district || addr.county || addr.city || addr.district || addr.town || '';
        if (addr.state) state = addr.state;
        if (addr.postcode) pincode = addr.postcode;
        if (rawDistrict || locality) isGeocoded = true;
      }
    } catch {
      // Nominatim unavailable or timed out
    }

    // 2. BigDataCloud Reverse Geocoding fallback/enrichment
    if (!rawDistrict || !state || !locality) {
      try {
        const bdcController = new AbortController();
        const bdcTimer = setTimeout(() => bdcController.abort(), 4500);
        const bdcRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
          { signal: bdcController.signal }
        );
        clearTimeout(bdcTimer);
        if (bdcRes.ok) {
          const bdc = await bdcRes.json();
          const adminList = bdc.localityInfo?.administrative || [];
          const districtEntry = adminList.find(
            (a: any) =>
              (a.adminLevel === 6 || a.adminLevel === 5) &&
              !String(a.name || '').toLowerCase().includes('division') &&
              !String(a.name || '').toLowerCase().includes('mandal')
          );
          if (!rawDistrict) {
            rawDistrict = districtEntry?.name || bdc.city || bdc.locality || '';
          }
          if (!state && bdc.principalSubdivision) state = bdc.principalSubdivision;
          if (!locality && bdc.locality) locality = bdc.locality;
          if (!pincode && bdc.postcode) pincode = bdc.postcode;
          if (rawDistrict || locality) isGeocoded = true;
        }
      } catch {
        // Ignore BigDataCloud error
      }
    }

    let cleanDistrict = rawDistrict ? rawDistrict.replace(/\bdistrict\b/i, '').trim() : '';
    const lowerClean = cleanDistrict.toLowerCase();
    const isExactStateName = [
      'uttar pradesh', 'bihar', 'madhya pradesh', 'rajasthan', 'jharkhand',
      'maharashtra', 'haryana', 'west bengal', 'punjab', 'gujarat', 'uttarakhand',
      'chhattisgarh', 'odisha', 'karnataka', 'tamil nadu', 'telangana',
      'andhra pradesh', 'kerala', 'assam', 'himachal pradesh', 'goa',
    ].includes(lowerClean);

    if (!cleanDistrict || isExactStateName || cleanDistrict.length < 2) {
      if (locality && locality.length >= 2) {
        cleanDistrict = locality;
      } else {
        const nearest = getNearestDistrict(latitude, longitude);
        cleanDistrict = nearest.district;
        if (!state) state = nearest.state;
      }
    }

    if (!state) {
      const parsedState = parseLocationParts(cleanDistrict).state;
      state = parsedState && parsedState !== 'India' ? parsedState : getNearestDistrict(latitude, longitude).state;
    }

    const cleanLocality = locality ? locality.replace(/tahsil|tehsil|block|sub-district/gi, '').trim() : '';
    const hasDistinctLocality = Boolean(
      cleanLocality &&
        cleanLocality.length > 1 &&
        cleanLocality.toLowerCase() !== cleanDistrict.toLowerCase() &&
        !cleanDistrict.toLowerCase().includes(cleanLocality.toLowerCase())
    );
    const fullLoc = hasDistinctLocality
      ? `${cleanLocality}, ${cleanDistrict}, ${state}`
      : `${cleanDistrict}, ${state}`;

    let accuracyLevel: LocationAccuracyLevel = 'District-level';
    let confidenceScore = 85;
    let description = '';

    if (accuracyMeters <= 200 || (cleanLocality && accuracyMeters <= 800)) {
      accuracyLevel = 'Precise';
      confidenceScore = Math.max(91, Math.min(99, Math.round(100 - accuracyMeters / 25)));
      description = `सटीक जीपीएस स्थान (${latitude.toFixed(4)}, ${longitude.toFixed(4)} · ±${accuracyMeters}m)${cleanLocality ? ` · ${cleanLocality}` : ''}`;
    } else if (accuracyMeters <= 10000 && isGeocoded) {
      accuracyLevel = 'District-level';
      confidenceScore = Math.max(80, Math.min(90, Math.round(90 - (accuracyMeters - 200) / 600)));
      description = `जीपीएस लोकेशन (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) · ${cleanDistrict}`;
    } else {
      accuracyLevel = 'Precise';
      confidenceScore = isGeocoded ? 84 : 78;
      description = `जीपीएस निर्देशांक (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) · ${cleanDistrict}`;
    }

    const accuracyInfo: LocationAccuracyInfo = {
      level: accuracyLevel,
      confidenceScore,
      accuracyMeters,
      latitude,
      longitude,
      locality: cleanLocality || undefined,
      pincode: pincode || undefined,
      source: 'gps',
      description,
    };

    this.liveGpsCoords = {
      latitude,
      longitude,
      accuracyMeters,
      capturedAt: Date.now(),
    };
    this.setActiveLocation(fullLoc, accuracyInfo);

    return {
      location: fullLoc,
      district: cleanDistrict,
      state,
      accuracyLevel,
      confidenceScore,
      accuracyMeters,
      latitude,
      longitude,
      locality: cleanLocality || undefined,
      pincode: pincode || undefined,
      source: 'gps',
      description,
    };
  }

  /**
   * Forces live AI-driven livelihood data generation strictly anchored to GPS coordinates
   * (when available) or explicit user-selected area. Eliminates demo/placeholder datasets.
   */
  public async fetchLocationData(
    targetLocation?: string,
    currentLang: SupportedLanguage = 'hi',
    userProfile?: BeneficiaryProfile | null,
    forceRefresh = false,
    coordsOverride?: GpsCoordinates | null
  ): Promise<LocationLivelihoodData> {
    // 1. Strictly prioritize GPS coordinates over cached/string locations
    let effectiveCoords: GpsCoordinates | null = null;
    let coordinateSource: 'gps' | 'manual' | 'cache' | 'default' = 'manual';

    if (coordsOverride && isValidCoordinatePair(coordsOverride.latitude, coordsOverride.longitude)) {
      effectiveCoords = coordsOverride;
      coordinateSource = 'gps';
      this.liveGpsCoords = {
        latitude: coordsOverride.latitude,
        longitude: coordsOverride.longitude,
        accuracyMeters: coordsOverride.accuracyMeters,
        capturedAt: Date.now(),
      };
    } else if (this.liveGpsCoords && isValidCoordinatePair(this.liveGpsCoords.latitude, this.liveGpsCoords.longitude)) {
      effectiveCoords = this.liveGpsCoords;
      coordinateSource = 'gps';
    } else if (
      this.currentAccuracy?.source === 'gps' &&
      isValidCoordinatePair(this.currentAccuracy.latitude, this.currentAccuracy.longitude)
    ) {
      effectiveCoords = {
        latitude: this.currentAccuracy.latitude!,
        longitude: this.currentAccuracy.longitude!,
        accuracyMeters: this.currentAccuracy.accuracyMeters,
      };
      coordinateSource = 'gps';
    } else if (isValidCoordinatePair(userProfile?.latitude, userProfile?.longitude)) {
      effectiveCoords = {
        latitude: userProfile!.latitude!,
        longitude: userProfile!.longitude!,
        accuracyMeters: userProfile?.locationAccuracyMeters,
      };
      coordinateSource = 'gps';
    }

    let loc = (targetLocation || this.activeLocation || '').trim();
    if (!loc && effectiveCoords) {
      const resolved = await this.resolveLocationFromCoordinates(
        effectiveCoords.latitude,
        effectiveCoords.longitude,
        effectiveCoords.accuracyMeters || 45
      );
      loc = resolved.location;
    }

    if (loc) {
      this.setActiveLocation(loc);
    }

    const parsedParts = parseLocationParts(loc);
    const accuracy = this.getLocationAccuracy();
    const locality = parsedParts.locality || accuracy.locality || '';
    const district = parsedParts.district || (effectiveCoords ? getNearestDistrict(effectiveCoords.latitude, effectiveCoords.longitude).district : '');
    const state = parsedParts.state || (effectiveCoords ? getNearestDistrict(effectiveCoords.latitude, effectiveCoords.longitude).state : '');
    const pincode = accuracy.pincode || '';
    const requestedDistrictKey = normalizeDistrictKey(district);

    // If no GPS coordinates exist at all, derive district coordinates ONLY for manual district selection
    if (!effectiveCoords && district) {
      const manualCoords = getDistrictCoordinates(district);
      effectiveCoords = { latitude: manualCoords.lat, longitude: manualCoords.lng };
      coordinateSource = 'manual';
    }

    const resolvedLat = effectiveCoords?.latitude;
    const resolvedLng = effectiveCoords?.longitude;

    // Only reuse in-memory live AI data if NOT forceRefresh AND coordinates/district match closely
    if (!forceRefresh && this.cachedData && this.cachedData.isAiGenerated) {
      const sameCoords =
        isValidCoordinatePair(resolvedLat, resolvedLng) &&
        isValidCoordinatePair(this.cachedData.latitude, this.cachedData.longitude) &&
        haversineDistanceKm(resolvedLat!, resolvedLng!, this.cachedData.latitude!, this.cachedData.longitude!) <= 1.5;
      const sameDistrict =
        requestedDistrictKey &&
        normalizeDistrictKey(this.cachedData.district || this.cachedData.location || '') === requestedDistrictKey;

      if (sameCoords && sameDistrict && this.cachedData.opportunities.length > 0) {
        return this.cachedData;
      }
    }

    const coordSig = isValidCoordinatePair(resolvedLat, resolvedLng)
      ? `${resolvedLat!.toFixed(4)},${resolvedLng!.toFixed(4)}`
      : 'no-coords';
    const profileSig = [
      userProfile?.education || '',
      userProfile?.skills || '',
      userProfile?.interests || '',
      userProfile?.workType || '',
    ].join('|');
    const requestKey = `${coordSig}|${loc.toLowerCase()}|${currentLang}|${profileSig.toLowerCase()}`;

    if (!forceRefresh && this.inFlightRequests.has(requestKey)) {
      return this.inFlightRequests.get(requestKey)!;
    }

    const runFetch = async (): Promise<LocationLivelihoodData> => {
      const attemptAiFetch = async (): Promise<LocationLivelihoodData | null> => {
        const payload = await aiGateway.generateLocationData({
          location: loc || (isValidCoordinatePair(resolvedLat, resolvedLng) ? `${resolvedLat!.toFixed(5)}, ${resolvedLng!.toFixed(5)}` : 'India'),
          district,
          state,
          locality,
          pincode,
          latitude: resolvedLat,
          longitude: resolvedLng,
          accuracyMeters: effectiveCoords?.accuracyMeters ?? accuracy.accuracyMeters,
          coordinateSource,
          forceRefresh: true,
          language: currentLang,
          existingProfile: userProfile || {},
        });

        const hasOfflineDemoIds =
          Array.isArray(payload?.result?.opportunities) &&
          payload.result.opportunities.some((o: any) => String(o?.id || '').startsWith('offline-'));

        const rawReturnedDistrict = String(payload?.result?.district || '').trim();
        const returnedDistrictKey = normalizeDistrictKey(rawReturnedDistrict);
        const isWrongMaharajganjLeak =
          returnedDistrictKey === 'maharajganj' &&
          Boolean(requestedDistrictKey) &&
          requestedDistrictKey !== 'maharajganj';

        if (
          payload &&
          payload.result &&
          !payload.fallback &&
          !(payload as any).offline &&
          !hasOfflineDemoIds &&
          !isWrongMaharajganjLeak
        ) {
          const toStringArray = (val: unknown): string[] => {
            if (Array.isArray(val)) return val.map((x) => String(x).trim()).filter(Boolean);
            if (typeof val === 'string') return val.split(/[,;\n।|]+/).map((s) => s.trim()).filter(Boolean);
            return [];
          };
          const normalizeOpp = (o: any, idx: number, prefix: string): Opportunity => ({
            ...o,
            id: String(o?.id || `${prefix}-${Date.now()}-${idx}`),
            title: String(o?.title || '').trim(),
            org: String(o?.org || '').trim(),
            type: prefix === 'tr' ? 'Training' : o?.type === 'Self-employment' ? 'Self-employment' : 'Job',
            loc: String(o?.loc || loc || district).trim(),
            km: typeof o?.km === 'number' && Number.isFinite(o.km) ? o.km : 4,
            pay: String(o?.pay || '').trim(),
            path: String(o?.path || 'digital').trim(),
            verified: o?.verified !== false,
            source: String(o?.source || 'Live AI Location Intelligence').trim(),
            lastVerifiedDate: String(o?.lastVerifiedDate || new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })),
            eligibility: String(o?.eligibility || '').trim(),
            documentsRequired: toStringArray(o?.documentsRequired),
            contactInfo: o?.contactInfo ? String(o.contactInfo).trim() : undefined,
          });

          const resolvedDistrict = rawReturnedDistrict || district;
          const resolvedState = String(payload.result.state || '').trim() || state;
          const displayLocation =
            loc || [locality, resolvedDistrict, resolvedState].filter(Boolean).join(', ');

          const rawInsight = payload.result.insight || {
            district: resolvedDistrict,
            state: resolvedState,
            economicHub: `${resolvedDistrict} Local Hub`,
            topSectors: [],
            averageMonthlyWage: '',
            activeSchemesCount: 0,
            openVacanciesCount: 0,
            verifiedCentersCount: 0,
            summary: '',
          };

          const opportunities = Array.isArray(payload.result.opportunities)
            ? payload.result.opportunities.map((o: any, i: number) => normalizeOpp(o, i, 'job')).filter((o: Opportunity) => Boolean(o.title))
            : [];
          const trainingCenters = Array.isArray(payload.result.trainingCenters)
            ? payload.result.trainingCenters.map((t: any, i: number) => normalizeOpp(t, i, 'tr')).filter((t: Opportunity) => Boolean(t.title))
            : [];
          const schemes: GovernmentScheme[] = Array.isArray(payload.result.schemes)
            ? payload.result.schemes.filter((s: any) => Boolean(s && (s.name || s.hiName)))
            : [];

          const liveData: LocationLivelihoodData = {
            location: displayLocation,
            district: resolvedDistrict,
            state: resolvedState,
            isAiGenerated: true,
            timestamp: new Date().toISOString(),
            accuracyLevel: coordinateSource === 'gps' ? accuracy.level : 'District-level',
            confidenceScore: coordinateSource === 'gps' ? accuracy.confidenceScore : 88,
            accuracyMeters: effectiveCoords?.accuracyMeters ?? accuracy.accuracyMeters,
            latitude: resolvedLat,
            longitude: resolvedLng,
            insight: {
              ...rawInsight,
              district: rawInsight?.district || resolvedDistrict,
              state: rawInsight?.state || resolvedState,
              topSectors: toStringArray(rawInsight?.topSectors),
              openVacanciesCount: rawInsight?.openVacanciesCount ?? opportunities.length,
              verifiedCentersCount: rawInsight?.verifiedCentersCount ?? trainingCenters.length,
              activeSchemesCount: rawInsight?.activeSchemesCount ?? schemes.length,
            },
            opportunities,
            trainingCenters,
            schemes,
          };

          this.notify(liveData);
          return liveData;
        }
        return null;
      };

      // Primary live AI attempt + 1 automatic retry for transient network hiccups
      try {
        const first = await attemptAiFetch();
        if (first) return first;
      } catch (err) {
        console.warn('Primary AI location fetch failed, retrying once:', err);
      }

      try {
        await new Promise((r) => setTimeout(r, 700));
        const retry = await attemptAiFetch();
        if (retry) return retry;
      } catch (err) {
        console.warn('Retry AI location fetch failed:', err);
      }

      // Strictly NO demo / curated Maharajganj placeholder data when AI is unreachable
      const emptyLiveState: LocationLivelihoodData = {
        location: loc || (isValidCoordinatePair(resolvedLat, resolvedLng) ? `${resolvedLat!.toFixed(4)}, ${resolvedLng!.toFixed(4)}` : ''),
        district,
        state,
        isAiGenerated: false,
        timestamp: new Date().toISOString(),
        accuracyLevel: accuracy.level,
        confidenceScore: accuracy.confidenceScore,
        accuracyMeters: effectiveCoords?.accuracyMeters ?? accuracy.accuracyMeters,
        latitude: resolvedLat,
        longitude: resolvedLng,
        insight: {
          district,
          state,
          economicHub: '',
          topSectors: [],
          averageMonthlyWage: '',
          activeSchemesCount: 0,
          openVacanciesCount: 0,
          verifiedCentersCount: 0,
          summary: '',
        },
        opportunities: [],
        trainingCenters: [],
        schemes: [],
      };
      this.notify(emptyLiveState);
      return emptyLiveState;
    };

    const promise = runFetch().finally(() => {
      this.inFlightRequests.delete(requestKey);
    });
    this.inFlightRequests.set(requestKey, promise);
    return promise;
  }

  /**
   * Browser GPS Detection with high-precision coordinates (maximumAge: 0 so stale
   * browser cached fixes are rejected) and exact lat/lng reverse geocoding.
   */
  public async detectGpsLocation(): Promise<LocationDetectionResult> {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      throw new Error('Geolocation is not supported by your browser');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const accuracyMeters = Math.round(accuracy || 45);
          try {
            const resolved = await this.resolveLocationFromCoordinates(latitude, longitude, accuracyMeters);
            resolve(resolved);
          } catch {
            // Even if reverse geocoding fails completely, strictly keep the captured GPS coordinates!
            const nearest = getNearestDistrict(latitude, longitude);
            const fallbackLabel = `${nearest.district}, ${nearest.state}`;
            const accuracyInfo: LocationAccuracyInfo = {
              level: 'Precise',
              confidenceScore: 86,
              accuracyMeters,
              latitude,
              longitude,
              source: 'gps',
              description: `जीपीएस निर्देशांक (${latitude.toFixed(4)}, ${longitude.toFixed(4)} · ±${accuracyMeters}m)`,
            };
            this.liveGpsCoords = { latitude, longitude, accuracyMeters, capturedAt: Date.now() };
            this.setActiveLocation(fallbackLabel, accuracyInfo);
            resolve({
              location: fallbackLabel,
              district: nearest.district,
              state: nearest.state,
              accuracyLevel: 'Precise',
              confidenceScore: 86,
              accuracyMeters,
              latitude,
              longitude,
              source: 'gps',
              description: accuracyInfo.description || '',
            });
          }
        },
        (error) => {
          reject(error);
        },
        { timeout: 12000, enableHighAccuracy: true, maximumAge: 0 }
      );
    });
  }

  /**
   * One-shot GPS capture + forced AI-driven refresh anchored strictly to captured lat/lng.
   */
  public async detectAndRefreshWithGps(
    currentLang: SupportedLanguage = 'hi',
    userProfile?: BeneficiaryProfile | null
  ): Promise<{ detection: LocationDetectionResult; data: LocationLivelihoodData }> {
    const detection = await this.detectGpsLocation();
    const data = await this.fetchLocationData(
      detection.location,
      currentLang,
      userProfile
        ? {
            ...userProfile,
            location: detection.location,
            latitude: detection.latitude,
            longitude: detection.longitude,
            locationAccuracy: detection.accuracyLevel,
            locationConfidence: detection.confidenceScore,
            locationAccuracyMeters: detection.accuracyMeters,
          }
        : null,
      true,
      {
        latitude: detection.latitude,
        longitude: detection.longitude,
        accuracyMeters: detection.accuracyMeters,
        capturedAt: Date.now(),
      }
    );
    return { detection, data };
  }

  private watchId: number | null = null;
  private watchCallbacks: ((result: LocationDetectionResult) => void)[] = [];

  public startBackgroundGpsTracking(onUpdate?: (result: LocationDetectionResult) => void): void {
    if (onUpdate) {
      this.watchCallbacks.push(onUpdate);
    }
    if (this.watchId !== null || typeof window === 'undefined' || !navigator.geolocation) {
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          const { latitude, longitude, accuracy } = position.coords;
          const accuracyMeters = Math.round(accuracy || 45);
          const detectionRes = await this.resolveLocationFromCoordinates(latitude, longitude, accuracyMeters);
          this.watchCallbacks.forEach((cb) => {
            try {
              cb(detectionRes);
            } catch {}
          });
        } catch (e) {
          console.warn('Background GPS watch error:', e);
        }
      },
      (error) => {
        console.warn('Background GPS watch error:', error);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }

  public stopBackgroundGpsTracking(): void {
    if (this.watchId !== null && typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.watchCallbacks = [];
  }

  public async searchAddressAutocomplete(
    query: string
  ): Promise<Array<{ display_name: string; district: string; state: string; locality?: string; latitude?: number; longitude?: number }>> {
    if (!query || query.trim().length < 2) return [];
    try {
      const q = encodeURIComponent(query.trim());
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${q}&addressdetails=1&limit=6&countrycodes=in`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map((item: any) => {
        const addr = item.address || {};
        const district =
          addr.state_district || addr.county || addr.city || addr.town || addr.municipality || addr.village || '';
        const state = addr.state || 'India';
        const locality = addr.village || addr.suburb || addr.neighbourhood || addr.town || addr.city || '';
        const cleanDistrict = district.replace(/district/i, '').trim();
        const fullDisplay =
          locality && locality.toLowerCase() !== cleanDistrict.toLowerCase()
            ? `${locality}, ${cleanDistrict}, ${state}`
            : `${cleanDistrict || locality}, ${state}`;
        const lat = Number(item.lat);
        const lng = Number(item.lon);

        return {
          display_name: fullDisplay,
          district: cleanDistrict || locality,
          state,
          locality,
          latitude: Number.isFinite(lat) ? lat : undefined,
          longitude: Number.isFinite(lng) ? lng : undefined,
        };
      });
    } catch (e) {
      console.warn('Address autocomplete search failed:', e);
      return [];
    }
  }
}

export const locationIntelligenceService = new LocationIntelligenceService();
