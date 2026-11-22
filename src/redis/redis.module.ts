import { Module, Global } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST', '127.0.0.1');
        const port = configService.get<number>('REDIS_PORT', 6379);
        return new Redis({
          host,
          port,
          retryStrategy: (times) => Math.min(times * 100, 3000),
          lazyConnect: false,
        });
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
