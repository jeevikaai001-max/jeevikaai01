import React from 'react';
import { Icon } from './Icons';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected error occurred',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-[#DCE3EA] p-6 sm:p-8 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-[#FDEDEC] text-[#9E2A2B] mx-auto flex items-center justify-center">
              <Icon name="info" size={24} />
            </div>
            <h2 className="text-lg font-extrabold text-[#17365D]">
              कुछ तकनीकी समस्या आई है (Something went wrong)
            </h2>
            <p className="text-xs text-[#5F6B76] leading-relaxed">
              डेटा सुरक्षित है। कृपया पृष्ठ को रीफ्रेश करें या मुख्य पृष्ठ पर लौटें।
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.href = '/';
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#17365D] hover:bg-[#245A91] text-white text-xs font-bold transition-colors"
            >
              पुनः प्रयास करें (Reload JeevikaAI)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
