import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';
import { GoogleMapsScraperService } from './scraper.service';
import { SearchHistory } from './entities/search-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SearchHistory])],
  controllers: [RestaurantsController],
  providers: [RestaurantsService, GoogleMapsScraperService],
  exports: [RestaurantsService, GoogleMapsScraperService],
})
export class RestaurantsModule {}
