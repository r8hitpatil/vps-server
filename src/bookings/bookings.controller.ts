import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.create(createBookingDto);
  }

  @Get()
  findAll(@Query() query: QueryBookingDto) {
    return this.bookingsService.findAll(query);
  }

  @Get('availability/:resourceId')
  getAvailability(
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Query('date') date: string,
  ) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.bookingsService.getAvailability(resourceId, targetDate);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookingsService.cancel(id);
  }
}
