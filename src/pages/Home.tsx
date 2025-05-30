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
      .select('id, original_url, short_url, visits, created_at, description, title, expires_at')
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
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Hero Section */}
      <div className="relative overflow-hidden py-20 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Título principal con efectos visuales */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center p-2 bg-white/10 rounded-full backdrop-blur-md border border-white/20 mb-6">
              <div className="flex items-center px-4 py-2">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-3 pulse-glow"></div>
                <span className="text-white/90 text-sm font-medium">Sistema Activo</span>
              </div>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white via-purple-100 to-pink-100 bg-clip-text text-transparent">
                Acorta
              </span>
              <br />
              <span className="bg-gradient-to-r from-purple-200 via-pink-200 to-white bg-clip-text text-transparent">
                y Rastrea
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/80 mb-8 max-w-3xl mx-auto leading-relaxed">
              Crea enlaces inteligentes con seguimiento avanzado y scripts personalizados.
              <br />
              <span className="text-purple-200 font-medium">Analítica en tiempo real, diseño profesional.</span>
            </p>

            {!user && (
              <div className="glass-card p-8 max-w-md mx-auto">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 float-animation">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-white/90 mb-6 text-lg">
                    Únete para crear y gestionar tus enlaces
                  </p>
                  <button
                    onClick={() => navigate('/login')}
                    className="btn-gradient w-full"
                  >
                    <span className="flex items-center justify-center">
                      Iniciar Sesión
                      <Sparkles className="w-5 h-5 ml-2" />
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {user && (
            <>
              {/* Formulario de creación moderno */}
              <div className="glass-card p-8 mb-12 max-w-4xl mx-auto">
                <div className="flex items-center mb-8">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mr-4 float-animation">
                    <Link2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Crear Nuevo Enlace</h2>
                    <p className="text-white/70">Configura tu enlace con opciones avanzadas</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Grid de inputs principales */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Título */}
                    <div className="lg:col-span-2">
                      <label className="block text-white/90 font-medium mb-3 text-lg">
                        🏷️ Título del enlace
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="input-modern w-full"
                        placeholder="Mi enlace importante"
                        required
                      />
                    </div>

                    {/* URL Original */}
                    <div className="lg:col-span-2">
                      <label className="block text-white/90 font-medium mb-3 text-lg">
                        🔗 URL Original
                      </label>
                      <input
                        type="url"
                        value={originalUrl}
                        onChange={(e) => {
                          setOriginalUrl(e.target.value);
                          setIsYouTubeDeepLink(false);
                        }}
                        className="input-modern w-full"
                        placeholder="https://ejemplo.com"
                        required
                      />
                    </div>

                    {/* URL Personalizada */}
                    <div>
                      <label className="block text-white/90 font-medium mb-3 text-lg">
                        ⚡ URL Personalizada
                      </label>
                      <input
                        type="text"
                        value={customSlug}
                        onChange={(e) => setCustomSlug(e.target.value)}
                        className="input-modern w-full"
                        placeholder="mi-url-personalizada"
                      />
                    </div>

                    {/* Descripción */}
                    <div>
                      <label className="block text-white/90 font-medium mb-3 text-lg">
                        📝 Descripción
                      </label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="input-modern w-full"
                        placeholder="Descripción del enlace"
                      />
                    </div>
                  </div>

                  {/* Opciones avanzadas */}
                  <div className="glass-card p-6 border border-white/10">
                    <h3 className="text-white/90 font-semibold mb-4 text-lg flex items-center">
                      🚀 Opciones Avanzadas
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
                              className="sr-only"
                            />
                            <div className={`w-6 h-6 rounded-lg border-2 transition-all duration-300 ${
                              isYouTubeDeepLink 
                                ? 'bg-red-500 border-red-500' 
                                : 'border-white/30 bg-white/10'
                            }`}>
                              {isYouTubeDeepLink && (
                                <svg className="w-4 h-4 text-white ml-0.5 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className="ml-3 text-white/90">
                              🎥 Deep Link para YouTube (abre la app móvil)
                            </span>
                          </label>
                        </div>
                      )}

                      {/* Fecha de expiración */}
                      <div>
                        <label className="block text-white/90 font-medium mb-3">
                          📅 Fecha de expiración
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
                          className="input-modern w-full"
                          isClearable
                        />
                      </div>
                    </div>
                  </div>

                  {/* Scripts de seguimiento */}
                  <div className="glass-card p-6 border border-white/10">
                    <h3 className="text-white/90 font-semibold mb-4 text-lg flex items-center">
                      🎯 Scripts de Seguimiento
                    </h3>
                    
                    {scripts.length > 0 && (
                      <div className="space-y-4 mb-6">
                        {scripts.map((script, index) => (
                          <div key={index} className="bg-white/5 p-4 rounded-xl border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-white/90 font-medium">{script.name}</span>
                              <button
                                type="button"
                                onClick={() => setScripts(scripts.filter((_, i) => i !== index))}
                                className="text-red-400 hover:text-red-300 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <code className="text-purple-200 text-sm font-mono bg-black/20 p-2 rounded-lg block overflow-x-auto">
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
                        className="input-modern"
                        placeholder="Nombre del script"
                      />
                      <div className="md:col-span-2">
                        <textarea
                          value={newScriptCode}
                          onChange={(e) => setNewScriptCode(e.target.value)}
                          className="input-modern w-full h-24 resize-none"
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
                    className="btn-gradient w-full text-lg py-4"
                  >
                    <span className="flex items-center justify-center">
                      Crear Enlace Inteligente
                      <Zap className="w-6 h-6 ml-2" />
                    </span>
                  </button>
                </form>
              </div>

              {/* Lista de enlaces moderna */}
              {links.length > 0 && (
                <div className="glass-card p-8 max-w-6xl mx-auto">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl flex items-center justify-center mr-4 float-animation">
                        <Link2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-1">Tus Enlaces</h2>
                        <p className="text-white/70">{links.length} enlaces creados</p>
                      </div>
                    </div>
                    <div className="badge-modern">
                      <span className="status-indicator status-active"></span>
                      Activos
                    </div>
                  </div>

                  <div className="grid gap-6">
                    {links.map(link => (
                      <div key={link.id} className="glass-card p-6 border border-white/10 hover:border-white/20 transition-all duration-300">
                        {editingLink?.id === link.id ? (
                          /* Modo de edición */
                          <div className="space-y-6">
                            <div className="flex items-center mb-6">
                              <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center mr-3">
                                <Pencil className="w-5 h-5 text-white" />
                              </div>
                              <h3 className="text-xl font-semibold text-white">Editando Enlace</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Título */}
                              <div className="md:col-span-2">
                                <label className="block text-white/90 font-medium mb-3">
                                  🏷️ Título
                                </label>
                                <input
                                  type="text"
                                  value={editingLink.title || ''}
                                  onChange={e => setEditingLink({
                                    ...editingLink,
                                    title: e.target.value
                                  })}
                                  className="input-modern w-full"
                                  placeholder="Título del enlace"
                                />
                              </div>

                              {/* URL Original */}
                              <div className="md:col-span-2">
                                <label className="block text-white/90 font-medium mb-3">
                                  🔗 URL Original
                                </label>
                                <input
                                  type="url"
                                  value={editingLink.original_url}
                                  onChange={e => setEditingLink({
                                    ...editingLink,
                                    original_url: e.target.value
                                  })}
                                  className="input-modern w-full"
                                />
                              </div>
                            </div>

                            {/* Scripts de seguimiento en edición */}
                            <div className="glass-card p-6 border border-white/10">
                              <h4 className="text-white/90 font-semibold mb-4 flex items-center">
                                🎯 Scripts de Seguimiento
                              </h4>
                              
                              {editingLink.script_code && editingLink.script_code.map((script, index) => (
                                <div key={index} className="bg-white/5 p-4 rounded-xl border border-white/10 mb-4">
                                  <input
                                    type="text"
                                    value={script.name}
                                    onChange={(e) => {
                                      const newScripts = editingLink.script_code ? [...editingLink.script_code] : [];
                                      newScripts[index].name = e.target.value;
                                      setEditingLink({ ...editingLink, script_code: newScripts });
                                    }}
                                    className="input-modern w-full mb-3"
                                    placeholder="Nombre del script"
                                  />
                                  <textarea
                                    value={script.code}
                                    onChange={(e) => {
                                      const newScripts = editingLink.script_code ? [...editingLink.script_code] : [];
                                      newScripts[index].code = e.target.value;
                                      setEditingLink({ ...editingLink, script_code: newScripts });
                                    }}
                                    className="input-modern w-full h-24 resize-none mb-3"
                                    placeholder="Código del script"
                                  ></textarea>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newScripts = editingLink.script_code ? editingLink.script_code.filter((_, i) => i !== index) : [];
                                      setEditingLink({ ...editingLink, script_code: newScripts });
                                    }}
                                    className="text-red-400 hover:text-red-300 transition-colors flex items-center"
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
                                  className="input-modern w-full"
                                />
                                <textarea
                                  value={editingNewScriptCode}
                                  onChange={(e) => setEditingNewScriptCode(e.target.value)}
                                  placeholder="Código del script"
                                  className="input-modern w-full h-24 resize-none"
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
                                className="btn-gradient flex-1"
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
                                  <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-400 rounded-lg flex items-center justify-center mr-3">
                                    <Link2 className="w-4 h-4 text-white" />
                                  </div>
                                  <h3 className="text-lg font-semibold text-white truncate">
                                    {link.title || 'Sin título'}
                                  </h3>
                                </div>
                                
                                <div className="space-y-2 mb-4">
                                  <div className="flex items-center text-white/80">
                                    <span className="text-sm">🔗 Enlace corto:</span>
                                    <code className="ml-2 px-2 py-1 bg-black/20 rounded text-purple-200 font-mono text-sm">
                                      {window.location.origin}/{link.short_url}
                                    </code>
                                  </div>
                                  <div className="flex items-center text-white/70">
                                    <span className="text-sm">🌐 Destino:</span>
                                    <span className="ml-2 text-sm truncate max-w-md">
                                      {link.original_url}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-4 text-white/60">
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
                                  onClick={async () => {
                                    const shortLink = `${window.location.origin}/${link.short_url}`;
                                    await navigator.clipboard.writeText(shortLink);
                                    toast.success('¡Copiado! ✨');
                                  }}
                                  className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-300 group"
                                  title="Copiar enlace"
                                >
                                  <Copy className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                                </button>
                                
                                <button
                                  onClick={() => setShowQR(link.short_url)}
                                  className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-300 group"
                                  title="Mostrar QR"
                                >
                                  <QrCode className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                                </button>
                                
                                <button
                                  onClick={() => setEditingLink(link)}
                                  className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-xl transition-all duration-300 group"
                                  title="Editar"
                                >
                                  <Pencil className="w-4 h-4 text-blue-300 group-hover:scale-110 transition-transform" />
                                </button>
                                
                                <button
                                  onClick={() => handleDelete(link.id)}
                                  className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl transition-all duration-300 group"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4 text-red-300 group-hover:scale-110 transition-transform" />
                                </button>
                              </div>
                            </div>

                            {link.script_code && link.script_code.length > 0 && (
                              <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                                <h4 className="text-white/90 font-medium mb-2 flex items-center">
                                  🎯 Scripts Activos
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {link.script_code.map((script, index) => (
                                    <span 
                                      key={index} 
                                      className="badge-modern text-xs"
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

                  <div className="mt-8 p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-white font-semibold mb-1">¿Necesitas más funciones?</h3>
                        <p className="text-white/70 text-sm">Explora el dashboard completo para análisis avanzado</p>
                      </div>
                      <a
                        href="/dashboard"
                        className="btn-gradient px-6 py-3"
                      >
                        <span className="flex items-center">
                          Ver Dashboard
                          <ExternalLink className="w-4 h-4 ml-2" />
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal QR moderno */}
      {showQR && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card p-8 max-w-sm w-full mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6 float-animation">
                <QrCode className="w-8 h-8 text-white" />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2">Código QR</h3>
              <p className="text-white/70 mb-6">Escanea para acceder al enlace</p>
              
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
                  className="btn-gradient w-full"
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

      {/* Footer moderno */}
      <footer className="relative mt-20 py-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="glass-card p-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mr-4 float-animation">
                <Link2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">SCC Shortener</h3>
                <p className="text-white/70 text-sm">Advanced URL Tracking</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center text-white/60 text-sm">
              <span>Desarrollado con</span>
              <span className="mx-2 text-red-400">❤️</span>
              <span>por</span>
              <span className="ml-1 font-medium text-white/80">Santiago Ciro - Automscc</span>
            </div>
            
            <div className="mt-4 flex items-center justify-center space-x-4 text-white/40">
              <div className="w-2 h-2 bg-green-400 rounded-full pulse-glow"></div>
              <span className="text-xs">Sistema funcionando perfectamente</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

