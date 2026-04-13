<?php
/**
 * Serviço de Envio de Emails
 * Utiliza PHPMailer com SMTP
 *
 * Configuração SMTP:
 * - Host: smtp.hostinger.com
 * - Porta: 587 (TLS) ou 465 (SSL)
 * - Email: contato@webpresto.com.br
 * - Senha: Web@presto4321!
 */

// PHPMailer Standalone (sem Composer)
require_once __DIR__ . '/../phpmailer/Exception.php';
require_once __DIR__ . '/../phpmailer/PHPMailer.php';
require_once __DIR__ . '/../phpmailer/SMTP.php';

// Logger personalizado
require_once __DIR__ . '/Logger.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

class EmailService {
    // ================================================================
    // ✅ CONFIGURAÇÕES SMTP - PADRÃO (ZOHO)
    // ================================================================
    private $smtp_host = 'smtppro.zoho.com';
//  private $smtp_port = 587; // TLS
    private $smtp_port = 465; // SSL
    private $smtp_username = 'contato@webpresto.com.br'; // ✅ Conta real para autenticação SMTP
    private $smtp_password = 'Web@presto54321!';
    private $from_email = 'naoresponda@webpresto.com.br'; // ✅ Alias configurado no Zoho
    private $from_name = 'Sistema Presto';

    // ================================================================
    // ✅ CONFIGURAÇÕES SMTP - ACEVILLE (GMAIL)
    // ================================================================
    private $smtp_host_aceville = 'smtp.gmail.com';
    private $smtp_port_aceville = 587; // TLS
    private $smtp_username_aceville = 'clara@aceville.com.br';
    private $smtp_password_aceville = 'dabhmthnbawjtllk';
    private $from_email_aceville = 'clara@aceville.com.br';
    private $from_name_aceville = 'Clara - Aceville';

    /**
     * ✅ DETECTAR SE O DOMÍNIO É ACEVILLE
     * @param string $domain Domínio do cliente (ex: ACV, SSW, etc)
     * @return bool True se for Aceville, False caso contrário
     */
    private function isAcevilleDomain($domain) {
        $domain_upper = strtoupper(trim($domain));
        return $domain_upper === 'ACV' || $domain_upper === 'ACEVILLE';
    }

    /**
     * ✅ RETORNAR HOST DO SISTEMA BASEADO NO DOMÍNIO
     * @param string $domain Domínio do cliente (ex: ACV, SSW, etc)
     * @return string Host do sistema (ex: sistemagestao.aceville.com.br ou webpresto.com.br)
     */
    private function getSystemHost($domain) {
        if ($this->isAcevilleDomain($domain)) {
            return 'sistemagestao.aceville.com.br';
        }
        return 'webpresto.com.br';
    }

    /**
     * ✅ RETORNAR URL COMPLETA DO SISTEMA BASEADO NO DOMÍNIO
     * @param string $domain Domínio do cliente (ex: ACV, SSW, etc)
     * @param string $path Caminho opcional (ex: /sistema, /images/logo.png)
     * @return string URL completa (ex: https://sistemagestao.aceville.com.br/sistema)
     */
    private function getSystemUrl($domain, $path = '') {
        $host = $this->getSystemHost($domain);
        $protocol = 'https';
        
        // Remover barra inicial do path se existir (para evitar duplicação)
        $path = ltrim($path, '/');
        
        if ($path) {
            return "{$protocol}://{$host}/{$path}";
        }
        
        return "{$protocol}://{$host}";
    }

    /**
     * ✅ RETORNAR NOME DO SISTEMA BASEADO NO DOMÍNIO
     * @param string $domain Domínio do cliente (ex: ACV, SSW, etc)
     * @return string Nome do sistema (ex: "Sistema Aceville" ou "Sistema Presto")
     */
    private function getSystemName($domain) {
        if ($this->isAcevilleDomain($domain)) {
            return 'Sistema Aceville';
        }
        return 'Sistema Presto';
    }

    /**
     * ✅ MÉTODOS AUXILIARES PARA PERSONALIZAÇÃO DE EMAILS
     */

    /**
     * Busca informações da empresa (nome e logo)
     * @param string $domain Domínio do cliente
     * @return array ['name' => string, 'logo_url' => string|null]
     */
    private function getEmpresaInfo($domain) {
        try {
            require_once __DIR__ . '/../config.php';
            $g_sql = connect();
            
            $query = "SELECT name, logo_dark FROM domains WHERE domain = $1";
            $result = sql($query, [strtoupper($domain)], $g_sql);
            
            if ($result && pg_num_rows($result) > 0) {
                $row = pg_fetch_assoc($result);
                
                error_log("🔍 EmailService: Dados do banco para domínio '{$domain}': " . json_encode($row));
                
                // ✅ CORRIGIR URL DA LOGO: adicionar protocolo e host se for caminho relativo
                $logo_dark = $row['logo_dark'] ?? null;
                $logo_url = null;
                
                if ($logo_dark) {
                    // Se começar com http:// ou https://, usar como está
                    if (strpos($logo_dark, 'http://') === 0 || strpos($logo_dark, 'https://') === 0) {
                        $logo_url = $logo_dark;
                        error_log("📸 EmailService: Logo já é URL completa: '{$logo_url}'");
                    } else {
                        // Caso contrário, adicionar o domínio do sistema
                        $protocol = 'https';
                        $host = $_SERVER['HTTP_HOST'] ?? 'sistema.webpresto.com.br';
                        
                        // Remover barra inicial se existir para evitar //
                        $logo_path = ltrim($logo_dark, '/');
                        $logo_url = "{$protocol}://{$host}/{$logo_path}";
                        
                        error_log("📸 EmailService: Logo convertida de '{$logo_dark}' para '{$logo_url}'");
                    }
                } else {
                    error_log("⚠️ EmailService: Logo não encontrada no banco para domínio '{$domain}'");
                }
                
                return [
                    'name' => $row['name'] ?? 'Cliente',
                    'logo_url' => $logo_url
                ];
            }
            
            error_log("⚠️ EmailService: Domínio '{$domain}' não encontrado no banco");
            return ['name' => 'Cliente', 'logo_url' => null];
        } catch (Exception $e) {
            error_log("❌ Erro ao buscar info da empresa: " . $e->getMessage());
            return ['name' => 'Cliente', 'logo_url' => null];
        }
    }

    /**
     * Busca informações do usuário logado (nome e email)
     * @param string $domain Domínio do usuário
     * @param string $username Login do usuário
     * @return array ['nome' => string, 'email' => string]
     */
    private function getUserInfo($domain, $username) {
        try {
            require_once __DIR__ . '/../config.php';
            $g_sql = connect();
            
            $query = "SELECT full_name, email FROM users WHERE domain = $1 AND username = $2";
            $result = sql($query, [strtoupper($domain), strtolower($username)], $g_sql);
            
            if ($result && pg_num_rows($result) > 0) {
                $row = pg_fetch_assoc($result);
                return [
                    'nome' => $row['full_name'] ?? 'Sistema Presto',
                    'email' => $row['email'] ?? 'contato@webpresto.com.br'
                ];
            }
            
            return ['nome' => 'Sistema Presto', 'email' => 'contato@webpresto.com.br'];
        } catch (Exception $e) {
            error_log("Erro ao buscar info do usuário: " . $e->getMessage());
            return ['nome' => 'Sistema Presto', 'email' => 'contato@webpresto.com.br'];
        }
    }

    /**
     * Adiciona sufixo " - [Nome da Empresa]" ao assunto do email
     * @param string $subject Assunto original
     * @param string $empresa_nome Nome da empresa
     * @return string Assunto formatado
     */
    private function formatarAssunto($subject, $empresa_nome) {
        return $subject . " - " . $empresa_nome;
    }

    /**
     * Gera o HTML base do email (Shell) que garante compatibilidade em webmails
     * @param string $content Conteúdo central do email
     * @param string $domain Domínio do cliente
     * @param array $empresa Dados da empresa
     * @param array $usuario Dados do remetente
     * @param string $primary_color Cor primária (azul, verde, etc)
     * @return string HTML completo
     */
    private function wrapInMainTemplate($content, $domain, $empresa, $usuario, $primary_color = '#2563eb') {
        $logo_url = $empresa['logo_url'] ?: $this->getSystemUrl($domain, 'images/logo-branca.png');
        $empresa_nome = htmlspecialchars($empresa['name']);
        $usuario_nome = htmlspecialchars($usuario['nome']);
        $usuario_email = htmlspecialchars($usuario['email']);
        $sistema_nome = $this->getSystemName($domain);
        $sistema_url = $this->getSystemUrl($domain);
        $sistema_host = $this->getSystemHost($domain);
        $isACV = $this->isAcevilleDomain($domain);

        // Estilo baseado na cor primária (suporte a gradientes simulados por cores sólidas para compatibilidade)
        $header_bg = $primary_color;
        
        return <<<HTML
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>{$sistema_nome}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f7; -webkit-font-smoothing: antialiased;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f7;">
        <tr>
            <td align="center" style="padding: 40px 10px;">
                
                <!-- CONTAINER PRINCIPAL -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; border-collapse: collapse;">
                    
                    <!-- HEADER -->
                    <tr>
                        <td align="center" style="padding: 40px 40px 30px; background-color: {$header_bg}; border-radius: 8px 8px 0 0;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <img src="{$logo_url}" alt="Logo" width="180" border="0" style="display: block; max-width: 180px; height: auto; margin-bottom: 15px; border: 0;" />
                                        <div style="font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">
                                            {$empresa_nome}
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CONTEÚDO -->
                    <tr>
                        <td style="padding: 40px; background-color: #ffffff; font-family: Arial, sans-serif;">
                            {$content}
                        </td>
                    </tr>

                    <!-- FOOTER (ASSINATURA) -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #edf2f7; text-align: center; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0 0 10px; font-family: Arial, sans-serif; font-size: 14px; color: #718096; font-weight: bold;">Atenciosamente,</p>
                            <p style="margin: 0 0 5px; font-family: Arial, sans-serif; font-size: 16px; color: #2d3748; font-weight: bold;">{$usuario_nome}</p>
                            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 14px; color: #718096;">{$usuario_email}</p>
                            
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td style="padding-top: 20px; border-top: 1px solid #edf2f7;">
                                        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #a0aec0;">
                                            &copy; 2026 {$sistema_nome} - Gestão de Transportadoras
                                        </p>
                                        <p style="margin: 5px 0 0; font-family: Arial, sans-serif; font-size: 12px;">
                                            <a href="{$sistema_url}" style="color: #3182ce; text-decoration: none; font-weight: bold;">{$sistema_host}</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <!-- NOTA DE PRIVACIDADE -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="width: 600px; margin-top: 20px; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 0 20px; text-align: center;">
                            <p style="margin: 0; font-family: Arial, sans-serif; font-size: 11px; color: #a0aec0; line-height: 1.5;">
                                Este é um email automático enviado pelo sistema de gestão.<br />
                                Por favor, não responda a este endereço de email.
                            </p>
                        </td>
                    </tr>
                </table>

            </td>
        </tr>
    </table>
</body>
</html>
HTML;
    }

    /**
     * Gera o HTML do cabeçalho do email (DEPRECATED - Usar wrapInMainTemplate)
     */
    private function getEmailHeader($logo_url, $empresa_nome) {
        return '';
    }

    /**
     * Gera o HTML do rodapé do email (DEPRECATED - Usar wrapInMainTemplate)
     */
    private function getEmailFooter($usuario_nome, $usuario_email) {
        return '';
    }

    /**
     * Envia um email
     *
     * @param string $to_email Email do destinatário
     * @param string $to_name Nome do destinatário
     * @param string $subject Assunto do email
     * @param string $html_body Corpo do email em HTML
     * @param string $text_body (Opcional) Corpo do email em texto puro
     * @param array $attachments (Opcional) Array de anexos: ['content' => base64, 'filename' => 'nome.pdf']
     * @param string $domain (Opcional) Domínio do cliente para selecionar credenciais SMTP
     * @param string $logo_url (Opcional) URL da logo para incorporar como CID
     * @return array ['success' => bool, 'message' => string]
     */
    public function sendEmail($to_email, $to_name, $subject, $html_body, $text_body = '', $attachments = [], $domain = '', $logo_url = null) {
        error_log("[EmailService] sendEmail INICIADO - Para: {$to_email}");
        try {
            $mail = new PHPMailer(true);

            // ====================================================================
            // ✅ SELECIONAR CREDENCIAIS SMTP BASEADO NO DOMÍNIO
            // ====================================================================
            $isAceville = $this->isAcevilleDomain($domain);
            
            if ($isAceville) {
                // ✅ USAR CREDENCIAIS DA ACEVILLE (GMAIL)
                $smtp_host = $this->smtp_host_aceville;
                $smtp_port = $this->smtp_port_aceville;
                $smtp_username = $this->smtp_username_aceville;
                $smtp_password = $this->smtp_password_aceville;
                $from_email = $this->from_email_aceville;
                $from_name = $this->from_name_aceville;
                $smtp_secure = PHPMailer::ENCRYPTION_STARTTLS; // TLS (porta 587)
                
                error_log("📧 EmailService: Usando credenciais ACEVILLE (Gmail) para envio");
            } else {
                // ✅ USAR CREDENCIAIS PADRÃO (ZOHO)
                $smtp_host = $this->smtp_host;
                $smtp_port = $this->smtp_port;
                $smtp_username = $this->smtp_username;
                $smtp_password = $this->smtp_password;
                $from_email = $this->from_email;
                $from_name = $this->from_name;
                $smtp_secure = PHPMailer::ENCRYPTION_SMTPS; // SSL (porta 465)
                
                error_log("📧 EmailService: Usando credenciais PADRÃO (Zoho) para envio");
            }

            // ====================================================================
            // CONFIGURAÇÕES DO SERVIDOR SMTP
            // ====================================================================

            // 🔥 DEBUG SMTP HABILITADO TEMPORARIAMENTE
            $mail->SMTPDebug = SMTP::DEBUG_SERVER; // Nível 2 - Mostra comandos SMTP
            $mail->Debugoutput = function($str, $level) {
                error_log("PHPMAILER DEBUG [$level]: $str");
            };

            // Usar SMTP
            $mail->isSMTP();
            $mail->Host       = $smtp_host;
            $mail->SMTPAuth   = true;
            $mail->Username   = $smtp_username;
            $mail->Password   = $smtp_password;
            $mail->SMTPSecure = $smtp_secure;
            $mail->Port       = $smtp_port;

            // Timeout
            $mail->Timeout = 30;

            // ====================================================================
            // REMETENTE E DESTINATÁRIO
            // ====================================================================

            $mail->setFrom($from_email, $from_name);
            $mail->addAddress($to_email, $to_name);

            // Reply-To (opcional)
            $mail->addReplyTo($from_email, $from_name);

            // ====================================================================
            // CONTEÚDO DO EMAIL
            // ====================================================================

            $mail->isHTML(true);
            $mail->CharSet = 'UTF-8';
            $mail->Subject = $subject;
            $mail->Body    = $html_body;

            // Versão texto puro (fallback)
            if (!empty($text_body)) {
                $mail->AltBody = $text_body;
            } else {
                $mail->AltBody = strip_tags($html_body);
            }

            // Anexos
            foreach ($attachments as $attachment) {
                // ✅ DECODIFICAR base64 antes de anexar (PHPMailer espera conteúdo binário)
                $conteudo_binario = base64_decode($attachment['content']);
                $mail->addStringAttachment($conteudo_binario, $attachment['filename'], 'base64', 'application/pdf');
            }

            // ====================================================================
            // ✅ CID EMBEDDED IMAGE - Incorporar logo diretamente no email
            // ====================================================================
            if ($logo_url) {
                error_log("🔄 EmailService CID: Iniciando download da logo: {$logo_url}");
                try {
                    // Baixar a imagem da URL
                    $ch = curl_init($logo_url);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
                    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                    $image_data = curl_exec($ch);
                    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    $curl_error = curl_error($ch);
                    curl_close($ch);
                    
                    error_log("📥 EmailService CID: HTTP {$http_code} | Tamanho: " . strlen($image_data) . " bytes");
                    
                    if ($curl_error) {
                        error_log("❌ EmailService CID: CURL Error: {$curl_error}");
                    }
                    
                    if ($http_code === 200 && $image_data) {
                        // Salvar temporariamente
                        $temp_file = tempnam(sys_get_temp_dir(), 'logo_');
                        file_put_contents($temp_file, $image_data);
                        
                        error_log("💾 EmailService CID: Arquivo temporário salvo: {$temp_file}");
                        
                        // Adicionar como imagem embedded
                        $mail->addEmbeddedImage($temp_file, 'company_logo', 'logo.png');
                        
                        // Substituir a URL da logo no HTML pelo CID
                        $original_body_length = strlen($mail->Body);
                        $mail->Body = str_replace($logo_url, 'cid:company_logo', $mail->Body);
                        $new_body_length = strlen($mail->Body);
                        
                        error_log("✅ EmailService CID: Logo incorporada! Substituições: " . ($original_body_length !== $new_body_length ? 'SIM' : 'NÃO'));
                        error_log("📝 EmailService CID: HTML modificado de {$original_body_length} para {$new_body_length} bytes");
                    } else {
                        error_log("⚠️ EmailService CID: Não foi possível baixar a logo (HTTP {$http_code}), usando URL externa");
                    }
                } catch (Exception $e) {
                    error_log("⚠️ EmailService CID: Erro ao incorporar logo: " . $e->getMessage());
                    // Continua com a URL externa se falhar
                }
            } else {
                error_log("⚠️ EmailService CID: Logo URL não fornecida");
            }

            // ====================================================================
            // ENVIAR EMAIL
            // ====================================================================
            error_log("[EmailService] Tentando enviar email via PHPMailer...");
            $result = $mail->send();
            error_log("[EmailService] EMAIL ENVIADO COM SUCESSO!");

            return [
                'success' => true,
                'message' => 'Email enviado com sucesso'
            ];

        } catch (Exception $e) {
            $erro = "ERRO PHPMailer: " . $mail->ErrorInfo . " | Exception: " . $e->getMessage();
            error_log("[EmailService] ERRO: {$erro}");
            return [
                'success' => false,
                'message' => 'Erro ao enviar email: ' . $mail->ErrorInfo
            ];
        } catch (\Exception $e) {
            $erro = "ERRO Generic: " . $e->getMessage();
            error_log("[EmailService] {$erro}");
            return [
                'success' => false,
                'message' => 'Erro ao enviar email: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Envia email de recuperação de senha
     *
     * @param string $to_email Email do destinatário
     * @param string $to_name Nome do destinatário
     * @param string $reset_token Token de recuperação
     * @param string $domain Domínio do usuário
     * @return array ['success' => bool, 'message' => string]
     */
    public function sendPasswordResetEmail($to_email, $to_name, $reset_token, $domain) {
        error_log("[EmailService] sendPasswordResetEmail CHAMADO - Email: {$to_email}, Domínio: {$domain}, Token: {$reset_token}");
        
        // ✅ URL DO SISTEMA (DINÂMICA BASEADA NO DOMÍNIO)
        $base_url = $this->getSystemUrl($domain, '/sistema');
        
        // URL de reset
        $reset_url = "{$base_url}/reset-password?token={$reset_token}";

        // ✅ Buscar informações da empresa e usuário
        $empresa = $this->getEmpresaInfo($domain);
        $sistema_nome = $this->getSystemName($domain);
        $usuario = ['nome' => "Equipe {$sistema_nome}", 'email' => 'contato@webpresto.com.br'];

        // ✅ Assunto com nome da empresa
        $subject = $this->formatarAssunto("Recuperação de Senha", $empresa['name']);

        // Corpo do email em HTML
        $html_body = $this->getPasswordResetTemplate($to_name, $reset_url, $domain, $empresa, $usuario);

        // Corpo do email em texto puro
        $text_body = "
Olá {$to_name},

Recebemos uma solicitação para redefinir a senha da sua conta.

Para criar uma nova senha, clique no link abaixo (válido por 1 hora):
{$reset_url}

Se você não solicitou esta alteração, ignore este email.

Atenciosamente,
{$usuario['nome']}
{$usuario['email']}
";

        // ✅ PASSAR A LOGO URL PARA O sendEmail() INCORPORAR COMO CID
        error_log("[EmailService] Chamando sendEmail()");
        $result = $this->sendEmail($to_email, $to_name, $subject, $html_body, $text_body, [], $domain, $empresa['logo_url']);
        error_log("[EmailService] sendEmail() retornou: " . json_encode($result));
        return $result;
    }

    /**
     * Template HTML para email de recuperação de senha
     */
    private function getPasswordResetTemplate($to_name, $reset_url, $domain, $empresa, $usuario) {
        $empresa_nome = htmlspecialchars($empresa['name']);
        
        $inner_content = <<<HTML
            <h1 style="margin: 0 0 20px; font-size: 22px; font-weight: bold; color: #1a202c; text-align: center;">
                Recuperação de Senha
            </h1>

            <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a5568;">
                Olá <strong>{$to_name}</strong>,
            </p>

            <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a5568;">
                Recebemos uma solicitação para redefinir a senha da sua conta no sistema <strong>{$empresa_nome}</strong>.
            </p>

            <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #4a5568;">
                Para criar uma nova senha, clique no botão abaixo:
            </p>

            <!-- BOTÃO -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="padding: 10px 0 30px 0;">
                        <a href="{$reset_url}" style="display: inline-block; padding: 16px 36px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 6px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">
                            Redefinir Senha
                        </a>
                    </td>
                </tr>
            </table>

            <div style="background-color: #fffaf0; border-left: 4px solid #ed8936; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #9c4221;">
                    <strong>⚠️ Atenção:</strong> Este link é válido por <strong>1 hora</strong> e pode ser usado apenas uma vez.
                </p>
            </div>

            <p style="margin: 0 0 10px; font-size: 14px; color: #718096; text-align: center;">
                Se o botão não funcionar, copie o link abaixo:
            </p>
            <p style="margin: 0; font-size: 12px; color: #3182ce; word-break: break-all; text-align: center; background-color: #f7fafc; padding: 10px; border-radius: 4px; border: 1px solid #edf2f7;">
                {$reset_url}
            </p>
HTML;

        return $this->wrapInMainTemplate($inner_content, $domain, $empresa, $usuario, '#2563eb');
    }

    /**
     * Envia email de solicitação de cotação para fornecedor
     *
     * @param string $to_email Email do fornecedor
     * @param string $fornecedor_nome Nome do fornecedor
     * @param string $nro_orcamento Número do orçamento
     * @param string $codigo_acesso Código de acesso único
     * @param string $domain Domínio do cliente
     * @param string $username Login do usuário que está enviando
     * @return array ['success' => bool, 'message' => string]
     */
    public function sendCotacaoEmail($to_email, $fornecedor_nome, $nro_orcamento, $codigo_acesso, $domain, $username) {
        // ✅ URL DO SISTEMA (DINÂMICA BASEADA NO DOMÍNIO)
        $base_url = $this->getSystemUrl($domain, '/sistema');

        // URL de acesso para fornecedor
        $acesso_url = "{$base_url}/cotacao-fornecedor?codigo={$codigo_acesso}";

        // ✅ Buscar informações da empresa e usuário
        $empresa = $this->getEmpresaInfo($domain);
        $usuario = $this->getUserInfo($domain, $username);

        // ✅ Assunto com nome da empresa
        $subject = $this->formatarAssunto("Solicitação de Cotação - Orçamento {$nro_orcamento}", $empresa['name']);

        // Corpo do email em HTML
        $html_body = $this->getCotacaoTemplate($fornecedor_nome, $codigo_acesso, $nro_orcamento, $acesso_url, $empresa, $usuario, $domain);

        // Corpo do email em texto puro
        $text_body = "
Olá {$fornecedor_nome},

Você foi selecionado para participar do processo de cotação do Orçamento {$nro_orcamento}.

CÓDIGO DE ACESSO: {$codigo_acesso}

Para informar os preços dos itens solicitados, acesse o link abaixo:
{$acesso_url}

Este código é válido por 7 dias.

Atenciosamente,
{$usuario['nome']}
{$usuario['email']}
";

        // ✅ PASSAR A LOGO URL PARA O sendEmail() INCORPORAR COMO CID
        return $this->sendEmail($to_email, $fornecedor_nome, $subject, $html_body, $text_body, [], $domain, $empresa['logo_url']);
    }

    /**
     * Template HTML para email de solicitação de cotação
     */
    private function getCotacaoTemplate($fornecedor_nome, $codigo_acesso, $nro_orcamento, $acesso_url, $empresa, $usuario, $domain = 'XXX') {
        $inner_content = <<<HTML
            <h1 style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #111827; text-align: center;">
                Solicitação de Cotação
            </h1>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Olá <strong>{$fornecedor_nome}</strong>,
            </p>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Você foi selecionado para participar do processo de cotação do <strong>Orçamento {$nro_orcamento}</strong>.
            </p>

            <!-- CÓDIGO DE ACESSO -->
            <div style="background-color: #f0fdf4; border: 2px solid #10b981; padding: 20px; margin-bottom: 30px; border-radius: 8px; text-align: center;">
                <p style="margin: 0 0 10px; font-family: Arial, sans-serif; font-size: 14px; color: #047857; font-weight: bold; text-transform: uppercase;">
                    Seu Código de Acesso
                </p>
                <p style="margin: 0; font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: bold; color: #059669; letter-spacing: 4px;">
                    {$codigo_acesso}
                </p>
            </div>

            <p style="margin: 0 0 30px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Para informar os preços, clique no botão abaixo:
            </p>

            <!-- BOTÃO -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="padding: 0 0 30px;">
                        <a href="{$acesso_url}" style="display: inline-block; padding: 16px 32px; background-color: #059669; color: #ffffff; text-decoration: none; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; border-radius: 6px;">
                            Informar Preços
                        </a>
                    </td>
                </tr>
            </table>

            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
                <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #92400e;">
                    <strong>⏰ Prazo:</strong> Este código é válido por <strong>7 dias</strong>.
                </p>
            </div>

            <p style="margin: 0 0 10px; font-family: Arial, sans-serif; font-size: 14px; color: #718096; text-align: center;">
                Se o botão não funcionar, copie o link abaixo:
            </p>
            <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #059669; word-break: break-all; text-align: center; background-color: #f9fafb; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb;">
                {$acesso_url}
            </p>
HTML;

        return $this->wrapInMainTemplate($inner_content, $domain, $empresa, $usuario, '#059669');
    }

    /**
     * Envia email de notificação quando fornecedor finaliza cotação
     *
     * @param string $to_email Email do criador do orçamento
     * @param string $to_name Nome do criador
     * @param string $fornecedor_nome Nome do fornecedor
     * @param string $nro_orcamento Número do orçamento
     * @param string $domain Domínio do cliente
     * @param string $username Login do usuário que está enviando
     * @return array ['success' => bool, 'message' => string]
     */
    public function sendNotificacaoCotacaoFinalizada($to_email, $to_name, $fornecedor_nome, $nro_orcamento, $domain, $username) {
        // URL do sistema
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'webpresto.com.br';
        $base_url = "{$protocol}://{$host}/sistema";

        // URL do orçamento
        $orcamento_url = "{$base_url}/compras/orcamentos";

        // ✅ Buscar informações da empresa e usuário
        $empresa = $this->getEmpresaInfo($domain);
        $usuario = $this->getUserInfo($domain, $username);

        // ✅ Assunto com nome da empresa
        $subject = $this->formatarAssunto("Cotação Recebida - {$fornecedor_nome} - Orçamento {$nro_orcamento}", $empresa['name']);

        // Corpo do email em HTML
        $html_body = $this->getNotificacaoCotacaoTemplate($to_name, $fornecedor_nome, $nro_orcamento, $orcamento_url, $domain, $empresa, $usuario);

        // Corpo do email em texto puro
        $text_body = "
Olá {$to_name},

O fornecedor {$fornecedor_nome} finalizou o preenchimento da cotação para o Orçamento {$nro_orcamento}.

Acesse o sistema para visualizar os preços informados:
{$orcamento_url}

Atenciosamente,
{$usuario['nome']}
{$usuario['email']}
";

        // ✅ PASSAR A LOGO URL PARA O sendEmail() INCORPORAR COMO CID
        return $this->sendEmail($to_email, $to_name, $subject, $html_body, $text_body, [], $domain, $empresa['logo_url']);
    }

    /**
     * Envia email de solicitação de aprovação de orçamento
     *
     * @param string $to_email Email do aprovador
     * @param string $to_name Nome do aprovador
     * @param string $solicitante_nome Nome do solicitante
     * @param string $nro_orcamento Número do orçamento
     * @param string $unidade Unidade do orçamento
     * @param string $data_inclusao Data de inclusão do orçamento
     * @param string $token_acesso Token de acesso direto
     * @param int $seq_orcamento Sequencial do orçamento
     * @param string $domain Domínio do orçamento
     * @param string|null $pdf_content Conteúdo do PDF em base64 (opcional)
     * @param string|null $pdf_filename Nome do arquivo PDF (opcional)
     * @return array ['success' => bool, 'message' => string]
     */
    public function sendSolicitacaoAprovacaoOrcamento($to_email, $to_name, $solicitante_nome, $nro_orcamento, $unidade, $data_inclusao, $token_acesso, $seq_orcamento, $domain, $username, $pdf_content = null, $pdf_filename = null) {
        // URL do sistema
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'webpresto.com.br';
        $base_url = "{$protocol}://{$host}/sistema";

        // URL de acesso direto com token (incluir domain)
        $link_acesso = "{$base_url}/?token={$token_acesso}&orcamento={$seq_orcamento}&domain={$domain}";
        
        // ✅ Formatar número do orçamento ANTES de usar no template
        $nro_orcamento_formatado = str_pad($nro_orcamento, 7, '0', STR_PAD_LEFT);

        // ✅ Buscar informações da empresa e usuário
        $empresa = $this->getEmpresaInfo($domain);
        $usuario = $this->getUserInfo($domain, $username);

        // ✅ Assunto com nome da empresa
        $subject = $this->formatarAssunto("Solicitação de Aprovação - Orçamento {$unidade}{$nro_orcamento_formatado}", $empresa['name']);

        // Corpo do email em HTML
        $html_body = $this->getSolicitacaoAprovacaoTemplate($to_name, $solicitante_nome, $nro_orcamento_formatado, $unidade, $data_inclusao, $link_acesso, ($pdf_content !== null), $empresa, $usuario, $domain);

        // Corpo do email em texto puro
        $text_body = "
Olá {$to_name},

Você recebeu uma solicitação de aprovação de orçamento:

Orçamento: {$unidade}{$nro_orcamento_formatado}
Solicitante: {$solicitante_nome}
Data de Inclusão: {$data_inclusao}

Para visualizar e aprovar o orçamento, acesse o link abaixo:
{$link_acesso}

Este link é válido por 7 dias e expira em " . date('d/m/Y H:i', strtotime('+7 days')) . ".

Atenciosamente,
{$usuario['nome']}
{$usuario['email']}
";
        
        // ✅ Preparar anexos se houver PDF
        $attachments = [];
        if ($pdf_content && $pdf_filename) {
            $attachments[] = [
                'content' => $pdf_content,
                'filename' => $pdf_filename
            ];
        }
        
        // ✅ PASSAR A LOGO URL PARA O sendEmail() INCORPORAR COMO CID
        return $this->sendEmail($to_email, $to_name, $subject, $html_body, $text_body, $attachments, $domain, $empresa['logo_url']);
    }

    /**
     * Envia email de solicitação de aprovação de PEDIDO MANUAL
     *
     * @param string $to_email Email do aprovador
     * @param string $to_name Nome do aprovador
     * @param string $solicitante_nome Nome do solicitante
     * @param string $nro_pedido_formatado Número do pedido formatado (XXX0000000)
     * @param string $unidade Unidade do pedido
     * @param string $data_inclusao Data de inclusão do pedido
     * @param float $vlr_total Valor total do pedido
     * @param string $fornecedor_nome Nome do fornecedor
     * @param string $token_acesso Token de acesso direto
     * @param int $seq_pedido Sequencial do pedido
     * @param string $domain Domínio do pedido
     * @param string $username Login do usuário
     * @return array ['success' => bool, 'message' => string]
     */
    public function sendSolicitacaoAprovacaoPedido($to_email, $to_name, $solicitante_nome, $nro_pedido_formatado, $unidade, $data_inclusao, $vlr_total, $fornecedor_nome, $token_acesso, $seq_pedido, $domain, $username) {
        // URL do sistema
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'webpresto.com.br';
        $base_url = "{$protocol}://{$host}/sistema";

        // ✅ URL de acesso direto com query params ANTES do hash (formato correto para SPA)
        $link_acesso = "{$base_url}/?token={$token_acesso}&pedido={$seq_pedido}&domain={$domain}";

        // ✅ Buscar informações da empresa e usuário
        $empresa = $this->getEmpresaInfo($domain);
        $usuario = $this->getUserInfo($domain, $username);

        // ✅ Assunto com nome da empresa
        $subject = $this->formatarAssunto("Solicitação de Aprovação - Pedido {$nro_pedido_formatado}", $empresa['name']);

        // Corpo do email em HTML
        $html_body = $this->getSolicitacaoAprovacaoPedidoTemplate($to_name, $solicitante_nome, $nro_pedido_formatado, $data_inclusao, $vlr_total, $fornecedor_nome, $link_acesso, $empresa, $usuario, $domain);

        // Corpo do email em texto puro
        $text_body = "
Olá {$to_name},

Você recebeu uma solicitação de aprovação de pedido manual:

Pedido: {$nro_pedido_formatado}
Fornecedor: {$fornecedor_nome}
Valor Total: R$ " . number_format($vlr_total, 2, ',', '.') . "
Solicitante: {$solicitante_nome}
Data de Inclusão: {$data_inclusao}

Para visualizar e aprovar o pedido, acesse o link abaixo:
{$link_acesso}

Este link é válido por 7 dias e expira em " . date('d/m/Y H:i', strtotime('+7 days')) . ".

Atenciosamente,
{$usuario['nome']}
{$usuario['email']}
";
        
        // ✅ PASSAR A LOGO URL PARA O sendEmail() INCORPORAR COMO CID
        return $this->sendEmail($to_email, $to_name, $subject, $html_body, $text_body, [], $domain, $empresa['logo_url']);
    }

    /**
     * Envia email de envio de pedido para fornecedor
     *
     * @param string $to_email Email do fornecedor
     * @param string $fornecedor_nome Nome do fornecedor
     * @param string $nro_orcamento Número do orçamento
     * @param string $unidade Unidade do orçamento
     * @param string $pdf_content Conteúdo do PDF em base64
     * @param string $pdf_filename Nome do arquivo PDF
     * @return array ['success' => bool, 'message' => string]
     */
    public function sendPedidoFornecedor($to_email, $fornecedor_nome, $nro_pedido, $unidade, $pdf_content, $pdf_filename, $domain, $username) {
        // ✅ Formatar número do PEDIDO (6 dígitos)
        $nro_pedido_formatado = str_pad($nro_pedido, 6, '0', STR_PAD_LEFT);

        // ✅ Buscar informações da empresa e usuário
        $empresa = $this->getEmpresaInfo($domain);
        $usuario = $this->getUserInfo($domain, $username);

        // ✅ Assunto com nome da empresa: "PEDIDO DE COMPRA AAA000000 - [NOME DA EMPRESA]"
        $subject = $this->formatarAssunto("PEDIDO DE COMPRA {$unidade}{$nro_pedido_formatado}", $empresa['name']);

        // Corpo do email em HTML
        $html_body = $this->getPedidoFornecedorTemplate($fornecedor_nome, $nro_pedido_formatado, $unidade, $empresa, $usuario, $domain);

        // Corpo do email em texto puro
        $text_body = "
Olá {$fornecedor_nome},

Você recebeu um pedido de compra: {$unidade}{$nro_pedido_formatado}.

O pedido está anexado a este email em formato PDF.

Por favor, verifique os detalhes e confirme a recepção do pedido.

Atenciosamente,
{$usuario['nome']}
{$usuario['email']}
";
        
        // ✅ Preparar anexos
        $attachments = [];
        if ($pdf_content && $pdf_filename) {
            $attachments[] = [
                'content' => $pdf_content,
                'filename' => $pdf_filename
            ];
        }
        
        // ✅ PASSAR A LOGO URL PARA O sendEmail() INCORPORAR COMO CID
        return $this->sendEmail($to_email, $fornecedor_nome, $subject, $html_body, $text_body, $attachments, $domain, $empresa['logo_url']);
    }

    /**
     * Template HTML para email de notificação de cotação finalizada
     */
    private function getNotificacaoCotacaoTemplate($to_name, $fornecedor_nome, $nro_orcamento, $orcamento_url, $domain, $empresa, $usuario) {
        $inner_content = <<<HTML
            <h1 style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #111827; text-align: center;">
                Cotação Recebida!
            </h1>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Olá <strong>{$to_name}</strong>,
            </p>

            <p style="margin: 0 0 30px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                O fornecedor <strong>{$fornecedor_nome}</strong> finalizou o preenchimento da cotação para o <strong>Orçamento {$nro_orcamento}</strong>.
            </p>

            <!-- DESTAQUE -->
            <div style="background-color: #dbeafe; border: 2px solid #3b82f6; padding: 20px; margin-bottom: 30px; border-radius: 8px; text-align: center;">
                <p style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; color: #1e40af; font-weight: bold;">
                    Os preços estão disponíveis para análise no sistema!
                </p>
            </div>

            <p style="margin: 0 0 30px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Acesse o sistema para visualizar os valores informados:
            </p>

            <!-- BOTÃO -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="padding: 0 0 30px;">
                        <a href="{$orcamento_url}" style="display: inline-block; padding: 16px 32px; background-color: #1e40af; color: #ffffff; text-decoration: none; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; border-radius: 6px;">
                            Acessar Orçamentos
                        </a>
                    </td>
                </tr>
            </table>
HTML;

        return $this->wrapInMainTemplate($inner_content, $domain, $empresa, $usuario, '#1e40af');
    }

    /**
     * Template HTML para email de solicitação de aprovação de orçamento
     */
    private function getSolicitacaoAprovacaoTemplate($to_name, $solicitante_nome, $nro_orcamento_formatado, $unidade, $data_inclusao, $link_acesso, $tem_anexo, $empresa, $usuario, $domain = 'XXX') {
        // ✅ Mensagem sobre anexo
        $mensagem_anexo = $tem_anexo 
            ? '<div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
                <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #1e40af;">
                    <strong>📎 Anexo:</strong> Este email contém o Mapa de Cotação em PDF para sua análise.
                </p>
            </div>'
            : '';
            
        $inner_content = <<<HTML
            <h1 style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #111827; text-align: center;">
                Solicitação de Aprovação
            </h1>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Olá <strong>{$to_name}</strong>,
            </p>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Você recebeu uma solicitação de aprovação de orçamento:
            </p>

            <div style="background-color: #f9fafb; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 25px; border-radius: 4px;">
                <p style="margin: 0 0 10px; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563;">
                    <strong>Orçamento:</strong> {$unidade}{$nro_orcamento_formatado}
                </p>
                <p style="margin: 0 0 10px; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563;">
                    <strong>Solicitante:</strong> {$solicitante_nome}
                </p>
                <p style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563;">
                    <strong>Data de Inclusão:</strong> {$data_inclusao}
                </p>
            </div>

            {$mensagem_anexo}

            <p style="margin: 0 0 30px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Para visualizar e aprovar o orçamento, clique no botão abaixo:
            </p>

            <!-- BOTÃO -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="padding: 0 0 30px;">
                        <a href="{$link_acesso}" style="display: inline-block; padding: 16px 32px; background-color: #1e40af; color: #ffffff; text-decoration: none; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; border-radius: 6px;">
                            Acessar Orçamento
                        </a>
                    </td>
                </tr>
            </table>
HTML;

        return $this->wrapInMainTemplate($inner_content, $domain, $empresa, $usuario, '#1e40af');
    }

    /**
     * Template HTML para email de solicitação de aprovação de PEDIDO MANUAL
     */
    private function getSolicitacaoAprovacaoPedidoTemplate($to_name, $solicitante_nome, $nro_pedido_formatado, $data_inclusao, $vlr_total, $fornecedor_nome, $link_acesso, $empresa, $usuario, $domain = 'XXX') {
        // Formatar valor
        $vlr_total_formatado = 'R$ ' . number_format($vlr_total, 2, ',', '.');
            
        $inner_content = <<<HTML
            <h1 style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #111827; text-align: center;">
                Solicitação de Aprovação - Pedido
            </h1>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Olá <strong>{$to_name}</strong>,
            </p>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Você recebeu uma solicitação de aprovação de pedido manual:
            </p>

            <!-- INFORMAÇÕES DO PEDIDO -->
            <div style="background-color: #f9fafb; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 25px; border-radius: 4px;">
                <p style="margin: 0 0 10px; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563;">
                    <strong>Pedido:</strong> {$nro_pedido_formatado}
                </p>
                <p style="margin: 0 0 10px; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563;">
                    <strong>Fornecedor:</strong> {$fornecedor_nome}
                </p>
                <p style="margin: 0 0 10px; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563;">
                    <strong>Valor Total:</strong> {$vlr_total_formatado}
                </p>
                <p style="margin: 0 0 10px; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563;">
                    <strong>Solicitante:</strong> {$solicitante_nome}
                </p>
                <p style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563;">
                    <strong>Data de Inclusão:</strong> {$data_inclusao}
                </p>
            </div>

            <p style="margin: 0 0 30px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Para visualizar e aprovar o pedido, clique no botão abaixo:
            </p>

            <!-- BOTÃO -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="padding: 0 0 30px;">
                        <a href="{$link_acesso}" style="display: inline-block; padding: 16px 32px; background-color: #1e40af; color: #ffffff; text-decoration: none; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; border-radius: 6px;">
                            Ver Pedido
                        </a>
                    </td>
                </tr>
            </table>
HTML;

        return $this->wrapInMainTemplate($inner_content, $domain, $empresa, $usuario, '#1e40af');
    }

    /**
     * Template HTML para email de envio de pedido para fornecedor
     */
    private function getPedidoFornecedorTemplate($fornecedor_nome, $nro_pedido_formatado, $unidade, $empresa, $usuario, $domain = 'XXX') {
        $inner_content = <<<HTML
            <h1 style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #111827; text-align: center;">
                Pedido de Compra
            </h1>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Olá <strong>{$fornecedor_nome}</strong>,
            </p>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Você recebeu um pedido de compra: <strong>{$unidade}{$nro_pedido_formatado}</strong>.
            </p>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                O pedido está anexado a este email em formato PDF.
            </p>

            <p style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Por favor, verifique os detalhes e confirme a recepção do pedido.
            </p>
HTML;

        return $this->wrapInMainTemplate($inner_content, $domain, $empresa, $usuario, '#1e40af');
    }

    /**
     * Envia email de notificação de aprovação de orçamento
     *
     * @param string $to_email Email do criador do orçamento
     * @param string $to_name Nome do criador
     * @param string $nro_orcamento Número do orçamento (numérico)
     * @param string $unidade Unidade do orçamento
     * @param string $aprovador_nome Nome do aprovador
     * @param array $pedidos_gerados Lista de pedidos gerados
     * @return array ['success' => bool, 'message' => string]
     */
    public function sendOrcamentoAprovado($to_email, $to_name, $nro_orcamento, $unidade, $aprovador_nome, $pedidos_gerados, $domain, $username) {
        // Formatar número do orçamento (6 dígitos)
        $nro_orcamento_formatado = str_pad($nro_orcamento, 6, '0', STR_PAD_LEFT);
        
        // Data formatada
        $data_aprovacao = date('d/m/Y');
        
        // Contagem de pedidos
        $total_pedidos = count($pedidos_gerados);
        
        // ✅ Buscar informações da empresa e usuário
        $empresa = $this->getEmpresaInfo($domain);
        $usuario = $this->getUserInfo($domain, $username);
        
        // ✅ Assunto com nome da empresa
        $subject = $this->formatarAssunto("Orçamento Aprovado - {$unidade}{$nro_orcamento_formatado}", $empresa['name']);
        
        // Corpo do email em HTML
        $html_body = $this->getOrcamentoAprovadoTemplate($to_name, $nro_orcamento_formatado, $unidade, $aprovador_nome, $pedidos_gerados, $empresa, $usuario, $domain);
        
        // Corpo do email em texto puro
        $text_body = "
Olá {$to_name},

Informamos que o orçamento {$unidade}{$nro_orcamento_formatado} foi APROVADO com sucesso!

Aprovado por: {$aprovador_nome}
Data da aprovação: {$data_aprovacao}

Pedidos gerados: {$total_pedidos}

Acesse o Sistema Presto para mais detalhes.

Atenciosamente,
{$usuario['nome']}
{$usuario['email']}
";
        
        // ✅ USAR CID EMBEDDED IMAGE para garantir que a logo apareça em todos os clientes de email
        return $this->sendEmail($to_email, $to_name, $subject, $html_body, $text_body, [], $domain, $empresa['logo_url']);
    }

    /**
     * Template HTML para email de notificação de aprovação de orçamento
     */
    private function getOrcamentoAprovadoTemplate($to_name, $nro_orcamento_formatado, $unidade, $aprovador_nome, $pedidos_gerados, $empresa, $usuario, $domain = 'XXX') {
        // Data formatada
        $data_aprovacao = date('d/m/Y');
        
        // Contagem de pedidos
        $total_pedidos = count($pedidos_gerados);
        
        // Montar lista de pedidos
        $lista_pedidos = '';
        foreach ($pedidos_gerados as $pedido) {
            $vlr_formatado = 'R$ ' . number_format($pedido['vlr_total'], 2, ',', '.');
            
            // Limitar nome do fornecedor a 25 caracteres
            $fornecedor_nome = $pedido['fornecedor_nome'];
            if (strlen($fornecedor_nome) > 25) {
                $fornecedor_nome = substr($fornecedor_nome, 0, 22) . '...';
            }
            
            $lista_pedidos .= "
                            <tr>
                                <td style=\"padding: 12px; border-bottom: 1px solid #e5e7eb; font-family: Arial, sans-serif; font-size: 14px; color: #111827;\">
                                    <strong>{$pedido['nro_pedido_formatado']}</strong>
                                </td>
                                <td style=\"padding: 12px; border-bottom: 1px solid #e5e7eb; font-family: Arial, sans-serif; font-size: 14px; color: #4b5563;\">
                                    {$fornecedor_nome}
                                </td>
                                <td style=\"padding: 12px; border-bottom: 1px solid #e5e7eb; font-family: Arial, sans-serif; font-size: 14px; color: #059669; text-align: right;\">
                                    <strong>{$vlr_formatado}</strong>
                                </td>
                            </tr>";
        }
        
        $inner_content = <<<HTML
            <h1 style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #111827; text-align: center;">
                Orçamento Aprovado
            </h1>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Olá <strong>{$to_name}</strong>,
            </p>

            <p style="margin: 0 0 30px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Informamos que o orçamento <strong>{$unidade}{$nro_orcamento_formatado}</strong> foi <strong>APROVADO</strong> com sucesso!
            </p>

            <!-- INFORMAÇÕES DO ORÇAMENTO -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px; background-color: #f9fafb; border-radius: 6px; border-collapse: collapse;">
                <tr>
                    <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">Aprovado por</p>
                        <p style="margin: 4px 0 0; font-family: Arial, sans-serif; font-size: 16px; color: #111827; font-weight: bold;">{$aprovador_nome}</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 16px;">
                        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">Data da aprovação</p>
                        <p style="margin: 4px 0 0; font-family: Arial, sans-serif; font-size: 16px; color: #111827; font-weight: bold;">{$data_aprovacao}</p>
                    </td>
                </tr>
            </table>

            <!-- PEDIDOS GERADOS -->
            <div style="margin-bottom: 30px;">
                <h2 style="margin: 0 0 16px; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; color: #111827;">
                    Pedidos Gerados ({$total_pedidos})
                </h2>
                
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="padding: 12px; text-align: left; font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Número</th>
                            <th style="padding: 12px; text-align: left; font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Fornecedor</th>
                            <th style="padding: 12px; text-align: right; font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        {$lista_pedidos}
                    </tbody>
                </table>
            </div>

            <p style="margin: 0 0 30px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Os pedidos foram gerados automaticamente e estão disponíveis para acompanhamento no sistema.
            </p>

            <!-- BOTÃO -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="padding: 0;">
                        <a href="https://webpresto.com.br/sistema/" style="display: inline-block; padding: 16px 32px; background-color: #1e40af; color: #ffffff; text-decoration: none; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; border-radius: 6px;">
                            Acessar Sistema
                        </a>
                    </td>
                </tr>
            </table>
HTML;

        return $this->wrapInMainTemplate($inner_content, $domain, $empresa, $usuario, '#1e40af');
    }

    /**
     * Template HTML para email de notificação de solicitação de compra
     */
    private function getSolicitacaoCompraTemplate($destinatario_nome, $nro_solicitacao_formatado, $setor_descricao, $centro_custo_descricao, $itens_html, $sistema_url, $empresa, $usuario, $domain) {
        $usuario_nome = htmlspecialchars($usuario['nome']);
        
        $inner_content = <<<HTML
            <h1 style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #111827; text-align: center;">
                Nova Solicitação de Compra
            </h1>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Olá <strong>{$destinatario_nome}</strong>,
            </p>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Uma nova solicitação de compra foi criada para o setor <strong>{$setor_descricao}</strong>.
            </p>

            <div style="background-color: #f0f9ff; border: 2px solid #3b82f6; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #1e40af;"><strong>Solicitação:</strong></td>
                        <td align="right" style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #1e3a8a;">{$nro_solicitacao_formatado}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #1e40af;"><strong>Setor:</strong></td>
                        <td align="right" style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #1e3a8a;">{$setor_descricao}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #1e40af;"><strong>Centro de Custo:</strong></td>
                        <td align="right" style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #1e3a8a;">{$centro_custo_descricao}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #1e40af;"><strong>Solicitante:</strong></td>
                        <td align="right" style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #1e3a8a;">{$usuario_nome}</td>
                    </tr>
                </table>
            </div>

            <h3 style="margin: 20px 0 10px; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #111827;">Itens Solicitados:</h3>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px; border: 1px solid #e5e7eb; border-radius: 4px; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f9fafb;">
                        <th style="padding: 10px; text-align: left; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #374151; border-bottom: 2px solid #e5e7eb;">Item</th>
                        <th style="padding: 10px; text-align: center; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #374151; border-bottom: 2px solid #e5e7eb;">Quantidade</th>
                    </tr>
                </thead>
                <tbody>{$itens_html}</tbody>
            </table>

            <!-- BOTÃO -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="padding: 0 0 30px;">
                        <a href="{$sistema_url}" style="display: inline-block; padding: 16px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; border-radius: 6px;">
                            Acessar Sistema
                        </a>
                    </td>
                </tr>
            </table>

            <div style="background-color: #eff6ff; padding: 16px; margin-top: 20px; border-radius: 4px; border-left: 4px solid #3b82f6;">
                <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #1e40af;">
                    <strong>ℹ️ Próximos Passos:</strong> Acesse o sistema para converter esta solicitação em uma ordem de compra.
                </p>
            </div>
HTML;

        return $this->wrapInMainTemplate($inner_content, $domain, $empresa, $usuario, '#2563eb');
    }

    /**
     * Envia email de notificação de solicitação de compra para usuários do setor
     * 
     * @param string $to_email Email do destinatário
     * @param string $to_name Nome do destinatário
     * @param int $seq_solicitacao_compra Número da solicitação
     * @param string $unidade Unidade da solicitação
     * @param string $setor_descricao Descrição do setor
     * @param string $centro_custo_descricao Descrição do centro de custo
     * @param array $itens Lista de itens da solicitação
     * @param string $domain Domínio do cliente
     * @param string $username Login do usuário solicitante
     * @return array ['success' => bool, 'message' => string]
     */
    public function sendSolicitacaoCompra($to_email, $to_name, $seq_solicitacao_compra, $unidade, $setor_descricao, $centro_custo_descricao, $itens, $domain, $username) {
        // Buscar informações
        $empresa = $this->getEmpresaInfo($domain);
        $usuario = $this->getUserInfo($domain, $username);
        
        // Formatar assunto
        $subject = $this->formatarAssunto("Nova Solicitação de Compra - Setor {$setor_descricao}", $empresa['name']);
        
        // ✅ URL DO SISTEMA (DINÂMICA BASEADA NO DOMÍNIO)
        $sistema_url = $this->getSystemUrl($domain, '/sistema/');
        
        // Formatar número da solicitação (UNIDADE + SEQ com 6 dígitos)
        $nro_solicitacao_formatado = $unidade . str_pad($seq_solicitacao_compra, 6, '0', STR_PAD_LEFT);
        
        // Gerar lista de itens em HTML
        $itens_html = '';
        foreach ($itens as $item) {
            $itens_html .= '<tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-family: Arial, sans-serif; font-size: 14px;">' . htmlspecialchars($item['item']) . '</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: Arial, sans-serif; font-size: 14px;">' . htmlspecialchars($item['qtde_item']) . '</td>
            </tr>';
        }
        
        // Corpo do email em HTML
        $html_body = $this->getSolicitacaoCompraTemplate($to_name, $nro_solicitacao_formatado, $setor_descricao, $centro_custo_descricao, $itens_html, $sistema_url, $empresa, $usuario, $domain);

        // Enviar email
        return $this->sendEmail($to_email, $to_name, $subject, $html_body, '', [], $domain, $empresa['logo_url']);
    }

    /**
     * Template HTML para email de solicitação convertida em ordem de compra
     */
    private function getSolicitacaoConvertidaTemplate($destinatario_nome, $nro_solicitacao_formatado, $nro_ordem_compra, $sistema_url, $empresa, $usuario, $domain) {
        $usuario_nome = htmlspecialchars($usuario['nome']);
        
        $inner_content = <<<HTML
            <h1 style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #111827; text-align: center;">
                ✅ Solicitação Convertida!
            </h1>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Olá <strong>{$destinatario_nome}</strong>,
            </p>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Sua solicitação de compra foi convertida em uma ordem de compra.
            </p>

            <div style="background-color: #f0fdf4; border: 2px solid #10b981; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #047857;"><strong>Solicitação:</strong></td>
                        <td align="right" style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #065f46;">{$nro_solicitacao_formatado}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #047857;"><strong>Ordem de Compra:</strong></td>
                        <td align="right" style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #065f46;">{$nro_ordem_compra}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #047857;"><strong>Convertida por:</strong></td>
                        <td align="right" style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #065f46;">{$usuario_nome}</td>
                    </tr>
                </table>
            </div>

            <!-- BOTÃO -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="padding: 0 0 30px;">
                        <a href="{$sistema_url}" style="display: inline-block; padding: 16px 32px; background-color: #059669; color: #ffffff; text-decoration: none; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; border-radius: 6px;">
                            Acessar Sistema
                        </a>
                    </td>
                </tr>
            </table>
HTML;

        return $this->wrapInMainTemplate($inner_content, $domain, $empresa, $usuario, '#059669');
    }

    /**
     * Envia email de notificação quando solicitação é convertida em ordem de compra
     */
    public function sendSolicitacaoConvertida($to_email, $to_name, $seq_solicitacao_compra, $unidade, $nro_ordem_compra, $domain, $username) {
        $empresa = $this->getEmpresaInfo($domain);
        $usuario = $this->getUserInfo($domain, $username);
        $subject = $this->formatarAssunto("Solicitação de Compra Convertida em Ordem", $empresa['name']);
        
        // Definir URL baseado no domínio
        $sistema_url = $this->getSystemUrl($domain, '/sistema/');
        
        // Formatar número da solicitação (UNIDADE + SEQ com 6 dígitos)
        $nro_solicitacao_formatado = $unidade . str_pad($seq_solicitacao_compra, 6, '0', STR_PAD_LEFT);
        
        // Corpo do email em HTML
        $html_body = $this->getSolicitacaoConvertidaTemplate($to_name, $nro_solicitacao_formatado, $nro_ordem_compra, $sistema_url, $empresa, $usuario, $domain);

        return $this->sendEmail($to_email, $to_name, $subject, $html_body, '', [], $domain, $empresa['logo_url']);
    }
    
    /**
     * Template HTML para email de solicitação aprovada sem necessidade de compra
     */
    private function getSolicitacaoAprovadaSemItensTemplate($destinatario_nome, $nro_solicitacao_formatado, $sistema_url, $empresa, $usuario, $domain) {
        $usuario_nome = htmlspecialchars($usuario['nome']);
        
        $inner_content = <<<HTML
            <h1 style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #111827; text-align: center;">
                ✅ Solicitação Aprovada!
            </h1>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Olá <strong>{$destinatario_nome}</strong>,
            </p>

            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Sua solicitação de compra foi aprovada e marcada como atendida.
            </p>

            <div style="background-color: #ecfeff; border: 2px solid #06b6d4; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #0e7490;"><strong>Solicitação:</strong></td>
                        <td align="right" style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #164e63;">{$nro_solicitacao_formatado}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #0e7490;"><strong>Status:</strong></td>
                        <td align="right" style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #164e63;">Atendida (sem geração de OC)</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #0e7490;"><strong>Aprovada por:</strong></td>
                        <td align="right" style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #164e63;">{$usuario_nome}</td>
                    </tr>
                </table>
            </div>

            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 25px; border-radius: 4px;">
                <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #92400e;">
                    <strong>ℹ️ Observação:</strong> Nenhum item precisou ser comprado, por isso não foi gerada uma ordem de compra.
                </p>
            </div>

            <!-- BOTÃO -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="padding: 0 0 30px;">
                        <a href="{$sistema_url}" style="display: inline-block; padding: 16px 32px; background-color: #0891b2; color: #ffffff; text-decoration: none; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; border-radius: 6px;">
                            Acessar Sistema
                        </a>
                    </td>
                </tr>
            </table>
HTML;

        return $this->wrapInMainTemplate($inner_content, $domain, $empresa, $usuario, '#0891b2');
    }

    /**
     * Envia email quando solicitação é aprovada mas não gera ordem de compra
     */
    public function sendSolicitacaoAprovadaSemItens($to_email, $to_name, $seq_solicitacao_compra, $unidade, $domain, $username) {
        $empresa = $this->getEmpresaInfo($domain);
        $usuario = $this->getUserInfo($domain, $username);
        $subject = $this->formatarAssunto("Solicitação de Compra Aprovada", $empresa['name']);
        
        // Definir URL baseado no domínio
        $sistema_url = $this->getSystemUrl($domain, '/sistema/');
        
        // Formatar número da solicitação (UNIDADE + SEQ com 6 dígitos)
        $nro_solicitacao_formatado = $unidade . str_pad($seq_solicitacao_compra, 6, '0', STR_PAD_LEFT);
        
        // Corpo do email em HTML
        $html_body = $this->getSolicitacaoAprovadaSemItensTemplate($to_name, $nro_solicitacao_formatado, $sistema_url, $empresa, $usuario, $domain);

        return $this->sendEmail($to_email, $to_name, $subject, $html_body, '', [], $domain, $empresa['logo_url']);
    }
}