import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ragFromPercent, type KpiAssessment, type RagStatus } from "@/data/assessmentStore";
import type { Kpi } from "@/data/strategyStore";
import { RagBadge } from "./badges";

interface KpiScoreCardProps {
  kpi: Kpi;
  value: KpiAssessment;
  disabled: boolean;
  onChange: (patch: Partial<KpiAssessment>) => void;
}

const FieldLabel = ({ htmlFor, children }: { htmlFor: string; children: string }) => (
  <Label htmlFor={htmlFor} className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
    {children}
  </Label>
);

/** One KPI's scoring inputs: actual value, % achieved (auto-RAG), RAG override and note. */
export function KpiScoreCard({ kpi, value, disabled, onChange }: KpiScoreCardProps) {
  const rag: RagStatus | undefined =
    value.rag ?? (typeof value.percentAchievement === "number" ? ragFromPercent(value.percentAchievement) : undefined);

  const handlePct = (raw: string) => {
    const pct = raw === "" ? undefined : Math.max(0, Math.min(100, parseInt(raw) || 0));
    onChange({ percentAchievement: pct, rag: pct == null ? undefined : ragFromPercent(pct) });
  };

  const id = (field: string) => `kpi-${kpi.id}-${field}`;

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{kpi.name || "(unnamed KPI)"}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              Target: <strong className="font-medium text-foreground">{kpi.target ?? "—"}{kpi.unit ? ` ${kpi.unit}` : ""}</strong>
              <Badge variant="secondary" className="text-[11px] font-normal">{kpi.type}</Badge>
            </p>
          </div>
          {rag && <RagBadge rag={rag} />}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor={id("actual")}>Actual value</FieldLabel>
            <Input
              id={id("actual")}
              className="h-9"
              value={value.actual ?? ""}
              onChange={(e) => onChange({ actual: e.target.value })}
              disabled={disabled}
              placeholder={kpi.unit || "value"}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor={id("pct")}>% Achieved</FieldLabel>
            <Input
              id={id("pct")}
              type="number"
              min={0}
              max={100}
              className="h-9 font-mono"
              value={value.percentAchievement ?? ""}
              onChange={(e) => handlePct(e.target.value)}
              disabled={disabled}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor={id("rag")}>RAG (override)</FieldLabel>
            <Select
              value={value.rag ?? "auto"}
              onValueChange={(v) => onChange({ rag: v === "auto" ? undefined : (v as RagStatus) })}
              disabled={disabled}
            >
              <SelectTrigger id={id("rag")} className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="green">Green</SelectItem>
                <SelectItem value="amber">Amber</SelectItem>
                <SelectItem value="red">Red</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <FieldLabel htmlFor={id("note")}>Note</FieldLabel>
            <Input
              id={id("note")}
              className="h-9"
              value={value.note ?? ""}
              onChange={(e) => onChange({ note: e.target.value })}
              disabled={disabled}
              placeholder="…"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
