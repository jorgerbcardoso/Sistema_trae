<?php
/**
 * 📊 EXPORTAÇÃO EXCEL - SOLICITAÇÕES DE COMPRA
 */

// Limpar buffer de saída
while (ob_get_level()) {
    ob_end_clean();
}
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

// ✅ Carregar config.php
require_once __DIR__ . '/../config.php';

try {
    // ✅ Obter usuário autenticado
    $currentUser = getCurrentUser();
    
    if (!$currentUser) {
        throw new Exception('Não autenticado');
    }
    
    $dominio = $currentUser['domain'];
    
    // ✅ CRIAR CONEXÃO (PADRÃO OBRIGATÓRIO)
    $conn = connect();
    
    // 📥 Receber dados do frontend
    $input = json_decode(file_get_contents('php://input'), true);
    
    $solicitacoes = $input['solicitacoes'] ?? [];
    $filters = $input['filters'] ?? [];
    $usuarioFiltro = $input['usuario_logado'] ?? '';
    
    if (empty($solicitacoes)) {
        throw new Exception('Nenhuma solicitação para exportar');
    }
    
    // 🏢 BUSCAR LOGO DO CLIENTE
    $logoUrl = 'https://webpresto.com.br/images/logo_rel.png';
    $nomeCliente = '';
    
    try {
        $sqlLogo = "SELECT logo_light, name FROM domains WHERE domain = $1 LIMIT 1";
        $resultLogo = sql($conn, $sqlLogo, false, [$dominio]);
        
        if ($resultLogo && pg_num_rows($resultLogo) > 0) {
            $rowLogo = pg_fetch_assoc($resultLogo);
            if (!empty($rowLogo['logo_light'])) {
                $logoUrl = $rowLogo['logo_light'];
            }
            $nomeCliente = $rowLogo['name'] ?? '';
        }
    } catch (Exception $e) {
        // Ignorar erro de logo
    }
    
    // 📊 CRIAR PLANILHA EXCEL
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Solicitações de Compra');
    
    // 🖼️ INSERIR LOGO
    $logoAdicionada = false;
    
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
    
    // 📋 CABEÇALHO
    $linhaInicio = 1;
    
    if ($logoAdicionada) {
        $sheet->setCellValue('C1', 'RELATÓRIO DE SOLICITAÇÕES DE COMPRA');
        $sheet->mergeCells('C1:I1');
        $sheet->getStyle('C1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '1E3A8A']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER]
        ]);
        
        if ($nomeCliente) {
            $sheet->setCellValue('C2', strtoupper($nomeCliente));
            $sheet->mergeCells('C2:I2');
            $sheet->getStyle('C2')->applyFromArray([
                'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => '475569']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
            ]);
        }
        
        $dataInicio = isset($filters['data_inicio']) ? date('d/m/Y', strtotime($filters['data_inicio'])) : '-';
        $dataFim = isset($filters['data_fim']) ? date('d/m/Y', strtotime($filters['data_fim'])) : '-';
        
        // Texto do usuário (se for filtrado)
        $textoUsuario = $usuarioFiltro ? " | Solicitações do usuário: " . strtoupper($usuarioFiltro) : "";
        $periodoTexto = "Período: {$dataInicio} a {$dataFim} | Unidade: " . ($filters['unidade'] ?: 'TODAS') . " | Status: " . ($filters['status'] ?: 'TODAS') . $textoUsuario;
        
        $sheet->setCellValue('C3', $periodoTexto);
        $sheet->mergeCells('C3:I3');
        $sheet->getStyle('C3')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['rgb' => '64748B']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        
        $sheet->getRowDimension(1)->setRowHeight(50);
        $sheet->getRowDimension(2)->setRowHeight(20);
        $sheet->getRowDimension(3)->setRowHeight(20);
        
        $linhaInicio = 5;
    }
    
    // 📊 CABEÇALHO DA TABELA
    $colunasHeader = [
        'A' => 'Número',
        'B' => 'Data',
        'C' => 'Hora',
        'D' => 'Centro de Custo',
        'E' => 'Setor',
        'F' => 'Placa',
        'G' => 'Itens',
        'H' => 'O.C.',
        'I' => 'Status'
    ];
    
    foreach ($colunasHeader as $col => $titulo) {
        $sheet->setCellValue($col . $linhaInicio, $titulo);
    }
    
    $sheet->getStyle('A' . $linhaInicio . ':I' . $linhaInicio)->applyFromArray([
        'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF'], 'size' => 11],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => '1E3A8A']]]
    ]);
    
    // 📝 PREENCHER DADOS
    $linha = $linhaInicio + 1;
    
    foreach ($solicitacoes as $sol) {
        $numeroFormatado = trim($sol['unidade']) . str_pad($sol['seq_solicitacao_compra'], 6, '0', STR_PAD_LEFT);
        
        $statusRaw = trim($sol['status'] ?? 'P');
        $statusTexto = 'Pendente';
        $corFundo = 'FEFCE8'; // Amarelo (Pendente)
        
        if ($statusRaw === 'A') {
            $statusTexto = 'Atendida';
            $corFundo = 'F0FDF4'; // Verde (Atendida)
        } elseif ($statusRaw === 'R') {
            $statusTexto = 'Reprovada';
            $corFundo = 'FEF2F2'; // Vermelho (Reprovada)
        }
        
        $sheet->setCellValue('A' . $linha, $numeroFormatado);
        $sheet->setCellValue('B' . $linha, date('d/m/Y', strtotime($sol['data_inclusao'])));
        $sheet->setCellValue('C' . $linha, substr($sol['hora_inclusao'], 0, 5));
        
        $ccTexto = ($sol['centro_custo_unidade'] ?? '') . str_pad($sol['centro_custo_nro'] ?? '', 3, '0', STR_PAD_LEFT) . ' - ' . ($sol['centro_custo_descricao'] ?? '');
        $sheet->setCellValue('D' . $linha, $ccTexto);
        
        $sheet->setCellValue('E' . $linha, $sol['setor_descricao'] ?? '-');
        $sheet->setCellValue('F' . $linha, $sol['placa'] ?? '-');
        $sheet->setCellValue('G' . $linha, intval($sol['qtd_itens']));
        $sheet->setCellValue('H' . $linha, $sol['nro_ordem_compra'] ?? '-');
        $sheet->setCellValue('I' . $linha, $statusTexto);
        
        // Aplicar cores por status
        $sheet->getStyle('A' . $linha . ':I' . $linha)->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $corFundo]],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E5E7EB']]]
        ]);
        
        $linha++;
    }
    
    // 📊 LINHA DE RESUMO
    $sheet->setCellValue('A' . $linha, 'TOTAL DE REGISTROS: ' . count($solicitacoes));
    $sheet->mergeCells('A' . $linha . ':I' . $linha);
    
    $sheet->getStyle('A' . $linha . ':I' . $linha)->applyFromArray([
        'font' => ['bold' => true, 'size' => 11],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'EFF6FF']],
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => '3B82F6']]],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER]
    ]);
    
    // 📏 AJUSTAR LARGURA DAS COLUNAS
    $sheet->getColumnDimension('A')->setWidth(15);
    $sheet->getColumnDimension('B')->setWidth(12);
    $sheet->getColumnDimension('C')->setWidth(10);
    $sheet->getColumnDimension('D')->setWidth(40);
    $sheet->getColumnDimension('E')->setWidth(25);
    $sheet->getColumnDimension('F')->setWidth(15);
    $sheet->getColumnDimension('G')->setWidth(10);
    $sheet->getColumnDimension('H')->setWidth(15);
    $sheet->getColumnDimension('I')->setWidth(15);
    
    // 📤 ENVIAR ARQUIVO
    $filename = 'solicitacoes_compra_' . date('Y-m-d_His') . '.xlsx';
    
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment;filename="' . $filename . '"');
    header('Cache-Control: max-age=0');
    
    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');
    
    ob_end_flush();
    exit;
    
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao exportar: ' . $e->getMessage()
    ]);
    exit;
}
