import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Modal } from "./Modal";

export type AlertDialogProps = {
  confirmLabel?: string;
  description: ReactNode;
  onClose: () => void;
  title: string;
  tone?: "default" | "danger";
};

export type ConfirmDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  description: ReactNode;
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  tone?: "default" | "danger";
};

export type PromptDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  defaultValue?: string;
  description?: ReactNode;
  onCancel: () => void;
  onConfirm: (value: string) => void | Promise<void>;
  placeholder?: string;
  title: string;
  tone?: "default" | "danger";
};

/** 替代 `window.alert` */
export function AlertDialog({
  confirmLabel = "知道了",
  description,
  onClose,
  title,
  tone = "default"
}: AlertDialogProps) {
  return (
    <Modal
      className={`modal-confirm modal-confirm--${tone}`}
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <button
          className={tone === "danger" ? "danger-button" : "primary-button"}
          onClick={onClose}
          type="button"
        >
          {confirmLabel}
        </button>
      }
    >
      <div className="modal-confirm__content">{description}</div>
    </Modal>
  );
}

/** 替代 `window.confirm` */
export function ConfirmDialog({
  cancelLabel = "取消",
  confirmLabel = "确认",
  description,
  isLoading = false,
  onCancel,
  onConfirm,
  title,
  tone = "default"
}: ConfirmDialogProps) {
  return (
    <Modal
      className={`modal-confirm modal-confirm--${tone}`}
      isDismissible={!isLoading}
      onClose={onCancel}
      size="sm"
      title={title}
      footer={
        <>
          <button className="secondary-button" disabled={isLoading} onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button
            className={tone === "danger" ? "danger-button" : "primary-button"}
            disabled={isLoading}
            onClick={() => void onConfirm()}
            type="button"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="modal-confirm__content">{description}</div>
    </Modal>
  );
}

/** 替代 `window.prompt` */
export function PromptDialog({
  cancelLabel = "取消",
  confirmLabel = "确认",
  defaultValue = "",
  description,
  onCancel,
  onConfirm,
  placeholder,
  title,
  tone = "default"
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const formId = useId();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void onConfirm(value);
  }

  return (
    <Modal
      className={`modal-confirm modal-confirm--${tone} modal-prompt`}
      onClose={onCancel}
      size="sm"
      title={title}
      footer={
        <>
          <button className="secondary-button" onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button
            className={tone === "danger" ? "danger-button" : "primary-button"}
            form={formId}
            type="submit"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <form className="modal-prompt__form" id={formId} onSubmit={handleSubmit}>
        {description ? <div className="modal-confirm__content">{description}</div> : null}
        <label className="modal-prompt__field">
          <span className="sr-only">{title}</span>
          <input
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            type="text"
            value={value}
          />
        </label>
      </form>
    </Modal>
  );
}
