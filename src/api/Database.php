<?php
/**
 * ============================================
 * DATABASE - WRAPPER PARA POSTGRESQL
 * ============================================
 * 
 * Classe simples para encapsular a conexão PostgreSQL
 * usando funções nativas (pg_*) ao invés de PDO
 */

require_once __DIR__ . '/config.php';

class Database {
    private $connection = null;

    public function __construct() {
        // Não conecta no construtor, apenas quando necessário
    }

    /**
     * Retorna conexão PostgreSQL
     * @return resource Conexão PostgreSQL
     */
    public function getConnection() {
        if ($this->connection === null) {
            $this->connection = getDBConnection();
        }
        return $this->connection;
    }

    /**
     * Fecha a conexão
     */
    public function close() {
        if ($this->connection !== null) {
            closeDBConnection($this->connection);
            $this->connection = null;
        }
    }

    /**
     * Destrutor - fecha conexão automaticamente
     */
    public function __destruct() {
        $this->close();
    }
}
