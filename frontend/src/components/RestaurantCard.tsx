'use client';

import React, { useState } from 'react';
import {
  Star,
  MapPin,
  Navigation,
  ExternalLink,
  Utensils,
  Phone,
  Clock,
  Building2,
  ChevronRight,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Restaurant } from '../lib/api';
import RestaurantDetailModal from './RestaurantDetailModal';

interface RestaurantCardProps {
  restaurant: Restaurant;
  rank: number;
  isSelected?: boolean;
  onSelect?: () => void;
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

export default function RestaurantCard({ restaurant, rank, isSelected, onSelect }: RestaurantCardProps) {
  const [showModal, setShowModal] = useState(false);

  const mapsUrl =
    restaurant.googleMapsUri ||
    `https://www.google.com/maps/dir/?api=1&destination=${restaurant.location.latitude},${restaurant.location.longitude}`;

  const heroImage =
    restaurant.images && restaurant.images.length > 0
      ? restaurant.images[0]
      : 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=80';

  const placeType = restaurant.placeType || 'Restaurant';
  const placeTypeClass = PLACE_TYPE_COLORS[placeType] || PLACE_TYPE_COLORS['Restaurant'];

  return (
    <>
      {showModal && (
        <RestaurantDetailModal
          restaurant={restaurant}
          rank={rank}
          onClose={() => setShowModal(false)}
        />
      )}

      <div
        onClick={onSelect}
        className={`glass-card rounded-2xl cursor-pointer relative overflow-hidden flex flex-col transition-all duration-200 hover:scale-[1.01] hover:shadow-xl hover:shadow-emerald-900/20 ${
          isSelected ? 'ring-2 ring-emerald-500 bg-gray-800/80' : ''
        }`}
      >
        {/* Hero Image */}
        <div className="relative w-full h-36 overflow-hidden">
          <img
            src={heroImage}
            alt={restaurant.name}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&auto=format&fit=crop&q=80';
            }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/20 to-transparent" />

          {/* Rank badge */}
          <div className="absolute top-2.5 left-2.5 w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-extrabold text-sm flex items-center justify-center backdrop-blur-sm shadow-md">
            #{rank}
          </div>

          {/* Open/Closed status */}
          {restaurant.isOpenNow !== undefined && (
            <div className={`absolute top-2.5 right-2.5 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm ${
              restaurant.isOpenNow
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50'
                : 'bg-red-950/80 text-red-400 border-red-500/50'
            }`}>
              {restaurant.isOpenNow
                ? <><CheckCircle className="w-2.5 h-2.5" /> Open</>
                : <><XCircle className="w-2.5 h-2.5" /> Closed</>}
            </div>
          )}

          {/* Photo count indicator */}
          {restaurant.images && restaurant.images.length > 1 && (
            <div className="absolute bottom-2 right-2 text-[9px] font-bold text-gray-300 bg-black/60 px-1.5 py-0.5 rounded-md">
              +{restaurant.images.length} photos
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-3.5 flex flex-col gap-2.5 flex-1">
          {/* Name + Place Type */}
          <div>
            <h3 className="text-sm font-bold text-gray-100 line-clamp-1 hover:text-emerald-400 transition-colors leading-tight">
              {restaurant.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${placeTypeClass}`}>
                <Building2 className="w-2.5 h-2.5" />
                {placeType}
              </span>
              {restaurant.priceLevel && (
                <span className="text-[10px] font-bold text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded-md border border-white/10">
                  {restaurant.priceLevel}
                </span>
              )}
            </div>
          </div>

          {/* Cuisine Tags */}
          {restaurant.cuisineTypes && restaurant.cuisineTypes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {restaurant.cuisineTypes.slice(0, 3).map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-0.5 text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-950/50 border border-emerald-500/20 text-emerald-300"
                >
                  <Utensils className="w-2 h-2" />
                  {c}
                </span>
              ))}
            </div>
          )}

          {/* Rating */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-lg">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-xs font-bold text-amber-300">{restaurant.rating || 4.5}</span>
              <span className="text-[10px] text-gray-400">
                ({(restaurant.userRatingCount || 0).toLocaleString()})
              </span>
            </div>
            {restaurant.distanceKm !== undefined && (
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <Navigation className="w-3 h-3" />
                {restaurant.distanceKm} km
              </div>
            )}
          </div>

          {/* Address + City */}
          <div className="flex items-start gap-1.5 text-[11px] text-gray-400">
            <MapPin className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
            <span className="line-clamp-1">
              {restaurant.address}
              {restaurant.city && `, ${restaurant.city}`}
              {restaurant.country && `, ${restaurant.country}`}
            </span>
          </div>

          {/* Phone & Hours strip */}
          <div className="flex items-center justify-between text-[10px] text-gray-500">
            {restaurant.phone ? (
              <a
                href={`tel:${restaurant.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
              >
                <Phone className="w-2.5 h-2.5" />
                {restaurant.phone}
              </a>
            ) : (
              <span />
            )}
            {restaurant.openingHours && restaurant.openingHours.length > 0 && (
              <span className="flex items-center gap-1 text-gray-500">
                <Clock className="w-2.5 h-2.5" />
                Hours available
              </span>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-white/10 flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
              className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-3 py-2 rounded-xl transition-all"
            >
              <span>View Details</span>
              <ChevronRight className="w-3 h-3" />
            </button>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 px-3 py-2 rounded-xl transition-all shadow-md shadow-emerald-900/30"
            >
              <Navigation className="w-3 h-3" />
              Directions
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
