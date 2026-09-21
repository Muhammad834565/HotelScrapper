import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { RestaurantEntity } from './restaurants/entities/restaurant.entity';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'restaurant_db'),
        entities: [RestaurantEntity],
        synchronize: true, // Auto-create tables in dev environment
        autoLoadEntities: true,
        retryAttempts: 2,
        retryDelay: 1000,
        verboseRetryLog: false,
      }),
    }),
    RestaurantsModule,
  ],
  controllers: [AuthController],
  providers: [AuthGuard],
})
export class AppModule {}

