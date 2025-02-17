import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function Redirect() {
  const { shortUrl } = useParams<{ shortUrl: string }>();
  const visitTracked = useRef(false);

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
          document.body.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui;color:#374151;">
              <div style="text-align:center;">
                <h1 style="font-size:1.5rem;font-weight:bold;margin-bottom:1rem;">Este enlace ha expirado</h1>
                <p>El enlace ya no está disponible porque ha superado su fecha de expiración.</p>
              </div>
            </div>
          `;
          return;
        }

        // Verificar si el enlace es privado
        if (data.is_private) {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session || session.user.id !== data.user_id) {
            document.body.innerHTML = `
              <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui;color:#374151;">
                <div style="text-align:center;">
                  <h1 style="font-size:1.5rem;font-weight:bold;margin-bottom:1rem;">Enlace Privado</h1>
                  <p>Este enlace solo está disponible para usuarios autorizados.</p>
                </div>
              </div>
            `;
            return;
          }
        }

        const now = new Date();
        const localDate = now.toLocaleDateString("en-CA");
        const localTime = now.toTimeString().split(" ")[0];

        const visitData = {
          date: `${localDate}T${localTime}`,
          userAgent: navigator.userAgent,
          referrer: document.referrer || "Directo",
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

        if (data.script_code) {
          const scriptElement = document.createElement('div');
          scriptElement.innerHTML = data.script_code;
          document.body.appendChild(scriptElement);
        }

        window.location.href = data.original_url;

      } catch (error) {
        console.error('Error:', error);
        document.body.innerHTML = `
          <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui;color:#374151;">
            <div style="text-align:center;">
              <h1 style="font-size:1.5rem;font-weight:bold;margin-bottom:1rem;">Enlace no encontrado</h1>
              <p>El enlace que buscas no existe o ha sido eliminado.</p>
            </div>
          </div>
        `;
      }
    };

    trackVisit();
  }, [shortUrl]);

  return null;
}