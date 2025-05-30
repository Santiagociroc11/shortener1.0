/*
  # Sistema de Carpetas para Enlaces
  
  1. Añadir campo folder_id a links
  2. Crear tabla folders
  3. Funciones para gestión de carpetas
*/

-- ✅ 1. Crear tabla de carpetas
CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT '#3B82F6', -- color en hex para personalización
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name) -- No permitir carpetas duplicadas por usuario
);

-- ✅ 2. Añadir campo folder_id a links
ALTER TABLE links ADD COLUMN folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;

-- ✅ 3. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_links_folder_id ON links(folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_name ON folders(user_id, name);

-- ✅ 6. Trigger para actualizar updated_at en folders
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ✅ 7. Función para obtener estadísticas de carpeta
CREATE OR REPLACE FUNCTION get_folder_stats(p_folder_id uuid, p_user_id uuid)
RETURNS TABLE (
  total_links BIGINT,
  total_visits BIGINT,
  active_links BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_links,
    COALESCE(SUM(visits), 0)::BIGINT as total_visits,
    COUNT(*) FILTER (WHERE expires_at IS NULL OR expires_at > NOW())::BIGINT as active_links
  FROM links 
  WHERE folder_id = p_folder_id 
    AND user_id = p_user_id;
END;
$$;

-- ✅ 8. Crear algunas carpetas por defecto para usuarios existentes
INSERT INTO folders (name, description, color, user_id)
SELECT 
  'General',
  'Enlaces sin categoría específica',
  '#6B7280',
  id
FROM auth.users
WHERE id NOT IN (SELECT DISTINCT user_id FROM folders WHERE name = 'General')
ON CONFLICT (user_id, name) DO NOTHING;

-- ✅ 9. Permisos
GRANT ALL ON folders TO authenticated;
GRANT EXECUTE ON FUNCTION get_folder_stats TO authenticated;
GRANT EXECUTE ON FUNCTION update_updated_at_column TO authenticated; 