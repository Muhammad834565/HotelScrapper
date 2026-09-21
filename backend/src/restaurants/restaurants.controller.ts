import {
  Controller, Post, Get, Patch, Delete,
  Body, Query, Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { SearchLocationDto } from './dto/search-location.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('restaurants')
@UseGuards(AuthGuard)
export class RestaurantsController {

  constructor(private readonly restaurantsService: RestaurantsService) { }

  // ─── Public endpoints ───────────────────────────────────────────────────

  @Post('nearby')
  @HttpCode(HttpStatus.OK)
  async getNearby(@Body() dto: SearchLocationDto) {
    return this.restaurantsService.findNearestRestaurants(dto);
  }

  @Get('geocode')
  async geocode(@Query('q') query: string) {
    return this.restaurantsService.geocodeLocation(query);
  }

  // ─── Admin endpoints ────────────────────────────────────────────────────

  /** GET /restaurants/admin/stats — Dashboard totals */
  @Get('admin/stats')
  async adminStats() {
    return this.restaurantsService.getAdminStats();
  }

  /** GET /restaurants/admin/cities — List of cities with restaurant counts */
  @Get('admin/cities')
  async adminCities() {
    return this.restaurantsService.getAdminCities();
  }

  /** GET /restaurants/admin/all?page=1&pageSize=50&search=... — Paginated list */
  @Get('admin/all')
  async adminAll(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '50',
    @Query('search') search?: string,
  ) {
    return this.restaurantsService.getAllRestaurants(
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(200, parseInt(pageSize, 10) || 50),
      search,
    );
  }


  /** POST /restaurants/admin/add — Manually add a restaurant */
  @Post('admin/add')
  @HttpCode(HttpStatus.CREATED)
  async adminAdd(@Body() body: any) {
    return this.restaurantsService.adminAddRestaurant(body);
  }

  /** PATCH /restaurants/admin/:id — Edit a restaurant */
  @Patch('admin/:id')
  async adminEdit(@Param('id') id: string, @Body() body: any) {
    return this.restaurantsService.adminEditRestaurant(id, body);
  }

  /** DELETE /restaurants/admin/:id — Delete a restaurant */
  @Delete('admin/:id')
  async adminDelete(@Param('id') id: string) {
    return this.restaurantsService.adminDeleteRestaurant(id);
  }

  /**
   * POST /restaurants/admin/resolve-cities
   * Finds records where city is missing or looks like a postal code,
   * reverse-geocodes them, and saves the real city name.
   */
  @Post('admin/resolve-cities')
  @HttpCode(HttpStatus.OK)
  async adminResolveCities() {
    return this.restaurantsService.resolvePostalCodeCities();
  }

  /**
   * POST /restaurants/admin/deduplicate
   * Merges duplicate entries with matching names or Google Maps URIs
   */
  @Post('admin/deduplicate')
  @HttpCode(HttpStatus.OK)
  async adminDeduplicate() {
    return this.restaurantsService.deduplicateDatabase();
  }

  /**
   * POST /restaurants/admin/merge-cities
   * Body: { fromCity: string, toCity: string }
   * Merges all restaurants in fromCity into toCity (e.g. Lahore Cant -> Lahore)
   */
  @Post('admin/merge-cities')
  @HttpCode(HttpStatus.OK)
  async adminMergeCities(@Body() body: { fromCity: string; toCity: string }) {
    return this.restaurantsService.mergeCities(body.fromCity, body.toCity);
  }

  /**
   * POST /restaurants/admin/upgrade-scraping
   * Body: { targetLevel: 'intermediate' | 'advanced' }
   * Re-scrapes qualifying restaurants at higher quality. Runs in background.
   */
  @Post('admin/upgrade-scraping')
  @HttpCode(HttpStatus.ACCEPTED)
  async adminUpgradeScraping(@Body() body: { targetLevel: 'intermediate' | 'advanced' }) {
    return this.restaurantsService.upgradeScrapingLevel(body.targetLevel || 'intermediate');
  }

  /**
   * POST /restaurants/admin/:id/upgrade-scraping
   * Body: { targetLevel: 'intermediate' | 'advanced' }
   * Upgrades a single restaurant synchronously.
   */
  @Post('admin/:id/upgrade-scraping')
  @HttpCode(HttpStatus.OK)
  async adminUpgradeSingleScraping(@Param('id') id: string, @Body() body: { targetLevel: 'intermediate' | 'advanced' }) {
    return this.restaurantsService.upgradeSingleRestaurant(id, body.targetLevel || 'advanced');
  }
}

