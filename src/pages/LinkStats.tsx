import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";
import { format, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Globe, Clock, Calendar, User, Link2 } from 'lucide-react';

interface VisitEventData {
  visited_at: string;
  user_agent: string;
  referrer: string;
  device_type: string;
  browser: string;
}

interface LinkData {
  id: string;
  original_url: string;
  short_url: string;
  visits: number;
  created_at: string;
  description?: string;
  expires_at?: string;
  tags?: string[];
  is_private?: boolean;
}

interface StatsData {
  total_visits: number;
  unique_visitors: number;
  mobile_visits: number;
  desktop_visits: number;
  top_browsers: Record<string, number>;
}

export default function LinkStats() {
  const { shortUrl } = useParams<{ shortUrl: string }>();
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [visitEvents, setVisitEvents] = useState<VisitEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // 1. Obtener datos básicos del enlace
        const { data: linkInfo, error: linkError } = await supabase
          .from("links")
          .select("id, original_url, short_url, visits, created_at, description, expires_at")
          .eq("short_url", shortUrl)
          .single();

        if (linkError) throw linkError;

        // 2. Obtener estadísticas usando la nueva función
        const { data: stats, error: statsError } = await supabase
          .rpc('get_link_stats', { p_short_url: shortUrl });

        if (statsError) {
          console.warn("Error al obtener estadísticas:", statsError);
          // Continuar sin estadísticas avanzadas
        }

        // 3. Obtener eventos recientes para gráficos temporales
        const { data: events, error: eventsError } = await supabase
          .from('visit_events')
          .select('visited_at, user_agent, referrer, device_type, browser')
          .eq('short_url', shortUrl)
          .order('visited_at', { ascending: false })
          .limit(1000); // Últimos 1000 eventos

        if (eventsError) {
          console.warn("Error al obtener eventos:", eventsError);
          }

        setLinkData(linkInfo);
        setStatsData(stats?.[0] || null);
        setVisitEvents(events || []);
        setLoading(false);
      } catch (error) {
        console.error("Error al obtener estadísticas:", error);
        setLoading(false);
      }
    };

    fetchStats();
  }, [shortUrl]);

  // Agrupar visitas por día usando eventos reales
  const visitsByDay: Record<string, number> = {};
  visitEvents.forEach((event: VisitEventData) => {
    try {
      const visitDate = parseISO(event.visited_at);
      if (!isNaN(visitDate.getTime())) {
        const date = startOfDay(visitDate).toISOString().split("T")[0];
        visitsByDay[date] = (visitsByDay[date] || 0) + 1;
      }
    } catch (error) {
      console.warn("Fecha inválida en evento:", event.visited_at);
    }
  });

  const sortedDays = Object.keys(visitsByDay).sort();

  useEffect(() => {
    if (sortedDays.length > 0) {
      setSelectedDate(prevDate => prevDate || sortedDays[sortedDays.length - 1]);
    }
  }, [sortedDays]);

  // Agrupar visitas por hora del día seleccionado
  const visitsByHour: Record<number, number> = {};
  if (selectedDate) {
    visitEvents
      .filter((event: VisitEventData) => {
        try {
          const visitDate = parseISO(event.visited_at);
          if (!isNaN(visitDate.getTime())) {
            const visitDateStr = startOfDay(visitDate).toISOString().split("T")[0];
            return visitDateStr === selectedDate;
          }
          return false;
        } catch (error) {
          return false;
        }
      })
      .forEach((event: VisitEventData) => {
        try {
          const visitDate = parseISO(event.visited_at);
          if (!isNaN(visitDate.getTime())) {
            const hour = visitDate.getHours();
            visitsByHour[hour] = (visitsByHour[hour] || 0) + 1;
          }
        } catch (error) {
          console.warn("Error al procesar hora de visita:", event.visited_at);
        }
      });
  }

  // Calcular estadísticas de dispositivos y referrers desde eventos
  const deviceStats: Record<string, number> = {};
  const referrerStats: Record<string, number> = {};
  
  visitEvents.forEach((event: VisitEventData) => {
    // Dispositivos
    const device = event.device_type || 'Desconocido';
    deviceStats[device] = (deviceStats[device] || 0) + 1;
    
    // Referrers  
    const referrer = event.referrer || 'Directo';
    referrerStats[referrer] = (referrerStats[referrer] || 0) + 1;
  });

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  );
  
  if (!linkData) return (
    <div className="text-center mt-10 p-6 bg-red-50 rounded-lg">
      <p className="text-red-600 font-medium">No se encontraron datos para este enlace.</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto mt-10 px-4 sm:px-6 lg:px-8">
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Link2 className="w-6 h-6 mr-2 text-blue-500" />
            Estadísticas del Enlace
          </h1>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-2">
              <Globe className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">URL Original:</p>
                <a href={linkData.original_url} target="_blank" rel="noopener noreferrer" 
                   className="text-blue-600 hover:text-blue-800 break-all">
                  {linkData.original_url}
                </a>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <Link2 className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">URL Corta:</p>
                <p className="text-gray-900 break-all">
                  {window.location.origin}/{linkData.short_url}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Creado:</p>
                <p className="text-gray-900">
                  {(() => {
                    try {
                      return format(parseISO(linkData.created_at), 'dd/MM/yyyy HH:mm', { locale: es });
                    } catch (error) {
                      return 'Fecha desconocida';
                    }
                  })()}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Total de Visitas:</p>
                <p className="text-2xl font-bold text-blue-600">{linkData.visits}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Nueva sección: Estadísticas avanzadas del nuevo esquema */}
        {statsData && (
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">📊 Estadísticas Avanzadas (Nuevo Sistema)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">Visitas Totales</p>
                <p className="text-2xl font-bold text-blue-900">{statsData.total_visits}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600 font-medium">Visitantes Únicos</p>
                <p className="text-2xl font-bold text-green-900">{statsData.unique_visitors}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-600 font-medium">Visitas Móviles</p>
                <p className="text-2xl font-bold text-purple-900">{statsData.mobile_visits}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-orange-600 font-medium">Visitas Desktop</p>
                <p className="text-2xl font-bold text-orange-900">{statsData.desktop_visits}</p>
              </div>
            </div>
            {statsData.top_browsers && Object.keys(statsData.top_browsers).length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 font-medium mb-2">Navegadores Principales:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(statsData.top_browsers).map(([browser, count]) => (
                    <span key={browser} className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                      {browser}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de Visitas por Día */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Visitas por Día</h2>
            <Bar
              data={{
                labels: sortedDays.map(date => {
                  try {
                    return format(parseISO(date), 'dd/MM/yyyy', { locale: es });
                  } catch (error) {
                    return 'Fecha inválida';
                  }
                }),
                datasets: [{
                  label: 'Visitas',
                  data: sortedDays.map(date => visitsByDay[date]),
                  backgroundColor: 'rgba(59, 130, 246, 0.5)',
                  borderColor: 'rgb(59, 130, 246)',
                  borderWidth: 1
                }]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      stepSize: 1
                    }
                  }
                }
              }}
            />
          </div>

          {/* Gráfico de Dispositivos */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Distribución por Dispositivos</h2>
            <Bar
              data={{
                labels: Object.keys(deviceStats),
                datasets: [{
                  label: 'Visitas',
                  data: Object.values(deviceStats),
                  backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(153, 102, 255, 0.5)'
                  ],
                  borderColor: [
                    'rgb(255, 99, 132)',
                    'rgb(54, 162, 235)',
                    'rgb(255, 206, 86)',
                    'rgb(75, 192, 192)',
                    'rgb(153, 102, 255)'
                  ],
                  borderWidth: 1
                }]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      stepSize: 1
                    }
                  }
                }
              }}
            />
          </div>

          {/* Gráfico de Visitas por Hora */}
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Visitas por Hora</h2>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="ml-4 p-2 border rounded-md text-sm"
              >
                {sortedDays.map(date => (
                  <option key={date} value={date}>
                    {(() => {
                      try {
                        return format(parseISO(date), 'dd/MM/yyyy', { locale: es });
                      } catch (error) {
                        return 'Fecha inválida';
                      }
                    })()}
                  </option>
                ))}
              </select>
            </div>
            <Bar
              data={{
                labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                datasets: [{
                  label: 'Visitas',
                  data: Array.from({ length: 24 }, (_, i) => visitsByHour[i] || 0),
                  backgroundColor: 'rgba(16, 185, 129, 0.5)',
                  borderColor: 'rgb(16, 185, 129)',
                  borderWidth: 1
                }]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      stepSize: 1
                    }
                  }
                }
              }}
            />
          </div>

          {/* Gráfico de Fuentes de Tráfico */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Fuentes de Tráfico</h2>
            <Bar
              data={{
                labels: Object.keys(referrerStats),
                datasets: [{
                  label: 'Visitas',
                  data: Object.values(referrerStats),
                  backgroundColor: 'rgba(139, 92, 246, 0.5)',
                  borderColor: 'rgb(139, 92, 246)',
                  borderWidth: 1
                }]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      stepSize: 1
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}