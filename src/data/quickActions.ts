import {
  Zap, Plus, FileText, AlertCircle, ShieldAlert, ClipboardCheck, FileSearch,
  UserPlus, Mail, Download, Upload, Calendar, BarChart3, Bell, KeyRound, BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface QuickActionIconDef {
  key: string;
  label: string;
  icon: LucideIcon;
}

export const QUICK_ACTION_ICONS: QuickActionIconDef[] = [
  { key: "zap",       label: "Lightning",  icon: Zap },
  { key: "plus",      label: "Plus",       icon: Plus },
  { key: "file",      label: "Document",   icon: FileText },
  { key: "alert",     label: "Alert",      icon: AlertCircle },
  { key: "shield",    label: "Shield",     icon: ShieldAlert },
  { key: "check",     label: "Checklist",  icon: ClipboardCheck },
  { key: "search",    label: "Audit",      icon: FileSearch },
  { key: "user",      label: "User",       icon: UserPlus },
  { key: "mail",      label: "Mail",       icon: Mail },
  { key: "download",  label: "Download",   icon: Download },
  { key: "upload",    label: "Upload",     icon: Upload },
  { key: "calendar",  label: "Calendar",   icon: Calendar },
  { key: "chart",     label: "Chart",      icon: BarChart3 },
  { key: "bell",      label: "Bell",       icon: Bell },
  { key: "key",       label: "Key",        icon: KeyRound },
  { key: "book",      label: "Book",       icon: BookOpen },
];

export const ICON_BY_KEY: Record<string, LucideIcon> = Object.fromEntries(
  QUICK_ACTION_ICONS.map(i => [i.key, i.icon])
);

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  iconKey: string;
  /** HSL color string */
  color: string;
  /** Module id from MODULES (or "" for none) */
  moduleId: string;
}

export const QUICK_ACTION_COLORS: { label: string; value: string }[] = [
  { label: "Royal",   value: "231 51% 50%" },
  { label: "Accent",  value: "230 76% 64%" },
  { label: "Sky",     value: "229 81% 76%" },
  { label: "Coral",   value: "352 70% 61%" },
  { label: "Mint",    value: "158 53% 49%" },
  { label: "Amber",   value: "34 89% 61%" },
  { label: "Cyan",    value: "192 60% 53%" },
  { label: "Violet",  value: "265 88% 66%" },
];

export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { id: "qa-1", title: "Log Risk",            description: "Capture a new risk in the register.",   iconKey: "alert",  color: "352 70% 61%", moduleId: "risk" },
  { id: "qa-2", title: "Create New Incident", description: "Open a new incident.",                  iconKey: "shield", color: "265 88% 66%", moduleId: "incidents" },
];
