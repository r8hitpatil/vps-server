import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import { BookingStatus } from '../entities/booking.entity';

export class QueryBookingDto {
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsDateString()
  date?: string; // YYYY-MM-DD
}
