-- ============================================
-- MIGRATION 006: Criar tabelas DESPESAS e CUSTOS
-- ============================================
-- Data: 2024-12-09
-- Descrição: Separa corretamente DESPESAS (administrativas)
--            de CUSTOS OPERACIONAIS (produção do serviço)
-- ============================================

-- ============================================
-- 1. TABELA: despesas
-- ============================================
-- Armazena despesas administrativas, comerciais e financeiras
-- (NÃO ligadas diretamente à produção do serviço de transporte)

CREATE TABLE IF NOT EXISTS despesas (
  id SERIAL PRIMARY KEY,
  domain VARCHAR(10) NOT NULL,
  data DATE NOT NULL,
  categoria VARCHAR(50) NOT NULL, 
  -- Valores permitidos: 
  --   'ADMINISTRATIVA' - aluguel, água, luz, telefone, material escritório
  --   'PESSOAL' - salários administrativos, benefícios
  --   'TRIBUTARIA' - impostos administrativos (IPTU, etc)
  --   'FINANCEIRA' - juros, taxas bancárias, IOF
  --   'COMERCIAL' - marketing, vendas, comissões
  --   'OUTRAS' - outras despesas não classificadas
  
  subcategoria VARCHAR(100), -- Ex: "Energia Elétrica", "Aluguel Escritório"
  descricao TEXT,
  valor DECIMAL(15,2) NOT NULL CHECK (valor >= 0),
  
  -- Metadados
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER, -- Referência ao usuário que criou
  
  -- Índices
  CONSTRAINT despesas_domain_fk FOREIGN KEY (domain) REFERENCES domains(code) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX idx_despesas_domain_data ON despesas(domain, data DESC);
CREATE INDEX idx_despesas_categoria ON despesas(categoria);
CREATE INDEX idx_despesas_data ON despesas(data DESC);

-- Comentários
COMMENT ON TABLE despesas IS 'Despesas administrativas, comerciais e financeiras (NÃO ligadas à produção)';
COMMENT ON COLUMN despesas.categoria IS 'ADMINISTRATIVA, PESSOAL, TRIBUTARIA, FINANCEIRA, COMERCIAL, OUTRAS';
COMMENT ON COLUMN despesas.subcategoria IS 'Detalhamento da categoria (ex: Energia Elétrica, Aluguel)';

-- ============================================
-- 2. TABELA: custos_operacionais
-- ============================================
-- Armazena custos DIRETOS da operação de transporte
-- (ligados à PRODUÇÃO do serviço - usado apenas na Rentabilidade)

CREATE TABLE IF NOT EXISTS custos_operacionais (
  id SERIAL PRIMARY KEY,
  domain VARCHAR(10) NOT NULL,
  data DATE NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  -- Valores permitidos:
  --   'COMBUSTIVEL' - diesel, gasolina, gás
  --   'MANUTENCAO' - oficina, peças, pneus
  --   'PEDAGIO' - pedágios de viagens
  --   'MOTORISTA' - salários e benefícios de motoristas
  --   'SEGURO_VEICULOS' - seguro da frota
  --   'DEPRECIACAO' - depreciação de veículos
  --   'OUTROS' - outros custos diretos
  
  subcategoria VARCHAR(100), -- Ex: "Diesel S10", "Troca de Óleo"
  descricao TEXT,
  valor DECIMAL(15,2) NOT NULL CHECK (valor >= 0),
  
  -- Relacionamento com veículo/linha (opcional)
  veiculo_id INTEGER,
  linha_id INTEGER,
  
  -- Metadados
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  
  -- Índices
  CONSTRAINT custos_domain_fk FOREIGN KEY (domain) REFERENCES domains(code) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX idx_custos_domain_data ON custos_operacionais(domain, data DESC);
CREATE INDEX idx_custos_tipo ON custos_operacionais(tipo);
CREATE INDEX idx_custos_data ON custos_operacionais(data DESC);
CREATE INDEX idx_custos_veiculo ON custos_operacionais(veiculo_id) WHERE veiculo_id IS NOT NULL;
CREATE INDEX idx_custos_linha ON custos_operacionais(linha_id) WHERE linha_id IS NOT NULL;

-- Comentários
COMMENT ON TABLE custos_operacionais IS 'Custos DIRETOS da operação de transporte (produção do serviço)';
COMMENT ON COLUMN custos_operacionais.tipo IS 'COMBUSTIVEL, MANUTENCAO, PEDAGIO, MOTORISTA, SEGURO_VEICULOS, DEPRECIACAO, OUTROS';
COMMENT ON COLUMN custos_operacionais.veiculo_id IS 'Veículo relacionado ao custo (se aplicável)';
COMMENT ON COLUMN custos_operacionais.linha_id IS 'Linha relacionada ao custo (se aplicável)';

-- ============================================
-- 3. VIEWS PARA FACILITAR CONSULTAS
-- ============================================

-- View: Despesas totais por mês
CREATE OR REPLACE VIEW vw_despesas_mensais AS
SELECT 
  domain,
  DATE_TRUNC('month', data) as mes,
  categoria,
  SUM(valor) as total
FROM despesas
GROUP BY domain, DATE_TRUNC('month', data), categoria;

-- View: Custos operacionais por mês
CREATE OR REPLACE VIEW vw_custos_mensais AS
SELECT 
  domain,
  DATE_TRUNC('month', data) as mes,
  tipo,
  SUM(valor) as total
FROM custos_operacionais
GROUP BY domain, DATE_TRUNC('month', data), tipo;

-- View: Total geral por mês (para Overview)
CREATE OR REPLACE VIEW vw_financeiro_mensal AS
SELECT 
  d.domain,
  d.mes,
  COALESCE(SUM(d.total), 0) as despesas_total,
  COALESCE(c.custos_total, 0) as custos_total
FROM vw_despesas_mensais d
LEFT JOIN (
  SELECT domain, mes, SUM(total) as custos_total
  FROM vw_custos_mensais
  GROUP BY domain, mes
) c ON d.domain = c.domain AND d.mes = c.mes
GROUP BY d.domain, d.mes, c.custos_total;

-- ============================================
-- 4. DADOS MOCK PARA DESENVOLVIMENTO
-- ============================================

-- Inserir despesas MOCK para 2024
DO $$
DECLARE
  mes DATE;
  dominio TEXT;
BEGIN
  -- Para cada domínio
  FOREACH dominio IN ARRAY ARRAY['XXX', 'ACV', 'VCS'] LOOP
    -- Para cada mês de 2024
    FOR mes IN 
      SELECT generate_series('2024-01-01'::date, '2024-12-01'::date, '1 month'::interval)::date
    LOOP
      -- Despesas Administrativas
      INSERT INTO despesas (domain, data, categoria, subcategoria, descricao, valor) VALUES
        (dominio, mes, 'ADMINISTRATIVA', 'Aluguel', 'Aluguel escritório', 15000 + (RANDOM() * 2000)),
        (dominio, mes, 'ADMINISTRATIVA', 'Energia Elétrica', 'Conta de luz', 3000 + (RANDOM() * 500)),
        (dominio, mes, 'ADMINISTRATIVA', 'Água', 'Conta de água', 800 + (RANDOM() * 200)),
        (dominio, mes, 'ADMINISTRATIVA', 'Telefonia', 'Telefone e internet', 2500 + (RANDOM() * 300));
      
      -- Despesas com Pessoal
      INSERT INTO despesas (domain, data, categoria, subcategoria, descricao, valor) VALUES
        (dominio, mes, 'PESSOAL', 'Salários Administrativos', 'Folha de pagamento', 45000 + (RANDOM() * 5000)),
        (dominio, mes, 'PESSOAL', 'Benefícios', 'Vale alimentação e transporte', 8000 + (RANDOM() * 1000));
      
      -- Despesas Tributárias
      INSERT INTO despesas (domain, data, categoria, subcategoria, descricao, valor) VALUES
        (dominio, mes, 'TRIBUTARIA', 'IPTU', 'IPTU da sede', 1200 + (RANDOM() * 200)),
        (dominio, mes, 'TRIBUTARIA', 'Taxas Municipais', 'Taxas diversas', 500 + (RANDOM() * 100));
      
      -- Despesas Financeiras
      INSERT INTO despesas (domain, data, categoria, subcategoria, descricao, valor) VALUES
        (dominio, mes, 'FINANCEIRA', 'Juros', 'Juros de empréstimos', 5000 + (RANDOM() * 2000)),
        (dominio, mes, 'FINANCEIRA', 'Taxas Bancárias', 'Tarifas bancárias', 800 + (RANDOM() * 200));
      
      -- Despesas Comerciais
      INSERT INTO despesas (domain, data, categoria, subcategoria, descricao, valor) VALUES
        (dominio, mes, 'COMERCIAL', 'Marketing', 'Campanhas publicitárias', 6000 + (RANDOM() * 1000)),
        (dominio, mes, 'COMERCIAL', 'Comissões', 'Comissões de vendas', 4000 + (RANDOM() * 1500));
      
      -- Outras Despesas
      INSERT INTO despesas (domain, data, categoria, subcategoria, descricao, valor) VALUES
        (dominio, mes, 'OUTRAS', 'Material Escritório', 'Papelaria e suprimentos', 1500 + (RANDOM() * 300)),
        (dominio, mes, 'OUTRAS', 'Limpeza', 'Serviços de limpeza', 2000 + (RANDOM() * 400));
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '✅ Despesas MOCK inseridas para XXX, ACV e VCS (Jan-Dez 2024)';
END $$;

-- Inserir custos operacionais MOCK para 2024
DO $$
DECLARE
  mes DATE;
  dominio TEXT;
BEGIN
  FOREACH dominio IN ARRAY ARRAY['XXX', 'ACV', 'VCS'] LOOP
    FOR mes IN 
      SELECT generate_series('2024-01-01'::date, '2024-12-01'::date, '1 month'::interval)::date
    LOOP
      -- Custos Operacionais
      INSERT INTO custos_operacionais (domain, data, tipo, subcategoria, descricao, valor) VALUES
        (dominio, mes, 'COMBUSTIVEL', 'Diesel S10', 'Abastecimento da frota', 120000 + (RANDOM() * 20000)),
        (dominio, mes, 'MANUTENCAO', 'Preventiva', 'Manutenção preventiva', 35000 + (RANDOM() * 5000)),
        (dominio, mes, 'MANUTENCAO', 'Corretiva', 'Reparos emergenciais', 15000 + (RANDOM() * 8000)),
        (dominio, mes, 'MANUTENCAO', 'Pneus', 'Troca e recapagem', 12000 + (RANDOM() * 3000)),
        (dominio, mes, 'PEDAGIO', 'Pedágios', 'Pedágios das viagens', 28000 + (RANDOM() * 5000)),
        (dominio, mes, 'MOTORISTA', 'Salários Motoristas', 'Folha motoristas', 85000 + (RANDOM() * 10000)),
        (dominio, mes, 'SEGURO_VEICULOS', 'Seguro Frota', 'Seguro da frota', 18000 + (RANDOM() * 2000)),
        (dominio, mes, 'DEPRECIACAO', 'Depreciação', 'Depreciação veículos', 25000);
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '✅ Custos Operacionais MOCK inseridos para XXX, ACV e VCS (Jan-Dez 2024)';
END $$;

-- ============================================
-- 5. VERIFICAÇÃO
-- ============================================

-- Mostrar totais por domínio
SELECT 
  domain,
  TO_CHAR(DATE_TRUNC('month', data), 'YYYY-MM') as mes,
  categoria,
  SUM(valor) as total
FROM despesas
WHERE domain = 'ACV'
GROUP BY domain, DATE_TRUNC('month', data), categoria
ORDER BY mes DESC, categoria
LIMIT 20;

SELECT 
  domain,
  TO_CHAR(DATE_TRUNC('month', data), 'YYYY-MM') as mes,
  tipo,
  SUM(valor) as total
FROM custos_operacionais
WHERE domain = 'ACV'
GROUP BY domain, DATE_TRUNC('month', data), tipo
ORDER BY mes DESC, tipo
LIMIT 20;

-- Log final
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 006 aplicada com sucesso!';
  RAISE NOTICE '   - Tabela "despesas" criada';
  RAISE NOTICE '   - Tabela "custos_operacionais" criada';
  RAISE NOTICE '   - Views criadas para facilitar consultas';
  RAISE NOTICE '   - Dados MOCK inseridos para 2024';
  RAISE NOTICE '';
  RAISE NOTICE '📋 IMPORTANTE:';
  RAISE NOTICE '   - DESPESAS = gastos administrativos/comerciais/financeiros';
  RAISE NOTICE '   - CUSTOS = gastos operacionais diretos (só Rentabilidade!)';
  RAISE NOTICE '   - Consultar /docs/DESPESAS_VS_CUSTOS.md para detalhes';
END $$;
