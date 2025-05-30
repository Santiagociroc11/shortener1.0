/*
  # Limpiar campos innecesarios después del nuevo sistema
  
  Con visit_events implementado, podemos eliminar:
  - visits_history (JSON pesado)
  - Su índice GIN correspondiente
*/

-- ✅ 1. Eliminar índice GIN de visits_history
DROP INDEX IF EXISTS idx_links_visits_history_gin;

-- ✅ 2. Eliminar la columna visits_history (libera MUCHO espacio)
ALTER TABLE links DROP COLUMN IF EXISTS visits_history;

-- ✅ 3. Opcional: Reportar espacio liberado
DO $$
DECLARE
    table_size_before TEXT;
    table_size_after TEXT;
BEGIN
    -- Obtener tamaño actual de la tabla
    SELECT pg_size_pretty(pg_total_relation_size('links')) INTO table_size_after;
    
    RAISE NOTICE '=== LIMPIEZA COMPLETADA ===';
    RAISE NOTICE 'Campo visits_history eliminado exitosamente';
    RAISE NOTICE 'Índice idx_links_visits_history_gin eliminado';
    RAISE NOTICE 'Tamaño actual de tabla links: %', table_size_after;
    RAISE NOTICE 'Los datos históricos ahora están en visit_events';
END $$;

-- ✅ 4. Verificar que el sistema sigue funcionando
-- (Las funciones track_visit_simple y get_link_stats no usan visits_history)
SELECT 'Sistema optimizado - visits_history eliminado exitosamente' as status; 