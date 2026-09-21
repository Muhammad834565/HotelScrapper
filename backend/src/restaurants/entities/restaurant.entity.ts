import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

@Entity('restaurants')
export class RestaurantEntity {
  @PrimaryColumn()
  id: string; // unique key (e.g. gmap-..., osm-..., nom-..., or normalized name)

  @Column({ unique: true })
  @Index()
  normalizedName: string; // for deduplication: e.g. "chairotirestaurant"

  @Column()
  name: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  postalCode: string;

  @Column('float')
  @Index()
  latitude: number;

  @Column('float')
  @Index()
  longitude: number;

  @Column('float', { nullable: true })
  rating: number;

  @Column('int', { nullable: true })
  userRatingCount: number;

  @Column({ nullable: true })
  googleMapsUri: string;

  @Column({ nullable: true })
  priceLevel: string;

  @Column({ nullable: true })
  cuisine: string;

  @Column('simple-array', { nullable: true })
  cuisineTypes: string[];

  @Column({ nullable: true })
  placeType: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  website: string;

  @Column('simple-array', { nullable: true })
  images: string[];

  @Column('simple-array', { nullable: true })
  openingHours: string[];

  @Column({ nullable: true, default: null })
  isOpenNow: boolean | null;

  @Column('simple-json', { nullable: true })
  aboutSection: Record<string, string[]>;

  @Column('simple-array', { nullable: true })
  aboutKeywords: string[];

  @Column('simple-json', { nullable: true })
  menuData: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
