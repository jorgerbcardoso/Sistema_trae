-- ============================================================================
-- SCRIPT DE VERIFICAÇÃO DO SCHEMA - SISTEMA PRESTO
-- ============================================================================
-- Este script verifica se todas as tabelas, views, funções e dados
-- foram criados corretamente após a execução do schema.sql
-- ============================================================================

\c presto

-- ============================================================================
-- 1. VERIFICAR TABELAS
-- ============================================================================

\echo '============================================================================'
\echo '1. VERIFICANDO TABELAS'
\echo '============================================================================'

SELECT 
    'domains' AS tabela,
    COUNT(*) AS registros,
    CASE 
        WHEN COUNT(*) >= 3 THEN '✅ OK'
        ELSE '❌ ERRO: Esperado >= 3 registros'
    END AS status
FROM domains
UNION ALL
SELECT 
    'users',
    COUNT(*),
    CASE 
        WHEN COUNT(*) >= 10 THEN '✅ OK'
        ELSE '❌ ERRO: Esperado >= 10 registros'
    END
FROM users
UNION ALL
SELECT 
    'menu_items',
    COUNT(*),
    CASE 
        WHEN COUNT(*) >= 8 THEN '✅ OK'
        ELSE '❌ ERRO: Esperado >= 8 registros'
    END
FROM menu_items
UNION ALL
SELECT 
    'permissions',
    COUNT(*),
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ OK'
        ELSE '❌ ERRO: Nenhum registro'
    END
FROM permissions
UNION ALL
SELECT 
    'user_permissions',
    COUNT(*),
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ OK'
        ELSE '❌ ERRO: Nenhum registro'
    END
FROM user_permissions;

-- ============================================================================
-- 2. VERIFICAR DOMÍNIOS
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo '2. DOMÍNIOS CADASTRADOS'
\echo '============================================================================'

SELECT 
    domain,
    name,
    modalidade,
    CASE 
        WHEN controla_linhas THEN '✅ Sim'
        ELSE '❌ Não'
    END AS controla_linhas,
    CASE 
        WHEN favicon_url IS NOT NULL AND favicon_url != '' THEN '🎨 Personalizado'
        ELSE '🖼️  Padrão'
    END AS favicon,
    total_users AS usuarios,
    total_permissions AS permissoes,
    CASE 
        WHEN is_super_admin THEN '👑 SUPER ADMIN'
        ELSE '👤 Cliente'
    END AS tipo
FROM domains
ORDER BY domain;

-- ============================================================================
-- 3. VERIFICAR USUÁRIOS
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo '3. USUÁRIOS POR DOMÍNIO'
\echo '============================================================================'

SELECT 
    domain,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE is_admin = TRUE) AS admins,
    COUNT(*) FILTER (WHERE is_active = TRUE) AS ativos,
    COUNT(*) FILTER (WHERE is_active = FALSE) AS inativos
FROM users
GROUP BY domain
ORDER BY domain;

-- ============================================================================
-- 4. VERIFICAR MENU
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo '4. ITENS DO MENU'
\echo '============================================================================'

SELECT 
    code,
    name,
    status,
    CASE 
        WHEN is_available THEN '✅ Disponível'
        ELSE '❌ Indisponível'
    END AS disponibilidade
FROM menu_items
ORDER BY id;

-- ============================================================================
-- 5. VERIFICAR VIEWS
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo '5. VIEWS CRIADAS'
\echo '============================================================================'

SELECT 
    schemaname,
    viewname,
    '✅ Criada' AS status
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- ============================================================================
-- 6. VERIFICAR FUNÇÕES
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo '6. FUNÇÕES CRIADAS'
\echo '============================================================================'

SELECT 
    proname AS funcao,
    '✅ Criada' AS status
FROM pg_proc
WHERE proname IN ('update_updated_at', 'update_domain_stats')
ORDER BY proname;

-- ============================================================================
-- 7. VERIFICAR TRIGGERS
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo '7. TRIGGERS CRIADOS'
\echo '============================================================================'

SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS tabela,
    '✅ Ativo' AS status
FROM pg_trigger
WHERE tgisinternal = FALSE
ORDER BY tgname;

-- ============================================================================
-- 8. VERIFICAR TIPOS CUSTOMIZADOS (ENUMS)
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo '8. TIPOS CUSTOMIZADOS (ENUMs)'
\echo '============================================================================'

SELECT 
    typname AS tipo,
    '✅ Criado' AS status
FROM pg_type
WHERE typname IN ('modalidade_enum', 'status_enum')
ORDER BY typname;

-- ============================================================================
-- 9. VERIFICAR ÍNDICES
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo '9. ÍNDICES CRIADOS'
\echo '============================================================================'

SELECT 
    tablename AS tabela,
    indexname AS indice,
    '✅ Criado' AS status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname NOT LIKE '%_pkey'
ORDER BY tablename, indexname;

-- ============================================================================
-- 10. VERIFICAR INTEGRIDADE REFERENCIAL
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo '10. TESTE DE INTEGRIDADE REFERENCIAL'
\echo '============================================================================'

-- Verificar se todos os usuários pertencem a domínios válidos
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK: Todos os usuários pertencem a domínios válidos'
        ELSE '❌ ERRO: ' || COUNT(*) || ' usuário(s) órfão(s)'
    END AS status
FROM users u
LEFT JOIN domains d ON u.domain = d.domain
WHERE d.domain IS NULL;

-- Verificar se todas as permissões pertencem a usuários válidos
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK: Todas as permissões pertencem a usuários válidos'
        ELSE '❌ ERRO: ' || COUNT(*) || ' permissão(ões) órfã(s)'
    END AS status
FROM user_permissions up
LEFT JOIN users u ON up.user_id = u.id
WHERE u.id IS NULL;

-- Verificar se todas as permissões pertencem a itens de menu válidos
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK: Todas as permissões pertencem a itens de menu válidos'
        ELSE '❌ ERRO: ' || COUNT(*) || ' permissão(ões) órfã(s)'
    END AS status
FROM permissions p
LEFT JOIN menu_items mi ON p.menu_item_id = mi.id
WHERE mi.id IS NULL;

-- ============================================================================
-- 11. TESTE DE LOGIN (VERIFICAR HASHES)
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo '11. TESTE DE CREDENCIAIS'
\echo '============================================================================'

SELECT 
    domain,
    username,
    email,
    CASE 
        WHEN password_hash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' 
        THEN '✅ Senha padrão (presto123)'
        ELSE '❌ Hash diferente'
    END AS senha_status,
    CASE 
        WHEN is_admin THEN '👑 Admin'
        ELSE '👤 User'
    END AS papel
FROM users
ORDER BY domain, username;

-- ============================================================================
-- 12. VERIFICAR CONTROLA_LINHAS
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo '12. CONFIGURAÇÃO DE CONTROLE DE LINHAS'
\echo '============================================================================'

SELECT 
    domain,
    name,
    modalidade,
    CASE 
        WHEN controla_linhas THEN '✅ CONTROLA linhas (dados reais)'
        ELSE '❌ NÃO CONTROLA linhas (dados mockados)'
    END AS status_linhas,
    CASE 
        WHEN NOT controla_linhas THEN '⚠️  Dashboard de Linhas exibirá dados fictícios'
        ELSE 'Dashboard de Linhas exibirá dados do backend'
    END AS aviso
FROM domains
ORDER BY domain;

-- ============================================================================
-- 13. VERIFICAR FAVICON DINÂMICO
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo '13. CONFIGURAÇÃO DE FAVICON/LOGO (WHITE-LABEL)'
\echo '============================================================================'

SELECT 
    domain,
    name,
    CASE 
        WHEN favicon_url IS NULL OR favicon_url = '' THEN '🖼️  Logo padrão do sistema'
        ELSE '🎨 Logo personalizada'
    END AS tipo_logo,
    CASE 
        WHEN favicon_url IS NOT NULL AND favicon_url != '' THEN favicon_url
        ELSE 'N/A (usa logo padrão)'
    END AS url
FROM domains
ORDER BY domain;

-- ============================================================================
-- 14. VERIFICAR MODALIDADES
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo '14. DISTRIBUIÇÃO DE MODALIDADES'
\echo '============================================================================'

SELECT 
    modalidade,
    COUNT(*) AS total,
    CASE 
        WHEN modalidade = 'CARGAS' THEN '🚛 Apenas cargas'
        WHEN modalidade = 'PASSAGEIROS' THEN '🚌 Apenas passageiros'
        WHEN modalidade = 'MISTA' THEN '🚛+🚌 Cargas + Passageiros'
    END AS descricao
FROM domains
GROUP BY modalidade
ORDER BY modalidade;

-- ============================================================================
-- 15. RESUMO FINAL
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo '15. RESUMO FINAL DO BANCO'
\echo '============================================================================'

SELECT 
    'Total de Domínios' AS metrica,
    COUNT(*)::TEXT AS valor
FROM domains
UNION ALL
SELECT 
    'Total de Usuários',
    COUNT(*)::TEXT
FROM users
UNION ALL
SELECT 
    'Total de Itens do Menu',
    COUNT(*)::TEXT
FROM menu_items
UNION ALL
SELECT 
    'Total de Permissões',
    COUNT(*)::TEXT
FROM permissions
UNION ALL
SELECT 
    'Total de Permissões de Usuários',
    COUNT(*)::TEXT
FROM user_permissions
UNION ALL
SELECT 
    'Usuários Ativos',
    COUNT(*)::TEXT
FROM users
WHERE is_active = TRUE
UNION ALL
SELECT 
    'Usuários Administradores',
    COUNT(*)::TEXT
FROM users
WHERE is_admin = TRUE
UNION ALL
SELECT 
    'Domínios com Modalidade MISTA',
    COUNT(*)::TEXT
FROM domains
WHERE modalidade = 'MISTA'
UNION ALL
SELECT 
    'Domínios que Controlam Linhas',
    COUNT(*)::TEXT
FROM domains
WHERE controla_linhas = TRUE
UNION ALL
SELECT 
    'Domínios com Favicon Personalizado',
    COUNT(*)::TEXT
FROM domains
WHERE favicon_url IS NOT NULL AND favicon_url != '';

-- ============================================================================
-- 16. STATUS GERAL
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo '16. STATUS GERAL DO SISTEMA'
\echo '============================================================================'

DO $$
DECLARE
    total_domains INTEGER;
    total_users INTEGER;
    total_menu_items INTEGER;
    total_permissions INTEGER;
    all_ok BOOLEAN := TRUE;
BEGIN
    SELECT COUNT(*) INTO total_domains FROM domains;
    SELECT COUNT(*) INTO total_users FROM users;
    SELECT COUNT(*) INTO total_menu_items FROM menu_items;
    SELECT COUNT(*) INTO total_permissions FROM permissions;
    
    RAISE NOTICE '';
    RAISE NOTICE '══════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '                    STATUS DO BANCO DE DADOS                          ';
    RAISE NOTICE '══════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    
    IF total_domains >= 3 THEN
        RAISE NOTICE '✅ Domínios: % registros (OK)', total_domains;
    ELSE
        RAISE NOTICE '❌ Domínios: % registros (ERRO: esperado >= 3)', total_domains;
        all_ok := FALSE;
    END IF;
    
    IF total_users >= 10 THEN
        RAISE NOTICE '✅ Usuários: % registros (OK)', total_users;
    ELSE
        RAISE NOTICE '❌ Usuários: % registros (ERRO: esperado >= 10)', total_users;
        all_ok := FALSE;
    END IF;
    
    IF total_menu_items >= 8 THEN
        RAISE NOTICE '✅ Menu: % registros (OK)', total_menu_items;
    ELSE
        RAISE NOTICE '❌ Menu: % registros (ERRO: esperado >= 8)', total_menu_items;
        all_ok := FALSE;
    END IF;
    
    IF total_permissions > 0 THEN
        RAISE NOTICE '✅ Permissões: % registros (OK)', total_permissions;
    ELSE
        RAISE NOTICE '❌ Permissões: % registros (ERRO)', total_permissions;
        all_ok := FALSE;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '══════════════════════════════════════════════════════════════════════';
    
    IF all_ok THEN
        RAISE NOTICE '🎉 SUCESSO! Banco de dados configurado corretamente!';
        RAISE NOTICE '';
        RAISE NOTICE '📋 CREDENCIAIS DE ACESSO:';
        RAISE NOTICE '   • Domínio: XXX, VCS ou ACV';
        RAISE NOTICE '   • Usuário: presto ou admin';
        RAISE NOTICE '   • Senha: presto123';
    ELSE
        RAISE NOTICE '⚠️  ATENÇÃO! Alguns problemas foram encontrados.';
        RAISE NOTICE '   Execute o schema.sql novamente.';
    END IF;
    
    RAISE NOTICE '══════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- FIM DA VERIFICAÇÃO
-- ============================================================================
