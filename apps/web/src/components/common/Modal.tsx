import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ModalSize = "sm" | "md" | "lg" | "xl";

export type ModalProps = {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  description?: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  isDismissible?: boolean;
  onClose: () => void;
  size?: ModalSize;
  title: string;
  /** @deprecated 使用 size="lg" */
  wide?: boolean;
};

/**
 * 应用内内容弹窗共用壳：遮罩、标题栏、可滚动主体、可选页脚。
 * 提示类交互请用 AlertDialog / ConfirmDialog / PromptDialog 或 dialog.* API。
 */
export function Modal({
  ariaLabel,
  children,
  className = "",
  closeLabel = "关闭",
  description,
  footer,
  headerActions,
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!isDismissible) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDismissible, onClose]);

  function handleBackdropClick() {
    if (isDismissible) {
      onClose();
    }
  }

  const node = (
    <div
      aria-describedby={descriptionId}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : titleId}
      aria-modal="true"
      className="modal-backdrop"
      data-testid="modal-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
    >
      <div
        className={`modal-shell modal-shell--${modalSize}${wide ? " modal-shell--wide" : ""}${
          className ? ` ${className}` : ""
        }`}
        data-testid="modal-shell"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-chrome">
          <div className="modal-heading">
            <strong id={titleId}>{title}</strong>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <div className="modal-chrome__actions">
            {headerActions}
            {isDismissible ? (
              <button aria-label={closeLabel} className="modal-close" onClick={onClose} type="button">
                {closeLabel}
              </button>
            ) : null}
          </div>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return node;
  }

  return createPortal(node, document.body);
}
