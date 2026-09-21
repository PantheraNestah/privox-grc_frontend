import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ModuleDef } from "@/data/modules";

interface Props {
  module: ModuleDef;
  /** Accepted for call-site compatibility; cards no longer stagger-animate. */
  index?: number;
  onClick: () => void;
}

export const ModuleCard = ({ module, onClick }: Props) => {
  const Icon = module.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="flex h-full items-start gap-4 p-5 transition-colors group-hover:border-brand-accent/40">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `hsl(${module.color} / 0.1)` }}
        >
          <Icon className="h-5 w-5" style={{ color: `hsl(${module.color})` }} strokeWidth={1.6} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold tracking-tight text-navy-deep">{module.name}</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{module.desc}</span>
        </span>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-accent" />
      </Card>
    </button>
  );
};
