import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  getClient(): Redis {
    return this.redis;
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
    if (ttlSeconds) {
      return this.redis.set(key, value, 'EX', ttlSeconds);
    }
    return this.redis.set(key, value);
  }

  async del(key: string): Promise<number> {
    return this.redis.del(key);
  }

  async delByPattern(pattern: string): Promise<number> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      return this.redis.del(...keys);
    }
    return 0;
  }

  /**
   * Acquire a distributed lock to prevent concurrent double-booking.
   * @param lockKey Key representing the resource or slot lock
   * @param lockValue Unique token (e.g. UUID) identifying lock holder
   * @param ttlMs Expiration in milliseconds
   * @returns boolean whether lock was acquired
   */
  async acquireLock(lockKey: string, lockValue: string, ttlMs: number = 5000): Promise<boolean> {
    const result = await this.redis.set(lockKey, lockValue, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  /**
   * Release a distributed lock only if lockValue matches (atomic release using Lua script)
   */
  async releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(luaScript, 1, lockKey, lockValue);
    return result === 1;
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async onModuleDestroy() {
    this.logger.log('Closing Redis connection...');
    await this.redis.quit();
  }
}
