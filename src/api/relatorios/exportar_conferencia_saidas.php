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
    
    // 🏢 LÓGICA DE LOGO PARA EXCEL (Simples e Direta)
    $dominioUpper = strtoupper($dominio);
    $logoUrl = '';
    $nomeCliente = '';
    
    // 1️⃣ Buscar no banco de dados (prioridade absoluta)
    try {
        $sqlLogo = "SELECT logo_light, name FROM domains WHERE domain = $1 LIMIT 1";
        $resultLogo = sql($g_sql, $sqlLogo, false, [$dominioUpper]);
        if ($resultLogo && pg_num_rows($resultLogo) > 0) {
            $rowLogo = pg_fetch_assoc($resultLogo);
            $logoUrl = trim($rowLogo['logo_light'] ?? '');
            $nomeCliente = $rowLogo['name'] ?? '';
        }
    } catch (Exception $e) {
        error_log("❌ [Excel] Erro SQL: " . $e->getMessage());
    }

    // 2️⃣ Fallbacks se o banco estiver vazio
    if (empty($logoUrl)) {
        if ($dominioUpper === 'ACV') {
            $logoUrl = 'https://sistema.webpresto.com.br/images/logos_clientes/aceville.png';
        } elseif ($dominioUpper === 'TOP') {
            $logoUrl = 'https://sistema.webpresto.com.br/images/logos_clientes/logo_top.png';
        }
    }

    // 3️⃣ Garantir URL absoluta para o Excel
    if (!empty($logoUrl) && strpos($logoUrl, 'http') === false) {
        $host = $_SERVER['HTTP_HOST'] ?? 'sistema.webpresto.com.br';
        $logoUrl = "https://{$host}/" . ltrim($logoUrl, '/');
    }

    error_log("📊 [Excel] Domínio: $dominioUpper | URL Logo: $logoUrl");

    // 📊 CRIAR PLANILHA EXCEL
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Conferência de Saídas');
    
    // 🖼️ INSERIR LOGO (Método Direto)
    $logoAdicionada = false;
    if (!empty($logoUrl)) {
        try {
            $drawing = new Drawing();
            $drawing->setName('Logo');
            $drawing->setPath($logoUrl); // PhpSpreadsheet aceita URLs se o allow_url_fopen estiver ON
            $drawing->setCoordinates('A1');
            $drawing->setHeight(60);
            $drawing->setOffsetX(10);
            $drawing->setOffsetY(10);
            $drawing->setWorksheet($sheet);
            $logoAdicionada = true;
            error_log("✅ [Excel] Logo inserida via URL direta");
        } catch (Exception $e) {
            error_log("⚠️ [Excel] Falha via URL direta, tentando Proxy local...");
            // Backup: Tentar via Proxy (se for imagem do próprio servidor)
            try {
                $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '/var/www/html';
                $urlPath = parse_url($logoUrl, PHP_URL_PATH);
                $localPath = rtrim($docRoot, '/') . $urlPath;
                if (!file_exists($localPath)) {
                    $localPath = rtrim($docRoot, '/') . str_replace('/sistema/', '/', $urlPath);
                }
                
                if (file_exists($localPath)) {
                    $drawing = new Drawing();
                    $drawing->setPath($localPath);
                    $drawing->setCoordinates('A1');
                    $drawing->setHeight(60);
                    $drawing->setWorksheet($sheet);
                    $logoAdicionada = true;
                    error_log("✅ [Excel] Logo inserida via caminho local: $localPath");
                }
            } catch (Exception $e2) {
                error_log("💀 [Excel] Falha total na logo: " . $e2->getMessage());
            }
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
    
    $ultimaColuna = 'T';
    $headers = [
        'A' => 'Manifesto',
        'B' => 'Origem',
        'C' => 'Destino',
        'D' => 'Placa',
        'E' => 'Placa Carreta',
        'F' => 'Total Frete',
        'G' => 'Peso (Kg)',
        'H' => 'Peso Calc. (Kg)',
        'I' => 'Cubagem (m³)',
        'J' => 'Data Emissão',
        'K' => 'Data Prev. Chegada',
        'L' => 'Horário Fim Carga',
        'M' => 'Saída Efetiva',
        'N' => 'Cidade Destino',
        'O' => 'Proprietário',
        'P' => 'Motorista',
        'Q' => 'Telefone',
        'R' => 'Tipo Propriedade',
        'S' => 'Distância',
        'T' => 'Frete / Km'
    ];

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

    $sectionStyle = [
        'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => '1E3A8A']],
        'fill' => [
            'fillType' => Fill::FILL_SOLID,
            'startColor' => ['rgb' => 'DBEAFE']
        ],
        'alignment' => [
            'horizontal' => Alignment::HORIZONTAL_LEFT,
            'vertical' => Alignment::VERTICAL_CENTER
        ],
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_MEDIUM,
                'color' => ['rgb' => '93C5FD']
            ]
        ]
    ];

    $sectionSummaryStyle = [
        'font' => ['bold' => true, 'size' => 10],
        'alignment' => [
            'horizontal' => Alignment::HORIZONTAL_CENTER,
            'vertical' => Alignment::VERTICAL_CENTER,
            'wrapText' => true
        ],
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_THIN,
                'color' => ['rgb' => 'BFDBFE']
            ]
        ]
    ];

    $groupStyle = [
        'font' => ['bold' => true, 'size' => 11, 'color' => ['rgb' => '0F172A']],
        'fill' => [
            'fillType' => Fill::FILL_SOLID,
            'startColor' => ['rgb' => 'EFF6FF']
        ],
        'alignment' => [
            'horizontal' => Alignment::HORIZONTAL_LEFT,
            'vertical' => Alignment::VERTICAL_CENTER
        ],
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_THIN,
                'color' => ['rgb' => 'BFDBFE']
            ]
        ]
    ];

    $groupMetaStyle = [
        'font' => ['size' => 10, 'color' => ['rgb' => '334155']],
        'fill' => [
            'fillType' => Fill::FILL_SOLID,
            'startColor' => ['rgb' => 'FFFFFF']
        ],
        'alignment' => [
            'horizontal' => Alignment::HORIZONTAL_LEFT,
            'vertical' => Alignment::VERTICAL_CENTER
        ],
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_THIN,
                'color' => ['rgb' => 'DBEAFE']
            ]
        ]
    ];

    $subtotalStyle = [
        'font' => ['bold' => true, 'size' => 10, 'color' => ['rgb' => '334155']],
        'fill' => [
            'fillType' => Fill::FILL_SOLID,
            'startColor' => ['rgb' => 'F8FAFC']
        ],
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_THIN,
                'color' => ['rgb' => 'CBD5E1']
            ]
        ]
    ];

    $agruparPorCtrb = function(array $listaManifestos): array {
        $grupos = [];

        foreach ($listaManifestos as $manifesto) {
            $ctrbKey = trim($manifesto['codigoCtrb'] ?? '');
            if ($ctrbKey === '') {
                $ctrbKey = '__SEM_CTRB__';
            }

            if (!isset($grupos[$ctrbKey])) {
                $grupos[$ctrbKey] = [];
            }

            $grupos[$ctrbKey][] = $manifesto;
        }

        $resultado = [];

        foreach ($grupos as $ctrbKey => $itens) {
            $valorCtrb = 0;
            $valorPedagio = 0;
            $totalFrete = 0;
            $totalPeso = 0;

            foreach ($itens as $item) {
                $valorCtrb = max($valorCtrb, floatval($item['ctrb'] ?? 0));
                $valorPedagio = max($valorPedagio, floatval($item['pedagio'] ?? 0));
                $totalFrete += floatval($item['totalFrete'] ?? 0);
                $totalPeso += floatval($item['pesoTotal'] ?? 0);
            }

            $resultado[] = [
                'codigoCtrb' => $ctrbKey === '__SEM_CTRB__' ? '' : $ctrbKey,
                'displayCtrb' => $ctrbKey === '__SEM_CTRB__' ? 'SEM CTRB' : $ctrbKey,
                'valorCtrb' => $valorCtrb,
                'valorPedagio' => $valorPedagio,
                'totalFrete' => $totalFrete,
                'totalPeso' => $totalPeso,
                'percentualCtrb' => $totalFrete > 0 ? ($valorCtrb / $totalFrete) * 100 : 0,
                'qtdManifestos' => count($itens),
                'manifestos' => $itens
            ];
        }

        return $resultado;
    };

    $calcularTotaisSecao = function(array $grupos): array {
        $totalFrete = 0;
        $totalPeso = 0;
        $qtdManifestos = 0;

        foreach ($grupos as $grupo) {
            $totalFrete += $grupo['totalFrete'];
            $totalPeso += $grupo['totalPeso'];
            $qtdManifestos += $grupo['qtdManifestos'];
        }

        return [
            'totalFrete' => $totalFrete,
            'totalPeso' => $totalPeso,
            'qtdManifestos' => $qtdManifestos,
            'qtdGrupos' => count($grupos)
        ];
    };

    $manifestosFrota = array_values(array_filter($manifestos, function($manifesto) {
        return ($manifesto['tpPropriedade'] ?? null) === 'F';
    }));

    $manifestosTerceiros = array_values(array_filter($manifestos, function($manifesto) {
        return ($manifesto['tpPropriedade'] ?? null) !== 'F';
    }));

    $secoes = [
        [
            'titulo' => 'VEÍCULOS FROTA',
            'grupos' => $agruparPorCtrb($manifestosFrota)
        ],
        [
            'titulo' => 'VEÍCULOS TERCEIROS',
            'grupos' => $agruparPorCtrb($manifestosTerceiros)
        ]
    ];

    $linhaAtual = $linhaInicio;
    $primeiraLinhaDados = null;

    foreach ($secoes as $secao) {
        if (count($secao['grupos']) === 0) {
            continue;
        }

        $totaisSecao = $calcularTotaisSecao($secao['grupos']);

        $sheet->setCellValue('A' . $linhaAtual, $secao['titulo']);
        $sheet->mergeCells('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual);
        $sheet->getStyle('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual)->applyFromArray($sectionStyle);
        $sheet->getRowDimension($linhaAtual)->setRowHeight(22);
        $linhaAtual++;

        $sheet->setCellValue('A' . $linhaAtual, "Grupos CTRB\n" . $totaisSecao['qtdGrupos']);
        $sheet->mergeCells('A' . $linhaAtual . ':D' . $linhaAtual);
        $sheet->setCellValue('E' . $linhaAtual, "Manifestos\n" . $totaisSecao['qtdManifestos']);
        $sheet->mergeCells('E' . $linhaAtual . ':H' . $linhaAtual);
        $sheet->setCellValue('I' . $linhaAtual, "Total Frete\nR$ " . number_format($totaisSecao['totalFrete'], 2, ',', '.'));
        $sheet->mergeCells('I' . $linhaAtual . ':L' . $linhaAtual);
        $sheet->setCellValue('M' . $linhaAtual, "Peso Total\n" . number_format($totaisSecao['totalPeso'], 2, ',', '.'));
        $sheet->mergeCells('M' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual);

        $sheet->getStyle('A' . $linhaAtual . ':D' . $linhaAtual)->applyFromArray(array_merge($sectionSummaryStyle, [
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'F8FAFC']
            ]
        ]));
        $sheet->getStyle('E' . $linhaAtual . ':H' . $linhaAtual)->applyFromArray(array_merge($sectionSummaryStyle, [
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'F8FAFC']
            ]
        ]));
        $sheet->getStyle('I' . $linhaAtual . ':L' . $linhaAtual)->applyFromArray(array_merge($sectionSummaryStyle, [
            'font' => ['bold' => true, 'size' => 10, 'color' => ['rgb' => '047857']],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'ECFDF5']
            ]
        ]));
        $sheet->getStyle('M' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual)->applyFromArray(array_merge($sectionSummaryStyle, [
            'font' => ['bold' => true, 'size' => 10, 'color' => ['rgb' => '0369A1']],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'F0F9FF']
            ]
        ]));
        $sheet->getRowDimension($linhaAtual)->setRowHeight(34);
        $linhaAtual++;

        foreach ($secao['grupos'] as $grupo) {
            $sheet->setCellValue('A' . $linhaAtual, 'CTRB: ' . $grupo['displayCtrb']);
            $sheet->mergeCells('A' . $linhaAtual . ':J' . $linhaAtual);
            $sheet->setCellValue('K' . $linhaAtual, 'Manifestos: ' . $grupo['qtdManifestos']);
            $sheet->mergeCells('K' . $linhaAtual . ':N' . $linhaAtual);
            $sheet->setCellValue('O' . $linhaAtual, 'Vlr. CTRB: R$ ' . number_format($grupo['valorCtrb'], 2, ',', '.'));
            $sheet->mergeCells('O' . $linhaAtual . ':Q' . $linhaAtual);
            $sheet->setCellValue('R' . $linhaAtual, 'Pedágio: R$ ' . number_format($grupo['valorPedagio'], 2, ',', '.'));
            $sheet->mergeCells('R' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual);
            $sheet->getStyle('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual)->applyFromArray($groupStyle);
            $sheet->getRowDimension($linhaAtual)->setRowHeight(20);
            $linhaAtual++;

            $sheet->setCellValue(
                'A' . $linhaAtual,
                sprintf(
                    'Participação CTRB/Frete: %.1f%% | Peso do grupo: %s',
                    $grupo['percentualCtrb'],
                    number_format($grupo['totalPeso'], 2, ',', '.')
                )
            );
            $sheet->mergeCells('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual);
            $sheet->getStyle('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual)->applyFromArray($groupMetaStyle);
            $sheet->getRowDimension($linhaAtual)->setRowHeight(18);
            $linhaAtual++;

            foreach ($headers as $col => $value) {
                $sheet->setCellValue($col . $linhaAtual, $value);
            }
            $sheet->getStyle('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual)->applyFromArray($headerStyle);
            $sheet->getRowDimension($linhaAtual)->setRowHeight(22);
            $linhaAtual++;

            if ($primeiraLinhaDados === null) {
                $primeiraLinhaDados = $linhaAtual;
            }

            foreach ($grupo['manifestos'] as $manifesto) {
                $sheet->setCellValue('A' . $linhaAtual, $manifesto['numero']);
                $sheet->setCellValue('B' . $linhaAtual, $manifesto['siglaOrigem']);
                $sheet->setCellValue('C' . $linhaAtual, $manifesto['siglaDestino']);
                $sheet->setCellValue('D' . $linhaAtual, $manifesto['placa']);
                $sheet->setCellValue('E' . $linhaAtual, $manifesto['placaCarreta'] ?: '-');
                $sheet->setCellValue('F' . $linhaAtual, floatval($manifesto['totalFrete']));
                $sheet->setCellValue('G' . $linhaAtual, floatval($manifesto['pesoTotal']));
                $sheet->setCellValue('H' . $linhaAtual, $manifesto['pesoCalc'] ? floatval($manifesto['pesoCalc']) : 0);
                $sheet->setCellValue('I' . $linhaAtual, $manifesto['cubagem'] ? floatval($manifesto['cubagem']) : 0);

                if (!empty($manifesto['dataEmissao']) && $manifesto['dataEmissao'] !== '-') {
                    $sheet->setCellValue('J' . $linhaAtual, date('d/m/Y', strtotime($manifesto['dataEmissao'])));
                } else {
                    $sheet->setCellValue('J' . $linhaAtual, '-');
                }

                if (!empty($manifesto['dataPrevisaoChegada']) && $manifesto['dataPrevisaoChegada'] !== '-') {
                    $sheet->setCellValue('K' . $linhaAtual, date('d/m/Y', strtotime($manifesto['dataPrevisaoChegada'])));
                } else {
                    $sheet->setCellValue('K' . $linhaAtual, '-');
                }

                $sheet->setCellValue('L' . $linhaAtual, $manifesto['horarioTerminoCarga'] ?: '-');
                $sheet->setCellValue('M' . $linhaAtual, '');
                $sheet->setCellValue('N' . $linhaAtual, $manifesto['nomeDestino'] ?: '-');
                $sheet->setCellValue('O' . $linhaAtual, $manifesto['proprietario'] ?: '-');
                $sheet->setCellValue('P' . $linhaAtual, $manifesto['motorista'] ?: '-');
                $sheet->setCellValue('Q' . $linhaAtual, $manifesto['telefone'] ?: '-');
                $sheet->setCellValue('R' . $linhaAtual, $manifesto['tpPropriedade'] === 'F' ? 'FROTA' : 'TERCEIRO');
                $sheet->setCellValue('S' . $linhaAtual, $manifesto['distancia'] ? intval($manifesto['distancia']) : 0);

                $distancia = $manifesto['distancia'] ? intval($manifesto['distancia']) : 0;
                if ($distancia > 0) {
                    $sheet->setCellValue('T' . $linhaAtual, '=F' . $linhaAtual . '/S' . $linhaAtual);
                } else {
                    $sheet->setCellValue('T' . $linhaAtual, '-');
                }

                $sheet->getStyle('F' . $linhaAtual . ':F' . $linhaAtual)->getNumberFormat()->setFormatCode('R$ #,##0.00');
                $sheet->getStyle('G' . $linhaAtual . ':I' . $linhaAtual)->getNumberFormat()->setFormatCode('#,##0.00');
                $sheet->getStyle('S' . $linhaAtual . ':S' . $linhaAtual)->getNumberFormat()->setFormatCode('#,##0');
                $sheet->getStyle('T' . $linhaAtual . ':T' . $linhaAtual)->getNumberFormat()->setFormatCode('R$ #,##0.00');

                $sheet->getStyle('A' . $linhaAtual . ':E' . $linhaAtual)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('F' . $linhaAtual . ':I' . $linhaAtual)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                $sheet->getStyle('J' . $linhaAtual . ':T' . $linhaAtual)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual)->applyFromArray([
                    'borders' => [
                        'allBorders' => [
                            'borderStyle' => Border::BORDER_THIN,
                            'color' => ['rgb' => 'CBD5E1']
                        ]
                    ]
                ]);

                if ($linhaAtual % 2 === 0) {
                    $sheet->getStyle('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual)->applyFromArray([
                        'fill' => [
                            'fillType' => Fill::FILL_SOLID,
                            'startColor' => ['rgb' => 'F8FAFC']
                        ]
                    ]);
                }

                $linhaAtual++;
            }

            $textoSubtotal = sprintf(
                'SUBTOTAL (%d manifestos)',
                $grupo['qtdManifestos']
            );
            $textoIndicador = sprintf(
                'CTRB representa %.1f%% do frete',
                $grupo['percentualCtrb']
            );

            $sheet->setCellValue('A' . $linhaAtual, $textoSubtotal);
            $sheet->mergeCells('A' . $linhaAtual . ':E' . $linhaAtual);
            $sheet->setCellValue('F' . $linhaAtual, $grupo['totalFrete']);
            $sheet->setCellValue('G' . $linhaAtual, $grupo['totalPeso']);
            $sheet->setCellValue('H' . $linhaAtual, $textoIndicador);
            $sheet->mergeCells('H' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual);
            $sheet->getStyle('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual)->applyFromArray($subtotalStyle);
            $sheet->getStyle('F' . $linhaAtual . ':F' . $linhaAtual)->getNumberFormat()->setFormatCode('R$ #,##0.00');
            $sheet->getStyle('G' . $linhaAtual . ':G' . $linhaAtual)->getNumberFormat()->setFormatCode('#,##0.00');
            $sheet->getStyle('F' . $linhaAtual . ':G' . $linhaAtual)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
            $sheet->getRowDimension($linhaAtual)->setRowHeight(20);
            $linhaAtual += 2;
        }

        $sheet->setCellValue('A' . $linhaAtual, 'TOTAL DA SEÇÃO');
        $sheet->mergeCells('A' . $linhaAtual . ':E' . $linhaAtual);
        $sheet->setCellValue('F' . $linhaAtual, $totaisSecao['totalFrete']);
        $sheet->setCellValue('G' . $linhaAtual, $totaisSecao['totalPeso']);
        $sheet->setCellValue('H' . $linhaAtual, sprintf(
            '%d grupos CTRB | %d manifestos',
            $totaisSecao['qtdGrupos'],
            $totaisSecao['qtdManifestos']
        ));
        $sheet->mergeCells('H' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual);
        $sheet->getStyle('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual)->applyFromArray($sectionStyle);
        $sheet->getStyle('F' . $linhaAtual . ':F' . $linhaAtual)->getNumberFormat()->setFormatCode('R$ #,##0.00');
        $sheet->getStyle('G' . $linhaAtual . ':G' . $linhaAtual)->getNumberFormat()->setFormatCode('#,##0.00');
        $sheet->getStyle('F' . $linhaAtual . ':G' . $linhaAtual)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        $linhaAtual += 2;
    }

    $ultimaLinhaDados = $linhaAtual - 1;

    foreach (range('A', $ultimaColuna) as $col) {
        $sheet->getColumnDimension($col)->setAutoSize(true);
    }

    if ($primeiraLinhaDados !== null) {
        $sheet->freezePane('A' . $primeiraLinhaDados);
    }
    
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
