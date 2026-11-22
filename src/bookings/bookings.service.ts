import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Booking, BookingStatus } from './entities/booking.entity';
import { Resource } from '../resources/entities/resource.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import { RedisService } from '../redis/redis.service';

/**
 * Format Date into SQLite datetime string format: YYYY-MM-DD HH:mm:ss.SSS
 * This ensures exact lexicographical comparisons in SQLite queries.
 */
function toSqliteDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(n).padStart(3, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad3(date.getUTCMilliseconds())}`;
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Resource)
    private readonly resourceRepo: Repository<Resource>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Create a new booking with distributed locking via Redis
   * to strictly guarantee no double bookings even under concurrent requests.
   */
  async create(dto: CreateBookingDto): Promise<Booking> {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    // Basic date validations
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end time format');
    }

    if (start >= end) {
      throw new BadRequestException('startTime must be before endTime');
    }

    if (start.getTime() < Date.now() - 5 * 60 * 1000) {
      throw new BadRequestException('Cannot book a slot in the past');
    }

    // Step 1: Acquire Redis distributed lock for the specific resource
    const lockKey = `lock:resource:${dto.resourceId}`;
    const lockValue = uuidv4();
    const lockTtlMs = 6000; // 6 seconds lock window

    const acquired = await this.redisService.acquireLock(lockKey, lockValue, lockTtlMs);
    if (!acquired) {
      throw new ConflictException(
        'This resource is currently undergoing a booking transaction. Please retry in a moment.',
      );
    }

    try {
      // Step 2: Validate Resource exists and is active
      const resource = await this.resourceRepo.findOne({
        where: { id: dto.resourceId },
      });

      if (!resource) {
        throw new NotFoundException(`Resource with ID "${dto.resourceId}" not found`);
      }

      if (!resource.isActive) {
        throw new BadRequestException(`Resource "${resource.name}" is currently inactive`);
      }

      // Step 3: Check database for any overlapping confirmed bookings
      // Overlap formula: existing.startTime < new.endTime AND existing.endTime > new.startTime
      const startSql = toSqliteDateTime(start);
      const endSql = toSqliteDateTime(end);

      const overlapping = await this.bookingRepo
        .createQueryBuilder('booking')
        .where('booking.resourceId = :resourceId', { resourceId: dto.resourceId })
        .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
        .andWhere('booking.startTime < :endSql', { endSql })
        .andWhere('booking.endTime > :startSql', { startSql })
        .getOne();

      if (overlapping) {
        throw new ConflictException(
          `Time conflict: Resource "${resource.name}" is already booked for overlapping period (${new Date(overlapping.startTime).toISOString()} to ${new Date(overlapping.endTime).toISOString()})`,
        );
      }

      // Step 4: Calculate total price
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const totalAmount = Math.round(durationHours * resource.pricePerHour * 100) / 100;

      // Step 5: Save Booking to DB
      const booking = this.bookingRepo.create({
        resourceId: dto.resourceId,
        customerName: dto.customerName,
        customerEmail: dto.customerEmail,
        startTime: start,
        endTime: end,
        status: BookingStatus.CONFIRMED,
        totalAmount,
      });

      const savedBooking = await this.bookingRepo.save(booking);

      // Step 6: Invalidate cached listings & update Redis metrics
      await this.redisService.delByPattern('cache:bookings:*');
      await this.redisService.del(`cache:resource:${dto.resourceId}`);
      await this.redisService.incr('metrics:bookings:total_created');

      this.logger.log(
        `Booking ${savedBooking.id} created for resource ${resource.name} (${start.toISOString()} to ${end.toISOString()})`,
      );

      return savedBooking;
    } finally {
      // Step 7: Always release Redis distributed lock
      await this.redisService.releaseLock(lockKey, lockValue);
    }
  }

  async findAll(query: QueryBookingDto): Promise<Booking[]> {
    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.resource', 'resource')
      .orderBy('booking.startTime', 'DESC');

    if (query.resourceId) {
      qb.andWhere('booking.resourceId = :resourceId', { resourceId: query.resourceId });
    }

    if (query.status) {
      qb.andWhere('booking.status = :status', { status: query.status });
    }

    if (query.date) {
      const dayStart = toSqliteDateTime(new Date(`${query.date}T00:00:00.000Z`));
      const dayEnd = toSqliteDateTime(new Date(`${query.date}T23:59:59.999Z`));
      qb.andWhere('booking.startTime >= :dayStart AND booking.startTime <= :dayEnd', {
        dayStart,
        dayEnd,
      });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: ['resource'],
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID "${id}" not found`);
    }

    return booking;
  }

  async cancel(id: string): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    booking.status = BookingStatus.CANCELLED;
    const updated = await this.bookingRepo.save(booking);

    // Invalidate Redis caches
    await this.redisService.delByPattern('cache:bookings:*');
    await this.redisService.del(`cache:resource:${booking.resourceId}`);
    await this.redisService.incr('metrics:bookings:total_cancelled');

    this.logger.log(`Booking ${id} was successfully cancelled`);
    return updated;
  }

  /**
   * Check booked intervals for a resource on a given day
   */
  async getAvailability(resourceId: string, date: string): Promise<{
    resourceId: string;
    date: string;
    bookedSlots: Array<{ startTime: Date; endTime: Date; bookingId: string }>;
  }> {
    const dayStartDate = new Date(`${date}T00:00:00.000Z`);
    const dayEndDate = new Date(`${date}T23:59:59.999Z`);

    if (isNaN(dayStartDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const dayStart = toSqliteDateTime(dayStartDate);
    const dayEnd = toSqliteDateTime(dayEndDate);

    const bookings = await this.bookingRepo
      .createQueryBuilder('booking')
      .where('booking.resourceId = :resourceId', { resourceId })
      .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .andWhere('booking.startTime < :dayEnd AND booking.endTime > :dayStart', {
        dayStart,
        dayEnd,
      })
      .orderBy('booking.startTime', 'ASC')
      .getMany();

    return {
      resourceId,
      date,
      bookedSlots: bookings.map((b) => ({
        startTime: b.startTime,
        endTime: b.endTime,
        bookingId: b.id,
      })),
    };
  }
}
