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

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
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

  const FieldPicker = ({
    field,
    label,
    placeholder,
  }: {
    field: FieldKey;
    label: string;
    placeholder: string;
  }) => {
    const selectedCode = params[field];
    const selected = selectedCode != null ? occurrenceMap.get(selectedCode) : undefined;
    const open = ocorrenciasOpen[field];
    const list = ocorrencias[field];
    const isLoadingList = loadingOcor[field];
    const inputRef = useRef<HTMLInputElement | null>(null);

    const buttonLabel = selected
      ? `${selected.codigo} — ${selected.descricao}`
      : selectedCode != null
        ? `${selectedCode}`
        : 'Selecionar ocorrência';

    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          <Popover
            open={open}
            onOpenChange={(v) => {
              setOcorrenciasOpen((prev) => ({ ...prev, [field]: v }));
              if (v) {
                window.setTimeout(() => inputRef.current?.focus(), 0);
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
                <span className="truncate">{buttonLabel}</span>
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    ref={inputRef}
                    value={searchTerm[field]}
                    onChange={(e) => setSearchTerm((prev) => ({ ...prev, [field]: e.target.value }))}
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
                      const title = `${o.codigo} — ${o.descricao}`;
                      return (
                        <button
                          key={o.codigo}
                          type="button"
                          className={cn(
                            'w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800',
                            isSelected ? 'bg-slate-100 dark:bg-slate-800' : ''
                          )}
                          onClick={() => {
                            setParams((prev) => ({ ...prev, [field]: o.codigo }));
                            setOcorrenciasOpen((prev) => ({ ...prev, [field]: false }));
                          }}
                        >
                          <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                          <div className="min-w-0">
                            <div className="truncate">{title}</div>
                            {o.tipo ? <div className="text-xs text-slate-500 truncate">{o.tipo}</div> : null}
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
            disabled={params[field] == null}
            onClick={() => setParams((prev) => ({ ...prev, [field]: null }))}
            title="Limpar seleção"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout title="PARÂMETROS DA EMPRESA" description="CONFIGURAÇÕES GERAIS DA TRANSPORTADORA">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Ocorrências</CardTitle>
            <CardDescription>Defina os códigos de ocorrência usados pelos painéis de agendamento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FieldPicker
              field="ocor_aguardando_agendamento"
              label="Aguardando agendamento"
              placeholder="Busque por código ou descrição..."
            />
            <FieldPicker
              field="ocor_agendamento"
              label="Entrega agendada"
              placeholder="Busque por código ou descrição..."
            />
            <FieldPicker
              field="ocor_chegada_unid_dest"
              label="Chegada na unidade destino"
              placeholder="Busque por código ou descrição..."
            />
            <FieldPicker field="ocor_cte_retido" label="CT-e Retido" placeholder="Busque por código ou descrição..." />

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
