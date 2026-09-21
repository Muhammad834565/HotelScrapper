'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Utensils,
  Database,
  Layers,
  Sparkles,
  AlertCircle,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
  Star,
  Lock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import InteractiveMap from '../components/InteractiveMap';
import RestaurantCard from '../components/RestaurantCard';
import LocationSearchBar from '../components/LocationSearchBar';
import {
  Restaurant,
  ScrapingMode,
  fetchNearestRestaurants,
  getAuthToken,
  removeAuthToken,
} from '../lib/api';

const SCRAPING_MODES: { mode: ScrapingMode; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  {
    mode: 'basic',
    label: 'Basic',
    desc: 'Fast — list page only, no detail scraping',
    icon: <Zap className="w-4 h-4" />,
    color: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  },
  {
    mode: 'intermediate',
    label: 'Intermediate',
    desc: 'Guest scraping — phone, hours, about section',
    icon: <Star className="w-4 h-4" />,
    color: 'text-sky-400 border-sky-500/40 bg-sky-500/10',
  },
  {
    mode: 'advanced',
    label: 'Advanced',
    desc: 'Logged-in scraping — full data via cookies.json',
    icon: <Lock className="w-4 h-4" />,
    color: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
  },
];

export default function Home() {
  const router = useRouter();

  // Protect page with token check
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      removeAuthToken();
      router.push('/login');
    }
  }, [router]);


  const [location, setLocation] = useState<{ latitude: number; longitude: number }>({
    latitude: 24.8607,
    longitude: 67.0011,
  });
  const [locationLabel, setLocationLabel] = useState<string>('Bahria Town, Karachi');

  // Advanced manual lat/lng (collapsible)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customLat, setCustomLat] = useState<string>('24.8607');
  const [customLng, setCustomLng] = useState<string>('67.0011');
  const [radius, setRadius] = useState<number>(5000);
  const [limit, setLimit] = useState<number>(10);

  // Scraping mode
  const [scrapingMode, setScrapingMode] = useState<ScrapingMode>('basic');

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination for main screen (max 10 per page display)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const totalPages = Math.ceil(restaurants.length / pageSize);
  const displayedRestaurants = restaurants.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Core search function
  const handleSearch = async (lat: number, lng: number, rad: number = radius, mode: ScrapingMode = scrapingMode) => {
    setLoading(true);
    setError(null);
    setCurrentPage(1);
    try {
      const data = await fetchNearestRestaurants(lat, lng, rad, limit, mode);
      setRestaurants(data.restaurants || []);
    } catch (err: any) {
      setError(
        'Failed to connect to NestJS backend. Please verify the backend is running on http://localhost:5000.'
      );
    } finally {
      setLoading(false);
    }
  };


  const handleLocationSelect = (lat: number, lng: number, name: string) => {
    const shortName = name.split(',').slice(0, 2).join(',').trim();
    setLocation({ latitude: lat, longitude: lng });
    setLocationLabel(shortName);
    setCustomLat(lat.toFixed(6));
    setCustomLng(lng.toFixed(6));
    handleSearch(lat, lng);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingLocation(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocation({ latitude: lat, longitude: lng });
        setLocationLabel('Your Current Location');
        setCustomLat(lat.toFixed(6));
        setCustomLng(lng.toFixed(6));
        setDetectingLocation(false);
        handleSearch(lat, lng);
      },
      (geoError) => {
        setDetectingLocation(false);
        setError(`Geolocation error: ${geoError.message}. Using default coordinates.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleManualSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    if (isNaN(lat) || isNaN(lng)) {
      setError('Please enter valid numeric latitude and longitude.');
      return;
    }
    setLocation({ latitude: lat, longitude: lng });
    setLocationLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    handleSearch(lat, lng);
  };

  // Note: Auto-search on page load disabled per requirement — search only starts when Search button is clicked.

  const activeModeInfo = SCRAPING_MODES.find(m => m.mode === scrapingMode)!;

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ─── Top Header ───────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl glass-panel border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 z-10">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Utensils className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              Hotel & Restaurant <span className="gradient-text">Scraper</span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Live Google Maps Scraping • Multi-Mode Scraping • PostgreSQL Cache
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 z-10">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/40 border border-purple-400/30 transition-all transform hover:scale-105 active:scale-95"
          >
            <ShieldCheck className="w-4 h-4 text-purple-200" />
            <span>Admin Panel</span>
          </button>
          <button
            onClick={() => {
              removeAuthToken();
              router.push('/login');
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold transition-all"
          >
            <Lock className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>

      </header>

      {/* ─── Search & Controls ────────────────────────────────────────── */}
      <section className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
        {locationLabel && (
          <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            <span>{locationLabel}</span>
            <span className="text-gray-600 ml-2">
              ({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})
            </span>
          </div>
        )}

        {/* Location search bar */}
        <LocationSearchBar
          onLocationSelect={handleLocationSelect}
          onUseCurrentLocation={handleDetectLocation}
          isDetecting={detectingLocation}
        />

        {/* ── Scraping Mode Toggle ── */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-bold text-gray-400 block">Scraping Mode</label>
          <div className="flex flex-wrap gap-2">
            {SCRAPING_MODES.map(({ mode, label, desc, icon, color }) => (
              <button
                key={mode}
                onClick={() => setScrapingMode(mode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-all duration-200 ${scrapingMode === mode
                  ? `${color} ring-2 ring-offset-2 ring-offset-gray-900 ring-current scale-105`
                  : 'border-white/10 text-gray-400 bg-gray-900/60 hover:border-white/20 hover:text-gray-200'
                  }`}
                title={desc}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
            {activeModeInfo.icon}
            {activeModeInfo.desc}
          </p>
        </div>

        {/* Radius + Limit controls (Max 30 items) */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">
                Search Radius
              </label>
              <select
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="bg-gray-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value={1000}>1 km</option>
                <option value={2000}>2 km</option>
                <option value={5000}>5 km</option>
                <option value={10000}>10 km</option>
                <option value={20000}>20 km</option>
              </select>
            </div>

            <div className="relative">
              <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">
                Max Results
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-gray-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value={1}>1</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </div>
          </div>

          {/* Re-search current location */}
          <button
            onClick={() => handleSearch(location.latitude, location.longitude)}
            disabled={loading}
            className="flex items-center gap-2 text-xs font-bold bg-gray-800 hover:bg-gray-700 border border-white/10 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50 mt-5"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <Search className="w-3.5 h-3.5 text-emerald-400" />
            )}
            Search Area
          </button>

          {/* Advanced: manual lat/lng toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="ml-auto flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Manual Coordinates
          </button>
        </div>

        {/* Advanced manual lat/lng */}
        {showAdvanced && (
          <form onSubmit={handleManualSearchSubmit} className="flex flex-col sm:flex-row items-end gap-3 pt-2 border-t border-white/10">
            <div className="flex-1">
              <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Latitude</label>
              <input
                type="text"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                placeholder="24.8607"
                className="w-full bg-gray-900/90 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Longitude</label>
              <input
                type="text"
                value={customLng}
                onChange={(e) => setCustomLng(e.target.value)}
                placeholder="67.0011"
                className="w-full bg-gray-900/90 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Search className="w-3.5 h-3.5 text-white" />}
              Search Coords
            </button>
          </form>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* ─── Content: Map + Cards ─────────────────────────────────────── */}
      <div className="space-y-6">
        <InteractiveMap
          userLocation={location}
          restaurants={restaurants}
          selectedRestaurantId={selectedRestaurantId}
          onSelectRestaurant={(res) => setSelectedRestaurantId(res.id)}
        />

        {/* Results header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">
              {restaurants.length > 0
                ? `${restaurants.length} Restaurants near ${locationLabel}`
                : 'Restaurants'}
            </h2>
          </div>
          <span className="text-xs text-gray-400 bg-gray-900 px-3 py-1 rounded-full border border-white/10">
            Sorted by Proximity
          </span>
        </div>

        {/* Restaurant cards */}
        {loading ? (
          <div className="p-12 glass-panel rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-xs text-gray-400 font-medium">
              Fetching restaurants near <span className="text-emerald-400">{locationLabel}</span>…
            </p>
            <p className="text-[11px] text-gray-600">Mode: <span className={`font-semibold ${activeModeInfo.color.split(' ')[0]}`}>{activeModeInfo.label}</span></p>
          </div>
        ) : restaurants.length === 0 ? (
          <div className="p-12 glass-panel rounded-2xl text-center text-gray-400 text-xs">
            No restaurants found. Try a different location or increase the search radius.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedRestaurants.map((item, idx) => (
                <RestaurantCard
                  key={item.id}
                  restaurant={item}
                  rank={(currentPage - 1) * pageSize + idx + 1}
                  isSelected={selectedRestaurantId === item.id}
                  onSelect={() => setSelectedRestaurantId(item.id)}
                />
              ))}
            </div>

            {/* Pagination Controls (Max 30 items total, 10 per page) */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 glass-panel rounded-2xl border border-white/10">
                <span className="text-xs text-gray-400">
                  Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, restaurants.length)} of {restaurants.length} results
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-2 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-gray-800 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-white px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-2 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-gray-800 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
