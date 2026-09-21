import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initials } from "@/lib/format";

interface UserCardProps {
  name: string;
  /** Second line, e.g. role or permission count. */
  detail?: string;
  collapsed?: boolean;
}

/** Signed-in identity block for the sidebar and drawer footers. */
export function UserCard({ name, detail, collapsed }: UserCardProps) {
  const avatar = (
    <Avatar className="h-9 w-9">
      <AvatarFallback className="bg-gradient-primary text-xs font-semibold text-white">
        {initials(name, "U")}
      </AvatarFallback>
    </Avatar>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex justify-center">{avatar}</div>
        </TooltipTrigger>
        <TooltipContent side="right">{name}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-offwhite p-3">
      {avatar}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-navy-deep">{name}</p>
        {detail && <p className="truncate text-[11px] text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}
