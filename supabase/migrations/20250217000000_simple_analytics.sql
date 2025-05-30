/*
  # Migración Simple - Separar Analytics
  
  PROBLEMA: visits_history JSON crece sin límite
  SOLUCIÓN: Tabla separada simple + función optimizada
*/

-- ✅ 1. Tabla de eventos simple (sin particiones)
CREATE TABLE visit_events (
    id BIGSERIAL PRIMARY KEY,
    short_url VARCHAR(50) NOT NULL,
    visited_at TIMESTAMPTZ DEFAULT NOW(),
    user_agent TEXT,
    referrer TEXT,
    country_code CHAR(2),
    device_type VARCHAR(20),
    browser VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ✅ 2. Índices necesarios
CREATE INDEX idx_visit_events_short_url ON visit_events(short_url);
CREATE INDEX idx_visit_events_visited_at ON visit_events(visited_at);

-- ✅ 3. Función RPC simple para tracking rápido
CREATE OR REPLACE FUNCTION track_visit_simple(
    p_short_url VARCHAR(50),
    p_user_agent TEXT DEFAULT NULL,
    p_referrer TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    device_type_val VARCHAR(20);
    browser_val VARCHAR(50);
BEGIN
    -- Detectar tipo de dispositivo
    device_type_val := CASE
        WHEN p_user_agent ILIKE '%mobile%' OR p_user_agent ILIKE '%android%' OR p_user_agent ILIKE '%iphone%' THEN 'mobile'
        WHEN p_user_agent ILIKE '%tablet%' OR p_user_agent ILIKE '%ipad%' THEN 'tablet'
        ELSE 'desktop'
    END;
    
    -- Detectar navegador
    browser_val := CASE
        WHEN p_user_agent ILIKE '%chrome%' THEN 'Chrome'
        WHEN p_user_agent ILIKE '%firefox%' THEN 'Firefox'
        WHEN p_user_agent ILIKE '%safari%' THEN 'Safari'
        WHEN p_user_agent ILIKE '%edge%' THEN 'Edge'
        ELSE 'Other'
    END;
    
    -- 1. Insertar evento
    INSERT INTO visit_events (
        short_url, 
        user_agent, 
        referrer, 
        device_type, 
        browser
    ) VALUES (
        p_short_url, 
        p_user_agent, 
        COALESCE(p_referrer, 'Direct'), 
        device_type_val, 
        browser_val
    );
    
    -- 2. Actualizar contador en links
    UPDATE links 
    SET 
        visits = COALESCE(visits, 0) + 1,
        last_visited = NOW()
    WHERE short_url = p_short_url;
    
END;
$$;

-- ✅ 4. Función para obtener estadísticas básicas
CREATE OR REPLACE FUNCTION get_link_stats(p_short_url VARCHAR(50))
RETURNS TABLE (
    total_visits BIGINT,
    unique_visitors BIGINT,
    mobile_visits BIGINT,
    desktop_visits BIGINT,
    top_browsers JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_visits,
        COUNT(DISTINCT user_agent)::BIGINT as unique_visitors,
        COUNT(*) FILTER (WHERE device_type = 'mobile')::BIGINT as mobile_visits,
        COUNT(*) FILTER (WHERE device_type = 'desktop')::BIGINT as desktop_visits,
        jsonb_object_agg(browser, browser_count) as top_browsers
    FROM (
        SELECT 
            user_agent,
            device_type,
            browser,
            COUNT(*) as browser_count
        FROM visit_events 
        WHERE short_url = p_short_url
        GROUP BY browser, user_agent, device_type
    ) stats;
END;
$$;

-- ✅ 5. Permisos
GRANT SELECT, INSERT ON visit_events TO anon;
GRANT SELECT, INSERT ON visit_events TO authenticated;
GRANT EXECUTE ON FUNCTION track_visit_simple TO anon;
GRANT EXECUTE ON FUNCTION track_visit_simple TO authenticated;
GRANT EXECUTE ON FUNCTION get_link_stats TO authenticated;

-- ✅ 6. Limpiar visits_history JSON de links existentes (opcional)
-- Comentado para que decidas si ejecutarlo
/*
UPDATE links SET visits_history = NULL WHERE visits_history IS NOT NULL;
*/ 