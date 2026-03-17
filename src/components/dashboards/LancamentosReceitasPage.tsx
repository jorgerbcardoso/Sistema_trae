import { useAuth } from '../../contexts/AuthContext';
import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { PeriodRange } from './PeriodFilter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { BuscadorClientes } from '../cadastros/BuscadorClientes';
import { FilterSelectUnidadeSingle } from '../cadastros/FilterSelectUnidadeSingle';
import {
  getLancamentosReceitas,
  createLancamentoReceita,
  updateLancamentoReceita,
  deleteLancamentoReceita,
  LancamentoReceita,
  LancamentoReceitaFormData
} from '../../services/lancamentosReceitasService';
import { toast } from 'sonner';

interface LancamentosReceitasPageProps {
  period: PeriodRange;
  onBack: () => void;
}

type SortField = keyof LancamentoReceita;
type SortDirection = 'asc' | 'desc';

export function LancamentosReceitasPage({ period, onBack }: LancamentosReceitasPageProps) {
  const { user } = useAuth(); // ✅ Pegar unidade escolhida pelo usuário
  const [lancamentos, setLancamentos] = useState<LancamentoReceita[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Ordenação
  const [sortField, setSortField] = useState<SortField>('data_emissao');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Modal
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<LancamentoReceita | null>(null); // ✅ Registro selecionado
  
  // Form Data
  const [formData, setFormData] = useState<LancamentoReceitaFormData>({
    data_emissao: '',
    sigla_emit: '',
    cnpj_pag: '',
    nome_pag: '',
    peso_real: 0,
    vlr_merc: 0,
    vlr_frete: 0,
    vlr_icms: 0
  });

  // ✅ Verificar se usuário é da MTZ
  const isUnidadeMTZ = user?.unidade_atual === 'MTZ';
  const unidadeAtual = user?.unidade_atual || '';

  // Carregar dados ao montar
  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const startDate = `${period.startYear}-${String(period.startMonth).padStart(2, '0')}-01`;
      const endYear = period.endMonth === 12 ? period.endYear + 1 : period.endYear;
      const endMonth = period.endMonth === 12 ? 1 : period.endMonth + 1;
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

      const response = await getLancamentosReceitas(startDate, endDate);
      setLancamentos(response.lancamentos);
    } catch (error) {
      console.error('Erro ao carregar lançamentos:', error);
      toast.error('Erro ao carregar lançamentos');
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setFormData({
      data_emissao: new Date().toISOString().split('T')[0],
      sigla_emit: unidadeAtual, // ✅ Preencher com unidade escolhida
      cnpj_pag: '',
      nome_pag: '',
      peso_real: 0,
      vlr_merc: 0,
      vlr_frete: 0,
      vlr_icms: 0
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = (lancamento: LancamentoReceita) => {
    setFormData({
      nro_cte: lancamento.nro_cte,
      ser_cte: lancamento.ser_cte,
      data_emissao: lancamento.data_emissao,
      sigla_emit: lancamento.sigla_emit,
      cnpj_pag: lancamento.cnpj_pag,
      nome_pag: lancamento.nome_pag,
      peso_real: lancamento.peso_real,
      vlr_merc: lancamento.vlr_merc,
      vlr_frete: lancamento.vlr_frete,
      vlr_icms: lancamento.vlr_icms
    });
    setIsEditing(true);
    setShowModal(true);
    setSelectedRecord(lancamento); // ✅ Selecionar registro para edição
  };

  const handleSave = async () => {
    // Validações
    if (!formData.data_emissao) {
      toast.error('Data de emissão é obrigatória');
      return;
    }
    if (!formData.cnpj_pag) {
      toast.error('Cliente é obrigatório');
      return;
    }
    if (!formData.sigla_emit) {
      toast.error('Unidade é obrigatória');
      return;
    }
    if (!formData.vlr_merc || formData.vlr_merc <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }

    console.log('🚀 [handleSave] Enviando dados:', formData);
    console.log('🚀 [handleSave] Modo edição:', isEditing);

    setSaving(true);
    try {
      if (isEditing) {
        await updateLancamentoReceita(formData);
      } else {
        await createLancamentoReceita(formData);
      }
      
      toast.success(isEditing ? 'Lançamento atualizado com sucesso!' : 'Lançamento criado com sucesso!');
      setShowModal(false);
      await loadData();
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lancamento: LancamentoReceita) => {
    if (!confirm('Deseja realmente excluir este lançamento?')) return;

    try {
      await deleteLancamentoReceita(lancamento.nro_cte, lancamento.ser_cte);
      toast.success('Lançamento excluído com sucesso!');
      await loadData();
    } catch (error) {
      console.error('Erro ao excluir:', error);
    }
  };

  // Formatar valores monetários
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Formatar número
  const formatNumber = (value: number, decimals: number = 0) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  };

  // Ordenação
  const sortLancamentos = (list: LancamentoReceita[], field: SortField, direction: SortDirection): LancamentoReceita[] => {
    return [...list].sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      } else {
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        return 0;
      }
    });
  };

  const toggleSortDirection = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const lancamentosSorted = sortLancamentos(lancamentos, sortField, sortDirection);

  // Calcular totalizadores
  const totals = lancamentosSorted.length > 0 ? {
    peso_real: lancamentosSorted.reduce((sum, l) => sum + l.peso_real, 0),
    vlr_merc: lancamentosSorted.reduce((sum, l) => sum + l.vlr_merc, 0),
    vlr_frete: lancamentosSorted.reduce((sum, l) => sum + l.vlr_frete, 0),
    vlr_icms: lancamentosSorted.reduce((sum, l) => sum + l.vlr_icms, 0),
  } : null;

  // Paginação
  const ITEMS_PER_PAGE = 50;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(lancamentosSorted.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentItems = lancamentosSorted.slice(startIndex, endIndex);

  // Componente para cabeçalho de coluna ordenável
  const SortableHeader = ({ field, children, align = 'left' }: { field: SortField; children: React.ReactNode; align?: 'left' | 'right' }) => (
    <th 
      className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'} text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors`}
      onClick={() => toggleSortDirection(field)}
    >
      <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
        )}
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* ✅ BOTÃO VOLTAR À ESQUERDA */}
          <Button variant="outline" onClick={onBack} className="dark:border-slate-700 dark:hover:bg-slate-700">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            {/* ✅ FONTE IGUAL "Receitas Operacionais" - h2 sem classes de tamanho */}
            <h2 className="text-slate-900 dark:text-slate-100 mb-1">Lançamentos Manuais de Receitas</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Período: {period.startMonth}/{period.startYear} a {period.endMonth}/{period.endYear}
            </p>
          </div>
        </div>
        <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Novo Lançamento
        </Button>
      </div>

      {/* ✅ TABELA COM ESTILO DO CONTROLE DE TRANSBORDOS */}
      <div className="max-w-[1600px] mx-auto">
        <Card className="dark:bg-slate-900/90 dark:border-slate-700">
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
              </div>
            ) : lancamentos.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                Nenhum lançamento encontrado para o período selecionado.
              </div>
            ) : (
              <>
                {/* Tabela com altura máxima fixa */}
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="overflow-x-auto overflow-y-auto max-h-[600px]" style={{ scrollbarWidth: 'thin' }}>
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                      <thead className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800 sticky top-0 z-10">
                        <tr className="border-b-2 border-slate-300 dark:border-slate-600">
                          {/* ✅ COLUNA ÚNICA CT-e (SER + NRO) */}
                          <SortableHeader field="cte">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              CT-e
                            </span>
                          </SortableHeader>
                          <SortableHeader field="data_emissao">Data Emissão</SortableHeader>
                          <SortableHeader field="nome_pag">Cliente</SortableHeader>
                          <SortableHeader field="sigla_emit">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              Unidade
                            </span>
                          </SortableHeader>
                          <SortableHeader field="peso_real" align="right">Peso (kg)</SortableHeader>
                          <SortableHeader field="vlr_merc" align="right">Valor Merc.</SortableHeader>
                          <SortableHeader field="vlr_frete" align="right">Valor Frete</SortableHeader>
                          <SortableHeader field="vlr_icms" align="right">ICMS</SortableHeader>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-900/50 divide-y divide-slate-100 dark:divide-slate-700/50">
                        {currentItems.map((lancamento, index) => (
                          <tr 
                            key={`${lancamento.nro_cte}-${lancamento.ser_cte}`}
                            className={`
                              hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all duration-150
                              ${index % 2 === 0 ? 'bg-slate-50/30 dark:bg-slate-800/20' : 'bg-white dark:bg-slate-900/30'}
                            `}
                          >
                            {/* ✅ CT-e FORMATADO: SER + NRO com 6 dígitos */}
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-700 dark:text-blue-400">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                {lancamento.cte}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                              {new Date(lancamento.data_emissao).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                              {lancamento.nome_pag}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-emerald-700 dark:text-emerald-400">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                {lancamento.sigla_emit}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-700 dark:text-slate-300 font-medium">
                              {formatNumber(lancamento.peso_real, 2)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-700 dark:text-slate-300">
                              {formatCurrency(lancamento.vlr_merc)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-700 dark:text-slate-300">
                              {formatCurrency(lancamento.vlr_frete)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-700 dark:text-slate-300">
                              {formatCurrency(lancamento.vlr_icms)}
                            </td>
                            {/* ✅ AÇÕES: 2 ÍCONES (EDITAR + EXCLUIR) */}
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(lancamento)}
                                  className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                >
                                  <Pencil className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(lancamento)}
                                  className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        
                        {/* ✅ LINHA DE TOTALIZADORES */}
                        {totals && (
                          <tr className="bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900 dark:to-blue-800 font-bold border-t-2 border-blue-400 dark:border-blue-600 sticky bottom-0">
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100" colSpan={4}>
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                                TOTAIS
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-900 dark:text-blue-200">
                              {formatNumber(totals.peso_real, 2)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-900 dark:text-blue-200">
                              {formatCurrency(totals.vlr_merc)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-900 dark:text-blue-200">
                              {formatCurrency(totals.vlr_frete)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-900 dark:text-blue-200 font-extrabold">
                              {formatCurrency(totals.vlr_icms)}
                            </td>
                            <td className="px-4 py-4"></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <span>Página {currentPage} de {totalPages}</span>
                      <span className="text-slate-400 dark:text-slate-500">•</span>
                      <span>Mostrando {startIndex + 1} - {Math.min(endIndex, lancamentos.length)} de {lancamentos.length}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="dark:border-slate-700 dark:hover:bg-slate-700"
                      >
                        Primeira
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="dark:border-slate-700 dark:hover:bg-slate-700"
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="dark:border-slate-700 dark:hover:bg-slate-700"
                      >
                        Próxima
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="dark:border-slate-700 dark:hover:bg-slate-700"
                      >
                        Última
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Cadastro/Edição */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? `Editar Lançamento - CT-e: ${selectedRecord?.cte}` : 'Novo Lançamento'}
            </DialogTitle>
            <DialogDescription>
              Preencha os campos abaixo para {isEditing ? 'editar' : 'criar'} um lançamento de receita.
            </DialogDescription>
          </DialogHeader>

          {/* ✅ EXIBIR INFORMAÇÕES DE AUDITORIA quando estiver editando */}
          {isEditing && selectedRecord && (
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 mb-4 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Informações de Registro</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-500">Data Inclusão</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300">
                    {selectedRecord.data_inclusao ? new Date(selectedRecord.data_inclusao).toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-500">Hora Inclusão</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300">
                    {selectedRecord.hora_inclusao || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-500">Usuário</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300">
                    {selectedRecord.login_inclusao || '-'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Data Emissão */}
            <div>
              <Label>Data Emissão *</Label>
              <Input
                type="date"
                value={formData.data_emissao}
                onChange={(e) => setFormData({ ...formData, data_emissao: e.target.value })}
              />
            </div>

            {/* Unidade */}
            <div>
              <Label>Unidade *</Label>
              {/* ✅ SE MTZ: select livre | SE NÃO-MTZ: campo bloqueado */}
              {isUnidadeMTZ ? (
                <FilterSelectUnidadeSingle
                  value={formData.sigla_emit}
                  onChange={(value) => setFormData({ ...formData, sigla_emit: value })}
                />
              ) : (
                <Input
                  value={formData.sigla_emit}
                  disabled
                  className="bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
                  title="Unidade bloqueada - você só pode lançar receitas na sua unidade"
                />
              )}
            </div>

            {/* Cliente */}
            <div className="col-span-2">
              <Label>Cliente *</Label>
              <div className="relative">
                <BuscadorClientes
                  onSelect={(cliente) => setFormData({
                    ...formData,
                    cnpj_pag: cliente.cnpj,
                    nome_pag: cliente.nome
                  })}
                  selectedNome={formData.nome_pag}
                />
              </div>
            </div>

            {/* Peso Real */}
            <div>
              <Label>Peso Real (kg)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.peso_real || ''}
                onChange={(e) => setFormData({ ...formData, peso_real: parseFloat(e.target.value) || 0 })}
              />
            </div>

            {/* Valor Mercadoria */}
            <div>
              <Label>Valor da Mercadoria *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.vlr_merc || ''}
                onChange={(e) => setFormData({ ...formData, vlr_merc: parseFloat(e.target.value) || 0 })}
              />
            </div>

            {/* Valor Frete */}
            <div>
              <Label>Valor do Frete</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.vlr_frete || ''}
                onChange={(e) => setFormData({ ...formData, vlr_frete: parseFloat(e.target.value) || 0 })}
              />
            </div>

            {/* Valor ICMS */}
            <div>
              <Label>Valor do ICMS</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.vlr_icms || ''}
                onChange={(e) => setFormData({ ...formData, vlr_icms: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Atualizar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}