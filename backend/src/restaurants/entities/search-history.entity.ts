import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('search_history')
export class SearchHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('float')
  latitude: number;

  @Column('float')
  longitude: number;

  @Column('int')
  resultsCount: number;

  @Column('jsonb', { nullable: true })
  results: any;

  @CreateDateColumn()
  createdAt: Date;
}
