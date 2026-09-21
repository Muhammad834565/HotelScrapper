import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SearchLocationDto } from './dto/search-location.dto';
import { GoogleMapsScraperService, ScrapedRestaurant } from './scraper.service';

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
}

import { RestaurantEntity } from './entities/restaurant.entity';

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

  /**
   * Fast DB lookup first:
   * 1. Query PostgreSQL for restaurants within ~15 km box around (latitude, longitude).
   * 2. If restaurants are found in DB, return them instantly (< 50ms) and trigger background scraping for new places.
   * 3. If DB is empty for this area, scrape live via Google Maps / OSM immediately, store in DB without duplicating, and return results.
   */
  async findNearestRestaurants(dto: SearchLocationDto): Promise<{ restaurants: RestaurantItem[]; source: string }> {
    const limit = dto.limit || 10;
    const radiusKm = (dto.radius || 5000) / 1000;
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((dto.latitude * Math.PI) / 180));

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

    if (dbRestaurants.length > 0) {
      this.logger.log(`⚡ Instant response: Found ${dbRestaurants.length} restaurants in PostgreSQL database.`);

      const mapped: RestaurantItem[] = dbRestaurants.map((res) => {
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
          distanceKm: this.calculateDistance(dto.latitude, dto.longitude, res.latitude, res.longitude),
          aboutSection: res.aboutSection || undefined,
          aboutKeywords: res.aboutKeywords?.length ? res.aboutKeywords : undefined,
          menuData: res.menuData?.length ? res.menuData : undefined,
        };
      });

      mapped.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
      const topResults = mapped.slice(0, limit);

      // Trigger non-blocking background refresh/scrape to find any new restaurants
      this.saveAndScrapeInBackground(dto.latitude, dto.longitude, limit);

      return { restaurants: topResults, source: 'postgresql_database' };
    }

    // 2. If DB has no cached records for this location, execute live scraping
    this.logger.log(`🔍 No cached DB results for location (${dto.latitude}, ${dto.longitude}). Scraping live data...`);
    let restaurants: RestaurantItem[] = [];
    let source = 'google_maps_puppeteer_scraper';

    try {
      const scraped = await this.scraperService.scrapeNearestRestaurants(dto.latitude, dto.longitude, limit);
      if (scraped && scraped.length > 0) {
        restaurants = scraped;
      }
    } catch (err: any) {
      this.logger.warn(`Live scraper error: ${err.message}`);
      source = 'fallback_demo_data';
    }

    // Save/upsert new scraped restaurants into PostgreSQL database without duplicates
    await this.upsertRestaurantsToDatabase(restaurants);

    // Sort by distance & apply limit
    restaurants.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    const topResults = restaurants.slice(0, limit);

    return { restaurants: topResults, source };
  }

  /**
   * Upsert scraped restaurants into PostgreSQL `restaurants` table.
   * Deduplicates by `normalizedName` (e.g. "chairotirestaurant").
   */
  private async upsertRestaurantsToDatabase(items: RestaurantItem[]): Promise<void> {
    if (!items || items.length === 0) return;
    try {
      for (const item of items) {
        const normName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!normName) continue;

        // Query by ID, normalized name, OR exact latitude & longitude coordinates
        let existing = await this.restaurantRepository.findOne({
          where: [
            { id: item.id },
            { normalizedName: normName },
            {
              latitude: item.location.latitude,
              longitude: item.location.longitude,
            },
          ],
        });

        if (existing) {
          // Only overwrite with new value if it is a real non-empty value
          if (item.name) existing.name = item.name;
          if (item.address && item.address.trim()) existing.address = item.address;
          if (item.city && item.city.trim()) existing.city = item.city;
          if (item.country && item.country.trim()) existing.country = item.country;
          if (item.location.latitude) existing.latitude = item.location.latitude;
          if (item.location.longitude) existing.longitude = item.location.longitude;
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
          // Only overwrite About data if the new scrape actually found real categories
          if (item.aboutSection && Object.keys(item.aboutSection).length > 0) existing.aboutSection = item.aboutSection;
          if (item.aboutKeywords && item.aboutKeywords.length > 0) existing.aboutKeywords = item.aboutKeywords;
          if (item.menuData && item.menuData.length > 0) existing.menuData = item.menuData;
          await this.restaurantRepository.save(existing);
        } else {
          const newRecord = this.restaurantRepository.create({
            id: item.id || `res-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            normalizedName: normName,
            name: item.name,
            address: item.address && item.address.trim() ? item.address : undefined,
            city: item.city && item.city.trim() ? item.city : undefined,
            country: item.country && item.country.trim() ? item.country : undefined,
            postalCode: item.postalCode && item.postalCode.trim() ? item.postalCode : undefined,
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
            // null = unknown, true/false = actual scraped status
            isOpenNow: item.isOpenNow ?? null,
            aboutSection: item.aboutSection && Object.keys(item.aboutSection).length > 0 ? item.aboutSection : undefined,
            aboutKeywords: item.aboutKeywords?.length ? item.aboutKeywords : undefined,
            menuData: item.menuData?.length ? item.menuData : undefined,
          });
          await this.restaurantRepository.save(newRecord);
        }
      }
      this.logger.log(`💾 Synchronized ${items.length} restaurants into PostgreSQL database.`);
    } catch (err: any) {
      this.logger.warn(`Failed to upsert restaurants to PostgreSQL: ${err.message}`);
    }
  }

  /**
   * Non-blocking background scraping task.
   */
  private saveAndScrapeInBackground(latitude: number, longitude: number, limit: number): void {
    setImmediate(async () => {
      try {
        this.logger.log(`🔄 Background refresh: Checking for new restaurants near (${latitude}, ${longitude})...`);
        const newScraped = await this.scraperService.scrapeNearestRestaurants(latitude, longitude, limit);
        if (newScraped && newScraped.length > 0) {
          await this.upsertRestaurantsToDatabase(newScraped);
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
}
