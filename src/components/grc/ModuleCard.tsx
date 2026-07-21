import { ArrowRight } from "lucide-react";
import type { ModuleDef } from "@/data/modules";
import { cn } from "@/lib/utils";

interface Props {
  module: ModuleDef;
  index: number;
  onClick: () => void;
}

export const ModuleCard = ({ module, index, onClick }: Props) => {
  const Icon = module.icon;
  const dark = module.dark;

  // Per-card brand color exposed as CSS variable
  const styleVars = {
    "--mc": `hsl(${module.color})`,
    "--mb": `hsl(${module.color} / 0.09)`,
    animationDelay: `${index * 50}ms`,
  } as React.CSSProperties;

  return (
    <button
      onClick={onClick}
      style={styleVars}
      className={cn(
        "group relative text-left w-full rounded-2xl p-6 pb-5 border overflow-hidden cursor-pointer animate-card-in",
        "transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(.16,1,.3,1)]",
        "hover:-translate-y-1.5 hover:shadow-card-hover",
        dark
          ? "bg-gradient-pc border-brand-accent/30 text-white hover:shadow-[0_16px_40px_hsl(var(--navy)/0.3)]"
          : "bg-card border-brand-accent/10 shadow-card hover:border-brand-accent/30"
      )}
    >
      {/* top stripe */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
        style={{ background: dark ? "hsl(var(--sky))" : "var(--mc)" }}
      />

      {/* watermark icon */}
      <Icon
        aria-hidden
        className="absolute -bottom-2 -right-2 w-24 h-24 opacity-[0.05] group-hover:opacity-[0.09] group-hover:scale-110 group-hover:rotate-[5deg] transition-all duration-300"
        style={{ color: dark ? "hsl(var(--sky))" : "var(--mc)" }}
        strokeWidth={1.5}
      />

      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ background: dark ? "hsl(var(--sky) / 0.15)" : "var(--mb)" }}
      >
        <Icon className="w-5.5 h-5.5" style={{ color: dark ? "hsl(var(--sky))" : "var(--mc)" }} strokeWidth={1.6} />
      </div>

      <div className={cn("text-[14.5px] font-semibold tracking-tight mb-1", dark ? "text-white" : "text-navy-deep")}>
        {module.name}
      </div>
      <div className={cn("text-xs leading-relaxed mb-3.5", dark ? "text-sky/70" : "text-brand-muted")}>
        {module.desc}
      </div>

      <div className="flex items-center justify-end">
        <span
          className="relative w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200 group-hover:translate-x-0.5 overflow-hidden"
          style={{ background: dark ? "hsl(var(--sky) / 0.15)" : "var(--mb)" }}
        >
          {/* fill layer revealed on hover */}
          <span
            aria-hidden
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: dark ? "hsl(var(--sky))" : "var(--mc)" }}
          />
          <ArrowRight
            className="relative w-3.5 h-3.5 transition-colors"
            style={{ color: dark ? "hsl(var(--sky))" : "var(--mc)" }}
          />
        </span>
      </div>
    </button>
  );
};
