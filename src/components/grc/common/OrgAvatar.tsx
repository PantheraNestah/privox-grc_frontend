import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Initials tile used wherever an organization needs a visual anchor. */
export function OrgAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/12 text-[13px] font-semibold tracking-tight text-navy ring-1 ring-inset ring-brand-accent/20",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
