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

// ✅ OPTIMIZACIÓN 1: Cache en memoria para URLs repetidas
const URL_CACHE = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

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
    console.error('[trackVisitAsync] error:', error);
    // ✅ Fallback silencioso - no afecta la experiencia del usuario
  }
}

// ✅ NUEVO: Función para detectar cuándo los píxeles han terminado
function waitForPixelsToLoad(): Promise<void> {
  return new Promise((resolve) => {
    let checkCount = 0;
    const maxChecks = 20; // 2 segundos (20 * 100ms)
    let pixelExecuted = false;
    
    console.log('[waitForPixelsToLoad] 🎯 Iniciando verificación de Facebook Pixel...');
    
    const checkPixels = () => {
      checkCount++;
      
      // Verificar si Facebook Pixel está disponible
      const fbqExists = typeof (window as any).fbq !== 'undefined';
      
      if (fbqExists && !pixelExecuted) {
        console.log('[waitForPixelsToLoad] ✅ Facebook Pixel detectado y ejecutándose...');
        pixelExecuted = true;
        
        // Dar un poco más de tiempo para que el evento se dispare
        setTimeout(() => {
          console.log('[waitForPixelsToLoad] ✅ Facebook Pixel EJECUTADO correctamente');
          resolve();
        }, 300);
        return;
      }
      
      // Si hemos esperado suficiente tiempo
      if (checkCount >= maxChecks) {
        if (pixelExecuted) {
          console.log('[waitForPixelsToLoad] ✅ Facebook Pixel EJECUTADO correctamente (timeout alcanzado)');
        } else {
          console.log('[waitForPixelsToLoad] ❌ Facebook Pixel NO SE EJECUTÓ (timeout alcanzado)');
        }
        resolve();
        return;
      }
      
      // Esperar un poco más
      setTimeout(checkPixels, 100);
    };
    
    checkPixels();
  });
}

export default function Redirect() {
  const { shortUrl } = useParams<{ shortUrl: string }>();
  const visitTracked = useRef(false);
  
  const renderMessage = (title: string, message: string) => {
    console.log('[renderMessage]', title, message);
    document.body.innerHTML = `
      <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui;color:#374151;">
        <div style="text-align:center;">
          <h1 style="font-size:1.5rem;font-weight:bold;margin-bottom:1rem;">${title}</h1>
          <p>${message}</p>
        </div>
      </div>`;
  };

  const injectHTML = (htmlString: string) => {
    console.log('[injectHTML] 📝 Inyectando script - longitud:', htmlString.length);
    
    // ✅ MEJORADO: Ejecutar scripts de forma síncrona y más robusta
    try {
      const scriptElement = document.createElement('script');
      scriptElement.type = 'text/javascript';
      scriptElement.text = htmlString;
      
      // Agregar al head para mejor ejecución
      document.head.appendChild(scriptElement);
      console.log('[injectHTML] ✅ Script inyectado exitosamente en <head>');
      
      // Remover después de ejecutar para limpiar el DOM
      setTimeout(() => {
        if (scriptElement.parentNode) {
          scriptElement.parentNode.removeChild(scriptElement);
          console.log('[injectHTML] 🧹 Script removido del DOM para limpieza');
        }
      }, 100);
      
    } catch (error) {
      console.error('[injectHTML] ❌ Error ejecutando script:', error);
      
      // Fallback: método original
      console.log('[injectHTML] 🔄 Usando método fallback...');
      const container = document.createElement('div');
      container.innerHTML = htmlString;
      document.body.appendChild(container);

      const scripts = Array.from(container.getElementsByTagName('script'));
      console.log('[injectHTML] 📋 Fallback - scripts encontrados:', scripts.length);
      scripts.forEach((oldScript, idx) => {
        console.log(`[injectHTML] 🔧 Fallback - procesando script #${idx + 1}`);
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.text = oldScript.innerHTML;
        oldScript.parentNode?.replaceChild(newScript, oldScript);
        console.log(`[injectHTML] ✅ Fallback - ejecutado script #${idx + 1}`);
      });
    }
  };

  useEffect(() => {
    const handleRedirect = async () => {
      if (visitTracked.current || !shortUrl) {
        console.log('[handleRedirect] already processed or no shortUrl');
        return;
      }
      visitTracked.current = true;

      try {
        // ✅ OPTIMIZACIÓN 3: Verificar cache primero
        const cached = URL_CACHE.get(shortUrl);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
          console.log('[handleRedirect] using cached URL:', cached.url);
          window.location.href = cached.url;
          return;
        }

        console.log('[handleRedirect] fetching data for shortUrl:', shortUrl);

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

        // ✅ OPTIMIZACIÓN 5: Cachear la URL para futuras visitas
        URL_CACHE.set(shortUrl, {
          url: data.original_url,
          timestamp: Date.now()
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
        if (data.script_code && Array.isArray(data.script_code)) {
          let hasScripts = false;
          let hasFacebookPixel = false;
          
          console.log('[handleRedirect] 📋 Scripts encontrados:', data.script_code.length);
          
          data.script_code.forEach((scriptObj, index) => {
            if (scriptObj.code && scriptObj.name !== 'YouTube Deep Link') {
              console.log(`[handleRedirect] 🚀 Inyectando script ${index + 1}: "${scriptObj.name}"`);
              injectHTML(scriptObj.code);
              hasScripts = true;
              
              // Detectar si es un píxel de Facebook
              if (scriptObj.name.includes('Facebook Pixel')) {
                hasFacebookPixel = true;
                console.log('[handleRedirect] 📊 DETECTADO: Script de Facebook Pixel');
              }
            }
          });

          // ✅ CRÍTICO: Dar tiempo a los scripts para ejecutarse antes de redirección
          if (hasScripts) {
            console.log('[handleRedirect] ⏳ Esperando que los scripts se ejecuten...');
            
            if (hasFacebookPixel) {
              // Espera inteligente para píxeles de Facebook
              console.log('[handleRedirect] 📊 Facebook Pixel detectado, usando espera inteligente...');
              waitForPixelsToLoad().then(() => {
                console.log('[handleRedirect] 🚀 Redirigiendo después de Facebook Pixel a:', data.original_url);
                window.location.href = data.original_url;
              });
            } else {
              // Delay fijo para otros scripts
              console.log('[handleRedirect] ⚙️ Scripts normales detectados, esperando 2 segundos...');
              setTimeout(() => {
                console.log('[handleRedirect] ✅ Scripts ejecutados, redirigiendo a:', data.original_url);
                window.location.href = data.original_url;
              }, 2000); // 2 segundos para scripts normales
            }
            return; // Salir aquí para evitar redirección inmediata
          }
        }

        // ✅ Redirección inmediata solo si NO hay scripts
        console.log('[handleRedirect] no scripts, redirecting immediately to:', data.original_url);
        window.location.href = data.original_url;

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