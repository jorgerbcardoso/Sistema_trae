<?php
/**
 * 📊 EXPORTAÇÃO EXCEL - CONFERÊNCIA DE SAÍDAS
 * 
 * ⚠️ VERSÃO DEBUG - MOSTRA ERROS TEMPORARIAMENTE
 */

// ⚠️ TEMPORÁRIO: Habilitar erros para debug
ini_set('display_errors', '1');
error_reporting(E_ALL);

// Limpar TODO buffer de saída
while (ob_get_level()) {
    ob_end_clean();
}

// Iniciar novo buffer limpo
ob_start();

// 📚 Carregar PhpSpreadsheet
require_once __DIR__ . '/../config/phpspreadsheet_loader.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

// ✅ Carregar APENAS config.php (tem tudo que precisa)
require_once __DIR__ . '/../config.php';

// 🌍 Usar conexão global
global $g_sql;
global $dominio;

try {
    // ✅ Obter usuário autenticado e domínio
    $currentUser = getCurrentUser();
    $dominioHeader = $_SERVER['HTTP_X_DOMAIN'] ?? null;
    $dominio = $currentUser['domain'] ?? $dominioHeader;
    
    if (!$dominio) {
        throw new Exception('Domínio não identificado');
    }
    
    // 📥 Receber dados do frontend
    $input = json_decode(file_get_contents('php://input'), true);
    
    // ✅ RECEBER MANIFESTOS (que já vêm processados do frontend)
    $manifestos = $input['manifestos'] ?? [];
    $filters = $input['filters'] ?? [];
    
    $periodoEmissaoInicio = $filters['periodoEmissaoInicio'] ?? null;
    $periodoEmissaoFim = $filters['periodoEmissaoFim'] ?? null;
    
    if (empty($manifestos)) {
        throw new Exception('Nenhum manifesto para exportar');
    }
    
    if (!$periodoEmissaoInicio || !$periodoEmissaoFim) {
        throw new Exception('Período obrigatório');
    }
    
    // 🏢 LÓGICA DE LOGO PARA EXCEL (Logo da Empresa apenas)
    $dominioUpper = strtoupper($dominio);
    $isACV = ($dominioUpper === 'ACV');
    
    // Logo padrão da empresa (SÓ usar se não tiver nada no banco)
    $logoUrl = '';
    if ($isACV) {
        $logoUrl = 'https://www.webpresto.com.br/images/logos_clientes/aceville.png';
    }
    
    $nomeCliente = '';
    
    try {
        $sqlLogo = "SELECT logo_light, name FROM domains WHERE domain = $1 LIMIT 1";
        $resultLogo = sql($g_sql, $sqlLogo, false, [$dominioUpper]);
        
        if ($resultLogo && pg_num_rows($resultLogo) > 0) {
            $rowLogo = pg_fetch_assoc($resultLogo);
            // 1. PRIORIDADE: Logo do banco de dados
            if (!empty($rowLogo['logo_light'])) {
                $logo_light = $rowLogo['logo_light'];
                
                // Se for a logo padrão da Presto e NÃO formos o domínio XXX, NÃO EXIBIR na esquerda
                // O usuário quer a logo da EMPRESA. Se for igual a da Presto, ele vê duas logos iguais.
                if (strpos($logo_light, 'logo-verde-simples.png') !== false || 
                    strpos($logo_light, 'logo_rel.png') !== false) {
                    if ($dominioUpper !== 'XXX') {
                        $logoUrl = ''; // Não exibir se for apenas a logo do sistema
                    } else {
                        // Domínio XXX (Presto) pode exibir a logo no Excel
                        $logoUrl = 'https://webpresto.com.br/images/logo_rel.png';
                    }
                } else {
                    // Garantir URL absoluta (seguindo padrão do EmailService.php)
                    if (strpos($logo_light, 'http://') === 0 || strpos($logo_light, 'https://') === 0) {
                        $logoUrl = $logo_light;
                    } else {
                        $protocol = 'https';
                        $host = $_SERVER['HTTP_HOST'] ?? 'sistema.webpresto.com.br';
                        $logo_path = ltrim($logo_light, '/');
                        $logoUrl = "{$protocol}://{$host}/{$logo_path}";
                    }
                }
            }
            $nomeCliente = $rowLogo['name'] ?? '';
        }
    } catch (Exception $e) {
        // Ignorar erro de busca no banco
    }
    
    // 📊 CRIAR PLANILHA EXCEL
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Conferência de Saídas');
    
    // 🖼️ INSERIR LOGO
    $logoAdicionada = false;
    
    if (!empty($logoUrl)) {
        try {
            $logoContent = @file_get_contents($logoUrl);
            
            if ($logoContent !== false) {
                $tempLogoPath = sys_get_temp_dir() . '/logo_' . uniqid() . '.png';
                file_put_contents($tempLogoPath, $logoContent);
                
                $drawing = new Drawing();
                $drawing->setName('Logo');
                $drawing->setDescription('Logo do Cliente');
                $drawing->setPath($tempLogoPath);
                $drawing->setCoordinates('A1');
                $drawing->setHeight(60);
                $drawing->setOffsetX(10);
                $drawing->setOffsetY(10);
                $drawing->setWorksheet($sheet);
                
                $logoAdicionada = true;
                
                register_shutdown_function(function() use ($tempLogoPath) {
                    if (file_exists($tempLogoPath)) {
                        @unlink($tempLogoPath);
                    }
                });
            }
        } catch (Exception $e) {
            // Ignorar erros de logo
        }
    }
    
    // 📋 CABEÇALHO
    $linhaInicio = 1;
    
    if ($logoAdicionada) {
        $sheet->setCellValue('C1', 'CONFERÊNCIA DE SAÍDAS');
        $sheet->mergeCells('C1:H1');
        $sheet->getStyle('C1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '1E3A8A']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER]
        ]);
        
        if ($nomeCliente) {
            $sheet->setCellValue('C2', strtoupper($nomeCliente));
            $sheet->mergeCells('C2:H2');
            $sheet->getStyle('C2')->applyFromArray([
                'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => '475569']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
            ]);
        }
        
        $periodoTexto = 'Período: ' . date('d/m/Y', strtotime($periodoEmissaoInicio)) . ' a ' . date('d/m/Y', strtotime($periodoEmissaoFim));
        $sheet->setCellValue('C3', $periodoTexto);
        $sheet->mergeCells('C3:H3');
        $sheet->getStyle('C3')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['rgb' => '64748B']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        
        $sheet->getRowDimension(1)->setRowHeight(50);
        $sheet->getRowDimension(2)->setRowHeight(20);
        $sheet->getRowDimension(3)->setRowHeight(20);
        
        // ⏰ DATA E HORA DE GERAÇÃO
        $dataHoraGeracao = date('d/m/Y \\à\\s H:i:s');
        $sheet->setCellValue('C4', 'Gerado em: ' . $dataHoraGeracao);
        $sheet->mergeCells('C4:H4');
        $sheet->getStyle('C4')->applyFromArray([
            'font' => ['size' => 9, 'italic' => true, 'color' => ['rgb' => '94A3B8']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        $sheet->getRowDimension(4)->setRowHeight(18);
        
        $linhaInicio = 6;
    } else {
        $sheet->setCellValue('A1', 'CONFERÊNCIA DE SAÍDAS');
        $sheet->mergeCells('A1:T1');
        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '1E3A8A']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER]
        ]);
        
        if ($nomeCliente) {
            $sheet->setCellValue('A2', strtoupper($nomeCliente));
            $sheet->mergeCells('A2:T2');
            $sheet->getStyle('A2')->applyFromArray([
                'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => '475569']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
            ]);
        }
        
        $periodoTexto = 'Período: ' . date('d/m/Y', strtotime($periodoEmissaoInicio)) . ' a ' . date('d/m/Y', strtotime($periodoEmissaoFim));
        $sheet->setCellValue('A3', $periodoTexto);
        $sheet->mergeCells('A3:T3');
        $sheet->getStyle('A3')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['rgb' => '64748B']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        
        $sheet->getRowDimension(1)->setRowHeight(25);
        $sheet->getRowDimension(2)->setRowHeight(20);
        $sheet->getRowDimension(3)->setRowHeight(20);
        
        // ⏰ DATA E HORA DE GERAÇÃO
        $dataHoraGeracao = date('d/m/Y \\à\\s H:i:s');
        $sheet->setCellValue('A4', 'Gerado em: ' . $dataHoraGeracao);
        $sheet->mergeCells('A4:T4');
        $sheet->getStyle('A4')->applyFromArray([
            'font' => ['size' => 9, 'italic' => true, 'color' => ['rgb' => '94A3B8']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        $sheet->getRowDimension(4)->setRowHeight(18);
        
        $linhaInicio = 6;
    }
    
    // 📋 CABEÇALHOS DAS COLUNAS
    $linhaCabecalho = $linhaInicio;
    
    $headers = [
        'A' => 'Manifesto',
        'B' => 'Origem',
        'C' => 'Destino',
        'D' => 'Placa',
        'E' => 'Placa Carreta',
        'F' => 'Total Frete',
        'G' => 'CTRB',
        'H' => 'Código CTRB (SSW)',
        'I' => 'Pedágio',
        'J' => 'Peso (Kg)',
        'K' => 'Peso Calc. (Kg)',
        'L' => 'Cubagem (m³)',
        'M' => 'Data Emissão',
        'N' => 'Data Prev. Chegada',
        'O' => 'Horário Fim Carga',
        'P' => 'Saída Efetiva',
        'Q' => 'Cidade Destino',
        'R' => 'Proprietário',
        'S' => 'Motorista',
        'T' => 'Telefone',
        'U' => 'Tipo Propriedade',
        'V' => 'Distância',
        'W' => 'Frete / Km'
    ];
    
    foreach ($headers as $col => $value) {
        $sheet->setCellValue($col . $linhaCabecalho, $value);
    }
    
    // 🎨 Estilizar cabeçalho
    $headerStyle = [
        'font' => [
            'bold' => true,
            'color' => ['rgb' => 'FFFFFF'],
            'size' => 11
        ],
        'fill' => [
            'fillType' => Fill::FILL_SOLID,
            'startColor' => ['rgb' => '2563EB']
        ],
        'alignment' => [
            'horizontal' => Alignment::HORIZONTAL_CENTER,
            'vertical' => Alignment::VERTICAL_CENTER
        ],
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_THIN,
                'color' => ['rgb' => 'FFFFFF']
            ]
        ]
    ];
    
    $sheet->getStyle('A' . $linhaCabecalho . ':W' . $linhaCabecalho)->applyFromArray($headerStyle);
    $sheet->getRowDimension($linhaCabecalho)->setRowHeight(25);
    
    // 📝 PREENCHER DADOS
    $linhaAtual = $linhaCabecalho + 1;
    
    foreach ($manifestos as $manifesto) {
        $sheet->setCellValue('A' . $linhaAtual, $manifesto['numero']);
        $sheet->setCellValue('B' . $linhaAtual, $manifesto['siglaOrigem']);
        $sheet->setCellValue('C' . $linhaAtual, $manifesto['siglaDestino']);
        $sheet->setCellValue('D' . $linhaAtual, $manifesto['placa']);
        $sheet->setCellValue('E' . $linhaAtual, $manifesto['placaCarreta'] ?: '-');
        $sheet->setCellValue('F' . $linhaAtual, floatval($manifesto['totalFrete']));
        $sheet->setCellValue('G' . $linhaAtual, floatval($manifesto['ctrb']));
        $sheet->setCellValue('H' . $linhaAtual, $manifesto['codigoCtrb'] ?: '-');
        $sheet->setCellValue('I' . $linhaAtual, floatval($manifesto['pedagio']));
        $sheet->setCellValue('J' . $linhaAtual, floatval($manifesto['pesoTotal']));
        $sheet->setCellValue('K' . $linhaAtual, $manifesto['pesoCalc'] ? floatval($manifesto['pesoCalc']) : 0);
        $sheet->setCellValue('L' . $linhaAtual, $manifesto['cubagem'] ? floatval($manifesto['cubagem']) : 0);
        
        // ✅ FORMATAR DATAS COMO DD/MM/YYYY
        if (!empty($manifesto['dataEmissao']) && $manifesto['dataEmissao'] !== '-') {
            $dataEmissao = date('d/m/Y', strtotime($manifesto['dataEmissao']));
            $sheet->setCellValue('M' . $linhaAtual, $dataEmissao);
        } else {
            $sheet->setCellValue('M' . $linhaAtual, '-');
        }
        
        if (!empty($manifesto['dataPrevisaoChegada']) && $manifesto['dataPrevisaoChegada'] !== '-') {
            $dataPrevChegada = date('d/m/Y', strtotime($manifesto['dataPrevisaoChegada']));
            $sheet->setCellValue('N' . $linhaAtual, $dataPrevChegada);
        } else {
            $sheet->setCellValue('N' . $linhaAtual, '-');
        }
        
        $sheet->setCellValue('O' . $linhaAtual, $manifesto['horarioTerminoCarga'] ?: '-');
        
        // ✅ COLUNAS P (Saída Efetiva) - DEIXAR EM BRANCO (usuário preenche)
        $sheet->setCellValue('P' . $linhaAtual, '');
        
        $sheet->setCellValue('Q' . $linhaAtual, $manifesto['nomeDestino'] ?: '-');
        $sheet->setCellValue('R' . $linhaAtual, $manifesto['proprietario'] ?: '-');
        $sheet->setCellValue('S' . $linhaAtual, $manifesto['motorista'] ?: '-');
        $sheet->setCellValue('T' . $linhaAtual, $manifesto['telefone'] ?: '-');
        $sheet->setCellValue('U' . $linhaAtual, $manifesto['tpPropriedade'] === 'F' ? 'FROTA' : 'TERCEIRO');
        $sheet->setCellValue('V' . $linhaAtual, $manifesto['distancia'] ? intval($manifesto['distancia']) : 0);
        
        // ✅ FRETE / KM: Fórmula = Total Frete (F) / Distância (V)
        // Se distância for 0 ou vazia, deixar em branco para evitar divisão por zero
        $distancia = $manifesto['distancia'] ? intval($manifesto['distancia']) : 0;
        if ($distancia > 0) {
            $sheet->setCellValue('W' . $linhaAtual, '=F' . $linhaAtual . '/V' . $linhaAtual);
        } else {
            $sheet->setCellValue('W' . $linhaAtual, '-');
        }
        
        if ($linhaAtual % 2 === 0) {
            $sheet->getStyle('A' . $linhaAtual . ':W' . $linhaAtual)->applyFromArray([
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => 'F8FAFC']
                ]
            ]);
        }
        
        $linhaAtual++;
    }
    
    $ultimaLinhaDados = $linhaAtual - 1;
    
    // 🎨 Formatar valores monetários
    $sheet->getStyle('F' . ($linhaCabecalho + 1) . ':F' . $ultimaLinhaDados)->getNumberFormat()->setFormatCode('R$ #,##0.00');
    $sheet->getStyle('G' . ($linhaCabecalho + 1) . ':G' . $ultimaLinhaDados)->getNumberFormat()->setFormatCode('R$ #,##0.00');
    $sheet->getStyle('I' . ($linhaCabecalho + 1) . ':I' . $ultimaLinhaDados)->getNumberFormat()->setFormatCode('R$ #,##0.00');
    $sheet->getStyle('W' . ($linhaCabecalho + 1) . ':W' . $ultimaLinhaDados)->getNumberFormat()->setFormatCode('R$ #,##0.00');
    
    // 🎨 Formatar peso e cubagem
    $sheet->getStyle('J' . ($linhaCabecalho + 1) . ':J' . $ultimaLinhaDados)->getNumberFormat()->setFormatCode('#,##0.00');
    $sheet->getStyle('K' . ($linhaCabecalho + 1) . ':K' . $ultimaLinhaDados)->getNumberFormat()->setFormatCode('#,##0.00');
    $sheet->getStyle('L' . ($linhaCabecalho + 1) . ':L' . $ultimaLinhaDados)->getNumberFormat()->setFormatCode('#,##0.00');
    
    // 🎨 Formatar distância (número inteiro)
    $sheet->getStyle('V' . ($linhaCabecalho + 1) . ':V' . $ultimaLinhaDados)->getNumberFormat()->setFormatCode('#,##0');
    
    // 🎨 Centralizar
    $sheet->getStyle('A' . ($linhaCabecalho + 1) . ':E' . $ultimaLinhaDados)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $sheet->getStyle('M' . ($linhaCabecalho + 1) . ':W' . $ultimaLinhaDados)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    
    // 🎨 Alinhar direita
    $sheet->getStyle('F' . ($linhaCabecalho + 1) . ':K' . $ultimaLinhaDados)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
    
    // 🎨 Bordas
    $sheet->getStyle('A' . $linhaCabecalho . ':W' . $ultimaLinhaDados)->applyFromArray([
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_THIN,
                'color' => ['rgb' => 'CBD5E1']
            ]
        ]
    ]);
    
    // 📏 Auto-ajustar colunas
    foreach (range('A', 'W') as $col) {
        $sheet->getColumnDimension($col)->setAutoSize(true);
    }
    
    // ❄️ Congelar cabeçalho
    $sheet->freezePane('A' . ($linhaCabecalho + 1));
    
    // 📊 Linha TOTAL
    $linhaTotais = $ultimaLinhaDados + 2;
    
    $sheet->setCellValue('A' . $linhaTotais, 'TOTAL');
    $sheet->mergeCells('A' . $linhaTotais . ':E' . $linhaTotais);
    $sheet->setCellValue('F' . $linhaTotais, '=SUM(F' . ($linhaCabecalho + 1) . ':F' . $ultimaLinhaDados . ')');
    $sheet->setCellValue('G' . $linhaTotais, '=SUM(G' . ($linhaCabecalho + 1) . ':G' . $ultimaLinhaDados . ')');
    $sheet->setCellValue('I' . $linhaTotais, '=SUM(I' . ($linhaCabecalho + 1) . ':I' . $ultimaLinhaDados . ')');
    $sheet->setCellValue('J' . $linhaTotais, '=SUM(J' . ($linhaCabecalho + 1) . ':J' . $ultimaLinhaDados . ')');
    
    // 🎨 Estilizar TOTAL
    $totalStyle = [
        'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => '1E3A8A']],
        'fill' => [
            'fillType' => Fill::FILL_SOLID,
            'startColor' => ['rgb' => 'DBEAFE']
        ],
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_MEDIUM,
                'color' => ['rgb' => '2563EB']
            ]
        ]
    ];
    
    $sheet->getStyle('A' . $linhaTotais . ':W' . $linhaTotais)->applyFromArray($totalStyle);
    $sheet->getStyle('A' . $linhaTotais)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $sheet->getStyle('F' . $linhaTotais . ':J' . $linhaTotais)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
    $sheet->getRowDimension($linhaTotais)->setRowHeight(25);
    
    // 🎨 Formatar TOTAL
    $sheet->getStyle('F' . $linhaTotais)->getNumberFormat()->setFormatCode('R$ #,##0.00');
    $sheet->getStyle('G' . $linhaTotais)->getNumberFormat()->setFormatCode('R$ #,##0.00');
    $sheet->getStyle('I' . $linhaTotais)->getNumberFormat()->setFormatCode('R$ #,##0.00');
    $sheet->getStyle('J' . $linhaTotais)->getNumberFormat()->setFormatCode('#,##0.00');
    
    // 💾 SALVAR EM ARQUIVO TEMPORÁRIO
    $filename = 'Conferencia_Saidas_' . date('Ymd_His') . '.xlsx';
    $tempFile = sys_get_temp_dir() . '/' . $filename;
    
    $writer = new Xlsx($spreadsheet);
    $writer->save($tempFile);
    
    // ✅ LIMPAR TODO O BUFFER
    ob_end_clean();
    
    // 📤 ENVIAR ARQUIVO
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . filesize($tempFile));
    header('Cache-Control: max-age=0');
    header('Pragma: public');
    
    readfile($tempFile);
    
    // Limpar temporário
    @unlink($tempFile);
    
} catch (Exception $e) {
    // Limpar buffer
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    // Enviar erro
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

exit;