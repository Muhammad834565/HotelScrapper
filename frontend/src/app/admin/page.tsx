'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Database, Building2, BarChart3, RefreshCw, Trash2,
  Pencil, Plus, MapPin, Phone, Globe, Star, Zap, Lock, CheckCircle2,
  XCircle, Loader2, ChevronLeft, ChevronRight, AlertTriangle, X,
  Search, Upload, TrendingUp, Eye, ExternalLink, Clock, Sparkles, Utensils,
  Filter, ArrowUpDown, Tag
} from 'lucide-react';
import {
  Restaurant, AdminStats, AdminListResponse, ScrapingMode,
  adminGetStats, adminGetAll, adminAddRestaurant, adminEditRestaurant,
  adminDeleteRestaurant, adminResolveCities, adminUpgradeScraping, adminDeduplicate,
  adminGetCities,
} from '../../lib/api';

const PAGE_SIZE = 50;

// ─── Scraping level badge ─────────────────────────────────────────────────

const LEVEL_STYLES: Record<ScrapingMode, { label: string; classes: string; icon: React.ReactNode }> = {
  basic: {
    label: 'Basic',
    classes: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    icon: <Zap className="w-3 h-3" />,
  },
  intermediate: {
    label: 'Intermediate',
    classes: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    icon: <Star className="w-3 h-3" />,
  },
  advanced: {
    label: 'Advanced',
    classes: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    icon: <Lock className="w-3 h-3" />,
  },
};

function ScrapingBadge({ level }: { level?: ScrapingMode }) {
  const info = LEVEL_STYLES[(level || 'basic') as ScrapingMode];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${info.classes}`}>
      {info.icon}
      {info.label}
    </span>
  );
}

// ─── Cities List Modal ───────────────────────────────────────────────────

interface CitiesModalProps {
  cities: { city: string; count: number }[];
  onSelectCity: (cityName: string) => void;
  onClose: () => void;
}

function CitiesListModal({ cities, onSelectCity, onClose }: CitiesModalProps) {
  const [filter, setFilter] = useState('');

  const filtered = cities.filter((c) => c.city.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl glass-panel rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-gray-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Cities in Database ({cities.length})</h3>
              <p className="text-xs text-gray-400">Click any city to filter the main restaurant table</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/10 bg-gray-900/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search city name…"
              className="w-full bg-gray-900 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* City Grid */}
        <div className="overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
          {filtered.length === 0 ? (
            <div className="col-span-2 py-8 text-center text-gray-500 text-xs">No matching cities found.</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.city}
                onClick={() => {
                  onSelectCity(item.city);
                  onClose();
                }}
                className="flex items-center justify-between p-3.5 rounded-xl bg-gray-900/70 border border-white/5 hover:border-amber-500/40 hover:bg-amber-500/10 transition-all text-left group"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-semibold text-white group-hover:text-amber-300 text-xs">{item.city}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-bold">
                  {item.count} places
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Restaurant Details Modal ("See" Button) ──────────────────────────────

function RestaurantDetailsModal({ restaurant, onClose }: { restaurant: Restaurant; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl glass-panel rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-gray-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {restaurant.name}
                <ScrapingBadge level={restaurant.scrapingLevel} />
              </h3>
              <p className="text-xs text-gray-400">{restaurant.placeType || 'Restaurant'} • {restaurant.cuisine || 'Cuisine not specified'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
          {/* Key Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-gray-900/80 border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-500">Rating</span>
              <div className="text-sm font-bold text-amber-400 flex items-center gap-1">
                <Star className="w-4 h-4 fill-amber-400" />
                {restaurant.rating ? `${restaurant.rating.toFixed(1)} (${restaurant.userRatingCount || 0} reviews)` : 'No ratings yet'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-900/80 border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-500">Price Level</span>
              <div className="text-sm font-bold text-emerald-400">
                {restaurant.priceLevel || 'Not specified'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-900/80 border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-500">Coordinates</span>
              <div className="text-xs font-mono text-gray-300">
                {restaurant.location?.latitude?.toFixed(5)}, {restaurant.location?.longitude?.toFixed(5)}
              </div>
            </div>
          </div>

          {/* Contact & Address Section */}
          <div className="p-4 rounded-xl bg-gray-900/50 border border-white/5 space-y-3">
            <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-400" /> Location & Contact Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-300">
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Address</span>
                <span>{restaurant.address || 'No address stored'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">City / Postal Code</span>
                <span>{restaurant.city || '—'} {restaurant.postalCode ? `(${restaurant.postalCode})` : ''} {restaurant.country ? `, ${restaurant.country}` : ''}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Phone</span>
                {restaurant.phone ? (
                  <a href={`tel:${restaurant.phone}`} className="text-sky-400 hover:underline flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {restaurant.phone}
                  </a>
                ) : '—'}
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Website</span>
                {restaurant.website ? (
                  <a href={restaurant.website} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline flex items-center gap-1 truncate">
                    <Globe className="w-3 h-3 shrink-0" /> {restaurant.website}
                  </a>
                ) : '—'}
              </div>
            </div>
          </div>

          {/* Opening Hours */}
          {restaurant.openingHours && restaurant.openingHours.length > 0 && (
            <div className="p-4 rounded-xl bg-gray-900/50 border border-white/5 space-y-2">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" /> Opening Hours
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-gray-300 text-[11px]">
                {restaurant.openingHours.map((h, i) => (
                  <li key={i} className="py-0.5 border-b border-white/5">{h}</li>
                ))}
              </ul>
            </div>
          )}

          {/* About Section Display */}
          {restaurant.aboutSection && Object.keys(restaurant.aboutSection).length > 0 && (
            <div className="p-4 rounded-xl bg-gray-900/50 border border-white/5 space-y-3">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-400" /> About & Amenities
              </h4>
              <div className="space-y-3">
                {Object.entries(restaurant.aboutSection).map(([cat, items]) => (
                  <div key={cat}>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">{cat}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-gray-800 text-gray-200 border border-white/10 text-[11px]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-gray-900/60 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-xs font-bold bg-gray-800 hover:bg-gray-700 text-white transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Restaurant Form Modal with About Section Editor ───────────────────────

interface RestaurantFormProps {
  initial?: Partial<Restaurant>;
  onSave: (data: Partial<Restaurant>) => Promise<void>;
  onClose: () => void;
  title: string;
  saving: boolean;
}

const EMPTY_FORM: Partial<Restaurant> = {
  name: '', address: '', city: '', country: '', postalCode: '',
  phone: '', email: '', website: '', cuisine: '', placeType: 'Restaurant',
  priceLevel: '', rating: undefined, googleMapsUri: '',
  location: { latitude: 0, longitude: 0 },
  aboutSection: {},
};

function RestaurantFormModal({ initial, onSave, onClose, title, saving }: RestaurantFormProps) {
  const [form, setForm] = useState<Partial<Restaurant>>(initial ? { ...EMPTY_FORM, ...initial } : EMPTY_FORM);
  const [aboutSec, setAboutSec] = useState<Record<string, string[]>>(initial?.aboutSection || {});
  const [newCatName, setNewCatName] = useState('');
  const [newTagInput, setNewTagInput] = useState<Record<string, string>>({});

  const set = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));
  const setLoc = (field: 'latitude' | 'longitude', value: string) =>
    setForm((f) => ({ ...f, location: { ...f.location!, [field]: parseFloat(value) || 0 } }));

  // Add tag to category
  const addTag = (cat: string) => {
    const val = (newTagInput[cat] || '').trim();
    if (!val) return;
    setAboutSec((prev) => {
      const existing = prev[cat] || [];
      if (existing.includes(val)) return prev;
      return { ...prev, [cat]: [...existing, val] };
    });
    setNewTagInput((prev) => ({ ...prev, [cat]: '' }));
  };

  // Remove tag from category
  const removeTag = (cat: string, tagToRemove: string) => {
    setAboutSec((prev) => {
      const updated = (prev[cat] || []).filter((t) => t !== tagToRemove);
      if (updated.length === 0) {
        const copy = { ...prev };
        delete copy[cat];
        return copy;
      }
      return { ...prev, [cat]: updated };
    });
  };

  // Add new category section
  const handleAddCategory = () => {
    const cat = newCatName.trim();
    if (!cat) return;
    if (!aboutSec[cat]) {
      setAboutSec((prev) => ({ ...prev, [cat]: [] }));
    }
    setNewCatName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ ...form, aboutSection: aboutSec });
  };

  const input = 'w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl glass-panel rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-6 flex-1 text-xs">
          {/* Main Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name *">
              <input required value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="Restaurant name" className={input} />
            </Field>
            <Field label="Place Type">
              <select value={form.placeType || 'Restaurant'} onChange={(e) => set('placeType', e.target.value)} className={input}>
                {['Restaurant', 'Cafe', 'Hotel', 'Bakery', 'Fast Food'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Address">
              <input value={form.address || ''} onChange={(e) => set('address', e.target.value)} placeholder="Street address" className={input} />
            </Field>
            <Field label="City">
              <input value={form.city || ''} onChange={(e) => set('city', e.target.value)} placeholder="City" className={input} />
            </Field>
            <Field label="Country">
              <input value={form.country || ''} onChange={(e) => set('country', e.target.value)} placeholder="Country" className={input} />
            </Field>
            <Field label="Postal Code">
              <input value={form.postalCode || ''} onChange={(e) => set('postalCode', e.target.value)} placeholder="Postal code" className={input} />
            </Field>
            <Field label="Phone">
              <input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} placeholder="+1234567890" className={input} />
            </Field>
            <Field label="Website">
              <input value={form.website || ''} onChange={(e) => set('website', e.target.value)} placeholder="https://example.com" className={input} />
            </Field>
            <Field label="Cuisine">
              <input value={form.cuisine || ''} onChange={(e) => set('cuisine', e.target.value)} placeholder="Pakistani, Fast Food, etc." className={input} />
            </Field>
            <Field label="Rating (0-5)">
              <input type="number" step="0.1" min="0" max="5" value={form.rating ?? ''} onChange={(e) => set('rating', parseFloat(e.target.value) || undefined)} placeholder="4.5" className={input} />
            </Field>
          </div>

          {/* About Section Editable Block */}
          <div className="p-4 rounded-xl bg-gray-900/60 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-400" /> Update About Section Categories & Tags
              </h4>
            </div>

            {/* Add new category control */}
            <div className="flex items-center gap-2">
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="New Category (e.g. Atmosphere, Service options)"
                className={input}
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shrink-0 transition-colors"
              >
                + Add Category
              </button>
            </div>

            {/* Render existing about categories */}
            <div className="space-y-4 pt-2">
              {Object.keys(aboutSec).length === 0 ? (
                <div className="text-gray-500 text-center py-3 italic">No About categories added yet.</div>
              ) : (
                Object.entries(aboutSec).map(([cat, tags]) => (
                  <div key={cat} className="p-3 rounded-lg bg-gray-800/80 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-300 text-xs uppercase tracking-wider">{cat}</span>
                    </div>

                    {/* Tag list */}
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-900 text-gray-200 border border-white/10 text-xs">
                          {tag}
                          <button type="button" onClick={() => removeTag(cat, tag)} className="text-gray-400 hover:text-rose-400 ml-1">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* Add new tag input */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        value={newTagInput[cat] || ''}
                        onChange={(e) => setNewTagInput({ ...newTagInput, [cat]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag(cat);
                          }
                        }}
                        placeholder={`Add tag to ${cat}...`}
                        className="flex-1 bg-gray-900 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => addTag(cat)}
                        className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold text-xs"
                      >
                        Add Tag
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl text-xs border border-white/10 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white transition-all disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Restaurant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

// ─── Main Admin Dashboard Page ────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [citiesList, setCitiesList] = useState<{ city: string; count: number }[]>([]);
  const [citiesModalOpen, setCitiesModalOpen] = useState(false);

  const [listData, setListData] = useState<AdminListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters State
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [nullFilter, setNullFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Restaurant | null>(null);
  const [viewTarget, setViewTarget] = useState<Restaurant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Restaurant | null>(null);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await adminGetStats();
      setStats(data);
      const cities = await adminGetCities();
      setCitiesList(cities);
    } catch (err: any) {
      showToast('Failed to load admin stats', 'error');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadList = useCallback(async (p: number = page) => {
    setLoading(true);
    try {
      const data = await adminGetAll(p, PAGE_SIZE);
      setListData(data);
    } catch (err: any) {
      showToast('Failed to load restaurant list', 'error');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadStats();
    loadList(1);
  }, [loadStats, loadList]);

  const handleAdd = async (formData: Partial<Restaurant>) => {
    setSaving(true);
    try {
      await adminAddRestaurant(formData);
      showToast('Restaurant added successfully!');
      setAddOpen(false);
      loadStats();
      loadList(1);
    } catch (err: any) {
      showToast(err.message || 'Failed to add restaurant', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (formData: Partial<Restaurant>) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await adminEditRestaurant(editTarget.id, formData);
      showToast('Restaurant updated successfully!');
      setEditTarget(null);
      loadStats();
      loadList();
    } catch (err: any) {
      showToast(err.message || 'Failed to edit restaurant', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await adminDeleteRestaurant(deleteTarget.id);
      showToast('Restaurant deleted successfully!');
      setDeleteTarget(null);
      loadStats();
      loadList();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete restaurant', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResolveCities = async () => {
    setLoading(true);
    try {
      const res = await adminResolveCities();
      showToast(`Resolved ${res.resolved} cities (Failed: ${res.failed})`);
      loadStats();
      loadList(1);
    } catch (err: any) {
      showToast('Failed to resolve cities', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeduplicate = async () => {
    setLoading(true);
    try {
      const res = await adminDeduplicate();
      showToast(`Merged ${res.merged} groups, deleted ${res.deleted} duplicate rows!`);
      loadStats();
      loadList(1);
    } catch (err: any) {
      showToast('Failed to deduplicate database', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (targetLevel: 'intermediate' | 'advanced') => {
    setUpgrading(targetLevel);
    try {
      const res = await adminUpgradeScraping(targetLevel);
      showToast(`Queued ${res.queued} records for re-scraping at '${targetLevel}' quality!`);
    } catch (err: any) {
      showToast('Failed to queue upgrade', 'error');
    } finally {
      setUpgrading(null);
    }
  };

  // Filter & Sort Logic
  const rawRows = listData?.data || [];
  let filteredRows = rawRows.filter((r) => {
    // 1. Text Search
    if (search) {
      const q = search.toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchCity = r.city && r.city.toLowerCase().includes(q);
      const matchCuisine = r.cuisine && r.cuisine.toLowerCase().includes(q);
      if (!matchName && !matchCity && !matchCuisine) return false;
    }

    // 2. Scraping Level Filter
    if (levelFilter !== 'all') {
      if ((r.scrapingLevel || 'basic') !== levelFilter) return false;
    }

    // 3. City Filter
    if (cityFilter !== 'all') {
      if ((r.city || '').toLowerCase() !== cityFilter.toLowerCase()) return false;
    }

    // 4. Null Values Filter
    if (nullFilter === 'missing_city' && r.city) return false;
    if (nullFilter === 'missing_phone' && r.phone) return false;
    if (nullFilter === 'missing_website' && r.website) return false;
    if (nullFilter === 'missing_cuisine' && r.cuisine) return false;
    if (nullFilter === 'missing_hours' && r.openingHours && r.openingHours.length > 0) return false;
    if (nullFilter === 'missing_rating' && r.rating != null) return false;

    return true;
  });

  // Sorting
  filteredRows.sort((a, b) => {
    if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
    if (sortBy === 'rating_desc') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'rating_asc') return (a.rating || 0) - (b.rating || 0);
    if (sortBy === 'level') {
      const rank = { basic: 1, intermediate: 2, advanced: 3 };
      return rank[b.scrapingLevel || 'basic'] - rank[a.scrapingLevel || 'basic'];
    }
    return 0;
  });

  const totalPages = listData ? Math.ceil(listData.total / PAGE_SIZE) : 1;

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl border shadow-2xl text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/90 border-rose-500/40 text-rose-300'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <header className="flex items-center justify-between gap-4 p-6 rounded-3xl glass-panel border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 z-10">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-white/10 text-gray-300 hover:text-white text-xs font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Database className="w-6 h-6 text-purple-400" />
              Admin <span className="text-purple-400">Panel</span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Manage restaurants, filter data, update about section, view cities list</p>
          </div>
        </div>

        <div className="flex items-center gap-2 z-10">
          <button
            onClick={() => {
              loadStats();
              loadList();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-white/10 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || statsLoading ? 'animate-spin text-emerald-400' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-900/40 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Restaurant
          </button>
        </div>
      </header>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-panel rounded-2xl p-4 border bg-gradient-to-br from-emerald-900/40 to-emerald-900/10 border-emerald-500/20 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <BarChart3 className="w-3.5 h-3.5 text-gray-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{statsLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> : (stats?.totalRestaurants ?? '—')}</div>
            <div className="text-[10px] text-gray-400 font-semibold uppercase">Total Restaurants</div>
          </div>
        </div>

        {/* CLICKABLE TOTAL CITIES CARD */}
        <button
          onClick={() => setCitiesModalOpen(true)}
          className="glass-panel rounded-2xl p-4 border bg-gradient-to-br from-amber-900/40 to-amber-900/10 border-amber-500/30 hover:border-amber-400 transition-all text-left flex flex-col gap-2 group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <MapPin className="w-5 h-5 text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400 group-hover:underline">View List →</span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">{statsLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> : (stats?.totalCities ?? '—')}</div>
            <div className="text-[10px] text-amber-400 font-semibold uppercase">Total Cities (Click to view)</div>
          </div>
        </button>

        <div className="glass-panel rounded-2xl p-4 border bg-gradient-to-br from-amber-900/30 to-transparent border-amber-500/20 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Zap className="w-5 h-5 text-amber-400" />
            <BarChart3 className="w-3.5 h-3.5 text-gray-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{statsLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> : (stats?.basicCount ?? '—')}</div>
            <div className="text-[10px] text-gray-400 font-semibold uppercase">Basic</div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border bg-gradient-to-br from-sky-900/30 to-transparent border-sky-500/20 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Star className="w-5 h-5 text-sky-400" />
            <BarChart3 className="w-3.5 h-3.5 text-gray-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{statsLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> : (stats?.intermediateCount ?? '—')}</div>
            <div className="text-[10px] text-gray-400 font-semibold uppercase">Intermediate</div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border bg-gradient-to-br from-purple-900/30 to-transparent border-purple-500/20 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Lock className="w-5 h-5 text-purple-400" />
            <BarChart3 className="w-3.5 h-3.5 text-gray-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{statsLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> : (stats?.advancedCount ?? '—')}</div>
            <div className="text-[10px] text-gray-400 font-semibold uppercase">Advanced</div>
          </div>
        </div>
      </div>

      {/* ── Action Bar: City Resolution + Scraping Upgrade + Deduplicate ── */}
      <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Database Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDeduplicate}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-lg shadow-rose-900/30 transition-all disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Remove Duplicates
          </button>

          <button
            onClick={handleResolveCities}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-orange-900/30 transition-all disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            Resolve Postal Codes → City Names
          </button>

          <button
            onClick={() => handleUpgrade('intermediate')}
            disabled={upgrading !== null}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white shadow-lg shadow-sky-900/30 transition-all disabled:opacity-60"
          >
            {upgrading === 'intermediate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Basic → Intermediate
          </button>

          <button
            onClick={() => handleUpgrade('advanced')}
            disabled={upgrading !== null}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white shadow-lg shadow-purple-900/30 transition-all disabled:opacity-60"
          >
            {upgrading === 'advanced' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Basic + Intermediate → Advanced
          </button>
        </div>
      </div>

      {/* ── MULTIPLE FILTERS TOOLBAR ── */}
      <div className="glass-panel rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-purple-400" /> Filter & Sort Records
          </h2>
          {(levelFilter !== 'all' || cityFilter !== 'all' || nullFilter !== 'all' || search || sortBy !== 'newest') && (
            <button
              onClick={() => {
                setLevelFilter('all');
                setCityFilter('all');
                setNullFilter('all');
                setSearch('');
                setSortBy('newest');
              }}
              className="text-[11px] text-rose-400 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Search Bar */}
          <div className="relative">
            <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Search Keyword</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, city, cuisine…"
                className="w-full bg-gray-900 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Scraping Level Filter */}
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Scraping Level</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Levels</option>
              <option value="basic">Basic (⚡)</option>
              <option value="intermediate">Intermediate (★)</option>
              <option value="advanced">Advanced (🔒)</option>
            </select>
          </div>

          {/* City Filter */}
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Filter By City</label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Cities</option>
              {citiesList.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city} ({c.count})
                </option>
              ))}
            </select>
          </div>

          {/* Null Values Filter */}
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Missing Fields (Nulls)</label>
            <select
              value={nullFilter}
              onChange={(e) => setNullFilter(e.target.value)}
              className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Records</option>
              <option value="missing_city">Missing City</option>
              <option value="missing_phone">Missing Phone</option>
              <option value="missing_website">Missing Website</option>
              <option value="missing_cuisine">Missing Cuisine</option>
              <option value="missing_hours">Missing Opening Hours</option>
              <option value="missing_rating">Missing Rating</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Sort Order</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="newest">Newest First</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="rating_desc">Rating (High to Low)</option>
              <option value="rating_asc">Rating (Low to High)</option>
              <option value="level">Scraping Level (Highest)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Restaurant Table ── */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            Restaurants
            <span className="text-xs font-normal text-gray-400">
              (Showing {filteredRows.length} of {listData?.total || 0} loaded)
            </span>
          </h2>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-gray-900/40">
                {['#', 'Name', 'City', 'Rating', 'Phone', 'Website', 'Cuisine', 'Scraping Level', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] uppercase font-bold text-gray-400 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-500 text-xs">
                    No restaurants match selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, idx) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-gray-800/50 transition-colors group">
                    <td className="px-4 py-3 text-gray-500">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white max-w-[180px] truncate">{r.name}</div>
                      <div className="text-gray-500 text-[10px] truncate max-w-[180px]">{r.address || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-300">{r.city || <span className="text-gray-600 italic">no city</span>}</span>
                      {r.country && <span className="text-gray-600">, {r.country}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.rating ? (
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          <Star className="w-3 h-3" /> {r.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.phone ? (
                        <a href={`tel:${r.phone}`} className="flex items-center gap-1 text-sky-400 hover:text-sky-300">
                          <Phone className="w-3 h-3" /> {r.phone}
                        </a>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.website ? (
                        <a href={r.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 max-w-[120px] truncate">
                          <Globe className="w-3 h-3 shrink-0" />
                          <span className="truncate">{r.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                        </a>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{r.cuisine || '—'}</td>
                    <td className="px-4 py-3">
                      <ScrapingBadge level={r.scrapingLevel} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setViewTarget(r)}
                          className="px-2 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          title="See all details"
                        >
                          <Eye className="w-3.5 h-3.5 text-purple-400" />
                          <span>See</span>
                        </button>

                        <button onClick={() => setEditTarget(r)} className="p-1.5 rounded-lg text-sky-400 hover:bg-sky-400/10 hover:text-sky-300 transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-400/10 hover:text-rose-300 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
            <span className="text-[11px] text-gray-500">
              Page {page} of {totalPages} ({listData?.total} records, 50 per page)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const newP = Math.max(1, page - 1);
                  setPage(newP);
                  loadList(newP);
                }}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const newP = Math.min(totalPages, page + 1);
                  setPage(newP);
                  loadList(newP);
                }}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Cities List Modal ── */}
      {citiesModalOpen && (
        <CitiesListModal
          cities={citiesList}
          onSelectCity={(cityName) => {
            setCityFilter(cityName);
            showToast(`Filtering by city: ${cityName}`);
          }}
          onClose={() => setCitiesModalOpen(false)}
        />
      )}

      {/* ── View Details Modal ("See" Button) ── */}
      {viewTarget && <RestaurantDetailsModal restaurant={viewTarget} onClose={() => setViewTarget(null)} />}

      {/* ── Add Modal ── */}
      {addOpen && <RestaurantFormModal title="Add New Restaurant" onSave={handleAdd} onClose={() => setAddOpen(false)} saving={saving} />}

      {/* ── Edit Modal with About Section Editor ── */}
      {editTarget && <RestaurantFormModal title={`Edit: ${editTarget.name}`} initial={editTarget} onSave={handleEdit} onClose={() => setEditTarget(null)} saving={saving} />}

      {/* ── Delete Confirm Dialog ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel rounded-2xl border border-rose-500/30 p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-rose-500/15 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-rose-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Delete Restaurant?</h3>
            <p className="text-sm text-gray-400">
              This will permanently remove <span className="text-white font-semibold">{deleteTarget.name}</span> from the database.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button onClick={() => setDeleteTarget(null)} className="px-6 py-2 rounded-xl text-sm border border-white/10 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white transition-all disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
