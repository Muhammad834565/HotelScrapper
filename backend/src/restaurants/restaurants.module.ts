import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';
import { GoogleMapsScraperService } from './scraper.service';
import { RestaurantEntity } from './entities/restaurant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RestaurantEntity])],
  controllers: [RestaurantsController],
  providers: [RestaurantsService, GoogleMapsScraperService],
  exports: [RestaurantsService, GoogleMapsScraperService],
})
export class RestaurantsModule {}
