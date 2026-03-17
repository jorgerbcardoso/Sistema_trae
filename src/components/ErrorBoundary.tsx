import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🔴 [ErrorBoundary] Erro capturado:', error);
    console.error('🔴 [ErrorBoundary] Stack:', errorInfo.componentStack);
    
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    
    // Recarregar a página
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-lg shadow-lg p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-12 h-12 text-red-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Algo deu errado!
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Ocorreu um erro ao renderizar esta página. Os detalhes técnicos estão abaixo:
                </p>
                
                {this.state.error && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                      Erro:
                    </h3>
                    <pre className="text-sm text-red-800 dark:text-red-200 overflow-x-auto">
                      {this.state.error.toString()}
                    </pre>
                  </div>
                )}
                
                {this.state.errorInfo && (
                  <details className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 mb-4">
                    <summary className="font-semibold text-slate-900 dark:text-slate-100 cursor-pointer">
                      Stack Trace (clique para expandir)
                    </summary>
                    <pre className="text-xs text-slate-700 dark:text-slate-300 mt-2 overflow-x-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
                
                <div className="flex gap-3">
                  <Button onClick={this.handleReset}>
                    Recarregar Página
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => window.history.back()}
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}