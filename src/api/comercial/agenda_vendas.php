<?php
/**
 * ============================================
 * API: COMERCIAL - AGENDA DE VENDAS
 * ============================================
 * Tabela: [dominio]_agenda_venda
 *   seq_agenda | data | login | cnpj | codigo_acao_venda | observacao
 *   cumprida | data_cumprimento | criado_em
 *
 * A agenda liga um vendedor ([dominio]_vendedor.login) a um cliente da sua
 * carteira ([dominio]_vendedor_cliente) e a uma ação de venda pré-cadastrada
 * ([dominio]_acao_venda). Ao confirmar o cumprimento da ação, o status da
 * ação passa a valer para o vínculo vendedor x cliente e data_status = hoje.
 * Enquanto não houver confirmação, nada muda em [dominio]_vendedor_cliente.
 *
 * GET
 * - (padrão) ?ini=YYYY-MM-DD&fim=YYYY-MM-DD[&login=login1,login2]
 *              → { eu, vendedores, acoes, agenda, periodo }
 * - ?action=clientes&login=xxx&origem=carteira|fora → clientes disponíveis
 *
 * POST (JSON)
 * - { action: 'criar',     data, login, cnpj, codigo_acao_venda, observacao }
 * - { action: 'atualizar', seq_agenda, data, login, cnpj, codigo_acao_venda, observacao }
 * - { action: 'excluir',   seq_agenda }
 * - { action: 'transferir_agenda', login_origem, login_destino, ini?, fim? }
 * - { action: 'cumprir',   seq_agenda }
 * ============================================
 */

set_time_limit(0);
ini_set('max_execution_time', '0');
ini_set('memory_limit', '512M');

require_once __DIR__ . '/../config.php';

setupCORS();
handleOptionsRequest();
requireAuth();

$currentUser = getCurrentUser();
$dominio = strtolower((string)$currentUser['domain']);
$prefix  = $dominio . '_';

global $g_sql;
$g_sql = getDBConnection();

if (!$g_sql) {
    msg('Erro ao conectar ao banco de dados', 'error', 500);
}

$tblVendedor        = $prefix . 'vendedor';
$tblVendedorCliente = $prefix . 'vendedor_cliente';
$tblCliente         = $prefix . 'cliente';
$tblAcaoVenda       = $prefix . 'acao_venda';
$tblAgenda          = $prefix . 'agenda_venda';

$STATUS = [
    'C' => 'CONQUISTA',
    'D' => 'CADASTRADO',
    'P' => 'EM PROSPECÇÃO',
    'N' => 'EM NEGOCIAÇÃO',
    'R' => 'RECONQUISTA',
];

const AG_DIAS_ATRAS = 10;
const AG_DIAS_FRENTE = 20;

// ============================================
// HELPERS
// ============================================

function agTabelaExiste(string $tabela): bool {
    $r = sql("SELECT 1 FROM information_schema.tables WHERE lower(table_name) = lower($1) LIMIT 1", [$tabela]);
    return $r && pg_num_rows($r) > 0;
}

function agColunaExiste(string $tabela, string $coluna): bool {
    $r = sql(
        "SELECT 1 FROM information_schema.columns
          WHERE lower(table_name) = lower($1) AND lower(column_name) = lower($2) LIMIT 1",
        [$tabela, $coluna]
    );
    return $r && pg_num_rows($r) > 0;
}

/**
 * Garante a existência da tabela da agenda (multi-domínio) e das colunas
 * de controle do cumprimento, inclusive para bases já existentes.
 */
function agGarantirTabela(string $tabela): void {
    if (!agTabelaExiste($tabela)) {
        sql("CREATE TABLE {$tabela} (
                seq_agenda        SERIAL PRIMARY KEY,
                data              DATE NOT NULL,
                login             VARCHAR(50) NOT NULL,
                cnpj              VARCHAR(20) NOT NULL,
                codigo_acao_venda INTEGER NOT NULL,
                observacao        VARCHAR(500),
                cumprida          BOOLEAN NOT NULL DEFAULT FALSE,
                data_cumprimento  DATE,
                criado_em         TIMESTAMP NOT NULL DEFAULT NOW()
             )");
        return;
    }

    if (!agColunaExiste($tabela, 'seq_agenda')) {
        sql("ALTER TABLE {$tabela} ADD COLUMN seq_agenda SERIAL PRIMARY KEY");
    }
    if (!agColunaExiste($tabela, 'observacao')) {
        sql("ALTER TABLE {$tabela} ADD COLUMN observacao VARCHAR(500)");
    }
    if (!agColunaExiste($tabela, 'cumprida')) {
        sql("ALTER TABLE {$tabela} ADD COLUMN cumprida BOOLEAN NOT NULL DEFAULT FALSE");
    }
    if (!agColunaExiste($tabela, 'data_cumprimento')) {
        sql("ALTER TABLE {$tabela} ADD COLUMN data_cumprimento DATE");
    }
    if (!agColunaExiste($tabela, 'criado_em')) {
        sql("ALTER TABLE {$tabela} ADD COLUMN criado_em TIMESTAMP NOT NULL DEFAULT NOW()");
    }
}

/** Garante as colunas de status do vínculo vendedor x cliente. */
function agGarantirColunasVinculo(string $tabela): void {
    if (!agColunaExiste($tabela, 'status')) {
        sql("ALTER TABLE {$tabela} ADD COLUMN status VARCHAR(1)");
    }
    if (!agColunaExiste($tabela, 'data_status')) {
        sql("ALTER TABLE {$tabela} ADD COLUMN data_status DATE");
    }
}

/** Expressão SQL que devolve apenas os dígitos do CNPJ de uma coluna. */
function agCnpjDigitosSql(string $coluna): string {
    return "regexp_replace(COALESCE({$coluna}::text, ''), '[^0-9]', '', 'g')";
}

function agDigitos($valor): string {
    return preg_replace('/[^0-9]/', '', (string)$valor);
}

function agFormatarCnpj($cnpj): string {
    $n = agDigitos($cnpj);
    if (strlen($n) !== 14) {
        return (string)$cnpj;
    }
    return substr($n, 0, 2) . '.' . substr($n, 2, 3) . '.' . substr($n, 5, 3)
         . '/' . substr($n, 8, 4) . '-' . substr($n, 12, 2);
}

function agDataValida(string $valor): bool {
    $dt = DateTime::createFromFormat('Y-m-d', $valor);
    return $dt !== false && $dt->format('Y-m-d') === $valor;
}

function agDataIso($valor, string $fallback): string {
    $valor = trim((string)$valor);
    return agDataValida($valor) ? $valor : $fallback;
}

/**
 * Identifica o usuário logado: login, se é vendedor da base e se é admin.
 * Como o login do vendedor é o mesmo login da Presto, basta comparar com
 * [dominio]_vendedor.login.
 */
function agInfoUsuario(string $tblVendedor, array $currentUser): array {
    $login   = trim((string)($currentUser['username'] ?? ''));
    $isAdmin = !empty($currentUser['is_admin']);
    $nome    = '';
    $isVendedor = false;

    if ($login !== '') {
        $r = sql("SELECT login, nome FROM {$tblVendedor} WHERE lower(login) = lower($1) LIMIT 1", [$login]);
        if ($r && pg_num_rows($r) > 0) {
            $row        = pg_fetch_assoc($r);
            $isVendedor = true;
            $nome       = (string)($row['nome'] ?? '');
            $login      = (string)($row['login'] ?? $login);
        }
    }

    return [
        'login'       => $login,
        'nome'        => $nome,
        'is_admin'    => $isAdmin,
        'is_vendedor' => $isVendedor,
    ];
}

/** Normaliza a lista de logins do filtro (CSV) em um array limpo. */
function agLoginsDoParametro(string $valor): array {
    $partes = explode(',', $valor);
    $logins = [];
    foreach ($partes as $p) {
        $p = trim($p);
        if ($p !== '') {
            $logins[] = $p;
        }
    }
    return array_values(array_unique($logins));
}

// ============================================
// AÇÕES
// ============================================

function agListar(
    string $tblAgenda,
    string $tblVendedor,
    string $tblVendedorCliente,
    string $tblCliente,
    string $tblAcaoVenda,
    array $STATUS,
    array $eu
): void {
    $hoje = date('Y-m-d');
    $iniPadrao = date('Y-m-d', strtotime("-" . AG_DIAS_ATRAS . " days"));
    $fimPadrao = date('Y-m-d', strtotime("+" . AG_DIAS_FRENTE . " days"));

    $ini = agDataIso((string)($_GET['ini'] ?? ''), $iniPadrao);
    $fim = agDataIso((string)($_GET['fim'] ?? ''), $fimPadrao);
    if ($fim < $ini) {
        $tmp = $ini;
        $ini = $fim;
        $fim = $tmp;
    }

    // Vendedor enxerga apenas a própria agenda; os demais podem escolher.
    if ($eu['is_vendedor']) {
        $loginsFiltro = [$eu['login']];
    } else {
        $loginsFiltro = agLoginsDoParametro((string)($_GET['login'] ?? ''));
    }

    $params = [$ini, $fim];
    $whereLogin = '';
    if (!empty($loginsFiltro)) {
        $ph = [];
        foreach ($loginsFiltro as $l) {
            $params[] = $l;
            $ph[] = '$' . count($params);
        }
        $whereLogin = ' AND lower(a.login) IN (' . implode(', ', $ph) . ')';
    }

    $digAgenda = agCnpjDigitosSql('a.cnpj');
    $digCliente = agCnpjDigitosSql('c.cnpj');

    $query = "
        SELECT
            a.seq_agenda,
            TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
            a.login,
            a.cnpj,
            a.codigo_acao_venda,
            COALESCE(a.observacao, '')     AS observacao,
            COALESCE(a.cumprida, FALSE)    AS cumprida,
            CASE WHEN a.data_cumprimento IS NULL THEN NULL
                 ELSE TO_CHAR(a.data_cumprimento, 'YYYY-MM-DD') END AS data_cumprimento,
            COALESCE(c.nome, '')           AS cliente_nome,
            COALESCE(v.nome, a.login)      AS vendedor_nome,
            COALESCE(av.descricao, '')     AS acao_descricao,
            COALESCE(av.status, '')        AS acao_status
        FROM {$tblAgenda} a
        LEFT JOIN {$tblCliente} c  ON {$digCliente} = {$digAgenda}
        LEFT JOIN {$tblVendedor} v ON lower(v.login) = lower(a.login)
        LEFT JOIN {$tblAcaoVenda} av ON av.codigo = a.codigo_acao_venda
        WHERE a.data >= $1::date AND a.data <= $2::date{$whereLogin}
        ORDER BY a.data, v.nome, a.seq_agenda
    ";

    $result = sql($query, $params);
    if (!$result) {
        msg('Erro ao buscar a agenda', 'error', 500);
    }

    $agenda = [];
    while ($row = pg_fetch_assoc($result)) {
        $status = strtoupper(trim((string)$row['acao_status']));
        $agenda[] = [
            'seq_agenda'        => (int)$row['seq_agenda'],
            'data'              => (string)$row['data'],
            'login'             => (string)$row['login'],
            'vendedor_nome'     => (string)$row['vendedor_nome'],
            'cnpj'              => (string)$row['cnpj'],
            'cnpj_fmt'          => agFormatarCnpj($row['cnpj']),
            'cliente_nome'      => (string)$row['cliente_nome'],
            'codigo_acao_venda' => (int)$row['codigo_acao_venda'],
            'acao_descricao'    => (string)$row['acao_descricao'],
            'acao_status'       => $status,
            'acao_status_label' => $STATUS[$status] ?? '',
            'observacao'        => (string)$row['observacao'],
            'cumprida'          => pgBoolToPHP($row['cumprida']),
            'data_cumprimento'  => $row['data_cumprimento'] ?? null,
        ];
    }

    // Vendedores disponíveis para o filtro (apenas para quem não é vendedor).
    $vendedores = [];
    if (!$eu['is_vendedor']) {
        $rv = sql("
            SELECT v.login, v.nome, COUNT(DISTINCT vc.cnpj)::int AS qtd_clientes
              FROM {$tblVendedor} v
              LEFT JOIN {$tblVendedorCliente} vc ON lower(vc.login) = lower(v.login)
             GROUP BY v.login, v.nome
             ORDER BY v.nome
        ");
        while ($rv && ($row = pg_fetch_assoc($rv))) {
            $vendedores[] = [
                'login'        => (string)$row['login'],
                'nome'         => (string)($row['nome'] ?? ''),
                'qtd_clientes' => (int)($row['qtd_clientes'] ?? 0),
            ];
        }
    }

    // Ações de venda disponíveis para o agendamento.
    $acoes = [];
    $ra = sql("SELECT codigo, descricao, status FROM {$tblAcaoVenda} ORDER BY codigo");
    while ($ra && ($row = pg_fetch_assoc($ra))) {
        $status = strtoupper(trim((string)$row['status']));
        $acoes[] = [
            'codigo'       => (int)$row['codigo'],
            'descricao'    => (string)($row['descricao'] ?? ''),
            'status'       => $status,
            'status_label' => $STATUS[$status] ?? '',
        ];
    }

    echo json_encode([
        'success'    => true,
        'eu'         => $eu,
        'vendedores' => $vendedores,
        'acoes'      => $acoes,
        'agenda'     => $agenda,
        'periodo'    => [
            'ini'  => $ini,
            'fim'  => $fim,
            'hoje' => $hoje,
        ],
    ], JSON_UNESCAPED_UNICODE);
}

/** Lista clientes da carteira ou ainda fora da carteira do vendedor selecionado. */
function agListarClientes(string $tblVendedorCliente, string $tblCliente, array $STATUS): void {
    $login = trim((string)($_GET['login'] ?? ''));
    if ($login === '') {
        msg('Vendedor não informado', 'error', 400);
    }

    $origem = strtolower(trim((string)($_GET['origem'] ?? 'carteira')));
    if (!in_array($origem, ['carteira', 'fora'], true)) {
        msg('Origem dos clientes inválida', 'error', 400);
    }
    $foraCarteira = $origem === 'fora';
    $termo = trim((string)($_GET['q'] ?? ''));
    if ($foraCarteira) {
        preg_match_all('/./u', $termo, $caracteres);
        if (count($caracteres[0] ?? []) < 3) {
            echo json_encode(['success' => true, 'clientes' => []], JSON_UNESCAPED_UNICODE);
            return;
        }
    }

    $colStatus = agColunaExiste($tblVendedorCliente, 'status') ? 'vc.status' : "''::varchar";
    $joinVinculo = $foraCarteira
        ? ''
        : "INNER JOIN {$tblVendedorCliente} vc
               ON lower(vc.login) = lower($1)
              AND " . agCnpjDigitosSql('vc.cnpj') . " = " . agCnpjDigitosSql('c.cnpj');
    $whereOrigem = $foraCarteira
        ? "WHERE NOT EXISTS (
                SELECT 1 FROM {$tblVendedorCliente} vc
                 WHERE lower(vc.login) = lower($1)
                   AND " . agCnpjDigitosSql('vc.cnpj') . " = " . agCnpjDigitosSql('c.cnpj') . "
           )"
        : '';
    $selStatus = $foraCarteira ? "''::varchar" : $colStatus;
    $params = [$login];
    $whereBusca = '';
    if ($foraCarteira) {
        $params[] = '%' . $termo . '%';
        $idxNome = count($params);
        $whereBusca = " AND (COALESCE(c.nome, '') ILIKE $" . $idxNome .
            " OR COALESCE(cid.nome, '') ILIKE $" . $idxNome .
            " OR COALESCE(cid.uf, '') ILIKE $" . $idxNome;
        $digitosBusca = agDigitos($termo);
        if ($digitosBusca !== '') {
            $params[] = '%' . $digitosBusca . '%';
            $idxCnpj = count($params);
            $whereBusca .= " OR " . agCnpjDigitosSql('c.cnpj') . " LIKE $" . $idxCnpj;
        }
        $whereBusca .= ')';
    }
    $limite = $foraCarteira ? 'LIMIT 100' : '';

    $query = "
        SELECT
            DISTINCT c.cnpj,
            c.nome,
            COALESCE(cid.nome, '') AS cidade,
            COALESCE(cid.uf, '')   AS uf,
            {$selStatus}           AS status
        FROM {$tblCliente} c
        {$joinVinculo}
        LEFT JOIN cidade cid ON cid.seq_cidade = c.seq_cidade
        {$whereOrigem}
        {$whereBusca}
        ORDER BY c.nome
        {$limite}
    ";

    $result = sql($query, $params);
    if (!$result) {
        msg('Erro ao buscar os clientes', 'error', 500);
    }

    $clientes = [];
    while ($row = pg_fetch_assoc($result)) {
        $status = strtoupper(trim((string)$row['status']));
        if ($status === '' || !isset($STATUS[$status])) {
            $status = 'D';
        }
        $clientes[] = [
            'cnpj'         => (string)$row['cnpj'],
            'cnpj_fmt'     => agFormatarCnpj($row['cnpj']),
            'nome'         => (string)($row['nome'] ?? ''),
            'cidade'       => (string)$row['cidade'],
            'uf'           => (string)$row['uf'],
            'status'       => $status,
            'status_label' => $STATUS[$status],
        ];
    }

    echo json_encode(['success' => true, 'clientes' => $clientes], JSON_UNESCAPED_UNICODE);
}

/**
 * Busca uma linha da agenda com o status da ação vinculada.
 * Retorna null quando não existe.
 */
function agObterLinha(string $tblAgenda, string $tblAcaoVenda, int $seqAgenda): ?array {
    $query = "
        SELECT
            a.seq_agenda,
            TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
            a.login,
            a.cnpj,
            a.codigo_acao_venda,
            COALESCE(a.cumprida, FALSE) AS cumprida,
            COALESCE(av.status, '')     AS acao_status,
            COALESCE(av.descricao, '')  AS acao_descricao
        FROM {$tblAgenda} a
        LEFT JOIN {$tblAcaoVenda} av ON av.codigo = a.codigo_acao_venda
        WHERE a.seq_agenda = $1
        LIMIT 1
    ";
    $r = sql($query, [$seqAgenda]);
    if (!$r || pg_num_rows($r) === 0) {
        return null;
    }
    $row = pg_fetch_assoc($r);
    $row['cumprida'] = pgBoolToPHP($row['cumprida']);
    return $row;
}

/** Garante que o usuário logado pode mexer na linha (vendedor só na própria). */
function agValidarPermissaoLinha(array $eu, array $linha): void {
    if ($eu['is_vendedor'] && strcasecmp((string)$linha['login'], (string)$eu['login']) !== 0) {
        msg('Você só pode alterar a sua própria agenda', 'error', 403);
    }
}

function agCriar(
    string $tblAgenda,
    string $tblVendedor,
    string $tblVendedorCliente,
    string $tblCliente,
    string $tblAcaoVenda,
    array $data,
    array $eu
): void {
    $dia = trim((string)($data['data'] ?? ''));
    if (!agDataValida($dia)) {
        msg('Informe uma data válida', 'error', 400);
    }

    // Vendedor só cria para si; os demais informam o vendedor desejado.
    $login = $eu['is_vendedor'] ? (string)$eu['login'] : trim((string)($data['login'] ?? ''));
    if ($login === '') {
        msg('Informe o vendedor', 'error', 400);
    }

    $rv = sql("SELECT login FROM {$tblVendedor} WHERE lower(login) = lower($1) LIMIT 1", [$login]);
    if (!$rv || pg_num_rows($rv) === 0) {
        msg('Vendedor não encontrado', 'error', 404);
    }
    $login = (string)pg_fetch_assoc($rv)['login'];

    $cnpj = agDigitos($data['cnpj'] ?? '');
    if ($cnpj === '') {
        msg('Selecione o cliente', 'error', 400);
    }

    $origemCliente = strtolower(trim((string)($data['origem_cliente'] ?? 'carteira')));
    if (!in_array($origemCliente, ['carteira', 'fora'], true)) {
        msg('Selecione a origem do cliente', 'error', 400);
    }

    $exprCnpjVinculo = agCnpjDigitosSql('cnpj');
    $rc = sql(
        "SELECT 1 FROM {$tblVendedorCliente}
          WHERE lower(login) = lower($1) AND {$exprCnpjVinculo} = $2
          LIMIT 1",
        [$login, $cnpj]
    );
    if (!$rc) {
        msg('Não foi possível validar a carteira do vendedor', 'error', 500);
    }
    if ($origemCliente === 'fora' && pg_num_rows($rc) > 0) {
        msg('Este cliente pertence à carteira do vendedor. Atualize a seleção e tente novamente.', 'error', 400);
    }
    if ($origemCliente === 'carteira' && (!$rc || pg_num_rows($rc) === 0)) {
        msg('Cliente não pertence à carteira do vendedor', 'error', 400);
    }

    $rCliente = sql(
        "SELECT 1 FROM {$tblCliente} WHERE " . agCnpjDigitosSql('cnpj') . " = $1 LIMIT 1",
        [$cnpj]
    );
    if (!$rCliente || pg_num_rows($rCliente) === 0) {
        msg('Cliente não encontrado', 'error', 404);
    }

    $codigo = (int)($data['codigo_acao_venda'] ?? 0);
    if ($codigo <= 0) {
        msg('Selecione a ação de venda', 'error', 400);
    }
    $ra = sql("SELECT 1 FROM {$tblAcaoVenda} WHERE codigo = $1 LIMIT 1", [$codigo]);
    if (!$ra || pg_num_rows($ra) === 0) {
        msg('Ação de venda não encontrada', 'error', 404);
    }

    $observacao = trim((string)($data['observacao'] ?? ''));
    if (mb_strlen($observacao) > 500) {
        msg('A observação deve ter no máximo 500 caracteres', 'error', 400);
    }

    $result = sql(
        "INSERT INTO {$tblAgenda} (data, login, cnpj, codigo_acao_venda, observacao)
         VALUES ($1::date, $2, $3, $4, $5) RETURNING seq_agenda",
        [$dia, $login, $cnpj, $codigo, $observacao]
    );
    $row = $result ? pg_fetch_assoc($result) : null;
    if (!$row) {
        msg('Erro ao agendar o compromisso', 'error', 500);
    }

    msg('Compromisso agendado com sucesso', 'success', 200, ['seq_agenda' => (int)$row['seq_agenda']]);
}

function agAtualizar(
    string $tblAgenda,
    string $tblVendedor,
    string $tblCliente,
    string $tblAcaoVenda,
    array $data,
    array $eu
): void {
    $seq = (int)($data['seq_agenda'] ?? 0);
    if ($seq <= 0) {
        msg('Compromisso não informado', 'error', 400);
    }

    $linha = agObterLinha($tblAgenda, $tblAcaoVenda, $seq);
    if ($linha === null) {
        msg('Compromisso não encontrado', 'error', 404);
    }
    agValidarPermissaoLinha($eu, $linha);

    $dia = trim((string)($data['data'] ?? $linha['data'] ?? ''));
    if (!agDataValida($dia)) {
        msg('Informe uma data válida', 'error', 400);
    }

    $login = $eu['is_vendedor']
        ? (string)$eu['login']
        : trim((string)($data['login'] ?? $linha['login']));
    if ($login === '') {
        msg('Informe o vendedor', 'error', 400);
    }
    $rv = sql("SELECT login FROM {$tblVendedor} WHERE lower(login) = lower($1) LIMIT 1", [$login]);
    if (!$rv || pg_num_rows($rv) === 0) {
        msg('Vendedor não encontrado', 'error', 404);
    }
    $login = (string)pg_fetch_assoc($rv)['login'];

    $cnpj = agDigitos($data['cnpj'] ?? $linha['cnpj']);
    if ($cnpj === '') {
        msg('Selecione o cliente', 'error', 400);
    }
    $rCliente = sql(
        "SELECT 1 FROM {$tblCliente} WHERE " . agCnpjDigitosSql('cnpj') . " = $1 LIMIT 1",
        [$cnpj]
    );
    if (!$rCliente || pg_num_rows($rCliente) === 0) {
        msg('Cliente não encontrado', 'error', 404);
    }

    $reassign = strcasecmp($login, (string)$linha['login']) !== 0
        || agDigitos($linha['cnpj']) !== $cnpj;
    if ($linha['cumprida'] && $reassign) {
        msg('Compromisso cumprido: não é possível trocar o vendedor ou o cliente', 'error', 409);
    }

    $codigoAtual = (int)$linha['codigo_acao_venda'];
    $codigo = (int)($data['codigo_acao_venda'] ?? 0);
    if ($codigo <= 0) {
        msg('Selecione a ação de venda', 'error', 400);
    }

    // Depois de confirmada, a ação aplicada ao cliente não pode ser trocada.
    if ($linha['cumprida'] && $codigo !== $codigoAtual) {
        msg('Ação já confirmada: não é possível alterar a ação de venda', 'error', 409);
    }

    if ($codigo !== $codigoAtual) {
        $ra = sql("SELECT 1 FROM {$tblAcaoVenda} WHERE codigo = $1 LIMIT 1", [$codigo]);
        if (!$ra || pg_num_rows($ra) === 0) {
            msg('Ação de venda não encontrada', 'error', 404);
        }
    }

    $observacao = trim((string)($data['observacao'] ?? ''));
    if (mb_strlen($observacao) > 500) {
        msg('A observação deve ter no máximo 500 caracteres', 'error', 400);
    }

    $result = sql(
        "UPDATE {$tblAgenda}
            SET data = $1::date, login = $2, cnpj = $3, codigo_acao_venda = $4, observacao = $5
          WHERE seq_agenda = $6",
        [$dia, $login, $cnpj, $codigo, $observacao, $seq]
    );
    if (!$result) {
        msg('Erro ao atualizar o compromisso', 'error', 500);
    }

    msg('Compromisso atualizado com sucesso', 'success');
}

/** Exclui um compromisso respeitando a permissão do vendedor. */
function agExcluir(string $tblAgenda, string $tblAcaoVenda, array $data, array $eu): void {
    $seq = (int)($data['seq_agenda'] ?? 0);
    if ($seq <= 0) {
        msg('Compromisso não informado', 'error', 400);
    }

    $linha = agObterLinha($tblAgenda, $tblAcaoVenda, $seq);
    if ($linha === null) {
        msg('Compromisso não encontrado', 'error', 404);
    }
    agValidarPermissaoLinha($eu, $linha);

    $result = sql("DELETE FROM {$tblAgenda} WHERE seq_agenda = $1", [$seq]);
    if (!$result) {
        msg('Erro ao excluir o compromisso', 'error', 500);
    }
    if (pg_affected_rows($result) === 0) {
        msg('Compromisso não encontrado', 'error', 404);
    }

    msg('Compromisso excluído com sucesso', 'success', 200, ['seq_agenda' => $seq]);
}

/** Transfere os compromissos pendentes entre vendedores, opcionalmente por período. */
function agTransferirAgenda(
    string $tblAgenda,
    string $tblVendedor,
    array $data,
    array $eu
): void {
    if ($eu['is_vendedor']) {
        msg('Somente usuários de gestão podem transferir agendas', 'error', 403);
    }

    $origem = trim((string)($data['login_origem'] ?? ''));
    $destino = trim((string)($data['login_destino'] ?? ''));
    if ($origem === '' || $destino === '') {
        msg('Selecione o vendedor de origem e o de destino', 'error', 400);
    }
    if (strcasecmp($origem, $destino) === 0) {
        msg('Os vendedores de origem e destino devem ser diferentes', 'error', 400);
    }

    $rVendedores = sql(
        "SELECT lower(login) AS login_norm, login
           FROM {$tblVendedor}
          WHERE lower(login) IN (lower($1), lower($2))",
        [$origem, $destino]
    );
    $loginsValidos = [];
    while ($rVendedores && ($row = pg_fetch_assoc($rVendedores))) {
        $loginsValidos[$row['login_norm']] = (string)$row['login'];
    }
    if (!isset($loginsValidos[strtolower($origem)]) || !isset($loginsValidos[strtolower($destino)])) {
        msg('Vendedor de origem ou destino não encontrado', 'error', 404);
    }
    $origem = $loginsValidos[strtolower($origem)];
    $destino = $loginsValidos[strtolower($destino)];

    $ini = trim((string)($data['ini'] ?? ''));
    $fim = trim((string)($data['fim'] ?? ''));
    if (($ini !== '' && !agDataValida($ini)) || ($fim !== '' && !agDataValida($fim))) {
        msg('Informe um período válido', 'error', 400);
    }
    if ($ini !== '' && $fim !== '' && $ini > $fim) {
        msg('A data inicial do período não pode ser posterior à data final', 'error', 400);
    }

    $where = 'lower(login) = lower($1)';
    $params = [$origem];
    if ($ini !== '') {
        $params[] = $ini;
        $where .= ' AND data >= $' . count($params) . '::date';
    }
    if ($fim !== '') {
        $params[] = $fim;
        $where .= ' AND data <= $' . count($params) . '::date';
    }

    $rCumpridos = sql(
        "SELECT COUNT(*)::int AS total
           FROM {$tblAgenda}
          WHERE {$where} AND COALESCE(cumprida, FALSE) = TRUE",
        $params
    );
    if (!$rCumpridos) {
        msg('Erro ao consultar os compromissos cumpridos', 'error', 500);
    }
    $cumpridos = (int)(pg_fetch_assoc($rCumpridos)['total'] ?? 0);

    $paramsUpdate = [$destino, $origem];
    $whereUpdate = 'lower(login) = lower($2)';
    if ($ini !== '') {
        $paramsUpdate[] = $ini;
        $whereUpdate .= ' AND data >= $' . count($paramsUpdate) . '::date';
    }
    if ($fim !== '') {
        $paramsUpdate[] = $fim;
        $whereUpdate .= ' AND data <= $' . count($paramsUpdate) . '::date';
    }
    $result = sql(
        "UPDATE {$tblAgenda}
            SET login = $1
          WHERE {$whereUpdate}
            AND COALESCE(cumprida, FALSE) = FALSE",
        $paramsUpdate
    );
    if (!$result) {
        msg('Erro ao transferir os compromissos', 'error', 500);
    }

    $transferidos = pg_affected_rows($result);
    msg(
        $transferidos . ' compromisso(s) transferido(s).' .
            ($cumpridos > 0 ? ' ' . $cumpridos . ' compromisso(s) já cumprido(s) permaneceram com o vendedor original.' : ''),
        'success',
        200,
        ['transferidos' => $transferidos, 'cumpridos_preservados' => $cumpridos]
    );
}

/**
 * Confirma o cumprimento da ação: aplica o status da ação de venda ao vínculo
 * vendedor x cliente e atualiza data_status. Só então o funil é alterado.
 */
function agCumprir(
    string $tblAgenda,
    string $tblVendedorCliente,
    string $tblAcaoVenda,
    array $data,
    array $eu,
    array $STATUS
): void {
    $seq = (int)($data['seq_agenda'] ?? 0);
    if ($seq <= 0) {
        msg('Compromisso não informado', 'error', 400);
    }

    $linha = agObterLinha($tblAgenda, $tblAcaoVenda, $seq);
    if ($linha === null) {
        msg('Compromisso não encontrado', 'error', 404);
    }
    agValidarPermissaoLinha($eu, $linha);

    if ($linha['cumprida']) {
        msg('Esta ação já foi confirmada', 'error', 409);
    }

    $status = strtoupper(trim((string)$linha['acao_status']));
    if ($status === '' || !isset($STATUS[$status])) {
        msg('A ação de venda vinculada não possui um status válido', 'error', 409);
    }

    $cnpj = agDigitos($linha['cnpj']);

    $upd = sql(
        "UPDATE {$tblVendedorCliente}
            SET status = $1, data_status = CURRENT_DATE
          WHERE lower(login) = lower($2) AND " . agCnpjDigitosSql('cnpj') . " = $3",
        [$status, (string)$linha['login'], $cnpj]
    );
    if (!$upd) {
        msg('Erro ao atualizar o status do cliente', 'error', 500);
    }
    if (pg_affected_rows($upd) === 0) {
        // Clientes prospectados entram na carteira somente quando a ação é cumprida.
        $ins = sql(
            "INSERT INTO {$tblVendedorCliente} (login, cnpj, status, data_status)
             VALUES ($1, $2, $3, CURRENT_DATE)",
            [(string)$linha['login'], (string)$linha['cnpj'], $status]
        );
        if (!$ins) {
            msg('Erro ao incluir o cliente na carteira do vendedor', 'error', 500);
        }
    }

    $updAg = sql(
        "UPDATE {$tblAgenda} SET cumprida = TRUE, data_cumprimento = CURRENT_DATE WHERE seq_agenda = $1",
        [$seq]
    );
    if (!$updAg) {
        msg('Erro ao confirmar o cumprimento', 'error', 500);
    }

    msg(
        'Ação cumprida. Status do cliente atualizado para ' . $STATUS[$status] . '.',
        'success',
        200,
        ['seq_agenda' => $seq, 'status' => $status]
    );
}

// ============================================
// ROTEAMENTO
// ============================================

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    if (!agTabelaExiste($tblVendedor)) {
        msg('Tabela de vendedores não encontrada para este domínio.', 'error');
    }

    agGarantirColunasVinculo($tblVendedorCliente);
    agGarantirTabela($tblAgenda);

    $eu = agInfoUsuario($tblVendedor, $currentUser);

    if ($method === 'GET') {
        if ($action === 'clientes') {
            agListarClientes($tblVendedorCliente, $tblCliente, $STATUS);
        } else {
            agListar($tblAgenda, $tblVendedor, $tblVendedorCliente, $tblCliente, $tblAcaoVenda, $STATUS, $eu);
        }
        exit;
    }

    if ($method === 'POST') {
        $data = getRequestInput();
        $postAction = $data['action'] ?? '';

        if ($postAction === 'criar') {
            agCriar($tblAgenda, $tblVendedor, $tblVendedorCliente, $tblCliente, $tblAcaoVenda, $data, $eu);
        } elseif ($postAction === 'atualizar') {
            agAtualizar($tblAgenda, $tblVendedor, $tblCliente, $tblAcaoVenda, $data, $eu);
        } elseif ($postAction === 'excluir') {
            agExcluir($tblAgenda, $tblAcaoVenda, $data, $eu);
        } elseif ($postAction === 'transferir_agenda') {
            agTransferirAgenda($tblAgenda, $tblVendedor, $data, $eu);
        } elseif ($postAction === 'cumprir') {
            agCumprir($tblAgenda, $tblVendedorCliente, $tblAcaoVenda, $data, $eu, $STATUS);
        } else {
            msg('Ação não especificada', 'error', 400);
        }
        exit;
    }

    msg('Método não permitido', 'error', 405);

} catch (Throwable $e) {
    error_log("❌ ERRO em comercial/agenda_vendas.php: " . $e->getMessage()
        . " | " . $e->getFile() . ":" . $e->getLine());
    msg('Erro interno do servidor', 'error', 500);
}
