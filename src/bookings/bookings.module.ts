import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { Resource } from '../resources/entities/resource.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Resource])],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService, TypeOrmModule],
})
export class BookingsModule {}
