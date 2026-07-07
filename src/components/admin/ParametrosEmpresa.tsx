import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '../layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { toast } from 'sonner';
import { apiFetch } from '../../utils/apiUtils';
import { ENVIRONMENT } from '../../config/environment';
import { Check, ChevronsUpDown, Loader2, Search, X } from 'lucide-react';
import { cn } from '../ui/utils';

type Ocorrencia = {
  codigo: number;
  descricao: string;
  tipo: string;
};

type EmpParam = {
  ocor_aguardando_agendamento: number | null;
  ocor_agendamento: number | null;
  ocor_chegada_unid_dest: number | null;
  ocor_cte_retido: number | null;
};

type FieldKey = keyof EmpParam;

function formatOcorCodigo(codigo: number) {
  return String(codigo).padStart(2, '0');
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

function OcorrenciaPicker({
  field,
  label,
  placeholder,
  open,
  setOpen,
  searchValue,
  setSearchValue,
  list,
  isLoadingList,
  selectedCode,
  selectedLabel,
  onSelect,
  onClear,
}: {
  field: FieldKey;
  label: string;
  placeholder: string;
  open: boolean;
  setOpen: (field: FieldKey, open: boolean) => void;
  searchValue: string;
  setSearchValue: (field: FieldKey, value: string) => void;
  list: Ocorrencia[];
  isLoadingList: boolean;
  selectedCode: number | null;
  selectedLabel: string;
  onSelect: (field: FieldKey, codigo: number) => void;
  onClear: (field: FieldKey) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Popover
          open={open}
          onOpenChange={(v) => {
            setOpen(field, v);
            if (v) {
              window.setTimeout(() => inputRef.current?.focus(), 0);
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="flex-1 min-w-0 justify-between">
              <span className="truncate">{selectedLabel}</span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  ref={inputRef}
                  value={searchValue}
                  onChange={(e) => setSearchValue(field, e.target.value)}
                  placeholder={placeholder}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {isLoadingList ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando...
                </div>
              ) : list.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500">Nenhuma ocorrência encontrada.</div>
              ) : (
                <div className="p-1">
                  {list.map((o) => {
                    const isSelected = selectedCode === o.codigo;
                    const title = `${formatOcorCodigo(o.codigo)}. ${o.descricao}`;
                    return (
                      <button
                        key={o.codigo}
                        type="button"
                        className={cn(
                          'w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800',
                          isSelected ? 'bg-slate-100 dark:bg-slate-800' : ''
                        )}
                        onClick={() => {
                          onSelect(field, o.codigo);
                          setOpen(field, false);
                        }}
                      >
                        <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                        <div className="min-w-0">
                          <div className="truncate">{title}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={selectedCode == null}
          onClick={() => onClear(field)}
          title="Limpar seleção"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ParametrosEmpresa() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [params, setParams] = useState<EmpParam>({
    ocor_aguardando_agendamento: null,
    ocor_agendamento: null,
    ocor_chegada_unid_dest: null,
    ocor_cte_retido: null,
  });

  const [ocorrenciasOpen, setOcorrenciasOpen] = useState<Record<FieldKey, boolean>>({
    ocor_aguardando_agendamento: false,
    ocor_agendamento: false,
    ocor_chegada_unid_dest: false,
    ocor_cte_retido: false,
  });

  const [searchTerm, setSearchTerm] = useState<Record<FieldKey, string>>({
    ocor_aguardando_agendamento: '',
    ocor_agendamento: '',
    ocor_chegada_unid_dest: '',
    ocor_cte_retido: '',
  });

  const debouncedSearch = {
    ocor_aguardando_agendamento: useDebouncedValue(searchTerm.ocor_aguardando_agendamento, 250),
    ocor_agendamento: useDebouncedValue(searchTerm.ocor_agendamento, 250),
    ocor_chegada_unid_dest: useDebouncedValue(searchTerm.ocor_chegada_unid_dest, 250),
    ocor_cte_retido: useDebouncedValue(searchTerm.ocor_cte_retido, 250),
  };

  const [loadingOcor, setLoadingOcor] = useState<Record<FieldKey, boolean>>({
    ocor_aguardando_agendamento: false,
    ocor_agendamento: false,
    ocor_chegada_unid_dest: false,
    ocor_cte_retido: false,
  });

  const [ocorrencias, setOcorrencias] = useState<Record<FieldKey, Ocorrencia[]>>({
    ocor_aguardando_agendamento: [],
    ocor_agendamento: [],
    ocor_chegada_unid_dest: [],
    ocor_cte_retido: [],
  });

  const occurrenceMap = useMemo(() => {
    const map = new Map<number, Ocorrencia>();
    Object.values(ocorrencias).forEach((list) => list.forEach((o) => map.set(o.codigo, o)));
    return map;
  }, [ocorrencias]);

  const loadParams = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/admin/empresa_parametros.php`, { method: 'GET' }, true);
      if (!response.success) {
        toast.error(response.message || 'Erro ao carregar parâmetros');
        return;
      }
      setParams(response.params as EmpParam);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar parâmetros');
    } finally {
      setLoading(false);
    }
  };

  const loadOcorrencias = async (field: FieldKey, q: string) => {
    try {
      setLoadingOcor((prev) => ({ ...prev, [field]: true }));
      const url = `${ENVIRONMENT.apiBaseUrl}/admin/empresa_parametros.php?action=ocorrencias&search=${encodeURIComponent(q)}&limit=80`;
      const response = await apiFetch(url, { method: 'GET' }, true);
      if (!response.success) {
        toast.error(response.message || 'Erro ao buscar ocorrências');
        setOcorrencias((prev) => ({ ...prev, [field]: [] }));
        return;
      }
      setOcorrencias((prev) => ({ ...prev, [field]: (response.ocorrencias || []) as Ocorrencia[] }));
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao buscar ocorrências');
      setOcorrencias((prev) => ({ ...prev, [field]: [] }));
    } finally {
      setLoadingOcor((prev) => ({ ...prev, [field]: false }));
    }
  };

  useEffect(() => {
    loadParams();
  }, []);

  useEffect(() => {
    const fields: FieldKey[] = ['ocor_aguardando_agendamento', 'ocor_agendamento', 'ocor_chegada_unid_dest', 'ocor_cte_retido'];
    fields.forEach((field) => {
      if (ocorrenciasOpen[field]) {
        loadOcorrencias(field, debouncedSearch[field]);
      }
    });
  }, [ocorrenciasOpen, debouncedSearch.ocor_aguardando_agendamento, debouncedSearch.ocor_agendamento, debouncedSearch.ocor_chegada_unid_dest, debouncedSearch.ocor_cte_retido]);

  const save = async () => {
    try {
      setSaving(true);
      const response = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/admin/empresa_parametros.php`,
        {
          method: 'POST',
          body: JSON.stringify(params),
        },
        true
      );
      if (!response.success) {
        toast.error(response.message || 'Erro ao salvar parâmetros');
        return;
      }
      toast.success('Parâmetros atualizados');
      await loadParams();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao salvar parâmetros');
    } finally {
      setSaving(false);
    }
  };

  const setOpen = (field: FieldKey, open: boolean) => setOcorrenciasOpen((prev) => ({ ...prev, [field]: open }));
  const setSearchValue = (field: FieldKey, value: string) => setSearchTerm((prev) => ({ ...prev, [field]: value }));
  const handleSelect = (field: FieldKey, codigo: number) => setParams((prev) => ({ ...prev, [field]: codigo }));
  const handleClear = (field: FieldKey) => setParams((prev) => ({ ...prev, [field]: null }));

  return (
    <AdminLayout title="PARÂMETROS DA EMPRESA" description="CONFIGURAÇÕES GERAIS DA TRANSPORTADORA">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Ocorrências</CardTitle>
            <CardDescription>Defina os códigos de ocorrência usados pelos painéis de agendamento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <OcorrenciaPicker
              field="ocor_aguardando_agendamento"
              label="Aguardando agendamento"
              placeholder="Busque por código ou descrição..."
              open={ocorrenciasOpen.ocor_aguardando_agendamento}
              setOpen={setOpen}
              searchValue={searchTerm.ocor_aguardando_agendamento}
              setSearchValue={setSearchValue}
              list={ocorrencias.ocor_aguardando_agendamento}
              isLoadingList={loadingOcor.ocor_aguardando_agendamento}
              selectedCode={params.ocor_aguardando_agendamento}
              selectedLabel={
                params.ocor_aguardando_agendamento != null
                  ? `${formatOcorCodigo(params.ocor_aguardando_agendamento)}. ${occurrenceMap.get(params.ocor_aguardando_agendamento)?.descricao ?? ''}`.trim()
                  : 'Selecionar ocorrência'
              }
              onSelect={handleSelect}
              onClear={handleClear}
            />
            <OcorrenciaPicker
              field="ocor_agendamento"
              label="Entrega agendada"
              placeholder="Busque por código ou descrição..."
              open={ocorrenciasOpen.ocor_agendamento}
              setOpen={setOpen}
              searchValue={searchTerm.ocor_agendamento}
              setSearchValue={setSearchValue}
              list={ocorrencias.ocor_agendamento}
              isLoadingList={loadingOcor.ocor_agendamento}
              selectedCode={params.ocor_agendamento}
              selectedLabel={
                params.ocor_agendamento != null
                  ? `${formatOcorCodigo(params.ocor_agendamento)}. ${occurrenceMap.get(params.ocor_agendamento)?.descricao ?? ''}`.trim()
                  : 'Selecionar ocorrência'
              }
              onSelect={handleSelect}
              onClear={handleClear}
            />
            <OcorrenciaPicker
              field="ocor_chegada_unid_dest"
              label="Chegada na unidade destino"
              placeholder="Busque por código ou descrição..."
              open={ocorrenciasOpen.ocor_chegada_unid_dest}
              setOpen={setOpen}
              searchValue={searchTerm.ocor_chegada_unid_dest}
              setSearchValue={setSearchValue}
              list={ocorrencias.ocor_chegada_unid_dest}
              isLoadingList={loadingOcor.ocor_chegada_unid_dest}
              selectedCode={params.ocor_chegada_unid_dest}
              selectedLabel={
                params.ocor_chegada_unid_dest != null
                  ? `${formatOcorCodigo(params.ocor_chegada_unid_dest)}. ${occurrenceMap.get(params.ocor_chegada_unid_dest)?.descricao ?? ''}`.trim()
                  : 'Selecionar ocorrência'
              }
              onSelect={handleSelect}
              onClear={handleClear}
            />
            <OcorrenciaPicker
              field="ocor_cte_retido"
              label="CT-e Retido"
              placeholder="Busque por código ou descrição..."
              open={ocorrenciasOpen.ocor_cte_retido}
              setOpen={setOpen}
              searchValue={searchTerm.ocor_cte_retido}
              setSearchValue={setSearchValue}
              list={ocorrencias.ocor_cte_retido}
              isLoadingList={loadingOcor.ocor_cte_retido}
              selectedCode={params.ocor_cte_retido}
              selectedLabel={
                params.ocor_cte_retido != null
                  ? `${formatOcorCodigo(params.ocor_cte_retido)}. ${occurrenceMap.get(params.ocor_cte_retido)?.descricao ?? ''}`.trim()
                  : 'Selecionar ocorrência'
              }
              onSelect={handleSelect}
              onClear={handleClear}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" disabled={loading || saving} onClick={loadParams}>
                Recarregar
              </Button>
              <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading || saving} onClick={save}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando parâmetros...
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
