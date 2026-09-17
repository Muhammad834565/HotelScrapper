'use client';

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Navigation,
  Search,
  Utensils,
  Database,
  Layers,
  Sparkles,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import InteractiveMap from '../components/InteractiveMap';
import RestaurantCard from '../components/RestaurantCard';
import SearchHistorySidebar from '../components/SearchHistorySidebar';
import {
  Restaurant,
  SearchHistoryRecord,
  fetchNearestRestaurants,
  fetchSearchHistory,
} from '../lib/api';

export default function Home() {
  // Default location: New York City coordinates if geolocation not yet triggered
  const [location, setLocation] = useState<{ latitude: number; longitude: number }>({
    latitude: 40.7128,
    longitude: -74.006,
  });
  const [customLat, setCustomLat] = useState<string>('40.7128');
  const [customLng, setCustomLng] = useState<string>('-74.0060');
  const [radius, setRadius] = useState<number>(5000);
  const [limit, setLimit] = useState<number>(10);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [history, setHistory] = useState<SearchHistoryRecord[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string | null>(null);

  // Trigger search
  const handleSearch = async (lat: number, lng: number, rad: number = radius) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNearestRestaurants(lat, lng, rad, limit);
      setRestaurants(data.restaurants || []);
      setDataSource(data.source);
      // Refresh history from PostgreSQL
      const updatedHistory = await fetchSearchHistory();
      setHistory(updatedHistory);
    } catch (err: any) {
      setError(
        'Failed to connect to NestJS backend server. Please verify backend is running on http://localhost:5000.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Browser Geolocation
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

  // Manual Input Search
  const handleManualSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);

    if (isNaN(lat) || isNaN(lng)) {
      setError('Please enter valid numeric latitude and longitude coordinates.');
      return;
    }

    setLocation({ latitude: lat, longitude: lng });
    handleSearch(lat, lng);
  };

  // Initial load
  useEffect(() => {
    handleSearch(location.latitude, location.longitude);
  }, []);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header & Branding */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-panel border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>

        <div className="space-y-1 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>NestJS + Next.js + PostgreSQL + Google Maps API</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Top 10 Nearest Restaurants <span className="text-emerald-400">Locator</span>
          </h1>
          <p className="text-xs md:text-sm text-gray-400">
            Real-time geolocation & Google Maps Places search backend powered by NestJS with PostgreSQL history logging.
          </p>
        </div>

        {/* Tech Badges */}
        <div className="flex flex-wrap items-center gap-2 z-10">
          <span className="px-3 py-1.5 rounded-xl bg-gray-900 border border-white/10 text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-red-400" /> NestJS
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-gray-900 border border-white/10 text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-cyan-400" /> PostgreSQL
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-gray-900 border border-white/10 text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-amber-400" /> Places API
          </span>
        </div>
      </header>

      {/* Location Input & Search Bar */}
      <section className="glass-panel p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Detect Location Button */}
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={detectingLocation}
            className="w-full lg:w-auto glow-button text-slate-950 font-extrabold px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg disabled:opacity-50 shrink-0"
          >
            {detectingLocation ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Locating You...</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4 fill-slate-950" />
                <span>Use My Current Location</span>
              </>
            )}
          </button>

          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider hidden lg:block">OR</span>

          {/* Manual Form Inputs */}
          <form onSubmit={handleManualSearchSubmit} className="w-full flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full relative">
              <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Latitude</label>
              <input
                type="text"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                placeholder="40.7128"
                className="w-full bg-gray-900/90 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex-1 w-full relative">
              <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Longitude</label>
              <input
                type="text"
                value={customLng}
                onChange={(e) => setCustomLng(e.target.value)}
                placeholder="-74.0060"
                className="w-full bg-gray-900/90 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="w-full sm:w-28 relative">
              <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Radius</label>
              <select
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full bg-gray-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value={2000}>2 km</option>
                <option value={5000}>5 km</option>
                <option value={10000}>10 km</option>
                <option value={20000}>20 km</option>
              </select>
            </div>

            <div className="w-full sm:w-32 relative">
              <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Results</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full bg-gray-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value={5}>5 nearest</option>
                <option value={10}>10 nearest</option>
                <option value={20}>20 nearest</option>
                <option value={30}>30 nearest</option>
                <option value={50}>50 nearest</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto mt-5 sm:mt-0 bg-gray-800 hover:bg-gray-700 text-white font-bold px-5 py-2.5 rounded-xl border border-white/10 flex items-center justify-center gap-2 text-xs transition-colors shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Search className="w-4 h-4 text-emerald-400" />}
              <span>Search</span>
            </button>
          </form>
        </div>

        {/* Error message alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* Content Layout: Radar Map + Top 10 Restaurant Cards + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Interactive Map & Restaurant Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Interactive Radar Map */}
          <InteractiveMap
            userLocation={location}
            restaurants={restaurants}
            selectedRestaurantId={selectedRestaurantId}
            onSelectRestaurant={(res) => setSelectedRestaurantId(res.id)}
          />

          {/* Restaurant List Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Top 10 Nearest Restaurants</h2>
              </div>
              <span className="text-xs text-gray-400 bg-gray-900 px-3 py-1 rounded-full border border-white/10">
                Sorted by Proximity
              </span>
            </div>

            {loading ? (
              <div className="p-12 glass-panel rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                <p className="text-xs text-gray-400 font-medium">Fetching top 10 nearest restaurants from Google Maps API...</p>
              </div>
            ) : restaurants.length === 0 ? (
              <div className="p-12 glass-panel rounded-2xl text-center text-gray-400 text-xs">
                No restaurants found around these coordinates. Try increasing the search radius.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {restaurants.map((item, idx) => (
                  <RestaurantCard
                    key={item.id}
                    restaurant={item}
                    rank={idx + 1}
                    isSelected={selectedRestaurantId === item.id}
                    onSelect={() => setSelectedRestaurantId(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Database Search History */}
        <div className="lg:col-span-1">
          <SearchHistorySidebar
            history={history}
            onSelectHistory={(lat, lng) => {
              setLocation({ latitude: lat, longitude: lng });
              setCustomLat(lat.toFixed(6));
              setCustomLng(lng.toFixed(6));
              handleSearch(lat, lng);
            }}
          />
        </div>
      </div>
    </main>
  );
}
