-- ========================================
-- LANÇAMENTOS MANUAIS DE RECEITAS
-- Referência de Schema
-- ========================================

-- NOTA: Este arquivo é apenas para referência.
-- Não é necessário executar nada, pois a tabela [dominio]_cte já existe.
-- As colunas utilizadas já fazem parte da estrutura existente.

-- ========================================
-- COLUNA PRINCIPAL DE IDENTIFICAÇÃO
-- ========================================

-- tp_documento = 'MANUAL'
-- Esta é a coluna que identifica um registro como lançamento manual

-- ========================================
-- ÍNDICE RECOMENDADO (OPCIONAL)
-- ========================================

-- Criar índice para melhor performance nas consultas de lançamentos manuais
-- Executar apenas se ainda não existir:

CREATE INDEX IF NOT EXISTS idx_cte_manual 
ON [dominio]_cte(tp_documento, data_emissao) 
WHERE tp_documento = 'MANUAL';

-- ========================================
-- EXEMPLO DE CONSULTA
-- ========================================

-- Listar todos os lançamentos manuais do mês atual:
/*
SELECT 
    ser_cte,
    nro_cte,
    data_emissao,
    sigla_emit,
    nome_pag,
    peso_real,
    vlr_merc,
    vlr_frete,
    vlr_icms,
    login_inclusao,
    data_inclusao
FROM [dominio]_cte
WHERE tp_documento = 'MANUAL'
  AND EXTRACT(MONTH FROM data_emissao) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND EXTRACT(YEAR FROM data_emissao) = EXTRACT(YEAR FROM CURRENT_DATE)
ORDER BY data_emissao DESC, nro_cte DESC;
*/

-- ========================================
-- ESTRUTURA COMPLETA DE UM INSERT
-- ========================================

/*
INSERT INTO [dominio]_cte (
    -- Campos de Identificação
    ser_cte,                     -- 'MAN'
    nro_cte,                     -- Próximo número disponível
    chave_cte,                   -- ''
    seq_cte_ssw,                 -- 0
    tp_documento,                -- 'MANUAL' ⭐
    
    -- Tipo de Operação
    tp_frete,                    -- 'C'
    tp_cobr,                     -- 'V'
    
    -- Cidades (do cliente)
    seq_cidade_emit,             -- seq_cidade do cliente
    seq_cidade_dest,             -- seq_cidade do cliente
    seq_cidade_entr,             -- seq_cidade do cliente
    seq_cidade_pag,              -- seq_cidade do cliente
    
    -- CNPJs (do cliente)
    cnpj_emit,                   -- cnpj_cli do cliente
    cnpj_dest,                   -- cnpj_cli do cliente
    cnpj_pag,                    -- cnpj_cli do cliente
    
    -- Logística
    placa_coleta,                -- 'ARMAZEM'
    
    -- Datas (todas iguais)
    data_emissao,                -- Informada pelo usuário
    data_prev_ent_ori,           -- Mesma data
    data_prev_ent,               -- Mesma data
    data_entrega,                -- Mesma data
    
    -- Unidades (mesma)
    sigla_emit,                  -- Informada pelo usuário
    sigla_dest,                  -- Mesma unidade
    
    -- Mercadoria
    cod_mercadoria,              -- 1
    cod_especie,                 -- 1
    qtde_vol,                    -- 1
    cubagem,                     -- 0
    
    -- Pesos
    peso_real,                   -- Informado pelo usuário
    peso_calc,                   -- Mesmo valor
    
    -- Valores
    vlr_frete,                   -- Receita (usuário)
    vlr_merc,                    -- Valor NF (usuário)
    vlr_icms,                    -- Impostos (usuário)
    vlr_pis_cofins,              -- 0
    vlr_expedicao,               -- 0
    vlr_recepcao,                -- 0
    
    -- Status
    status,                      -- 'P'
    motivo_cancel,               -- ''
    observacao,                  -- 'RECEITA INCLUÍDA MANUALMENTE'
    
    -- Controle
    data_inclusao,               -- CURRENT_DATE
    hora_inclusao,               -- CURRENT_TIME
    login_inclusao,              -- username
    
    -- Notas Fiscais
    nfs,                         -- '1/1'
    tab_calc,                    -- 'INFORMADO'
    
    -- Endereço de Entrega
    cep_entrega,                 -- CEP da cidade do cliente
    endereco_entrega,            -- ''
    bairro_entrega,              -- ''
    loc_dif_ent,                 -- ''
    
    -- Nomes (do cliente)
    nome_emit,                   -- Nome do cliente
    nome_dest,                   -- Nome do cliente
    nome_pag,                    -- Nome do cliente
    
    -- Custos
    custo_seguro,                -- 0
    custo_icms,                  -- Valor impostos (usuário)
    custo_pis_cofins,            -- 0
    custo_gris,                  -- 0
    custo_pedagio,               -- 0
    custo_expedicao,             -- 0
    custo_transferencia,         -- 0
    custo_transbordo,            -- 0
    custo_vendedor,              -- 0
    custo_recepcao,              -- 0
    custo_desp_div,              -- 0
    custo_transferencia_real     -- 0
) VALUES (
    'MAN', $nro_cte, '', 0, 'MANUAL',
    'C', 'V',
    $seq_cidade, $seq_cidade, $seq_cidade, $seq_cidade,
    $cnpj, $cnpj, $cnpj,
    'ARMAZEM',
    $data, $data, $data, $data,
    $sigla, $sigla,
    1, 1, 1, 0,
    $peso, $peso,
    $vlr_frete, $vlr_merc, $vlr_icms, 0, 0, 0,
    'P', '', 'RECEITA INCLUÍDA MANUALMENTE',
    CURRENT_DATE, CURRENT_TIME, $username,
    '1/1', 'INFORMADO',
    $cep, '', '', '',
    $nome, $nome, $nome,
    0, $vlr_icms, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
);
*/
