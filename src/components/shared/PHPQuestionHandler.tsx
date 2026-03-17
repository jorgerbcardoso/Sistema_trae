import React, { useState, useEffect } from 'react';
import { setQuestionHandler, PHPQuestion } from '../../utils/apiUtils';
import { PHPQuestionDialog } from './PHPQuestionDialog';

/**
 * Componente global que gerencia perguntas do backend PHP
 * Deve ser incluído uma vez no App.tsx
 */
export function PHPQuestionHandler() {
  const [questions, setQuestions] = useState<PHPQuestion | PHPQuestion[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [answerCallback, setAnswerCallback] = useState<((answers: Record<string, any>) => void) | null>(null);

  // Registrar handler global quando o componente montar
  useEffect(() => {
    setQuestionHandler((questions, onAnswer) => {
      console.log('🔔 [PHPQuestionHandler] Pergunta recebida do backend:', questions);
      setQuestions(questions);
      setIsOpen(true);
      
      // Armazenar callback em estado
      // Usar função wrapper para evitar problemas com setState
      setAnswerCallback(() => onAnswer);
    });

    return () => {
      setQuestionHandler(() => {
        console.warn('⚠️ PHPQuestionHandler desmontado mas pergunta recebida');
      });
    };
  }, []);

  const handleAnswer = (answers: Record<string, any>) => {
    console.log('✅ [PHPQuestionHandler] Respostas recebidas do dialog:', answers);
    console.log('✅ [PHPQuestionHandler] Callback existe?', !!answerCallback);
    
    if (answerCallback) {
      console.log('✅ [PHPQuestionHandler] Chamando callback...');
      answerCallback(answers);
    } else {
      console.error('❌ [PHPQuestionHandler] Callback não existe!');
    }
    
    // Fechar dialog
    console.log('✅ [PHPQuestionHandler] Fechando dialog...');
    setIsOpen(false);
    setQuestions(null);
    setAnswerCallback(null);
  };

  const handleCancel = () => {
    console.log('❌ [PHPQuestionHandler] Usuário cancelou');
    
    // ✅ RESOLVER A PROMISE COM UM OBJETO VAZIO PARA DESBLOQUEAR O LOADING
    // Isso fará com que o backend receba uma requisição sem respostas e retorne erro/cancelamento
    if (answerCallback) {
      console.log('🔄 [PHPQuestionHandler] Resolvendo callback com objeto vazio (cancelamento)');
      // Enviar objeto vazio para indicar cancelamento
      answerCallback({});
    }
    
    // Fechar dialog
    setIsOpen(false);
    setQuestions(null);
    setAnswerCallback(null);
  };

  if (!questions) {
    return null;
  }

  return (
    <PHPQuestionDialog
      questions={questions}
      open={isOpen}
      onAnswer={handleAnswer}
      onCancel={handleCancel}
    />
  );
}