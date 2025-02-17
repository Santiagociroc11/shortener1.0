/*
  # Agregar nuevas características a la tabla de enlaces

  1. Nuevas Columnas
    - `description` (text): Descripción opcional del enlace
    - `expires_at` (timestamptz): Fecha de expiración opcional
    - `tags` (text[]): Array de etiquetas
    - `is_private` (boolean): Indica si el enlace es privado

  2. Cambios
    - Agregar nuevas columnas a la tabla `links`
    - Actualizar políticas de RLS para manejar enlaces privados
*/

-- Agregar nuevas columnas
ALTER TABLE links
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS expires_at timestamptz,
ADD COLUMN IF NOT EXISTS tags text[],
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

-- Actualizar política de lectura para respetar la privacidad
DROP POLICY IF EXISTS "Links are readable by everyone" ON links;
CREATE POLICY "Links are readable by everyone or owner" ON links
  FOR SELECT USING (
    (NOT is_private) OR 
    (auth.uid() = user_id)
  );

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_links_expires_at ON links(expires_at);
CREATE INDEX IF NOT EXISTS idx_links_tags ON links USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_links_is_private ON links(is_private);