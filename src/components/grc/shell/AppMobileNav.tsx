import { type ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Logo, BrandName } from "@/components/grc/Logo";
import { NavLinks } from "./NavLinks";
import type { NavGroup } from "./nav";

interface AppMobileNavProps {
  groups: NavGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subtitle: string;
  /** Rendered under the links; receives a function that closes the drawer. */
  footer?: (close: () => void) => ReactNode;
}

/** Phone navigation: slide-in drawer opened from the top bar. */
export function AppMobileNav({ groups, open, onOpenChange, subtitle, footer }: AppMobileNavProps) {
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[18rem] max-w-[85vw] flex-col gap-0 p-0 sm:max-w-[18rem] [&>button]:text-white"
      >
        <SheetHeader className="space-y-1 bg-navy-deep px-5 py-5 text-left">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <SheetTitle className="text-lg font-semibold tracking-tight text-white">
              <BrandName />
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs text-sky">{subtitle}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <NavLinks groups={groups} onNavigate={close} />
        </div>

        {footer && <div className="space-y-3 border-t border-border p-4">{footer(close)}</div>}
      </SheetContent>
    </Sheet>
  );
}
