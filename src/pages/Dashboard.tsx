import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BarChart, Pencil, Trash2, ExternalLink, QrCode, Calendar, Tag, Copy, Link2, Folder, FolderPlus, FolderOpen, Move, MoreVertical, Grid3X3, LayoutList } from 'lucide-react';
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
  // Ahora se maneja como un arreglo de objetos con "name" y "code"
  script_code: { name: string; code: string }[] | null;
  visits: number;
  created_at: string;
  description?: string;
  expires_at?: Date | null;
  tags?: string[];
  is_private?: boolean;
  title?: string;
  folder_id?: string | null;
}

interface Folder {
  id: string;
  name: string;
  description?: string;
  color: string;
  user_id: string;
  created_at: string;
  updated_at: string;
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
  // Estados para agregar un nuevo script en modo edición
  const [editingNewScriptName, setEditingNewScriptName] = useState('');
  const [editingNewScriptCode, setEditingNewScriptCode] = useState('');
  // ✅ NUEVO: Estado para estadísticas rápidas de cada enlace
  const [linkStats, setLinkStats] = useState<Record<string, any>>({});

  // Estados para carpetas
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);

  // Estados para drag and drop
  const [draggedLink, setDraggedLink] = useState<Link | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [openDropdownFolder, setOpenDropdownFolder] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'grid'>('grid');

  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Solo redirigir cuando se sepa que no hay usuario y loading terminó
    if (!loading && !user) {
      navigate('/login');
      return;
    }

    if (user) {
      fetchFolders();
      fetchLinks();
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdownFolder(null);
    };

    if (openDropdownFolder) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdownFolder]);

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');

      if (error) throw error;
      setFolders(data || []);
    } catch (error) {
      toast.error('Error al obtener carpetas');
    }
  };

  const fetchLinks = async () => {
    try {
      // ✅ OPTIMIZACIÓN: Añadir folder_id a la consulta
      const { data, error } = await supabase
        .from('links')
        .select('id, original_url, short_url, visits, created_at, description, title, expires_at, tags, is_private, script_code, folder_id')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinks(data || []);

      // ✅ NUEVO: Cargar estadísticas rápidas para los primeros 5 enlaces
      if (data && data.length > 0) {
        const topLinks = data.slice(0, 5); // Solo los 5 más recientes para rendimiento
        const statsPromises = topLinks.map(async (link) => {
          const stats = await fetchLinkQuickStats(link.short_url);
          return { shortUrl: link.short_url, stats };
        });

        const statsResults = await Promise.all(statsPromises);
        const statsMap: Record<string, any> = {};
        statsResults.forEach(({ shortUrl, stats }) => {
          if (stats) statsMap[shortUrl] = stats;
        });
        setLinkStats(statsMap);
      }
    } catch (error) {
      toast.error('Error al obtener los enlaces');
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('El nombre de la carpeta es requerido');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('folders')
        .insert([{
          name: newFolderName,
          description: newFolderDescription,
          color: newFolderColor,
          user_id: user?.id
        }])
        .select()
        .single();

      if (error) throw error;

      setFolders([...folders, data]);
      setNewFolderName('');
      setNewFolderDescription('');
      setNewFolderColor('#3B82F6');
      setShowCreateFolder(false);
      toast.success('Carpeta creada exitosamente');
    } catch (error) {
      toast.error('Error al crear la carpeta');
    }
  };

  const updateFolder = async (folder: Folder) => {
    try {
      const { error } = await supabase
        .from('folders')
        .update({
          name: folder.name,
          description: folder.description,
          color: folder.color
        })
        .eq('id', folder.id);

      if (error) throw error;

      setFolders(folders.map(f => f.id === folder.id ? folder : f));
      setEditingFolder(null);
      toast.success('Carpeta actualizada exitosamente');
    } catch (error) {
      toast.error('Error al actualizar la carpeta');
    }
  };

  const deleteFolder = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    const linksInFolder = linkCountByFolder[folderId] || 0;
    
    if (linksInFolder > 0) {
      if (!confirm(`¿Estás seguro de eliminar la carpeta "${folder?.name}"?\n\n${linksInFolder} enlace${linksInFolder > 1 ? 's' : ''} se moverá${linksInFolder > 1 ? 'n' : ''} a "Sin carpeta".`)) {
        return;
      }
    } else {
      if (!confirm(`¿Estás seguro de eliminar la carpeta "${folder?.name}"?`)) {
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;

      setFolders(folders.filter(f => f.id !== folderId));
      if (selectedFolder === folderId) {
        setSelectedFolder(null);
      }
      fetchLinks(); // Recargar enlaces para actualizar folder_id = null
      toast.success('Carpeta eliminada exitosamente');
    } catch (error) {
      toast.error('Error al eliminar la carpeta');
    }
  };

  // Si loading, mostramos spinner
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Si no hay usuario, no renderizamos nada
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
          title: link.title
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
    const matchesSearch =
      link.original_url.toLowerCase().includes(filter.toLowerCase()) ||
      link.short_url.toLowerCase().includes(filter.toLowerCase()) ||
      link.description?.toLowerCase().includes(filter.toLowerCase());

    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.every(tag => link.tags?.includes(tag.value));

    const matchesFolder = 
      selectedFolder === null || 
      link.folder_id === selectedFolder ||
      (selectedFolder === 'no-folder' && !link.folder_id);

    return matchesSearch && matchesTags && matchesFolder;
  });

  // Contador real de enlaces por carpeta (independiente del filtro de carpeta seleccionada)
  const linkCountByFolder = links.reduce((acc, link) => {
    const folderId = link.folder_id || 'no-folder';
    acc[folderId] = (acc[folderId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const linksByFolder = filteredLinks.reduce((acc, link) => {
    const folderId = link.folder_id || 'no-folder';
    if (!acc[folderId]) {
      acc[folderId] = [];
    }
    acc[folderId].push(link);
    return acc;
  }, {} as Record<string, Link[]>);

  // ✅ NUEVA: Función para obtener estadísticas rápidas de un enlace
  const fetchLinkQuickStats = async (shortUrl: string) => {
    try {
      const { data, error } = await supabase
        .from('visit_events')
        .select('device_type, visited_at')
        .eq('short_url', shortUrl)
        .order('visited_at', { ascending: false })
        .limit(50); // Solo últimos 50 para estadísticas rápidas

      if (error) return null;

      const events = data || [];
      const mobileCount = events.filter(e => e.device_type === 'mobile').length;
      const desktopCount = events.filter(e => e.device_type === 'desktop').length;
      const recentEvents = events.slice(0, 5);

      return {
        mobile: mobileCount,
        desktop: desktopCount,
        recent: recentEvents.length,
        lastVisit: events[0]?.visited_at || null
      };
    } catch (error) {
      console.warn('Error obteniendo estadísticas rápidas:', error);
      return null;
    }
  };

  const updateLinkFolder = async (linkId: string, folderId: string | null) => {
    try {
      const { error } = await supabase
        .from('links')
        .update({ folder_id: folderId })
        .eq('id', linkId);

      if (error) throw error;

      // Actualizar el estado local
      setLinks(links.map(link => 
        link.id === linkId 
          ? { ...link, folder_id: folderId }
          : link
      ));

      const folderName = folderId 
        ? folders.find(f => f.id === folderId)?.name || 'Carpeta'
        : 'Sin carpeta';
      
      toast.success(`Enlace movido a "${folderName}"`);
    } catch (error) {
      toast.error('Error al mover el enlace');
    }
  };

  // Funciones para drag and drop
  const handleDragStart = (e: React.DragEvent, link: Link) => {
    setDraggedLink(link);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedLink(null);
    setDragOverFolder(null);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderId);
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDragOverFolder(null);
    
    if (draggedLink && draggedLink.folder_id !== folderId) {
      updateLinkFolder(draggedLink.id, folderId);
    }
    setDraggedLink(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Barra de búsqueda y filtros */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
          <div className="flex-1 max-w-2xl">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Tus Enlaces</h1>
            
            {/* Panel de carpetas con drop zones */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <Folder className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Carpetas:</span>
              </div>
              
              <div
                onDragOver={(e) => handleDragOver(e, null)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, null)}
                className={`transition-all ${dragOverFolder === null ? 'ring-2 ring-yellow-400 ring-opacity-50' : ''}`}
              >
                <button
                  onClick={() => setSelectedFolder(null)}
                  className={`px-3 py-1 rounded-lg text-sm transition-all ${
                    selectedFolder === null 
                      ? 'bg-yellow-400 text-black font-medium' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Todas
                </button>
              </div>
              
              <div
                onDragOver={(e) => handleDragOver(e, 'no-folder')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'no-folder')}
                className={`transition-all ${dragOverFolder === 'no-folder' ? 'ring-2 ring-yellow-400 ring-opacity-50' : ''}`}
              >
                <button
                  onClick={() => setSelectedFolder('no-folder')}
                  className={`px-3 py-1 rounded-lg text-sm transition-all ${
                    selectedFolder === 'no-folder' 
                      ? 'bg-yellow-400 text-black font-medium' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Sin carpeta
                  <span className="ml-1 text-xs opacity-75">
                    ({linkCountByFolder['no-folder'] || 0})
                  </span>
                </button>
              </div>
              
              {folders.map(folder => (
                <div key={folder.id} className="flex items-center group">
                  <div
                    onDragOver={(e) => handleDragOver(e, folder.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, folder.id)}
                    className={`transition-all ${dragOverFolder === folder.id ? 'ring-2 ring-yellow-400 ring-opacity-50' : ''}`}
                  >
                    <button
                      onClick={() => setSelectedFolder(folder.id)}
                      className={`flex items-center px-3 py-1 rounded-lg text-sm transition-all ${
                        selectedFolder === folder.id 
                          ? 'bg-yellow-400 text-black font-medium' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: folder.color }}
                      ></div>
                      {folder.name}
                      <span className="ml-1 text-xs opacity-75">
                        ({linkCountByFolder[folder.id] || 0})
                      </span>
                    </button>
                  </div>
                  
                  {/* Menú dropdown sutil */}
                  <div className="relative ml-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownFolder(openDropdownFolder === folder.id ? null : folder.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 p-1 rounded transition-all duration-200"
                      title="Opciones de carpeta"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {openDropdownFolder === folder.id && (
                      <div 
                        className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[120px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setEditingFolder(folder);
                            setOpenDropdownFolder(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center rounded-t-lg transition-colors"
                        >
                          <Pencil className="w-3 h-3 mr-2" />
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            deleteFolder(folder.id);
                            setOpenDropdownFolder(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center rounded-b-lg transition-colors"
                        >
                          <Trash2 className="w-3 h-3 mr-2" />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              <button
                onClick={() => setShowCreateFolder(true)}
                className="flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transition-all"
              >
                <FolderPlus className="w-4 h-4 mr-1" />
                Nueva Carpeta
              </button>
            </div>
          </div>
          
          {/* Panel de controles */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 lg:flex-shrink-0">
            {/* Switch de vista */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center px-3 py-2 rounded-md text-sm transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Vista de tarjetas"
              >
                <LayoutList className="w-4 h-4 mr-2" />
                Lista
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center px-3 py-2 rounded-md text-sm transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Vista de cuadrícula"
              >
                <Grid3X3 className="w-4 h-4 mr-2" />
                Cuadrícula
              </button>
            </div>
            
            {/* Búsqueda */}
            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Buscar enlaces..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* Filtro de etiquetas */}
            <div className="w-full sm:w-64">
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
      </div>

      {/* Estadísticas rápidas del nuevo sistema */}
      {links.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Link2 className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Enlaces</p>
                <p className="text-2xl font-semibold text-gray-900">{links.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Visitas</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {links.reduce((sum, link) => sum + (link.visits || 0), 0)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Enlaces Activos</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {links.filter(link => !link.expires_at || new Date(link.expires_at) > new Date()).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Tag className="h-8 w-8 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Enlace Más Popular</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {Math.max(...links.map(link => link.visits || 0), 0)} visitas
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de enlaces modernizada */}
      <div className="space-y-8">
        {Object.entries(linksByFolder).map(([folderId, folderLinks]) => {
          
          return (
            <div key={folderId} className="space-y-4">
              
              
              {/* Enlaces de la carpeta con drag and drop */}
              <div className={viewMode === 'cards' ? 'space-y-6' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'}>
                {folderLinks.map(link => (
                  <div 
                    key={link.id} 
                    className={`${
                      viewMode === 'cards'
                        ? `minimal-card p-6 hover-lift transition-all cursor-move ${
                            draggedLink?.id === link.id ? 'opacity-50 transform rotate-2' : ''
                          }`
                        : `bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all cursor-move ${
                            draggedLink?.id === link.id ? 'opacity-50 transform rotate-1' : ''
                          }`
                    }`}
                    draggable={editingLink?.id !== link.id}
                    onDragStart={(e) => handleDragStart(e, link)}
                    onDragEnd={handleDragEnd}
                  >
                    {editingLink?.id === link.id ? (
                      <div className="space-y-6">
                        {/* Header del modo edición */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center mr-3">
                              <Pencil className="w-5 h-5 text-black" />
                            </div>
                            <h3 className="text-xl font-semibold text-black">Editando Enlace</h3>
                          </div>
                          <button
                            onClick={() => setEditingLink(null)}
                            className="text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Título */}
                          <div className="lg:col-span-2">
                            <label className="block text-gray-900 font-medium mb-3">Título</label>
                            <input
                              type="text"
                              value={editingLink.title || ''}
                              onChange={(e) =>
                                setEditingLink({ ...editingLink, title: e.target.value })
                              }
                              className="input-minimal w-full"
                              placeholder="Título del enlace"
                            />
                          </div>

                          {/* URL Original */}
                          <div>
                            <label className="block text-gray-900 font-medium mb-3">URL Original</label>
                            <input
                              type="url"
                              value={editingLink.original_url}
                              onChange={(e) =>
                                setEditingLink({ ...editingLink, original_url: e.target.value })
                              }
                              className="input-minimal w-full"
                            />
                          </div>

                          {/* Carpeta */}
                          <div>
                            <label className="block text-gray-900 font-medium mb-3">Carpeta</label>
                            <select
                              value={editingLink.folder_id || ''}
                              onChange={(e) =>
                                setEditingLink({ 
                                  ...editingLink, 
                                  folder_id: e.target.value || null 
                                })
                              }
                              className="input-minimal w-full"
                            >
                              <option value="">Sin carpeta</option>
                              {folders.map(folder => (
                                <option key={folder.id} value={folder.id}>
                                  {folder.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Scripts de seguimiento en edición */}
                        <div className="minimal-card p-6 border border-gray-200">
                          <h4 className="text-gray-900 font-semibold mb-4 flex items-center">
                            Scripts de Seguimiento
                          </h4>
                          
                          {editingLink.script_code &&
                            editingLink.script_code.map((script, index) => (
                              <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                                <input
                                  type="text"
                                  value={script.name}
                                  onChange={(e) => {
                                    const newScripts = editingLink.script_code
                                      ? [...editingLink.script_code]
                                      : [];
                                    newScripts[index].name = e.target.value;
                                    setEditingLink({ ...editingLink, script_code: newScripts });
                                  }}
                                  className="input-minimal w-full mb-3"
                                  placeholder="Nombre del script"
                                />
                                <textarea
                                  value={script.code}
                                  onChange={(e) => {
                                    const newScripts = editingLink.script_code
                                      ? [...editingLink.script_code]
                                      : [];
                                    newScripts[index].code = e.target.value;
                                    setEditingLink({ ...editingLink, script_code: newScripts });
                                  }}
                                  className="textarea-minimal w-full h-24 resize-none mb-3"
                                  placeholder="Código del script"
                                ></textarea>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newScripts = editingLink.script_code
                                      ? editingLink.script_code.filter((_, i) => i !== index)
                                      : [];
                                    setEditingLink({ ...editingLink, script_code: newScripts });
                                  }}
                                  className="text-red-600 hover:text-red-800 transition-colors flex items-center text-sm"
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Quitar Script
                                </button>
                              </div>
                            ))}

                          {/* Agregar nuevo script en modo edición */}
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
                                const newScripts = editingLink?.script_code
                                  ? [...editingLink.script_code]
                                  : [];
                                newScripts.push({
                                  name: editingNewScriptName,
                                  code: editingNewScriptCode,
                                });
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
                    ) : viewMode === 'cards' ? (
                      /* Vista normal del enlace modernizada - EXISTING CARD VIEW */
                      <div>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center mb-3">
                              <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center mr-3">
                                <Link2 className="w-5 h-5 text-gray-700" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-xl font-semibold text-gray-900 truncate">
                                  {link.title || 'Sin título'}
                                </h3>
                                <div className="flex items-center space-x-4">
                                  <p className="text-gray-500 text-sm">
                                    Creado el {format(new Date(link.created_at), 'dd MMM yyyy', { locale: es })}
                                  </p>
                                  
                                  {/* Selector de carpeta inline */}
                                  <div className="flex items-center space-x-2">
                                    <Move className="w-4 h-4 text-gray-400" />
                                    <select
                                      value={link.folder_id || ''}
                                      onChange={(e) => updateLinkFolder(link.id, e.target.value || null)}
                                      className="text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <option value="">Sin carpeta</option>
                                      {folders.map(folder => (
                                        <option key={folder.id} value={folder.id}>
                                          {folder.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Enlaces */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-700 mb-1">Enlace corto:</p>
                                  <code className="text-gray-900 font-mono text-sm">
                                    {window.location.origin}/{link.short_url}
                                  </code>
                                </div>
                                <button
                                  onClick={async () => {
                                    const shortLink = `${window.location.origin}/${link.short_url}`;
                                    await navigator.clipboard.writeText(shortLink);
                                    toast.success('¡Copiado!');
                                  }}
                                  className="text-yellow-600 hover:text-yellow-800 ml-3"
                                  title="Copiar enlace"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                              
                              <div className="flex items-start">
                                <span className="text-sm font-medium text-gray-700 mr-2 mt-1">Destino:</span>
                                <a 
                                  href={link.original_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="link-minimal text-sm flex-1 break-all hover:text-black"
                                >
                                  {link.original_url}
                                </a>
                              </div>
                              
                              {link.description && (
                                <div className="flex items-start">
                                  <span className="text-sm font-medium text-gray-700 mr-2">Descripción:</span>
                                  <p className="text-sm text-gray-600 flex-1">{link.description}</p>
                                </div>
                              )}
                              
                              {link.expires_at && (
                                <div className="flex items-center text-gray-500">
                                  <Calendar className="w-4 h-4 mr-2" />
                                  <span className="text-sm">
                                    Expira: {format(new Date(link.expires_at), 'dd/MM/yyyy')}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Tags */}
                            {link.tags && link.tags.length > 0 && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {link.tags.map(tag => (
                                  <span key={tag} className="badge-minimal">
                                    <Tag className="w-3 h-3 mr-1" />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Scripts indicator */}
                            {link.script_code && link.script_code.length > 0 && (
                              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center">
                                  <span className="text-blue-600 text-sm font-medium">
                                    🎯 {link.script_code.length} script{link.script_code.length > 1 ? 's' : ''} activo{link.script_code.length > 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {link.script_code.map((script, index) => (
                                    <span key={index} className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                      {script.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Panel derecho con estadísticas y acciones */}
                          <div className="ml-6 flex flex-col items-end space-y-4">
                            {/* Estadísticas */}
                            <div className="text-right">
                              <div className="text-3xl font-bold text-gray-900">{link.visits}</div>
                              <p className="text-sm text-gray-500">visitas totales</p>
                              
                              {linkStats[link.short_url] ? (
                                <div className="text-xs text-gray-600 flex items-center space-x-3 mt-2">
                                  <span className="flex items-center">
                                    📱 {linkStats[link.short_url].mobile}
                                  </span>
                                  <span className="flex items-center">
                                    💻 {linkStats[link.short_url].desktop}
                                  </span>
                                  <span className="flex items-center">
                                    🕒 {linkStats[link.short_url].recent}
                                  </span>
                                </div>
                              ) : link.visits > 0 ? (
                                <div className="text-xs text-gray-400 mt-2">
                                  <span>📊 Ver estadísticas →</span>
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400 mt-2">
                                  <span>🆕 Sin visitas aún</span>
                                </div>
                              )}
                            </div>

                            {/* Botones de acción modernos */}
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => navigate(`/link/${link.short_url}`)}
                                className="p-2 bg-blue-100 hover:bg-blue-200 rounded-xl transition-all duration-300 group"
                                title="Ver estadísticas"
                              >
                                <BarChart className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                              </button>
                              
                              <button
                                onClick={() => setShowQR(link.short_url)}
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-300 group"
                                title="Generar QR"
                              >
                                <QrCode className="w-4 h-4 text-gray-700 group-hover:scale-110 transition-transform" />
                              </button>
                              
                              <button
                                onClick={() => setEditingLink(link)}
                                className="p-2 bg-yellow-100 hover:bg-yellow-200 rounded-xl transition-all duration-300 group"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4 text-yellow-600 group-hover:scale-110 transition-transform" />
                              </button>
                              
                              <button
                                onClick={() => handleDelete(link.id)}
                                className="p-2 bg-red-100 hover:bg-red-200 rounded-xl transition-all duration-300 group"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4 text-red-600 group-hover:scale-110 transition-transform" />
                              </button>
                              
                              <a
                                href={`/${link.short_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-green-100 hover:bg-green-200 rounded-xl transition-all duration-300 group"
                                title="Abrir enlace"
                              >
                                <ExternalLink className="w-4 h-4 text-green-600 group-hover:scale-110 transition-transform" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Vista de cuadrícula compacta */
                      <div className="h-full flex flex-col">
                        {/* Header compacto */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center mb-2">
                              <div className="w-6 h-6 bg-gray-200 rounded-lg flex items-center justify-center mr-2">
                                <Link2 className="w-3 h-3 text-gray-700" />
                              </div>
                              <h3 className="text-sm font-semibold text-gray-900 truncate">
                                {link.title || 'Sin título'}
                              </h3>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">
                              {format(new Date(link.created_at), 'dd/MM', { locale: es })}
                            </p>
                          </div>
                          
                          {/* Estadísticas compactas */}
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">{link.visits}</div>
                            <p className="text-xs text-gray-500">visitas</p>
                          </div>
                        </div>

                        {/* URL corta */}
                        <div className="bg-gray-50 p-2 rounded-md mb-3 flex-1">
                          <div className="flex items-center justify-between">
                            <code className="text-xs text-gray-900 font-mono truncate flex-1">
                              /{link.short_url}
                            </code>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const shortLink = `${window.location.origin}/${link.short_url}`;
                                await navigator.clipboard.writeText(shortLink);
                                toast.success('¡Copiado!');
                              }}
                              className="text-yellow-600 hover:text-yellow-800 ml-2"
                              title="Copiar enlace"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 truncate mt-1" title={link.original_url}>
                            {link.original_url}
                          </p>
                        </div>

                        {/* Indicadores compactos */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1">
                            {/* Scripts indicator */}
                            {link.script_code && link.script_code.length > 0 && (
                              <span className="text-xs bg-blue-100 text-blue-600 px-1 py-0.5 rounded" title="Scripts activos">
                                🎯{link.script_code.length}
                              </span>
                            )}
                            
                            {/* Tags indicator */}
                            {link.tags && link.tags.length > 0 && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-1 py-0.5 rounded" title="Etiquetas">
                                🏷️{link.tags.length}
                              </span>
                            )}
                            
                            {/* Expiry indicator */}
                            {link.expires_at && (
                              <span className="text-xs bg-orange-100 text-orange-600 px-1 py-0.5 rounded" title="Tiene expiración">
                                ⏰
                              </span>
                            )}
                          </div>

                          {/* Selector de carpeta compacto */}
                          <select
                            value={link.folder_id || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateLinkFolder(link.id, e.target.value || null);
                            }}
                            className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white hover:border-gray-400 focus:border-blue-500 outline-none"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="">📁</option>
                            {folders.map(folder => (
                              <option key={folder.id} value={folder.id}>
                                {folder.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Botones de acción compactos */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/link/${link.short_url}`);
                              }}
                              className="p-1 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                              title="Ver estadísticas"
                            >
                              <BarChart className="w-3 h-3 text-blue-600" />
                            </button>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowQR(link.short_url);
                              }}
                              className="p-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                              title="Generar QR"
                            >
                              <QrCode className="w-3 h-3 text-gray-700" />
                            </button>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingLink(link);
                              }}
                              className="p-1 bg-yellow-100 hover:bg-yellow-200 rounded transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-3 h-3 text-yellow-600" />
                            </button>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(link.id);
                              }}
                              className="p-1 bg-red-100 hover:bg-red-200 rounded transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3 h-3 text-red-600" />
                            </button>
                            
                            <a
                              href={`/${link.short_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 bg-green-100 hover:bg-green-200 rounded transition-colors"
                              title="Abrir enlace"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3 text-green-600" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <footer className="bg-white shadow-sm mt-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center">
          <p className="text-gray-700">desarrollado por santiago ciro - Automscc</p>
        </div>
      </footer>

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

      {/* Modal Crear Carpeta */}
      {showCreateFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Nueva Carpeta</h3>
              <button
                onClick={() => setShowCreateFolder(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la carpeta *
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="input-minimal w-full"
                  placeholder="Mi carpeta"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  value={newFolderDescription}
                  onChange={(e) => setNewFolderDescription(e.target.value)}
                  className="textarea-minimal w-full h-20"
                  placeholder="Descripción de la carpeta..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={newFolderColor}
                    onChange={(e) => setNewFolderColor(e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300"
                  />
                  <div className="flex space-x-2">
                    {['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'].map(color => (
                      <button
                        key={color}
                        onClick={() => setNewFolderColor(color)}
                        className={`w-8 h-8 rounded-full border-2 ${
                          newFolderColor === color ? 'border-gray-800' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                className="btn-accent flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Crear Carpeta
              </button>
              <button
                onClick={() => setShowCreateFolder(false)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Carpeta */}
      {editingFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Editar Carpeta</h3>
              <button
                onClick={() => setEditingFolder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la carpeta *
                </label>
                <input
                  type="text"
                  value={editingFolder.name}
                  onChange={(e) => setEditingFolder({...editingFolder, name: e.target.value})}
                  className="input-minimal w-full"
                  placeholder="Mi carpeta"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  value={editingFolder.description || ''}
                  onChange={(e) => setEditingFolder({...editingFolder, description: e.target.value})}
                  className="textarea-minimal w-full h-20"
                  placeholder="Descripción de la carpeta..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={editingFolder.color}
                    onChange={(e) => setEditingFolder({...editingFolder, color: e.target.value})}
                    className="w-12 h-10 rounded border border-gray-300"
                  />
                  <div className="flex space-x-2">
                    {['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'].map(color => (
                      <button
                        key={color}
                        onClick={() => setEditingFolder({...editingFolder, color})}
                        className={`w-8 h-8 rounded-full border-2 ${
                          editingFolder.color === color ? 'border-gray-800' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => updateFolder(editingFolder)}
                disabled={!editingFolder.name.trim()}
                className="btn-accent flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Actualizar
              </button>
              <button
                onClick={() => setEditingFolder(null)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    
  );
}
