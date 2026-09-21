import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { IMPACT_MEASUREMENT_LABELS, uid } from "@/data/orgStore";
import type {
  AppetiteStatement,
  ImpactMeasurement,
  ImpactParameter,
  RiskStrategyConfig,
  ScaleBand,
} from "@/data/orgStore";
import { withBand } from "./risk-config";

export interface EditorTabProps {
  cfg: RiskStrategyConfig;
  edit: (fn: (cfg: RiskStrategyConfig) => RiskStrategyConfig) => void;
  readOnly: boolean;
}

const toNumber = (value: string) => (value === "" ? undefined : Number(value));

const LevelBadge = ({ band }: { band: ScaleBand }) => (
  <Badge className="border-transparent text-white" style={{ background: `hsl(${band.color})` }}>
    {band.level}
  </Badge>
);

const NumberField = ({
  value,
  onChange,
  label,
  disabled,
}: {
  value?: number;
  onChange: (next?: number) => void;
  label: string;
  disabled?: boolean;
}) => (
  <Input
    type="number"
    aria-label={label}
    value={value ?? ""}
    onChange={(e) => onChange(toNumber(e.target.value))}
    className="h-8 min-w-24"
    placeholder="—"
    disabled={disabled}
  />
);

// ─── Appetite ─────────────────────────────────────────────

export const AppetiteTab = ({ cfg, edit, readOnly }: EditorTabProps) => {
  const update = (id: string, patch: Partial<AppetiteStatement>) =>
    edit((c) => ({
      ...c,
      appetiteStatements: c.appetiteStatements.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base text-navy-deep">Risk appetite statements</CardTitle>
          <CardDescription>The level of risk the organisation is willing to accept per category.</CardDescription>
        </div>
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              edit((c) => ({
                ...c,
                appetiteStatements: [
                  ...c.appetiteStatements,
                  { id: uid("app"), category: "New category", statement: "" },
                ],
              }))
            }
          >
            <Plus /> Add category
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {cfg.appetiteStatements.map((a) => (
          <div key={a.id} className="grid grid-cols-1 gap-3 md:grid-cols-[13rem_1fr_auto] md:items-start">
            <Input
              aria-label="Category"
              value={a.category}
              onChange={(e) => update(a.id, { category: e.target.value })}
              placeholder="Category"
              disabled={readOnly}
            />
            <Textarea
              aria-label={`${a.category || "Category"} statement`}
              value={a.statement}
              onChange={(e) => update(a.id, { statement: e.target.value })}
              placeholder="e.g. We have a low appetite for compliance breaches and zero tolerance for…"
              rows={2}
              disabled={readOnly}
            />
            {!readOnly && (
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                aria-label={`Remove ${a.category || "category"}`}
                onClick={() =>
                  edit((c) => ({ ...c, appetiteStatements: c.appetiteStatements.filter((x) => x.id !== a.id) }))
                }
              >
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
        {cfg.appetiteStatements.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No appetite statements yet.</p>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Likelihood ───────────────────────────────────────────

interface BandsEditorProps {
  title: string;
  subtitle: string;
  unit?: string;
  bands: ScaleBand[];
  onChange: (idx: number, patch: Partial<ScaleBand>) => void;
  readOnly?: boolean;
}

const BandsEditor = ({ title, subtitle, unit, bands, onChange, readOnly }: BandsEditorProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base text-navy-deep">{title}</CardTitle>
      <CardDescription>{subtitle}</CardDescription>
    </CardHeader>
    <CardContent className="px-0 pb-2">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 w-16">Level</TableHead>
            <TableHead className="h-10">Label</TableHead>
            <TableHead className="h-10">Min{unit && ` (${unit})`}</TableHead>
            <TableHead className="h-10">Max{unit && ` (${unit})`}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bands.map((b, i) => (
            <TableRow key={i}>
              <TableCell className="py-2">
                <LevelBadge band={b} />
              </TableCell>
              <TableCell className="py-2">
                <Input
                  aria-label={`${title} level ${b.level} label`}
                  value={b.label}
                  onChange={(e) => onChange(i, { label: e.target.value })}
                  className="h-8 min-w-36"
                  disabled={readOnly}
                />
              </TableCell>
              <TableCell className="py-2">
                <NumberField
                  label={`${title} level ${b.level} min`}
                  value={b.min}
                  onChange={(min) => onChange(i, { min })}
                  disabled={readOnly}
                />
              </TableCell>
              <TableCell className="py-2">
                <NumberField
                  label={`${title} level ${b.level} max`}
                  value={b.max}
                  onChange={(max) => onChange(i, { max })}
                  disabled={readOnly}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);

export const LikelihoodTab = ({ cfg, edit, readOnly }: EditorTabProps) => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-navy-deep">Likelihood mode</CardTitle>
        <CardDescription>Choose how likelihood is rated.</CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={cfg.likelihoodMode}
          onValueChange={(v) =>
            edit((c) => ({ ...c, likelihoodMode: v as RiskStrategyConfig["likelihoodMode"] }))
          }
          disabled={readOnly}
        >
          <SelectTrigger className="max-w-sm" aria-label="Likelihood mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="probability">Probability of occurrence</SelectItem>
            <SelectItem value="timeline">Timeline of occurrence</SelectItem>
            <SelectItem value="both">Both (probability & timeline)</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>

    {(cfg.likelihoodMode === "probability" || cfg.likelihoodMode === "both") && (
      <BandsEditor
        title="Probability bands"
        subtitle="Define probability ranges per level (%)."
        unit="%"
        bands={cfg.likelihoodBands}
        onChange={(idx, patch) => edit((c) => withBand(c, "likelihood", idx, patch))}
        readOnly={readOnly}
      />
    )}

    {(cfg.likelihoodMode === "timeline" || cfg.likelihoodMode === "both") && (
      <BandsEditor
        title="Timeline bands"
        subtitle="Define timeline ranges per level (months until likely occurrence)."
        unit="mo"
        bands={cfg.timelineBands}
        onChange={(idx, patch) => edit((c) => withBand(c, "timeline", idx, patch))}
        readOnly={readOnly}
      />
    )}
  </div>
);

// ─── Impact ───────────────────────────────────────────────

const ImpactBandsEditor = ({
  param,
  onChange,
  readOnly,
}: {
  param: ImpactParameter;
  onChange: (idx: number, patch: Partial<ScaleBand>) => void;
  readOnly?: boolean;
}) => {
  const showQuant = param.measurement === "quantitative" || param.measurement === "both";
  const showQual = param.measurement === "qualitative" || param.measurement === "both";
  const noun = param.label.toLowerCase();
  const subtitle =
    showQuant && showQual
      ? `Define both qualitative descriptors and quantitative thresholds for ${noun} impact at each level.`
      : showQuant
        ? `Define quantitative thresholds for ${noun} impact at each level.`
        : `Describe what each level looks like qualitatively for ${noun} impact.`;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base text-navy-deep">{param.label} impact</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {IMPACT_MEASUREMENT_LABELS[param.measurement]}
        </Badge>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 w-16">Level</TableHead>
              <TableHead className="h-10">Label</TableHead>
              {showQual && <TableHead className="h-10">Qualitative description</TableHead>}
              {showQuant && <TableHead className="h-10">Min</TableHead>}
              {showQuant && <TableHead className="h-10">Max</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {param.bands.map((b, i) => (
              <TableRow key={i} className="align-top">
                <TableCell className="py-2">
                  <LevelBadge band={b} />
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    aria-label={`${param.label} level ${b.level} label`}
                    value={b.label}
                    onChange={(e) => onChange(i, { label: e.target.value })}
                    className="h-8 min-w-36"
                    disabled={readOnly}
                  />
                </TableCell>
                {showQual && (
                  <TableCell className="py-2">
                    <Input
                      aria-label={`${param.label} level ${b.level} description`}
                      value={b.description ?? ""}
                      onChange={(e) => onChange(i, { description: e.target.value })}
                      placeholder={`e.g. ${noun} impact at level ${b.level}…`}
                      className="h-8 min-w-56"
                      disabled={readOnly}
                    />
                  </TableCell>
                )}
                {showQuant && (
                  <TableCell className="py-2">
                    <NumberField
                      label={`${param.label} level ${b.level} min`}
                      value={b.min}
                      onChange={(min) => onChange(i, { min })}
                      disabled={readOnly}
                    />
                  </TableCell>
                )}
                {showQuant && (
                  <TableCell className="py-2">
                    <NumberField
                      label={`${param.label} level ${b.level} max`}
                      value={b.max}
                      onChange={(max) => onChange(i, { max })}
                      disabled={readOnly}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export const ImpactTab = ({ cfg, edit, readOnly }: EditorTabProps) => {
  const patchParam = (id: string, patch: Partial<ImpactParameter>) =>
    edit((c) => ({
      ...c,
      impactParameters: c.impactParameters.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-navy-deep">Impact parameters</CardTitle>
          <CardDescription>
            Enable the parameters used to assess risk impact. For each one, choose how it's measured — qualitative
            narrative, quantitative thresholds, or both.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {cfg.impactParameters.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Switch
                  checked={p.enabled}
                  onCheckedChange={(enabled) => patchParam(p.id, { enabled })}
                  disabled={readOnly}
                  aria-label={`Enable ${p.label}`}
                />
                <span className="truncate text-sm font-medium text-navy-deep">{p.label}</span>
              </div>
              <Select
                value={p.measurement}
                onValueChange={(v) => patchParam(p.id, { measurement: v as ImpactMeasurement })}
                disabled={readOnly || !p.enabled}
              >
                <SelectTrigger className="h-8 w-[8.5rem] text-xs" aria-label={`${p.label} measurement`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualitative">Qualitative</SelectItem>
                  <SelectItem value="quantitative">Quantitative</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      {cfg.impactParameters
        .filter((p) => p.enabled)
        .map((p) => (
          <ImpactBandsEditor
            key={p.id}
            param={p}
            onChange={(idx, patch) => edit((c) => withBand(c, p.id, idx, patch))}
            readOnly={readOnly}
          />
        ))}
    </div>
  );
};
