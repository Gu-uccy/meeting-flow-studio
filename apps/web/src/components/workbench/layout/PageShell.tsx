import type { ReactNode } from "react";

type PageShellProps = {
  "aria-label"?: string;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function PageShell({ "aria-label": ariaLabel, children, className = "", id }: PageShellProps) {
  return (
    <section aria-label={ariaLabel} className={`workbench-page${className ? ` ${className}` : ""}`} id={id}>
      {children}
    </section>
  );
}
