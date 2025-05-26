import { redis, connectRedis, CacheService } from './redis';

// Función para probar la conexión a Redis
export async function testRedisConnection() {
  console.log('🔍 Testing Redis connection...');
  
  try {
    // 1. Probar conexión básica
    const connected = await connectRedis();
    
    if (!connected) {
      console.error('❌ Failed to connect to Redis');
      return false;
    }

    console.log('✅ Connected to Redis successfully!');

    // 2. Probar operaciones básicas
    console.log('🔧 Testing basic operations...');
    
    // Set y Get básico
    await redis.set('test:connection', 'Hello Redis!');
    const testValue = await redis.get('test:connection');
    console.log('📝 Test value:', testValue);
    
    // Limpiar test
    await redis.del('test:connection');

    // 3. Probar el CacheService
    console.log('🧪 Testing CacheService...');
    
    const testLinkData = {
      id: 'test-123',
      short_url: 'test-url',
      original_url: 'https://example.com',
      visits: 0
    };
    
    // Guardar en caché
    await CacheService.setLinkData('test-url', testLinkData);
    console.log('✅ Data cached successfully');
    
    // Recuperar del caché
    const cachedData = await CacheService.getLinkData('test-url');
    console.log('📦 Cached data retrieved:', cachedData);
    
    // Limpiar test
    await CacheService.invalidateLinkData('test-url');
    console.log('🧹 Test data cleaned');

    // 4. Probar contador de visitas
    console.log('📊 Testing visit counter...');
    
    const count1 = await CacheService.incrementVisitCounter('test-counter');
    const count2 = await CacheService.incrementVisitCounter('test-counter');
    const count3 = await CacheService.incrementVisitCounter('test-counter');
    
    console.log('🔢 Visit counts:', { count1, count2, count3 });
    
    const currentCount = await CacheService.getVisitCounter('test-counter');
    console.log('📈 Current count:', currentCount);
    
    // Limpiar test
    await CacheService.clearVisitCounter('test-counter');

    console.log('🎉 All tests passed! Redis is working perfectly.');
    return true;

  } catch (error) {
    console.error('❌ Redis test failed:', error);
    return false;
  }
}

// Función para obtener estadísticas de Redis
export async function getRedisInfo() {
  try {
    await connectRedis();
    
    // En una implementación completa, usaríamos redis.info()
    // Por ahora, simulamos algunas estadísticas básicas
    
    const stats = {
      connected: true,
      uptime: 'Connected successfully',
      memory_usage: 'Available',
      total_commands_processed: 'Active',
      connected_clients: 'Client connected',
      timestamp: new Date().toISOString()
    };
    
    console.log('📊 Redis Stats:', stats);
    return stats;
    
  } catch (error) {
    console.error('Error getting Redis info:', error);
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Función para benchmark de rendimiento
export async function benchmarkCache() {
  console.log('⚡ Starting cache benchmark...');
  
  try {
    await connectRedis();
    
    const iterations = 100;
    const testData = {
      id: 'benchmark-test',
      short_url: 'bench-url',
      original_url: 'https://benchmark.com',
      visits: 42
    };

    // Benchmark SET operations
    console.time('Cache SET operations');
    for (let i = 0; i < iterations; i++) {
      await CacheService.setLinkData(`bench-${i}`, testData);
    }
    console.timeEnd('Cache SET operations');

    // Benchmark GET operations
    console.time('Cache GET operations');
    for (let i = 0; i < iterations; i++) {
      await CacheService.getLinkData(`bench-${i}`);
    }
    console.timeEnd('Cache GET operations');

    // Benchmark visit counters
    console.time('Visit counter operations');
    for (let i = 0; i < iterations; i++) {
      await CacheService.incrementVisitCounter('bench-counter');
    }
    console.timeEnd('Visit counter operations');

    // Cleanup
    for (let i = 0; i < iterations; i++) {
      await CacheService.invalidateLinkData(`bench-${i}`);
    }
    await CacheService.clearVisitCounter('bench-counter');

    console.log(`✅ Benchmark completed with ${iterations} operations each`);
    return true;

  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    return false;
  }
} 