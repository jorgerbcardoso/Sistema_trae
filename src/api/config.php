
function getVeiculoCapacidade($g_sql, $placa) {
    $placa = pg_escape_string($g_sql, $placa);
    $query = "SELECT capacidade_ton, capacidade_m3 FROM veiculos WHERE placa = '$placa'";
    $result = pg_query($g_sql, $query);
    if ($result && pg_num_rows($result) > 0) {
        return pg_fetch_assoc($result);
    }
    return null;
}
