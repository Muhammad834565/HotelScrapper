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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function fetchNearestRestaurants(
  latitude: number,
  longitude: number,
  radius: number = 5000,
  limit: number = 10
): Promise<SearchNearbyResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/restaurants/nearby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude, radius, limit }),
    });
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    return await res.json();
  } catch (err: any) {
    console.error('Failed to fetch from backend:', err);
    throw err;
  }
}

/**
 * Geocode a place name → { latitude, longitude } using Nominatim (no API key needed).
 * Returns null if not found.
 */
export async function geocodeLocation(
  query: string
): Promise<{ latitude: number; longitude: number; displayName: string } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/restaurants/geocode?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          latitude: data[0].latitude,
          longitude: data[0].longitude,
          displayName: data[0].displayName,
        };
      }
    }
  } catch {}

  // Fallback to direct client call
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1&accept-language=en`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch autocomplete suggestions via backend proxy with client-side fallback.
 */
export async function geocodeSuggestions(query: string): Promise<GeocodeSuggestion[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(`${API_BASE_URL}/restaurants/geocode?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.slice(0, 6);
      }
    }
  } catch {}

  // Direct client fallback
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
