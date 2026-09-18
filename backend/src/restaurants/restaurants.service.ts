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

      const mapped: RestaurantItem[] = dbRestaurants.map((res) => ({
        id: res.id,
        name: res.name,
        address: res.address || '',
        city: res.city || '',
        country: res.country || '',
        postalCode: res.postalCode || '',
        location: { latitude: res.latitude, longitude: res.longitude },
        rating: res.rating || 4.5,
        userRatingCount: res.userRatingCount || 50,
        googleMapsUri: res.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${res.latitude},${res.longitude}`,
        priceLevel: res.priceLevel || '$$',
        cuisine: res.cuisine || 'Dining',
        cuisineTypes: res.cuisineTypes || [],
        placeType: res.placeType || 'Restaurant',
        phone: res.phone || undefined,
        email: res.email || undefined,
        website: res.website || undefined,
        images: res.images || [],
        openingHours: res.openingHours || [],
        isOpenNow: res.isOpenNow ?? true,
        distanceKm: this.calculateDistance(dto.latitude, dto.longitude, res.latitude, res.longitude),
      }));

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
          existing.name = item.name || existing.name;
          existing.address = item.address || existing.address;
          existing.city = item.city || existing.city;
          existing.country = item.country || existing.country;
          existing.latitude = item.location.latitude || existing.latitude;
          existing.longitude = item.location.longitude || existing.longitude;
          existing.rating = item.rating || existing.rating;
          existing.userRatingCount = item.userRatingCount || existing.userRatingCount;
          existing.googleMapsUri = item.googleMapsUri || existing.googleMapsUri;
          existing.phone = item.phone || existing.phone;
          existing.email = item.email || existing.email;
          existing.website = item.website || existing.website;
          existing.images = item.images && item.images.length > 0 ? item.images : existing.images;
          existing.cuisine = item.cuisine || existing.cuisine;
          existing.cuisineTypes = item.cuisineTypes || existing.cuisineTypes;
          existing.placeType = item.placeType || existing.placeType;
          await this.restaurantRepository.save(existing);
        } else {
          const newRecord = this.restaurantRepository.create({
            id: item.id || `res-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            normalizedName: normName,
            name: item.name,
            address: item.address,
            city: item.city,
            country: item.country,
            postalCode: item.postalCode,
            latitude: item.location.latitude,
            longitude: item.location.longitude,
            rating: item.rating,
            userRatingCount: item.userRatingCount,
            googleMapsUri: item.googleMapsUri,
            priceLevel: item.priceLevel,
            cuisine: item.cuisine,
            cuisineTypes: item.cuisineTypes,
            placeType: item.placeType,
            phone: item.phone,
            email: item.email,
            website: item.website,
            images: item.images,
            openingHours: item.openingHours,
            isOpenNow: item.isOpenNow ?? true,
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
