import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class SearchLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsNumber()
  radius?: number; // In meters, default 5000 (5km)

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number; // Number of results to return, default 10
}
