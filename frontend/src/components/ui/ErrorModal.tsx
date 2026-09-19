'use client';
import { AlertTriangle } from 'lucide-react';


interface ErrorModalProps {
  title?: string;
  message: string;
  onBackToDashboard: () => void;
  onRetry?: () => void;
  onContactSupport?: () => void;
}

export default function ErrorModal({
  title = 'Oops! Something went wrong',
  message,
  onBackToDashboard,
  onRetry,
  onContactSupport,
}: ErrorModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="glass-card rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
        <div className="text-5xl mb-4"><AlertTriangle size={48} className="text-purple-400" /></div>
        <h2 className="text-xl font-bold text-blue-900 mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex flex-col gap-3">
          <button onClick={onBackToDashboard} className="btn-primary">
            Back to Dashboard
          </button>
          {onRetry && (
            <button onClick={onRetry} className="btn-outline">
              Try Again
            </button>
          )}
          {onContactSupport && (
            <button onClick={onContactSupport} className="text-purple-600 underline text-sm">
              Contact Support
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

