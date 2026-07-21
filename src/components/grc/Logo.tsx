interface LogoProps {
  size?: number;
  className?: string;
}

export const Logo = ({ size = 34, className }: LogoProps) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
    <circle cx="18" cy="18" r="17" stroke="hsl(var(--sky))" strokeWidth="1.4" />
    <circle cx="18" cy="18" r="10" stroke="hsl(var(--accent))" strokeWidth="1.4" />
    <circle cx="18" cy="18" r="4" fill="hsl(var(--accent))" />
    {[
      ["18", "1", "18", "7"],
      ["18", "29", "18", "35"],
      ["1", "18", "7", "18"],
      ["29", "18", "35", "18"],
      ["4.7", "4.7", "9", "9"],
      ["27", "27", "31.3", "31.3"],
      ["31.3", "4.7", "27", "9"],
      ["9", "27", "4.7", "31.3"],
    ].map(([x1, y1, x2, y2], i) => (
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--sky))" strokeWidth="2" strokeLinecap="round" />
    ))}
  </svg>
);

export const BrandName = ({ className = "" }: { className?: string }) => (
  <span className={className}>
    Priv<span className="text-sky">o</span>x Platform
  </span>
);
