-- ============================================================================
-- CORREÇÃO: Seções ESTOQUE e COMPRAS
-- ============================================================================
-- Objetivo: Corrigir códigos das seções para minúsculas
-- Data: 27/01/2026
-- ============================================================================

-- Verificar seções atuais
SELECT id, code, name FROM menu_sections WHERE code IN ('estoque', 'ESTOQUE', 'compras', 'COMPRAS');

-- Corrigir seção ESTOQUE (se estiver em maiúsculas)
UPDATE menu_sections 
SET code = 'estoque' 
WHERE UPPER(code) = 'ESTOQUE' AND code != 'estoque';

-- Corrigir seção COMPRAS (se estiver em maiúsculas)
UPDATE menu_sections 
SET code = 'compras' 
WHERE UPPER(code) = 'COMPRAS' AND code != 'compras';

-- Verificar correção
SELECT id, code, name FROM menu_sections WHERE code IN ('estoque', 'compras');

-- ============================================================================
-- VERIFICAR ITENS DE MENU
-- ============================================================================

-- Verificar todos os itens de ESTOQUE
SELECT 
    mi.id,
    mi.code,
    mi.name,
    mi.route_path,
    mi.component_path,
    mi.is_available,
    mi.status
FROM menu_items mi
INNER JOIN menu_sections ms ON mi.section_id = ms.id
WHERE ms.code = 'estoque'
ORDER BY mi.id;

-- Verificar todos os itens de COMPRAS
SELECT 
    mi.id,
    mi.code,
    mi.name,
    mi.route_path,
    mi.component_path,
    mi.is_available,
    mi.status
FROM menu_items mi
INNER JOIN menu_sections ms ON mi.section_id = ms.id
WHERE ms.code = 'compras'
ORDER BY mi.id;

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
