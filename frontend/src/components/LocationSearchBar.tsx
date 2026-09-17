'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, Loader2, X, Navigation2, ExternalLink, CheckCircle2 } from 'lucide-react';
import { GeocodeSuggestion, geocodeSuggestions, geocodeLocation } from '../lib/api';

interface LocationSearchBarProps {
  onLocationSelect: (lat: number, lng: number, name: string) => void;
  onUseCurrentLocation: () => void;
  isDetecting: boolean;
}

const QUICK_PICKS = [
  { label: 'Bahria Town, Karachi',     lat: 24.8607,  lng: 67.0011 },
  { label: 'Gulshan-e-Iqbal, Karachi', lat: 24.9218,  lng: 67.0877 },
  { label: 'Defence (DHA), Karachi',   lat: 24.8138,  lng: 67.0674 },
  { label: 'Clifton, Karachi',         lat: 24.8122,  lng: 67.0300 },
  { label: 'Saddar, Karachi',          lat: 24.8607,  lng: 67.0105 },
  { label: 'Abbottabad',               lat: 34.1463,  lng: 73.2114 },
  { label: 'F-6, Islamabad',           lat: 33.7291,  lng: 73.0925 },
  { label: 'Gulberg, Lahore',          lat: 31.5197,  lng: 74.3587 },
];

/** Try to extract lat/lng from a raw text string.
 *  Handles:
 *  - Plain coordinates:  "34.1463, 73.2114"
 *  - Google Maps share URL: https://www.google.com/maps/@34.1463,73.2114,15z
 *  - Google Maps place URL with !3d and !4d: https://goo.gl/maps/...!3d34.1463!4d73.2114
 *  - Google Maps search URL: https://maps.google.com/?q=34.1463,73.2114
 */
function tryParseCoordinates(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();

  // 1. Google Maps @lat,lng format
  const atMatch = trimmed.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  // 2. !3d lat !4d lng format (place detail URL)
  const d3Match = trimmed.match(/!3d(-?\d+\.?\d*).*?!4d(-?\d+\.?\d*)/);
  if (d3Match) {
    return { lat: parseFloat(d3Match[1]), lng: parseFloat(d3Match[2]) };
  }

  // 3. ?q=lat,lng or &q=lat,lng
  const qMatch = trimmed.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }

  // 4. Plain coordinate pair:  "34.1463, 73.2114" or "34.1463,73.2114"
  const coordMatch = trimmed.match(/^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

export default function LocationSearchBar({
  onLocationSelect,
  onUseCurrentLocation,
  isDetecting,
}: LocationSearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete (only when input is not a coordinate/URL)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const parsed = tryParseCoordinates(query);
    if (parsed || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await geocodeSuggestions(query);
      setSuggestions(results);
      setShowDropdown(true);
      setLoading(false);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = useCallback(
    (lat: number, lng: number, name: string) => {
      const shortName = name.split(',').slice(0, 2).join(',').trim();
      setQuery(shortName);
      setSuggestions([]);
      setShowDropdown(false);
      setResolvedCoords({ lat, lng, name: shortName });
      onLocationSelect(lat, lng, name);
    },
    [onLocationSelect]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // 1. Check if the input is a coordinate pair or Google Maps URL
    const parsed = tryParseCoordinates(query);
    if (parsed) {
      handleSelect(parsed.lat, parsed.lng, `${parsed.lat.toFixed(6)}, ${parsed.lng.toFixed(6)}`);
      return;
    }

    // 2. Otherwise geocode the text
    setLoading(true);
    let results = await geocodeSuggestions(query);
    if (!results || results.length === 0) {
      // Fallback: try direct geocodeLocation for typos like 'skirdu' -> 'Skardu'
      const single = await geocodeLocation(query);
      if (single) {
        results = [
          {
            displayName: single.displayName,
            latitude: single.latitude,
            longitude: single.longitude,
            type: 'place',
          },
        ];
      }
    }
    setLoading(false);
    if (results && results.length > 0) {
      handleSelect(results[0].latitude, results[0].longitude, results[0].displayName);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    setResolvedCoords(null);
  };

  const googleMapsVerifyUrl = resolvedCoords
    ? `https://www.google.com/maps/@${resolvedCoords.lat},${resolvedCoords.lng},16z`
    : null;

  return (
    <div className="space-y-3">
      {/* Main search row */}
      <div ref={containerRef} className="relative">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              {loading ? (
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              ) : (
                <Search className="w-4 h-4 text-emerald-400" />
              )}
            </div>

            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setResolvedCoords(null);
                setShowDropdown(true);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowDropdown(true);
              }}
              placeholder='Type a place name, paste coordinates (34.14, 73.21) or paste a Google Maps link…'
              className="w-full bg-gray-900/90 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
            />

            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="shrink-0 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold px-5 py-3 rounded-xl flex items-center gap-2 text-sm transition-colors shadow-lg shadow-emerald-900/30"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Find</span>
          </button>

          <button
            type="button"
            onClick={onUseCurrentLocation}
            disabled={isDetecting}
            title="Use my current GPS location"
            className="shrink-0 glow-button text-slate-950 font-bold px-4 py-3 rounded-xl flex items-center gap-2 text-sm transition-colors shadow-lg disabled:opacity-50"
          >
            {isDetecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Navigation2 className="w-4 h-4 fill-slate-950" />
            )}
            <span className="hidden md:inline">My Location</span>
          </button>
        </form>

        {/* Autocomplete dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(s.latitude, s.longitude, s.displayName)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-emerald-500/10 transition-colors text-left border-b border-white/5 last:border-0"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-100 font-medium line-clamp-1">
                    {s.displayName.split(',')[0]}
                  </p>
                  <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">
                    {s.displayName.split(',').slice(1, 4).join(',')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-white/10">
                    {s.type}
                  </span>
                  <span className="text-[9px] text-gray-600 font-mono">
                    {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Resolved coordinates confirmation bar */}
      {resolvedCoords && (
        <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-emerald-300 font-semibold">{resolvedCoords.name}</span>
            <span className="text-gray-500 font-mono ml-2">
              {resolvedCoords.lat.toFixed(6)}, {resolvedCoords.lng.toFixed(6)}
            </span>
          </div>
          {googleMapsVerifyUrl && (
            <a
              href={googleMapsVerifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 shrink-0 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Verify on Google Maps
            </a>
          )}
        </div>
      )}

      {/* Paste-hint banner */}
      <div className="flex items-center gap-2 text-[10px] text-gray-600">
        <span className="font-bold text-gray-500">💡 Tip:</span>
        You can also paste coordinates like{' '}
        <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-400">34.1463, 73.2114</code>
        {' '}or paste a{' '}
        <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-400">Google Maps URL</code>
        {' '}directly into the search bar.
      </div>

      {/* Quick-pick chips */}
      <div className="flex flex-wrap gap-2">
        <span className="text-[10px] uppercase font-bold text-gray-500 self-center mr-1">Quick picks:</span>
        {QUICK_PICKS.map((place) => (
          <button
            key={place.label}
            type="button"
            onClick={() => handleSelect(place.lat, place.lng, place.label)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 text-gray-300 hover:text-emerald-300 transition-all"
          >
            <MapPin className="w-2.5 h-2.5" />
            {place.label}
          </button>
        ))}
      </div>
    </div>
  );
}
