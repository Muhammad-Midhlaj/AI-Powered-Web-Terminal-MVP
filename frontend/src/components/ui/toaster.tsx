import { useEffect, useState } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToasterState {
  toasts: Toast[];
}

// Simple toast store
let toasterState: ToasterState = { toasts: [] };
let listeners: (() => void)[] = [];

const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

export const toast = {
  success: (message: string, duration = 5000) => {
    const id = Math.random().toString(36).substr(2, 9);
    toasterState.toasts.push({ id, message, type: 'success', duration });
    notifyListeners();
    setTimeout(() => {
      toasterState.toasts = toasterState.toasts.filter(t => t.id !== id);
      notifyListeners();
    }, duration);
  },
  error: (message: string, duration = 5000) => {
    const id = Math.random().toString(36).substr(2, 9);
    toasterState.toasts.push({ id, message, type: 'error', duration });
    notifyListeners();
    setTimeout(() => {
      toasterState.toasts = toasterState.toasts.filter(t => t.id !== id);
      notifyListeners();
    }, duration);
  },
  warning: (message: string, duration = 5000) => {
    const id = Math.random().toString(36).substr(2, 9);
    toasterState.toasts.push({ id, message, type: 'warning', duration });
    notifyListeners();
    setTimeout(() => {
      toasterState.toasts = toasterState.toasts.filter(t => t.id !== id);
      notifyListeners();
    }, duration);
  },
  info: (message: string, duration = 5000) => {
    const id = Math.random().toString(36).substr(2, 9);
    toasterState.toasts.push({ id, message, type: 'info', duration });
    notifyListeners();
    setTimeout(() => {
      toasterState.toasts = toasterState.toasts.filter(t => t.id !== id);
      notifyListeners();
    }, duration);
  }
};

function ToastItem({ toast: toastItem, onClose }: { toast: Toast; onClose: () => void }) {
  const getToastStyles = () => {
    switch (toastItem.type) {
      case 'success':
        return 'bg-green-600 border-green-500';
      case 'error':
        return 'bg-red-600 border-red-500';
      case 'warning':
        return 'bg-yellow-600 border-yellow-500';
      case 'info':
        return 'bg-blue-600 border-blue-500';
      default:
        return 'bg-gray-600 border-gray-500';
    }
  };

  const getIcon = () => {
    switch (toastItem.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  };

  return (
    <div className={`${getToastStyles()} border text-white p-4 rounded-lg shadow-lg mb-2 animate-slide-in`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="mr-2 font-bold">{getIcon()}</span>
          <span>{toastItem.message}</span>
        </div>
        <button
          onClick={onClose}
          className="ml-4 text-white hover:text-gray-200"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const updateToasts = () => {
      setToasts([...toasterState.toasts]);
    };

    listeners.push(updateToasts);
    updateToasts(); // Initial load

    return () => {
      listeners = listeners.filter(listener => listener !== updateToasts);
    };
  }, []);

  const removeToast = (id: string) => {
    toasterState.toasts = toasterState.toasts.filter(t => t.id !== id);
    notifyListeners();
  };

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      {toasts.map((toastItem) => (
        <ToastItem
          key={toastItem.id}
          toast={toastItem}
          onClose={() => removeToast(toastItem.id)}
        />
      ))}
    </div>
  );
} 