import {
  IsUUID,
  IsString,
  IsEmail,
  IsNotEmpty,
  IsISO8601,
} from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  @IsNotEmpty()
  resourceId: string;

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsEmail()
  @IsNotEmpty()
  customerEmail: string;

  @IsISO8601()
  @IsNotEmpty()
  startTime: string;

  @IsISO8601()
  @IsNotEmpty()
  endTime: string;
}
