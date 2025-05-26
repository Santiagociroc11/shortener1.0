import { createClient } from 'redis';

// Configuración de Redis
const redisUrl = import.meta.env.VITE_REDIS_URL || 'redis://localhost:6379';

export const redis = createClient({
  url: redisUrl,
  retry_delay_on_failure: 100,
  retry_delay_on_cluster_down: 300,
  connect_timeout: 10000,
  lazyConnect: true
});

// Manejo de errores
redis.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redis.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redis.on('ready', () => {
  console.log('🚀 Redis client ready');
});

// Conectar automáticamente
let isConnecting = false;
let isConnected = false;

export const connectRedis = async (): Promise<boolean> => {
  if (isConnected) return true;
  if (isConnecting) return false;
  
  try {
    isConnecting = true;
    await redis.connect();
    isConnected = true;
    isConnecting = false;
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    isConnecting = false;
    return false;
  }
};

// Funciones de utilidad para caché
export class CacheService {
  private static TTL = {
    LINK_DATA: 300, // 5 minutos para datos de enlaces
    VISIT_COUNTER: 60, // 1 minuto para contadores de visitas
    USER_LINKS: 120 // 2 minutos para lista de enlaces de usuario
  };

  // Obtener datos de enlace del caché
  static async getLinkData(shortUrl: string) {
    try {
      await connectRedis();
      const cached = await redis.get(`link:${shortUrl}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Guardar datos de enlace en caché
  static async setLinkData(shortUrl: string, data: any) {
    try {
      await connectRedis();
      await redis.setEx(
        `link:${shortUrl}`,
        this.TTL.LINK_DATA,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  // Invalidar caché de enlace
  static async invalidateLinkData(shortUrl: string) {
    try {
      await connectRedis();
      await redis.del(`link:${shortUrl}`);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  // Incrementar contador de visitas en caché
  static async incrementVisitCounter(shortUrl: string): Promise<number> {
    try {
      await connectRedis();
      const key = `visits:${shortUrl}`;
      const count = await redis.incr(key);
      await redis.expire(key, this.TTL.VISIT_COUNTER);
      return count;
    } catch (error) {
      console.error('Visit counter increment error:', error);
      return 0;
    }
  }

  // Obtener contador de visitas del caché
  static async getVisitCounter(shortUrl: string): Promise<number> {
    try {
      await connectRedis();
      const count = await redis.get(`visits:${shortUrl}`);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      console.error('Visit counter get error:', error);
      return 0;
    }
  }

  // Limpiar contador de visitas (para sincronizar con BD)
  static async clearVisitCounter(shortUrl: string) {
    try {
      await connectRedis();
      await redis.del(`visits:${shortUrl}`);
    } catch (error) {
      console.error('Visit counter clear error:', error);
    }
  }

  // Caché para enlaces de usuario
  static async getUserLinks(userId: string) {
    try {
      await connectRedis();
      const cached = await redis.get(`user_links:${userId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('User links cache get error:', error);
      return null;
    }
  }

  static async setUserLinks(userId: string, links: any[]) {
    try {
      await connectRedis();
      await redis.setEx(
        `user_links:${userId}`,
        this.TTL.USER_LINKS,
        JSON.stringify(links)
      );
    } catch (error) {
      console.error('User links cache set error:', error);
    }
  }

  static async invalidateUserLinks(userId: string) {
    try {
      await connectRedis();
      await redis.del(`user_links:${userId}`);
    } catch (error) {
      console.error('User links cache invalidation error:', error);
    }
  }
} 