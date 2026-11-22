import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resource } from './entities/resource.entity';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { RedisService } from '../redis/redis.service';

const ALL_RESOURCES_CACHE_KEY = 'cache:resources:all';
const RESOURCE_CACHE_PREFIX = 'cache:resource:';

@Injectable()
export class ResourcesService {
  private readonly logger = new Logger(ResourcesService.name);

  constructor(
    @InjectRepository(Resource)
    private readonly resourceRepo: Repository<Resource>,
    private readonly redisService: RedisService,
  ) {}

  async create(dto: CreateResourceDto): Promise<Resource> {
    const resource = this.resourceRepo.create(dto);
    const saved = await this.resourceRepo.save(resource);
    await this.invalidateCache();
    return saved;
  }

  async findAll(): Promise<Resource[]> {
    // 1. Check Redis cache first
    const cached = await this.redisService.get(ALL_RESOURCES_CACHE_KEY);
    if (cached) {
      this.logger.log('Returning resources from Redis cache');
      return JSON.parse(cached);
    }

    // 2. Query DB
    const resources = await this.resourceRepo.find({
      order: { createdAt: 'DESC' },
    });

    // 3. Set Redis cache (TTL 300 seconds)
    await this.redisService.set(ALL_RESOURCES_CACHE_KEY, JSON.stringify(resources), 300);
    return resources;
  }

  async findOne(id: string): Promise<Resource> {
    const cacheKey = `${RESOURCE_CACHE_PREFIX}${id}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const resource = await this.resourceRepo.findOne({
      where: { id },
      relations: ['bookings'],
    });

    if (!resource) {
      throw new NotFoundException(`Resource with ID "${id}" not found`);
    }

    await this.redisService.set(cacheKey, JSON.stringify(resource), 300);
    return resource;
  }

  async update(id: string, dto: UpdateResourceDto): Promise<Resource> {
    const resource = await this.findOne(id);
    Object.assign(resource, dto);
    const updated = await this.resourceRepo.save(resource);
    await this.invalidateCache(id);
    return updated;
  }

  async remove(id: string): Promise<{ message: string }> {
    const resource = await this.findOne(id);
    await this.resourceRepo.remove(resource);
    await this.invalidateCache(id);
    return { message: `Resource ${id} deleted successfully` };
  }

  private async invalidateCache(id?: string): Promise<void> {
    await this.redisService.del(ALL_RESOURCES_CACHE_KEY);
    if (id) {
      await this.redisService.del(`${RESOURCE_CACHE_PREFIX}${id}`);
    }
  }
}
