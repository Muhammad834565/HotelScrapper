'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Compass, ExternalLink } from 'lucide-react';
import { Restaurant } from '../lib/api';

interface InteractiveMapProps {
  userLocation: { latitude: number; longitude: number };
  restaurants: Restaurant[];
  selectedRestaurantId?: string | null;
  onSelectRestaurant?: (restaurant: Restaurant) => void;
}

export default function InteractiveMap({
  userLocation,
  restaurants,
  selectedRestaurantId,
  onSelectRestaurant,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeHoverId, setActiveHoverId] = useState<string | null>(null);

  // Fallback radar visual map canvas calculations
  const calculateRelativePos = (lat: number, lng: number) => {
    const latDiff = lat - userLocation.latitude;
    const lngDiff = lng - userLocation.longitude;
    // Scale factor for display container
    const scale = 8000;
    const x = 50 + lngDiff * scale;
    const y = 50 - latDiff * scale;
    return {
      x: Math.max(10, Math.min(90, x)),
      y: Math.max(10, Math.min(90, y)),
    };
  };

  return (
    <div className="relative w-full h-[520px] rounded-2xl overflow-hidden glass-panel border border-white/10 shadow-2xl flex flex-col">
      {/* Top Map Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-gray-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-gray-300 shadow-lg">
        <Compass className="w-4 h-4 text-emerald-400 animate-spin-slow" />
        <span>Live Radar View ({restaurants.length} Places)</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
      </div>

      <div className="absolute top-4 right-4 z-20 bg-gray-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[11px] text-gray-400">
        Lat: {userLocation.latitude.toFixed(4)}, Lng: {userLocation.longitude.toFixed(4)}
      </div>

      {/* Visual Radar Map Grid Container */}
      <div className="relative flex-1 w-full h-full bg-slate-950 overflow-hidden flex items-center justify-center">
        {/* Radar Rings & Grid Lines */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40"></div>
        <div className="absolute w-[450px] h-[450px] rounded-full border border-emerald-500/15 pointer-events-none"></div>
        <div className="absolute w-[300px] h-[300px] rounded-full border border-emerald-500/20 pointer-events-none"></div>
        <div className="absolute w-[150px] h-[150px] rounded-full border border-emerald-500/30 pointer-events-none"></div>
        <div className="absolute w-full h-[1px] bg-emerald-500/10 pointer-events-none"></div>
        <div className="absolute h-full w-[1px] bg-emerald-500/10 pointer-events-none"></div>

        {/* User Location Pulse Marker */}
        <div className="absolute z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-12 h-12 rounded-full bg-emerald-500/20 animate-ping"></span>
            <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-lg shadow-emerald-500/50 z-10">
              <Navigation className="w-4 h-4 text-slate-950 fill-slate-950" />
            </div>
          </div>
          <span className="mt-1 px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-[10px] font-bold text-emerald-400 shadow-md">
            You Are Here
          </span>
        </div>

        {/* Restaurant Pins */}
        {restaurants.map((item, idx) => {
          const pos = calculateRelativePos(item.location.latitude, item.location.longitude);
          const isSelected = selectedRestaurantId === item.id || activeHoverId === item.id;

          return (
            <div
              key={item.id}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onMouseEnter={() => setActiveHoverId(item.id)}
              onMouseLeave={() => setActiveHoverId(null)}
              onClick={() => onSelectRestaurant && onSelectRestaurant(item)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 z-15 ${
                isSelected ? 'scale-125 z-30' : 'hover:scale-110'
              }`}
            >
              <div className="relative flex flex-col items-center group">
                {/* Popover Preview Card */}
                {isSelected && (
                  <div className="absolute bottom-full mb-2 w-56 rounded-xl bg-gray-950/97 backdrop-blur-md border border-emerald-500/40 shadow-2xl text-left pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                    {/* Thumbnail */}
                    {item.images && item.images[0] && (
                      <div className="w-full h-24 overflow-hidden">
                        <img
                          src={item.images[0]}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 h-24 bg-gradient-to-b from-transparent to-gray-950/60" />
                      </div>
                    )}
                    <div className="p-2.5 space-y-1.5">
                      <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        #{idx + 1} Nearest
                      </div>
                      <div className="text-xs font-bold text-white truncate">{item.name}</div>
                      {item.placeType && (
                        <div className="text-[10px] text-gray-400">{item.placeType}</div>
                      )}
                      <div className="text-[11px] text-gray-400 truncate">{item.address}</div>
                      {item.phone && (
                        <div className="text-[10px] text-emerald-400 truncate">{item.phone}</div>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px]">
                        <span className="text-amber-400 font-semibold">★ {item.rating || 4.5}</span>
                        {item.isOpenNow !== undefined && (
                          <span className={`font-bold ${item.isOpenNow ? 'text-emerald-400' : 'text-red-400'}`}>
                            {item.isOpenNow ? '● Open' : '● Closed'}
                          </span>
                        )}
                        <span className="text-emerald-400 font-bold">{item.distanceKm} km</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Marker Pin */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-xl transition-all ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-400/30'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500 border border-white/30'
                  }`}
                >
                  {idx + 1}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info bar */}
      <div className="p-3 bg-gray-900/90 border-t border-white/10 text-xs text-gray-400 flex items-center justify-between">
        <span>Click pins to focus details</span>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${userLocation.latitude},${userLocation.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] font-medium"
        >
          Open in Google Maps <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
