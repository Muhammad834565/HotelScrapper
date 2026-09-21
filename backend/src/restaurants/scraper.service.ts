import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

export type ScrapingMode = 'basic' | 'intermediate' | 'advanced';

export interface ScrapedRestaurant {
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

@Injectable()
export class GoogleMapsScraperService {
  private readonly logger = new Logger(GoogleMapsScraperService.name);
  private isScrapingBusy = false; // kept for backward compat (unused now)
  private activeSlots = 0;
  private readonly MAX_CONCURRENT_SCRAPES = 5; // run up to 5 restaurants in parallel
  private sharedBrowser: puppeteer.Browser | null = null;
  private browserUseCount = 0;
  private readonly BROWSER_RECYCLE_AFTER = 20; // recycle browser every N scrapes to avoid memory leaks

  private async getOrCreateBrowser(): Promise<puppeteer.Browser> {
    if (this.sharedBrowser && this.sharedBrowser.connected && this.browserUseCount < this.BROWSER_RECYCLE_AFTER) {
      this.browserUseCount++;
      return this.sharedBrowser;
    }
    // Close old browser if exists
    if (this.sharedBrowser) {
      await this.sharedBrowser.close().catch(() => {});
      this.sharedBrowser = null;
    }
    const browserArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--lang=en-US,en',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1280,900',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
    ];
    try {
      this.sharedBrowser = await puppeteer.launch({ headless: true, args: browserArgs });
    } catch {
      try {
        this.sharedBrowser = await puppeteer.launch({ headless: true, channel: 'chrome', args: browserArgs });
      } catch {
        this.sharedBrowser = await puppeteer.launch({ headless: true, channel: 'msedge' as any, args: browserArgs });
      }
    }
    this.browserUseCount = 1;
    return this.sharedBrowser;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
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

  private getCuisineImage(name: string, placeType: string, cuisines: string[]): string | undefined {
    const n = name.toLowerCase();
    const c = cuisines.join(' ').toLowerCase();
    if (n.includes('chai') || n.includes('doodh patti') || n.includes('karak'))
      return 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80';
    if (n.includes('roti') || n.includes('paratha') || n.includes('naan') || n.includes('halwa puri'))
      return 'https://images.unsplash.com/photo-1601050690293-5c7f5e8b0b1e?w=600&auto=format&fit=crop&q=80';
    if (n.includes('nihari') || n.includes('paya') || c.includes('nihari'))
      return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80';
    if (n.includes('biryani') || c.includes('biryani'))
      return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80';
    if (n.includes('karahi') || n.includes('tikka') || n.includes('seekh') || c.includes('karahi'))
      return 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&auto=format&fit=crop&q=80';
    if (n.includes('bbq') || n.includes('barbecue') || n.includes('grill') || c.includes('bbq'))
      return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80';
    if (n.includes('burger') || c.includes('burger') || c.includes('american'))
      return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80';
    if (n.includes('pizza') || n.includes('pasta') || n.includes('italia') || c.includes('italian'))
      return 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&auto=format&fit=crop&q=80';
    if (n.includes('sushi') || n.includes('ramen') || n.includes('japanese') || c.includes('japanese'))
      return 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80';
    if (n.includes('chinese') || n.includes('noodle') || c.includes('chinese'))
      return 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=600&auto=format&fit=crop&q=80';
    if (n.includes('seafood') || n.includes('fish') || c.includes('seafood'))
      return 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&auto=format&fit=crop&q=80';
    if (placeType === 'Cafe' || n.includes('cafe') || n.includes('coffee'))
      return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80';
    if (placeType === 'Bakery' || n.includes('bakery') || n.includes('bread'))
      return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80';
    if (placeType === 'Hotel')
      return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop&q=80';
    if (n.includes('ice cream') || n.includes('dessert') || n.includes('sweet'))
      return 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&auto=format&fit=crop&q=80';
    if (n.includes('shawarma') || n.includes('wrap') || n.includes('arabic') || c.includes('arabic'))
      return 'https://images.unsplash.com/photo-1561651823-34feb02250e4?w=600&auto=format&fit=crop&q=80';
    if (n.includes('chaat') || n.includes('samosa') || n.includes('gol gappa'))
      return 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80';
    return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80';
  }

  private async scrapeDetailPage(
    page: puppeteer.Page,
    detailUrl: string,
  ): Promise<{
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    website?: string;
    openingHours?: string[];
    isOpenNow?: boolean;
    aboutSection?: Record<string, string[]>;
    aboutKeywords?: string[];
    images?: string[];
    coordLat?: number;
    coordLng?: number;
  }> {
    try {
      await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForSelector('[data-item-id], .rogA2c, .DUwDvf', { timeout: 5000 }).catch(() => { });
      await new Promise((r) => setTimeout(r, 600));

      const data = await page.evaluate(() => {
        const result: any = {};

        const urlMatch = window.location.href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        if (urlMatch) {
          result.coordLat = parseFloat(urlMatch[1]);
          result.coordLng = parseFloat(urlMatch[2]);
        }

        // Phone
        const phoneEl = document.querySelector('[data-item-id^="phone:tel:"]') as HTMLElement | null;
        if (phoneEl) {
          const phoneAttr = phoneEl.getAttribute('data-item-id') || '';
          const phoneNum = phoneAttr.replace('phone:tel:', '').trim();
          if (phoneNum) result.phone = phoneNum;
        }
        if (!result.phone) {
          const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]')) as HTMLAnchorElement[];
          if (telLinks.length > 0) {
            result.phone = telLinks[0].href.replace('tel:', '').trim();
          }
        }

        // Address
        const addrEl = document.querySelector('[data-item-id="address"]') as HTMLElement | null;
        if (addrEl) result.address = addrEl.textContent?.trim() || undefined;
        if (!result.address) {
          const addrBtn = Array.from(document.querySelectorAll('button[aria-label*="ddress"]')) as HTMLButtonElement[];
          if (addrBtn.length > 0) {
            result.address = addrBtn[0].getAttribute('aria-label')?.replace(/^Address:\s*/i, '').trim() || undefined;
          }
        }

        // Website
        const webEl = document.querySelector('[data-item-id="authority"]') as HTMLAnchorElement | null;
        if (webEl && webEl.href && !webEl.href.includes('google.com/maps')) {
          result.website = webEl.href;
        }
        if (!result.website) {
          const webLinks = Array.from(document.querySelectorAll('a[data-item-id^="authority"], a[aria-label*="ebsite"]')) as HTMLAnchorElement[];
          for (const a of webLinks) {
            if (a.href && !a.href.includes('google.com/maps') && !a.href.startsWith('tel:')) {
              result.website = a.href;
              break;
            }
          }
        }

        // Opening Hours
        const hours: string[] = [];
        const hoursTable = document.querySelectorAll('.mxowUb tr, table.eK4R0e tr');
        if (hoursTable.length > 0) {
          hoursTable.forEach((row) => {
            const day = row.querySelector('td:first-child, th')?.textContent?.trim();
            const time = row.querySelector('td:last-child, td:nth-child(2)')?.textContent?.trim();
            if (day && time && day !== time) hours.push(day + ': ' + time);
          });
        }
        if (hours.length === 0) {
          const hoursRegion = document.querySelector('[aria-label*="Monday"], [aria-label*="Tuesday"], .y0skZc') as HTMLElement | null;
          if (hoursRegion) {
            const label = hoursRegion.getAttribute('aria-label') || '';
            const dayPattern = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,:]?\s*([^.]+)/gi;
            let m;
            while ((m = dayPattern.exec(label)) !== null) {
              hours.push(m[1] + ': ' + m[2].trim());
            }
          }
        }
        if (hours.length > 0) result.openingHours = hours;

        const openStatusEl = document.querySelector('.ZDu9vd span, [aria-label*="Open now"], [aria-label*="Closed"]') as HTMLElement | null;
        if (openStatusEl) {
          const statusText = (openStatusEl.textContent || openStatusEl.getAttribute('aria-label') || '').toLowerCase();
          result.isOpenNow = !statusText.includes('closed');
        }

        const imgEls = Array.from(document.querySelectorAll('img[src*="googleusercontent"], img[src*="lh3.google"]')) as HTMLImageElement[];
        const imgs: string[] = [];
        imgEls.forEach((img) => {
          if (img.src && !img.src.includes('data:image') && !imgs.includes(img.src) && imgs.length < 5) {
            imgs.push(img.src);
          }
        });
        if (imgs.length > 0) result.images = imgs;

        return result;
      });

      if (data.address && data.address.includes(',')) {
        const parts = (data.address as string).split(',').map((p: string) => p.trim()).filter(Boolean);
        if (parts.length >= 3) {
          (data as any).country = parts[parts.length - 1];
          (data as any).city = parts[parts.length - 2];
        } else if (parts.length === 2) {
          (data as any).city = parts[parts.length - 1];
        }
      }

      // --- TAB SCRAPING: Click About and Menu tabs ---

      // 1. Click "About" tab
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('button[role="tab"], .G6fVbb, .hh2c6'));
        const aboutTab = tabs.find(t => t.textContent?.toLowerCase().includes('about'));
        if (aboutTab) (aboutTab as HTMLElement).click();
      });
      // Wait for tab transition and about section content to render
      await new Promise(r => setTimeout(r, 1200));

      // Scroll the main panel to load lazy items
      await page.evaluate(() => {
        const panels = Array.from(document.querySelectorAll('div[role="main"], .m6QErb'));
        for (const panel of panels) {
          panel.scrollTop = panel.scrollHeight;
        }
      });
      await new Promise(r => setTimeout(r, 600));

      const aboutExtracted = await page.evaluate(() => {
        const aboutSection: Record<string, string[]> = {};

        const knownCategories = [
          'Accessibility', 'Service options', 'Highlights', 'Popular for',
          'Offerings', 'Dining options', 'Amenities', 'Atmosphere',
          'Crowd', 'Planning', 'Payments', 'Children', 'Parking'
        ];

        // 1. Try finding all category titles by standard classes
        const titleEls = Array.from(document.querySelectorAll('.fontTitleSmall, h2, h3, .fontTitleMedium'));

        // 2. Also try finding elements that exactly match our known categories text (as a fallback for class name changes)
        const allSpansAndDivs = Array.from(document.querySelectorAll('span, div'));
        allSpansAndDivs.forEach(el => {
          const text = el.textContent?.trim();
          if (text && knownCategories.includes(text) && el.childElementCount === 0) {
            if (!titleEls.includes(el as Element)) titleEls.push(el as Element);
          }
        });

        for (const titleEl of titleEls) {
          const catName = titleEl.textContent?.trim();
          if (!catName || catName.length < 3 || catName.length > 40) continue;

          // CRITICAL: Strictly require the category to be known to prevent scraping 
          // Overview tab headers if the About tab click fails or is missing.
          if (!knownCategories.includes(catName)) continue;

          const tags: string[] = [];
          // Google Maps usually places items inside a parent or grandparent container
          let container = titleEl.parentElement;
          for (let i = 0; i < 5; i++) { // Walk up to 5 levels
            if (!container) break;

            // Find all items inside this container
            const itemEls = Array.from(container.querySelectorAll('li, .fontBodyMedium'));

            itemEls.forEach(el => {
              // Make sure the item is not the header itself or a parent of it
              if (el === titleEl || el.contains(titleEl)) return;

              let text = el.textContent?.trim() || '';

              // Try to extract text from the deepest/last span to avoid icon texts
              const spans = Array.from(el.querySelectorAll('span:not(:empty)'));
              if (spans.length > 0) {
                const lastSpan = spans[spans.length - 1];
                if (lastSpan.textContent) {
                  text = lastSpan.textContent.trim();
                }
              }

              // Strip private use unicode characters (Material Icons)
              text = text.replace(/[\uE000-\uF8FF]/g, '').trim();

              if (text && text.length > 1 && text !== catName && !knownCategories.includes(text)) {
                // Filter out generic map tools text
                if (!['Travel time', 'Measure', 'Default', 'Satellite'].includes(text)) {
                  if (!tags.includes(text)) tags.push(text);
                }
              }
            });

            if (tags.length > 0) {
              break;
            }
            container = container.parentElement;
          }

          if (tags.length > 0) {
            aboutSection[catName] = tags;
          }
        }

        // 3. Fallback to aria-label parsing
        if (Object.keys(aboutSection).length === 0) {
          const allItems = Array.from(document.querySelectorAll('[aria-label]')) as HTMLElement[];
          for (const el of allItems) {
            const label = el.getAttribute('aria-label') || '';
            const colonMatch = label.match(/^([A-Z][A-Za-z\s]{2,30}):\s*(.+)$/);
            if (colonMatch) {
              const cat = colonMatch[1].trim();

              // CRITICAL: Only accept strictly known categories to prevent Map UI pollution
              if (!knownCategories.includes(cat)) continue;

              const tagsRaw = colonMatch[2].split(/[,;]+/).map(t => t.trim()).filter(t => t.length > 1);
              if (tagsRaw.length > 0) {
                if (!aboutSection[cat]) aboutSection[cat] = [];
                tagsRaw.forEach(t => {
                  let cleaned = t.replace(/[\uE000-\uF8FF]/g, '').trim();
                  if (cleaned && !aboutSection[cat].includes(cleaned)) aboutSection[cat].push(cleaned);
                });
              }
            }
          }
        }

        return aboutSection;
      });

      if (Object.keys(aboutExtracted).length > 0) {
        data.aboutSection = aboutExtracted;
        const keywordsSet = new Set<string>();
        Object.values(aboutExtracted).forEach((tags: any) => tags.forEach((t: string) => keywordsSet.add(t)));
        data.aboutKeywords = Array.from(keywordsSet);
      }

      // 2. Click "Menu" tab
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('button[role="tab"], .G6fVbb'));
        const menuTab = tabs.find(t => t.textContent?.toLowerCase().includes('menu'));
        if (menuTab) (menuTab as HTMLElement).click();
      });
      await new Promise(r => setTimeout(r, 800));

      const menuExtracted = await page.evaluate(() => {
        const items: any[] = [];
        const tryExtract = (container: Element) => {
          const nameEl = container.querySelector('.fontHeadlineSmall, [class*="title"], h3');
          const descEl = container.querySelector('.fontBodyMedium, [class*="desc"]');
          const priceEl = container.querySelector('.fontBodyMedium, [class*="price"]');
          const imgEl = container.querySelector('img');

          const name = nameEl?.textContent?.trim() || container.textContent?.split('\n')[0]?.trim();
          if (!name || name.length < 2 || name.length > 50) return null;

          const fullText = container.textContent || '';
          const priceMatch = fullText.match(/(\$|Rs|PKR|£|€)?\s*\d+(\.\d{2})?/i);
          const price = priceMatch ? priceMatch[0] : undefined;

          return {
            name,
            description: descEl?.textContent?.trim() || undefined,
            price,
            photoUrl: imgEl?.src || undefined
          };
        };

        const seenNames = new Set();
        document.querySelectorAll('.fontHeadlineSmall').forEach(el => {
          const parent = el.closest('div[role="button"]') || el.parentElement?.parentElement;
          if (parent) {
            const item = tryExtract(parent);
            if (item && item.name && !seenNames.has(item.name)) {
              seenNames.add(item.name);
              items.push(item);
            }
          }
        });

        return items;
      });

      if (menuExtracted && menuExtracted.length > 0) {
        data.menuData = menuExtracted;
      }

      return data;
    } catch (err: any) {
      this.logger.warn('Detail page scrape failed for ' + detailUrl + ': ' + err.message);
      return {};
    }
  }

  async fetchOsmRestaurants(latitude: number, longitude: number, radiusMeters: number = 8000, limit: number = 50): Promise<ScrapedRestaurant[]> {
    this.logger.log('Querying OSM Overpass API for Lat: ' + latitude + ', Lng: ' + longitude);
    const query = '[out:json][timeout:20];(node["amenity"="restaurant"](around:' + radiusMeters + ',' + latitude + ',' + longitude + ');node["amenity"="fast_food"](around:' + radiusMeters + ',' + latitude + ',' + longitude + ');node["amenity"="cafe"](around:' + radiusMeters + ',' + latitude + ',' + longitude + '););out ' + Math.max(limit * 3, 60) + ';';
    /*const overpassEndpoints: string[] = [
      'https://overpass-api.de/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];*/
    const overpassEndpoints: string[] = [];

    for (const endpoint of overpassEndpoints) {
      try {
        const res = await axios.post(endpoint, 'data=' + encodeURIComponent(query), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'User-Agent': 'HotelRestaurantScraper/1.0' },
          timeout: 22000,
        });
        const nodes = res.data?.elements || [];
        if (nodes.length === 0) continue;
        const results: ScrapedRestaurant[] = nodes
          .filter((node: any) => node.tags?.name)
          .slice(0, limit)
          .map((node: any) => {
            const tags = node.tags || {};
            const cuisines = (tags.cuisine || '').split(';').map((c: string) => c.trim()).filter(Boolean);
            return {
              id: 'osm-' + node.id,
              name: tags.name,
              address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ') || 'Local Area',
              city: tags['addr:city'] || '',
              country: tags['addr:country'] || '',
              postalCode: tags['addr:postcode'] || '',
              location: { latitude: node.lat, longitude: node.lon },
              googleMapsUri: 'https://www.google.com/maps/search/?api=1&query=' + node.lat + ',' + node.lon,
              cuisine: cuisines[0] || 'Restaurant',
              cuisineTypes: cuisines.length > 0 ? cuisines : ['Restaurant'],
              placeType: tags.amenity === 'cafe' ? 'Cafe' : 'Restaurant',
              phone: tags.phone || tags['contact:phone'] || undefined,
              website: tags.website || tags['contact:website'] || undefined,
              openingHours: tags.opening_hours ? [tags.opening_hours] : undefined,
              distanceKm: this.calculateDistance(latitude, longitude, node.lat, node.lon),
            };
          });
        return results;
      } catch (err: any) {
        this.logger.warn('OSM endpoint failed: ' + err.message);
      }
    }
    return [];
  }

  async fetchNominatimRestaurants(latitude: number, longitude: number, limit: number = 20): Promise<ScrapedRestaurant[]> {
    this.logger.log('Querying Nominatim for Lat: ' + latitude + ', Lng: ' + longitude);
    try {
      const res = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q: 'restaurant', lat: latitude, lon: longitude, format: 'json', limit: limit * 2, addressdetails: 1, extratags: 1 },
        headers: { 'User-Agent': 'HotelRestaurantScraper/1.0' },
        timeout: 10000,
      });
      const items = res.data || [];
      const results: ScrapedRestaurant[] = [];
      items.forEach((item: any) => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const addr = item.address || {};
        const dist = this.calculateDistance(latitude, longitude, lat, lon);
        if (dist <= 10) {
          results.push({
            id: 'nom-' + item.place_id,
            name: item.name || item.display_name?.split(',')[0] || 'Restaurant',
            address: [addr.road, addr.house_number].filter(Boolean).join(' ') || item.display_name?.split(',').slice(0, 2).join(', ') || 'Local Area',
            city: addr.city || addr.town || addr.village || addr.suburb || '',
            country: addr.country || '',
            postalCode: addr.postcode || '',
            location: { latitude: lat, longitude: lon },
            googleMapsUri: 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lon,
            cuisine: item.extratags?.cuisine || 'Restaurant',
            cuisineTypes: item.extratags?.cuisine ? [item.extratags.cuisine] : ['Restaurant'],
            placeType: item.type === 'cafe' ? 'Cafe' : 'Restaurant',
            phone: item.extratags?.phone || item.extratags?.['contact:phone'] || undefined,
            website: item.extratags?.website || item.extratags?.['contact:website'] || undefined,
            distanceKm: dist,
          });
        }
      });
      results.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
      return results.slice(0, limit);
    } catch (err: any) {
      this.logger.warn('Nominatim search failed: ' + err.message);
      return [];
    }
  }

  /**
   * Load Google session cookies from cookies.json (for advanced mode).
   * Export from Chrome: DevTools → Application → Cookies → right-click → Copy all as JSON.
   */
  private loadGoogleCookies(): puppeteer.CookieParam[] {
    try {
      const cookiePath = path.join(process.cwd(), 'cookies.json');
      if (!fs.existsSync(cookiePath)) return [];
      const raw = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
      return (Array.isArray(raw) ? raw : []).map((c: any) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || '.google.com',
        path: c.path || '/',
        secure: c.secure ?? true,
        httpOnly: c.httpOnly ?? false,
        sameSite: c.sameSite ?? 'None',
      }));
    } catch {
      return [];
    }
  }

  async scrapeGoogleMaps(
    latitude: number,
    longitude: number,
    limit: number = 50,
    mode: ScrapingMode = 'intermediate',
    skipAdvancedKeys: Set<string> = new Set(),
    targetName?: string,
  ): Promise<ScrapedRestaurant[]> {
    // Semaphore: wait if already at max concurrent scrapes
    while (this.activeSlots >= this.MAX_CONCURRENT_SCRAPES) {
      await new Promise((r) => setTimeout(r, 200));
    }
    this.activeSlots++;

    this.logger.log(`Launching Puppeteer [mode=${mode}] for Google Maps near Lat: ${latitude}, Lng: ${longitude}${targetName ? ` [Target: ${targetName}]` : ''}`);
    let browser: puppeteer.Browser | null = null;
    const results: ScrapedRestaurant[] = [];

    try {
      browser = await this.getOrCreateBrowser();

      const listPage = await browser.newPage();
      await listPage.setViewport({ width: 1280, height: 900 });
      await listPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
      // Hide automation fingerprint so Google doesn't treat us as a headless bot
      await listPage.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        (window as any).chrome = { runtime: {} };
      });

      const queryTerm = targetName ? encodeURIComponent(targetName) : 'restaurants';
      const searchUrl = 'https://www.google.com/maps/search/' + queryTerm + '/@' + latitude + ',' + longitude + ',14z?hl=en';

      try {
        await listPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await new Promise((r) => setTimeout(r, 1000));


        // ---- Inject stored Google session cookies ONLY for advanced mode ----
        if (mode === 'advanced') {
          const cookies = this.loadGoogleCookies();
          if (cookies.length > 0) {
            await listPage.setCookie(...cookies);
            this.logger.log(`Advanced mode: injected ${cookies.length} Google session cookies.`);
            await listPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
            await new Promise((r) => setTimeout(r, 600));
          } else {
            this.logger.warn('Advanced mode: cookies.json not found or empty — falling back to guest scraping. Export your Google cookies to backend/cookies.json.');
          }
        } else {
          this.logger.log(`${mode} mode: running as guest (no cookies injected).`);
        }

        // ---- Dismiss any blocking overlays in a single fast JS pass ----
        try {
          await listPage.evaluate(() => {
            const selectors = [
              'button[aria-label*="Accept all"]',
              'button[aria-label*="Accept"]',
              'form[action*="consent"] button',
              'button[jsname="higCR"]',
              '.VfPpkd-LgbsSe[jsname="b3VHJd"]',
              'button[aria-label*="No thanks"]',
              'button[aria-label*="Use without an account"]',
              '[jsname="IVELnc"]',
            ];
            for (const sel of selectors) {
              const btn = document.querySelector(sel) as HTMLElement;
              if (btn) { btn.click(); break; }
            }
          });
        } catch { }

        // Wait for the actual result cards or a detail page title to render.
        // We do NOT wait for generic containers like .m6QErb or div[role="feed"] as they appear before data is fetched.
        try {
          await listPage.waitForSelector('div.Nv2PK, div[role="article"], h1.DUwDvf', { timeout: 15000 });
        } catch (e) {
          this.logger.warn(`Timeout waiting for list cards to render: ${e.message}`);
        }

        this.logger.log('Scrolling list to load all results...');
        await listPage.evaluate(async (targetCount: number) => {
          const feed = document.querySelector('div[role="feed"]') || document.querySelector('.m6QErb');
          if (!feed) return;
          let lastCount = 0;
          let noChangeRounds = 0;
          const maxRounds = Math.max(Math.ceil(targetCount / 2), 100);
          
          // Initial wait to ensure first render is fully complete before scrolling
          await new Promise(r => setTimeout(r, 1000));

          for (let round = 0; round < maxRounds; round++) {
            feed.scrollBy(0, 2000);
            await new Promise((r) => setTimeout(r, 250));
            const endEl = document.querySelector('.HlvSq, [jsaction*="pane.resultend"]');
            if (endEl) break;
            const currentCount = document.querySelectorAll('div.Nv2PK, div[role="article"]').length;
            if (currentCount >= targetCount) break;
            if (currentCount === lastCount) { noChangeRounds++; if (noChangeRounds >= 5) break; } else { noChangeRounds = 0; }
            lastCount = currentCount;
          }
        }, limit);


        await new Promise((r) => setTimeout(r, 1000));

        const cardData = await listPage.evaluate((userLat: number, userLng: number) => {
          // If Google Maps directly navigated to a detail page (exact match redirect), handle it.
          const detailTitle = document.querySelector('h1.DUwDvf');
          if (detailTitle && detailTitle.textContent) {
            const name = detailTitle.textContent.trim();
            const href = window.location.href;
            let itemLat = userLat, itemLng = userLng;
            const coordMatch = href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
            if (coordMatch) { itemLat = parseFloat(coordMatch[1]); itemLng = parseFloat(coordMatch[2]); }

            let rating: number | undefined;
            const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]');
            if (ratingEl) rating = parseFloat(ratingEl.textContent || '');

            let userRatingCount: number | undefined;
            const countEl = document.querySelector('div.F7nice span[aria-label*="reviews"]');
            if (countEl) { const t = (countEl.textContent || '').replace(/[^0-9]/g, ''); if (t) userRatingCount = parseInt(t, 10); }
            
            const categoryEl = document.querySelector('button.DkEaL');
            const categoryText = categoryEl?.textContent?.trim() || 'Restaurant';

            return [{
              id: 'gmap-' + Math.random().toString(36).substr(2, 9),
              name,
              detailUrl: href,
              location: { latitude: itemLat, longitude: itemLng },
              rating, userRatingCount,
              googleMapsUri: href,
              priceLevel: undefined,
              cuisine: categoryText,
              cuisineTypes: [categoryText],
              placeType: 'Restaurant',
              images: []
            }];
          }

          const cards = Array.from(document.querySelectorAll('div.Nv2PK, div[role="article"]'));
          const list: any[] = [];
          cards.forEach((card) => {
            const titleEl = card.querySelector('.qBF1Pd') || card.querySelector('.fontHeadlineSmall') || card.querySelector('[class*="fontHeadline"]');
            const name = titleEl?.textContent?.trim();
            if (!name || name.length < 2) return;
            const linkEl = card.querySelector('a[href*="/maps/place/"]') as HTMLAnchorElement | null;
            const href = linkEl?.href;
            if (!href) return;

            let rating: number | undefined;
            const ratingEl = card.querySelector('span.MW450d, span.ceS6Rf, [role="img"][aria-label*="star"]');
            if (ratingEl) { const m = (ratingEl.getAttribute('aria-label') || ratingEl.textContent || '').match(/([0-9]\.[0-9])/); if (m) rating = parseFloat(m[1]); }

            let userRatingCount: number | undefined;
            const countEl = card.querySelector('span.UY7F9, span[aria-label*="reviews"]');
            if (countEl) { const t = (countEl.textContent || '').replace(/[^0-9]/g, ''); if (t) userRatingCount = parseInt(t, 10); }

            const categoryEl = card.querySelector('.W4Efsd span:first-child, div.fontBodyMedium span:first-child');
            const categoryText = categoryEl?.textContent?.trim() || '';

            let imgUrl: string | undefined;
            const imgEl = card.querySelector('img[src*="googleusercontent"], img[src*="lh3.google"]') as HTMLImageElement | null;
            if (imgEl?.src && !imgEl.src.includes('data:image')) imgUrl = imgEl.src;

            let itemLat = userLat, itemLng = userLng;
            const coordMatch = href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
            if (coordMatch) { itemLat = parseFloat(coordMatch[1]); itemLng = parseFloat(coordMatch[2]); }

            const lowerName = name.toLowerCase();
            const lowerCat = categoryText.toLowerCase();
            let placeType = 'Restaurant';
            if (lowerName.includes('cafe') || lowerCat.includes('cafe')) placeType = 'Cafe';
            else if (lowerName.includes('hotel') || lowerCat.includes('hotel')) placeType = 'Hotel';
            else if (lowerName.includes('bakery') || lowerCat.includes('bakery')) placeType = 'Bakery';

            const cuisines: string[] = [];
            if (lowerName.includes('chai') || lowerName.includes('doodh')) cuisines.push('Chai / Tea');
            if (lowerName.includes('roti') || lowerName.includes('paratha') || lowerName.includes('naan')) cuisines.push('Roti / Bread');
            if (lowerName.includes('nihari') || lowerName.includes('paya')) cuisines.push('Nihari');
            if (lowerName.includes('biryani') || lowerName.includes('briyani') || lowerCat.includes('biryani')) cuisines.push('Biryani');
            if (lowerName.includes('karahi') || lowerName.includes('handi') || lowerCat.includes('karahi')) cuisines.push('Karahi');
            if (lowerName.includes('tikka') || lowerName.includes('seekh') || lowerName.includes('tandoori')) cuisines.push('BBQ / Tikka');
            if (lowerName.includes('pakwan') || lowerName.includes('halwa') || lowerCat.includes('pakistani')) cuisines.push('Pakistani');
            if (lowerName.includes('chaat') || lowerName.includes('samosa')) cuisines.push('Street Food');
            if (lowerName.includes('shawarma') || lowerCat.includes('arabic')) cuisines.push('Shawarma / Arabic');
            if (lowerName.includes('bbq') || lowerName.includes('grill') || lowerCat.includes('bbq')) cuisines.push('BBQ');
            if (lowerName.includes('pizza') || lowerName.includes('pasta') || lowerCat.includes('italian')) cuisines.push('Italian');
            if (lowerName.includes('burger') || lowerCat.includes('burger')) cuisines.push('Burgers');
            if (lowerName.includes('sushi') || lowerCat.includes('japanese')) cuisines.push('Japanese');
            if (lowerName.includes('chinese') || lowerName.includes('noodle') || lowerCat.includes('chinese')) cuisines.push('Chinese');
            if (lowerName.includes('seafood') || lowerName.includes('fish')) cuisines.push('Seafood');
            if (lowerName.includes('ice cream') || lowerName.includes('dessert')) cuisines.push('Desserts');
            if (cuisines.length === 0) cuisines.push(categoryText.split('·')[0].trim() || 'Restaurant');

            list.push({
              id: 'gmap-' + Math.random().toString(36).substr(2, 9),
              name, detailUrl: href,
              location: { latitude: itemLat, longitude: itemLng },
              rating, userRatingCount,
              googleMapsUri: href,
              priceLevel: categoryText.includes('$$$$') ? '$$$$' : categoryText.includes('$$$') ? '$$$' : categoryText.includes('$$') ? '$$' : categoryText.includes('$') ? '$' : undefined,
              cuisine: cuisines[0], cuisineTypes: cuisines, placeType,
              images: imgUrl ? [imgUrl] : [],
            });
          });
          return list;
        }, latitude, longitude);

        this.logger.log('Found ' + cardData.length + ' restaurant cards on list page');

        const detailPage = await browser.newPage();
        await detailPage.setViewport({ width: 1280, height: 900 });
        await detailPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await detailPage.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          (window as any).chrome = { runtime: {} };
        });
        // Track listPage so we can close it after

        const toProcess = cardData.slice(0, limit);

        // ---- Basic mode: skip detail-page visits, return list-card data only ----
        if (mode === 'basic') {
          this.logger.log('Basic mode: skipping detail pages, returning list-card data only.');
          for (const item of toProcess) {
            if (results.some((r) => r.name.toLowerCase() === item.name.toLowerCase())) continue;
            results.push({
              id: item.id,
              name: item.name,
              address: '',
              location: item.location,
              rating: item.rating,
              userRatingCount: item.userRatingCount,
              googleMapsUri: item.googleMapsUri,
              priceLevel: item.priceLevel,
              cuisine: item.cuisine,
              cuisineTypes: item.cuisineTypes,
              placeType: item.placeType,
              images: item.images?.length ? item.images : [this.getCuisineImage(item.name, item.placeType, item.cuisineTypes) || ''].filter(Boolean),
              distanceKm: this.calculateDistance(latitude, longitude, item.location.latitude, item.location.longitude),
            });
          }
        } else {
          // ---- Intermediate / Advanced: visit each detail page ----
          for (const item of toProcess) {
            const normName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');

            if (results.some((r) => r.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normName || (item.googleMapsUri && r.googleMapsUri === item.googleMapsUri))) {
              this.logger.log(`Skipping duplicate restaurant in list: ${item.name}`);
              continue;
            }

            // RULE: "once resturant are in advace donot scrabe again"
            if (skipAdvancedKeys.has(item.googleMapsUri || '') || skipAdvancedKeys.has(normName)) {
              this.logger.log(`🔒 Skip detail scrape for '${item.name}': already scraped at Advanced level in database.`);
              results.push({
                id: item.id,
                name: item.name,
                address: '',
                location: item.location,
                rating: item.rating,
                userRatingCount: item.userRatingCount,
                googleMapsUri: item.googleMapsUri,
                priceLevel: item.priceLevel,
                cuisine: item.cuisine,
                cuisineTypes: item.cuisineTypes,
                placeType: item.placeType,
                images: item.images?.length ? item.images : [this.getCuisineImage(item.name, item.placeType, item.cuisineTypes) || ''].filter(Boolean),
                distanceKm: this.calculateDistance(latitude, longitude, item.location.latitude, item.location.longitude),
              });
              continue;
            }

            this.logger.log('Scraping detail page for: ' + item.name);
            const detail = await this.scrapeDetailPage(detailPage, item.detailUrl);

            const restaurant: ScrapedRestaurant = {
              id: item.id,
              name: item.name,
              address: detail.address || '',
              city: (detail as any).city || '',
              country: (detail as any).country || '',
              location: {
                latitude: detail.coordLat || item.location.latitude,
                longitude: detail.coordLng || item.location.longitude,
              },
              rating: item.rating,
              userRatingCount: item.userRatingCount,
              googleMapsUri: item.googleMapsUri,
              priceLevel: item.priceLevel,
              cuisine: item.cuisine,
              cuisineTypes: item.cuisineTypes,
              placeType: item.placeType,
              phone: detail.phone,
              website: detail.website,
              openingHours: detail.openingHours,
              isOpenNow: detail.isOpenNow,
              aboutSection: detail.aboutSection,
              aboutKeywords: detail.aboutKeywords,
            };

            const detailImages = detail.images || [];
            const cardImages = item.images || [];
            const allImages = [...new Set([...detailImages, ...cardImages])].filter(Boolean);
            if (allImages.length > 0) {
              restaurant.images = allImages;
            } else {
              const fallbackImg = this.getCuisineImage(item.name, item.placeType, item.cuisineTypes);
              if (fallbackImg) restaurant.images = [fallbackImg];
            }

            restaurant.distanceKm = this.calculateDistance(latitude, longitude, restaurant.location.latitude, restaurant.location.longitude);
            results.push(restaurant);
          }
        } // end if/else basic vs intermediate/advanced

        await detailPage.close().catch(() => {});
        await listPage.close().catch(() => {});
      } catch (pageErr: any) {
        this.logger.warn('Google Maps scrape pass failed: ' + pageErr.message);
      }

      results.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    } finally {
      this.activeSlots = Math.max(0, this.activeSlots - 1);
      // Don't close sharedBrowser here — it's reused across scrapes
      // Only close the individual pages that were opened
    }

    this.logger.log('Google Maps scraper returning ' + results.length + ' restaurants');
    return results;
  }

  async scrapeNearestRestaurants(
    latitude: number,
    longitude: number,
    limit: number = 10,
    mode: ScrapingMode = 'intermediate',
    skipAdvancedKeys: Set<string> = new Set(),
    targetName?: string,
  ): Promise<ScrapedRestaurant[]> {
    this.logger.log(`Starting multi-engine search [mode=${mode}] for Lat: ${latitude}, Lng: ${longitude}, Limit: ${limit}${targetName ? ` [Target: ${targetName}]` : ''}`);

    // Targeted single restaurant upgrade: skip general OSM/Nominatim area search and query Google Maps directly
    if (targetName) {
      this.logger.log(`Targeted search for '${targetName}' — querying Google Maps directly.`);
      return await this.scrapeGoogleMaps(latitude, longitude, limit, mode, skipAdvancedKeys, targetName).catch(() => []);
    }

    // Basic mode: only use Google Maps list-page (fast, no OSM/Nominatim detail scraping)
    if (mode === 'basic') {
      const gmapResults = await this.scrapeGoogleMaps(latitude, longitude, limit, 'basic', skipAdvancedKeys, targetName).catch(() => []);
      const uniqueMap = new Map<string, ScrapedRestaurant>();
      gmapResults.forEach((item) => {
        const key = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (key && !uniqueMap.has(key)) uniqueMap.set(key, item);
      });
      const results = Array.from(uniqueMap.values());
      results.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
      this.logger.log(`Basic mode returning ${results.length} restaurants.`);
      return results;
    }

    // Intermediate / Advanced: full multi-engine scrape
    const [osmResults, nomResults, gmapResults] = await Promise.all([
      this.fetchOsmRestaurants(latitude, longitude, 10000, limit).catch(() => []),
      this.fetchNominatimRestaurants(latitude, longitude, limit).catch(() => []),
      this.scrapeGoogleMaps(latitude, longitude, limit, mode, skipAdvancedKeys, targetName).catch(() => []),
    ]);

    const combined = [...gmapResults, ...nomResults, ...osmResults];
    const uniqueMap = new Map<string, ScrapedRestaurant>();
    combined.forEach((item) => {
      const key = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (key && !uniqueMap.has(key)) uniqueMap.set(key, item);
    });
    const finalResults = Array.from(uniqueMap.values());
    finalResults.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    this.logger.log('Combined total ' + finalResults.length + ' restaurants for location (' + latitude + ', ' + longitude + ')');
    return finalResults;
  }
}
