import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BarChart, Pencil, Trash2, ExternalLink, QrCode, Calendar, Tag } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import Select from 'react-select';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Link {
  id: string;
  original_url: string;
  short_url: string;
  script_code: string;
  visits: number;
  created_at: string;
  description?: string;
  expires_at?: Date | null;
  tags?: string[];
  is_private?: boolean;
}

interface Tag {
  value: string;
  label: string;
}

const tagOptions = [
  { value: 'personal', label: 'Personal' },
  { value: 'trabajo', label: 'Trabajo' },
  { value: 'social', label: 'Social' },
  { value: 'proyecto', label: 'Proyecto' },
];

export default function Dashboard() {
  const [links, setLinks] = useState<Link[]>([]);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [showQR, setShowQR] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Solo redirigir cuando estemos seguros de que no hay usuario y el loading ha terminado
    if (!loading && !user) {
      navigate('/login');
      return;
    }

    if (user) {
      fetchLinks();
    }
  }, [user, loading, navigate]);

  const fetchLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('links')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      toast.error('Error al obtener los enlaces');
    }
  };

  // Si todavía está cargando, mostrar un spinner
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Si no hay usuario y no está cargando, no renderizar nada (la redirección ya está manejada en el useEffect)
  if (!user) {
    return null;
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('links')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setLinks(links.filter(link => link.id !== id));
      toast.success('Enlace eliminado con éxito');
    } catch (error) {
      toast.error('Error al eliminar el enlace');
    }
  };

  const handleUpdate = async (link: Link) => {
    try {
      const { error } = await supabase
        .from('links')
        .update({
          original_url: link.original_url,
          script_code: link.script_code,
          description: link.description,
          expires_at: link.expires_at,
          is_private: link.is_private,
          tags: link.tags,
        })
        .eq('id', link.id);

      if (error) throw error;
      
      setLinks(links.map(l => l.id === link.id ? link : l));
      setEditingLink(null);
      toast.success('Enlace actualizado con éxito');
    } catch (error) {
      toast.error('Error al actualizar el enlace');
    }
  };

  const filteredLinks = links.filter(link => {
    const matchesSearch = link.original_url.toLowerCase().includes(filter.toLowerCase()) ||
                         link.short_url.toLowerCase().includes(filter.toLowerCase()) ||
                         link.description?.toLowerCase().includes(filter.toLowerCase());
    
    const matchesTags = selectedTags.length === 0 || 
                       selectedTags.every(tag => link.tags?.includes(tag.value));
    
    return matchesSearch && matchesTags;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Tus Enlaces</h1>
        <div className="flex space-x-4">
          <div className="w-64">
            <input
              type="text"
              placeholder="Buscar enlaces..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="w-64">
            <Select
              isMulti
              options={tagOptions}
              value={selectedTags}
              onChange={(newValue) => setSelectedTags(newValue as Tag[])}
              placeholder="Filtrar por etiquetas..."
              className="basic-multi-select"
              classNamePrefix="select"
            />
          </div>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <ul className="divide-y divide-gray-200">
          {filteredLinks.map(link => (
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
                      Descripción
                    </label>
                    <textarea
                      value={editingLink.description || ''}
                      onChange={e => setEditingLink({
                        ...editingLink,
                        description: e.target.value
                      })}
                      rows={2}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Fecha de Expiración
                    </label>
                    <DatePicker
                      selected={editingLink.expires_at ? new Date(editingLink.expires_at) : null}
                      onChange={(date) => setEditingLink({
                        ...editingLink,
                        expires_at: date
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholderText="Selecciona una fecha..."
                      dateFormat="dd/MM/yyyy"
                      locale={es}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Etiquetas
                    </label>
                    <Select
                      isMulti
                      options={tagOptions}
                      value={tagOptions.filter(tag => editingLink.tags?.includes(tag.value))}
                      onChange={(newValue) => setEditingLink({
                        ...editingLink,
                        tags: (newValue as Tag[]).map(tag => tag.value)
                      })}
                      className="mt-1"
                      classNamePrefix="select"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`private-${editingLink.id}`}
                      checked={editingLink.is_private}
                      onChange={e => setEditingLink({
                        ...editingLink,
                        is_private: e.target.checked
                      })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label
                      htmlFor={`private-${editingLink.id}`}
                      className="ml-2 block text-sm text-gray-700"
                    >
                      Enlace Privado
                    </label>
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
                      <h2 className="text-lg font-medium text-gray-900 truncate">
                        {link.original_url}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {window.location.origin}/{link.short_url}
                      </p>
                      {link.description && (
                        <p className="mt-1 text-sm text-gray-600">
                          {link.description}
                        </p>
                      )}
                      {link.expires_at && (
                        <p className="mt-1 text-sm text-gray-500 flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Expira: {format(new Date(link.expires_at), 'dd/MM/yyyy')}
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
                        onClick={() => navigate(`/link/${link.short_url}`)}
                        className="text-blue-500 hover:text-blue-700 flex items-center"
                        title="Ver estadísticas"
                      >
                        <BarChart className="h-5 w-5" />
                      </button>
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
      </div>

      {/* Modal QR */}
      {showQR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Código QR</h3>
            <div className="flex justify-center mb-4">
              <QRCodeSVG
                value={`${window.location.origin}/${showQR}`}
                size={200}
                level="H"
              />
            </div>
            <button
              onClick={() => setShowQR(null)}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}