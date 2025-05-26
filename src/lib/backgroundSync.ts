import { CacheService } from './redis';
import { supabase } from './supabase';

interface BackgroundSyncConfig {
  syncInterval: number; // en milisegundos
  batchSize: number;
  maxRetries: number;
}

export class BackgroundSync {
  private static instance: BackgroundSync;
  private config: BackgroundSyncConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor(config: BackgroundSyncConfig) {
    this.config = config;
  }

  static getInstance(config?: BackgroundSyncConfig): BackgroundSync {
    if (!BackgroundSync.instance) {
      BackgroundSync.instance = new BackgroundSync(config || {
        syncInterval: 30000, // 30 segundos
        batchSize: 50,
        maxRetries: 3
      });
    }
    return BackgroundSync.instance;
  }

  // Iniciar sincronización automática
  start() {
    if (this.isRunning) {
      console.log('[BackgroundSync] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[BackgroundSync] Starting background sync');

    this.intervalId = setInterval(() => {
      this.performSync();
    }, this.config.syncInterval);

    // Ejecutar una sincronización inicial
    setTimeout(() => this.performSync(), 1000);
  }

  // Detener sincronización
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[BackgroundSync] Background sync stopped');
  }

  // Ejecutar sincronización manual
  async performSync() {
    try {
      console.log('[BackgroundSync] Starting sync cycle');

      // 1. Sincronizar contadores de visitas pendientes
      await this.syncPendingVisits();

      // 2. Limpiar caché expirado
      await this.cleanExpiredCache();

      // 3. Pre-cargar enlaces populares
      await this.preloadPopularLinks();

      console.log('[BackgroundSync] Sync cycle completed');
    } catch (error) {
      console.error('[BackgroundSync] Sync error:', error);
    }
  }

  // Sincronizar contadores de visitas pendientes con la BD
  private async syncPendingVisits() {
    try {
      // Esta función sería más compleja en una implementación real
      // Aquí simularemos la lógica básica
      console.log('[BackgroundSync] Syncing pending visits...');
      
      // En una implementación real, mantendríamos una lista de
      // shortUrls con visitas pendientes de sincronización
      
    } catch (error) {
      console.error('[BackgroundSync] Error syncing visits:', error);
    }
  }

  // Limpiar entradas expiradas del caché
  private async cleanExpiredCache() {
    try {
      console.log('[BackgroundSync] Cleaning expired cache...');
      
      // Redis maneja automáticamente la expiración TTL,
      // pero podríamos implementar limpieza adicional aquí
      
    } catch (error) {
      console.error('[BackgroundSync] Error cleaning cache:', error);
    }
  }

  // Pre-cargar enlaces más populares en el caché
  private async preloadPopularLinks() {
    try {
      console.log('[BackgroundSync] Preloading popular links...');

      // Obtener enlaces más visitados de las últimas 24 horas
      const { data: popularLinks, error } = await supabase
        .from('links')
        .select('short_url, original_url')
        .order('visits', { ascending: false })
        .limit(this.config.batchSize);

      if (error) {
        console.error('[BackgroundSync] Error fetching popular links:', error);
        return;
      }

      if (!popularLinks?.length) return;

      // Pre-cargar en caché
      for (const link of popularLinks) {
        try {
          // Verificar si ya está en caché
          const cached = await CacheService.getLinkData(link.short_url);
          if (!cached) {
            // Obtener datos completos y cachear
            const { data: fullData } = await supabase
              .from('links')
              .select('*')
              .eq('short_url', link.short_url)
              .single();

            if (fullData) {
              await CacheService.setLinkData(link.short_url, fullData);
              console.log(`[BackgroundSync] Preloaded: ${link.short_url}`);
            }
          }
        } catch (error) {
          console.error(`[BackgroundSync] Error preloading ${link.short_url}:`, error);
        }
      }

      console.log(`[BackgroundSync] Preloaded ${popularLinks.length} popular links`);
    } catch (error) {
      console.error('[BackgroundSync] Error preloading popular links:', error);
    }
  }

  // Obtener estadísticas del caché
  async getCacheStats() {
    try {
      // En una implementación real, obtendríamos estadísticas de Redis
      return {
        message: 'Cache stats would be implemented with Redis INFO commands',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[BackgroundSync] Error getting cache stats:', error);
      return null;
    }
  }

  // Forzar limpieza de caché de un enlace específico
  async invalidateLink(shortUrl: string, userId?: string) {
    try {
      await CacheService.invalidateLinkData(shortUrl);
      await CacheService.clearVisitCounter(shortUrl);
      
      if (userId) {
        await CacheService.invalidateUserLinks(userId);
      }
      
      console.log(`[BackgroundSync] Invalidated cache for: ${shortUrl}`);
    } catch (error) {
      console.error(`[BackgroundSync] Error invalidating ${shortUrl}:`, error);
    }
  }

  // Warm-up del caché con enlaces de un usuario
  async warmupUserCache(userId: string) {
    try {
      console.log(`[BackgroundSync] Warming up cache for user: ${userId}`);

      const { data: userLinks, error } = await supabase
        .from('links')
        .select('*')
        .eq('user_id', userId)
        .order('last_visited', { ascending: false })
        .limit(20); // Últimos 20 enlaces del usuario

      if (error || !userLinks?.length) return;

      // Cachear enlaces individuales
      for (const link of userLinks) {
        await CacheService.setLinkData(link.short_url, link);
      }

      // Cachear lista de enlaces del usuario
      await CacheService.setUserLinks(userId, userLinks);

      console.log(`[BackgroundSync] Warmed up ${userLinks.length} links for user ${userId}`);
    } catch (error) {
      console.error(`[BackgroundSync] Error warming up user cache:`, error);
    }
  }
}

// Función para inicializar el servicio de sincronización
export function initializeBackgroundSync(config?: BackgroundSyncConfig) {
  const sync = BackgroundSync.getInstance(config);
  
  // Auto-iniciar en entornos de producción
  if (import.meta.env.PROD) {
    sync.start();
  }

  return sync;
}

// Función para limpiar recursos al cerrar la aplicación
export function cleanupBackgroundSync() {
  const sync = BackgroundSync.getInstance();
  sync.stop();
} 