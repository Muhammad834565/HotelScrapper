'use client';

import React, { useState } from 'react';
import {
  X,
  Star,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Navigation,
  ExternalLink,
  Utensils,
  Building2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Check,
  Info,
  Tag,
} from 'lucide-react';
import { Restaurant } from '../lib/api';

interface RestaurantDetailModalProps {
  restaurant: Restaurant;
  rank: number;
  onClose: () => void;
}

const PLACE_TYPE_COLORS: Record<string, string> = {
  Hotel: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  Cafe: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  Restaurant: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  Bistro: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  'Fast Food': 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  Bakery: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
  Bar: 'bg-red-500/20 text-red-300 border-red-500/40',
};

export default function RestaurantDetailModal({ restaurant, rank, onClose }: RestaurantDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'about'>('overview');
  const [imgIdx, setImgIdx] = useState(0);
  const images = restaurant.images && restaurant.images.length > 0
    ? restaurant.images
    : ['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80'];

  const prevImg = () => setImgIdx((i) => (i - 1 + images.length) % images.length);
  const nextImg = () => setImgIdx((i) => (i + 1) % images.length);

  const mapsUrl =
    restaurant.googleMapsUri ||
    `https://www.google.com/maps/dir/?api=1&destination=${restaurant.location.latitude},${restaurant.location.longitude}`;

  const placeType = restaurant.placeType || 'Restaurant';
  const placeTypeClass = PLACE_TYPE_COLORS[placeType] || PLACE_TYPE_COLORS['Restaurant'];

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-gray-950 border border-white/10 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">

        {/* Image Gallery */}
        <div className="relative w-full h-56 sm:h-72 bg-gray-900 overflow-hidden rounded-t-2xl shrink-0">
          <img
            src={images[imgIdx]}
            alt={restaurant.name}
            className="w-full h-full object-cover transition-opacity duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&auto=format&fit=crop&q=80';
            }}
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-transparent to-transparent" />

          {/* Gallery nav (only if multiple images) */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevImg}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={nextImg}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === imgIdx ? 'bg-white w-4' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Rank + Name overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-end gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-black text-sm flex items-center justify-center shrink-0">
                #{rank}
              </div>
              <div>
                <h2 className="text-lg font-black text-white leading-tight">{restaurant.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${placeTypeClass} flex items-center gap-1`}>
                    <Building2 className="w-3 h-3" />
                    {placeType}
                  </span>
                  {restaurant.isOpenNow !== undefined && (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                      restaurant.isOpenNow
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border-red-500/40'
                    }`}>
                      {restaurant.isOpenNow
                        ? <><CheckCircle className="w-3 h-3" /> Open Now</>
                        : <><XCircle className="w-3 h-3" /> Closed</>}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Tab navigation matching Google Maps */}
        <div className="flex border-b border-white/10 px-5 pt-2 bg-gray-900/50 gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 text-xs font-extrabold uppercase tracking-wider relative transition-colors ${
              activeTab === 'overview' ? 'text-emerald-400' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Overview
            {activeTab === 'overview' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`py-2.5 text-xs font-extrabold uppercase tracking-wider relative transition-colors flex items-center gap-1.5 ${
              activeTab === 'about' ? 'text-teal-400' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            About
            {restaurant.aboutKeywords && restaurant.aboutKeywords.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
                {restaurant.aboutKeywords.length}
              </span>
            )}
            {activeTab === 'about' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400 rounded-full" />
            )}
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 space-y-5">
          {activeTab === 'overview' ? (
            <>
              {/* Rating + Distance + Price Row */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-bold text-amber-300">{restaurant.rating || 4.5}</span>
                  <span className="text-xs text-gray-400">({(restaurant.userRatingCount || 0).toLocaleString()} reviews)</span>
                </div>
                {restaurant.distanceKm !== undefined && (
                  <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                    <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-300">{restaurant.distanceKm} km away</span>
                  </div>
                )}
                {restaurant.priceLevel && (
                  <div className="flex items-center gap-1.5 bg-gray-800 border border-white/10 px-3 py-1.5 rounded-xl">
                    <span className="text-xs font-bold text-gray-300">{restaurant.priceLevel}</span>
                  </div>
                )}
              </div>

              {/* Cuisine Tags */}
              {restaurant.cuisineTypes && restaurant.cuisineTypes.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Utensils className="w-3 h-3" /> Cuisine & Specialities
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {restaurant.cuisineTypes.map((c) => (
                      <span
                        key={c}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="h-px bg-white/5" />

              {/* Location */}
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Location
                </p>
                <div className="space-y-1.5 text-sm text-gray-300">
                  <p className="leading-snug">{restaurant.address}</p>
                  {(restaurant.city || restaurant.country) && (
                    <p className="text-gray-400 text-xs">
                      {[restaurant.city, restaurant.country, restaurant.postalCode].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <p className="text-gray-500 text-[11px]">
                    {restaurant.location.latitude.toFixed(6)}, {restaurant.location.longitude.toFixed(6)}
                  </p>
                </div>
              </div>

              <div className="h-px bg-white/5" />

              {/* Contact Info */}
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  Contact Information
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {restaurant.phone && (
                    <a
                      href={`tel:${restaurant.phone}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-900 border border-white/10 hover:border-emerald-500/40 hover:bg-gray-800 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Phone</p>
                        <p className="text-xs font-semibold text-gray-200">{restaurant.phone}</p>
                      </div>
                    </a>
                  )}
                  {restaurant.email && (
                    <a
                      href={`mailto:${restaurant.email}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-900 border border-white/10 hover:border-sky-500/40 hover:bg-gray-800 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0 group-hover:bg-sky-500/20 transition-colors">
                        <Mail className="w-3.5 h-3.5 text-sky-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Email</p>
                        <p className="text-xs font-semibold text-gray-200 truncate max-w-[160px]">{restaurant.email}</p>
                      </div>
                    </a>
                  )}
                  {restaurant.website && (
                    <a
                      href={restaurant.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-900 border border-white/10 hover:border-violet-500/40 hover:bg-gray-800 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 group-hover:bg-violet-500/20 transition-colors">
                        <Globe className="w-3.5 h-3.5 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Website</p>
                        <p className="text-xs font-semibold text-gray-200 truncate max-w-[160px]">
                          {restaurant.website.replace(/^https?:\/\//, '')}
                        </p>
                      </div>
                    </a>
                  )}
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-900 border border-white/10 hover:border-amber-500/40 hover:bg-gray-800 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:bg-amber-500/20 transition-colors">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Google Maps</p>
                      <p className="text-xs font-semibold text-amber-300">Open in Maps</p>
                    </div>
                  </a>
                </div>
              </div>

              {/* Opening Hours */}
              {restaurant.openingHours && restaurant.openingHours.length > 0 && (
                <>
                  <div className="h-px bg-white/5" />
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> Weekly Opening Hours
                    </p>
                    <div className="space-y-1.5">
                      {restaurant.openingHours.map((line) => {
                        const [day, hours] = line.split(': ');
                        const isToday = day === today;
                        return (
                          <div
                            key={day}
                            className={`flex items-center justify-between text-xs rounded-lg px-3 py-1.5 ${
                              isToday
                                ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                                : 'text-gray-400'
                            }`}
                          >
                            <span className={`font-semibold w-24 ${isToday ? 'text-emerald-300' : 'text-gray-300'}`}>
                              {day} {isToday && <span className="text-[10px] ml-1 font-bold opacity-70">Today</span>}
                            </span>
                            <span>{hours || line}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            /* ABOUT TAB CONTENT (Google Maps structure) */
            <div className="space-y-5">
              <div className="flex items-center justify-between bg-teal-950/40 border border-teal-500/30 p-3.5 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-300 shrink-0">
                    <Info className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Google Maps About Section</h3>
                    <p className="text-[11px] text-teal-300/80">Extracted restaurant attributes & service options</p>
                  </div>
                </div>
                {restaurant.aboutKeywords && (
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
                    {restaurant.aboutKeywords.length} Keywords
                  </span>
                )}
              </div>

              {/* Categorised Attribute Groups */}
              {restaurant.aboutSection && Object.keys(restaurant.aboutSection).length > 0 && (
                <div className="space-y-4">
                  {Object.entries(restaurant.aboutSection).map(([category, tags]) => {
                    if (!tags || tags.length === 0) return null;
                    return (
                      <div key={category} className="bg-gray-900/60 border border-white/10 rounded-xl p-3.5 space-y-2">
                        <h4 className="text-xs font-extrabold text-gray-200 tracking-wide flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                          {category}
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                          {tags.map((tag) => (
                            <div
                              key={tag}
                              className="flex items-center gap-2 text-xs font-medium text-gray-200 bg-black/40 border border-white/5 px-2.5 py-1.5 rounded-lg"
                            >
                              <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                              <span className="truncate">{tag}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* All Keywords Tag Cloud */}
              {restaurant.aboutKeywords && restaurant.aboutKeywords.length > 0 && (
                <div className="bg-gray-900/60 border border-white/10 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-teal-300 uppercase tracking-wider">
                    <Tag className="w-3.5 h-3.5" />
                    All Scraped Keywords in About
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {restaurant.aboutKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-teal-950/80 border border-teal-500/40 text-teal-200 hover:border-teal-400 transition-colors"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CTA Footer */}
          <div className="h-px bg-white/5" />
          <div className="flex gap-3">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3 rounded-xl text-sm transition-all shadow-lg shadow-emerald-900/40"
            >
              <Navigation className="w-4 h-4" />
              Get Directions
            </a>
            {restaurant.phone && (
              <a
                href={`tel:${restaurant.phone}`}
                className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all border border-white/10"
              >
                <Phone className="w-4 h-4 text-emerald-400" />
                Call
              </a>
            )}
            <button
              onClick={onClose}
              className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
