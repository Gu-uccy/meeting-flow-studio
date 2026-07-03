import { useEffect, useId, type ReactNode } from "react";

type ModalProps = {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  description?: ReactNode;
  footer?: ReactNode;
  isDismissible?: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  title: string;
  wide?: boolean;
};

type ConfirmDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  description: ReactNode;
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  tone?: "default" | "danger";
};

export function Modal({
  ariaLabel,
  children,
  className = "",
  closeLabel = "关闭",
  description,
  footer,
  isDismissible = true,
  onClose,
  size,
  title,
  wide = false
}: ModalProps) {
  const modalSize = size ?? (wide ? "lg" : "md");
  const modalId = useId();
  const titleId = `${modalId}-title`;
  const descriptionId = description ? `${modalId}-description` : undefined;

  useEffect(() => {
    if (!isDismissible) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDismissible, onClose]);

  function handleBackdropClick() {
    if (isDismissible) {
      onClose();
    }
  }

  return (
    <div
      aria-describedby={descriptionId}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : titleId}
      aria-modal="true"
      className="modal-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
    >
      <div
        className={`modal-shell modal-shell--${modalSize}${wide ? " modal-shell--wide" : ""}${
          className ? ` ${className}` : ""
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-chrome">
          <div className="modal-heading">
            <strong id={titleId}>{title}</strong>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          {isDismissible && (
            <button aria-label={closeLabel} className="modal-close" onClick={onClose} type="button">
              {closeLabel}
            </button>
          )}
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

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
