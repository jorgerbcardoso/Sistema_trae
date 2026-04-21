import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { getLogoUrl, getCompanyLogoUrl } from '../../config/clientLogos';
import { useTheme } from '../ThemeProvider';
import { AdminLayout } from '../layouts/AdminLayout';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {
  FileSpreadsheet,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Printer,
} from 'lucide-react';
import { ENVIRONMENT } from '../../config/environment';
import { FilterSelectVeiculo } from '../dashboards/FilterSelectVeiculo';
import { FilterSelectUnidadeSingle } from '../cadastros/FilterSelectUnidadeSingle';
import { usePageTitle } from '../../hooks/usePageTitle';
import { toast } from 'sonner';
import { 
  getManifestos,
  exportarManifestosExcel,
  type Manifesto,
  type ManifestosFilters 
} from '../../services/conferenciaSaidasService';
import { ManifestosTable, type ManifestoGroup } from './ManifestosTable';

type SortField = keyof Manifesto;
type SortDirection = 'asc' | 'desc';

export function ConferenciaSaidas() {
  const { user, logout, clientConfig } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [manifestos, setManifestos] = useState<Manifesto[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  // ✅ ORDENAÇÃO INDEPENDENTE PARA CADA TABELA
  const [sortFieldFrota, setSortFieldFrota] = useState<SortField>('numero');
  const [sortDirectionFrota, setSortDirectionFrota] = useState<SortDirection>('desc');
  const [sortFieldTerceiros, setSortFieldTerceiros] = useState<SortField>('numero');
  const [sortDirectionTerceiros, setSortDirectionTerceiros] = useState<SortDirection>('desc');
  
  // Helper: Obter data de hoje no formato YYYY-MM-DD
  const getToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const [filters, setFilters] = useState<ManifestosFilters>({
    periodoEmissaoInicio: getToday(), // ✅ Padrão: hoje
    periodoEmissaoFim: getToday(),     // ✅ Padrão: hoje
    placa: '',
    unidadeOrigem: '',
    unidadeDestino: ''
  });

  usePageTitle('Conferência de Saídas');

  const handleExportExcel = async () => {
    if (manifestos.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    try {
      setLoading(true);
      
      // ✅ Chamar função de exportação passando OS MANIFESTOS que já temos!
      await exportarManifestosExcel(filters, manifestos);
      
      toast.success(`Planilha Excel exportada com sucesso!`);
    } catch (error) {
      console.error('❌ Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar planilha Excel. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    
    try {
      const result = await getManifestos(filters);
      
      if (result.success) {
        setManifestos(result.manifestos);
        
        if (result.manifestos.length === 0) {
          toast.info('Nenhum manifesto encontrado com os filtros aplicados.');
        }
      }
      // ✅ Se result.success === false, o msg() do PHP já exibiu o toast de erro
    } catch (error) {
      console.error('❌ Erro ao buscar manifestos:', error);
      // ✅ Se houve exception, o msg() do PHP já exibiu o toast de erro
    } finally {
      setLoading(false);
    }
  };

  // Formatar valores monetários
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Formatar peso
  const formatPeso = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  // ✅ FUNÇÃO AUXILIAR: Converter data+hora "DD/MM/YYYY HH:MM" para timestamp
  const parseDateTime = (dateTimeStr: string | null): number => {
    if (!dateTimeStr || dateTimeStr === '-') return 0;
    
    // Formato: "31/12/2024 23:59"
    const parts = dateTimeStr.split(' ');
    if (parts.length !== 2) return 0;
    
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    
    if (dateParts.length !== 3 || timeParts.length !== 2) return 0;
    
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // JavaScript months are 0-indexed
    const year = parseInt(dateParts[2], 10);
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    
    const date = new Date(year, month, day, hour, minute);
    return date.getTime();
  };

  // ✅ FUNÇÃO GENÉRICA: Ordenar lista de manifestos
  const sortManifestos = (list: Manifesto[], field: SortField, direction: SortDirection): Manifesto[] => {
    return [...list].sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];

      // ✅ CAMPOS DE DATA+HORA: ordenar cronologicamente
      if (field === 'horarioTerminoCarga' || field === 'horarioExpedicao' || field === 'horarioSaida') {
        const aTime = parseDateTime(aValue as string | null);
        const bTime = parseDateTime(bValue as string | null);
        return direction === 'asc' ? aTime - bTime : bTime - aTime;
      }

      // ✅ CAMPOS DE STRING: ordenar alfabeticamente
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } 
      // ✅ CAMPOS NUMÉRICOS: ordenar numericamente
      else if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      } 
      // ✅ VALORES NULOS: colocar no final
      else {
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        return 0;
      }
    });
  };

  // ✅ FUNÇÃO: Ordenação composta por Expedição + Saída
  const sortManifestosComposta = (list: Manifesto[]): Manifesto[] => {
    return [...list].sort((a, b) => {
      // 1º critério: Expedição (dataEmissao) - cronológica
      const aExpedicao = a.dataEmissao || '';
      const bExpedicao = b.dataEmissao || '';
      
      if (aExpedicao !== bExpedicao) {
        // Converter DD/MM/YYYY para timestamp para ordenação cronológica
        const parseDate = (dateStr: string): number => {
          if (!dateStr || dateStr === '-') return 0;
          const parts = dateStr.split('/');
          if (parts.length !== 3) return 0;
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          return new Date(year, month, day).getTime();
        };
        
        return parseDate(aExpedicao) - parseDate(bExpedicao);
      }
      
      // 2º critério: Saída (horarioSaida) - cronológica
      const aSaida = parseDateTime(a.horarioSaida);
      const bSaida = parseDateTime(b.horarioSaida);
      return aSaida - bSaida;
    });
  };

  const buildManifestoGroups = (manifestosList: Manifesto[]): ManifestoGroup[] => {
    const groupedManifestos = new Map<string, Manifesto[]>();

    manifestosList.forEach((manifesto) => {
      const ctrbKey = manifesto.codigoCtrb?.trim() || '__SEM_CTRB__';

      if (!groupedManifestos.has(ctrbKey)) {
        groupedManifestos.set(ctrbKey, []);
      }

      groupedManifestos.get(ctrbKey)?.push(manifesto);
    });

    return Array.from(groupedManifestos.entries()).map(([ctrbKey, groupManifestos]) => {
      const valorCtrb = groupManifestos.reduce((max, manifesto) => Math.max(max, manifesto.ctrb || 0), 0);
      const valorPedagio = groupManifestos.reduce((max, manifesto) => Math.max(max, manifesto.pedagio || 0), 0);
      const totalFrete = groupManifestos.reduce((sum, manifesto) => sum + manifesto.totalFrete, 0);
      const totalPeso = groupManifestos.reduce((sum, manifesto) => sum + manifesto.pesoTotal, 0);

      return {
        key: ctrbKey,
        codigoCtrb: ctrbKey === '__SEM_CTRB__' ? '' : ctrbKey,
        displayCtrb: ctrbKey === '__SEM_CTRB__' ? 'SEM CTRB' : ctrbKey,
        valorCtrb,
        valorPedagio,
        totalFrete,
        totalPeso,
        percentualCtrb: totalFrete > 0 ? (valorCtrb / totalFrete) * 100 : 0,
        qtdManifestos: groupManifestos.length,
        manifestos: groupManifestos,
      };
    });
  };

  const calculateSectionSummary = (groups: ManifestoGroup[]) => ({
    totalFrete: groups.reduce((sum, group) => sum + group.totalFrete, 0),
    totalPeso: groups.reduce((sum, group) => sum + group.totalPeso, 0),
    qtdRegistros: groups.reduce((sum, group) => sum + group.qtdManifestos, 0),
    qtdGrupos: groups.length,
  });

  // ✅ SEPARAR MANIFESTOS: FROTA vs TERCEIROS
  const rawManifestosFrota = manifestos.filter(m => m.tpPropriedade === 'F');
  const rawManifestosTerceiros = manifestos.filter(m => m.tpPropriedade !== 'F');

  // ✅ APLICAR ORDENAÇÃO COMPOSTA PADRÃO (Expedição + Saída)
  const manifestosFrotaSorted = sortManifestosComposta(rawManifestosFrota);
  const manifestosTerceirosSorted = sortManifestosComposta(rawManifestosTerceiros);

  // ✅ APLICAR ORDENAÇÃO CUSTOMIZADA (se o usuário clicar em alguma coluna)
  const manifestosFrota = sortFieldFrota !== 'numero' || sortDirectionFrota !== 'desc'
    ? sortManifestos(manifestosFrotaSorted, sortFieldFrota, sortDirectionFrota)
    : manifestosFrotaSorted;
    
  const manifestosTerceiros = sortFieldTerceiros !== 'numero' || sortDirectionTerceiros !== 'desc'
    ? sortManifestos(manifestosTerceirosSorted, sortFieldTerceiros, sortDirectionTerceiros)
    : manifestosTerceirosSorted;

  const gruposFrota = buildManifestoGroups(manifestosFrota);
  const gruposTerceiros = buildManifestoGroups(manifestosTerceiros);

  const totalsFrota = gruposFrota.length > 0 ? calculateSectionSummary(gruposFrota) : null;
  const totalsTerceiros = gruposTerceiros.length > 0 ? calculateSectionSummary(gruposTerceiros) : null;

  // Função para alternar a direção de ordenação
  const toggleSortDirectionFrota = (field: SortField) => {
    if (sortFieldFrota === field) {
      setSortDirectionFrota(sortDirectionFrota === 'asc' ? 'desc' : 'asc');
    } else {
      setSortFieldFrota(field);
      setSortDirectionFrota('asc');
    }
  };

  const toggleSortDirectionTerceiros = (field: SortField) => {
    if (sortFieldTerceiros === field) {
      setSortDirectionTerceiros(sortDirectionTerceiros === 'asc' ? 'desc' : 'asc');
    } else {
      setSortFieldTerceiros(field);
      setSortDirectionTerceiros('asc');
    }
  };

  // ✅ Função de Impressão (Baseada no padrão do sistema)
  const handlePrint = () => {
    if (manifestos.length === 0) {
      toast.error('Não há dados para imprimir.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão');
      return;
    }

    // 🏢 LÓGICA DE LOGOS PARA RELATÓRIOS
    const dominio = user?.domain?.toUpperCase() || 'PRESTO';
    const isACV = (dominio === 'ACV');
    
    // Logo Esquerda (Empresa): prioridade banco de dados > clientLogos.ts (SEM fallback Presto)
    const logoEmpresa = getCompanyLogoUrl(dominio, clientConfig);
    
    // Logo Direita (Sistema): Sempre Presto, EXCETO para ACV
    const logoPresto = 'https://webpresto.com.br/images/logo_rel.png';

    const renderTableHtml = (
      groups: ManifestoGroup[],
      title: string,
      totals: { totalFrete: number; totalPeso: number; qtdRegistros: number; qtdGrupos: number } | null
    ) => {
      if (groups.length === 0 || !totals) return '';

      const formatPercent = (value: number) =>
        `${new Intl.NumberFormat('pt-BR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(value)}%`;

      return `
        <div class="section">
          <div class="section-head">
            <div>
              <div class="section-title">${title}</div>
              <div class="section-subtitle">Grupos organizados por CTRB para leitura operacional, conferencia de frete e peso.</div>
            </div>
          </div>
          <div class="section-summary">
            <div class="summary-box">
              <span class="summary-label">Grupos CTRB</span>
              <strong>${totals.qtdGrupos}</strong>
            </div>
            <div class="summary-box">
              <span class="summary-label">Manifestos</span>
              <strong>${totals.qtdRegistros}</strong>
            </div>
            <div class="summary-box">
              <span class="summary-label">Total Frete</span>
              <strong>${formatCurrency(totals.totalFrete)}</strong>
            </div>
            <div class="summary-box">
              <span class="summary-label">Peso Total</span>
              <strong>${formatPeso(totals.totalPeso)}</strong>
            </div>
          </div>

          ${groups.map(group => `
            <div class="group-card">
              <div class="group-header">
                <div class="group-main">
                  <div class="group-label">Grupo CTRB</div>
                  <div class="group-code-row">
                    <div class="group-code">${group.displayCtrb}</div>
                    <div class="group-badge">${group.qtdManifestos} ${group.qtdManifestos === 1 ? 'manifesto' : 'manifestos'}</div>
                  </div>
                  <div class="group-meta">Frete acumulado do grupo: <strong>${formatCurrency(group.totalFrete)}</strong></div>
                </div>
                <div class="group-kpis">
                  <div class="group-kpi">
                    <span>Vlr. CTRB</span>
                    <strong>${formatCurrency(group.valorCtrb)}</strong>
                  </div>
                  <div class="group-kpi">
                    <span>Pedágio</span>
                    <strong>${formatCurrency(group.valorPedagio)}</strong>
                  </div>
                  <div class="group-kpi">
                    <span>CTRB/Frete</span>
                    <strong>${formatPercent(group.percentualCtrb)}</strong>
                  </div>
                </div>
              </div>
              <div class="group-progress-wrap">
                <div class="group-progress-head">
                  <span>Participacao do CTRB sobre o frete do grupo</span>
                  <strong>${formatPercent(group.percentualCtrb)}</strong>
                </div>
                <div class="group-progress-track">
                  <div class="group-progress-bar" style="width: ${Math.min(group.percentualCtrb, 100)}%;"></div>
                </div>
                <div class="group-weight-box">Peso do grupo: <strong>${formatPeso(group.totalPeso)}</strong></div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="text-align: center;">Manifesto</th>
                    <th style="text-align: center;">Destino</th>
                    <th style="text-align: center;">Placa</th>
                    <th style="text-align: right;">Total Frete</th>
                    <th style="text-align: right;">Peso (Kg)</th>
                    <th style="text-align: center;">Emissão</th>
                    <th style="text-align: center;">Saída</th>
                  </tr>
                </thead>
                <tbody>
                  ${group.manifestos.map(m => `
                    <tr>
                      <td style="text-align: center; font-family: monospace;">${m.numero}</td>
                      <td style="text-align: center;">${m.siglaDestino}</td>
                      <td style="text-align: center; font-family: monospace;">${m.placa}${m.placaCarreta ? ' + ' + m.placaCarreta : ''}</td>
                      <td style="text-align: right;">${formatCurrency(m.totalFrete)}</td>
                      <td style="text-align: right;">${formatPeso(m.pesoTotal)}</td>
                      <td style="text-align: center; font-family: monospace;">${m.dataEmissao || '-'}</td>
                      <td style="text-align: center; font-family: monospace;">${m.horarioSaida || '-'}</td>
                    </tr>
                  `).join('')}
                  <tr class="subtotal-row">
                    <td colspan="3" style="text-align: center;">Subtotal</td>
                    <td style="text-align: right;">${formatCurrency(group.totalFrete)}</td>
                    <td style="text-align: right;">${formatPeso(group.totalPeso)}</td>
                    <td colspan="2" style="text-align: right;">CTRB representa ${formatPercent(group.percentualCtrb)} do frete</td>
                  </tr>
                </tbody>
              </table>
            </div>
          `).join('')}
        </div>
      `;
    };

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Conferência de Saídas - ${user?.domain?.toUpperCase()}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              padding: 10mm; 
              font-size: 9pt;
              color: #000;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 2px solid #2563eb;
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 15px;
            }
            .logo {
              max-width: 150px;
              max-height: 50px;
              object-fit: contain;
            }
            .header-info h1 {
              font-size: 14pt;
              color: #2563eb;
              margin-bottom: 3px;
              text-transform: uppercase;
            }
            .header-right {
              text-align: right;
            }
            .header-right img {
              max-width: 120px;
              max-height: 40px;
              display: block;
              margin-left: auto;
              object-fit: contain;
            }
            .section {
              margin-bottom: 20px;
            }
            .section-head {
              display: flex;
              justify-content: space-between;
              align-items: end;
              margin-bottom: 8px;
            }
            .section-title {
              font-size: 10pt;
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 2px;
              padding-bottom: 4px;
              text-transform: uppercase;
            }
            .section-subtitle {
              font-size: 7.5pt;
              color: #64748b;
              margin-bottom: 6px;
            }
            .section-summary {
              display: flex;
              gap: 8px;
              margin-bottom: 10px;
            }
            .summary-box {
              flex: 1;
              border: 1px solid #dbeafe;
              background: #ffffff;
              border-radius: 10px;
              padding: 8px;
            }
            .summary-label {
              display: block;
              font-size: 7pt;
              text-transform: uppercase;
              color: #1d4ed8;
              margin-bottom: 3px;
            }
            .group-card {
              margin-bottom: 12px;
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              overflow: hidden;
            }
            .group-header {
              display: flex;
              justify-content: space-between;
              gap: 12px;
              padding: 10px 12px;
              background: linear-gradient(90deg, #f8fafc 0%, #eff6ff 50%, #f8fafc 100%);
              border-bottom: 1px solid #e5e7eb;
            }
            .group-main {
              flex: 1;
            }
            .group-label {
              font-size: 7pt;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.12em;
            }
            .group-code-row {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-top: 2px;
            }
            .group-code {
              font-size: 11pt;
              font-family: monospace;
              font-weight: bold;
              color: #0f172a;
            }
            .group-badge {
              font-size: 7pt;
              font-weight: bold;
              color: #334155;
              background: #e2e8f0;
              border-radius: 999px;
              padding: 3px 8px;
            }
            .group-meta {
              margin-top: 2px;
              font-size: 7.5pt;
              color: #475569;
            }
            .group-kpis {
              display: flex;
              gap: 8px;
            }
            .group-kpi {
              min-width: 90px;
              border: 1px solid #dbeafe;
              background: #ffffff;
              border-radius: 8px;
              padding: 6px 8px;
            }
            .group-kpi span {
              display: block;
              font-size: 7pt;
              color: #64748b;
              text-transform: uppercase;
              margin-bottom: 2px;
            }
            .group-kpi strong {
              font-size: 8pt;
              color: #0f172a;
            }
            .group-progress-wrap {
              padding: 8px 12px 10px;
              background: #ffffff;
              border-bottom: 1px solid #e5e7eb;
            }
            .group-progress-head {
              display: flex;
              justify-content: space-between;
              gap: 8px;
              font-size: 7pt;
              color: #64748b;
              margin-bottom: 4px;
              text-transform: uppercase;
            }
            .group-progress-track {
              height: 7px;
              border-radius: 999px;
              background: #e2e8f0;
              overflow: hidden;
            }
            .group-progress-bar {
              height: 100%;
              border-radius: 999px;
              background: linear-gradient(90deg, #8b5cf6 0%, #3b82f6 100%);
            }
            .group-weight-box {
              margin-top: 6px;
              font-size: 7.5pt;
              color: #475569;
              text-align: right;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 8pt;
            }
            th {
              background-color: #f3f4f6;
              color: #1e40af;
              font-weight: bold;
              padding: 6px 4px;
              border: 1px solid #e5e7eb;
              text-transform: uppercase;
            }
            td {
              border: 1px solid #e5e7eb;
              padding: 5px 4px;
            }
            .subtotal-row {
              background-color: #f1f5f9;
              font-weight: bold;
            }
            .footer {
              margin-top: 30px;
              padding-top: 10px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #9ca3af;
              font-size: 7pt;
            }
            @media print {
              body { padding: 5mm; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">
              <img src="${logoEmpresa}" alt="Logo Empresa" class="logo" />
              <div class="header-info">
                <h1>Conferência de Saídas</h1>
                <p>Sistema de Gestão</p>
              </div>
            </div>
            <div class="header-right">
              ${!isACV ? `<img src="${logoPresto}" alt="Sistema Presto" />` : ''}
              <div style="margin-top: 5px; font-size: 8pt; color: #666;">
                Período: ${new Date(filters.periodoEmissaoInicio + 'T12:00:00').toLocaleDateString('pt-BR')} até ${new Date(filters.periodoEmissaoFim + 'T12:00:00').toLocaleDateString('pt-BR')}<br/>
                Origem: ${filters.unidadeOrigem || 'TODAS'} | Destino: ${filters.unidadeDestino || 'TODAS'}
              </div>
            </div>
          </div>

          ${renderTableHtml(gruposFrota, 'VEÍCULOS FROTA', totalsFrota)}
          ${renderTableHtml(gruposTerceiros, 'VEÍCULOS TERCEIROS', totalsTerceiros)}

          <div class="footer">
            Documento gerado em ${new Date().toLocaleString('pt-BR')} por ${user?.username?.toUpperCase()}<br/>
            © 2026 Sistema Presto - Gestão Inteligente
          </div>

          <script>
            let imagesLoaded = 0;
            const totalImages = ${dominio !== 'ACV' ? 2 : 1};
            
            function checkAllImagesLoaded() {
              imagesLoaded++;
              if (imagesLoaded >= totalImages) {
                setTimeout(() => {
                  window.print();
                }, 500);
              }
            }

            const images = document.querySelectorAll('img');
            images.forEach(img => {
              if (img.complete) {
                checkAllImagesLoaded();
              } else {
                img.onload = checkAllImagesLoaded;
                img.onerror = checkAllImagesLoaded;
              }
            });

            setTimeout(() => {
              if (imagesLoaded < totalImages) {
                window.print();
              }
            }, 3000);
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <AdminLayout 
      title="Conferência de Saídas"
      description="Relatório de manifestos expedidos"
    >
      {/* Filtros */}
      <div className="mb-6">
        <Card className="dark:bg-slate-900/90 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-slate-100">
              Filtros de Pesquisa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Período de Emissão */}
              <div className="space-y-2">
                <Label className="text-slate-900 dark:text-slate-100">
                  Período de Emissão - Início
                </Label>
                <Input
                  type="date"
                  value={filters.periodoEmissaoInicio}
                  onChange={(e) => setFilters({...filters, periodoEmissaoInicio: e.target.value})}
                  className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-900 dark:text-slate-100">
                  Período de Emissão - Fim
                </Label>
                <Input
                  type="date"
                  value={filters.periodoEmissaoFim}
                  onChange={(e) => setFilters({...filters, periodoEmissaoFim: e.target.value})}
                  className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>

              {/* Placa */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-slate-900 dark:text-slate-100">Placa</Label>
                <FilterSelectVeiculo
                  value={filters.placa || ''}
                  onChange={(value) => setFilters({...filters, placa: value})}
                />
              </div>

              {/* Unidade Origem */}
              <div className="space-y-2">
                <Label className="text-slate-900 dark:text-slate-100">Unidade Origem</Label>
                <FilterSelectUnidadeSingle
                  value={filters.unidadeOrigem}
                  onChange={(value) => setFilters({...filters, unidadeOrigem: value})}
                />
              </div>

              {/* Unidade Destino */}
              <div className="space-y-2">
                <Label className="text-slate-900 dark:text-slate-100">Unidade Destino</Label>
                <FilterSelectUnidadeSingle
                  value={filters.unidadeDestino}
                  onChange={(value) => setFilters({...filters, unidadeDestino: value})}
                />
              </div>
            </div>

            {/* Botão de Pesquisa */}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Gerar Relatório
                  </>
                )}
              </Button>
              
              <Button
                onClick={handlePrint}
                disabled={loading || manifestos.length === 0}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Imprimindo...
                  </>
                ) : (
                  <>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir PDF
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleExportExcel}
                disabled={loading || manifestos.length === 0}
                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Resultados */}
      {hasSearched && (
        <div className="max-w-[1600px] mx-auto">
          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>Manifestos Encontrados</span>
                <span className="text-sm font-normal text-slate-600 dark:text-slate-400">
                  {manifestos.length} {manifestos.length === 1 ? 'registro' : 'registros'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                </div>
              ) : manifestos.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  Nenhum manifesto encontrado com os filtros aplicados.
                </div>
              ) : (
                <>
                  {/* ✅ BLOCO 1: VEÍCULOS FROTA */}
                  {manifestosFrota.length > 0 && (
                    <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        VEÍCULOS FROTA ({totalsFrota?.qtdGrupos || 0} {totalsFrota?.qtdGrupos === 1 ? 'CTRB' : 'CTRBs'} / {manifestosFrota.length} {manifestosFrota.length === 1 ? 'manifesto' : 'manifestos'})
                          </h3>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            Grupos de frete organizados por CTRB para leitura operacional e conferencia.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-medium">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Frete: {formatCurrency(totalsFrota?.totalFrete || 0)}
                          </span>
                          <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                            Peso: {formatPeso(totalsFrota?.totalPeso || 0)}
                          </span>
                        </div>
                      </div>

                      <ManifestosTable
                        groups={gruposFrota}
                        sortField={sortFieldFrota}
                        sortDirection={sortDirectionFrota}
                        onToggleSort={toggleSortDirectionFrota}
                        formatCurrency={formatCurrency}
                        formatPeso={formatPeso}
                      />
                    </div>
                  )}

                  {/* ✅ BLOCO 2: VEÍCULOS TERCEIROS */}
                  {manifestosTerceiros.length > 0 && (
                    <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        VEÍCULOS TERCEIROS ({totalsTerceiros?.qtdGrupos || 0} {totalsTerceiros?.qtdGrupos === 1 ? 'CTRB' : 'CTRBs'} / {manifestosTerceiros.length} {manifestosTerceiros.length === 1 ? 'manifesto' : 'manifestos'})
                          </h3>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            Segmentacao por CTRB para evidenciar frete, peso e participacao do conhecimento.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-medium">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Frete: {formatCurrency(totalsTerceiros?.totalFrete || 0)}
                          </span>
                          <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                            Peso: {formatPeso(totalsTerceiros?.totalPeso || 0)}
                          </span>
                        </div>
                      </div>

                      <ManifestosTable
                        groups={gruposTerceiros}
                        sortField={sortFieldTerceiros}
                        sortDirection={sortDirectionTerceiros}
                        onToggleSort={toggleSortDirectionTerceiros}
                        formatCurrency={formatCurrency}
                        formatPeso={formatPeso}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}
