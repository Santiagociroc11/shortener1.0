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

  const [showQR, setShowQR] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isYouTubeDeepLink, setIsYouTubeDeepLink] = useState(false);

  // Estados de carga
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Estados para el generador de Facebook Pixel
  const [showFbPixelGenerator, setShowFbPixelGenerator] = useState(false);
  const [fbPixelId, setFbPixelId] = useState('');
  const [productoId, setProductoId] = useState('');
  const [precio, setPrecio] = useState('');
  const [usd, setUsd] = useState('4100'); // valor por defecto
  const [diasCookie, setDiasCookie] = useState('20'); // valor por defecto

  // Estados para el sistema de generadores múltiples
  const [showScriptGenerators, setShowScriptGenerators] = useState(false);
  const [selectedGenerator, setSelectedGenerator] = useState<string | null>(null);
  
  // Estados para FB Pixel PageView (solo tracking)
  const [fbPixelIdPageView, setFbPixelIdPageView] = useState('');

  useEffect(() => {
    if (user) {
      fetchLinks();
    } else {
      setLinks([]);
    }
  }, [user]);

  const fetchLinks = async () => {
    if (!user) return;

    // ✅ OPTIMIZACIÓN: Incluir script_code para que funcionen los scripts
    const { data, error } = await supabase
      .from('links')
      .select('id, original_url, short_url, script_code, visits, created_at, description, title, expires_at')
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

  // Función para generar el script de Facebook Pixel
  const generateFacebookPixelScript = () => {
    if (!fbPixelId || !productoId || !precio || !usd) {
      toast.error('Por favor completa todos los campos del Facebook Pixel');
      return;
    }

    const script = `<script>
(async function() {
  "use strict";

  const idPIXEL = "${fbPixelId}";
  const productoId = "${productoId}";
  const precio = ${precio};
  const usd = ${usd};

//__________________________________________________________

  const diasCookie = ${diasCookie};
  const precioUsd = precio / usd;

  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.async = true;
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(\`Error loading script: \${src}\`));
    document.head.appendChild(s);
  });

  const initializeFbq = () => {
    if (!window.fbq) {
      window.fbq = (...args) =>
        window.fbq.callMethod ? window.fbq.callMethod(...args) : window.fbq.queue.push(args);
      window.fbq.queue = [];
      window.fbq.loaded = true;
      window.fbq.version = "2.0";
    }
  };

  const ensureFbq = async () => {
    initializeFbq();
    if (!window.fbq.callMethod) {
      try {
        await loadScript("https://connect.facebook.net/en_US/fbevents.js");
      } catch (error) {
        console.error("fbq script load error:", error);
      }
    }
  };

  const setCookie = (name, value, days) => {
    const expires = days ? \`; expires=\${new Date(Date.now() + days * 86400000).toUTCString()}\` : "";
    document.cookie = \`\${encodeURIComponent(name)}=\${encodeURIComponent(value)}\${expires}; path=/\`;
  };

  const getCookie = (name) => {
    const nameEQ = encodeURIComponent(name) + "=";
    return document.cookie.split(";").reduce((found, cookie) => {
      cookie = cookie.trim();
      return cookie.indexOf(nameEQ) === 0 ? decodeURIComponent(cookie.substring(nameEQ.length)) : found;
    }, null);
  };

  const triggerPurchaseEvent = () => {
    if (getCookie(productoId)) return;
    try {
      fbq("track", "Purchase", { value: precioUsd, currency: "USD" });
      setCookie(productoId, "true", diasCookie);
    } catch (error) {
      console.error("Purchase event error:", error);
    }
  };

  await ensureFbq();
  try {
    fbq("init", idPIXEL);
    fbq("track", "PageView");
  } catch (error) {
    console.error("fbq init error:", error);
  }
  triggerPurchaseEvent();
})();
</script>`;

    // Añadir el script generado a la lista
    const scriptName = `FB Pixel - ${productoId}`;
    setScripts([...scripts, { name: scriptName, code: script }]);
    
    // Limpiar campos del generador
    setFbPixelId('');
    setProductoId('');
    setPrecio('');
    setUsd('4100');
    setDiasCookie('20');
    setShowFbPixelGenerator(false);
    
    toast.success('¡Script de Facebook Pixel generado y añadido!');
  };

  // Función para generar script de Facebook Pixel PageView (solo tracking)
  const generateFacebookPixelPageView = () => {
    if (!fbPixelIdPageView) {
      toast.error('Por favor ingresa el ID del Pixel');
      return;
    }

    const script = `<script>
(async function() {
  "use strict";

  const idPIXEL = "${fbPixelIdPageView}";

  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.async = true;
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(\`Error loading script: \${src}\`));
    document.head.appendChild(s);
  });

  const initializeFbq = () => {
    if (!window.fbq) {
      window.fbq = (...args) =>
        window.fbq.callMethod ? window.fbq.callMethod(...args) : window.fbq.queue.push(args);
      window.fbq.queue = [];
      window.fbq.loaded = true;
      window.fbq.version = "2.0";
    }
  };

  const ensureFbq = async () => {
    initializeFbq();
    if (!window.fbq.callMethod) {
      try {
        await loadScript("https://connect.facebook.net/en_US/fbevents.js");
      } catch (error) {
        console.error("fbq script load error:", error);
      }
    }
  };

  await ensureFbq();
  try {
    fbq("init", idPIXEL);
    fbq("track", "PageView");
  } catch (error) {
    console.error("fbq init error:", error);
  }
})();
</script>`;

    // Añadir el script generado a la lista
    const scriptName = `FB Pixel PageView - ${fbPixelIdPageView.substring(0, 8)}...`;
    setScripts([...scripts, { name: scriptName, code: script }]);
    
    // Limpiar campos y cerrar
    setFbPixelIdPageView('');
    setSelectedGenerator(null);
    
    toast.success('¡Script de Facebook Pixel PageView generado!');
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

  // Lista de generadores disponibles
  const scriptGenerators = [
    {
      id: 'fb-pixel-product',
      name: 'FB Pixel - Producto (PageView + Purchase)',
      description: 'Tracking completo con evento de compra para productos',
      icon: '🛒'
    },
    {
      id: 'fb-pixel-pageview',
      name: 'FB Pixel - Solo PageView',
      description: 'Tracking básico sin eventos de compra',
      icon: '👁️'
    }
  ];

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

                  {/* Scripts de seguimiento */}
                  <div className="minimal-card p-6 border-gray-200">
                    <h3 className="text-gray-900 font-semibold mb-4 flex items-center">
                      Scripts de Seguimiento
                    </h3>

                    {/* Sistema de generadores múltiples */}
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-white text-sm font-bold">⚡</span>
                          </div>
                          <div>
                            <h4 className="text-gray-900 font-medium">Generadores de Scripts</h4>
                            <p className="text-blue-700 text-sm">Crea scripts automáticamente sin programar</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowScriptGenerators(!showScriptGenerators);
                            setSelectedGenerator(null);
                          }}
                          className="btn-secondary text-sm px-4 py-2"
                        >
                          {showScriptGenerators ? 'Cerrar' : '⚡ Generar Scripts'}
                        </button>
                      </div>

                      {showScriptGenerators && !selectedGenerator && (
                        <div className="space-y-3">
                          <p className="text-gray-700 text-sm mb-4">Selecciona el tipo de script que necesitas:</p>
                          <div className="grid gap-3">
                            {scriptGenerators.map((generator) => (
                              <button
                                key={generator.id}
                                type="button"
                                onClick={() => setSelectedGenerator(generator.id)}
                                className="text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
                              >
                                <div className="flex items-start">
                                  <span className="text-2xl mr-3">{generator.icon}</span>
                                  <div className="flex-1">
                                    <h5 className="font-medium text-gray-900 mb-1">{generator.name}</h5>
                                    <p className="text-sm text-gray-600">{generator.description}</p>
                                  </div>
                                  <span className="text-blue-500 text-sm">→</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Generador FB Pixel Producto */}
                      {selectedGenerator === 'fb-pixel-product' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between mb-4">
                            <h5 className="font-medium text-gray-900">🛒 Facebook Pixel - Producto</h5>
                            <button
                              type="button"
                              onClick={() => setSelectedGenerator(null)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              ← Volver
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-gray-700 font-medium mb-2 text-sm">
                                ID del Pixel *
                              </label>
                              <input
                                type="text"
                                value={fbPixelId}
                                onChange={(e) => setFbPixelId(e.target.value)}
                                className="input-minimal text-sm"
                                placeholder="823731829860705"
                              />
                            </div>
                            <div>
                              <label className="block text-gray-700 font-medium mb-2 text-sm">
                                ID del Producto *
                              </label>
                              <input
                                type="text"
                                value={productoId}
                                onChange={(e) => setProductoId(e.target.value)}
                                className="input-minimal text-sm"
                                placeholder="Nombre del producto"
                              />
                            </div>
                            <div>
                              <label className="block text-gray-700 font-medium mb-2 text-sm">
                                Precio (COP) *
                              </label>
                              <input
                                type="number"
                                value={precio}
                                onChange={(e) => setPrecio(e.target.value)}
                                className="input-minimal text-sm"
                                placeholder="Precio en COP"
                              />
                            </div>
                            <div>
                              <label className="block text-gray-700 font-medium mb-2 text-sm">
                                Tasa USD (COP)
                              </label>
                              <input
                                type="number"
                                value={usd}
                                onChange={(e) => setUsd(e.target.value)}
                                className="input-minimal text-sm"
                                placeholder="Precio dólar"
                              />
                              {precio && usd && (
                                <p className="text-xs text-blue-600 mt-1">
                                  💰 Precio USD: ${(parseFloat(precio) / parseFloat(usd)).toFixed(2)}
                                </p>
                              )}
                            </div>
                            <div>
                              <label className="block text-gray-700 font-medium mb-2 text-sm">
                                Días Cookie
                              </label>
                              <input
                                type="number"
                                value={diasCookie}
                                onChange={(e) => setDiasCookie(e.target.value)}
                                className="input-minimal text-sm"
                                placeholder="20"
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={generateFacebookPixelScript}
                                className="btn-accent w-full text-sm"
                              >
                                ✨ Generar Script Producto
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Generador FB Pixel PageView */}
                      {selectedGenerator === 'fb-pixel-pageview' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between mb-4">
                            <h5 className="font-medium text-gray-900">👁️ Facebook Pixel - Solo PageView</h5>
                            <button
                              type="button"
                              onClick={() => setSelectedGenerator(null)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              ← Volver
                            </button>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-gray-700 font-medium mb-2 text-sm">
                                ID del Pixel *
                              </label>
                              <input
                                type="text"
                                value={fbPixelIdPageView}
                                onChange={(e) => setFbPixelIdPageView(e.target.value)}
                                className="input-minimal text-sm"
                                placeholder="823731829860705"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Solo rastreará las visitas a la página, sin eventos de compra
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={generateFacebookPixelPageView}
                              className="btn-accent w-full text-sm"
                            >
                              ✨ Generar Script PageView
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scripts añadidos */}
                  {scripts.length > 0 && (
                    <div className="minimal-card p-6 border-gray-200">
                      <h4 className="text-gray-900 font-medium mb-4 flex items-center">
                        <span className="mr-2">📋</span>
                        Scripts Añadidos ({scripts.length})
                      </h4>
                      <div className="space-y-4">
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
                    </div>
                  )}

                  {/* Formulario manual para scripts personalizados */}
                  <div className="minimal-card p-6 border-gray-200">
                    <h4 className="text-gray-900 font-medium mb-4 flex items-center">
                      <span className="mr-2">📝</span>
                      Script Personalizado (Avanzado)
                    </h4>
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
                          placeholder="console.log('Script de seguimiento personalizado');"
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
                        Agregar Script Manual
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



