'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import InteractiveMap from '../components/InteractiveMap';
import RestaurantCard from '../components/RestaurantCard';
import LocationSearchBar from '../components/LocationSearchBar';
import {
  Restaurant,
  fetchNearestRestaurants,
} from '../lib/api';

export default function Home() {
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

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Core search function
  const handleSearch = async (lat: number, lng: number, rad: number = radius) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNearestRestaurants(lat, lng, rad, limit);
      setRestaurants(data.restaurants || []);
    } catch (err: any) {
      setError(
        'Failed to connect to NestJS backend. Please verify the backend is running on http://localhost:5000.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Called by LocationSearchBar when user picks a place from autocomplete / quick-pick
  const handleLocationSelect = (lat: number, lng: number, name: string) => {
    const shortName = name.split(',').slice(0, 2).join(',').trim();
    setLocation({ latitude: lat, longitude: lng });
    setLocationLabel(shortName);
    setCustomLat(lat.toFixed(6));
    setCustomLng(lng.toFixed(6));
    handleSearch(lat, lng);
  };

  // Browser geolocation
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

  // Advanced manual form
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

  // Initial load
  useEffect(() => {
    handleSearch(location.latitude, location.longitude);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-panel border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="space-y-1 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>NestJS + Next.js + PostgreSQL + OSM</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Nearest Restaurants <span className="text-emerald-400">Finder</span>
          </h1>
          <p className="text-xs md:text-sm text-gray-400">
            Search by location name or coordinates — powered by NestJS with PostgreSQL history logging.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 z-10">
          <span className="px-3 py-1.5 rounded-xl bg-gray-900 border border-white/10 text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-red-400" /> NestJS
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-gray-900 border border-white/10 text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-cyan-400" /> PostgreSQL
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-gray-900 border border-white/10 text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-amber-400" /> OSM / Google Maps
          </span>
        </div>
      </header>

      {/* ─── Search Panel ─────────────────────────────────────────────────── */}
      <section className="glass-panel p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">

        {/* Active location pill */}
        {locationLabel && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>Searching near: <span className="text-white">{locationLabel}</span></span>
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

        {/* Radius + Limit controls */}
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
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
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
            Search This Area
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
              className="shrink-0 bg-gray-800 hover:bg-gray-700 text-white font-bold px-5 py-2 rounded-xl border border-white/10 flex items-center gap-2 text-xs transition-colors"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <Search className="w-3.5 h-3.5 text-emerald-400" />}
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
          </div>
        ) : restaurants.length === 0 ? (
          <div className="p-12 glass-panel rounded-2xl text-center text-gray-400 text-xs">
            No restaurants found. Try a different location or increase the search radius.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
    </main>
  );
}
