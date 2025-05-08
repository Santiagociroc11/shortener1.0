import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// Extrae el ID de vídeo de distintas URLs de YouTube
export function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);

    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1);
    }
    if (u.searchParams.has('v')) {
      return u.searchParams.get('v')!;
    }
    const m = u.pathname.match(/^\/(?:embed|v|live)\/([^/?]+)/);
    return m ? m[1] : null;
  } catch {
    return null; // URL mal formada
  }
}

// Detecta plataforma móvil para deep linking en YouTube
const PLATFORM = (() => {
  const ua = navigator.userAgent;
  return {
    android: /Android/i.test(ua),
    ios: /iPad|iPhone|iPod/i.test(ua),
  };
})();

// Intenta abrir la app de YouTube en iOS/Android o cae al navegador
export function openYouTube(videoId: string, originalUrl: string) {
  const androidIntent =
    `intent://youtu.be/${videoId}` +
    `#Intent;scheme=https;package=com.google.android.youtube;` +
    `S.browser_fallback_url=${encodeURIComponent(originalUrl)};end`;

  const iosScheme = `youtube://www.youtube.com/watch?v=${videoId}`;

  const target = PLATFORM.android
    ? androidIntent
    : PLATFORM.ios
    ? iosScheme
    : originalUrl;

  window.location.href = target;

  // Fallback al navegador si no sale de la página
  const timer = setTimeout(() => {
    window.location.href = originalUrl;
  }, 1500);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
  });
}

export default function Redirect() {
  const { shortUrl } = useParams<{ shortUrl: string }>();
  const visitTracked = useRef(false);

  // Renderiza mensajes de estado o error en pantalla completa
  const renderMessage = (title: string, message: string) => {
    document.body.innerHTML = `
      <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui;color:#374151;">
        <div style="text-align:center;">
          <h1 style="font-size:1.5rem;font-weight:bold;margin-bottom:1rem;">${title}</h1>
          <p>${message}</p>
        </div>
      </div>
    `;
  };

  // Inyecta HTML completo y fuerza ejecución de <script>
  const injectHTML = (htmlString: string) => {
    const container = document.createElement('div');
    container.innerHTML = htmlString;
    document.body.appendChild(container);

    const scripts = Array.from(container.getElementsByTagName('script'));
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.text = oldScript.innerHTML;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
  };

  useEffect(() => {
    const trackVisit = async () => {
      if (visitTracked.current) return;
      visitTracked.current = true;

      try {
        const { data, error } = await supabase
          .from('links')
          .select('*')
          .eq('short_url', shortUrl)
          .single();

        if (error || !data) throw new Error('Enlace no encontrado');

        // Verificar expiración
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          renderMessage(
            'Este enlace ha expirado',
            'El enlace ya no está disponible porque ha superado su fecha de expiración.'
          );
          return;
        }

        // Registrar visita
        const now = new Date();
        const localDate = now.toLocaleDateString('en-CA');
        const localTime = now.toTimeString().split(' ')[0];
        const visitData = {
          date: `${localDate}T${localTime}`,
          userAgent: navigator.userAgent,
          referrer: document.referrer || 'Direct',
        };
        const updatedVisitsHistory = [...(data.visits_history || []), visitData];

        await supabase
          .from('links')
          .update({
            visits: (data.visits || 0) + 1,
            last_visited: new Date().toISOString(),
            visits_history: updatedVisitsHistory,
          })
          .eq('id', data.id);

        // Manejo Deep Link para YouTube
        if (data.script_code && Array.isArray(data.script_code)) {
          const youtubeDeepLink = data.script_code.find(
            script => script.name === 'YouTube Deep Link'
          );
          const videoId = getYouTubeId(data.original_url);
          if (youtubeDeepLink && videoId) {
            openYouTube(videoId, data.original_url);
            return;
          }
        }

        // Inyección genérica de scripts (excluyendo Deep Link)
        if (data.script_code) {
          if (Array.isArray(data.script_code)) {
            data.script_code.forEach(scriptObj => {
              if (scriptObj.code && scriptObj.name !== 'YouTube Deep Link') {
                injectHTML(scriptObj.code);
              }
            });
          } else {
            injectHTML(data.script_code);
          }
        }

        // Redirección normal tras brevedad
        setTimeout(() => {
          window.location.href = data.original_url;
        }, 1000);

      } catch (error) {
        console.error('Error:', error);
        renderMessage(
          'Enlace no encontrado',
          'El enlace que buscas no existe o ha sido eliminado.'
        );
      }
    };

    trackVisit();
  }, [shortUrl]);

  return (
    <>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'system-ui',
        color: '#374151'
      }}>
        <div style={{
          border: '16px solid #f3f3f3',
          borderTop: '16px solid #3498db',
          borderRadius: '50%',
          width: '120px',
          height: '120px',
          animation: 'spin 2s linear infinite'
        }} />
      </div>
    </>
  );
}
