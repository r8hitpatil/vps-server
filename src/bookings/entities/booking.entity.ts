import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Resource } from '../../resources/entities/resource.entity';

export enum BookingStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

@Entity('bookings')
@Index(['resourceId', 'startTime', 'endTime'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  resourceId: string;

  @ManyToOne(() => Resource, (resource) => resource.bookings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'resourceId' })
  resource: Resource;

  @Column({ type: 'varchar', length: 150 })
  customerName: string;

  @Column({ type: 'varchar', length: 150 })
  customerEmail: string;

  @Column({ type: 'datetime' })
  startTime: Date;

  @Column({ type: 'datetime' })
  endTime: Date;

  @Column({
    type: 'varchar',
    default: BookingStatus.CONFIRMED,
  })
  status: BookingStatus;

  @Column({ type: 'real', default: 0 })
  totalAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
