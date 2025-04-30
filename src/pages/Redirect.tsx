import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
// Nota: Si no usas `toast` en este componente, puedes remover la importación de react-hot-toast.

export default function Redirect() {
  const { shortUrl } = useParams<{ shortUrl: string }>();
  const visitTracked = useRef(false);

  // Función para renderizar mensajes en pantalla
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

  // Función para inyectar HTML completo y procesar los scripts
  const injectHTML = (htmlString: string) => {
    // Si el HTML contiene una estructura completa (DOCTYPE, html, head, body)
    if (htmlString.includes('<!DOCTYPE html>')) {
      // Reemplazar todo el documento
      document.documentElement.innerHTML = htmlString;
      
      // Recrear los scripts para que se ejecuten
      const scripts = document.getElementsByTagName('script');
      const scriptsArray = Array.from(scripts);
      
      scriptsArray.forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.text = oldScript.innerHTML;
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      });
    } else {
      // Si es solo un fragmento de HTML, inyectarlo en el body
      const container = document.createElement('div');
      container.innerHTML = htmlString;
      document.body.appendChild(container);

      const scripts = container.getElementsByTagName('script');
      const scriptsArray = Array.from(scripts);
      
      scriptsArray.forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.text = oldScript.innerHTML;
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      });
    }
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

        if (error || !data) {
          throw new Error('Enlace no encontrado');
        }

        // Verificar si el enlace ha expirado
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          renderMessage(
            'Este enlace ha expirado',
            'El enlace ya no está disponible porque ha superado su fecha de expiración.'
          );
          return;
        }

        // Registrar la visita
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

        // Inyectar HTML con los scripts (si existen)
        if (data.script_code) {
          if (Array.isArray(data.script_code)) {
            // Buscar si hay un script de YouTube Deep Link
            const youtubeDeepLink = data.script_code.find(script => script.name === 'YouTube Deep Link');
            if (youtubeDeepLink) {
              // Si encontramos el deep link, lo inyectamos y no hacemos la redirección normal
              injectHTML(youtubeDeepLink.code);
              return;
            }
            
            // Si no hay deep link, inyectamos los otros scripts
            data.script_code.forEach((scriptObj: { name: string; code: string }) => {
              if (scriptObj.code) {
                injectHTML(scriptObj.code);
              }
            });
          } else {
            // Si por alguna razón es una cadena, se inyecta directamente
            injectHTML(data.script_code);
          }
        }

        // Solo redirigir si no hay un deep link de YouTube
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
      {/* Estilos para la animación del spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
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
