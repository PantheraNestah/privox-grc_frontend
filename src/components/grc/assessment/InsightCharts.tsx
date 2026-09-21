import { MeterBar } from "./badges";

export interface DoughnutSegment {
  key: string;
  value: number;
  color: string;
  label: string;
}

/** SVG doughnut; each segment is a clickable ring arc. */
export const Doughnut = ({
  segments,
  total,
  centerLabel,
  onSegmentClick,
}: {
  segments: DoughnutSegment[];
  total: number;
  centerLabel: string;
  onSegmentClick?: (key: string) => void;
}) => {
  const size = 120;
  const radius = 48;
  const stroke = 18;
  const circ = 2 * Math.PI * radius;
  const sumValues = segments.reduce((s, x) => s + x.value, 0) || 1;

  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={`${centerLabel}: ${total}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
        {segments.map((s) => {
          if (s.value === 0) return null;
          const len = (s.value / sumValues) * circ;
          const circle = (
            <circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={`hsl(${s.color})`}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              style={{ cursor: onSegmentClick ? "pointer" : "default" }}
              onClick={() => onSegmentClick?.(s.key)}
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          );
          offset += len;
          return circle;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold leading-none text-foreground">{total}</span>
        <span className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">{centerLabel}</span>
      </div>
    </div>
  );
};

/** Labelled meter row that doubles as a drill-down button. */
export const Bar = ({
  label,
  value,
  total,
  color,
  onClick,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  onClick?: () => void;
}) => {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={value === 0}
      className="w-full space-y-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/50 disabled:cursor-default disabled:opacity-70 disabled:hover:bg-transparent"
    >
      <span className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">
          {value} <span className="font-normal text-muted-foreground">({pct}%)</span>
        </span>
      </span>
      <MeterBar value={pct} color={color} label={label} className="h-1.5" />
    </button>
  );
};

export interface TrendPoint {
  key: string;
  label: string;
  pct: number;
}

export const Trendline = ({ points, onPointClick }: { points: TrendPoint[]; onPointClick: (key: string) => void }) => {
  const w = 360;
  const h = 140;
  const padX = 30;
  const padY = 18;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;
  const coord = (i: number, pct: number) => ({ x: padX + i * xStep, y: padY + innerH - (pct / 100) * innerH });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${coord(i, p.pct).x} ${coord(i, p.pct).y}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h} className="text-muted-foreground" role="img" aria-label="KPI achievement over time">
        {[0, 25, 50, 75, 100].map((v) => {
          const y = padY + innerH - (v / 100) * innerH;
          return (
            <g key={v}>
              <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="hsl(var(--border))" strokeDasharray="2 3" />
              <text x={4} y={y + 3} fontSize="9" fill="currentColor">
                {v}%
              </text>
            </g>
          );
        })}
        {points.length > 1 && <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />}
        {points.map((p, i) => {
          const c = coord(i, p.pct);
          return (
            <g key={p.key} style={{ cursor: "pointer" }} onClick={() => onPointClick(p.key)}>
              <circle cx={c.x} cy={c.y} r={8} fill="transparent" />
              <circle cx={c.x} cy={c.y} r={points.length === 1 ? 5 : 4} fill="hsl(var(--primary))" />
              <title>{`${p.label}: ${p.pct}% — click to drill in`}</title>
            </g>
          );
        })}
        {points.map((p, i) => (
          <text key={p.key} x={coord(i, p.pct).x} y={h - 4} fontSize="9" textAnchor="middle" fill="currentColor">
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
};
