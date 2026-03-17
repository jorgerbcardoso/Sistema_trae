<?php
/**
 * Sistema de Log Personalizado
 * Escreve diretamente em arquivo, independente da configuração do error_log
 */

class Logger {
    private static $log_file = '/var/www/html/logs/debug.log';
    
    /**
     * Escreve uma mensagem no log
     * 
     * @param string $message Mensagem a ser logada
     * @param string $level Nível do log (INFO, ERROR, DEBUG)
     */
    public static function log($message, $level = 'INFO') {
        $timestamp = date('Y-m-d H:i:s');
        $formatted_message = "[{$timestamp}] [{$level}] {$message}\n";
        
        // Criar diretório de logs se não existir
        $log_dir = dirname(self::$log_file);
        if (!file_exists($log_dir)) {
            mkdir($log_dir, 0777, true);
        }
        
        // Escrever no arquivo (append mode)
        file_put_contents(self::$log_file, $formatted_message, FILE_APPEND | LOCK_EX);
        
        // Também exibe no error_log tradicional (se funcionar)
        error_log($formatted_message);
    }
    
    /**
     * Log de informação
     */
    public static function info($message) {
        self::log($message, 'INFO');
    }
    
    /**
     * Log de erro
     */
    public static function error($message) {
        self::log($message, 'ERROR');
    }
    
    /**
     * Log de debug
     */
    public static function debug($message) {
        self::log($message, 'DEBUG');
    }
    
    /**
     * Limpa o arquivo de log
     */
    public static function clear() {
        if (file_exists(self::$log_file)) {
            file_put_contents(self::$log_file, '');
        }
    }
    
    /**
     * Retorna o caminho do arquivo de log
     */
    public static function getLogFile() {
        return self::$log_file;
    }
}
