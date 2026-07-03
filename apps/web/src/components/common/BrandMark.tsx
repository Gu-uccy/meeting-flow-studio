type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <span className={`brand-mark${compact ? " brand-mark--compact" : ""}`} aria-hidden="true">
      <svg fill="none" viewBox="0 0 40 40">
        <path className="brand-mark__rail" d="M10 28C10 18 15 11 24 11C30 11 34 15 34 20C34 25 30 29 24 29" />
        <path className="brand-mark__letter" d="M9 29V12L16 23L23 12V29" />
        <circle className="brand-mark__dot brand-mark__dot--start" cx="9" cy="29" r="3" />
        <circle className="brand-mark__dot brand-mark__dot--mid" cx="24" cy="11" r="3" />
        <circle className="brand-mark__dot brand-mark__dot--end" cx="24" cy="29" r="3" />
      </svg>
    </span>
  );
}
