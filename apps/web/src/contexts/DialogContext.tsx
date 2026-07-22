import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  AlertDialog,
  ConfirmDialog,
  PromptDialog,
  type AlertDialogProps,
  type ConfirmDialogProps,
  type PromptDialogProps
} from "../components/common/PromptDialogs";

type AlertOptions = Omit<AlertDialogProps, "onClose">;
type ConfirmOptions = Omit<ConfirmDialogProps, "onCancel" | "onConfirm" | "isLoading">;
type PromptOptions = Omit<PromptDialogProps, "onCancel" | "onConfirm">;

type DialogApi = {
  alert: (options: AlertOptions) => Promise<void>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

type ActiveDialog =
  | { kind: "alert"; options: AlertOptions; resolve: () => void }
  | { kind: "confirm"; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: "prompt"; options: PromptOptions; resolve: (value: string | null) => void };

const DialogContext = createContext<DialogApi | null>(null);

let imperativeApi: DialogApi | null = null;

function requireDialogApi(): DialogApi {
  if (!imperativeApi) {
    throw new Error("DialogProvider 尚未挂载，无法打开提示弹窗。");
  }
  return imperativeApi;
}

/** 命令式 API：可在任意事件处理中 `await dialog.confirm(...)` */
export const dialog: DialogApi = {
  alert: (options) => requireDialogApi().alert(options),
  confirm: (options) => requireDialogApi().confirm(options),
  prompt: (options) => requireDialogApi().prompt(options)
};

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) {
    throw new Error("useDialog 必须在 DialogProvider 内使用。");
  }
  return api;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveDialog | null>(null);
  const queueRef = useRef<ActiveDialog[]>([]);

  const presentNext = useCallback(() => {
    const next = queueRef.current.shift() ?? null;
    setActive(next);
  }, []);

  const enqueue = useCallback((request: ActiveDialog) => {
    setActive((current) => {
      if (current) {
        queueRef.current.push(request);
        return current;
      }
      return request;
    });
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      alert(options) {
        return new Promise<void>((resolve) => {
          enqueue({ kind: "alert", options, resolve });
        });
      },
      confirm(options) {
        return new Promise<boolean>((resolve) => {
          enqueue({ kind: "confirm", options, resolve });
        });
      },
      prompt(options) {
        return new Promise<string | null>((resolve) => {
          enqueue({ kind: "prompt", options, resolve });
        });
      }
    }),
    [enqueue]
  );

  imperativeApi = api;

  function closeWith(action: () => void) {
    action();
    presentNext();
  }

  return (
    <DialogContext.Provider value={api}>
      {children}
      {active?.kind === "alert" ? (
        <AlertDialog
          {...active.options}
          onClose={() => closeWith(() => active.resolve())}
        />
      ) : null}
      {active?.kind === "confirm" ? (
        <ConfirmDialog
          {...active.options}
          onCancel={() => closeWith(() => active.resolve(false))}
          onConfirm={() => closeWith(() => active.resolve(true))}
        />
      ) : null}
      {active?.kind === "prompt" ? (
        <PromptDialog
          {...active.options}
          onCancel={() => closeWith(() => active.resolve(null))}
          onConfirm={(value) => closeWith(() => active.resolve(value))}
        />
      ) : null}
    </DialogContext.Provider>
  );
}
