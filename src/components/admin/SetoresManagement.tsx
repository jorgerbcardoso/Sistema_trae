import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/apiUtils';
import { FolderTree, Plus, Edit2, Trash2, Save, X, Loader2, ShoppingCart } from 'lucide-react';
import { ENVIRONMENT } from '../../config/environment';
import { getSetorColorClasses, formatSetorNumber } from '../../utils/setorColors';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

interface Setor {
  nro_setor: number;
  descricao: string;
  efetua_compras: boolean;
}

export function SetoresManagement() {
  const { token } = useAuth();
  const [setores, setSetores] = useState<Setor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingSetor, setEditingSetor] = useState<Setor | null>(null);
  
  const [descricao, setDescricao] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [efetuaCompras, setEfetuaCompras] = useState(false);
  const [editEfetuaCompras, setEditEfetuaCompras] = useState(false);

  useEffect(() => {
    loadSetores();
  }, []);

  const loadSetores = async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch('/sistema/api/admin/setores.php', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (data.success) {
        setSetores(data.setores || []);
      }
    } catch (err: any) {
      console.error('Erro ao carregar setores:', err);
      setSetores([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!descricao.trim()) {
      toast.error('Descrição é obrigatória');
      return;
    }

    try {
      setIsLoading(true);
      const data = await apiFetch('/sistema/api/admin/setores.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ descricao: descricao.trim(), efetua_compras: efetuaCompras })
      });

      if (data.success) {
        toast.success(data.message || 'Setor criado com sucesso');
        setDescricao('');
        setEfetuaCompras(false);
        setShowCreateDialog(false);
        await loadSetores();
      }
    } catch (err: any) {
      console.error('Erro ao criar setor:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (setor: Setor) => {
    setEditingSetor(setor);
    setEditDescricao(setor.descricao);
    setEditEfetuaCompras(setor.efetua_compras);
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editDescricao.trim()) {
      toast.error('Descrição é obrigatória');
      return;
    }

    if (!editingSetor) return;

    try {
      setIsLoading(true);
      const data = await apiFetch('/sistema/api/admin/setores.php', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nro_setor: editingSetor.nro_setor,
          descricao: editDescricao.trim(),
          efetua_compras: editEfetuaCompras
        })
      });

      if (data.success) {
        toast.success(data.message || 'Setor atualizado com sucesso');
        setEditingSetor(null);
        setEditDescricao('');
        setEditEfetuaCompras(false);
        setShowEditDialog(false);
        await loadSetores();
      }
    } catch (err: any) {
      console.error('Erro ao atualizar setor:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (setor: Setor) => {
    if (!confirm(`Tem certeza que deseja excluir o setor "${setor.descricao}"?`)) {
      return;
    }

    try {
      setIsLoading(true);
      const data = await apiFetch(`/sistema/api/admin/setores.php?nro_setor=${setor.nro_setor}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (data.success) {
        toast.success(data.message || 'Setor excluído com sucesso');
        await loadSetores();
      }
    } catch (err: any) {
      console.error('Erro ao excluir setor:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <FolderTree className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle>Cadastro de Setores</CardTitle>
                <CardDescription>
                  Gerencie os setores da empresa
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Novo Setor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && setores.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
              <p className="text-slate-500 mt-2">Carregando setores...</p>
            </div>
          ) : setores.length === 0 ? (
            <div className="text-center py-12">
              <FolderTree className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <p className="text-slate-500">Nenhum setor cadastrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {setores.map((setor) => (
                <div
                  key={setor.nro_setor}
                  className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className={getSetorColorClasses(setor.nro_setor)}>
                      {formatSetorNumber(setor.nro_setor)}
                    </Badge>
                    <p className="text-slate-900 dark:text-slate-100 font-medium">
                      {setor.descricao}
                    </p>
                    {setor.nro_setor === 1 && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        PADRÃO
                      </Badge>
                    )}
                    {setor.efetua_compras && (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                        <ShoppingCart className="w-3 h-3 mr-1" />
                        EFETUA COMPRAS
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {setor.nro_setor !== 1 && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(setor)}
                          disabled={isLoading}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(setor)}
                          disabled={isLoading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Criar Setor */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Novo Setor</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo setor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">
                Descrição
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                id="descricao"
                type="text"
                placeholder="Digite a descrição do setor"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
              <p className="text-xs text-slate-500">
                Será salvo em MAIÚSCULAS automaticamente
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="efetuaCompras"
                  checked={efetuaCompras}
                  onCheckedChange={(checked) => setEfetuaCompras(checked as boolean)}
                  disabled={isLoading}
                />
                <Label 
                  htmlFor="efetuaCompras"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Setor efetua compras
                </Label>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleCreate}
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Criar Setor
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDescricao('');
                  setEfetuaCompras(false);
                  setShowCreateDialog(false);
                }}
                disabled={isLoading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Setor */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Editar Setor</DialogTitle>
            <DialogDescription>
              Atualize os dados do setor #{editingSetor?.nro_setor}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-descricao">
                Descrição
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                id="edit-descricao"
                type="text"
                placeholder="Digite a descrição do setor"
                value={editDescricao}
                onChange={(e) => setEditDescricao(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
              <p className="text-xs text-slate-500">
                Será salvo em MAIÚSCULAS automaticamente
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-efetuaCompras"
                  checked={editEfetuaCompras}
                  onCheckedChange={(checked) => setEditEfetuaCompras(checked as boolean)}
                  disabled={isLoading}
                />
                <Label 
                  htmlFor="edit-efetuaCompras"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Setor efetua compras
                </Label>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSaveEdit}
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Alterações
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingSetor(null);
                  setEditDescricao('');
                  setEditEfetuaCompras(false);
                  setShowEditDialog(false);
                }}
                disabled={isLoading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}