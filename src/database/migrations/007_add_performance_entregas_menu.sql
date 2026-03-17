-- =========================================
-- MIGRAÇÃO 007: ADICIONAR MENU PERFORMANCE DE ENTREGAS
-- =========================================
-- Adiciona o menu "Performance de Entregas" 
-- Data: 2025-12-19
-- Autor: Sistema Presto

-- 1. Adicionar o item de menu "Performance de Entregas"
INSERT INTO menu_items (
    code, 
    name, 
    description, 
    icon, 
    route_path, 
    component_path,
    is_available,
    status
)
VALUES (
    'PERFORMANCE_ENTREGAS',
    'Performance de Entregas',
    'Dashboard de performance e análise de entregas por unidade',
    'Route',
    '/operacional/performance-entregas',
    '/components/dashboards/PerformanceEntregas.tsx',
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = CURRENT_TIMESTAMP;

-- 2. Dar permissão de acesso para todos os domínios
INSERT INTO permissions (domain, menu_item_id, can_access, can_create, can_edit, can_delete, can_export)
SELECT 
    d.domain,
    mi.id,
    true,  -- can_access
    false, -- can_create (dashboard não precisa)
    false, -- can_edit (dashboard não precisa)
    false, -- can_delete (dashboard não precisa)
    true   -- can_export (útil para relatórios)
FROM domains d
CROSS JOIN menu_items mi
WHERE mi.code = 'PERFORMANCE_ENTREGAS'
ON CONFLICT (domain, menu_item_id) DO UPDATE SET
    can_access = EXCLUDED.can_access,
    can_export = EXCLUDED.can_export,
    updated_at = CURRENT_TIMESTAMP;

-- 3. Verificação
SELECT 
    mi.name as "Item Menu",
    mi.route_path as "Rota",
    mi.icon as "Ícone",
    mi.status as "Status",
    COUNT(p.id) as "Domínios com Acesso"
FROM menu_items mi
LEFT JOIN permissions p ON p.menu_item_id = mi.id AND p.can_access = true
WHERE mi.code = 'PERFORMANCE_ENTREGAS'
GROUP BY mi.name, mi.route_path, mi.icon, mi.status;

-- Mensagem de sucesso
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Menu "Performance de Entregas" adicionado com sucesso!';
    RAISE NOTICE '📍 Rota: /operacional/performance-entregas';
    RAISE NOTICE '🎯 Status: ACTIVE (disponível para uso)';
END $$;