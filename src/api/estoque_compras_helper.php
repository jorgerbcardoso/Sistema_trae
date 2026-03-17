<?php
/**
 * ============================================
 * HELPER - ESTOQUE E COMPRAS
 * ============================================
 * Funções auxiliares compartilhadas entre os módulos ESTOQUE e COMPRAS
 * 
 * NOTA: setupCORS(), handleOptionsRequest(), requireAuth(), getCurrentUser() estão no config.php
 */

/**
 * Obter nome da tabela com prefixo do domínio
 * @param string $domain Domínio do usuário
 * @param string $tableName Nome base da tabela (sem prefixo)
 * @return string Nome completo da tabela com prefixo
 */
function getTableName($domain, $tableName) {
    $prefix = strtolower($domain) . '_';
    return $prefix . $tableName;
}

/**
 * Validar campos obrigatórios
 * @param array $data Dados a validar
 * @param array $requiredFields Campos obrigatórios
 * @return array|null Retorna array com campos faltantes ou null se tudo OK
 */
function validateRequiredFields($data, $requiredFields) {
    $missing = [];
    
    foreach ($requiredFields as $field) {
        if (!isset($data[$field]) || trim($data[$field]) === '') {
            $missing[] = $field;
        }
    }
    
    return empty($missing) ? null : $missing;
}

/**
 * Sanitizar campos de texto (converter para MAIÚSCULAS)
 * @param array $data Dados a sanitizar
 * @param array $fields Campos a converter para maiúsculas
 * @return array Dados sanitizados
 */
function sanitizeFields($data, $fields) {
    $result = $data;
    
    foreach ($fields as $field) {
        if (isset($result[$field]) && is_string($result[$field])) {
            $result[$field] = strtoupper(trim($result[$field]));
        }
    }
    
    return $result;
}

/**
 * Verificar se registro existe
 * @param resource $conn Conexão PostgreSQL
 * @param string $tableName Nome da tabela
 * @param string $field Campo a verificar
 * @param mixed $value Valor a verificar
 * @param int|null $excludeId ID a excluir da verificação (para updates)
 * @param string $idField Nome do campo ID (padrão: 'id')
 * @return bool True se existe, False caso contrário
 */
function recordExists($conn, $tableName, $field, $value, $excludeId = null, $idField = 'id') {
    global $g_sql;
    
    if ($excludeId !== null) {
        $query = "SELECT $idField FROM $tableName WHERE $field = $1 AND $idField != $2";
        $result = sql($g_sql, $query, false, [$value, $excludeId]);
    } else {
        $query = "SELECT $idField FROM $tableName WHERE $field = $1";
        $result = sql($g_sql, $query, false, [$value]);
    }
    
    return pg_num_rows($result) > 0;
}

/**
 * Formatar data para exibição (YYYY-MM-DD -> DD/MM/YYYY)
 * @param string|null $date Data no formato YYYY-MM-DD
 * @return string|null Data formatada ou null
 */
function formatDateForDisplay($date) {
    if (empty($date) || $date === '0000-00-00') {
        return null;
    }
    
    $timestamp = strtotime($date);
    if ($timestamp === false) {
        return null;
    }
    
    return date('d/m/Y', $timestamp);
}

/**
 * Formatar data para banco (DD/MM/YYYY -> YYYY-MM-DD)
 * @param string|null $date Data no formato DD/MM/YYYY
 * @return string|null Data formatada ou null
 */
function formatDateForDatabase($date) {
    if (empty($date)) {
        return null;
    }
    
    // Se já estiver no formato correto, retornar
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return $date;
    }
    
    // Converter DD/MM/YYYY -> YYYY-MM-DD
    $parts = explode('/', $date);
    if (count($parts) === 3) {
        return $parts[2] . '-' . $parts[1] . '-' . $parts[0];
    }
    
    return null;
}

/**
 * Gerar próximo número sequencial para um campo
 * @param resource $conn Conexão PostgreSQL
 * @param string $tableName Nome da tabela
 * @param string $field Campo numérico
 * @param array $conditions Condições WHERE adicionais (opcional)
 * @return int Próximo número
 */
function getNextNumber($conn, $tableName, $field, $conditions = []) {
    global $g_sql;
    
    $where = empty($conditions) ? '' : ' WHERE ' . implode(' AND ', $conditions);
    $query = "SELECT COALESCE(MAX($field), 0) + 1 as next_number FROM $tableName" . $where;
    
    $result = sql($g_sql, $query, false, []);
    $row = pg_fetch_assoc($result);
    
    return intval($row['next_number']);
}

/**
 * Auditoria: Adicionar campos de inclusão
 * @param array $data Dados originais
 * @param string $username Login do usuário
 * @return array Dados com campos de auditoria
 */
function addCreationAudit($data, $username) {
    $data['login_inclusao'] = strtoupper($username);
    $data['data_inclusao'] = date('Y-m-d');
    $data['hora_inclusao'] = date('H:i:s');
    
    return $data;
}

/**
 * Auditoria: Adicionar campos de alteração
 * @param array $data Dados originais
 * @param string $username Login do usuário
 * @return array Dados com campos de auditoria
 */
function addUpdateAudit($data, $username) {
    $data['login_alteracao'] = strtoupper($username);
    $data['data_alteracao'] = date('Y-m-d');
    $data['hora_alteracao'] = date('H:i:s');
    
    return $data;
}

/**
 * Converter resultado PostgreSQL para array
 * @param resource $result Resultado da query
 * @return array Array de registros
 */
function pgResultToArray($result) {
    $data = [];
    
    while ($row = pg_fetch_assoc($result)) {
        $data[] = $row;
    }
    
    return $data;
}

/**
 * Executar query com paginação
 * @param resource $conn Conexão PostgreSQL
 * @param string $query Query base (sem LIMIT/OFFSET)
 * @param array $params Parâmetros da query
 * @param int $page Página atual (1-based)
 * @param int $perPage Registros por página
 * @return array ['data' => [...], 'total' => N, 'page' => N, 'perPage' => N, 'totalPages' => N]
 */
function executePaginatedQuery($conn, $query, $params, $page = 1, $perPage = 50) {
    global $g_sql;
    
    // Contar total de registros
    $countQuery = preg_replace('/SELECT .+ FROM/i', 'SELECT COUNT(*) as total FROM', $query);
    $countResult = sql($g_sql, $countQuery, false, $params);
    $countRow = pg_fetch_assoc($countResult);
    $total = intval($countRow['total']);
    
    // Calcular offset
    $offset = ($page - 1) * $perPage;
    
    // Executar query com paginação
    $paginatedQuery = $query . " LIMIT $perPage OFFSET $offset";
    $result = sql($g_sql, $paginatedQuery, false, $params);
    
    $data = pgResultToArray($result);
    
    return [
        'data' => $data,
        'total' => $total,
        'page' => $page,
        'perPage' => $perPage,
        'totalPages' => ceil($total / $perPage)
    ];
}