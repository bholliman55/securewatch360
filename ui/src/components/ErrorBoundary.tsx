import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-md w-full">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Something went wrong
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error && (
              <details className="mb-4">
                <summary className="text-sm text-slate-500 dark:text-slate-400 cursor-pointer">
                  Error details
                </summary>
                <pre className="mt-2 text-xs bg-slate-100 dark:bg-slate-700 p-3 rounded overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-900 text-white rounded-lg font-medium hover:shadow-lg transition-all"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
      <div>
        <h4 className="font-medium text-red-900 dark:text-red-200">Error</h4>
        <p className="text-sm text-red-800 dark:text-red-300">{message}</p>
      </div>
    </div>
  );
}
