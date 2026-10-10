import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastState {
  message: string;
  action?: ToastAction;
}

interface ToastCtx {
  toast: (message: string, action?: ToastAction) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((message: string, action?: ToastAction) => {
    if (timer.current) clearTimeout(timer.current);
    setState({ message, action });
    timer.current = setTimeout(() => setState(null), action ? 4500 : 2200);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className={'toast' + (state ? ' on' : '')}>
        <span>{state?.message}</span>
        {state?.action && (
          <button onClick={() => { state.action!.onClick(); setState(null); }}>
            {state.action.label}
          </button>
        )}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
