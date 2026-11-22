import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsBoolean } from 'class-validator';

export class CreateResourceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  pricePerHour?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
