import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SearchLocationDto } from './dto/search-location.dto';
import { GoogleMapsScraperService, ScrapedRestaurant, ScrapingMode } from './scraper.service';
import { RestaurantEntity } from './entities/restaurant.entity';

export interface RestaurantItem {
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
  aboutSection?: Record<string, string[]>;
  aboutKeywords?: string[];
  menuData?: any[];
  scrapingLevel?: 'basic' | 'intermediate' | 'advanced';
}

@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);

  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepository: Repository<RestaurantEntity>,
    private readonly configService: ConfigService,
    private readonly scraperService: GoogleMapsScraperService,
  ) {}

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  /** Get keys for restaurants that are ALREADY scraped at 'advanced' level */
  private async getAdvancedKeys(): Promise<Set<string>> {
    try {
      const advancedRecords = await this.restaurantRepository.find({
        where: { scrapingLevel: 'advanced' },
      });
      const keys = new Set<string>();
      for (const r of advancedRecords) {
        if (r.googleMapsUri) keys.add(r.googleMapsUri);
        if (r.normalizedName) keys.add(r.normalizedName);
        if (r.name) keys.add(r.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
      }
      return keys;
    } catch {
      return new Set<string>();
    }
  }

  /**
   * Helper to clean city and postalCode:
   * If `city` contains a postal code, move it to `postalCode`
   * and extract real city name from address.
   */
  private cleanCityAndPostalCode(item: { city?: string; postalCode?: string; address?: string }): { city?: string; postalCode?: string } {
    let city = item.city?.trim();
    let postalCode = item.postalCode?.trim();
    const address = item.address?.trim() || '';

    const isPostalCodePattern = (val?: string) =>
      val ? /^[\d\s\-]{3,10}$/.test(val) || /^\d{5}(-\d{4})?$/.test(val) : false;

    if (city && isPostalCodePattern(city)) {
      if (!postalCode) postalCode = city;
      city = undefined;
    }

    if (!city && address) {
      const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
      const nonZipParts = parts.filter((p) => !isPostalCodePattern(p));
      if (nonZipParts.length >= 2) {
        const candidate = nonZipParts[nonZipParts.length - 2] || nonZipParts[nonZipParts.length - 1];
        if (candidate && candidate.length > 2 && candidate.length < 40) {
          city = candidate.replace(/\b(City|Division|District|Province|State)\b/gi, '').trim() || candidate;
        }
      }
    }

    return { city, postalCode };
  }

  private entityToItem(res: RestaurantEntity, refLat?: number, refLng?: number): RestaurantItem {
    return {
      id: res.id,
      name: res.name,
      address: res.address || undefined,
      city: res.city || undefined,
      country: res.country || undefined,
      postalCode: res.postalCode || undefined,
      location: { latitude: res.latitude, longitude: res.longitude },
      rating: res.rating ?? undefined,
      userRatingCount: res.userRatingCount ?? undefined,
      googleMapsUri: res.googleMapsUri || undefined,
      priceLevel: res.priceLevel || undefined,
      cuisine: res.cuisine || undefined,
      cuisineTypes: res.cuisineTypes?.length ? res.cuisineTypes : undefined,
      placeType: res.placeType || undefined,
      phone: res.phone || undefined,
      email: res.email || undefined,
      website: res.website || undefined,
      images: res.images?.length ? res.images : undefined,
      openingHours: res.openingHours?.length ? res.openingHours : undefined,
      isOpenNow: res.isOpenNow ?? undefined,
      distanceKm:
        refLat != null && refLng != null
          ? this.calculateDistance(refLat, refLng, res.latitude, res.longitude)
          : undefined,
      aboutSection: res.aboutSection || undefined,
      aboutKeywords: res.aboutKeywords?.length ? res.aboutKeywords : undefined,
      menuData: res.menuData?.length ? res.menuData : undefined,
      scrapingLevel: res.scrapingLevel || 'basic',
    };
  }

  /**
   * Fast DB lookup first.
   * If cached DB results count >= requested limit, return DB results.
   * Otherwise execute live scraping to fetch requested limit.
   */
  async findNearestRestaurants(dto: SearchLocationDto): Promise<{ restaurants: RestaurantItem[]; source: string }> {
    const limit = Math.min(dto.limit || 10, 1000);
    const radiusKm = (dto.radius || 5000) / 1000;
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((dto.latitude * Math.PI) / 180));
    const mode: ScrapingMode = dto.scrapingMode || 'basic';

    let dbRestaurants: RestaurantEntity[] = [];
    try {
      dbRestaurants = await this.restaurantRepository
        .createQueryBuilder('res')
        .where('res.latitude BETWEEN :minLat AND :maxLat', {
          minLat: dto.latitude - latDelta,
          maxLat: dto.latitude + latDelta,
        })
        .andWhere('res.longitude BETWEEN :minLng AND :maxLng', {
          minLng: dto.longitude - lngDelta,
          maxLng: dto.longitude + lngDelta,
        })
        .getMany();
    } catch (err: any) {
      this.logger.warn(`Failed to query PostgreSQL restaurants table: ${err.message}`);
    }

    if (dbRestaurants.length >= limit) {
      this.logger.log(`⚡ Instant response: Found ${dbRestaurants.length} cached restaurants in PostgreSQL (>= requested ${limit}).`);
      const mapped = dbRestaurants.map((res) => this.entityToItem(res, dto.latitude, dto.longitude));

      const uniqueMapped: RestaurantItem[] = [];
      const seen = new Set<string>();
      for (const item of mapped) {
        const key = item.googleMapsUri || (item.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + (item.phone || ''));
        if (!seen.has(key)) {
          seen.add(key);
          uniqueMapped.push(item);
        }
      }

      uniqueMapped.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
      const topResults = uniqueMapped.slice(0, limit);

      this.saveAndScrapeInBackground(dto.latitude, dto.longitude, limit, mode);
      return { restaurants: topResults, source: 'postgresql_database' };
    }

    // 2. Execute live scraping for requested limit
    this.logger.log(`🔍 Live scraping for location (${dto.latitude}, ${dto.longitude}) [limit=${limit}, mode=${mode}]...`);
    let restaurants: RestaurantItem[] = [];
    let source = `google_maps_puppeteer_scraper_${mode}`;

    try {
      const skipKeys = await this.getAdvancedKeys();
      const scraped = await this.scraperService.scrapeNearestRestaurants(dto.latitude, dto.longitude, limit, mode, skipKeys);
      if (scraped && scraped.length > 0) {
        restaurants = scraped.map((s) => ({ ...s, scrapingLevel: mode }));
      }
    } catch (err: any) {
      this.logger.warn(`Live scraper error: ${err.message}`);
      source = 'fallback_demo_data';
    }

    // Save/upsert new scraped restaurants into PostgreSQL database without duplicates
    await this.upsertRestaurantsToDatabase(restaurants, mode);

    // Deduplicate in memory
    const uniqueResults: RestaurantItem[] = [];
    const seen = new Set<string>();
    for (const item of restaurants) {
      const key = item.googleMapsUri || (item.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + (item.phone || ''));
      if (!seen.has(key)) {
        seen.add(key);
        uniqueResults.push(item);
      }
    }

    uniqueResults.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    const topResults = uniqueResults.slice(0, limit);

    return { restaurants: topResults, source };
  }

  /**
   * Upsert scraped restaurants into PostgreSQL `restaurants` table.
   * RULE: If existing record is already at 'advanced' level, DO NOT update or overwrite if incoming mode is basic or intermediate.
   */
  private async upsertRestaurantsToDatabase(items: RestaurantItem[], mode: ScrapingMode = 'basic'): Promise<void> {
    if (!items || items.length === 0) return;
    try {
      for (const item of items) {
        const normName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!normName) continue;

        const { city: cleanedCity, postalCode: cleanedPostalCode } = this.cleanCityAndPostalCode({
          city: item.city,
          postalCode: item.postalCode,
          address: item.address,
        });

        let existing: RestaurantEntity | null = null;

        if (item.googleMapsUri && item.googleMapsUri.length > 10) {
          existing = await this.restaurantRepository.findOne({ where: { googleMapsUri: item.googleMapsUri } });
        }
        if (!existing && item.phone && item.phone.trim().length > 5) {
          const cleanPhone = item.phone.replace(/[^0-9]/g, '');
          if (cleanPhone.length >= 7) {
            const candidates = await this.restaurantRepository.find();
            existing = candidates.find((r) => r.phone && r.phone.replace(/[^0-9]/g, '').endsWith(cleanPhone.slice(-7))) || null;
          }
        }
        if (!existing && normName) {
          const candidates = await this.restaurantRepository.find({ where: { normalizedName: normName } });
          if (candidates.length > 0) {
            if (item.location?.latitude && item.location?.longitude) {
              existing =
                candidates.find(
                  (c) => this.calculateDistance(c.latitude, c.longitude, item.location.latitude, item.location.longitude) < 0.5,
                ) || candidates[0];
            } else {
              existing = candidates[0];
            }
          }
        }

        if (existing) {
          // RULE: "once resturant are in advace donot scrabe again"
          if (existing.scrapingLevel === 'advanced' && mode !== 'advanced') {
            this.logger.log(`Protected: Record '${existing.name}' is already at 'advanced' level — skipping update from '${mode}' scan.`);
            continue;
          }

          if (item.name) existing.name = item.name;
          if (item.address && item.address.trim()) existing.address = item.address;
          if (cleanedCity) existing.city = cleanedCity;
          if (cleanedPostalCode) existing.postalCode = cleanedPostalCode;
          if (item.country && item.country.trim()) existing.country = item.country;
          if (item.location?.latitude) existing.latitude = item.location.latitude;
          if (item.location?.longitude) existing.longitude = item.location.longitude;
          if (item.rating != null) existing.rating = item.rating;
          if (item.userRatingCount != null) existing.userRatingCount = item.userRatingCount;
          if (item.googleMapsUri) existing.googleMapsUri = item.googleMapsUri;
          if (item.phone && item.phone.trim()) existing.phone = item.phone;
          if (item.email && item.email.trim()) existing.email = item.email;
          if (item.website && item.website.trim()) existing.website = item.website;
          if (item.images && item.images.length > 0) existing.images = item.images;
          if (item.openingHours && item.openingHours.length > 0) existing.openingHours = item.openingHours;
          if (item.isOpenNow != null) existing.isOpenNow = item.isOpenNow;
          if (item.cuisine && item.cuisine.trim()) existing.cuisine = item.cuisine;
          if (item.cuisineTypes && item.cuisineTypes.length > 0) existing.cuisineTypes = item.cuisineTypes;
          if (item.placeType && item.placeType.trim()) existing.placeType = item.placeType;
          if (item.priceLevel && item.priceLevel.trim()) existing.priceLevel = item.priceLevel;
          if (item.aboutSection && Object.keys(item.aboutSection).length > 0) existing.aboutSection = item.aboutSection;
          if (item.aboutKeywords && item.aboutKeywords.length > 0) existing.aboutKeywords = item.aboutKeywords;
          if (item.menuData && item.menuData.length > 0) existing.menuData = item.menuData;

          const levels: ScrapingMode[] = ['basic', 'intermediate', 'advanced'];
          if (levels.indexOf(mode) > levels.indexOf(existing.scrapingLevel as ScrapingMode)) {
            existing.scrapingLevel = mode;
          }
          await this.restaurantRepository.save(existing);
        } else {
          const newRecord = this.restaurantRepository.create({
            id: item.id || `res-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            normalizedName: normName,
            name: item.name,
            address: item.address && item.address.trim() ? item.address : undefined,
            city: cleanedCity,
            country: item.country && item.country.trim() ? item.country : undefined,
            postalCode: cleanedPostalCode || (item.postalCode && item.postalCode.trim() ? item.postalCode : undefined),
            latitude: item.location.latitude,
            longitude: item.location.longitude,
            rating: item.rating ?? undefined,
            userRatingCount: item.userRatingCount ?? undefined,
            googleMapsUri: item.googleMapsUri || undefined,
            priceLevel: item.priceLevel && item.priceLevel.trim() ? item.priceLevel : undefined,
            cuisine: item.cuisine && item.cuisine.trim() ? item.cuisine : undefined,
            cuisineTypes: item.cuisineTypes?.length ? item.cuisineTypes : undefined,
            placeType: item.placeType && item.placeType.trim() ? item.placeType : undefined,
            phone: item.phone && item.phone.trim() ? item.phone : undefined,
            email: item.email && item.email.trim() ? item.email : undefined,
            website: item.website && item.website.trim() ? item.website : undefined,
            images: item.images?.length ? item.images : undefined,
            openingHours: item.openingHours?.length ? item.openingHours : undefined,
            isOpenNow: item.isOpenNow ?? null,
            aboutSection: item.aboutSection && Object.keys(item.aboutSection).length > 0 ? item.aboutSection : undefined,
            aboutKeywords: item.aboutKeywords?.length ? item.aboutKeywords : undefined,
            menuData: item.menuData?.length ? item.menuData : undefined,
            scrapingLevel: mode,
          });
          await this.restaurantRepository.save(newRecord);
        }
      }
      this.logger.log(`💾 Synchronized ${items.length} restaurants into PostgreSQL database [mode=${mode}].`);
    } catch (err: any) {
      this.logger.warn(`Failed to upsert restaurants to PostgreSQL: ${err.message}`);
    }
  }

  /**
   * Deduplicate existing rows in PostgreSQL database.
   */
  async deduplicateDatabase(): Promise<{ merged: number; deleted: number }> {
    const all = await this.restaurantRepository.find();
    const groups: Map<string, RestaurantEntity[]> = new Map();

    for (const item of all) {
      const key = item.googleMapsUri || (item.normalizedName + '_' + (item.phone || ''));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    let merged = 0;
    let deleted = 0;
    const levelRank = { basic: 1, intermediate: 2, advanced: 3 };

    for (const [, records] of groups) {
      if (records.length > 1) {
        records.sort((a, b) => (levelRank[b.scrapingLevel || 'basic'] || 1) - (levelRank[a.scrapingLevel || 'basic'] || 1));
        const primary = records[0];

        for (let i = 1; i < records.length; i++) {
          const dup = records[i];
          if (!primary.address && dup.address) primary.address = dup.address;
          if (!primary.city && dup.city) primary.city = dup.city;
          if (!primary.phone && dup.phone) primary.phone = dup.phone;
          if (!primary.website && dup.website) primary.website = dup.website;
          if ((!primary.images || primary.images.length === 0) && dup.images) primary.images = dup.images;
          if ((!primary.openingHours || primary.openingHours.length === 0) && dup.openingHours) primary.openingHours = dup.openingHours;
          if (!primary.menuData && dup.menuData) primary.menuData = dup.menuData;
          await this.restaurantRepository.remove(dup);
          deleted++;
        }
        await this.restaurantRepository.save(primary);
        merged++;
      }
    }

    this.logger.log(`deduplicateDatabase: Merged ${merged} groups, deleted ${deleted} duplicate rows.`);
    return { merged, deleted };
  }

  /**
   * Non-blocking background scraping task.
   */
  private saveAndScrapeInBackground(latitude: number, longitude: number, limit: number, mode: ScrapingMode): void {
    setImmediate(async () => {
      try {
        this.logger.log(`🔄 Background refresh [mode=${mode}]: Checking for new restaurants near (${latitude}, ${longitude})...`);
        const skipKeys = await this.getAdvancedKeys();
        const newScraped = await this.scraperService.scrapeNearestRestaurants(latitude, longitude, limit, mode, skipKeys);
        if (newScraped && newScraped.length > 0) {
          await this.upsertRestaurantsToDatabase(newScraped.map((s) => ({ ...s, scrapingLevel: mode })), mode);
        }
      } catch (err: any) {
        this.logger.warn(`Background scraper task error: ${err.message}`);
      }
    });
  }

  async geocodeLocation(query: string): Promise<any[]> {
    if (!query || query.trim().length < 2) return [];
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=10&accept-language=en`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'HotelRestaurantScraperBackend/1.0 (contact@hotelscraper.local)',
        },
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data.map((item: any) => ({
        displayName: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        type: item.type || item.addresstype || 'place',
      }));
    } catch (err) {
      this.logger.warn(`Server geocoding failed: ${err.message}`);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  ADMIN METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /** Get high-level stats for the admin dashboard */
  async getAdminStats(): Promise<{ totalRestaurants: number; totalCities: number; basicCount: number; intermediateCount: number; advancedCount: number }> {
    const total = await this.restaurantRepository.count();
    const cityRows = await this.restaurantRepository
      .createQueryBuilder('res')
      .select('DISTINCT res.city', 'city')
      .where('res.city IS NOT NULL AND res.city != :empty', { empty: '' })
      .getRawMany();
    const basicCount = await this.restaurantRepository.count({ where: { scrapingLevel: 'basic' } });
    const intermediateCount = await this.restaurantRepository.count({ where: { scrapingLevel: 'intermediate' } });
    const advancedCount = await this.restaurantRepository.count({ where: { scrapingLevel: 'advanced' } });
    return {
      totalRestaurants: total,
      totalCities: cityRows.length,
      basicCount,
      intermediateCount,
      advancedCount,
    };
  }

  /** Get list of all distinct cities with restaurant counts */
  async getAdminCities(): Promise<{ city: string; count: number }[]> {
    const raw = await this.restaurantRepository
      .createQueryBuilder('res')
      .select('res.city', 'city')
      .addSelect('COUNT(res.id)', 'count')
      .where('res.city IS NOT NULL AND res.city != :empty', { empty: '' })
      .groupBy('res.city')
      .orderBy('count', 'DESC')
      .getRawMany();

    return raw.map((r) => ({
      city: r.city,
      count: parseInt(r.count, 10) || 0,
    }));
  }

  /** Get all restaurants paginated for admin table (Max 50 per page) */
  async getAllRestaurants(page: number = 1, pageSize: number = 50): Promise<{ data: RestaurantItem[]; total: number; page: number; pageSize: number }> {
    const effectivePageSize = Math.min(pageSize, 50);
    const [rows, total] = await this.restaurantRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * effectivePageSize,
      take: effectivePageSize,
    });
    return {
      data: rows.map((r) => this.entityToItem(r)),
      total,
      page,
      pageSize: effectivePageSize,
    };
  }

  /** Manually add a restaurant via admin */
  async adminAddRestaurant(data: Partial<RestaurantItem>): Promise<RestaurantItem> {
    const normName = (data.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const { city: cleanedCity, postalCode: cleanedPostalCode } = this.cleanCityAndPostalCode({
      city: data.city,
      postalCode: data.postalCode,
      address: data.address,
    });

    const entity = this.restaurantRepository.create({
      id: `admin-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      normalizedName: normName,
      name: data.name!,
      address: data.address || undefined,
      city: cleanedCity,
      country: data.country || undefined,
      postalCode: cleanedPostalCode || data.postalCode || undefined,
      latitude: data.location?.latitude || 0,
      longitude: data.location?.longitude || 0,
      rating: data.rating ?? undefined,
      userRatingCount: data.userRatingCount ?? undefined,
      googleMapsUri: data.googleMapsUri || undefined,
      priceLevel: data.priceLevel || undefined,
      cuisine: data.cuisine || undefined,
      cuisineTypes: data.cuisineTypes?.length ? data.cuisineTypes : undefined,
      placeType: data.placeType || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      website: data.website || undefined,
      images: data.images?.length ? data.images : undefined,
      openingHours: data.openingHours?.length ? data.openingHours : undefined,
      isOpenNow: data.isOpenNow ?? null,
      aboutSection: data.aboutSection || undefined,
      aboutKeywords: data.aboutKeywords?.length ? data.aboutKeywords : undefined,
      menuData: data.menuData?.length ? data.menuData : undefined,
      scrapingLevel: 'basic',
    });
    const saved = await this.restaurantRepository.save(entity);
    return this.entityToItem(saved);
  }

  /** Edit an existing restaurant via admin */
  async adminEditRestaurant(id: string, data: Partial<RestaurantItem>): Promise<RestaurantItem> {
    const existing = await this.restaurantRepository.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Restaurant with id "${id}" not found`);

    if (data.name) {
      existing.name = data.name;
      existing.normalizedName = data.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    if (data.address !== undefined) existing.address = data.address;
    if (data.city !== undefined) {
      const { city: cCity, postalCode: cZip } = this.cleanCityAndPostalCode({ city: data.city, address: data.address || existing.address });
      existing.city = cCity || data.city;
      if (cZip) existing.postalCode = cZip;
    }
    if (data.country !== undefined) existing.country = data.country;
    if (data.postalCode !== undefined) existing.postalCode = data.postalCode;
    if (data.location) {
      existing.latitude = data.location.latitude;
      existing.longitude = data.location.longitude;
    }
    if (data.rating !== undefined) existing.rating = data.rating;
    if (data.userRatingCount !== undefined) existing.userRatingCount = data.userRatingCount;
    if (data.googleMapsUri !== undefined) existing.googleMapsUri = data.googleMapsUri;
    if (data.priceLevel !== undefined) existing.priceLevel = data.priceLevel;
    if (data.cuisine !== undefined) existing.cuisine = data.cuisine;
    if (data.cuisineTypes !== undefined) existing.cuisineTypes = data.cuisineTypes;
    if (data.placeType !== undefined) existing.placeType = data.placeType;
    if (data.phone !== undefined) existing.phone = data.phone;
    if (data.email !== undefined) existing.email = data.email;
    if (data.website !== undefined) existing.website = data.website;
    if (data.images !== undefined) existing.images = data.images;
    if (data.openingHours !== undefined) existing.openingHours = data.openingHours;
    if (data.isOpenNow !== undefined) existing.isOpenNow = data.isOpenNow;
    if (data.aboutSection !== undefined) existing.aboutSection = data.aboutSection;
    if (data.aboutKeywords !== undefined) existing.aboutKeywords = data.aboutKeywords;
    if (data.menuData !== undefined) existing.menuData = data.menuData;

    const saved = await this.restaurantRepository.save(existing);
    return this.entityToItem(saved);
  }

  /** Delete a restaurant via admin */
  async adminDeleteRestaurant(id: string): Promise<{ success: boolean }> {
    const existing = await this.restaurantRepository.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Restaurant with id "${id}" not found`);
    await this.restaurantRepository.remove(existing);
    return { success: true };
  }

  /**
   * Resolve postal codes: for records where `city` is null/empty or looks like a
   * postal code, reverse-geocode via Nominatim and save the real city name.
   */
  async resolvePostalCodeCities(): Promise<{ resolved: number; failed: number }> {
    const allRecords = await this.restaurantRepository.find();
    const toFix = allRecords.filter((r) => {
      if (!r.city || r.city.trim() === '') return true;
      return /^[\d\s\-]{3,10}$/.test(r.city.trim()) || /^\d{5}(-\d{4})?$/.test(r.city.trim());
    });

    this.logger.log(`resolvePostalCodeCities: ${toFix.length} records to fix`);
    let resolved = 0;
    let failed = 0;

    for (const record of toFix) {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${record.latitude}&lon=${record.longitude}&accept-language=en`;
        const res = await fetch(url, { headers: { 'User-Agent': 'HotelRestaurantScraperBackend/1.0' } });
        if (!res.ok) {
          failed++;
          continue;
        }
        const data: any = await res.json();
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || '';
        const country = addr.country || '';
        if (city) {
          record.city = city;
          if (country && !record.country) record.country = country;
          await this.restaurantRepository.save(record);
          resolved++;
        } else {
          failed++;
        }
        await new Promise((r) => setTimeout(r, 1100));
      } catch {
        failed++;
      }
    }

    await this.deduplicateDatabase();
    this.logger.log(`resolvePostalCodeCities: resolved=${resolved}, failed=${failed}`);
    return { resolved, failed };
  }

  /**
   * Upgrade scraping level for existing records:
   */
  async upgradeScrapingLevel(targetLevel: 'intermediate' | 'advanced'): Promise<{ queued: number }> {
    const levelsToUpgrade: string[] = targetLevel === 'advanced' ? ['basic', 'intermediate'] : ['basic'];

    const records = await this.restaurantRepository.find({
      where: { scrapingLevel: In(levelsToUpgrade) as any },
    });

    this.logger.log(`upgradeScrapingLevel: queuing ${records.length} records for re-scraping at '${targetLevel}' level`);

    setImmediate(async () => {
      for (const record of records) {
        try {
          this.logger.log(`Re-scraping '${record.name}' at ${targetLevel} level...`);
          const skipKeys = await this.getAdvancedKeys();
          const scraped = await this.scraperService.scrapeNearestRestaurants(record.latitude, record.longitude, 1, targetLevel, skipKeys);
          if (scraped && scraped.length > 0) {
            await this.upsertRestaurantsToDatabase([{ ...scraped[0], id: record.id, scrapingLevel: targetLevel }], targetLevel);
          }
          await new Promise((r) => setTimeout(r, 500));
        } catch (err: any) {
          this.logger.warn(`Failed to upgrade scraping for '${record.name}': ${err.message}`);
        }
      }
      this.logger.log(`upgradeScrapingLevel: done upgrading ${records.length} records to '${targetLevel}'.`);
    });

    return { queued: records.length };
  }
}
