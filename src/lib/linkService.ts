import { supabase } from './supabase';
import { CacheService } from './redis';

interface LinkData {
  id: string;
  short_url: string;
  original_url: string;
  visits: number;
  expires_at?: string;
  last_visited?: string;
  visits_history?: any[];
  script_code?: any;
  user_id?: string;
}

interface VisitData {
  date: string;
  userAgent: string;
  referrer: string;
}

export class LinkService {
  // Obtener datos del enlace (con caché)
  static async getLinkData(shortUrl: string): Promise<LinkData | null> {
    try {
      // 1. Intentar obtener del caché primero
      console.log(`[LinkService] Checking cache for: ${shortUrl}`);
      const cachedData = await CacheService.getLinkData(shortUrl);
      
      if (cachedData) {
        console.log(`[LinkService] Cache HIT for: ${shortUrl}`);
        return cachedData;
      }

      // 2. Si no está en caché, consultar base de datos
      console.log(`[LinkService] Cache MISS for: ${shortUrl}, fetching from DB`);
      const { data, error } = await supabase
        .from('links')
        .select('*')
        .eq('short_url', shortUrl)
        .single();

      if (error || !data) {
        console.error(`[LinkService] DB error for ${shortUrl}:`, error);
        return null;
      }

      // 3. Guardar en caché para futuras consultas
      await CacheService.setLinkData(shortUrl, data);
      console.log(`[LinkService] Cached data for: ${shortUrl}`);
      
      return data;
    } catch (error) {
      console.error(`[LinkService] Error getting link data:`, error);
      return null;
    }
  }

  // Registrar visita con optimización de escritura
  static async recordVisit(shortUrl: string, visitData: VisitData): Promise<boolean> {
    try {
      // 1. Incrementar contador en caché (rápido)
      const cacheCount = await CacheService.incrementVisitCounter(shortUrl);
      console.log(`[LinkService] Visit count in cache: ${cacheCount} for ${shortUrl}`);

      // 2. Obtener datos del enlace
      const linkData = await this.getLinkData(shortUrl);
      if (!linkData) return false;

      // 3. Estrategia write-behind: escribir a BD de forma asíncrona
      this.syncVisitToDatabase(shortUrl, linkData, visitData, cacheCount);
      
      return true;
    } catch (error) {
      console.error(`[LinkService] Error recording visit:`, error);
      return false;
    }
  }

  // Sincronización asíncrona con base de datos (write-behind)
  private static async syncVisitToDatabase(
    shortUrl: string, 
    linkData: LinkData, 
    visitData: VisitData, 
    cacheCount: number
  ) {
    try {
      // Esperar un poco para agrupar múltiples visitas
      await new Promise(resolve => setTimeout(resolve, 2000));

      const updatedVisitsHistory = [...(linkData.visits_history || []), visitData];
      
      // Actualizar base de datos
      const { error } = await supabase
        .from('links')
        .update({
          visits: (linkData.visits || 0) + cacheCount,
          last_visited: new Date().toISOString(),
          visits_history: updatedVisitsHistory
        })
        .eq('id', linkData.id);

      if (error) {
        console.error(`[LinkService] DB sync error for ${shortUrl}:`, error);
        return;
      }

      console.log(`[LinkService] Successfully synced ${cacheCount} visits to DB for ${shortUrl}`);
      
      // Limpiar contador de caché después de sincronizar
      await CacheService.clearVisitCounter(shortUrl);
      
      // Invalidar caché de datos para refrescar con los nuevos datos
      await CacheService.invalidateLinkData(shortUrl);
      
    } catch (error) {
      console.error(`[LinkService] Sync to database failed:`, error);
    }
  }

  // Crear enlace (invalidar caché de usuario)
  static async createLink(linkData: Omit<LinkData, 'id'>): Promise<LinkData | null> {
    try {
      const { data, error } = await supabase
        .from('links')
        .insert(linkData)
        .select()
        .single();

      if (error || !data) {
        console.error('[LinkService] Error creating link:', error);
        return null;
      }

      // Invalidar caché de enlaces del usuario
      if (linkData.user_id) {
        await CacheService.invalidateUserLinks(linkData.user_id);
      }

      return data;
    } catch (error) {
      console.error('[LinkService] Error creating link:', error);
      return null;
    }
  }

  // Obtener enlaces de usuario (con caché)
  static async getUserLinks(userId: string): Promise<LinkData[]> {
    try {
      // 1. Verificar caché
      const cachedLinks = await CacheService.getUserLinks(userId);
      if (cachedLinks) {
        console.log(`[LinkService] Cache HIT for user links: ${userId}`);
        return cachedLinks;
      }

      // 2. Consultar base de datos
      console.log(`[LinkService] Cache MISS for user links: ${userId}`);
      const { data, error } = await supabase
        .from('links')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[LinkService] Error fetching user links:', error);
        return [];
      }

      // 3. Guardar en caché
      await CacheService.setUserLinks(userId, data || []);
      
      return data || [];
    } catch (error) {
      console.error('[LinkService] Error getting user links:', error);
      return [];
    }
  }

  // Actualizar enlace (invalidar cachés relacionados)
  static async updateLink(id: string, updates: Partial<LinkData>): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('links')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        console.error('[LinkService] Error updating link:', error);
        return false;
      }

      // Invalidar cachés relacionados
      await CacheService.invalidateLinkData(data.short_url);
      if (data.user_id) {
        await CacheService.invalidateUserLinks(data.user_id);
      }

      return true;
    } catch (error) {
      console.error('[LinkService] Error updating link:', error);
      return false;
    }
  }

  // Eliminar enlace (invalidar cachés relacionados)
  static async deleteLink(id: string, shortUrl: string, userId?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('links')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[LinkService] Error deleting link:', error);
        return false;
      }

      // Invalidar cachés relacionados
      await CacheService.invalidateLinkData(shortUrl);
      await CacheService.clearVisitCounter(shortUrl);
      if (userId) {
        await CacheService.invalidateUserLinks(userId);
      }

      return true;
    } catch (error) {
      console.error('[LinkService] Error deleting link:', error);
      return false;
    }
  }

  // Verificar si el enlace ha expirado
  static isLinkExpired(linkData: LinkData): boolean {
    if (!linkData.expires_at) return false;
    return new Date(linkData.expires_at) < new Date();
  }

  // Obtener estadísticas (bypass cache para datos precisos)
  static async getDetailedStats(shortUrl: string): Promise<any> {
    try {
      // Para estadísticas, siempre consultar BD para datos precisos
      const { data, error } = await supabase
        .from('links')
        .select('*')
        .eq('short_url', shortUrl)
        .single();

      if (error || !data) return null;

      return {
        ...data,
        total_visits: data.visits || 0,
        visits_today: this.getVisitsToday(data.visits_history || []),
        visits_this_week: this.getVisitsThisWeek(data.visits_history || []),
        visits_this_month: this.getVisitsThisMonth(data.visits_history || [])
      };
    } catch (error) {
      console.error('[LinkService] Error getting detailed stats:', error);
      return null;
    }
  }

  private static getVisitsToday(visitsHistory: any[]): number {
    const today = new Date().toDateString();
    return visitsHistory.filter(visit => 
      new Date(visit.date).toDateString() === today
    ).length;
  }

  private static getVisitsThisWeek(visitsHistory: any[]): number {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return visitsHistory.filter(visit => 
      new Date(visit.date) >= weekAgo
    ).length;
  }

  private static getVisitsThisMonth(visitsHistory: any[]): number {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return visitsHistory.filter(visit => 
      new Date(visit.date) >= monthAgo
    ).length;
  }
} 