import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// Extrae el ID de vídeo de YouTube
export function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1);
    if (u.searchParams.has('v')) return u.searchParams.get('v')!;
    const m = u.pathname.match(/^\/(?:embed|v|live)\/([^/?]+)/);
    return m ? m[1] : null;
  } catch (e) {
    console.error('[getYouTubeId] URL inválida:', url, e);
    return null;
  }
}

const PLATFORM = (() => {
  const ua = navigator.userAgent;
  return { android: /Android/i.test(ua), ios: /iPad|iPhone|iPod/i.test(ua) };
})();

export function openYouTube(videoId: string, originalUrl: string) {
  console.log('[openYouTube] videoId:', videoId);
  const androidIntent =
    `intent://youtu.be/${videoId}` +
    `#Intent;scheme=https;package=com.google.android.youtube;` +
    `S.browser_fallback_url=${encodeURIComponent(originalUrl)};end`;
  const iosScheme = `youtube://www.youtube.com/watch?v=${videoId}`;
  const target = PLATFORM.android ? androidIntent : PLATFORM.ios ? iosScheme : originalUrl;

  console.log('[openYouTube] redirecting to:', target);
  window.location.href = target;

  const timer = setTimeout(() => {
    console.log('[openYouTube] fallback to web URL:', originalUrl);
    window.location.href = originalUrl;
  }, 1500);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('[openYouTube] visibility changed, clearing timer');
      clearTimeout(timer);
    }
  });
}

// ✅ OPTIMIZACIÓN 2: Función de tracking asíncrono ULTRA-OPTIMIZADA
async function trackVisitAsync(shortUrl: string) {
  try {
    // ✅ Nueva función RPC simple sin JSON pesado
    await supabase.rpc('track_visit_simple', {
      p_short_url: shortUrl,
      p_user_agent: navigator.userAgent,
      p_referrer: document.referrer || 'Direct'
    });
  } catch (error) {
    // ✅ Logging solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.error('[trackVisitAsync] error:', error);
    }
    // ✅ Fallback silencioso - no afecta la experiencia del usuario
  }
}

// ✅ OPTIMIZACIÓN EXTRA: Cache mejorado con información de scripts
const URL_CACHE = new Map<string, { url: string; timestamp: number; hasScripts: boolean }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export default function Redirect() {
  const { shortUrl } = useParams<{ shortUrl: string }>();
  const visitTracked = useRef(false);
  
  const renderMessage = (title: string, message: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[renderMessage]', title, message);
    }
    document.body.innerHTML = `
      <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui;color:#374151;">
        <div style="text-align:center;">
          <h1 style="font-size:1.5rem;font-weight:bold;margin-bottom:1rem;">${title}</h1>
          <p>${message}</p>
        </div>
      </div>`;
  };

  const injectHTML = (htmlString: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[injectHTML] HTML length:', htmlString.length);
    }
    const container = document.createElement('div');
    container.innerHTML = htmlString;
    document.body.appendChild(container);

    const scripts = Array.from(container.getElementsByTagName('script'));
    if (process.env.NODE_ENV === 'development') {
      console.log('[injectHTML] found scripts count:', scripts.length);
    }
    
    let scriptsExecuted = 0;
    scripts.forEach((oldScript, idx) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[injectHTML] processing script #${idx}:`, oldScript.innerHTML.substring(0, 100));
      }
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
      newScript.text = oldScript.innerHTML;
      
      // Añadir un callback para confirmar ejecución
      newScript.onload = () => {
        scriptsExecuted++;
        if (process.env.NODE_ENV === 'development') {
          console.log(`[injectHTML] script #${idx} executed successfully`);
        }
      };
      
      newScript.onerror = (error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error(`[injectHTML] script #${idx} failed:`, error);
        }
      };
      
      oldScript.parentNode?.replaceChild(newScript, oldScript);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[injectHTML] script #${idx} injected`);
      }
    });
    
    return scripts.length;
  };

  useEffect(() => {
    const handleRedirect = async () => {
      if (visitTracked.current || !shortUrl) {
        console.log('[handleRedirect] already processed or no shortUrl');
        return;
      }
      visitTracked.current = true;

      try {
        // ✅ OPTIMIZACIÓN 3: Verificar cache primero, ahora más inteligente
        const cached = URL_CACHE.get(shortUrl);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
          if (!cached.hasScripts) {
            if (process.env.NODE_ENV === 'development') {
              console.log('[handleRedirect] using cached URL (no scripts):', cached.url);
            }
            window.location.href = cached.url;
            return;
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log('[handleRedirect] cache hit but has scripts - proceeding with full flow');
            }
          }
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('[handleRedirect] fetching data for shortUrl:', shortUrl);
        }

        // ✅ OPTIMIZACIÓN 4: Solo seleccionar campos necesarios
        const { data, error } = await supabase
          .from('links')
          .select('id, original_url, script_code, visits, expires_at')
          .eq('short_url', shortUrl)
          .single();

        if (error || !data) {
          console.error('[handleRedirect] error fetching link:', error);
          throw new Error('Enlace no encontrado');
        }

        console.log('[handleRedirect] fetched link data');

        // ✅ Verificar expiración
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          renderMessage(
            'Este enlace ha expirado',
            'El enlace ya no está disponible porque ha superado su fecha de expiración.'
          );
          return;
        }

        // ✅ OPTIMIZACIÓN 5: Cachear la URL para futuras visitas con info de scripts
        URL_CACHE.set(shortUrl, {
          url: data.original_url,
          timestamp: Date.now(),
          hasScripts: data.script_code && Array.isArray(data.script_code) && data.script_code.length > 0
        });

        // ✅ OPTIMIZACIÓN 6: Tracking asíncrono NO-BLOQUEANTE
        trackVisitAsync(shortUrl); // No await - fire and forget

        // ✅ Deep Link para YouTube?
        if (data.script_code && Array.isArray(data.script_code)) {
          const youtubeDeepLink = data.script_code.find(s => s.name === 'YouTube Deep Link');
          const videoId = getYouTubeId(data.original_url);
          if (youtubeDeepLink && videoId) {
            openYouTube(videoId, data.original_url);
            return;
          }
        }

        // ✅ Inyección de scripts (si es necesario)
        let totalScripts = 0;
        if (data.script_code && Array.isArray(data.script_code)) {
          console.log('[handleRedirect] injecting generic scripts');
          data.script_code.forEach(scriptObj => {
            console.log('[handleRedirect] processing script:', scriptObj.name);
            if (scriptObj.code && scriptObj.name !== 'YouTube Deep Link') {
              const scriptCount = injectHTML(scriptObj.code);
              totalScripts += scriptCount;
            }
          });
        }

        // ✅ RESTAURADO: Dar tiempo a los scripts para ejecutarse antes de redirigir
        // Más tiempo si hay scripts complejos
        const redirectDelay = totalScripts > 0 ? Math.max(1000, totalScripts * 500) : 1000;
        console.log(`[handleRedirect] redirecting to original URL in ${redirectDelay}ms (${totalScripts} scripts detected)`);
        
        setTimeout(() => {
          console.log('[handleRedirect] redirect now to:', data.original_url);
          window.location.href = data.original_url;
        }, redirectDelay);

      } catch (err) {
        console.error('[handleRedirect] error:', err);
        renderMessage('Enlace no encontrado', 'El enlace que buscas no existe o ha sido eliminado.');
      }
    };

    handleRedirect();
  }, [shortUrl]);

  return (
    <>
      <style>{`@keyframes spin {0% {transform: rotate(0deg);}100% {transform: rotate(360deg);} }`}</style>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'system-ui', color: '#374151' }}>
        <div style={{ border: '16px solid #f3f3f3', borderTop: '16px solid #3498db', borderRadius: '50%', width: '120px', height: '120px', animation: 'spin 2s linear infinite' }} />
      </div>
    </>
  );
}