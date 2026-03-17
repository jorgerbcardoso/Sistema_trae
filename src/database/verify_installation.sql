-- ============================================================================
-- SCRIPT DE VERIFICAÇÃO DA INSTALAÇÃO
-- Sistema Presto - Banco de Dados PostgreSQL
-- ============================================================================
-- Execute este script após instalar o schema.sql para verificar se tudo
-- foi criado corretamente
-- ============================================================================

\echo '============================================================================'
\echo '🔍 VERIFICAÇÃO DA INSTALAÇÃO DO SISTEMA PRESTO'
\echo '============================================================================'
\echo ''

-- ============================================================================
-- 1. VERIFICAR VERSÃO DO POSTGRESQL
-- ============================================================================

\echo '📌 1. VERSÃO DO POSTGRESQL'
\echo '---'
SELECT version();
\echo ''

-- ============================================================================
-- 2. VERIFICAR TABELAS CRIADAS
-- ============================================================================

\echo '📌 2. TABELAS CRIADAS'
\echo '---'
SELECT 
    schemaname AS schema,
    tablename AS tabela,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS tamanho
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
\echo ''

-- ============================================================================
-- 3. VERIFICAR TIPOS CUSTOMIZADOS (ENUMS)
-- ============================================================================

\echo '📌 3. TIPOS CUSTOMIZADOS (ENUMS)'
\echo '---'
SELECT 
    t.typname AS tipo,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valores
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('modalidade_enum', 'status_enum')
GROUP BY t.typname
ORDER BY t.typname;
\echo ''

-- ============================================================================
-- 4. VERIFICAR VIEWS
-- ============================================================================

\echo '📌 4. VIEWS CRIADAS'
\echo '---'
SELECT 
    viewname AS view,
    definition
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;
\echo ''

-- ============================================================================
-- 5. VERIFICAR FUNÇÕES
-- ============================================================================

\echo '📌 5. FUNÇÕES CRIADAS'
\echo '---'
SELECT 
    routine_name AS funcao,
    routine_type AS tipo,
    data_type AS retorno
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('update_updated_at_column', 'create_new_domain')
ORDER BY routine_name;
\echo ''

-- ============================================================================
-- 6. VERIFICAR TRIGGERS
-- ============================================================================

\echo '📌 6. TRIGGERS ATIVOS'
\echo '---'
SELECT 
    trigger_name AS trigger,
    event_object_table AS tabela,
    event_manipulation AS evento
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
\echo ''

-- ============================================================================
-- 7. VERIFICAR DADOS - DOMÍNIOS
-- ============================================================================

\echo '📌 7. DOMÍNIOS CADASTRADOS'
\echo '---'
SELECT 
    domain AS codigo,
    name AS nome,
    modalidade,
    CASE 
        WHEN favicon_url IS NOT NULL AND favicon_url != '' THEN '✅ Personalizado'
        ELSE '⬜ Padrão'
    END AS favicon,
    is_super_admin AS super_admin,
    is_active AS ativo
FROM domains
ORDER BY domain;
\echo ''

\echo '📊 RESUMO DE DOMÍNIOS:'
SELECT 
    COUNT(*) AS total_dominios,
    COUNT(*) FILTER (WHERE is_active = TRUE) AS ativos,
    COUNT(*) FILTER (WHERE is_super_admin = TRUE) AS super_admins,
    COUNT(*) FILTER (WHERE modalidade = 'CARGAS') AS cargas,
    COUNT(*) FILTER (WHERE modalidade = 'PASSAGEIROS') AS passageiros,
    COUNT(*) FILTER (WHERE modalidade = 'MISTA') AS mista,
    COUNT(*) FILTER (WHERE favicon_url IS NOT NULL AND favicon_url != '') AS com_favicon_personalizado
FROM domains;
\echo ''

-- ============================================================================
-- 8. VERIFICAR DADOS - USUÁRIOS
-- ============================================================================

\echo '📌 8. USUÁRIOS CADASTRADOS'
\echo '---'
SELECT 
    domain,
    username,
    email,
    full_name,
    is_admin AS admin,
    is_active AS ativo
FROM users
ORDER BY domain, username;
\echo ''

\echo '📊 RESUMO DE USUÁRIOS:'
SELECT 
    COUNT(*) AS total_usuarios,
    COUNT(*) FILTER (WHERE is_active = TRUE) AS ativos,
    COUNT(*) FILTER (WHERE is_admin = TRUE) AS administradores,
    COUNT(DISTINCT domain) AS dominios_com_usuarios
FROM users;
\echo ''

\echo '📊 USUÁRIOS POR DOMÍNIO:'
SELECT 
    domain,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE is_admin = TRUE) AS admins,
    COUNT(*) FILTER (WHERE is_active = TRUE) AS ativos
FROM users
GROUP BY domain
ORDER BY domain;
\echo ''

-- ============================================================================
-- 9. VERIFICAR DADOS - MENU
-- ============================================================================

\echo '📌 9. MENU - SEÇÕES'
\echo '---'
SELECT 
    id,
    code AS codigo,
    name AS nome,
    icon AS icone,
    display_order AS ordem,
    is_active AS ativo
FROM menu_sections
ORDER BY display_order;
\echo ''

\echo '📌 10. MENU - ITENS/FUNCIONALIDADES'
\echo '---'
SELECT 
    ms.name AS secao,
    mi.id,
    mi.code AS codigo,
    mi.name AS nome,
    mi.route_path AS rota,
    mi.is_available AS disponivel,
    mi.status
FROM menu_items mi
JOIN menu_sections ms ON mi.section_id = ms.id
ORDER BY ms.display_order, mi.id;
\echo ''

\echo '📊 RESUMO DE MENU:'
SELECT 
    COUNT(DISTINCT ms.id) AS total_secoes,
    COUNT(mi.id) AS total_itens,
    COUNT(mi.id) FILTER (WHERE mi.is_available = TRUE) AS disponiveis,
    COUNT(mi.id) FILTER (WHERE mi.status = 'active') AS ativos,
    COUNT(mi.id) FILTER (WHERE mi.status = 'development') AS em_desenvolvimento
FROM menu_sections ms
LEFT JOIN menu_items mi ON ms.id = mi.section_id;
\echo ''

-- ============================================================================
-- 11. VERIFICAR DADOS - PERMISSÕES
-- ============================================================================

\echo '📌 11. PERMISSÕES POR DOMÍNIO'
\echo '---'
SELECT 
    domain,
    COUNT(*) AS total_permissoes,
    COUNT(*) FILTER (WHERE can_access = TRUE) AS pode_acessar,
    COUNT(*) FILTER (WHERE can_create = TRUE) AS pode_criar,
    COUNT(*) FILTER (WHERE can_edit = TRUE) AS pode_editar,
    COUNT(*) FILTER (WHERE can_delete = TRUE) AS pode_excluir,
    COUNT(*) FILTER (WHERE can_export = TRUE) AS pode_exportar
FROM domain_permissions
GROUP BY domain
ORDER BY domain;
\echo ''

-- ============================================================================
-- 12. VERIFICAR ÍNDICES
-- ============================================================================

\echo '📌 12. ÍNDICES CRIADOS'
\echo '---'
SELECT 
    schemaname AS schema,
    tablename AS tabela,
    indexname AS indice,
    indexdef AS definicao
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname NOT LIKE '%_pkey'
ORDER BY tablename, indexname;
\echo ''

-- ============================================================================
-- 13. TESTAR INTEGRIDADE REFERENCIAL
-- ============================================================================

\echo '📌 13. VERIFICAÇÃO DE INTEGRIDADE'
\echo '---'
SELECT 
    'Usuários sem domínio' AS verificacao,
    COUNT(*) AS problemas,
    CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ ERRO' END AS status
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM domains d WHERE d.domain = u.domain)
UNION ALL
SELECT 
    'Permissões sem domínio',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ ERRO' END
FROM domain_permissions dp
WHERE NOT EXISTS (SELECT 1 FROM domains d WHERE d.domain = dp.domain)
UNION ALL
SELECT 
    'Permissões sem item de menu',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ ERRO' END
FROM domain_permissions dp
WHERE NOT EXISTS (SELECT 1 FROM menu_items mi WHERE mi.id = dp.menu_item_id)
UNION ALL
SELECT 
    'Itens de menu sem seção',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ ERRO' END
FROM menu_items mi
WHERE NOT EXISTS (SELECT 1 FROM menu_sections ms WHERE ms.id = mi.section_id);
\echo ''

-- ============================================================================
-- 14. VERIFICAR CREDENCIAIS SSW
-- ============================================================================

\echo '📌 14. CREDENCIAIS SSW CONFIGURADAS'
\echo '---'
SELECT 
    domain,
    name,
    ssw_domain,
    ssw_username,
    ssw_cpf,
    CASE 
        WHEN ssw_password IS NOT NULL THEN '✅ Configurada'
        ELSE '❌ Não configurada'
    END AS ssw_password_status
FROM domains
ORDER BY domain;
\echo ''

-- ============================================================================
-- 15. VERIFICAR FAVICONS CONFIGURADOS
-- ============================================================================

\echo '📌 15. FAVICONS CONFIGURADOS'
\echo '---'
SELECT 
    domain,
    name,
    CASE 
        WHEN favicon_url IS NULL OR favicon_url = '' THEN '🖼️  FAVICON PADRÃO (/favicon.ico)'
        ELSE favicon_url
    END AS favicon_configurado
FROM domains
ORDER BY domain;
\echo ''

-- ============================================================================
-- 16. SIMULAR LOGIN DE TESTE
-- ============================================================================

\echo '📌 16. SIMULAÇÃO DE LOGIN (Teste de Autenticação)'
\echo '---'
\echo 'Testando login: VCS / presto'
SELECT 
    u.id AS user_id,
    u.domain,
    u.username,
    u.email,
    u.full_name,
    d.name AS client_name,
    d.modalidade,
    d.favicon_url,
    d.is_super_admin,
    CASE 
        WHEN u.password_hash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' 
        THEN '✅ Hash correto (senha: presto123)'
        ELSE '⚠️ Hash diferente do padrão'
    END AS password_check
FROM users u
JOIN domains d ON u.domain = d.domain
WHERE UPPER(u.domain) = 'VCS'
  AND LOWER(u.username) = 'presto'
  AND u.is_active = TRUE
  AND d.is_active = TRUE;
\echo ''

-- ============================================================================
-- 17. RESUMO GERAL
-- ============================================================================

\echo '============================================================================'
\echo '📊 RESUMO GERAL DA INSTALAÇÃO'
\echo '============================================================================'

SELECT 
    '✅ TABELAS' AS categoria,
    COUNT(*)::text AS valor
FROM pg_tables
WHERE schemaname = 'public'
UNION ALL
SELECT '✅ VIEWS', COUNT(*)::text
FROM pg_views
WHERE schemaname = 'public'
UNION ALL
SELECT '✅ FUNÇÕES', COUNT(*)::text
FROM information_schema.routines
WHERE routine_schema = 'public'
UNION ALL
SELECT '✅ TRIGGERS', COUNT(*)::text
FROM information_schema.triggers
WHERE trigger_schema = 'public'
UNION ALL
SELECT '✅ DOMÍNIOS', COUNT(*)::text
FROM domains
UNION ALL
SELECT '✅ USUÁRIOS', COUNT(*)::text
FROM users
UNION ALL
SELECT '✅ SEÇÕES DE MENU', COUNT(*)::text
FROM menu_sections
UNION ALL
SELECT '✅ ITENS DE MENU', COUNT(*)::text
FROM menu_items
UNION ALL
SELECT '✅ PERMISSÕES', COUNT(*)::text
FROM domain_permissions;

\echo ''

-- ============================================================================
-- 18. CREDENCIAIS DE ACESSO
-- ============================================================================

\echo '============================================================================'
\echo '🔐 CREDENCIAIS DE ACESSO PADRÃO'
\echo '============================================================================'
\echo ''
\echo '🔑 SENHA UNIVERSAL: presto123'
\echo ''
\echo '📋 DOMÍNIOS DISPONÍVEIS:'
\echo ''

SELECT 
    '  ' || domain || ' - ' || name AS informacao
FROM domains
ORDER BY domain;

\echo ''
\echo '👤 USUÁRIOS POR DOMÍNIO:'
\echo ''

SELECT 
    '  ' || domain || ': ' || string_agg(username, ', ' ORDER BY username) AS usuarios
FROM users
WHERE is_active = TRUE
GROUP BY domain
ORDER BY domain;

\echo ''
\echo '============================================================================'
\echo '✅ VERIFICAÇÃO CONCLUÍDA!'
\echo '============================================================================'
\echo ''
\echo 'Se todas as verificações acima mostraram ✅ OK, a instalação foi bem-sucedida!'
\echo ''
\echo 'Próximos passos:'
\echo '  1. Configure o backend PHP para conectar ao banco'
\echo '  2. Configure CORS para permitir requisições do frontend'
\echo '  3. Teste a autenticação via API'
\echo '  4. Deploy em produção'
\echo ''
\echo '============================================================================'
