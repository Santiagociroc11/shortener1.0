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

interface Link {
  id: string;
  original_url: string;
  short_url: string;
  script_code: string | null;
  visits: number;
  created_at: string;
  description?: string;
  custom_slug?: string;
  expires_at?: Date | null;
  tags?: string[];
  is_private?: boolean;
}

interface Tag {
  value: string;
  label: string;
}

export default function Home() {
  const [originalUrl, setOriginalUrl] = useState('');
  const [scriptCode, setScriptCode] = useState('');
  const [description, setDescription] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [showQR, setShowQR] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const tagOptions = [
    { value: 'personal', label: 'Personal' },
    { value: 'trabajo', label: 'Trabajo' },
    { value: 'social', label: 'Social' },
    { value: 'proyecto', label: 'Proyecto' },
  ];

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
      const { error } = await supabase.from('links').insert([
        {
          original_url: originalUrl,
          short_url: shortUrl,
          script_code: scriptCode,
          description,
          expires_at: expiresAt,
          is_private: false,
          tags: selectedTags.map(tag => tag.value),
          user_id: user.id,
        },
      ]);

      if (error) throw error;

      const shortLink = `${window.location.origin}/${shortUrl}`;
      toast.success('¡URL acortada con éxito!');
      
      await navigator.clipboard.writeText(shortLink);
      toast.success('¡Copiado al portapapeles!');

      setOriginalUrl('');
      setScriptCode('');
      setDescription('');
      setCustomSlug('');
      setExpiresAt(null);
      setSelectedTags([]);
      fetchLinks();
    } catch (error) {
      toast.error('Error al crear la URL corta');
      console.error('Error:', error);
    }
  };

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
          is_private: true, // Siempre privado
          tags: link.tags,
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
          <div className="bg-white rounded-lg shadow-md p-6 md:p-8 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="originalUrl"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  URL Original
                </label>
                <input
                  type="url"
                  id="originalUrl"
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://ejemplo.com"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="customSlug"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
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

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
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

              <div>
                <label
                  htmlFor="tags"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Etiquetas
                </label>
                <Select
                  isMulti
                  options={tagOptions}
                  value={selectedTags}
                  onChange={(newValue) => setSelectedTags(newValue as Tag[])}
                  className="basic-multi-select"
                  classNamePrefix="select"
                  placeholder="Selecciona etiquetas..."
                />
              </div>

              <div>
                <label
                  htmlFor="expiresAt"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
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

              <div>
                <label
                  htmlFor="scriptCode"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Script de Seguimiento (opcional)
                </label>
                <textarea
                  id="scriptCode"
                  value={scriptCode}
                  onChange={(e) => setScriptCode(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="<!-- Pega tu script de seguimiento aquí -->"
                  rows={4}
                />
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
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Script de Seguimiento
                          </label>
                          <textarea
                            value={editingLink.script_code || ''}
                            onChange={e => setEditingLink({
                              ...editingLink,
                              script_code: e.target.value
                            })}
                            rows={4}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
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
                              {link.original_url}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              {window.location.origin}/{link.short_url}
                            </p>
                            {link.description && (
                              <p className="mt-1 text-sm text-gray-600">
                                {link.description}
                              </p>
                            )}
                            {link.tags && link.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {link.tags.map(tag => (
                                  <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    <Tag className="w-3 h-3 mr-1" />
                                    {tag}
                                  </span>
                                ))}
                              </div>
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
    </div>
  );
}
