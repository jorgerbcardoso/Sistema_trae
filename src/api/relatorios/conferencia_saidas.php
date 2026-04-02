<?php
/**
 * ========================================
 * CONFERÊNCIA DE SAÍDAS - RELATÓRIO DE MANIFESTOS
 * ========================================
 *
 * Endpoint para buscar manifestos com filtros avançados
 * Acesso: Somente usuário "presto"
 *
 * Filtros disponíveis:
 * - periodoEmissaoInicio/Fim
 * - placa
 * - unidadeOrigem
 * - unidadeDestino
 *
 * @return JSON com array de manifestos
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// ✅ SUPRIMIR EXIBIÇÃO DE ERROS (apenas logar, não exibir)
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// ✅ Capturar QUALQUER output indesejado
ob_start();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ✅ INCLUIR FUNÇÕES PRINCIPAIS (ajustar caminhos para /api/)
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once '/var/www/html/lib/ssw.php';

// ✅ VALIDAR AUTENTICAÇÃO
try {
  $userData = authenticate();
} catch (Exception $e) {
  msg ('Erro de autenticação: ' . $e->getMessage());
}

// ⚠️ PROTEÇÃO: Somente usuário "presto"
//if ($userData['username'] !== 'presto')
  //msg ('Funcionalidade em desenvolvimento.');

// ✅ RECEBER FILTROS
$input = json_decode(file_get_contents('php://input'), true);
$domain = strtoupper(trim($input['domain'] ?? ''));
$periodoEmissaoInicio = $input['periodoEmissaoInicio'] ?? '';
$periodoEmissaoFim = $input['periodoEmissaoFim'] ?? '';
$placa = $input['placa'] ?? '';
$unidadeOrigem = $input['unidadeOrigem'] ?? '';
$unidadeDestino = $input['unidadeDestino'] ?? '';

// ✅ VALIDAÇÃO: Pelo menos um filtro deve ser fornecido
if (empty($periodoEmissaoInicio) && empty($placa) && empty($unidadeOrigem) && empty($unidadeDestino))
  msg ('Informe pelo menos um filtro para realizar a pesquisa.');

try {
    $dominio = $domain;

    $g_sql = connect();

    if ($unidadeOrigem != '')
      if (pg_num_rows (sql ("SELECT * FROM $dominio" . "_unidade WHERE sigla = $1", [$unidadeOrigem], $g_sql)) == 0)
        msg ("Unidade Origem $unidadeOrigem inválida.");

    if ($unidadeDestino != '')
      if (pg_num_rows (sql ("SELECT * FROM $dominio" . "_unidade WHERE sigla = $1", [$unidadeDestino], $g_sql)) == 0)
        msg ("Unidade Destino $unidadeDestino inválida.");

    if ($placa != '')
      if (pg_num_rows (sql ("SELECT * FROM $dominio" . "_veiculo WHERE placa = $1", [$placa], $g_sql)) == 0)
        msg ("Placa $placa inválida.");

    // ✅ CONECTAR AO SSW
    ssw_login($dominio);

    // Le os manifestos no SSW
    $param = "?act=" . "ENV" .
              "&f1=" . date('dmy', strtotime($periodoEmissaoInicio)) .
              "&f2=" . date('dmy', strtotime($periodoEmissaoFim)) .
              "&f4=" . $unidadeOrigem .
              "&f6=" . $unidadeDestino .
              "&f8=" . $placa .
             "&f11=" . "E";

    // ✅ Chamar ssw_go com tratamento de erro
    $str = ssw_go("https://sistema.ssw.inf.br/bin/ssw0644$param");

    $str = urldecode($str);
    $act = ssw_get_act($str);
    $arq = ssw_get_arq($str);

    // Abre o arquivo do relatorio
    $file    = ssw_go('https://sistema.ssw.inf.br/bin/ssw0424?act=' . $act . '&filename=' . $arq . '&path=&down=1&nw=0');
    $fil_arr = explode("\r", $file);
    $count   = count($fil_arr);

    // ✅ ARRAY PARA ARMAZENAR OS MANIFESTOS
    $manifestos = [];

    // Lendo os manifestos
    for ($i = 0; $i < ($count - 1); $i++)
    {
      $line = $fil_arr[$i];

      $arr = explode(";", $line);

      if ($arr[0] != '2') continue;

      $manifesto               = $arr[1];
      $destino                 = $arr[2];
      $cidade_dest             = $arr[3];
      $data_inclusao           = $arr[4];
      $data_saida              = $arr[5];
      $hora_saida              = $arr[6];
      $data_chegada            = $arr[7];
      $hora_chegada            = $arr[8];
      $placa_veiculo           = $arr[9];
      $proprietario            = $arr[10];
      $carreta                 = $arr[11];
      $motorista               = $arr[12];
      $cubagem                 = $arr[13];
      $peso                    = $arr[15];
      $vlr_merc                = $arr[18];
      $ctrb                    = $arr[20];
      $vlr_ctrb                = $arr[22];
      $vlr_pedagio             = 0; // Será preenchido via SQL após o loop (otimização de performance)
      $vlr_frete               = $arr[30];
      $data_ini_descarga       = $arr[33];
      $hora_ini_descarga       = $arr[34];
      $data_fin_descarga       = $arr[35];
      $hora_fin_descarga       = $arr[36];

      $qtde_vol  = $arr[42];
      $peso_calc = $arr[43];
      $distancia = $arr[46];

      // ✅ NORMALIZAR CTRB (para busca posterior otimizada)
      $ctrbNormalizado = '';
      if (trim($ctrb) != '') {
        $ctrbNormalizado = substr(trim($ctrb), 0, 9);
      }

      // Trata as datas
      $data_inclusao_formatada = str_replace('/20', '/', $data_inclusao);
      $data_inclusao_formatada = date('Y-m-d', strtotime(str_replace("/", "", $data_inclusao_formatada)));

      $data_saida_formatada = null;
      $hora_saida_formatada = null;
      if (trim($data_saida) != '')
      {
        $data_saida_formatada = str_replace('/20', '/', $data_saida);
        $data_saida_formatada = date('Y-m-d', strtotime(str_replace("/", "", $data_saida_formatada)));
        $hora_saida_formatada = substr($hora_saida, 0, 5);
      }

      $data_chegada_formatada = null;
      if (trim($data_chegada) != '')
      {
        $data_chegada_formatada = str_replace('/20', '/', $data_chegada);
        $data_chegada_formatada = date('Y-m-d', strtotime(str_replace("/", "", $data_chegada_formatada)));
      }

      $data_ini_descarga_formatada = null;
      $hora_ini_descarga_formatada = null;
      if (trim($data_ini_descarga) != '')
      {
        $data_ini_descarga_formatada = str_replace('/20', '/', $data_ini_descarga);
        $data_ini_descarga_formatada = date('Y-m-d', strtotime(str_replace("/", "", $data_ini_descarga_formatada)));
        $hora_ini_descarga_formatada = substr($hora_ini_descarga, 0, 5);
      }

      $data_fin_descarga_formatada = null;
      $hora_fin_descarga_formatada = null;
      if (trim($data_fin_descarga) != '')
      {
        $data_fin_descarga_formatada = str_replace('/20', '/', $data_fin_descarga);
        $data_fin_descarga_formatada = date('Y-m-d', strtotime(str_replace("/", "", $data_fin_descarga_formatada)));
        $hora_fin_descarga_formatada = substr($hora_fin_descarga, 0, 5);
      }

      // ✅ ADICIONAR MANIFESTO AO ARRAY (mapeando para estrutura esperada pelo frontend)
      $manifestos[] = [
          'id' => count($manifestos) + 1, // ID sequencial
          'numero' => $manifesto,
          'siglaOrigem' => substr($manifesto, 0, 3), // Primeiras 3 letras = origem
          'siglaDestino' => $destino,
          'placa' => $placa_veiculo,
          'placaCarreta' => !empty($carreta) ? $carreta : null,
          'totalFrete' => strtofloat ($vlr_frete),
          'ctrb' => strtofloat ($vlr_ctrb),
          'pedagio' => $vlr_pedagio,
          'pesoTotal' => strtofloat ($peso),
          'dataEmissao' => date('d/m/y', strtotime($data_inclusao_formatada)),
          'dataSaida' => $data_saida_formatada,
          'dataPrevisaoChegada' => $data_chegada_formatada,
          'horarioTerminoCarga' => ($data_saida_formatada && $hora_saida_formatada)
              ? date('d/m/Y', strtotime($data_saida_formatada)) . ' ' . $hora_saida_formatada
              : null,
          'horarioExpedicao' => null, // ️ SSW não tem este campo separado
          'horarioSaida' => ($data_saida_formatada && $hora_saida_formatada)
              ? date('d/m/Y', strtotime($data_saida_formatada)) . ' ' . $hora_saida_formatada
              : null,
          'nomeDestino' => $cidade_dest,

          // ✅ CAMPOS EXTRAS para exportação CSV (não exibidos na tela)
          'proprietario' => $proprietario,
          'motorista' => $motorista,
          'cubagem' => strtofloat ($cubagem),
          'vlrMercadoria' => strtofloat ($vlr_merc),

          'qtdeVol' => (int) $qtde_vol,
          'pesoCalc' => strtofloat ($peso_calc),
          'distancia' => (int) $distancia,
          'telefone' => '', // ⚠️ Será preenchido via SQL logo abaixo (otimização de performance)

          'codigoCtrb' => $ctrbNormalizado, // Código da CTRB normalizado (9 caracteres)
          'dataInicioDescarga' => $data_ini_descarga_formatada,
          'horaInicioDescarga' => $hora_ini_descarga_formatada,
          'dataFimDescarga' => $data_fin_descarga_formatada,
          'horaFimDescarga' => $hora_fin_descarga_formatada,
          'tpPropriedade' => null, // ⚠️ Será preenchido via SQL logo abaixo
      ];
    }

    // ✅ BUSCAR tp_propriedade DE CADA VEÍCULO NO BANCO (LEFT JOIN)
    if (count($manifestos) > 0) {
        // Montar lista de placas únicas
        $placas = array_unique(array_column($manifestos, 'placa'));

        // ⚠️ IMPORTANTE: Só fazer query se houver placas válidas (não vazias)
        $placasValidas = array_filter($placas, function($placa) {
            return !empty(trim($placa));
        });

        if (count($placasValidas) > 0) {
            // ✅ Escapar placas e montar query inline (função sql() ignora $connection e cria novo)
            $placasEscaped = array_map(function($placa) {
                return "'" . pg_escape_string(trim($placa)) . "'";
            }, $placasValidas);

            $placasList = implode(',', $placasEscaped);
            $query = "SELECT placa, tp_propriedade FROM {$dominio}_veiculo WHERE placa IN ({$placasList})";

            // ✅ Chamar sql() com apenas 2 parâmetros (connection será ignorado e recriado internamente)
            global $g_sql;
            $veiculos = sql($g_sql, $query);

            // Criar mapa placa => tp_propriedade
            $veiculoMap = [];
            if ($veiculos) {
                while ($veiculo = pg_fetch_assoc($veiculos)) {
                    $veiculoMap[$veiculo['placa']] = $veiculo['tp_propriedade'];
                }
            }

            // Atualizar manifestos com tp_propriedade
            foreach ($manifestos as &$manifesto) {
                $manifesto['tpPropriedade'] = $veiculoMap[$manifesto['placa']] ?? null;
            }
            unset($manifesto); // Liberar referência
        } else {
            // Se não houver placas válidas, todos os manifestos ficam com tpPropriedade = null
            foreach ($manifestos as &$manifesto) {
                $manifesto['tpPropriedade'] = null;
            }
            unset($manifesto);
        }
    }

    // ✅ BUSCAR TELEFONES DE MOTORISTAS (OTIMIZAÇÃO: UMA ÚNICA QUERY)
    if (count($manifestos) > 0) {
        // Montar lista de nomes únicos de motoristas
        $motoristas = array_unique(array_column($manifestos, 'motorista'));
        
        // ⚠️ IMPORTANTE: Só fazer query se houver motoristas válidos (não vazios)
        $motoristasValidos = array_filter($motoristas, function($motorista) {
            return !empty(trim($motorista));
        });
        
        if (count($motoristasValidos) > 0) {
            // ✅ Escapar nomes e montar query (usando TRIM em ambos os lados da comparação)
            $motoristasEscaped = array_map(function($motorista) {
                return "'" . pg_escape_string(trim($motorista)) . "'";
            }, $motoristasValidos);
            
            $motoristasList = implode(',', $motoristasEscaped);
            $query = "SELECT TRIM(nome) as nome, ddd, fone FROM {$dominio}_motorista WHERE TRIM(nome) IN ({$motoristasList})";
            
            global $g_sql;
            $resultMotoristas = sql($g_sql, $query);
            
            // Criar mapa motorista => telefone
            $telefoneMap = [];
            if ($resultMotoristas) {
                while ($row = pg_fetch_assoc($resultMotoristas)) {
                    $nomeMotorista = trim($row['nome']);
                    $telefone = trim($row['ddd']) . ' ' . trim($row['fone']);
                    $telefoneMap[$nomeMotorista] = $telefone;
                }
            }
            
            // Atualizar manifestos com telefone
            foreach ($manifestos as &$manifesto) {
                $nomeMotorista = trim($manifesto['motorista']);
                $manifesto['telefone'] = $telefoneMap[$nomeMotorista] ?? '';
            }
            unset($manifesto); // Liberar referência
        }
    }

    // ✅ BUSCAR VALORES DE PEDÁGIOS VIA SQL (OTIMIZAÇÃO: UMA ÚNICA QUERY)
    if (count($manifestos) > 0) {
        // Montar lista de CTRBs únicos
        $ctrbs = array_unique(array_column($manifestos, 'codigoCtrb'));
        
        // ⚠️ IMPORTANTE: Só fazer query se houver CTRBs válidos (não vazios)
        $ctrbsValidos = array_filter($ctrbs, function($ctrb) {
            return !empty(trim($ctrb));
        });
        
        if (count($ctrbsValidos) > 0) {
            // ✅ Escapar CTRBs e montar query (usando TRIM em ambos os lados da comparação)
            $ctrbsEscaped = array_map(function($ctrb) {
                return "'" . pg_escape_string(trim($ctrb)) . "'";
            }, $ctrbsValidos);
            
            $ctrbsList = implode(',', $ctrbsEscaped);
            $query = "SELECT ctrb, vlr_pedagio FROM {$dominio}_ctrb WHERE ctrb IN ({$ctrbsList})";
            
            global $g_sql;
            $resultPedagios = sql($g_sql, $query);
            
            // Criar mapa CTRB => vlr_pedagio
            $pedagioMap = [];
            if ($resultPedagios) {
                while ($row = pg_fetch_assoc($resultPedagios)) {
                    $ctrb = trim($row['ctrb']);
                    $vlr_pedagio = (float) $row['vlr_pedagio'];
                    $pedagioMap[$ctrb] = $vlr_pedagio;
                }
            }
            
            // Atualizar manifestos com vlr_pedagio
            foreach ($manifestos as &$manifesto) {
                $ctrb = trim($manifesto['codigoCtrb']);
                $manifesto['pedagio'] = $pedagioMap[$ctrb] ?? 0;
            }
            unset($manifesto); // Liberar referência
        }
    }

    // ✅ Limpar buffer e retornar JSON limpo
    ob_end_clean();

    echo json_encode([
        'success' => true,
        'message' => 'Manifestos carregados com sucesso',
        'data' => [
            'manifestos' => $manifestos
        ]
    ]);

} catch (Exception $e) {
    error_log('❌ [conferencia_saidas.php] Erro: ' . $e->getMessage());

    // ✅ Limpar buffer antes de retornar erro
    ob_end_clean();

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao buscar manifestos: ' . $e->getMessage()
    ]);
}