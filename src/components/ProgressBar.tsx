interface Props {
  value: number;
  label: string;
  /** Muestra el porcentaje como texto junto a la barra. */
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({ value, label, showValue = true, size = 'md' }: Props) {
  const v = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
  return (
    <div className={`progress progress--${size}`}>
      <div className="progress__track" role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress__fill" style={{ width: `${v}%` }} />
      </div>
      {showValue && <span className="progress__value">{v}%</span>}
    </div>
  );
}
