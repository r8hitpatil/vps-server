import { Module, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from './redis/redis.module';
import { ResourcesModule } from './resources/resources.module';
import { BookingsModule } from './bookings/bookings.module';
import { Resource } from './resources/entities/resource.entity';
import { Booking } from './bookings/entities/booking.entity';
import { ResourcesService } from './resources/resources.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'sqlite',
        database: config.get<string>('DATABASE_PATH', './data/booking.sqlite'),
        entities: [Resource, Booking],
        synchronize: true, // Auto-creates schema without migrations for simple setup
        logging: false,
      }),
    }),
    RedisModule,
    ResourcesModule,
    BookingsModule,
  ],
})
export class AppModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppModule.name);

  constructor(private readonly resourcesService: ResourcesService) {}

  async onApplicationBootstrap() {
    // Seed initial demo resources if table is empty
    const existing = await this.resourcesService.findAll();
    if (existing.length === 0) {
      this.logger.log('Seeding initial demo bookable resources...');
      await this.resourcesService.create({
        name: 'Conference Room Alpha',
        description: 'Large conference room equipped with 4K projector, whiteboard, and 12 seats',
        capacity: 12,
        pricePerHour: 45.0,
        isActive: true,
      });
      await this.resourcesService.create({
        name: 'Focus Pod 101',
        description: 'Soundproof single-person private booth for video calls and deep work',
        capacity: 1,
        pricePerHour: 15.0,
        isActive: true,
      });
      await this.resourcesService.create({
        name: 'Team Studio Beta',
        description: 'Collaborative workshop space with movable desks and dual monitors',
        capacity: 6,
        pricePerHour: 30.0,
        isActive: true,
      });
      this.logger.log('Initial resources successfully seeded!');
    }
  }
}
