<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/Database.php';

// Definição da constante de conexão com o banco de dados
if (!defined('PG_CONNECTION_STRING')) {
    // Use variáveis de ambiente ou um método seguro para armazenar credenciais
    $dbHost = getenv('DB_HOST') ?: 'localhost';
    $dbPort = getenv('DB_PORT') ?: '5432';
    $dbName = getenv('DB_NAME') ?: 'presto';
    $dbUser = getenv('DB_USER') ?: 'postgres';
    $dbPass = getenv('DB_PASS') ?: 'password'; // SUBSTITUIR PELA SUA SENHA
    define('PG_CONNECTION_STRING', "host={$dbHost} port={$dbPort} dbname={$dbName} user={$dbUser} password={$dbPass}");
}

/**
 * Função global para executar queries SQL de forma segura.
 */
function sql($query, $params = []) {
    $database = new Database();
    $conn = $database->getConnection();
    
    // Para debug
    // error_log("SQL Query: " . $query);
    // error_log("SQL Params: " . print_r($params, true));

    $stmt = pg_prepare($conn, "", $query);
    if (!$stmt) {
        throw new Exception("Falha ao preparar a query: " . pg_last_error($conn));
    }

    $result = pg_execute($conn, "", $params);
    if (!$result) {
        throw new Exception("Falha ao executar a query: " . pg_last_error($conn));
    }

    $data = pg_fetch_all($result);
    pg_free_result($result);
    
    return $data ?: [];
}

// Inclui outras bibliotecas globais, se houver.
require_once __DIR__ . '/lib/lib.php';
?>
