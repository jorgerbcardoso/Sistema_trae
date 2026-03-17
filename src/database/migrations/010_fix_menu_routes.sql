-- ============================================
-- MIGRATION 010: CORRIGIR ROTAS DO MENU
-- ============================================
-- Atualiza as rotas que estavam incompatíveis entre frontend e backend
-- 
-- Autor: Sistema Presto
-- Data: 2025-01-23
-- ============================================

-- Dashboard Financeiro
UPDATE menu_items 
SET route_path = '/financeiro/dashboard'
WHERE code = 'dashboard_dre' 
  AND route_path = '/dashboards/dre';

-- Gestão de Usuários  
UPDATE menu_items 
SET route_path = '/cadastros/usuarios'
WHERE code = 'admin_usuarios' 
  AND route_path = '/gerenciamento/usuarios';

-- Verificar se as atualizações foram aplicadas
SELECT 
  code,
  name,
  route_path,
  'CORRETO' as status
FROM menu_items
WHERE code IN ('dashboard_dre', 'admin_usuarios');
