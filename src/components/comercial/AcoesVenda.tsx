import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Search, X, RefreshCw, Target } from 'lucide-react';
import { AdminLayout } from '../layouts/AdminLayout';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { SortableTableHeader, useSortableTable } from '../table/SortableTableHeader';
import { useConfirmDialog } from '../ui/alert-dialog';

/**
 * ================================================================
 * COMERCIAL - CADASTRO DE AÇÕES DE VENDA
 * ================================================================
 * - Cadastro/manutenção das ações de venda (tabela [dominio]_acao_venda)
 * - Cada ação possui: código, descrição e status
 * - O status é o mesmo do funil do vínculo vendedor x cliente
 * - No futuro, aplicar uma ação em um cliente mudará o status dele
 * ================================================================
 */

const API = `${ENVIRONMENT.apiBaseUrl}/comercial/acoes_venda.php`;

type StatusCodigo = 'C' | 'D' | 'P' | 'N' | 'R';

const STATUS_LIST: { value: StatusCodigo; label: string; badge: string }[] = [
  {
    value: 'D',
    label: 'CADASTRADO',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  {
    value: 'P',
    label: 'EM PROSPECÇÃO',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  {
    value: 'N',
    label: 'EM NEGOCIAÇÃO',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  },
  {
    value: 'C',
    label: 'CONQUISTA',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  {
    value: 'R',
    label: 'RECONQUISTA',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  },
];

const STATUS_MAP: Record<string, { label: string; badge: string }> = STATUS_LIST.reduce(
  (acc, s) => {
    acc[s.value] = { label: s.label, badge: s.badge };
    return acc;
  },
  {} as Record<string, { label: string; badge: string }>
);

interface AcaoVenda {
  codigo: number;
  descricao: string;
  status: string;
  status_label: string;
}

type AcaoSortField = 'codigo' | 'descricao' | 'status';

export function AcoesVenda() {
  const { user } = useAuth();
  usePageTitle('Ações de Venda');
  const { confirm: confirmar, dialog: confirmarDialog } = useConfirmDialog();

  const [loading, setLoading] = useState(true);
  const [acoes, setAcoes] = useState<AcaoVenda[]>([]);
  const [busca, setBusca] = useState('');

  // ============ CADASTRO (DIALOG) ============
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<AcaoVenda | null>(null);
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState<StatusCodigo>('D');
  const [salvando, setSalvando] = useState(false);

  const acaoSort = useSortableTable<AcaoSortField>('codigo', 'asc');

  // ============ CARREGAMENTO ============
  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await apiFetch(API);
      if (resp?.success) {
        setAcoes(resp.acoes || []);
      } else {
        setAcoes([]);
      }
    } catch (e) {
      console.error('Erro ao carregar ações de venda:', e);
      setAcoes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar, user?.domain]);

  const acoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return acoes;
    return acoes.filter(
      (a) =>
        a.descricao.toLowerCase().includes(termo) ||
        String(a.codigo).includes(termo) ||
        (STATUS_MAP[a.status]?.label ?? '').toLowerCase().includes(termo)
    );
  }, [acoes, busca]);

  const acoesOrdenadas = useMemo(() => acaoSort.sortData(acoesFiltradas), [acoesFiltradas, acaoSort]);

  // ============ AÇÕES ============
  const abrirNova = () => {
    setEditando(null);
    setDescricao('');
    setStatus('D');
    setDialogOpen(true);
  };

  const abrirEdicao = (acao: AcaoVenda) => {
    setEditando(acao);
    setDescricao(acao.descricao);
    setStatus((acao.status as StatusCodigo) || 'D');
    setDialogOpen(true);
  };

  const salvar = async () => {
    const descricaoLimpa = descricao.trim();
    if (!descricaoLimpa) {
      toast.error('Informe a descrição da ação de venda');
      return;
    }

    setSalvando(true);
    try {
      const resp = await apiFetch(API, {
        method: 'POST',
        body: JSON.stringify({
          action: editando ? 'atualizar' : 'criar',
          codigo: editando?.codigo,
          descricao: descricaoLimpa,
          status,
        }),
      });

      if (!resp?.success) return;

      setDialogOpen(false);
      await carregar();
    } catch (e) {
      console.error('Erro ao salvar ação de venda:', e);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (acao: AcaoVenda) => {
    const ok = await confirmar({
      title: 'Excluir ação de venda',
      description: `Confirma a exclusão da ação "${acao.descricao}"? Esta operação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const resp = await apiFetch(API, {
        method: 'POST',
        body: JSON.stringify({ action: 'excluir', codigo: acao.codigo }),
      });
      if (!resp?.success) return;
      await carregar();
    } catch (e) {
      console.error('Erro ao excluir ação de venda:', e);
    }
  };

  return (
    <AdminLayout title="AÇÕES DE VENDA">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4 gap-4">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Target className="size-4 text-primary" />
              Ações de venda
            </CardTitle>
            <CardDescription>
              Cada ação possui um código, uma descrição e um status. Ao aplicar uma ação em um
              cliente, o status dele passa a ser o status da ação.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
              <RefreshCw className={`size-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Recarregar
            </Button>
            <Button size="sm" onClick={abrirNova}>
              <Plus className="size-4 mr-1.5" />
              Nova ação
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-3 relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código, descrição ou status..."
              className="h-8 pl-8 pr-8 text-xs"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="rounded-md border border-border overflow-hidden [&>div]:overflow-x-hidden">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <SortableTableHeader
                    field="codigo"
                    label="Código"
                    currentSortField={acaoSort.sortField}
                    currentSortDirection={acaoSort.sortDirection}
                    onSort={acaoSort.handleSort}
                    className="w-[12%] !px-3 !py-2 text-[11px] leading-tight"
                  />
                  <SortableTableHeader
                    field="descricao"
                    label="Descrição"
                    currentSortField={acaoSort.sortField}
                    currentSortDirection={acaoSort.sortDirection}
                    onSort={acaoSort.handleSort}
                    className="w-[58%] !px-3 !py-2 text-[11px] leading-tight"
                  />
                  <SortableTableHeader
                    field="status"
                    label="Status"
                    currentSortField={acaoSort.sortField}
                    currentSortDirection={acaoSort.sortDirection}
                    onSort={acaoSort.handleSort}
                    className="w-[20%] !px-3 !py-2 text-[11px] leading-tight"
                  />
                  <TableHead className="w-[10%] !px-3 !py-2 text-[11px] leading-tight text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500 py-10">
                      <Loader2 className="size-4 animate-spin inline mr-2" />
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : acoesOrdenadas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500 py-10">
                      {busca
                        ? 'Nenhuma ação de venda encontrada para essa busca.'
                        : 'Nenhuma ação de venda cadastrada.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  acoesOrdenadas.map((acao) => {
                    const info = STATUS_MAP[acao.status];
                    return (
                      <TableRow key={acao.codigo} className="hover:bg-muted/50">
                        <TableCell className="!py-2 font-mono text-xs tabular-nums">
                          {acao.codigo}
                        </TableCell>
                        <TableCell className="!py-2 text-xs font-medium truncate" title={acao.descricao}>
                          {acao.descricao}
                        </TableCell>
                        <TableCell className="!py-2">
                          {info ? (
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-5 px-2 font-medium border-0 ${info.badge}`}
                            >
                              {info.label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="!py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => abrirEdicao(acao)}
                              title="Editar"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={() => excluir(acao)}
                              title="Excluir"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ============ DIALOG: CADASTRO/EDIÇÃO ============ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar ação de venda' : 'Nova ação de venda'}</DialogTitle>
            <DialogDescription>
              {editando
                ? `Editando a ação #${editando.codigo}`
                : 'Informe a descrição e o status da nova ação de venda.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="av-descricao" className="text-xs">
                Descrição
              </Label>
              <Input
                id="av-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                maxLength={150}
                placeholder="Ex.: VISITA DE ACOMPANHAMENTO"
                className="h-9"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusCodigo)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_LIST.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-5 px-2 font-medium border-0 ${s.badge}`}
                        >
                          {s.value}
                        </Badge>
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmarDialog}
    </AdminLayout>
  );
}
