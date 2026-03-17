<?php
/**
 * ============================================
 * HELPER FUNCTIONS - DASHBOARDS
 * ============================================
 * Funções auxiliares para dashboards
 */

/**
 * Processar dashboard com suporte a mock e dados reais
 * 
 * @param object $db Instância do banco de dados
 * @param string $domain Domínio do cliente
 * @param int $userId ID do usuário
 * @param int $clientId ID do cliente
 * @param string $action Nome da ação para auditoria
 * @param array $params Parâmetros da requisição (period, start_date, end_date, etc)
 * @param callable $mockDataCallback Função que retorna dados mockados
 * @param callable $realDataCallback Função que retorna dados reais do banco
 * @return array Resposta formatada com dados e metadados
 */
function processDashboardData($db, $domain, $userId, $clientId, $action, $params, $mockDataCallback, $realDataCallback) {
    // Verificar se deve usar dados mockados
    $useMockData = shouldUseMockData($domain);
    
    // Obter dados
    if ($useMockData) {
        $data = $mockDataCallback($params);
    } else {
        $data = $realDataCallback($db, $clientId, $params);
    }
    
    return [
        'success' => true,
        'data' => $data,
        'meta' => [
            'domain' => $domain,
            'period' => [
                'type' => $params['period'] ?? null,
                'start_date' => $params['start_date'] ?? null,
                'end_date' => $params['end_date'] ?? null
            ],
            'generated_at' => date('Y-m-d H:i:s'),
            'is_mock' => $useMockData
        ]
    ];
}

/**
 * Retornar dados vazios quando as tabelas não existem
 * 
 * @param string $message Mensagem de erro/aviso
 * @param array $structure Estrutura básica dos dados (opcional)
 * @return array Dados vazios com alerta
 */
function getEmptyDashboardData($message = null, $structure = []) {
    $defaultMessage = '⚠️ Tabelas do banco de dados ainda não foram criadas. Execute os scripts de migração SQL.';
    
    $baseData = [
        'alertas' => [
            [
                'tipo' => 'warning',
                'mensagem' => $message ?? $defaultMessage
            ]
        ]
    ];
    
    return array_merge($structure, $baseData);
}