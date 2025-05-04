import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";
import { format, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Globe, Clock, Calendar, User, Link2 } from 'lucide-react';

interface VisitData {
  date: string;
  userAgent: string;
  referrer: string;
}

interface LinkData {
  id: string;
  original_url: string;
  short_url: string;
  visits: number;
  visits_history: VisitData[];
  created_at: string;
  description?: string;
  expires_at?: string;
  tags?: string[];
  is_private?: boolean;
}

export default function LinkStats() {
  const { shortUrl } = useParams<{ shortUrl: string }>();
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [browserStats, setBrowserStats] = useState<Record<string, number>>({});
  const [referrerStats, setReferrerStats] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from("links")
          .select("*")
          .eq("short_url", shortUrl)
          .single();

        if (error) throw error;

        if (!data.visits_history) {
          data.visits_history = [];
        }

        // Calcular estadísticas de navegadores
        const browsers: Record<string, number> = {};
        const referrers: Record<string, number> = {};
        
        data.visits_history.forEach((visit: VisitData) => {
          try {
            // Verificar que tenemos datos válidos
            if (!visit || typeof visit !== 'object') return;
            
            // Estadísticas de navegadores
            if (visit.userAgent) {
              const userAgent = visit.userAgent.toLowerCase();
              let browser = 'Otro';
              if (userAgent.includes('chrome')) browser = 'Chrome';
              else if (userAgent.includes('firefox')) browser = 'Firefox';
              else if (userAgent.includes('safari')) browser = 'Safari';
              else if (userAgent.includes('edge')) browser = 'Edge';
              browsers[browser] = (browsers[browser] || 0) + 1;
            }

            // Estadísticas de referrers
            const referrer = visit.referrer || 'Directo';
            referrers[referrer] = (referrers[referrer] || 0) + 1;
          } catch (error) {
            console.warn("Error al procesar visita:", error);
          }
        });

        setBrowserStats(browsers);
        setReferrerStats(referrers);
        setLinkData(data);
        setLoading(false);
      } catch (error) {
        console.error("Error al obtener estadísticas:", error);
        setLoading(false);
      }
    };

    fetchStats();
  }, [shortUrl]);

  // Agrupar visitas por día
  const visitsByDay: Record<string, number> = {};
  linkData?.visits_history.forEach((visit: VisitData) => {
    try {
      // Verificar que la fecha sea válida antes de procesarla
      const visitDate = parseISO(visit.date);
      if (!isNaN(visitDate.getTime())) {
        const date = startOfDay(visitDate).toISOString().split("T")[0];
        visitsByDay[date] = (visitsByDay[date] || 0) + 1;
      }
    } catch (error) {
      console.warn("Fecha inválida en historial de visitas:", visit.date);
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
    linkData?.visits_history
      .filter((visit: VisitData) => {
        try {
          const visitDate = parseISO(visit.date);
          if (!isNaN(visitDate.getTime())) {
            const visitDateStr = startOfDay(visitDate).toISOString().split("T")[0];
            return visitDateStr === selectedDate;
          }
          return false;
        } catch (error) {
          return false;
        }
      })
      .forEach((visit: VisitData) => {
        try {
          const visitDate = parseISO(visit.date);
          if (!isNaN(visitDate.getTime())) {
            const hour = visitDate.getHours();
            visitsByHour[hour] = (visitsByHour[hour] || 0) + 1;
          }
        } catch (error) {
          console.warn("Error al procesar hora de visita:", visit.date);
        }
      });
  }

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

          {/* Gráfico de Navegadores */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Distribución de Navegadores</h2>
            <Bar
              data={{
                labels: Object.keys(browserStats),
                datasets: [{
                  label: 'Visitas',
                  data: Object.values(browserStats),
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