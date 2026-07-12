import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Image as ImageIcon, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { AdminLayout } from '../layouts/AdminLayout';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from 'sonner';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { Cliente, deleteClienteLogo, listClientes, normalizeDocumento, upsertCliente, uploadClienteLogo } from '../../services/clientesService';

const onlyDigits = (v: string) => (v ?? '').replace(/\D/g, '');

const formatCPF = (digits: string) => {
  const d = onlyDigits(digits).padStart(11, '0').slice(-11);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
};

const formatCNPJ = (digits: string) => {
  const d = onlyDigits(digits).padStart(14, '0').slice(-14);
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
};

const formatDocumento = (digits: string) => {
  const d = onlyDigits(digits);
  if (d.length === 11) return { tipo: 'CPF', formatado: formatCPF(d) };
  return { tipo: 'CNPJ', formatado: formatCNPJ(d) };
};

const formatDateBR = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const logoUrlAbs = (url: string) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${window.location.origin}${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
};

export function CadastroClientes() {
  usePageTitle('Cadastro de Clientes');

  const [isLoading, setIsLoading] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Cliente | null>(null);

  const [form, setForm] = useState({
    cnpj: '',
    nome: '',
    seq_cidade: null as number | null,
    agenda: false,
    email: '',
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoRemoving, setLogoRemoving] = useState(false);

  const [cidadeSearch, setCidadeSearch] = useState('');
  const [cidades, setCidades] = useState<Array<{ seq_cidade: number; nome: string; uf: string; label: string }>>([]);
  const [showCidadeDropdown, setShowCidadeDropdown] = useState(false);
  const [selectedCidade, setSelectedCidade] = useState<{ seq_cidade: number; nome: string; uf: string; label: string } | null>(null);

  const load = async () => {
    if (search.trim().length < 3) {
      setClientes([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await listClientes(search.trim());
      if (res.success) setClientes(res.clientes ?? []);
      else setClientes([]);
    } catch {
      setClientes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { setIsLoading(false); }, []);

  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 250);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!logoFile) { setLogoPreview(null); return; }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const clientesFiltrados = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return clientes;
    return clientes.filter(c => (c.cnpj ?? '').includes(q.replace(/\D/g, '')) || (c.nome ?? '').toUpperCase().includes(q));
  }, [clientes, search]);

  const openNew = () => {
    setEditing(false);
    setSelected(null);
    setForm({ cnpj: '', nome: '', seq_cidade: null, agenda: false, email: '' });
    setCidadeSearch('');
    setSelectedCidade(null);
    setLogoFile(null);
    setLogoPreview(null);
    setDialogOpen(true);
  };

  const openEdit = (c: Cliente) => {
    setEditing(true);
    setSelected(c);
    setForm({
      cnpj: c.cnpj,
      nome: c.nome ?? '',
      seq_cidade: c.seq_cidade ?? null,
      agenda: !!c.agenda,
      email: c.email ?? '',
    });
    const cidadeLabel = c.cidade_nome ? `${c.cidade_nome}${c.cidade_uf ? ` - ${c.cidade_uf}` : ''}` : '';
    setCidadeSearch(cidadeLabel);
    setSelectedCidade(
      c.seq_cidade && c.cidade_nome && c.cidade_uf
        ? { seq_cidade: c.seq_cidade, nome: c.cidade_nome, uf: c.cidade_uf, label: cidadeLabel }
        : null
    );
    setLogoFile(null);
    setLogoPreview(null);
    setDialogOpen(true);
  };

  const currentLogoUrl = selected?.logo_url ? logoUrlAbs(selected.logo_url) : null;

  useEffect(() => {
    const q = cidadeSearch.trim();
    if (!dialogOpen) return;
    if (q.length < 2) {
      setCidades([]);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const queryParams = new URLSearchParams({ search: q, limit: '50' });
        const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/shared/cidades.php?${queryParams.toString()}`, { method: 'GET' }, true);
        if (data?.success) {
          setCidades(data.cidades || []);
          setShowCidadeDropdown(true);
        } else {
          setCidades([]);
        }
      } catch {
        setCidades([]);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [cidadeSearch, dialogOpen]);

  const handleSelectCidade = (cidade: { seq_cidade: number; nome: string; uf: string; label: string }) => {
    setSelectedCidade(cidade);
    setForm((p) => ({ ...p, seq_cidade: cidade.seq_cidade }));
    setCidadeSearch(cidade.label);
    setShowCidadeDropdown(false);
  };

  const handleSave = async () => {
    const documento = normalizeDocumento(form.cnpj);
    if (!documento) { toast.error('Documento inválido (CPF 11 dígitos ou CNPJ 14 dígitos).'); return; }
    setSaving(true);
    try {
      const payload = {
        cnpj: documento,
        nome: form.nome.trim(),
        seq_cidade: form.seq_cidade ?? null,
        agenda: !!form.agenda,
        email: form.email.trim(),
      };
      const res = await upsertCliente(payload);
      if (!res.success) { toast.error(res.message || 'Erro ao salvar cliente.'); return; }

      if (logoFile) {
        const up = await uploadClienteLogo(documento, logoFile);
        if (!up.success) {
          toast.error(up.message || 'Cliente salvo, mas falhou ao enviar a logo.');
        } else {
          if (up.warning) toast.info(up.warning);
        }
      }

      toast.success('Cliente salvo.');
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar cliente.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!selected) return;
    if (!confirm('Excluir a logo deste cliente?')) return;
    setLogoRemoving(true);
    try {
      const res = await deleteClienteLogo(selected.cnpj);
      if (!res.success) {
        toast.error(res.message || 'Erro ao excluir logo.');
        return;
      }
      toast.success('Logo excluída.');
      setLogoFile(null);
      setLogoPreview(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir logo.');
    } finally {
      setLogoRemoving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500" />
                Cadastro de Clientes
              </CardTitle>
              <CardDescription>Gerencie clientes e a logo (PNG prioritário, depois JPG)</CardDescription>
            </div>
            <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 items-center">
              <div className="flex-1">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por CNPJ ou Nome" />
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {isLoading ? 'Carregando...' : `${clientesFiltrados.length} cliente(s)`}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Agenda</TableHead>
                    <TableHead>Últ. Mov.</TableHead>
                    <TableHead>Logo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : clientesFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">
                        {search.trim().length < 3 ? 'Digite ao menos 3 caracteres para buscar.' : 'Nenhum cliente encontrado.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    clientesFiltrados.map((c) => (
                      <TableRow key={c.cnpj}>
                        <TableCell className="font-mono text-xs">
                          {formatDocumento(c.cnpj).formatado}
                        </TableCell>
                        <TableCell className="max-w-[380px] truncate">{c.nome || '-'}</TableCell>
                        <TableCell className="max-w-[260px] truncate">
                          {c.cidade_nome ? `${c.cidade_nome}${c.cidade_uf ? ` - ${c.cidade_uf}` : ''}` : '-'}
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate">{c.email || '-'}</TableCell>
                        <TableCell>{c.agenda ? 'Sim' : 'Não'}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{formatDateBR(c.data_ult_mvto)}</TableCell>
                        <TableCell className="text-xs">
                          {c.logo_url ? 'Sim' : 'Não'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[780px] h-[calc(100vh-80px)] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
              <DialogDescription>Logo ideal (mínimo): 200 x 150px. Formatos: PNG ou JPG. Opcional.</DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto overscroll-contain pr-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Documento</Label>
                  {editing ? (
                    <div className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 bg-slate-50 dark:bg-slate-900/40">
                      <div className="text-xs text-slate-500 dark:text-slate-400">{formatDocumento(form.cnpj).tipo}</div>
                      <div className="font-mono text-sm text-slate-900 dark:text-slate-100">{formatDocumento(form.cnpj).formatado}</div>
                    </div>
                  ) : (
                    <Input
                      value={form.cnpj}
                      onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))}
                      placeholder="CPF (11) ou CNPJ (14) - somente números"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="opcional" />
                </div>

                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <div className="relative">
                    <Input
                      value={cidadeSearch}
                      onChange={(e) => {
                        setCidadeSearch(e.target.value);
                        setShowCidadeDropdown(true);
                        setSelectedCidade(null);
                        setForm((p) => ({ ...p, seq_cidade: null }));
                      }}
                      placeholder="Digite ao menos 2 caracteres..."
                      onFocus={() => setShowCidadeDropdown(true)}
                    />
                    {showCidadeDropdown && cidades.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
                        {cidades.map((cid) => (
                          <button
                            key={cid.seq_cidade}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                            onClick={() => handleSelectCidade(cid)}
                          >
                            {cid.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedCidade ? `Selecionada: ${selectedCidade.label}` : (form.seq_cidade ? `Seq: ${form.seq_cidade}` : 'Nenhuma cidade selecionada')}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Data de Último Movimento</Label>
                  <div className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 bg-slate-50 dark:bg-slate-900/40 text-sm text-slate-800 dark:text-slate-200">
                    {formatDateBR(selected?.data_ult_mvto)}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Agenda</Label>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch checked={form.agenda} onCheckedChange={(v) => setForm((p) => ({ ...p, agenda: v }))} />
                    <span className="text-sm text-slate-600 dark:text-slate-300">{form.agenda ? 'Sim' : 'Não'}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-slate-500" />
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Logo do Cliente</div>
                  </div>
                  {editing && selected?.logo_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={handleRemoveLogo}
                      disabled={logoRemoving}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir Logo
                    </Button>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-[200px_minmax(0,1fr)] gap-3 items-start">
                  <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 w-full aspect-[4/3] flex items-center justify-center overflow-hidden">
                    {logoPreview ? (
                      <img src={logoPreview} className="max-w-full max-h-full object-contain" />
                    ) : currentLogoUrl ? (
                      <img src={currentLogoUrl} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="text-xs text-slate-400 flex flex-col items-center gap-2">
                        <ImageIcon className="w-6 h-6 opacity-50" />
                        Sem logo
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Upload</Label>
                    <Input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                    />
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        PNG tem prioridade na leitura. Se enviar JPG, será usado se não houver PNG.
                        <br />
                        Dimensões recomendadas: 200px horizontais e 150px verticais.
                      </span>
                    </div>
                    {logoFile && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setLogoFile(null)}>
                          <X className="w-4 h-4 mr-2" />
                          Remover arquivo
                        </Button>
                        <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                          <Upload className="w-4 h-4 inline mr-1" />
                          {logoFile.name}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4 border-t pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
