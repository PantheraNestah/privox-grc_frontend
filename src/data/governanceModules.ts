import { FileText, ShieldAlert, Compass, LineChart, ClipboardCheck, ClipboardList } from "lucide-react";
import type { ModuleDef } from "@/data/modules";

export const GOVERNANCE_MODULES: ModuleDef[] = [
  {
    id: "risk-governance",
    name: "Risk Governance",
    desc: "Set up the organisation structure — group, companies, divisions, departments, sections and processes.",
    icon: ShieldAlert,
    color: "352 70% 61%",
  },
  {
    id: "strategy-formulation",
    name: "Organization Strategy Formulation",
    desc: "Set up strategic pillars, objectives, initiatives, activities, outcomes and KPIs (plan setup only).",
    icon: Compass,
    color: "158 53% 49%",
  },
  {
    id: "strategy-assessment",
    name: "Strategy Performance Assessment",
    desc: "Self-assess initiative progress, attach evidence and route through hierarchical approvals.",
    icon: ClipboardCheck,
    color: "210 61% 49%",
  },
  {
    id: "documents",
    name: "Document Management",
    desc: "Centralised policies, procedures and governance documentation with version control.",
    icon: FileText,
    color: "192 60% 53%",
  },
  {
    id: "surveys",
    name: "Questionnaires & Surveys",
    desc: "Design and publish risk culture, governance, vendor and data management surveys to staff or external parties.",
    icon: ClipboardList,
    color: "265 88% 66%",
  },
  {
    id: "risk-strategy",
    name: "Risk Appetite",
    desc: "Define risk appetite, likelihood and impact scales and quantitative thresholds.",
    icon: LineChart,
    color: "265 88% 66%",
  },
];
