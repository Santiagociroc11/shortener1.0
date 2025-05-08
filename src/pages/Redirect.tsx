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
    console.log('[injectHTML] HTML length:', htmlString.length);
    const container = document.createElement('div');
    container.innerHTML = htmlString;
    document.body.appendChild(container);

    const scripts = Array.from(container.getElementsByTagName('script'));
    console.log('[injectHTML] found scripts count:', scripts.length);
    scripts.forEach((oldScript, idx) => {
      console.log(`[injectHTML] processing script #${idx}`);
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
      newScript.text = oldScript.innerHTML;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
      console.log(`[injectHTML] executed script #${idx}`);
    });
  };

  useEffect(() => {
    const trackVisit = async () => {
      if (visitTracked.current) {
        console.log('[trackVisit] already tracked, abort');
        return;
      }
      visitTracked.current = true;
      console.log('[trackVisit] fetching data for shortUrl:', shortUrl);

      try {
        const { data, error } = await supabase
          .from('links')
          .select('*')
          .eq('short_url', shortUrl)
          .single();

        if (error || !data) {
          console.error('[trackVisit] error fetching link or data empty', error);
          throw new Error('Enlace no encontrado');
        }
        console.log('[trackVisit] fetched link data:', data);

        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          renderMessage(
            'Este enlace ha expirado',
            'El enlace ya no está disponible porque ha superado su fecha de expiración.'
          );
          return;
        }

        // Registro de visita
        const now = new Date();
        const localDate = now.toLocaleDateString('en-CA');
        const localTime = now.toTimeString().split(' ')[0];
        const visitData = { date: `${localDate}T${localTime}`, userAgent: navigator.userAgent, referrer: document.referrer || 'Direct' };
        const updatedVisitsHistory = [...(data.visits_history || []), visitData];
        console.log('[trackVisit] visitData:', visitData);

        await supabase
          .from('links')
          .update({ visits: (data.visits || 0) + 1, last_visited: new Date().toISOString(), visits_history: updatedVisitsHistory })
          .eq('id', data.id);
        console.log('[trackVisit] visit registered');

        // Deep Link para YouTube?
        if (data.script_code && Array.isArray(data.script_code)) {
          console.log('[trackVisit] script_code array:', data.script_code);
          const youtubeDeepLink = data.script_code.find(s => s.name === 'YouTube Deep Link');
          if (youtubeDeepLink) console.log('[trackVisit] found YouTube Deep Link script');
          const videoId = getYouTubeId(data.original_url);
          console.log('[trackVisit] extracted videoId:', videoId);
          if (youtubeDeepLink && videoId) {
            openYouTube(videoId, data.original_url);
            return;
          }
        }

        // Inyección genérica de scripts
        if (data.script_code) {
          console.log('[trackVisit] injecting generic scripts');
          if (Array.isArray(data.script_code)) {
            data.script_code.forEach(scriptObj => {
              console.log('[trackVisit] scriptObj:', scriptObj.name);
              if (scriptObj.code && scriptObj.name !== 'YouTube Deep Link') {
                injectHTML(scriptObj.code);
              }
            });
          } else {
            injectHTML(data.script_code);
          }
        }

        console.log('[trackVisit] redirecting to original URL in 1s');
        setTimeout(() => {
          console.log('[trackVisit] redirect now to:', data.original_url);
          window.location.href = data.original_url;
        }, 1000);

      } catch (err) {
        console.error('[trackVisit] error:', err);
        renderMessage('Enlace no encontrado', 'El enlace que buscas no existe o ha sido eliminado.');
      }
    };

    trackVisit();
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