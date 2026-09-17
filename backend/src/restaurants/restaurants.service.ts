import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SearchHistory } from './entities/search-history.entity';
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

@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);

  constructor(
    @InjectRepository(SearchHistory)
    private readonly searchHistoryRepository: Repository<SearchHistory>,
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

  async findNearestRestaurants(dto: SearchLocationDto): Promise<{ restaurants: RestaurantItem[]; source: string }> {
    const limit = dto.limit || 10;
    let restaurants: RestaurantItem[] = [];
    let source = 'google_maps_puppeteer_scraper';

    // 1. Attempt live Google Maps Web Scraping via Puppeteer (No API Key Required)
    try {
      const scraped = await this.scraperService.scrapeNearestRestaurants(dto.latitude, dto.longitude, limit);
      if (scraped && scraped.length > 0) {
        restaurants = scraped;
      }
    } catch (err: any) {
      this.logger.warn(`Puppeteer scraper encountered issue: ${err.message}. Using fallback data.`);
      source = 'fallback_demo_data';
    }

    // 2. Fallback rich sample data if scraping returns empty or hits network limit
    if (restaurants.length === 0) {
      source = 'demo_fallback_data';
      const sampleNames = [
        {
          name: 'The Golden Fork Bistro',
          placeType: 'Bistro',
          cuisines: ['Fine Dining', 'French', 'BBQ'],
          offsetLat: 0.002,
          offsetLng: 0.003,
          rating: 4.8,
          price: '$$$',
          img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80',
          phone: '+1 (555) 392-1049',
        },
        {
          name: 'Saffron Biryani & BBQ Hub',
          placeType: 'Restaurant',
          cuisines: ['Biryani', 'BBQ', 'Pakistani/Indian'],
          offsetLat: -0.003,
          offsetLng: 0.002,
          rating: 4.7,
          price: '$$',
          img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
          phone: '+1 (555) 849-3021',
        },
        {
          name: 'Bella Italia Trattoria & Cafe',
          placeType: 'Cafe',
          cuisines: ['Italian', 'Pasta', 'Espresso'],
          offsetLat: 0.004,
          offsetLng: -0.001,
          rating: 4.6,
          price: '$$',
          img: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&auto=format&fit=crop&q=80',
          phone: '+1 (555) 491-0394',
        },
        {
          name: 'Grand Horizon Luxury Hotel & Dining',
          placeType: 'Hotel',
          cuisines: ['International', 'Seafood', 'Continental'],
          offsetLat: -0.001,
          offsetLng: -0.004,
          rating: 4.9,
          price: '$$$$',
          img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80',
          phone: '+1 (555) 120-4930',
        },
        {
          name: 'El Mariachi Taco & Grill',
          placeType: 'Fast Food',
          cuisines: ['Mexican', 'Tacos', 'BBQ'],
          offsetLat: 0.005,
          offsetLng: 0.005,
          rating: 4.5,
          price: '$',
          img: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
          phone: '+1 (555) 902-1847',
        },
        {
          name: 'Sakura Japanese Ramen & Sushi Bar',
          placeType: 'Restaurant',
          cuisines: ['Japanese', 'Sushi', 'Ramen'],
          offsetLat: -0.004,
          offsetLng: -0.002,
          rating: 4.9,
          price: '$$$',
          img: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&auto=format&fit=crop&q=80',
          phone: '+1 (555) 403-9182',
        },
        {
          name: 'Le Petit Paris Artisan Bakery Cafe',
          placeType: 'Cafe',
          cuisines: ['Bakery', 'Coffee', 'Pastries'],
          offsetLat: 0.001,
          offsetLng: -0.005,
          rating: 4.8,
          price: '$$',
          img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop&q=80',
          phone: '+1 (555) 304-9281',
        },
        {
          name: 'Taj Lounge & Charcoal Grill',
          placeType: 'Restaurant',
          cuisines: ['BBQ', 'Biryani', 'Kebab'],
          offsetLat: -0.005,
          offsetLng: 0.004,
          rating: 4.6,
          price: '$$',
          img: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
          phone: '+1 (555) 501-9283',
        },
        {
          name: 'Green Garden Vegan Kitchen',
          placeType: 'Bistro',
          cuisines: ['Vegan', 'Healthy', 'Salads'],
          offsetLat: 0.003,
          offsetLng: -0.003,
          rating: 4.7,
          price: '$$',
          img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
          phone: '+1 (555) 609-2819',
        },
        {
          name: 'Ocean Breeze Seafood Hotel & Resort',
          placeType: 'Hotel',
          cuisines: ['Seafood', 'Grill', 'Cocktails'],
          offsetLat: -0.002,
          offsetLng: 0.006,
          rating: 4.8,
          price: '$$$$',
          img: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80',
          phone: '+1 (555) 710-9283',
        },
      ];

      restaurants = sampleNames.map((s, idx) => {
        const pLat = dto.latitude + s.offsetLat;
        const pLng = dto.longitude + s.offsetLng;
        const cleanName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return {
          id: `demo-res-${idx + 1}`,
          name: s.name,
          address: `${100 + idx * 12} Grand Avenue, Downtown`,
          city: 'Metropolis',
          country: 'United States',
          postalCode: `${10001 + idx}`,
          location: { latitude: pLat, longitude: pLng },
          rating: s.rating,
          userRatingCount: 120 + idx * 35,
          googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${pLat},${pLng}`,
          priceLevel: s.price,
          cuisine: s.cuisines[0],
          cuisineTypes: s.cuisines,
          placeType: s.placeType,
          phone: s.phone,
          email: `contact@${cleanName}.com`,
          website: `https://www.${cleanName}.com`,
          images: [
            s.img,
            'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&auto=format&fit=crop&q=80',
          ],
          openingHours: [
            'Monday: 11:00 AM – 10:30 PM',
            'Tuesday: 11:00 AM – 10:30 PM',
            'Wednesday: 11:00 AM – 10:30 PM',
            'Thursday: 11:00 AM – 11:00 PM',
            'Friday: 11:00 AM – 11:30 PM',
            'Saturday: 10:00 AM – 11:30 PM',
            'Sunday: 10:00 AM – 10:00 PM',
          ],
          isOpenNow: idx % 4 !== 0,
          distanceKm: this.calculateDistance(dto.latitude, dto.longitude, pLat, pLng),
        };
      });
    }

    // Sort by distance & apply limit
    restaurants.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    const topResults = restaurants.slice(0, limit);

    // Save search query into PostgreSQL search_history table
    try {
      const historyRecord = this.searchHistoryRepository.create({
        latitude: dto.latitude,
        longitude: dto.longitude,
        resultsCount: topResults.length,
        results: topResults,
      });
      await this.searchHistoryRepository.save(historyRecord);
    } catch (err) {
      this.logger.warn(`Could not save search history to PostgreSQL: ${err.message}. Proceeding without persistence.`);
    }

    return { restaurants: topResults, source };
  }

  async getSearchHistory(): Promise<SearchHistory[]> {
    try {
      return await this.searchHistoryRepository.find({
        order: { createdAt: 'DESC' },
        take: 10,
      });
    } catch (err) {
      this.logger.warn(`Failed to fetch search history: ${err.message}`);
      return [];
    }
  }
}
