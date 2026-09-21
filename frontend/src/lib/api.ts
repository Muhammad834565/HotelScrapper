export type ScrapingMode = 'basic' | 'intermediate' | 'advanced';

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  city?: string;
  country?: string;
  postalCode?: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  priceLevel?: string;
  cuisine?: string;
  cuisineTypes?: string[];
  placeType?: string;
  phone?: string;
  email?: string;
  website?: string;
  images?: string[];
  openingHours?: string[];
  isOpenNow?: boolean;
  distanceKm?: number;
  aboutSection?: Record<string, string[]>;
  aboutKeywords?: string[];
  menuData?: any[];
  scrapingLevel?: ScrapingMode;
}

export interface SearchNearbyResponse {
  restaurants: Restaurant[];
  source: string;
}

export interface GeocodeSuggestion {
  displayName: string;
  latitude: number;
  longitude: number;
  type: string;
}

export interface AdminStats {
  totalRestaurants: number;
  totalCities: number;
  basicCount: number;
  intermediateCount: number;
  advancedCount: number;
}

export interface AdminListResponse {
  data: Restaurant[];
  total: number;
  page: number;
  pageSize: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
  }
}

export function removeAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function loginUser(username: string, password: string): Promise<{ success: boolean; token: string; username: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Login failed' }));
    throw new Error(err.message || 'Invalid username or password');
  }
  const data = await res.json();
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    removeAuthToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }
  return res;
}

export async function fetchNearestRestaurants(
  latitude: number,
  longitude: number,
  radius: number = 5000,
  limit: number = 10,
  scrapingMode: ScrapingMode = 'basic',
): Promise<SearchNearbyResponse> {
  try {
    const res = await authFetch(`${API_BASE_URL}/restaurants/nearby`, {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, radius, limit, scrapingMode }),
    });
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    return await res.json();
  } catch (err: any) {
    console.error('Failed to fetch from backend:', err);
    throw err;
  }
}

export async function geocodeLocation(
  query: string,
): Promise<{ latitude: number; longitude: number; displayName: string } | null> {
  try {
    const res = await authFetch(`${API_BASE_URL}/restaurants/geocode?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return { latitude: data[0].latitude, longitude: data[0].longitude, displayName: data[0].displayName };
      }
    }
  } catch {}

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1&accept-language=en`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon), displayName: data[0].display_name };
  } catch {
    return null;
  }
}

export async function geocodeSuggestions(query: string): Promise<GeocodeSuggestion[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await authFetch(`${API_BASE_URL}/restaurants/geocode?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data.slice(0, 6);
    }
  } catch {}

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=8&accept-language=en`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.slice(0, 6).map((item: any) => ({
      displayName: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      type: item.type || item.addresstype || 'place',
    }));
  } catch {
    return [];
  }
}

// ─── Admin API helpers ────────────────────────────────────────────────────

export async function adminGetStats(): Promise<AdminStats> {
  const res = await authFetch(`${API_BASE_URL}/restaurants/admin/stats`);
  if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`);
  return res.json();
}

export async function adminGetCities(): Promise<{ city: string; count: number }[]> {
  const res = await authFetch(`${API_BASE_URL}/restaurants/admin/cities`);
  if (!res.ok) throw new Error(`Cities fetch failed: ${res.status}`);
  return res.json();
}

export async function adminGetAll(page = 1, pageSize = 50, search = ''): Promise<AdminListResponse> {
  const url = `${API_BASE_URL}/restaurants/admin/all?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  const res = await authFetch(url);
  if (!res.ok) throw new Error(`List fetch failed: ${res.status}`);
  return res.json();
}


export async function adminAddRestaurant(data: Partial<Restaurant>): Promise<Restaurant> {
  const res = await authFetch(`${API_BASE_URL}/restaurants/admin/add`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Add failed: ${res.status}`);
  return res.json();
}

export async function adminEditRestaurant(id: string, data: Partial<Restaurant>): Promise<Restaurant> {
  const res = await authFetch(`${API_BASE_URL}/restaurants/admin/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Edit failed: ${res.status}`);
  return res.json();
}

export async function adminDeleteRestaurant(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/restaurants/admin/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export async function adminResolveCities(): Promise<{ resolved: number; failed: number }> {
  const res = await authFetch(`${API_BASE_URL}/restaurants/admin/resolve-cities`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Resolve cities failed: ${res.status}`);
  return res.json();
}

export async function adminDeduplicate(): Promise<{ merged: number; deleted: number }> {
  const res = await authFetch(`${API_BASE_URL}/restaurants/admin/deduplicate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Deduplicate failed: ${res.status}`);
  return res.json();
}

export async function adminUpgradeScraping(targetLevel: 'intermediate' | 'advanced'): Promise<{ queued: number }> {
  const res = await authFetch(`${API_BASE_URL}/restaurants/admin/upgrade-scraping`, {
    method: 'POST',
    body: JSON.stringify({ targetLevel }),
  });
  if (!res.ok) throw new Error(`Upgrade scraping failed: ${res.status}`);
  return res.json();
}

export async function adminUpgradeSingleScraping(id: string, targetLevel: 'intermediate' | 'advanced'): Promise<{ success: boolean; message: string }> {
  const res = await authFetch(`${API_BASE_URL}/restaurants/admin/${id}/upgrade-scraping`, {
    method: 'POST',
    body: JSON.stringify({ targetLevel }),
  });
  if (!res.ok) throw new Error(`Single upgrade scraping failed: ${res.status}`);
  return res.json();
}

export async function adminMergeCities(fromCity: string, toCity: string): Promise<{ updated: number }> {
  const res = await authFetch(`${API_BASE_URL}/restaurants/admin/merge-cities`, {
    method: 'POST',
    body: JSON.stringify({ fromCity, toCity }),
  });
  if (!res.ok) throw new Error(`Merge cities failed: ${res.status}`);
  return res.json();
}



