/**
 * Presentation metadata for the server's platform module catalogue.
 *
 * The backend module codes (`CORE`, `GOVERNANCE`, …) don't map 1:1 to the
 * static tenant `MODULES` list in `@/data/modules`, so they get their own
 * icon/colour map. Unknown codes fall back to a neutral style.
 */

import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CheckCircle2,
  Landmark,
  Lock,
  RotateCw,
  ShieldCheck,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export interface PlatformModuleStyle {
  icon: LucideIcon;
  /** HSL color string e.g. "231 51% 50%" */
  color: string;
}

const STYLES: Record<string, PlatformModuleStyle> = {
  CORE: { icon: Boxes, color: "231 51% 50%" },
  USER_MANAGEMENT: { icon: UserCog, color: "229 81% 76%" },
  GOVERNANCE: { icon: Landmark, color: "210 61% 49%" },
  RISK_MANAGEMENT: { icon: AlertTriangle, color: "352 70% 61%" },
  COMPLIANCE: { icon: CheckCircle2, color: "158 53% 49%" },
  DATA_PROTECTION: { icon: ShieldCheck, color: "34 89% 61%" },
  RESILIENCE: { icon: RotateCw, color: "192 60% 53%" },
  CYBER_RISK: { icon: Lock, color: "265 88% 66%" },
  REPORTING: { icon: BarChart3, color: "229 81% 60%" },
};

const FALLBACK: PlatformModuleStyle = { icon: Boxes, color: "220 15% 55%" };

export function platformModuleStyle(code: string | null | undefined): PlatformModuleStyle {
  return STYLES[(code ?? "").toUpperCase()] ?? FALLBACK;
}
