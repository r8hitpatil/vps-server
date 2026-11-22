import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';

@Entity('resources')
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', default: 1 })
  capacity: number;

  @Column({ type: 'real', default: 0 })
  pricePerHour: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Booking, (booking) => booking.resource)
  bookings: Booking[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
