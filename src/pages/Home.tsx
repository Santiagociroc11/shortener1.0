import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Link2, ExternalLink, Pencil, Trash2, QrCode, Calendar, Tag, Copy, User, Sparkles, BarChart3, Link as LinkIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import Select from 'react-select';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Zap } from 'lucide-react';

// ✅ OPTIMIZACIÓN: Generador de URLs más robusto
function generateShortUrl(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const timestamp = Date.now().toString(36); // Base36 del timestamp
  const random = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  
  // Combinar timestamp + random para mayor unicidad
  return (timestamp + random).substring(0, 8);
}

// ✅ OPTIMIZACIÓN: Función para verificar y generar URL única
async function generateUniqueShortUrl(maxRetries: number = 5): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const shortUrl = generateShortUrl();
    
    // Verificar si ya existe
    const { data, error } = await supabase
      .from('links')
      .select('short_url')
      .eq('short_url', shortUrl)
      .maybeSingle();
    
    if (error) {
      console.error('Error checking URL uniqueness:', error);
      continue;
    }
    
    if (!data) {
      // URL única encontrada
      return shortUrl;
    }
  }
  
  // Fallback: usar timestamp más largo si no se encuentra URL única
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

function isYouTubeUrl(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

// Función para formatear la duración de la cookie
function formatCookieDuration(hours: string): string {
  const hoursNum = parseInt(hours);
  switch (hoursNum) {
    case 1: return '1 hora';
    case 6: return '6 horas';
    case 12: return '12 horas';
    case 24: return '24 horas (1 día)';
    case 48: return '2 días';
    case 72: return '3 días';
    case 168: return '1 semana';
    case 336: return '2 semanas';
    case 720: return '1 mes';
    case 2160: return '3 meses';
    case 4320: return '6 meses';
    case 8760: return '1 año';
    default: return `${hours} horas`;
  }
}

// Función para generar código de Facebook Pixel
function generateFacebookPixelCode(
  pixelId: string, 
  eventType: string, 
  eventValue?: string, 
  currency?: string, 
  useCookie?: boolean,
  cookieDurationHours?: string,
  eventData?: string
): string {
  const cookieCheck = useCookie ? `
  // Verificar cookie para evitar disparos múltiples
  const cookieName = 'fb_pixel_${eventType.toLowerCase()}_fired';
  if (document.cookie.split(';').some((item) => item.trim().startsWith(cookieName + '='))) {
    console.log('Facebook Pixel ${eventType} ya fue disparado para este usuario');
    return;
  }
  
  // Establecer cookie por ${cookieDurationHours || '24'} horas
  const expirationDate = new Date();
  expirationDate.setTime(expirationDate.getTime() + (${cookieDurationHours || '24'} * 60 * 60 * 1000));
  document.cookie = cookieName + '=true;expires=' + expirationDate.toUTCString() + ';path=/';
  ` : '';

  let eventParameters = '';
  if (eventType === 'Purchase' && eventValue) {
    eventParameters = `, {
    value: ${eventValue},
    currency: '${currency || 'USD'}'
  }`;
  } else if (eventType === 'Lead' && eventValue) {
    eventParameters = `, {
    value: ${eventValue},
    currency: '${currency || 'USD'}'
  }`;
  } else if (eventData) {
    try {
      // Intentar parsear como JSON
      JSON.parse(eventData);
      eventParameters = `, ${eventData}`;
    } catch {
      // Si no es JSON válido, usar como valor simple
      eventParameters = `, { content_name: '${eventData}' }`;
    }
  }

  return `
// Facebook Pixel ${eventType} Event
(function() {
  ${cookieCheck}
  
  // Cargar Facebook Pixel si no está cargado
  if (typeof fbq === 'undefined') {
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    
    fbq('init', '${pixelId}');
  }
  
  // Disparar evento
  fbq('track', '${eventType}'${eventParameters});
  
  console.log('Facebook Pixel ${eventType} disparado para pixel ID: ${pixelId}');
})();
`.trim();
}

interface Link {
  id: string;
  original_url: string;
  short_url: string;
  script_code: { name: string; code: string }[] | null;
  visits: number;
  created_at: string;
  description?: string;
  custom_slug?: string;
  expires_at?: Date | null;
  is_private?: boolean;
  title?: string;
}


export default function Home() {
  // Estados para la creación del enlace
  const [originalUrl, setOriginalUrl] = useState('');
  const [title, setTitle] = useState('');
  // Para múltiples scripts en creación, usamos un arreglo
  const [scripts, setScripts] = useState<{ name: string; code: string }[]>([]);
  // Estados para el nuevo script en el formulario de creación
  const [newScriptName, setNewScriptName] = useState('');
  const [newScriptCode, setNewScriptCode] = useState('');

  const [description, setDescription] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  // Estados para agregar un nuevo script en el modo de edición
  const [editingNewScriptName, setEditingNewScriptName] = useState('');
  const [editingNewScriptCode, setEditingNewScriptCode] = useState('');

  // Estados para Facebook Pixel
  const [facebookPixelId, setFacebookPixelId] = useState('');
  const [fbEventType, setFbEventType] = useState('PageView');
  const [fbEventValue, setFbEventValue] = useState('');
  const [fbEventCurrency, setFbEventCurrency] = useState('USD');
  const [fbUseCookie, setFbUseCookie] = useState(true);
  const [fbCookieDuration, setFbCookieDuration] = useState('24'); // en horas
  const [fbEventData, setFbEventData] = useState('');

  const [showQR, setShowQR] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isYouTubeDeepLink, setIsYouTubeDeepLink] = useState(false);
  
  // Estados de carga
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchLinks();
    } else {
      setLinks([]);
    }
  }, [user]);

  const fetchLinks = async () => {
    if (!user) return;

    // ✅ OPTIMIZACIÓN: Solo seleccionar campos necesarios para la vista
    const { data, error } = await supabase
      .from('links')
      .select('id, original_url, short_url, visits, created_at, description, title, expires_at, script_code')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error al obtener enlaces:', error);
      return;
    }

    setLinks(data || []);
  };

  // Función para agregar un nuevo script en el formulario de creación
  const handleAddScript = () => {
    if (!newScriptName || !newScriptCode) {
      toast.error("Por favor ingresa el nombre y el código del script.");
      return;
    }
    setScripts([...scripts, { name: newScriptName, code: newScriptCode }]);
    setNewScriptName('');
    setNewScriptCode('');
  };

  // Función para quitar un script de la lista de creación
  const handleRemoveScript = (index: number) => {
    const updatedScripts = scripts.filter((_, i) => i !== index);
    setScripts(updatedScripts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Debes iniciar sesión para crear enlaces');
      navigate('/login');
      return;
    }

    if (!originalUrl) {
      toast.error('Por favor, ingresa una URL');
      return;
    }

    // Validación de URL
    try {
      new URL(originalUrl);
    } catch {
      toast.error('Por favor, ingresa una URL válida');
      return;
    }

    setIsCreating(true);

    try {
      const shortUrl = customSlug || await generateUniqueShortUrl();
      let scriptCode = scripts;

      // Si es una URL de YouTube y se seleccionó el deeplink, agregamos el indicador
      if (isYouTubeUrl(originalUrl) && isYouTubeDeepLink) {
        scriptCode = [...scripts, { name: 'YouTube Deep Link', code: 'true' }];
      }

      // Si se configuró Facebook Pixel, agregarlo a los scripts
      if (facebookPixelId.trim()) {
        const fbPixelCode = generateFacebookPixelCode(
          facebookPixelId.trim(),
          fbEventType,
          fbEventValue,
          fbEventCurrency,
          fbUseCookie,
          fbCookieDuration,
          fbEventData
        );
        scriptCode = [...scriptCode, { 
          name: `Facebook Pixel - ${fbEventType}`, 
          code: fbPixelCode 
        }];
      }

      const { error } = await supabase.from('links').insert([
        {
          original_url: originalUrl,
          short_url: shortUrl,
          script_code: scriptCode,
          description,
          title,
          expires_at: expiresAt,
          is_private: false,
          user_id: user.id,
        },
      ]);

      if (error) throw error;

      const shortLink = `${window.location.origin}/${shortUrl}`;
      toast.success('¡URL acortada con éxito!');

      await navigator.clipboard.writeText(shortLink);
      toast.success('¡Copiado al portapapeles!');

      // Limpiar campos
      setOriginalUrl('');
      setTitle('');
      setScripts([]);
      setNewScriptName('');
      setNewScriptCode('');
      setDescription('');
      setCustomSlug('');
      setExpiresAt(null);
      setIsYouTubeDeepLink(false);
      // Limpiar campos de Facebook Pixel
      setFacebookPixelId('');
      setFbEventType('PageView');
      setFbEventValue('');
      setFbEventCurrency('USD');
      setFbUseCookie(true);
      setFbCookieDuration('24');
      setFbEventData('');
      fetchLinks();
    } catch (error) {
      toast.error('Error al crear la URL corta');
      console.error('Error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // En el modo de edición, permitimos actualizar los datos, incluyendo el arreglo de scripts
  const handleUpdate = async (link: Link) => {
    if (!user) {
      toast.error('Debes iniciar sesión para editar enlaces');
      navigate('/login');
      return;
    }

    try {
      const { error } = await supabase
        .from('links')
        .update({
          original_url: link.original_url,
          script_code: link.script_code,
          description: link.description,
          expires_at: link.expires_at,
          is_private: true,
          title: link.title
        })
        .eq('id', link.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setLinks(links.map(l => l.id === link.id ? link : l));
      setEditingLink(null);
      toast.success('Enlace actualizado con éxito');
    } catch (error) {
      toast.error('Error al actualizar el enlace');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) {
      toast.error('Debes iniciar sesión para eliminar enlaces');
      navigate('/login');
      return;
    }

    // Confirmación antes de eliminar
    if (!confirm('¿Estás seguro de que quieres eliminar este enlace? Esta acción no se puede deshacer.')) {
      return;
    }

    setDeletingIds(prev => new Set(prev).add(id));

    try {
      const { error } = await supabase
        .from('links')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setLinks(links.filter(link => link.id !== id));
      toast.success('Enlace eliminado con éxito');
    } catch (error) {
      toast.error('Error al eliminar el enlace');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  // Validación en tiempo real
  const isValidUrl = (url: string) => {
    if (!url) return null; // null = no hay input, true = válido, false = inválido
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const urlValidation = isValidUrl(originalUrl);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Título principal minimalista */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center p-3 bg-gray-100 rounded-lg border mb-8">
              <div className="flex items-center px-4 py-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
                <span className="text-gray-700 text-sm font-medium">Sistema Activo</span>
              </div>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold text-black mb-6 leading-tight">
              URL Shortener
              <div className="text-4xl md:text-5xl text-gray-600 mt-2">
                con Tracking
              </div>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              Crea enlaces cortos profesionales con seguimiento avanzado.
              <br />
              <span className="text-black font-medium">Simple, rápido y poderoso.</span>
            </p>

            {!user && (
              <div className="minimal-card p-8 max-w-md mx-auto">
                <div className="text-center">
                  <div className="w-16 h-16 bg-black rounded-xl flex items-center justify-center mx-auto mb-6">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-gray-700 mb-6 text-lg">
                    Inicia sesión para crear y gestionar enlaces
                  </p>
                  <button
                    onClick={() => navigate('/login')}
                    className="btn-primary w-full"
                  >
                    <span className="flex items-center justify-center">
                      Iniciar Sesión
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {user && (
            <>
              {/* Formulario de creación minimalista */}
              <div className="minimal-card p-8 mb-12 max-w-4xl mx-auto">
                <div className="flex items-center mb-8">
                  <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center mr-4">
                    <Link2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-black mb-1">Crear Nuevo Enlace</h2>
                    <p className="text-gray-600">Configura tu enlace con opciones avanzadas</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Grid de inputs principales */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Título */}
                    <div className="lg:col-span-2">
                      <label className="block text-gray-900 font-medium mb-3">
                        Título del enlace
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="input-minimal"
                        placeholder="Mi enlace importante"
                        required
                      />
                    </div>

                    {/* URL Original */}
                    <div className="lg:col-span-2">
                      <label className="block text-gray-900 font-medium mb-3">
                        URL Original
                      </label>
                      <div className="relative">
                        <input
                          type="url"
                          value={originalUrl}
                          onChange={(e) => {
                            setOriginalUrl(e.target.value);
                            setIsYouTubeDeepLink(false);
                          }}
                          className={`input-minimal ${
                            urlValidation === false ? 'border-red-300 focus:border-red-500' : 
                            urlValidation === true ? 'border-green-300 focus:border-green-500' : ''
                          }`}
                          placeholder="https://ejemplo.com"
                          required
                        />
                        {urlValidation === false && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                              <span className="text-red-600 text-xs">✕</span>
                            </div>
                          </div>
                        )}
                        {urlValidation === true && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                              <span className="text-green-600 text-xs">✓</span>
                            </div>
                          </div>
                        )}
                      </div>
                      {urlValidation === false && (
                        <p className="text-red-600 text-sm mt-2">
                          Por favor, ingresa una URL válida (debe incluir http:// o https://)
                        </p>
                      )}
                    </div>

                    {/* URL Personalizada */}
                    <div>
                      <label className="block text-gray-900 font-medium mb-3">
                        URL Personalizada (opcional)
                      </label>
                      <input
                        type="text"
                        value={customSlug}
                        onChange={(e) => setCustomSlug(e.target.value)}
                        className="input-minimal"
                        placeholder="mi-url-personalizada"
                      />
                    </div>

                    {/* Descripción */}
                    <div>
                      <label className="block text-gray-900 font-medium mb-3">
                        Descripción (opcional)
                      </label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="input-minimal"
                        placeholder="Descripción del enlace"
                      />
                    </div>
                  </div>

                  {/* Opciones avanzadas */}
                  <div className="minimal-card p-6 border-gray-200">
                    <h3 className="text-gray-900 font-semibold mb-4 flex items-center">
                      Opciones Avanzadas
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* YouTube Deep Link */}
                      {isYouTubeUrl(originalUrl) && (
                        <div className="md:col-span-2">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isYouTubeDeepLink}
                              onChange={(e) => setIsYouTubeDeepLink(e.target.checked)}
                              className="w-4 h-4 text-yellow-400 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500 focus:ring-2"
                            />
                            <span className="ml-3 text-gray-700">
                              Deep Link para YouTube (abre la app móvil)
                            </span>
                          </label>
                        </div>
                      )}

                      {/* Fecha de expiración */}
                      <div>
                        <label className="block text-gray-900 font-medium mb-3">
                          Fecha de expiración (opcional)
                        </label>
                        <DatePicker
                          selected={expiresAt}
                          onChange={(date) => setExpiresAt(date)}
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={15}
                          dateFormat="dd/MM/yyyy HH:mm"
                          locale={es}
                          placeholderText="Seleccionar fecha"
                          className="input-minimal"
                          isClearable
                        />
                      </div>
                    </div>
                  </div>

                  {/* Facebook Pixel Configuration */}
                  <div className="minimal-card p-6 border-gray-200">
                    <h3 className="text-gray-900 font-semibold mb-4 flex items-center">
                      📊 Facebook Pixel
                      <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">Nuevo</span>
                    </h3>
                    <p className="text-gray-600 text-sm mb-6">
                      Configura un píxel de Facebook para hacer seguimiento de conversiones y crear audiencias.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Pixel ID */}
                      <div className="md:col-span-2">
                        <label className="block text-gray-900 font-medium mb-3">
                          ID del Píxel de Facebook (opcional)
                        </label>
                        <input
                          type="text"
                          value={facebookPixelId}
                          onChange={(e) => setFacebookPixelId(e.target.value)}
                          className="input-minimal"
                          placeholder="123456789012345"
                        />
                        <p className="text-gray-500 text-xs mt-2">
                          Encuentra tu Pixel ID en el Administrador de eventos de Facebook
                        </p>
                      </div>

                      {facebookPixelId.trim() && (
                        <>
                          {/* Tipo de evento */}
                          <div>
                            <label className="block text-gray-900 font-medium mb-3">
                              Tipo de Evento
                            </label>
                            <select
                              value={fbEventType}
                              onChange={(e) => setFbEventType(e.target.value)}
                              className="input-minimal"
                            >
                              <option value="PageView">PageView (Vista de página)</option>
                              <option value="ViewContent">ViewContent (Ver contenido)</option>
                              <option value="Lead">Lead (Prospecto)</option>
                              <option value="Purchase">Purchase (Compra)</option>
                              <option value="AddToCart">AddToCart (Añadir al carrito)</option>
                              <option value="InitiateCheckout">InitiateCheckout (Iniciar checkout)</option>
                              <option value="AddPaymentInfo">AddPaymentInfo (Añadir info de pago)</option>
                              <option value="CompleteRegistration">CompleteRegistration (Completar registro)</option>
                              <option value="Contact">Contact (Contacto)</option>
                              <option value="Subscribe">Subscribe (Suscribirse)</option>
                            </select>
                          </div>

                          {/* Usar Cookie */}
                          <div className="flex items-center">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={fbUseCookie}
                                onChange={(e) => setFbUseCookie(e.target.checked)}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                              />
                              <span className="ml-3 text-gray-700">
                                Usar cookie para evitar disparos múltiples
                              </span>
                            </label>
                          </div>

                          {/* Duración de Cookie */}
                          {fbUseCookie && (
                            <div>
                              <label className="block text-gray-900 font-medium mb-3">
                                Duración de la Cookie
                              </label>
                              <select
                                value={fbCookieDuration}
                                onChange={(e) => setFbCookieDuration(e.target.value)}
                                className="input-minimal"
                              >
                                <option value="1">1 hora</option>
                                <option value="6">6 horas</option>
                                <option value="12">12 horas</option>
                                <option value="24">24 horas (1 día)</option>
                                <option value="48">48 horas (2 días)</option>
                                <option value="72">72 horas (3 días)</option>
                                <option value="168">1 semana</option>
                                <option value="336">2 semanas</option>
                                <option value="720">1 mes (30 días)</option>
                                <option value="2160">3 meses (90 días)</option>
                                <option value="4320">6 meses (180 días)</option>
                                <option value="8760">1 año (365 días)</option>
                              </select>
                              <p className="text-gray-500 text-xs mt-2">
                                Tiempo que durará la cookie para evitar disparos duplicados
                              </p>
                            </div>
                          )}

                          {/* Valor del evento (para Purchase y Lead) */}
                          {(fbEventType === 'Purchase' || fbEventType === 'Lead') && (
                            <>
                              <div>
                                <label className="block text-gray-900 font-medium mb-3">
                                  Valor del Evento
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={fbEventValue}
                                  onChange={(e) => setFbEventValue(e.target.value)}
                                  className="input-minimal"
                                  placeholder="0.00"
                                />
                              </div>

                              <div>
                                <label className="block text-gray-900 font-medium mb-3">
                                  Moneda
                                </label>
                                <select
                                  value={fbEventCurrency}
                                  onChange={(e) => setFbEventCurrency(e.target.value)}
                                  className="input-minimal"
                                >
                                  <option value="USD">USD - Dólar Estadounidense</option>
                                  <option value="EUR">EUR - Euro</option>
                                  <option value="MXN">MXN - Peso Mexicano</option>
                                  <option value="COP">COP - Peso Colombiano</option>
                                  <option value="ARS">ARS - Peso Argentino</option>
                                  <option value="CLP">CLP - Peso Chileno</option>
                                  <option value="PEN">PEN - Sol Peruano</option>
                                  <option value="BRL">BRL - Real Brasileño</option>
                                </select>
                              </div>
                            </>
                          )}

                          {/* Datos adicionales del evento */}
                          <div className="md:col-span-2">
                            <label className="block text-gray-900 font-medium mb-3">
                              Datos Adicionales del Evento (JSON opcional)
                            </label>
                            <textarea
                              value={fbEventData}
                              onChange={(e) => setFbEventData(e.target.value)}
                              className="textarea-minimal h-20"
                              placeholder='{"content_name": "Mi Producto", "content_category": "Categoria"}'
                            />
                            <p className="text-gray-500 text-xs mt-2">
                              Formato JSON para parámetros adicionales. Ejemplo: content_name, content_category, etc.
                            </p>
                          </div>

                          {/* Preview del evento */}
                          <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="text-blue-900 font-medium mb-2 flex items-center">
                              👁️ Vista previa del evento
                            </h4>
                            <div className="text-sm text-blue-800">
                              <div><strong>Pixel ID:</strong> {facebookPixelId}</div>
                              <div><strong>Evento:</strong> {fbEventType}</div>
                              {(fbEventType === 'Purchase' || fbEventType === 'Lead') && fbEventValue && (
                                <div><strong>Valor:</strong> {fbEventValue} {fbEventCurrency}</div>
                              )}
                              <div><strong>Control de Cookie:</strong> {
                                fbUseCookie 
                                  ? `Sí (${formatCookieDuration(fbCookieDuration)})` 
                                  : 'No'
                              }</div>
                              {fbEventData && (
                                <div><strong>Datos adicionales:</strong> Configurados</div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Scripts de seguimiento */}
                  <div className="minimal-card p-6 border-gray-200">
                    <h3 className="text-gray-900 font-semibold mb-4 flex items-center">
                      Scripts de Seguimiento
                    </h3>
                    
                    {scripts.length > 0 && (
                      <div className="space-y-4 mb-6">
                        {scripts.map((script, index) => (
                          <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-gray-900 font-medium">{script.name}</span>
                              <button
                                type="button"
                                onClick={() => setScripts(scripts.filter((_, i) => i !== index))}
                                className="text-red-600 hover:text-red-800 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <code className="code-minimal block overflow-x-auto">
                              {script.code.substring(0, 100)}...
                            </code>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        value={newScriptName}
                        onChange={(e) => setNewScriptName(e.target.value)}
                        className="input-minimal"
                        placeholder="Nombre del script"
                      />
                      <div className="md:col-span-2">
                        <textarea
                          value={newScriptCode}
                          onChange={(e) => setNewScriptCode(e.target.value)}
                          className="textarea-minimal"
                          placeholder="console.log('Script de seguimiento');"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (newScriptName && newScriptCode) {
                            setScripts([...scripts, { name: newScriptName, code: newScriptCode }]);
                            setNewScriptName('');
                            setNewScriptCode('');
                          }
                        }}
                        className="btn-secondary md:col-span-2"
                      >
                        Agregar Script
                      </button>
                    </div>
                  </div>

                  {/* Botón de creación */}
                  <button
                    type="submit"
                    disabled={isCreating}
                    className={`btn-accent w-full text-lg py-4 font-semibold ${
                      isCreating ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <span className="flex items-center justify-center">
                      {isCreating ? (
                        <>
                          <div className="spinner mr-2"></div>
                          Creando enlace...
                        </>
                      ) : (
                        <>
                          Crear Enlace
                          <Zap className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </span>
                  </button>
                </form>
              </div>

              {/* Lista de enlaces minimalista */}
              {links.length > 0 && (
                <div className="minimal-card p-8 max-w-6xl mx-auto">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center mr-4">
                        <Link2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-black mb-1">Tus Enlaces</h2>
                        <p className="text-gray-600">
                          {links.length > 0 ? `${links.length} enlaces creados` : 'Aún no tienes enlaces'}
                        </p>
                      </div>
                    </div>
                    {links.length > 0 && (
                      <div className="badge-minimal">
                        <span className="status-dot status-active"></span>
                        Activos
                      </div>
                    )}
                  </div>

                  {links.length === 0 ? (
                    // Estado vacío
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Link2 className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">
                        No tienes enlaces aún
                      </h3>
                      <p className="text-gray-500 mb-4 max-w-md mx-auto">
                        Crea tu primer enlace corto usando el formulario de arriba. 
                        Podrás hacer seguimiento de clicks y añadir scripts personalizados.
                      </p>
                      <div className="flex items-center justify-center text-gray-400 text-sm">
                        <span>💡 Tip: Puedes usar URLs personalizadas para que sean más fáciles de recordar</span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-6">
                      {links.map(link => (
                        <div key={link.id} className="minimal-card p-6 border border-gray-200 hover:border-gray-300 transition-all duration-300">
                          {editingLink?.id === link.id ? (
                            /* Modo de edición */
                            <div className="space-y-6">
                              <div className="flex items-center mb-6">
                                <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center mr-3">
                                  <Pencil className="w-5 h-5 text-black" />
                                </div>
                                <h3 className="text-xl font-semibold text-black">Editando Enlace</h3>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Título */}
                                <div className="md:col-span-2">
                                  <label className="block text-gray-900 font-medium mb-3">
                                    Título
                                  </label>
                                  <input
                                    type="text"
                                    value={editingLink.title || ''}
                                    onChange={e => setEditingLink({
                                      ...editingLink,
                                      title: e.target.value
                                    })}
                                    className="input-minimal w-full"
                                    placeholder="Título del enlace"
                                  />
                                </div>

                                {/* URL Original */}
                                <div className="md:col-span-2">
                                  <label className="block text-gray-900 font-medium mb-3">
                                    URL Original
                                  </label>
                                  <input
                                    type="url"
                                    value={editingLink.original_url}
                                    onChange={e => setEditingLink({
                                      ...editingLink,
                                      original_url: e.target.value
                                    })}
                                    className="input-minimal w-full"
                                  />
                                </div>
                              </div>

                              {/* Scripts de seguimiento en edición */}
                              <div className="minimal-card p-6 border border-gray-200">
                                <h4 className="text-gray-900 font-semibold mb-4 flex items-center">
                                  Scripts de Seguimiento
                                </h4>
                                
                                {editingLink.script_code && editingLink.script_code.map((script, index) => (
                                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                                    <input
                                      type="text"
                                      value={script.name}
                                      onChange={(e) => {
                                        const newScripts = editingLink.script_code ? [...editingLink.script_code] : [];
                                        newScripts[index].name = e.target.value;
                                        setEditingLink({ ...editingLink, script_code: newScripts });
                                      }}
                                      className="input-minimal w-full mb-3"
                                      placeholder="Nombre del script"
                                    />
                                    <textarea
                                      value={script.code}
                                      onChange={(e) => {
                                        const newScripts = editingLink.script_code ? [...editingLink.script_code] : [];
                                        newScripts[index].code = e.target.value;
                                        setEditingLink({ ...editingLink, script_code: newScripts });
                                      }}
                                      className="textarea-minimal w-full h-24 resize-none mb-3"
                                      placeholder="Código del script"
                                    ></textarea>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newScripts = editingLink.script_code ? editingLink.script_code.filter((_, i) => i !== index) : [];
                                        setEditingLink({ ...editingLink, script_code: newScripts });
                                      }}
                                      className="text-red-600 hover:text-red-800 transition-colors flex items-center"
                                    >
                                      <Trash2 className="w-4 h-4 mr-1" />
                                      Quitar Script
                                    </button>
                                  </div>
                                ))}

                                {/* Agregar nuevo script en edición */}
                                <div className="space-y-3">
                                  <input
                                    type="text"
                                    value={editingNewScriptName}
                                    onChange={(e) => setEditingNewScriptName(e.target.value)}
                                    placeholder="Nombre del script"
                                    className="input-minimal w-full"
                                  />
                                  <textarea
                                    value={editingNewScriptCode}
                                    onChange={(e) => setEditingNewScriptCode(e.target.value)}
                                    placeholder="Código del script"
                                    className="textarea-minimal w-full h-24 resize-none"
                                  ></textarea>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!editingNewScriptName || !editingNewScriptCode) {
                                        toast.error("Por favor, ingresa nombre y código del script.");
                                        return;
                                      }
                                      const newScripts = editingLink && editingLink.script_code ? [...editingLink.script_code] : [];
                                      newScripts.push({ name: editingNewScriptName, code: editingNewScriptCode });
                                      setEditingLink({ ...editingLink!, script_code: newScripts });
                                      setEditingNewScriptName('');
                                      setEditingNewScriptCode('');
                                    }}
                                    className="btn-secondary"
                                  >
                                    Agregar Script
                                  </button>
                                </div>
                              </div>

                              <div className="flex space-x-4">
                                <button
                                  onClick={() => handleUpdate(editingLink)}
                                  className="btn-accent flex-1"
                                >
                                  <span className="flex items-center justify-center">
                                    Guardar Cambios
                                    <ExternalLink className="w-4 h-4 ml-2" />
                                  </span>
                                </button>
                                <button
                                  onClick={() => setEditingLink(null)}
                                  className="btn-secondary flex-1"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Vista normal del enlace */
                            <div>
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center mb-2">
                                    <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center mr-3">
                                      <Link2 className="w-4 h-4 text-gray-700" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-700 truncate">
                                      {link.title || 'Sin título'}
                                    </h3>
                                  </div>
                                  
                                  <div className="space-y-2 mb-4">
                                    <div className="flex items-center justify-between text-gray-600">
                                      <span className="text-sm font-medium">Enlace corto:</span>
                                      <button
                                        onClick={async () => {
                                          const shortLink = `${window.location.origin}/${link.short_url}`;
                                          await navigator.clipboard.writeText(shortLink);
                                          toast.success('¡Copiado!');
                                        }}
                                        className="text-xs text-yellow-600 hover:text-yellow-800 font-medium"
                                      >
                                        Click para copiar
                                      </button>
                                    </div>
                                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                                      <code className="text-gray-700 font-mono text-sm flex-1 mr-2">
                                        {window.location.origin}/{link.short_url}
                                      </code>
                                      <Copy className="w-4 h-4 text-gray-400" />
                                    </div>
                                    
                                    <div className="flex items-center text-gray-500 text-sm">
                                      <span className="font-medium mr-2">Destino:</span>
                                      <a 
                                        href={link.original_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="link-minimal truncate max-w-md hover:text-black"
                                      >
                                        {link.original_url}
                                      </a>
                                    </div>
                                    
                                    {link.description && (
                                      <div className="flex items-center text-gray-500 text-sm">
                                        <span className="font-medium mr-2">Descripción:</span>
                                        <span className="truncate">{link.description}</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center space-x-4 text-gray-400">
                                    <div className="flex items-center">
                                      <BarChart3 className="w-4 h-4 mr-1" />
                                      <span className="text-sm">{link.visits} visitas</span>
                                    </div>
                                    <div className="flex items-center">
                                      <Calendar className="w-4 h-4 mr-1" />
                                      <span className="text-sm">
                                        {format(new Date(link.created_at), 'dd MMM yyyy', { locale: es })}
                                      </span>
                                    </div>
                                    {link.script_code && link.script_code.length > 0 && (
                                      <div className="flex items-center">
                                        <Tag className="w-4 h-4 mr-1" />
                                        <span className="text-sm">{link.script_code.length} scripts</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center space-x-2 ml-4">
                                  <button
                                    onClick={() => setShowQR(link.short_url)}
                                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-300 group"
                                    title="Mostrar QR"
                                  >
                                    <QrCode className="w-4 h-4 text-gray-700 group-hover:scale-110 transition-transform" />
                                  </button>
                                  
                                  <button
                                    onClick={() => setEditingLink(link)}
                                    className="p-2 bg-yellow-400/20 hover:bg-yellow-400/30 rounded-xl transition-all duration-300 group"
                                    title="Editar"
                                  >
                                    <Pencil className="w-4 h-4 text-yellow-300 group-hover:scale-110 transition-transform" />
                                  </button>
                                  
                                  <button
                                    onClick={() => handleDelete(link.id)}
                                    disabled={deletingIds.has(link.id)}
                                    className={`p-2 rounded-xl transition-all duration-300 group ${
                                      deletingIds.has(link.id) 
                                        ? 'bg-red-100 opacity-50 cursor-not-allowed' 
                                        : 'bg-red-500/20 hover:bg-red-500/30'
                                    }`}
                                    title="Eliminar"
                                  >
                                    {deletingIds.has(link.id) ? (
                                      <div className="spinner w-4 h-4"></div>
                                    ) : (
                                      <Trash2 className="w-4 h-4 text-red-600 group-hover:scale-110 transition-transform" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {link.script_code && link.script_code.length > 0 && (
                                <div className="mt-4 p-4 bg-gray-100 rounded-lg border border-gray-200">
                                  <h4 className="text-gray-900 font-medium mb-2 flex items-center">
                                    🎯 Scripts Activos
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {link.script_code.map((script, index) => (
                                      <span 
                                        key={index} 
                                        className="badge-minimal text-xs"
                                        title={script.code.substring(0, 100)}
                                      >
                                        {script.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {links.length > 0 && (
                    <div className="mt-8 p-6 bg-gradient-to-r from-yellow-400/10 to-yellow-400/10 rounded-2xl border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-gray-700 font-semibold mb-1">¿Necesitas más funciones?</h3>
                          <p className="text-gray-500 text-sm">Explora el dashboard completo para análisis avanzado</p>
                        </div>
                        <a
                          href="/dashboard"
                          className="btn-accent px-6 py-3"
                        >
                          <span className="flex items-center">
                            Ver Dashboard
                            <ExternalLink className="w-4 h-4 ml-2" />
                          </span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal QR minimalista */}
      {showQR && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="minimal-card p-8 max-w-sm w-full mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <QrCode className="w-8 h-8 text-black" />
              </div>
              
              <h3 className="text-2xl font-bold text-black mb-2">Código QR</h3>
              <p className="text-gray-700 mb-6">Escanea para acceder al enlace</p>
              
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-white rounded-2xl">
                  <QRCodeSVG
                    value={`${window.location.origin}/${showQR}`}
                    size={200}
                    level="H"
                    className="drop-shadow-lg"
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    const shortLink = `${window.location.origin}/${showQR}`;
                    await navigator.clipboard.writeText(shortLink);
                    toast.success('¡Enlace copiado! ✨');
                  }}
                  className="btn-accent w-full"
                >
                  <span className="flex items-center justify-center">
                    <Copy className="w-5 h-5 mr-2" />
                    Copiar Enlace
                  </span>
                </button>
                
                <button
                  onClick={() => setShowQR(null)}
                  className="btn-secondary w-full"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer minimalista */}
      <footer className="relative mt-20 py-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="minimal-card p-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center mr-4">
                <Link2 className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-black">SCC Shortener</h3>
                <p className="text-gray-700 text-sm">Advanced URL Tracking</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center text-gray-600 text-sm">
              <span>Desarrollado con</span>
              <span className="mx-2 text-red-400">❤️</span>
              <span>por</span>
              <span className="ml-1 font-medium text-gray-800">Santiago Ciro - Automscc</span>
            </div>
            
            <div className="mt-4 flex items-center justify-center space-x-4 text-gray-400">
              <div className="w-2 h-2 bg-yellow-400 rounded-full pulse-glow"></div>
              <span className="text-xs">Sistema funcionando perfectamente</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

