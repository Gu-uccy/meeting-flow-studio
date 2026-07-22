import type { KeyboardEvent, ReactNode } from "react";

export type SelectableCardItem = {
  /** Optional footer actions (pin/delete/execute). Avoid nesting buttons when the card itself is a `<button>`. */
  actions?: ReactNode;
  badge?: ReactNode;
  badgeClassName?: string;
  /** Extra classes on the card root (e.g. `is-pinned`, `priority-high`). */
  className?: string;
  description?: ReactNode;
  disabled?: boolean;
  id: string;
  meta?: ReactNode;
  title: ReactNode;
};

type SelectableCardListProps = {
  activeClassName?: string;
  ariaLabel?: string;
  className?: string;
  empty?: ReactNode;
  items: SelectableCardItem[];
  layout?: "stack" | "grid";
  onSelect?: (id: string) => void;
  selectedId?: string | null;
};

/**
 * Shared multi-item card list for selectable/static collections
 * (knowledge docs, runs, schedules, meeting tiles, agent insights, etc.).
 */
export function SelectableCardList({
  activeClassName = "is-active",
  ariaLabel = "列表",
  className = "",
  empty = null,
  items,
  layout = "stack",
  onSelect,
  selectedId = null
}: SelectableCardListProps) {
  if (items.length === 0) {
    return empty ? <div className="selectable-card-list__empty">{empty}</div> : null;
  }

  return (
    <div
      aria-label={ariaLabel}
      className={`selectable-card-list selectable-card-list--${layout}${className ? ` ${className}` : ""}`}
    >
      {items.map((item) => {
        const isActive = Boolean(selectedId && selectedId === item.id);
        const classNameValue = [
          "selectable-card",
          isActive ? activeClassName : "",
          item.disabled ? "is-disabled" : "",
          item.className ?? ""
        ]
          .filter(Boolean)
          .join(" ");

        const body = (
          <>
            <div className="selectable-card__topline">
              <strong className="selectable-card__title">{item.title}</strong>
              {item.badge ? (
                <span className={`selectable-card__badge${item.badgeClassName ? ` ${item.badgeClassName}` : ""}`}>
                  {item.badge}
                </span>
              ) : null}
            </div>
            {item.description ? <div className="selectable-card__description">{item.description}</div> : null}
            {item.meta ? <div className="selectable-card__meta">{item.meta}</div> : null}
            {item.actions ? (
              <div
                className="selectable-card__actions"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                {item.actions}
              </div>
            ) : null}
          </>
        );

        if (onSelect && !item.actions) {
          return (
            <button
              className={classNameValue}
              disabled={item.disabled}
              key={item.id}
              onClick={() => onSelect(item.id)}
              type="button"
            >
              {body}
            </button>
          );
        }

        if (onSelect && item.actions) {
          const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
            if (item.disabled) {
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect(item.id);
            }
          };

          return (
            <div
              aria-disabled={item.disabled || undefined}
              className={classNameValue}
              key={item.id}
              onClick={() => {
                if (!item.disabled) {
                  onSelect(item.id);
                }
              }}
              onKeyDown={handleKeyDown}
              role="button"
              tabIndex={item.disabled ? -1 : 0}
            >
              {body}
            </div>
          );
        }

        return (
          <article className={classNameValue} key={item.id}>
            {body}
          </article>
        );
      })}
    </div>
  );
}
