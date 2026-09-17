import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { SearchLocationDto } from './dto/search-location.dto';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) { }

  @Post('nearby')
  @HttpCode(HttpStatus.OK)
  async getNearby(@Body() dto: SearchLocationDto) {
    return this.restaurantsService.findNearestRestaurants(dto);
  }

  @Get('history')
  async getHistory() {
    return this.restaurantsService.getSearchHistory();
  }

  @Get('geocode')
  async geocode(@Query('q') query: string) {
    return this.restaurantsService.geocodeLocation(query);
  }
}
