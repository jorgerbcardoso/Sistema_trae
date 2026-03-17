import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../ui/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { PHPQuestion } from '../../utils/apiUtils';
import { EventoSearchInput } from './EventoSearchInput';

interface PHPQuestionDialogProps {
  questions: PHPQuestion | PHPQuestion[];
  open: boolean;
  onAnswer: (answers: Record<string, any>) => void;
  onCancel?: () => void;
}

export function PHPQuestionDialog({ questions, open, onAnswer, onCancel }: PHPQuestionDialogProps) {
  const isMultiple = Array.isArray(questions);
  const questionArray = isMultiple ? questions : [questions];
  
  // Estado para armazenar respostas
  const [answers, setAnswers] = useState<Record<string, any>>({});
  
  // Estado para controlar popover aberto de cada select
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});

  // Inicializar respostas com valores padrão
  useEffect(() => {
    const initialAnswers: Record<string, any> = {};
    questionArray.forEach(q => {
      if (q.defaultValue !== undefined && q.defaultValue !== null) {
        initialAnswers[q.id] = q.defaultValue;
      } else if (q.type === 'confirm') {
        initialAnswers[q.id] = false;
      } else if (q.type === 'number') {
        initialAnswers[q.id] = 0;
      } else {
        initialAnswers[q.id] = '';
      }
    });
    
    console.log('🔄 [PHPQuestionDialog] Perguntas recebidas:', questionArray.map(q => q.id));
    console.log('📋 [PHPQuestionDialog] Valores iniciais:', initialAnswers);
    
    // ✅ MERGE com respostas existentes - NÃO SOBRESCREVER respostas já fornecidas
    setAnswers(prev => {
      console.log('💾 [PHPQuestionDialog] Respostas anteriores:', prev);
      const merged = { ...prev };
      
      // Adicionar apenas novas perguntas que ainda não foram respondidas
      Object.keys(initialAnswers).forEach(key => {
        if (!(key in merged)) {
          merged[key] = initialAnswers[key];
        }
      });
      
      console.log('✅ [PHPQuestionDialog] Respostas após merge:', merged);
      return merged;
    });
  }, [questions]);

  const handleSubmit = () => {
    console.log('📤 [PHPQuestionDialog] Enviando respostas:', answers);
    onAnswer(answers);
    // ✅ NÃO resetar aqui - deixar o useEffect fazer o merge na próxima pergunta
  };

  const handleCancel = () => {
    console.log('❌ [PHPQuestionDialog] Cancelado pelo usuário');
    if (onCancel) {
      onCancel();
    }
  };

  const updateAnswer = (questionId: string, value: any) => {
    console.log(`📝 [PHPQuestionDialog] Atualizando resposta - ${questionId}:`, value);
    setAnswers(prev => {
      const updated = {
        ...prev,
        [questionId]: value
      };
      console.log('💾 [PHPQuestionDialog] Estado atualizado:', updated);
      return updated;
    });
  };

  const renderInput = (question: PHPQuestion) => {
    const value = answers[question.id] ?? '';

    switch (question.type) {
      case 'evento':
        // 🔍 BUSCA DE EVENTOS COM INPUT AUTOCOMPLETE
        return (
          <EventoSearchInput
            value={value}
            onChange={(codigo) => updateAnswer(question.id, codigo)}
            placeholder="Busque por código ou descrição..."
          />
        );

      case 'select':
        // ✅ COMBOBOX COM FILTRO (em vez de dropdown tradicional)
        const options = (question as any).options || [];
        const isOpen = openPopovers[question.id] ?? false;
        const selectedOption = options.find((opt: any) => String(opt.value) === String(value));
        
        return (
          <Popover 
            open={isOpen} 
            onOpenChange={(open) => {
              setOpenPopovers(prev => ({ ...prev, [question.id]: open }));
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={isOpen}
                className="w-full justify-between"
              >
                {selectedOption ? selectedOption.label : "Selecione um evento..."}
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Digite para filtrar..." />
                <CommandList>
                  <CommandEmpty>Nenhum evento encontrado.</CommandEmpty>
                  <CommandGroup>
                    {options.map((option: any) => (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={() => {
                          updateAnswer(question.id, String(option.value));
                          setOpenPopovers(prev => ({ ...prev, [question.id]: false }));
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            value === String(option.value) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        );

      case 'textarea':
        return (
          <Textarea
            id={question.id}
            value={value}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder="Digite sua resposta..."
            rows={4}
            className="w-full"
          />
        );

      case 'number':
        return (
          <Input
            id={question.id}
            type="number"
            value={value}
            onChange={(e) => updateAnswer(question.id, parseFloat(e.target.value) || 0)}
            placeholder="Digite um número..."
            className="w-full"
          />
        );

      case 'confirm':
        return (
          <div className="flex gap-2 mt-2">
            <Button
              type="button"
              variant={value === true ? 'default' : 'outline'}
              onClick={() => {
                console.log('👆 [PHPQuestionDialog] Botão SIM clicado');
                // Para confirmações simples, submeter automaticamente ao clicar em Sim
                if (questionArray.length === 1 && questionArray[0].type === 'confirm') {
                  console.log('✅ [PHPQuestionDialog] Enviando resposta SIM (true)');
                  onAnswer({ [question.id]: true });
                } else {
                  updateAnswer(question.id, true);
                }
              }}
              className="flex-1"
            >
              Sim
            </Button>
            <Button
              type="button"
              variant={value === false ? 'default' : 'outline'}
              onClick={() => {
                console.log('👆 [PHPQuestionDialog] Botão NÃO clicado');
                // Para confirmações simples, submeter automaticamente ao clicar em Não
                if (questionArray.length === 1 && questionArray[0].type === 'confirm') {
                  console.log('✅ [PHPQuestionDialog] Enviando resposta NÃO (false)');
                  onAnswer({ [question.id]: false });
                } else {
                  updateAnswer(question.id, false);
                }
              }}
              className="flex-1"
            >
              Não
            </Button>
          </div>
        );

      case 'text':
      default:
        return (
          <Input
            id={question.id}
            type="text"
            value={value}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder="Digite sua resposta..."
            className="w-full"
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        {/* Remover DialogHeader para perguntas de confirmação simples */}
        {!questionArray.every(q => q.type === 'confirm') && (
          <DialogHeader>
            <DialogTitle>
              {isMultiple ? 'Informações Necessárias' : 'Informação Necessária'}
            </DialogTitle>
            <DialogDescription>
              {isMultiple 
                ? 'Por favor, preencha as informações abaixo para continuar.'
                : 'Por favor, forneça a informação solicitada para continuar.'}
            </DialogDescription>
          </DialogHeader>
        )}

        <div className={questionArray.every(q => q.type === 'confirm') ? 'py-6' : 'space-y-4 py-4'}>
          {questionArray.map((question) => (
            <div key={question.id} className="space-y-2">
              <Label htmlFor={question.id} className={question.type === 'confirm' ? 'font-medium text-base' : 'font-medium'}>
                {question.text}
              </Label>
              {/* Maior espaçamento antes dos botões em confirm */}
              <div className={question.type === 'confirm' ? 'mt-6' : ''}>
                {renderInput(question)}
              </div>
            </div>
          ))}
        </div>

        {/* Remover DialogFooter para perguntas de confirmação (botões já estão inline) */}
        {!questionArray.every(q => q.type === 'confirm') && (
          <DialogFooter>
            {onCancel && (
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
            )}
            <Button type="button" onClick={handleSubmit}>
              Enviar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}