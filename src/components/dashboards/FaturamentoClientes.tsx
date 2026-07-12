import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import {
  Award,
  Check,
  ChevronDown,
  FileDown,
  Filter,
  Info,
  Loader2,
  Package,
  Search,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Weight,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useTheme } from '../ThemeProvider';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { FilterSelectUnidadeOrdered } from '../cadastros/FilterSelectUnidadeOrdered';
import { Switch } from '../ui/switch';
import { getCompanyLogoUrl } from '../../config/clientLogos';
import { uploadClienteLogo } from '../../services/clientesService';

function getMesAtualFechadoPeriod() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { inicio: fmt(first), fim: fmt(last) };
}

function formatPeriodDisplay(inicio: string, fim: string): string {
  if (!inicio && !fim) return '';
  const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const p = (s: string) => { const [y,m,d] = s.split('-'); return { year: +y, month: +m, day: +d }; };
  const s = p(inicio); const e = p(fim);
  if (s.month === e.month && s.year === e.year) return `${MONTHS[s.month-1]} ${s.year}`;
  if (s.year === e.year) return `${MONTHS[s.month-1]} – ${MONTHS[e.month-1]} ${s.year}`;
  return `${MONTHS[s.month-1]} ${s.year} – ${MONTHS[e.month-1]} ${e.year}`;
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}
function fmtBRLCompact(v: number) {
  if (v >= 1_000_000) return 'R$ ' + (v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Mi';
  return fmtBRL(v);
}
function fmtNum(v: number) {
  return v.toLocaleString('pt-BR');
}
function fmtKg(v: number) {
  if (v >= 1000) return (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' t';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' kg';
}

const PALETTE = [
  '#6366f1','#3b82f6','#06b6d4','#10b981','#f59e0b',
  '#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316',
];

interface Filters {
  periodoEmissaoInicio: string;
  periodoEmissaoFim: string;
  tpFrete: string;
  siglaEmit: string[];
  siglaDest: string[];
  cnpjsPagadores: string[];
  topN: 10 | 20;
}

interface ClienteRanking {
  cnpj: string;
  nome: string;
  qtde_ctes: number;
  total_frete: number;
  total_merc: number;
  total_peso: number;
  total_volumes: number;
  ticket_medio: number;
  qtde_cif: number;
  qtde_fob: number;
  is_grupo?: boolean;
}

type PdfClienteItem = {
  rank: number;
  cnpj: string;
  nome: string;
  qtde_ctes: number;
  total_frete: number;
  is_grupo: boolean;
  logo_url: string | null;
  uploading: boolean;
};

interface Totais {
  qtde_ctes: number;
  total_frete: number;
  total_merc: number;
  total_peso: number;
  total_volumes: number;
  qtde_clientes: number;
  qtde_cif?: number;
  qtde_fob?: number;
}

interface EvolucaoMes {
  mes: string;
  mes_label: string;
  total_frete: number;
  qtde_ctes: number;
}

interface UnidadeFat {
  sigla: string;
  total_frete: number;
  qtde_ctes: number;
}

interface ClienteOpcao {
  cnpj: string;
  nome: string;
  total_frete: number;
}

export function FaturamentoClientes() {
  const { user, clientConfig } = useAuth();
  const { theme } = useTheme();
  usePageTitle('Faturamento de Clientes');

  const defaultPeriod = getMesAtualFechadoPeriod();
  const userUnit = user?.unidade_atual || user?.unidade;

  const [filters, setFilters] = useState<Filters>({
    periodoEmissaoInicio: defaultPeriod.inicio,
    periodoEmissaoFim: defaultPeriod.fim,
    tpFrete: '',
    siglaEmit: userUnit && userUnit !== 'MTZ' ? [userUnit] : [],
    siglaDest: [],
    cnpjsPagadores: [],
    topN: 10,
  });
  const [tempFilters, setTempFilters] = useState<Filters>(filters);
  const [showFilters, setShowFilters] = useState(false);

  const [clientes, setClientes] = useState<ClienteRanking[]>([]);
  const [totais, setTotais] = useState<Totais | null>(null);
  const [totaisSelecionados, setTotaisSelecionados] = useState<Totais | null>(null);
  const [evolucao, setEvolucao] = useState<EvolucaoMes[]>([]);
  const [unidades, setUnidades] = useState<UnidadeFat[]>([]);
  const [evolClientes, setEvolClientes] = useState<any[]>([]);
  const [evolClientesKeys, setEvolClientesKeys] = useState<Record<string, string>>({});
  const [evolUnidades, setEvolUnidades] = useState<any[]>([]);
  const [evolUnidadesKeys, setEvolUnidadesKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [groupBy, setGroupBy] = useState<'grupos' | 'clientes'>('grupos');

  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [clienteOpcoes, setClienteOpcoes] = useState<ClienteOpcao[]>([]);
  const [clienteSearch, setClienteSearch] = useState('');
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [clientesSelecionados, setClientesSelecionados] = useState<ClienteOpcao[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cteDialogOpen, setCteDialogOpen] = useState(false);
  const [cteDialogTitulo, setCteDialogTitulo] = useState('');
  const [cteDialogLista, setCteDialogLista] = useState<any[]>([]);
  const [cteDialogTotais, setCteDialogTotais] = useState<any>(null);
  const [loadingCtes, setLoadingCtes] = useState(false);

  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfItems, setPdfItems] = useState<PdfClienteItem[]>([]);
  const [pdfShowQtdCtes, setPdfShowQtdCtes] = useState(true);
  const [pdfShowFaturamento, setPdfShowFaturamento] = useState(true);

  const resolveLogoUrlAbs = (url: string) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return `${window.location.origin}${url}`;
  };

  const fetchClienteLogoUrl = async (cnpj: string): Promise<string | null> => {
    const res = await apiFetch(
      `${ENVIRONMENT.apiBaseUrl}/clientes/logo_get.php`,
      { method: 'POST', body: JSON.stringify({ cnpj }) },
      true
    );
    if (!res?.success) return null;
    return res.url ? resolveLogoUrlAbs(res.url) : null;
  };

  const fileToDataUrl = (file: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
      reader.readAsDataURL(file);
    });

  const fetchAsDataUrl = async (url: string): Promise<string | null> => {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return null;
      const blob = await r.blob();
      return await fileToDataUrl(blob);
    } catch {
      return null;
    }
  };

  const abrirPdfDialog = useCallback(async () => {
    if (!clientes.length) {
      toast.error('Não há clientes ranqueados para gerar o PDF.');
      return;
    }

    setPdfShowQtdCtes(true);
    setPdfShowFaturamento(true);
    setPdfDialogOpen(true);
    setPdfLoading(true);

    const baseItems: PdfClienteItem[] = clientes.map((c, i) => ({
      rank: i + 1,
      cnpj: c.cnpj,
      nome: c.nome,
      qtde_ctes: c.qtde_ctes,
      total_frete: c.total_frete,
      is_grupo: !!c.is_grupo,
      logo_url: null,
      uploading: false,
    }));
    setPdfItems(baseItems);

    try {
      const urls = await Promise.all(baseItems.map(i => fetchClienteLogoUrl(i.cnpj)));
      setPdfItems(prev => prev.map((it, idx) => ({ ...it, logo_url: urls[idx] })));
    } catch {
      setPdfItems(prev => prev);
    } finally {
      setPdfLoading(false);
    }
  }, [clientes]);

  const handleUploadLogoFromDialog = async (cnpj: string, file: File) => {
    setPdfItems(prev => prev.map(i => i.cnpj === cnpj ? { ...i, uploading: true } : i));
    try {
      const res = await uploadClienteLogo(cnpj, file);
      if (!res?.success) {
        toast.error(res?.message || 'Erro ao enviar logo.');
        return;
      }
      const url = res.url ? resolveLogoUrlAbs(res.url) : await fetchClienteLogoUrl(cnpj);
      setPdfItems(prev => prev.map(i => i.cnpj === cnpj ? { ...i, logo_url: url || null } : i));
      if (res.warning) toast.info(res.warning);
      toast.success('Logo enviada.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao enviar logo.');
    } finally {
      setPdfItems(prev => prev.map(i => i.cnpj === cnpj ? { ...i, uploading: false } : i));
    }
  };

  const gerarPdfRanking = async () => {
    if (!pdfItems.length) {
      toast.error('Não há clientes na lista do PDF.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela do PDF.');
      return;
    }

    setPdfGenerating(true);
    try {
      printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Gerando PDF...</title></head><body style="font-family:Arial,sans-serif;padding:20px;">Gerando documento...</body></html>`);
      printWindow.document.close();

      const dominio = user?.domain?.toUpperCase() || 'PRESTO';
      const nomeEmpresa = user?.client_name || 'Transportadora';
      const logoEmpresaUrl = getCompanyLogoUrl(dominio, clientConfig);
      const logoEmpresaData = logoEmpresaUrl ? await fetchAsDataUrl(logoEmpresaUrl) : null;

      const itensComLogo = await Promise.all(pdfItems.map(async (it) => {
        const dataUrl = it.logo_url ? await fetchAsDataUrl(it.logo_url) : null;
        return { ...it, logo_data: dataUrl };
      }));

      const periodo = formatPeriodDisplay(filters.periodoEmissaoInicio, filters.periodoEmissaoFim) || 'Sem período';
      const agora = new Date().toLocaleString('pt-BR');
      const titulo = groupBy === 'grupos' ? 'RANKING DE GRUPOS (FATURAMENTO)' : 'RANKING DE CLIENTES (FATURAMENTO)';
      const recorteLabel = filters.cnpjsPagadores.length > 0 ? `Selecionados (${filters.cnpjsPagadores.length})` : `Top ${filters.topN}`;

      const cardsHtml = itensComLogo.map((it) => {
        const metaParts: string[] = [];
        if (pdfShowQtdCtes) metaParts.push(`<span class="chip">${it.qtde_ctes} CT-es</span>`);
        if (pdfShowFaturamento) metaParts.push(`<span class="chip">${fmtBRL(it.total_frete)}</span>`);
        const meta = metaParts.length ? `<div class="meta">${metaParts.join('')}</div>` : '';

        const logo = it.logo_data
          ? `<img class="logo-img" src="${it.logo_data}" alt="Logo" />`
          : `<div class="logo-empty">Sem logo</div>`;

        return `
          <div class="card">
            <div class="rank">#${it.rank}</div>
            <div class="logo-box">${logo}</div>
            <div class="name" title="${(it.nome || '').replace(/"/g, '&quot;')}">${it.nome || '-'}</div>
            ${meta}
          </div>
        `;
      }).join('');

      const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>${titulo}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; color: #0f172a; }
            .header { display:flex; align-items:center; justify-content:space-between; border-bottom: 3px solid #4f46e5; padding-bottom: 10px; margin-bottom: 12px; }
            .header-left { display:flex; align-items:center; gap: 12px; }
            .logo-empresa { width: 140px; height: 50px; object-fit: contain; }
            .logo-empresa-text { font-size: 14pt; font-weight: 700; color: #1e3a8a; max-width: 260px; }
            .header-info h1 { font-size: 14pt; margin: 0; color: #111827; letter-spacing: 0.3px; }
            .header-info p { margin: 2px 0 0 0; font-size: 9pt; color: #475569; }
            .filters { display:flex; justify-content:space-between; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; margin-bottom: 12px; font-size: 9pt; color: #334155; }
            .filters strong { color: #0f172a; }
            .grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 10px; background: #ffffff; box-shadow: 0 1px 0 rgba(15,23,42,0.04); }
            .rank { font-size: 10pt; font-weight: 800; color: #4f46e5; margin-bottom: 6px; }
            .logo-box { width: 100%; height: 74px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; display:flex; align-items:center; justify-content:center; padding: 8px; overflow:hidden; }
            .logo-img { max-width: 100%; max-height: 100%; object-fit: contain; }
            .logo-empty { font-size: 9pt; color: #94a3b8; }
            .name { margin-top: 8px; font-size: 10pt; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .meta { margin-top: 6px; display:flex; gap: 6px; flex-wrap: wrap; }
            .chip { font-size: 8.5pt; background: #eef2ff; color: #3730a3; border: 1px solid #c7d2fe; padding: 2px 8px; border-radius: 999px; }
            .footer { margin-top: 12px; font-size: 8pt; color: #64748b; text-align: right; }
            @media print {
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">
              ${logoEmpresaData ? `<img src="${logoEmpresaData}" class="logo-empresa" />` : `<div class="logo-empresa-text">${nomeEmpresa}</div>`}
              <div class="header-info">
                <h1>${titulo}</h1>
                <p>${groupBy === 'grupos' ? 'Visão por grupo (logo do CNPJ principal)' : 'Visão por cliente pagador'}</p>
              </div>
            </div>
            <div class="header-info" style="text-align:right">
              <p><strong>${recorteLabel}</strong></p>
              <p>${agora}</p>
            </div>
          </div>

          <div class="filters">
            <div><strong>Período:</strong> ${periodo}</div>
            <div><strong>Unidade(s):</strong> ${filters.siglaEmit?.length ? filters.siglaEmit.join(', ') : 'Todas'}</div>
            <div><strong>Destino(s):</strong> ${filters.siglaDest?.length ? filters.siglaDest.join(', ') : 'Todos'}</div>
          </div>

          <div class="grid">
            ${cardsHtml}
          </div>

          <div class="footer">Gerado pelo Sistema Presto</div>

          <div class="no-print" style="margin-top:16px; font-size:10pt; color:#475569;">
            Dica: use “Salvar como PDF” na janela de impressão.
          </div>

          <script>
            window.onload = function () { setTimeout(function(){ window.print(); }, 250); };
          </script>
        </body>
      </html>
    `;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar PDF.');
      try { printWindow.close(); } catch {}
    } finally {
      setPdfGenerating(false);
    }
  };

  const carregarDados = useCallback(async (f: Filters, gb: 'grupos' | 'clientes' = 'grupos') => {
    setLoading(true);
    try {
      const response = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/faturamento-clientes/get_dados.php`,
        { method: 'POST', body: JSON.stringify({ filters: f, groupBy: gb }) },
        true
      );
      if (response.success) {
        setClientes(response.data.clientes || []);
        setTotais(response.data.totais || null);
        setTotaisSelecionados(response.data.totais_selecionados || null);
        setEvolucao(response.data.evolucao || []);
        setUnidades(response.data.unidades || []);
        setEvolClientes(response.data.evol_clientes || []);
        setEvolClientesKeys(response.data.evol_clientes_keys || {});
        setEvolUnidades(response.data.evol_unidades || []);
        setEvolUnidadesKeys(response.data.evol_unidades_keys || []);
      } else {
        toast.error(response.message || 'Erro ao carregar dados');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDados(filters, groupBy);
  }, [filters, groupBy]);

  const cteDialogListaRef = useRef<any[]>([]);
  const cteDialogTituloRef = useRef<string>('');

  const exportarCteCSV = () => {
    const lista = cteDialogListaRef.current;
    const titulo = cteDialogTituloRef.current;
    if (!lista.length) return;
    const header = ['CT-e', 'Emissão', 'Pagador', 'Destinatário', 'Unidade', 'Vlr.Merc', 'Peso(kg)', 'Volumes', 'Frete'];
    const rows = lista.map(c => [
      `${c.ser_cte}${String(c.nro_cte).padStart(6, '0')}`,
      c.data_emissao,
      `"${(c.nome_pag || '').replace(/"/g, '""')}"`,
      `"${(c.nome_dest || '').replace(/"/g, '""')}"`,
      c.sigla_emit || '',
      c.vlr_merc.toFixed(2).replace('.', ','),
      c.peso_real.toFixed(2).replace('.', ','),
      c.qtde_vol,
      c.vlr_frete.toFixed(2).replace('.', ','),
    ]);
    const csv = [header.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ctes_${titulo.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const abrirCteDialog = useCallback(async (titulo: string, tipo: string, chave: string, mes?: string, opts?: { excluir_cnpjs?: string[]; excluir_grupos?: string[]; excluir_siglas?: string[] }) => {
    setCteDialogTitulo(titulo);
    cteDialogTituloRef.current = titulo;
    setCteDialogLista([]);
    cteDialogListaRef.current = [];
    setCteDialogTotais(null);
    setCteDialogOpen(true);
    setLoadingCtes(true);
    try {
      const response = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/faturamento-clientes/get_ctes.php`,
        { method: 'POST', body: JSON.stringify({ filters, tipo, chave, mes: mes ?? '', ...(opts ?? {}) }) },
        true
      );
      if (response.success) {
        const ctes = response.data.ctes || [];
        setCteDialogLista(ctes);
        cteDialogListaRef.current = ctes;
        setCteDialogTotais(response.data.totais || null);
      } else {
        toast.error(response.message || 'Erro ao carregar CT-es');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar CT-es');
    } finally {
      setLoadingCtes(false);
    }
  }, [filters]);

  const buscarClientesOpcoes = useCallback(async (search: string, f: Filters) => {
    setLoadingClientes(true);
    try {
      const response = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/faturamento-clientes/get_top_clientes.php`,
        { method: 'POST', body: JSON.stringify({ search, filters: f }) },
        true
      );
      if (response.success) {
        setClienteOpcoes(response.clientes || []);
      }
    } catch {
    } finally {
      setLoadingClientes(false);
    }
  }, []);

  useEffect(() => {
    if (!clienteDialogOpen) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      buscarClientesOpcoes(clienteSearch, tempFilters);
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [clienteSearch, clienteDialogOpen, tempFilters]);

  const toggleClienteSelecionado = (c: ClienteOpcao) => {
    setClientesSelecionados(prev => {
      const exists = prev.find(x => x.cnpj === c.cnpj);
      if (exists) return prev.filter(x => x.cnpj !== c.cnpj);
      if (prev.length >= 10) { toast.warning('Máximo de 10 clientes'); return prev; }
      return [...prev, c];
    });
  };

  const confirmarClientes = () => {
    setTempFilters(prev => ({ ...prev, cnpjsPagadores: clientesSelecionados.map(c => c.cnpj) }));
    setClienteDialogOpen(false);
  };

  const applyFilters = () => {
    setFilters({ ...tempFilters });
    setShowFilters(false);
  };

  const cancelFilters = () => {
    setTempFilters({ ...filters });
    setClientesSelecionados(filters.cnpjsPagadores.map(cnpj => {
      const found = clienteOpcoes.find(c => c.cnpj === cnpj);
      return found || { cnpj, nome: cnpj, total_frete: 0 };
    }));
    setShowFilters(false);
  };

  const clearFilters = () => {
    const empty: Filters = {
      periodoEmissaoInicio: '',
      periodoEmissaoFim: '',
      tpFrete: '',
      siglaEmit: [],
      siglaDest: [],
      cnpjsPagadores: [],
      topN: 10,
    };
    setTempFilters(empty);
    setClientesSelecionados([]);
  };

  const totalFreteGeral = totais?.total_frete ?? 0;

  const isDark = theme === 'dark';
  const gridColor  = isDark ? '#334155' : '#e2e8f0';
  const textColor  = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg  = isDark ? '#1e293b' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';

  const headerActions = (
    <div className="flex items-center gap-2 md:gap-4">
      <div className="text-right hidden md:block">
        <p className="text-slate-500 dark:text-slate-400 text-xs">Período</p>
        <p className="text-slate-900 dark:text-slate-100 text-sm">
          {formatPeriodDisplay(filters.periodoEmissaoInicio, filters.periodoEmissaoFim) || 'Sem período'}
        </p>
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => { setTempFilters({ ...filters }); setShowFilters(true); }}
        className="dark:border-slate-600 dark:hover:bg-slate-800"
      >
        <Filter className="w-4 h-4" />
      </Button>
    </div>
  );

  return (
    <DashboardLayout
      title="Faturamento de Clientes"
      description={user?.client_name}
      headerActions={headerActions}
    >
      <main className="container mx-auto px-3 md:px-6 py-6 space-y-6">

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Faturamento de Clientes
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              {groupBy === 'grupos'
                ? `Análise de faturamento por grupo de clientes — top ${filters.topN} por valor de frete`
                : `Análise de faturamento por cliente pagador — top ${filters.topN} por valor de frete`}
            </p>
          </div>
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1 shrink-0">
            <button
              onClick={() => setGroupBy('grupos')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                groupBy === 'grupos'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Grupos
            </button>
            <button
              onClick={() => setGroupBy('clientes')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                groupBy === 'clientes'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Clientes
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 px-5 py-3 flex items-center gap-3">
          <Info className="w-4 h-4 text-indigo-500 shrink-0" />
          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            <strong>Dica:</strong> Clique em qualquer cliente no ranking, fatia dos gráficos de rosca ou ponto nos gráficos de linha para ver a lista detalhada dos CT-es.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            {totais && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">Geral (todos os clientes)</div>
                  <Badge variant="outline" className="text-[10px] border-indigo-300 text-indigo-600 dark:border-indigo-700 dark:text-indigo-300">TOTAL</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {([
                    { label: 'Faturamento Total',   value: fmtBRL(totais.total_frete),    icon: Wallet,     bg: '#eef2ff', bgDark: '#1e1b4b33', border: '#c7d2fe', borderDark: '#3730a3', iconColor: '#4f46e5', textLabel: '#4338ca', textValue: '#312e81' },
                    { label: 'Clientes Ativos',     value: fmtNum(totais.qtde_clientes),  icon: Users,      bg: '#eff6ff', bgDark: '#172554', border: '#bfdbfe', borderDark: '#1e40af', iconColor: '#2563eb', textLabel: '#1d4ed8', textValue: '#1e3a8a' },
                    { label: 'CT-es Emitidos',      value: fmtNum(totais.qtde_ctes),      icon: Truck,      bg: '#ecfeff', bgDark: '#083344', border: '#a5f3fc', borderDark: '#155e75', iconColor: '#0891b2', textLabel: '#0e7490', textValue: '#164e63' },
                    { label: 'Valor de Mercadoria', value: fmtBRLCompact(totais.total_merc), icon: TrendingUp, bg: '#f0fdf4', bgDark: '#052e16', border: '#bbf7d0', borderDark: '#14532d', iconColor: '#16a34a', textLabel: '#15803d', textValue: '#14532d' },
                    { label: 'Peso Total',          value: fmtKg(totais.total_peso),      icon: Weight,     bg: '#fffbeb', bgDark: '#1c1003', border: '#fde68a', borderDark: '#78350f', iconColor: '#d97706', textLabel: '#b45309', textValue: '#92400e' },
                    { label: 'Volumes',             value: fmtNum(totais.total_volumes),  icon: Package,    bg: '#fff1f2', bgDark: '#1f0a0a', border: '#fecdd3', borderDark: '#9f1239', iconColor: '#e11d48', textLabel: '#be123c', textValue: '#881337' },
                  ] as const).map(({ label, value, icon: Icon, bg, bgDark, border, borderDark, iconColor, textLabel, textValue }) => (
                    <div
                      key={`geral-${label}`}
                      className="rounded-xl border p-4"
                      style={{ backgroundColor: isDark ? bgDark : bg, borderColor: isDark ? borderDark : border }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-4 h-4" style={{ color: iconColor }} />
                        <span className="text-xs font-medium" style={{ color: isDark ? '#cbd5e1' : textLabel }}>{label}</span>
                      </div>
                      <p className="text-lg font-bold leading-tight" style={{ color: isDark ? '#f1f5f9' : textValue }}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Selecionados ({filters.cnpjsPagadores.length > 0 ? `${filters.cnpjsPagadores.length} cliente(s)` : `top ${filters.topN}`})
                  </div>
                  <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300">RECORTE</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {(() => {
                    const t = totaisSelecionados ?? { qtde_ctes: 0, total_frete: 0, total_merc: 0, total_peso: 0, total_volumes: 0, qtde_clientes: 0 };
                    return ([
                      { label: 'Faturamento Total',   value: fmtBRL(t.total_frete),    icon: Wallet,     bg: '#f1f5f9', bgDark: '#0f172a', border: '#e2e8f0', borderDark: '#334155', iconColor: '#4f46e5', textLabel: '#64748b', textValue: '#0f172a' },
                      { label: 'Clientes Ativos',     value: fmtNum(t.qtde_clientes),  icon: Users,      bg: '#f1f5f9', bgDark: '#0f172a', border: '#e2e8f0', borderDark: '#334155', iconColor: '#2563eb', textLabel: '#64748b', textValue: '#0f172a' },
                      { label: 'CT-es Emitidos',      value: fmtNum(t.qtde_ctes),      icon: Truck,      bg: '#f1f5f9', bgDark: '#0f172a', border: '#e2e8f0', borderDark: '#334155', iconColor: '#0891b2', textLabel: '#64748b', textValue: '#0f172a' },
                      { label: 'Valor de Mercadoria', value: fmtBRLCompact(t.total_merc), icon: TrendingUp, bg: '#f1f5f9', bgDark: '#0f172a', border: '#e2e8f0', borderDark: '#334155', iconColor: '#16a34a', textLabel: '#64748b', textValue: '#0f172a' },
                      { label: 'Peso Total',          value: fmtKg(t.total_peso),      icon: Weight,     bg: '#f1f5f9', bgDark: '#0f172a', border: '#e2e8f0', borderDark: '#334155', iconColor: '#d97706', textLabel: '#64748b', textValue: '#0f172a' },
                      { label: 'Volumes',             value: fmtNum(t.total_volumes),  icon: Package,    bg: '#f1f5f9', bgDark: '#0f172a', border: '#e2e8f0', borderDark: '#334155', iconColor: '#e11d48', textLabel: '#64748b', textValue: '#0f172a' },
                    ] as const).map(({ label, value, icon: Icon, bg, bgDark, border, borderDark, iconColor, textLabel, textValue }) => (
                      <div
                        key={`sel-${label}`}
                        className="rounded-xl border p-4"
                        style={{ backgroundColor: isDark ? bgDark : bg, borderColor: isDark ? borderDark : border }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4" style={{ color: iconColor }} />
                          <span className="text-xs font-medium" style={{ color: isDark ? '#cbd5e1' : textLabel }}>{label}</span>
                        </div>
                        <p className="text-lg font-bold leading-tight" style={{ color: isDark ? '#f1f5f9' : textValue }}>{value}</p>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Ranking de Clientes</h3>
                  <span className="ml-auto text-xs text-slate-400 hidden sm:inline">por faturamento de frete</span>
                  <Button
                    onClick={abrirPdfDialog}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 ml-2"
                    disabled={loading || clientes.length === 0}
                    title="Gerar PDF do ranking (com logos)"
                    size="sm"
                  >
                    <FileDown className="w-4 h-4" />
                    Gerar PDF
                  </Button>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {clientes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <Users className="w-10 h-10 mb-2" />
                      <p className="text-sm">Nenhum dado encontrado</p>
                    </div>
                  ) : (
                    <>
                      {clientes.map((c, i) => {
                        const pct = totalFreteGeral > 0 ? (c.total_frete / totalFreteGeral) * 100 : 0;
                        const color = PALETTE[i % PALETTE.length];
                        return (
                          <div
                            key={c.cnpj}
                            className="px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                            onClick={() => abrirCteDialog(c.nome, c.is_grupo ? 'grupo' : 'cliente', c.cnpj)}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                style={{ backgroundColor: color }}
                              >
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                                    {c.nome}
                                    {c.is_grupo && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0 border-indigo-300 text-indigo-600 dark:text-indigo-400">Grupo</Badge>}
                                  </p>
                                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 shrink-0">{fmtBRL(c.total_frete)}</p>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-1.5">
                                  <div
                                    className="h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%`, backgroundColor: color }}
                                  />
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                  <span>{c.qtde_ctes} CT-es</span>
                                  <span>·</span>
                                  <span>Ticket: {fmtBRL(c.ticket_medio)}</span>
                                  <span>·</span>
                                  <span>{pct.toFixed(1)}% do total</span>
                                  {c.qtde_cif > 0 && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">CIF {c.qtde_cif}</Badge>}
                                  {c.qtde_fob > 0 && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">FOB {c.qtde_fob}</Badge>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {(() => {
                        const sel = totaisSelecionados ?? { qtde_ctes: 0, total_frete: 0, total_merc: 0, total_peso: 0, total_volumes: 0, qtde_clientes: 0, qtde_cif: 0, qtde_fob: 0 };
                        const dem = {
                          qtde_ctes: Math.max(0, (totais?.qtde_ctes ?? 0) - (sel.qtde_ctes ?? 0)),
                          total_frete: Math.max(0, (totais?.total_frete ?? 0) - (sel.total_frete ?? 0)),
                          total_merc: Math.max(0, (totais?.total_merc ?? 0) - (sel.total_merc ?? 0)),
                          total_peso: Math.max(0, (totais?.total_peso ?? 0) - (sel.total_peso ?? 0)),
                          total_volumes: Math.max(0, (totais?.total_volumes ?? 0) - (sel.total_volumes ?? 0)),
                          qtde_clientes: Math.max(0, (totais?.qtde_clientes ?? 0) - (sel.qtde_clientes ?? 0)),
                          qtde_cif: Math.max(0, (totais?.qtde_cif ?? 0) - (sel.qtde_cif ?? 0)),
                          qtde_fob: Math.max(0, (totais?.qtde_fob ?? 0) - (sel.qtde_fob ?? 0)),
                        };
                        const demTicket = dem.qtde_ctes > 0 ? dem.total_frete / dem.qtde_ctes : 0;
                        const pctDem = totalFreteGeral > 0 ? (dem.total_frete / totalFreteGeral) * 100 : 0;

                        const selectionIsActive = filters.cnpjsPagadores.length > 0;
                        const excluirCnpjs = selectionIsActive
                          ? filters.cnpjsPagadores
                          : clientes.filter(c => !c.is_grupo).map(c => c.cnpj);
                        const excluirGrupos = selectionIsActive ? [] : clientes.filter(c => c.is_grupo).map(c => c.cnpj);

                        return (
                          <>
                            <div
                              className="px-5 py-3 bg-slate-50 dark:bg-slate-800/30 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                              onClick={() => abrirCteDialog('Demais', 'cliente', '__demais__', '', { excluir_cnpjs: excluirCnpjs, excluir_grupos: excluirGrupos })}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 shrink-0">
                                  —
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                                      Demais
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0 border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300">RESTO</Badge>
                                    </p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 shrink-0">{fmtBRL(dem.total_frete)}</p>
                                  </div>
                                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-1.5">
                                    <div className="h-1.5 rounded-full" style={{ width: `${pctDem}%`, backgroundColor: '#94a3b8' }} />
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                    <span>{dem.qtde_ctes} CT-es</span>
                                    <span>·</span>
                                    <span>Ticket: {fmtBRL(demTicket)}</span>
                                    <span>·</span>
                                    <span>{pctDem.toFixed(1)}% do total</span>
                                    {dem.qtde_cif > 0 && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">CIF {dem.qtde_cif}</Badge>}
                                    {dem.qtde_fob > 0 && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">FOB {dem.qtde_fob}</Badge>}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div
                              className="px-5 py-3 bg-indigo-50 dark:bg-indigo-950/30 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-950/40 transition-colors"
                              onClick={() => abrirCteDialog('Total', 'periodo', '')}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white bg-indigo-600 shrink-0">
                                  Σ
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                                      Total
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0 border-indigo-300 text-indigo-600 dark:border-indigo-700 dark:text-indigo-300">UNIVERSO</Badge>
                                    </p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 shrink-0">{fmtBRL(totais?.total_frete ?? 0)}</p>
                                  </div>
                                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-1.5">
                                    <div className="h-1.5 rounded-full bg-indigo-600" style={{ width: '100%' }} />
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                    <span>{totais?.qtde_ctes ?? 0} CT-es</span>
                                    <span>·</span>
                                    <span>Ticket: {fmtBRL((totais?.qtde_ctes ?? 0) > 0 ? (totais?.total_frete ?? 0) / (totais?.qtde_ctes ?? 1) : 0)}</span>
                                    <span>·</span>
                                    <span>100% do total</span>
                                    {(totais?.qtde_cif ?? 0) > 0 && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">CIF {totais?.qtde_cif}</Badge>}
                                    {(totais?.qtde_fob ?? 0) > 0 && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">FOB {totais?.qtde_fob}</Badge>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    Distribuição por Cliente
                  </h3>
                  {clientes.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-slate-400 text-sm">Sem dados</div>
                  ) : (() => {
                    const totalGeral = totais?.total_frete ?? 0;
                    const top5 = clientes.slice(0, 5);
                    const totalTop5 = top5.reduce((s, c) => s + c.total_frete, 0);
                    const demais = totalGeral - totalTop5;
                    const pieData = [
                      ...top5.map(c => ({
                        nome: c.nome,
                        label: c.nome.substring(0, 8),
                        value: c.total_frete,
                        tipo: c.is_grupo ? 'grupo' : 'cliente',
                        chave: c.cnpj,
                        is_grupo: !!c.is_grupo,
                      })),
                      ...(demais > 0
                        ? [{
                          nome: 'Demais',
                          label: 'Demais',
                          value: demais,
                          tipo: 'cliente',
                          chave: '__demais__',
                          is_grupo: false,
                        }]
                        : []),
                    ];
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={2}
                            stroke="none"
                            style={{ cursor: 'pointer' }}
                            onClick={(d: any) => {
                              const p = d?.payload ?? d;
                              const nome = String(p?.nome ?? '');
                              if (nome === 'Demais') {
                                const excluirGrupos = top5.filter(c => c.is_grupo).map(c => c.cnpj);
                                const excluirCnpjs = top5.filter(c => !c.is_grupo).map(c => c.cnpj);
                                abrirCteDialog('Demais', 'cliente', '__demais__', '', { excluir_cnpjs: excluirCnpjs, excluir_grupos: excluirGrupos });
                                return;
                              }
                              const tipo = p?.tipo === 'grupo' ? 'grupo' : 'cliente';
                              const chave = String(p?.chave ?? '');
                              abrirCteDialog(nome, tipo, chave);
                            }}
                          >
                            {pieData.map((_, i) => (
                              <Cell key={i} fill={i < PALETTE.length ? PALETTE[i] : '#94a3b8'} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                            formatter={(v: number, _: any, props: any) => [`${props.payload.nome}: ${fmtBRL(v)}`]}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            formatter={(v) => <span style={{ color: textColor, fontSize: 11 }}>{v}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-cyan-500" />
                    Distribuição por Unidade Origem
                  </h3>
                  {unidades.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-slate-400 text-sm">Sem dados</div>
                  ) : (() => {
                    const top5u = unidades.slice(0, 5);
                    const totalTop5u = top5u.reduce((s, u) => s + u.total_frete, 0);
                    const totalGeral = totais?.total_frete ?? 0;
                    const demaisU = totalGeral - totalTop5u;
                    const pieDataU = [
                      ...top5u.map(u => ({ sigla: u.sigla, value: u.total_frete })),
                      ...(demaisU > 0 ? [{ sigla: 'Demais', value: demaisU }] : []),
                    ];
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={pieDataU}
                            dataKey="value"
                            nameKey="sigla"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={2}
                            stroke="none"
                            style={{ cursor: 'pointer' }}
                            onClick={(d: any) => {
                              const p = d?.payload ?? d;
                              const sigla = String(p?.sigla ?? '');
                              if (sigla === 'Demais') {
                                abrirCteDialog('Demais Unidades', 'unidade', '__demais__', '', { excluir_siglas: top5u.map(u => u.sigla) });
                                return;
                              }
                              abrirCteDialog(`Unidade ${sigla}`, 'unidade', sigla);
                            }}
                          >
                            {pieDataU.map((_, i) => (
                              <Cell key={i} fill={i < PALETTE.length ? PALETTE[i] : '#94a3b8'} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                            formatter={(v: number, _: any, props: any) => [`${props.payload.sigla}: ${fmtBRL(v)}`]}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            formatter={(v) => <span style={{ color: textColor, fontSize: 11 }}>{v}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>


              </div>
            </div>

            {evolucao.length > 1 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                  Evolução Mensal do Faturamento
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={evolucao} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="mes_label" tick={{ fill: textColor, fontSize: 11 }} />
                    <YAxis tick={{ fill: textColor, fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <RechartsTooltip
                      contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [fmtBRL(v), 'Faturamento']}
                    />
                    <Area
                      type="monotone"
                      dataKey="total_frete"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fill="url(#gradFat)"
                      dot={{ fill: '#6366f1', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {evolClientes.length > 1 && (() => {
              const totaisPorCnpj: Record<string, number> = {};
              evolClientes.forEach(row => {
                Object.entries(evolClientesKeys).forEach(([cnpj]) => {
                  if (row[cnpj]) totaisPorCnpj[cnpj] = (totaisPorCnpj[cnpj] || 0) + row[cnpj];
                });
              });
              const allKeys = Object.keys(totaisPorCnpj);
              const baseKeys = (() => {
                if (filters.cnpjsPagadores.length > 0 && groupBy === 'clientes') {
                  const inter = filters.cnpjsPagadores.filter(k => allKeys.includes(k));
                  return inter.length > 0 ? inter : allKeys;
                }
                const rankKeys = clientes.map(c => c.cnpj);
                const inter = rankKeys.filter(k => allKeys.includes(k));
                return inter.length > 0 ? inter : allKeys;
              })();

              const top5cnpjs = baseKeys
                .slice()
                .sort((a, b) => (totaisPorCnpj[b] || 0) - (totaisPorCnpj[a] || 0))
                .slice(0, 5);

              const demaisCnpjs = allKeys.filter(c => !top5cnpjs.includes(c));
              const dataComDemais = evolClientes.map(row => {
                const novo: any = { mes: row.mes, mes_label: row.mes_label };
                top5cnpjs.forEach(cnpj => { novo[cnpj] = row[cnpj] ?? null; });
                if (demaisCnpjs.length > 0) {
                  novo['__demais__'] = demaisCnpjs.reduce((s, c) => s + (row[c] ?? 0), 0) || null;
                }
                return novo;
              });
              const linhas = [
                ...top5cnpjs.map((cnpj, i) => ({ key: cnpj, label: evolClientesKeys[cnpj] || cnpj, color: PALETTE[i % PALETTE.length] })),
                ...(demaisCnpjs.length > 0 ? [{ key: '__demais__', label: 'Demais', color: '#94a3b8' }] : []),
              ];
              return (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <div className="mb-4">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-500" />
                      Evolução por Cliente — Últimos 12 Meses
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Independente do período selecionado nos filtros</p>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart
                      data={dataComDemais}
                      margin={{ top: 4, right: 16, left: 0, bottom: 16 }}
                      onClick={(e: any) => {
                        if (!e?.activePayload?.[0]) return;
                        const mes = e.activeLabel;
                        const mesIso = dataComDemais.find(d => d.mes_label === mes)?.mes ?? '';
                        const key = e.activePayload[0].dataKey;
                        const l = linhas.find(l => l.key === key);
                        if (!l) return;
                        if (key === '__demais__') {
                          if (groupBy === 'grupos') {
                            abrirCteDialog(`Demais — ${mes}`, 'cliente', '__demais__', mesIso, { excluir_grupos: top5cnpjs });
                          } else {
                            abrirCteDialog(`Demais — ${mes}`, 'cliente', '__demais__', mesIso, { excluir_cnpjs: top5cnpjs });
                          }
                          return;
                        }
                        if (groupBy === 'grupos') {
                          abrirCteDialog(`${l.label} — ${mes}`, 'grupo', key, mesIso);
                        } else {
                          abrirCteDialog(`${l.label} — ${mes}`, 'cliente', key, mesIso);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="mes_label" tick={{ fill: textColor, fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={45} />
                    <YAxis tick={{ fill: textColor, fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <RechartsTooltip
                      contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number, key: string) => {
                        const l = linhas.find(l => l.key === key);
                        return [fmtBRL(v), l?.label || key];
                      }}
                    />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(v) => {
                          const l = linhas.find(l => l.key === v);
                          const label = l?.label || v;
                          return <span style={{ color: textColor, fontSize: 11 }}>{label.substring(0, 8)}</span>;
                        }}
                      />
                      {linhas.map(({ key, label, color }) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={key}
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{
                          r: 5,
                          cursor: 'pointer',
                          onClick: (_: any, payload: any) => {
                            const mesIso = payload?.payload?.mes ?? '';
                            const mesLabel = payload?.payload?.mes_label ?? mesIso;
                            if (key === '__demais__') {
                              if (groupBy === 'grupos') {
                                abrirCteDialog(`Demais — ${mesLabel}`, 'cliente', '__demais__', mesIso, { excluir_grupos: top5cnpjs });
                              } else {
                                abrirCteDialog(`Demais — ${mesLabel}`, 'cliente', '__demais__', mesIso, { excluir_cnpjs: top5cnpjs });
                              }
                              return;
                            }
                            if (groupBy === 'grupos') {
                              abrirCteDialog(`${label} — ${mesLabel}`, 'grupo', key, mesIso);
                            } else {
                              abrirCteDialog(`${label} — ${mesLabel}`, 'cliente', key, mesIso);
                            }
                          },
                        }}
                        connectNulls
                      />
                    ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}

            {evolUnidades.length > 1 && (() => {
              const totaisPorSigla: Record<string, number> = {};
              evolUnidades.forEach(row => {
                evolUnidadesKeys.forEach(sigla => {
                  if (row[sigla]) totaisPorSigla[sigla] = (totaisPorSigla[sigla] || 0) + row[sigla];
                });
              });
              const top5siglas = Object.entries(totaisPorSigla)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([s]) => s);
              const demaisSiglas = evolUnidadesKeys.filter(s => !top5siglas.includes(s));
              const dataUnidComDemais = evolUnidades.map(row => {
                const novo: any = { mes: row.mes, mes_label: row.mes_label };
                top5siglas.forEach(s => { novo[s] = row[s] ?? null; });
                if (demaisSiglas.length > 0) {
                  novo['__demais__'] = demaisSiglas.reduce((sum, s) => sum + (row[s] ?? 0), 0) || null;
                }
                return novo;
              });
              const linhasU = [
                ...top5siglas.map((s, i) => ({ key: s, label: s, color: PALETTE[i % PALETTE.length] })),
                ...(demaisSiglas.length > 0 ? [{ key: '__demais__', label: 'Demais', color: '#94a3b8' }] : []),
              ];
              return (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <div className="mb-4">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Truck className="w-5 h-5 text-cyan-500" />
                      Evolução por Unidade Origem — Últimos 12 Meses
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Independente do período selecionado nos filtros</p>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart
                      data={dataUnidComDemais}
                      margin={{ top: 4, right: 16, left: 0, bottom: 16 }}
                      onClick={(e: any) => {
                        if (!e?.activePayload?.[0]) return;
                        const mes = e.activeLabel;
                        const mesIso = dataUnidComDemais.find(d => d.mes_label === mes)?.mes ?? '';
                        const key = e.activePayload[0].dataKey;
                        const l = linhasU.find(l => l.key === key);
                        if (!l) return;
                        if (key === '__demais__') {
                          abrirCteDialog(`Demais Unidades — ${mes}`, 'unidade', '__demais__', mesIso, { excluir_siglas: top5siglas });
                          return;
                        }
                        abrirCteDialog(`Unidade ${l.label} — ${mes}`, 'unidade', key, mesIso);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="mes_label" tick={{ fill: textColor, fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={45} />
                    <YAxis tick={{ fill: textColor, fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <RechartsTooltip
                      contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number, key: string) => {
                        const l = linhasU.find(l => l.key === key);
                        return [fmtBRL(v), l?.label || key];
                      }}
                    />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(v) => {
                          const l = linhasU.find(l => l.key === v);
                          return <span style={{ color: textColor, fontSize: 11 }}>{l?.label || v}</span>;
                        }}
                      />
                      {linhasU.map(({ key, label, color }) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={key}
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{
                          r: 5,
                          cursor: 'pointer',
                          onClick: (_: any, payload: any) => {
                            const mesIso = payload?.payload?.mes ?? '';
                            const mesLabel = payload?.payload?.mes_label ?? mesIso;
                            if (key === '__demais__') {
                              abrirCteDialog(`Demais Unidades — ${mesLabel}`, 'unidade', '__demais__', mesIso, { excluir_siglas: top5siglas });
                              return;
                            }
                            abrirCteDialog(`Unidade ${label} — ${mesLabel}`, 'unidade', key, mesIso);
                          },
                        }}
                        connectNulls
                      />
                    ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </>
        )}
      </main>

      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="sm:max-w-[900px] h-[calc(100vh-80px)] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Gerar PDF do Ranking</DialogTitle>
            <DialogDescription>
              O PDF será gerado somente com os clientes do ranking atual (recorte do painel).
              {groupBy === 'grupos' ? ' Em visão por grupo, a logo usada é do CNPJ principal.' : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain pr-1 space-y-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch checked={pdfShowQtdCtes} onCheckedChange={setPdfShowQtdCtes} />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Exibir quantidade de CT-es</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={pdfShowFaturamento} onCheckedChange={setPdfShowFaturamento} />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Exibir faturamento (R$)</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Clientes no PDF ({pdfItems.length})
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {pdfLoading ? 'Lendo logos...' : 'PNG prioritário, depois JPG'}
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pdfItems.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500">Nenhum cliente no ranking.</div>
                ) : (
                  pdfItems.map((it) => (
                    <div key={it.cnpj} className="px-4 py-3 bg-white dark:bg-slate-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {it.rank}
                      </div>
                      <div className="w-[84px] h-[52px] rounded-md border border-slate-200 dark:border-slate-700 bg-white flex items-center justify-center overflow-hidden shrink-0">
                        {it.logo_url ? (
                          <img src={it.logo_url} className="max-w-full max-h-full object-contain" />
                        ) : (
                          <span className="text-[11px] text-slate-400">Sem logo</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {it.nome}
                          </div>
                          {it.is_grupo && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0 border-indigo-300 text-indigo-600 dark:text-indigo-400">
                              Grupo
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          CNPJ/CPF: {it.cnpj}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Input
                          type="file"
                          accept="image/png,image/jpeg"
                          disabled={it.uploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleUploadLogoFromDialog(it.cnpj, f);
                            e.currentTarget.value = '';
                          }}
                          className="w-[210px]"
                        />
                        {it.uploading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-slate-200 dark:border-slate-700 pt-4">
            <Button variant="outline" onClick={() => setPdfDialogOpen(false)} disabled={pdfGenerating}>
              Fechar
            </Button>
            <Button
              onClick={() => void gerarPdfRanking()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
              disabled={pdfGenerating || pdfLoading || pdfItems.length === 0}
            >
              {pdfGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {pdfGenerating ? 'Gerando...' : 'Gerar PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cteDialogOpen} onOpenChange={setCteDialogOpen}>
        <DialogContent className="max-w-5xl h-[85vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <DialogHeader className="shrink-0 pr-20">
            <DialogTitle>{cteDialogTitulo}</DialogTitle>
            <DialogDescription>Lista de CT-es</DialogDescription>
          </DialogHeader>
          {cteDialogLista.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportarCteCSV}
              className="absolute top-4 right-10 gap-1.5 z-10"
            >
              <FileDown className="w-4 h-4" />
              Exportar CSV
            </Button>
          )}

          <div className="grid grid-rows-[minmax(0,1fr)_auto] gap-3 min-h-0 overflow-hidden">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 grid grid-rows-[auto_minmax(0,1fr)] min-h-0 overflow-hidden">
              <div className="grid grid-cols-[110px_85px_minmax(0,1fr)_110px_90px_65px_100px] gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                <span>CT-e</span>
                <span>Emissão</span>
                <span>Destinatário</span>
                <span className="text-right">Vlr. Merc.</span>
                <span className="text-right">Peso</span>
                <span className="text-right">Vol.</span>
                <span className="text-right">Frete</span>
              </div>
              <div className="min-h-0 overflow-y-auto">
                {loadingCtes ? (
                  <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando CT-es...
                  </div>
                ) : cteDialogLista.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-500">
                    <Package className="h-6 w-6" />
                    Nenhum CT-e encontrado.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cteDialogLista.map((cte, idx) => (
                      <div
                          key={idx}
                          className="grid grid-cols-[110px_85px_minmax(0,1fr)_110px_90px_65px_100px] gap-2 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900/50"
                        >
                          <span className="font-mono text-xs self-center text-slate-700 dark:text-slate-300">{cte.ser_cte}{String(cte.nro_cte).padStart(6, '0')}</span>
                          <span className="self-center text-slate-500 dark:text-slate-400">{cte.data_emissao}</span>
                          <span className="truncate self-center text-slate-700 dark:text-slate-300">{cte.nome_dest || cte.nome_pag || '-'}</span>
                          <span className="self-center text-right font-mono text-xs text-slate-600 dark:text-slate-400">{fmtBRL(cte.vlr_merc)}</span>
                          <span className="self-center text-right font-mono text-xs text-slate-600 dark:text-slate-400">{fmtKg(cte.peso_real)}</span>
                          <span className="self-center text-right font-mono text-xs text-slate-600 dark:text-slate-400">{fmtNum(cte.qtde_vol)}</span>
                          <span className="self-center text-right font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300">{fmtBRL(cte.vlr_frete)}</span>
                        </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {cteDialogTotais && (
              <div className="grid grid-cols-[110px_85px_minmax(0,1fr)_110px_90px_65px_100px] gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                <span className="text-slate-500 dark:text-slate-400">{cteDialogLista.length} CT-es</span>
                <span />
                <span />
                <span className="text-right font-mono">{fmtBRL(cteDialogTotais.vlr_merc)}</span>
                <span className="text-right font-mono">{fmtKg(cteDialogTotais.peso_real)}</span>
                <span className="text-right font-mono">{fmtNum(cteDialogTotais.qtde_vol)}</span>
                <span className="text-right font-mono text-indigo-700 dark:text-indigo-300">{fmtBRL(cteDialogTotais.vlr_frete)}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="sm:max-w-[680px] bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-slate-100">Filtros</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Personalize a visualização do faturamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <Label className="text-slate-900 dark:text-slate-100">Período de Emissão</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Início</Label>
                  <Input
                    type="date"
                    value={tempFilters.periodoEmissaoInicio}
                    onChange={e => setTempFilters({ ...tempFilters, periodoEmissaoInicio: e.target.value })}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Fim</Label>
                  <Input
                    type="date"
                    value={tempFilters.periodoEmissaoFim}
                    onChange={e => setTempFilters({ ...tempFilters, periodoEmissaoFim: e.target.value })}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-900 dark:text-slate-100">Tipo de Frete</Label>
              <div className="flex gap-2">
                {[{ v: '', l: 'Todos' }, { v: 'C', l: 'CIF' }, { v: 'F', l: 'FOB' }].map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => setTempFilters({ ...tempFilters, tpFrete: v })}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      tempFilters.tpFrete === v
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-900 dark:text-slate-100">Unidade(s) Origem</Label>
              <FilterSelectUnidadeOrdered
                value={tempFilters.siglaEmit}
                onChange={v => setTempFilters({ ...tempFilters, siglaEmit: v })}
                disabled={userUnit && userUnit !== 'MTZ'} // Desabilita se a unidade do usuário for diferente de MTZ
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-900 dark:text-slate-100">Unidade(s) Destino</Label>
              <FilterSelectUnidadeOrdered
                value={tempFilters.siglaDest}
                onChange={v => setTempFilters({ ...tempFilters, siglaDest: v })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-900 dark:text-slate-100">Clientes Pagadores</Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Por padrão exibe os {tempFilters.topN} maiores. Selecione até 10 clientes específicos.
              </p>
              <div className="space-y-2 pt-1">
                <Label className="text-xs text-slate-500">Tamanho do ranking</Label>
                <div className="flex gap-2">
                  {([
                    { v: 10 as const, l: 'Top 10' },
                    { v: 20 as const, l: 'Top 20' },
                  ]).map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => setTempFilters({ ...tempFilters, topN: v })}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        tempFilters.topN === v
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full justify-between dark:border-slate-600 dark:hover:bg-slate-800"
                onClick={() => {
                  setClienteSearch('');
                  setClientesSelecionados(
                    tempFilters.cnpjsPagadores.map(cnpj => {
                      const found = clienteOpcoes.find(c => c.cnpj === cnpj);
                      return found || { cnpj, nome: cnpj, total_frete: 0 };
                    })
                  );
                  setClienteDialogOpen(true);
                }}
              >
                <span className="text-slate-600 dark:text-slate-300">
                  {tempFilters.cnpjsPagadores.length === 0
                    ? `Top ${tempFilters.topN} automático`
                    : `${tempFilters.cnpjsPagadores.length} cliente(s) selecionado(s)`}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </Button>
              {tempFilters.cnpjsPagadores.length > 0 && (
                <button
                  className="text-xs text-red-500 hover:underline"
                  onClick={() => setTempFilters({ ...tempFilters, cnpjsPagadores: [] })}
                >
                  Limpar seleção (voltar ao top {tempFilters.topN})
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-between gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button variant="outline" onClick={clearFilters} className="dark:border-slate-700 dark:hover:bg-slate-800">
              <X className="w-4 h-4 mr-2" />
              Limpar Tudo
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancelFilters} className="dark:border-slate-700 dark:hover:bg-slate-800">
                Cancelar
              </Button>
              <Button onClick={applyFilters} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Check className="w-4 h-4 mr-2" />
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={clienteDialogOpen} onOpenChange={setClienteDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[80vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-white dark:bg-slate-900">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-slate-900 dark:text-slate-100">Selecionar Clientes</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Selecione até 10 clientes. Ordenados por faturamento no período.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 min-h-0 overflow-hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                value={clienteSearch}
                onChange={e => setClienteSearch(e.target.value)}
                placeholder="Buscar por nome..."
                className="pl-9 dark:bg-slate-800 dark:border-slate-700"
              />
            </div>

            {clientesSelecionados.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {clientesSelecionados.map(c => (
                  <Badge
                    key={c.cnpj}
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30"
                    onClick={() => toggleClienteSelecionado(c)}
                  >
                    {c.nome.split(' ').slice(0, 2).join(' ')}
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-y-auto min-h-0">
              {loadingClientes ? (
                <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Carregando...</span>
                </div>
              ) : clienteOpcoes.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
                  Nenhum cliente encontrado
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {clienteOpcoes.map((c, i) => {
                    const selected = clientesSelecionados.some(x => x.cnpj === c.cnpj);
                    return (
                      <div
                        key={c.cnpj}
                        onClick={() => toggleClienteSelecionado(c)}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                          selected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{c.nome}</p>
                          <p className="text-xs text-slate-400">{fmtBRL(c.total_frete)}</p>
                        </div>
                        {selected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500">{clientesSelecionados.length}/10 selecionados</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setClienteDialogOpen(false)} className="dark:border-slate-700">
                  Cancelar
                </Button>
                <Button size="sm" onClick={confirmarClientes} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
