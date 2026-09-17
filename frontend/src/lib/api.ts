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

export interface SearchHistoryRecord {
  id: string;
  latitude: number;
  longitude: number;
  resultsCount: number;
  createdAt: string;
  results?: Restaurant[];
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ latitude, longitude, radius, limit }),
    });

    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.error('Failed to fetch from backend:', err);
    throw err;
  }
}

export async function fetchSearchHistory(): Promise<SearchHistoryRecord[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/restaurants/history`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch search history:', err);
    return [];
  }
}
