<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

$input = getRequestInput();
$filters = $input['filters'] ?? [];

$conn = connect();

$params = [];
$paramIndex = 1;
$whereConditions = [];

$whereConditions[] = "cte.status <> 'C'";

if (!empty($filters['periodoEmissaoInicio'])) {
    $whereConditions[] = "cte.data_emissao >= $" . $paramIndex++;
    $params[] = $filters['periodoEmissaoInicio'];
}
if (!empty($filters['periodoEmissaoFim'])) {
    $whereConditions[] = "cte.data_emissao <= $" . $paramIndex++;
    $params[] = $filters['periodoEmissaoFim'];
}
if (!empty($filters['periodoPrevisaoInicio'])) {
    $whereConditions[] = "cte.data_prev_ent >= $" . $paramIndex++;
    $params[] = $filters['periodoPrevisaoInicio'];
}
if (!empty($filters['periodoPrevisaoFim'])) {
    $whereConditions[] = "cte.data_prev_ent <= $" . $paramIndex++;
    $params[] = $filters['periodoPrevisaoFim'];
}
if (!empty($filters['unidadeDestino']) && is_array($filters['unidadeDestino']) && count($filters['unidadeDestino']) > 0) {
    $placeholders = [];
    foreach ($filters['unidadeDestino'] as $sigla) {
        $placeholders[] = '$' . $paramIndex++;
        $params[] = $sigla;
    }
    $whereConditions[] = 'cte.sigla_dest IN (' . implode(', ', $placeholders) . ')';
}
if (!empty($filters['cnpjPagador'])) {
    $whereConditions[] = "cte.cnpj_pag = $" . $paramIndex++;
    $params[] = $filters['cnpjPagador'];
}
if (!empty($filters['cnpjDestinatario'])) {
    $whereConditions[] = "cte.cnpj_dest = $" . $paramIndex++;
    $params[] = $filters['cnpjDestinatario'];
}

$whereClause = 'WHERE ' . implode(' AND ', $whereConditions);

$query = "
    SELECT
        COUNT(CASE
            WHEN c.agenda = true
             AND (cte.ult_ocor_agend IS NULL OR cte.ult_ocor_agend = 0)
            THEN 1 END
        ) AS agendaveis,

        COUNT(CASE
            WHEN cte.ult_ocor_agend = 14
            THEN 1 END
        ) AS aguardando_agendamento,

        COUNT(CASE
            WHEN cte.ult_ocor_agend = 15
             AND cte.data_prev_ent >= CURRENT_DATE
             AND cte.data_entrega IS NULL
            THEN 1 END
        ) AS agendados_no_prazo,

        COUNT(CASE
            WHEN cte.ult_ocor_agend = 15
             AND cte.data_entrega IS NOT NULL
             AND cte.data_entrega <= cte.data_prev_ent
            THEN 1 END
        ) AS agendamentos_cumpridos,

        COUNT(CASE
            WHEN (
                 (cte.data_entrega IS NULL     AND cte.data_prev_ent < CURRENT_DATE)
              OR (cte.data_entrega IS NOT NULL AND cte.data_entrega > cte.data_prev_ent)
             )
            AND cte.ult_ocor_agend = 15
            THEN 1 END
        ) AS agendamentos_perdidos
    FROM {$domain}_cte cte
    LEFT JOIN {$domain}_cliente c ON cte.cnpj_dest = c.cnpj
    $whereClause
";

$result = pg_query_params($conn, $query, $params);

if (!$result) {
    respondJson(['success' => false, 'message' => 'Erro na query: ' . pg_last_error($conn)]);
}

$row = pg_fetch_assoc($result);

$agendaveis       = (int)($row['agendaveis']            ?? 0);
$aguardando       = (int)($row['aguardando_agendamento'] ?? 0);
$agendadosNoPrazo = (int)($row['agendados_no_prazo']    ?? 0);
$cumpridos        = (int)($row['agendamentos_cumpridos'] ?? 0);
$perdidos         = (int)($row['agendamentos_perdidos']  ?? 0);

$total = $agendaveis + $aguardando + $agendadosNoPrazo + $cumpridos + $perdidos;

$pct = fn($v) => $total > 0 ? round(($v / $total) * 100, 1) : 0;

respondJson([
    'success' => true,
    'data' => [
        'relogios' => [
            [
                'id'        => 1,
                'nome'      => 'CT-es Agendáveis',
                'descricao' => 'Clientes agendáveis sem ocorrência de agendamento',
                'quantidade' => $agendaveis,
                'percentual' => $pct($agendaveis),
                'cor'       => '#6366f1',
                'icone'     => 'CalendarCheck',
            ],
            [
                'id'        => 2,
                'nome'      => 'Aguardando Agendamento',
                'descricao' => 'CT-es com ocorrência 14 (aguardando agendamento)',
                'quantidade' => $aguardando,
                'percentual' => $pct($aguardando),
                'cor'       => '#3b82f6',
                'icone'     => 'Clock',
            ],
            [
                'id'        => 3,
                'nome'      => 'Agendados ainda no Prazo',
                'descricao' => 'Ocorrência 15, previsão futura e sem entrega registrada',
                'quantidade' => $agendadosNoPrazo,
                'percentual' => $pct($agendadosNoPrazo),
                'cor'       => '#10b981',
                'icone'     => 'ClockCheck',
            ],
            [
                'id'        => 4,
                'nome'      => 'Agendamentos Cumpridos',
                'descricao' => 'Entregues dentro do prazo previsto',
                'quantidade' => $cumpridos,
                'percentual' => $pct($cumpridos),
                'cor'       => '#059669',
                'icone'     => 'CheckCircle',
                'destaque'  => true,
            ],
            [
                'id'        => 5,
                'nome'      => 'Agendamentos Perdidos',
                'descricao' => 'Sem entrega no prazo ou entregues com atraso',
                'quantidade' => $perdidos,
                'percentual' => $pct($perdidos),
                'cor'       => '#ef4444',
                'icone'     => 'AlertCircle',
            ],
        ],
        'totalFiltrado' => $total,
    ],
]);
