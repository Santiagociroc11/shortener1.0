import { useState, useEffect, useCallback } from 'react';
import { LinkService } from '../lib/linkService';

interface UseCacheOptions {
  enableRefresh?: boolean;
  refreshInterval?: number;
}

// Hook para obtener datos de enlaces con caché
export function useLinkData(shortUrl: string | undefined, options: UseCacheOptions = {}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!shortUrl) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const linkData = await LinkService.getLinkData(shortUrl);
      setData(linkData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [shortUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh opcional
  useEffect(() => {
    if (!options.enableRefresh || !options.refreshInterval) return;

    const interval = setInterval(fetchData, options.refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, options.enableRefresh, options.refreshInterval]);

  return { data, loading, error, refetch: fetchData };
}

// Hook para obtener enlaces de usuario con caché
export function useUserLinks(userId: string | undefined) {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const userLinks = await LinkService.getUserLinks(userId);
      setLinks(userLinks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  return { links, loading, error, refetch: fetchLinks };
}

// Hook para estadísticas detalladas (sin caché para datos precisos)
export function useDetailedStats(shortUrl: string | undefined) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!shortUrl) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const detailedStats = await LinkService.getDetailedStats(shortUrl);
      setStats(detailedStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [shortUrl]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

// Hook para operaciones de enlaces
export function useLinkOperations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLink = async (linkData: any) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await LinkService.createLink(linkData);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear enlace');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateLink = async (id: string, updates: any) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await LinkService.updateLink(id, updates);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar enlace');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteLink = async (id: string, shortUrl: string, userId?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await LinkService.deleteLink(id, shortUrl, userId);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar enlace');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { createLink, updateLink, deleteLink, loading, error };
} 