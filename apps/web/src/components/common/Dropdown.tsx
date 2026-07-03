import { useEffect, useRef, useState } from "react";

export type DropdownOption<T extends string = string> = {
  disabled?: boolean;
  label: string;
  value: T;
};

type DropdownProps<T extends string = string> = {
  ariaLabel?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  value: T;
};

export function Dropdown<T extends string = string>({
  ariaLabel,
  disabled = false,
  id,
  name,
  onChange,
  options,
  value
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function handleSelect(nextValue: T) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div className={`dropdown${disabled ? " is-disabled" : ""}${isOpen ? " is-open" : ""}`} ref={rootRef}>
      {name && <input id={id} name={name} type="hidden" value={value} />}
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="dropdown__trigger"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="dropdown__value">{selectedOption?.label ?? ""}</span>
        <span aria-hidden="true" className="dropdown__icon">
          <svg fill="none" height="10" viewBox="0 0 12 10" width="12">
            <path d="M2 3.5L6 7.5L10 3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="dropdown__menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              className={`dropdown__option${option.value === value ? " is-selected" : ""}`}
              disabled={option.disabled}
              onClick={() => handleSelect(option.value)}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
