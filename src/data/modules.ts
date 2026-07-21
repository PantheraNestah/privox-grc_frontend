import { LayoutDashboard, Landmark, AlertTriangle, CheckCircle2, ShieldCheck, RotateCw, Lock, UserCog } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ModuleDef {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  /** HSL color string e.g. "231 51% 50%" */
  color: string;
  dark?: boolean;
}

export const MODULES: ModuleDef[] = [
  { id: "dashboard",  name: "Dashboard & Reporting",      desc: "Executive dashboards, KRI/KPI tracking and cross-domain GRC analytics.",            icon: LayoutDashboard, color: "231 51% 50%" },
  { id: "governance", name: "Governance Management",      desc: "Policies, frameworks, board decisions and organisational governance structures.", icon: Landmark,        color: "210 61% 49%" },
  { id: "risk",       name: "Risk Management",            desc: "Identify, assess, treat and monitor organisational risks across business units.", icon: AlertTriangle,   color: "352 70% 61%" },
  { id: "compliance", name: "Compliance Management",      desc: "Track regulatory requirements, conduct audits and maintain compliance frameworks.", icon: CheckCircle2,    color: "158 53% 49%" },
  { id: "data",       name: "Data Protection Management", desc: "POPIA/GDPR compliance, data subject requests and protection impact assessments.", icon: ShieldCheck,     color: "34 89% 61%" },
  { id: "resilience", name: "Resilience Management",      desc: "Business continuity, disaster recovery, BIA and operational resilience planning.", icon: RotateCw,        color: "192 60% 53%" },
  { id: "cyber",      name: "Cyber Risk Management",      desc: "Cyber threats, vulnerability assessments, security incidents and control frameworks.", icon: Lock,         color: "265 88% 66%" },
  { id: "settings",   name: "Profile & Settings",         desc: "Manage users, assign roles, audit logs and platform configuration.",               icon: UserCog,         color: "229 81% 76%", dark: true },
];

export const MODULE_OPTIONS = MODULES.map(m => ({ value: m.id, label: m.name }));
