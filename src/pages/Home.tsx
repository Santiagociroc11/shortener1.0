import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Link2, ExternalLink, Pencil, Trash2, QrCode, Calendar, Tag, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import Select from 'react-select';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function generateShortUrl() {
  return Math.random().toString(36).substring(2, 8);
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

    const { data, error } = await supabase
      .from('links')
      .select('*')
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
      const shortUrl = customSlug || generateShortUrl();
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
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Acortador de URLs con Seguimiento
        </h1>
        <p className="text-xl text-gray-600">
          Crea enlaces cortos y agrega scripts de seguimiento personalizados
        </p>
        {!user && (
          <div className="mt-6">
            <p className="text-gray-600 mb-4">
              Inicia sesión para crear y gestionar tus enlaces
            </p>
            <button
              onClick={() => navigate('/login')}
              className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Iniciar Sesión
            </button>
          </div>
        )}
      </div>

      {user && (
        <>
          {/* Formulario de creación */}
          <div className="bg-white rounded-lg shadow-md p-6 md:p-8 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Título */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Título del enlace
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Mi enlace importante"
                  required
                />
              </div>

              {/* URL Original */}
              <div>
                <label htmlFor="originalUrl" className="block text-sm font-medium text-gray-700 mb-2">
                  URL Original
                </label>
                <input
                  type="url"
                  id="originalUrl"
                  value={originalUrl}
                  onChange={(e) => {
                    setOriginalUrl(e.target.value);
                    // Resetear el estado de YouTube Deep Link cuando cambia la URL
                    setIsYouTubeDeepLink(false);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://ejemplo.com"
                  required
                />
              </div>

              {/* Opción de YouTube Deep Link */}
              {isYouTubeUrl(originalUrl) && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="youtubeDeepLink"
                    checked={isYouTubeDeepLink}
                    onChange={(e) => setIsYouTubeDeepLink(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="youtubeDeepLink" className="ml-2 block text-sm text-gray-700">
                    Activar Deep Link para YouTube (abrirá la app de YouTube en dispositivos móviles)
                  </label>
                </div>
              )}

              {/* URL Personalizada */}
              <div>
                <label htmlFor="customSlug" className="block text-sm font-medium text-gray-700 mb-2">
                  URL Personalizada (opcional)
                </label>
                <input
                  type="text"
                  id="customSlug"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="mi-url-personalizada"
                />
              </div>

              {/* Descripción */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Descripción del enlace"
                  rows={2}
                />
              </div>

              {/* Fecha de Expiración */}
              <div>
                <label htmlFor="expiresAt" className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Expiración (opcional)
                </label>
                <DatePicker
                  selected={expiresAt}
                  onChange={(date) => setExpiresAt(date)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholderText="Selecciona una fecha..."
                  minDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                />
              </div>

              {/* Sección para agregar múltiples scripts en creación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scripts de Seguimiento (opcional)
                </label>
                <div className="mb-2">
                  <input
                    type="text"
                    value={newScriptName}
                    onChange={(e) => setNewScriptName(e.target.value)}
                    placeholder="Nombre del script (ej: seguimiento gtm)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 mb-2"
                  />
                  <textarea
                    value={newScriptCode}
                    onChange={(e) => setNewScriptCode(e.target.value)}
                    placeholder="Código del script"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    rows={4}
                  />
                  <button
                    type="button"
                    onClick={handleAddScript}
                    className="mt-2 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
                  >
                    Agregar Script
                  </button>
                </div>
                {scripts.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-md font-medium text-gray-700">Scripts Agregados:</h3>
                    <ul>
                      {scripts.map((script, index) => (
                        <li key={index} className="flex justify-between items-center border p-2 mt-1 rounded">
                          <div>
                            <strong>{script.name}:</strong> {script.code.substring(0, 50)}...
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveScript(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            Quitar
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
              >
                <Link2 className="w-5 h-5 mr-2" />
                Acortar URL
              </button>
            </form>
          </div>

          {/* Lista de enlaces */}
          {links.length > 0 && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Tus Enlaces Recientes</h2>
              </div>
              <ul className="divide-y divide-gray-200">
                {links.map(link => (
                  <li key={link.id} className="p-6">
                    {editingLink?.id === link.id ? (
                      <div className="space-y-4">
                        {/* Título */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Título
                          </label>
                          <input
                            type="text"
                            value={editingLink.title}
                            onChange={e => setEditingLink({
                              ...editingLink,
                              title: e.target.value
                            })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>

                        {/* Edición de URL Original */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            URL Original
                          </label>
                          <input
                            type="url"
                            value={editingLink.original_url}
                            onChange={e => setEditingLink({
                              ...editingLink,
                              original_url: e.target.value
                            })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>

                        {/* Sección de edición de scripts */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Scripts de Seguimiento
                          </label>
                          {editingLink.script_code && editingLink.script_code.map((script, index) => (
                            <div key={index} className="border p-2 rounded mb-2">
                              <input
                                type="text"
                                value={script.name}
                                onChange={(e) => {
                                  const newScripts = editingLink.script_code ? [...editingLink.script_code] : [];
                                  newScripts[index].name = e.target.value;
                                  setEditingLink({ ...editingLink, script_code: newScripts });
                                }}
                                className="w-full px-2 py-1 border rounded mb-1"
                                placeholder="Nombre del script"
                              />
                              <textarea
                                value={script.code}
                                onChange={(e) => {
                                  const newScripts = editingLink.script_code ? [...editingLink.script_code] : [];
                                  newScripts[index].code = e.target.value;
                                  setEditingLink({ ...editingLink, script_code: newScripts });
                                }}
                                className="w-full px-2 py-1 border rounded"
                                rows={3}
                                placeholder="Código del script"
                              ></textarea>
                              <button
                                type="button"
                                onClick={() => {
                                  const newScripts = editingLink.script_code ? editingLink.script_code.filter((_, i) => i !== index) : [];
                                  setEditingLink({ ...editingLink, script_code: newScripts });
                                }}
                                className="text-red-500 hover:text-red-700 mt-1"
                              >
                                Quitar
                              </button>
                            </div>
                          ))}
                          {/* Sección para agregar un nuevo script en modo edición */}
                          <div className="mt-4">
                            <input
                              type="text"
                              value={editingNewScriptName}
                              onChange={(e) => setEditingNewScriptName(e.target.value)}
                              placeholder="Nombre del script"
                              className="w-full px-4 py-2 border border-gray-300 rounded-md mb-2"
                            />
                            <textarea
                              value={editingNewScriptCode}
                              onChange={(e) => setEditingNewScriptCode(e.target.value)}
                              placeholder="Código del script"
                              className="w-full px-4 py-2 border border-gray-300 rounded-md"
                              rows={3}
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
                              className="mt-2 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
                            >
                              Agregar Script
                            </button>
                          </div>
                        </div>

                        <div className="flex space-x-4">
                          <button
                            onClick={() => handleUpdate(editingLink)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditingLink(null)}
                            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-medium text-gray-900 truncate">
                              {link.title || 'Sin título'}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              {window.location.origin}/{link.short_url}
                            </p>
                            <a 
                              href={link.original_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="mt-1 text-sm text-blue-600 hover:text-blue-800 break-all"
                            >
                              {link.original_url}
                            </a>
                            {link.description && (
                              <p className="mt-1 text-sm text-gray-600">
                                {link.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-500">
                              {link.visits} visitas
                            </span>
                            <button
                              onClick={() => setShowQR(link.short_url)}
                              className="text-gray-400 hover:text-gray-500"
                              title="Generar QR"
                            >
                              <QrCode className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => setEditingLink(link)}
                              className="text-gray-400 hover:text-gray-500"
                              title="Editar"
                            >
                              <Pencil className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(link.id)}
                              className="text-red-400 hover:text-red-500"
                              title="Eliminar"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                            <button
                              onClick={async () => {
                                const shortLink = `${window.location.origin}/${link.short_url}`;
                                await navigator.clipboard.writeText(shortLink);
                                toast.success('¡Copiado al portapapeles!');
                              }}
                              className="text-gray-400 hover:text-gray-500"
                              title="Copiar"
                            >
                              <Copy className="h-5 w-5" />
                            </button>
                            <a
                              href={`/${link.short_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-gray-500"
                              title="Abrir enlace"
                            >
                              <ExternalLink className="h-5 w-5" />
                            </a>
                          </div>
                        </div>
                        {link.script_code && (
                          <div className="mt-2">
                            <p className="text-sm text-gray-500">Tiene script de seguimiento</p>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <a
                  href="/dashboard"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Ver todos tus enlaces en el dashboard →
                </a>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal QR */}
      {showQR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Código QR</h3>
            <div className="flex justify-center mb-4">
              <QRCodeSVG
                value={`${window.location.origin}/${showQR}`}
                size={200}
                level="H"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const shortLink = `${window.location.origin}/${showQR}`;
                  await navigator.clipboard.writeText(shortLink);
                  toast.success('¡Copiado al portapapeles!');
                }}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 flex items-center justify-center"
              >
                <Copy className="w-5 h-5 mr-2" />
                Copiar enlace
              </button>
              <button
                onClick={() => setShowQR(null)}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-white shadow-sm mt-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center">
          <p className="text-gray-700">desarrollado por santiago ciro - Automscc</p>
        </div>
      </footer>
    </div>
  );
}

