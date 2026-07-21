import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronRight, Plus, Trash2, Save, Sliders, Target, Activity, Gauge, Lock } from "lucide-react";
import { TopNav } from "@/components/grc/TopNav";
import { useActiveUser } from "@/hooks/use-active-user";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  loadRiskStrategy, saveRiskStrategy, buildBands, buildDefaultConfig, uid,
  IMPACT_MEASUREMENT_LABELS,
  type RiskStrategyConfig, type ScaleLevel, type ScaleBand, type AppetiteStatement, type ImpactParameter, type ImpactMeasurement,
} from "@/data/orgStore";

const RiskStrategy = () => {
  const [cfg, setCfg] = useState<RiskStrategyConfig | null>(null);
  const activeUser = useActiveUser();
  const isAdmin = activeUser?.role === "admin";
  const readOnly = !isAdmin;

  useEffect(() => {
    setCfg(loadRiskStrategy());
  }, []);

  if (!cfg) return null;

  const update = (patch: Partial<RiskStrategyConfig>) => {
    setCfg(prev => prev ? { ...prev, ...patch } : prev);
  };

  const handleScaleChange = (level: ScaleLevel) => {
    const fresh = buildDefaultConfig(level);
    setCfg(prev => prev ? {
      ...prev,
      scaleLevel: level,
      likelihoodBands: fresh.likelihoodBands,
      timelineBands: fresh.timelineBands,
      impactParameters: prev.impactParameters.map(p => ({
        ...p,
        bands: buildBands(level),
      })),
    } : prev);
    toast.info(`Scale set to ${level} levels`);
  };

  const save = () => {
    saveRiskStrategy(cfg);
    toast.success("Risk strategy saved");
  };

  const reset = () => {
    const def = buildDefaultConfig(cfg.scaleLevel);
    setCfg(def);
    saveRiskStrategy(def);
    toast.success("Reset to defaults");
  };

  const updateBand = (
    target: "likelihood" | "timeline" | string,
    idx: number,
    patch: Partial<ScaleBand>,
  ) => {
    setCfg(prev => {
      if (!prev) return prev;
      if (target === "likelihood") {
        const next = [...prev.likelihoodBands];
        next[idx] = { ...next[idx], ...patch };
        return { ...prev, likelihoodBands: next };
      }
      if (target === "timeline") {
        const next = [...prev.timelineBands];
        next[idx] = { ...next[idx], ...patch };
        return { ...prev, timelineBands: next };
      }
      return {
        ...prev,
        impactParameters: prev.impactParameters.map(p => {
          if (p.id !== target) return p;
          const next = [...p.bands];
          next[idx] = { ...next[idx], ...patch };
          return { ...p, bands: next };
        }),
      };
    });
  };

  const addAppetite = () => {
    update({
      appetiteStatements: [
        ...cfg.appetiteStatements,
        { id: uid("app"), category: "New category", statement: "" },
      ],
    });
  };
  const updateAppetite = (id: string, patch: Partial<AppetiteStatement>) => {
    update({
      appetiteStatements: cfg.appetiteStatements.map(a => a.id === id ? { ...a, ...patch } : a),
    });
  };
  const removeAppetite = (id: string) => {
    update({ appetiteStatements: cfg.appetiteStatements.filter(a => a.id !== id) });
  };

  const toggleImpact = (id: string, enabled: boolean) => {
    update({
      impactParameters: cfg.impactParameters.map(p => p.id === id ? { ...p, enabled } : p),
    });
  };

  const setImpactMeasurement = (id: string, measurement: ImpactMeasurement) => {
    update({
      impactParameters: cfg.impactParameters.map(p => p.id === id ? { ...p, measurement } : p),
    });
  };

  return (
    <>
      <Helmet>
        <title>Risk Strategy · Rsolve GRC Platform</title>
        <meta name="description" content="Define risk appetite, likelihood and impact scales, and quantitative thresholds across people, compliance, reputation, financial, operational and strategic dimensions." />
        <link rel="canonical" href="/governance/risk-strategy" />
      </Helmet>

      <div className="flex flex-col min-h-screen">
        <TopNav />

        <main className="flex-1 px-5 md:px-10 py-8 md:py-9">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link to="/governance" className="hover:text-foreground transition-colors">Governance Management</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Risk Strategy</span>
          </nav>

          <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[25px] font-semibold tracking-tight text-foreground">Risk Strategy</h1>
              <p className="text-[13.5px] text-muted-foreground mt-0.5 max-w-2xl">
                Define your organisation's risk appetite, likelihood and impact rating scales, and quantitative thresholds.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/governance">
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Back
                </Link>
              </Button>
              {isAdmin && (
                <>
                  <Button variant="outline" size="sm" onClick={reset}>Reset</Button>
                  <Button size="sm" onClick={save} className="bg-primary hover:bg-primary/90">
                    <Save className="w-4 h-4 mr-1.5" /> Save
                  </Button>
                </>
              )}
            </div>
          </header>

          {readOnly && (
            <Alert className="mb-5 border-primary/30 bg-primary/5">
              <Lock className="h-4 w-4" />
              <AlertTitle className="text-sm">Read-only view</AlertTitle>
              <AlertDescription className="text-xs">
                Only an Administrator can define or change the organisation's risk appetite, rating scales and impact thresholds. You can review the current configuration below.
              </AlertDescription>
            </Alert>
          )}

          <Card className="p-5 mb-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary" />
                  Rating Scale
                </h2>
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  Choose how many levels your likelihood and impact ratings use. Changing this rebuilds the default labels — your appetite statements are kept.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="scale" className="text-xs">Levels</Label>
                <Select value={String(cfg.scaleLevel)} onValueChange={(v) => handleScaleChange(Number(v) as ScaleLevel)} disabled={readOnly}>
                  <SelectTrigger id="scale" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 levels (Low / Mod / High)</SelectItem>
                    <SelectItem value="4">4 levels</SelectItem>
                    <SelectItem value="5">5 levels (Very Low → Very High)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Tabs defaultValue="appetite" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-xl">
              <TabsTrigger value="appetite">
                <Target className="w-3.5 h-3.5 mr-1.5" /> Appetite
              </TabsTrigger>
              <TabsTrigger value="likelihood">
                <Activity className="w-3.5 h-3.5 mr-1.5" /> Likelihood
              </TabsTrigger>
              <TabsTrigger value="impact">
                <Gauge className="w-3.5 h-3.5 mr-1.5" /> Impact
              </TabsTrigger>
            </TabsList>

            <TabsContent value="appetite" className="mt-5">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Risk Appetite Statements</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Define the level of risk the organisation is willing to accept per category.</p>
                  </div>
                  {!readOnly && (
                    <Button size="sm" variant="outline" onClick={addAppetite}>
                      <Plus className="w-4 h-4 mr-1.5" /> Add category
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {cfg.appetiteStatements.map(a => (
                    <div key={a.id} className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-3 items-start p-3 rounded-md border border-border bg-muted/30">
                      <Input
                        value={a.category}
                        onChange={e => updateAppetite(a.id, { category: e.target.value })}
                        placeholder="Category"
                        readOnly={readOnly}
                        disabled={readOnly}
                      />
                      <Textarea
                        value={a.statement}
                        onChange={e => updateAppetite(a.id, { statement: e.target.value })}
                        placeholder="e.g. We have a low appetite for compliance breaches and zero tolerance for…"
                        rows={2}
                        readOnly={readOnly}
                        disabled={readOnly}
                      />
                      {!readOnly ? (
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeAppetite(a.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                  {cfg.appetiteStatements.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No appetite statements yet.</p>
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="likelihood" className="mt-5 space-y-5">
              <Card className="p-5">
                <h3 className="text-base font-semibold text-foreground mb-1">Likelihood Mode</h3>
                <p className="text-xs text-muted-foreground mb-3">Choose how likelihood is rated.</p>
                <Select value={cfg.likelihoodMode} onValueChange={(v) => update({ likelihoodMode: v as RiskStrategyConfig["likelihoodMode"] })} disabled={readOnly}>
                  <SelectTrigger className="max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="probability">Probability of occurrence</SelectItem>
                    <SelectItem value="timeline">Timeline of occurrence</SelectItem>
                    <SelectItem value="both">Both (probability & timeline)</SelectItem>
                  </SelectContent>
                </Select>
              </Card>

              {(cfg.likelihoodMode === "probability" || cfg.likelihoodMode === "both") && (
                <BandsEditor
                  title="Probability bands"
                  subtitle="Define probability ranges per level (%)."
                  unit="%"
                  bands={cfg.likelihoodBands}
                  onChange={(idx, patch) => updateBand("likelihood", idx, patch)}
                  readOnly={readOnly}
                />
              )}

              {(cfg.likelihoodMode === "timeline" || cfg.likelihoodMode === "both") && (
                <BandsEditor
                  title="Timeline bands"
                  subtitle="Define timeline ranges per level (months until likely occurrence)."
                  unit="mo"
                  bands={cfg.timelineBands}
                  onChange={(idx, patch) => updateBand("timeline", idx, patch)}
                  readOnly={readOnly}
                />
              )}
            </TabsContent>

            <TabsContent value="impact" className="mt-5 space-y-5">
              <Card className="p-5">
                <h3 className="text-base font-semibold text-foreground mb-1">Impact Parameters</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Enable the parameters used to assess risk impact. For each one, choose how it's measured — qualitative narrative, quantitative thresholds, or both.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {cfg.impactParameters.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-md border border-border bg-muted/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <Switch checked={p.enabled} onCheckedChange={(c) => toggleImpact(p.id, c)} disabled={readOnly} />
                        <span className="text-sm font-medium text-foreground truncate">{p.label}</span>
                      </div>
                      <Select
                        value={p.measurement}
                        onValueChange={(v) => setImpactMeasurement(p.id, v as ImpactMeasurement)}
                        disabled={readOnly || !p.enabled}
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs">
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
                </div>
              </Card>

              {cfg.impactParameters.filter(p => p.enabled).map(p => (
                <ImpactBandsEditor
                  key={p.id}
                  param={p}
                  onChange={(idx, patch) => updateBand(p.id, idx, patch)}
                  readOnly={readOnly}
                />
              ))}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
};

interface BandsEditorProps {
  title: string;
  subtitle: string;
  unit?: string;
  bands: ScaleBand[];
  onChange: (idx: number, patch: Partial<ScaleBand>) => void;
  readOnly?: boolean;
}

const BandsEditor = ({ title, subtitle, unit, bands, onChange, readOnly }: BandsEditorProps) => (
  <Card className="p-5">
    <div className="mb-4">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th className="py-2 pr-3 font-medium w-16">Level</th>
            <th className="py-2 pr-3 font-medium">Label</th>
            <th className="py-2 pr-3 font-medium w-32">Min {unit && <span className="text-muted-foreground">({unit})</span>}</th>
            <th className="py-2 pr-3 font-medium w-32">Max {unit && <span className="text-muted-foreground">({unit})</span>}</th>
          </tr>
        </thead>
        <tbody>
          {bands.map((b, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              <td className="py-2 pr-3">
                <Badge style={{ background: `hsl(${b.color})`, color: "white" }}>{b.level}</Badge>
              </td>
              <td className="py-2 pr-3">
                <Input value={b.label} onChange={e => onChange(i, { label: e.target.value })} className="h-8" readOnly={readOnly} disabled={readOnly} />
              </td>
              <td className="py-2 pr-3">
                <Input
                  type="number"
                  value={b.min ?? ""}
                  onChange={e => onChange(i, { min: e.target.value === "" ? undefined : Number(e.target.value) })}
                  className="h-8"
                  placeholder="—"
                  readOnly={readOnly}
                  disabled={readOnly}
                />
              </td>
              <td className="py-2 pr-3">
                <Input
                  type="number"
                  value={b.max ?? ""}
                  onChange={e => onChange(i, { max: e.target.value === "" ? undefined : Number(e.target.value) })}
                  className="h-8"
                  placeholder="—"
                  readOnly={readOnly}
                  disabled={readOnly}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);

const ImpactBandsEditor = ({ param, onChange, readOnly }: { param: ImpactParameter; onChange: (idx: number, patch: Partial<ScaleBand>) => void; readOnly?: boolean; }) => {
  const showQuant = param.measurement === "quantitative" || param.measurement === "both";
  const showQual = param.measurement === "qualitative" || param.measurement === "both";
  const subtitle = showQuant && showQual
    ? `Define both qualitative descriptors and quantitative thresholds for ${param.label.toLowerCase()} impact at each level.`
    : showQuant
      ? `Define quantitative thresholds for ${param.label.toLowerCase()} impact at each level.`
      : `Describe what each level looks like qualitatively for ${param.label.toLowerCase()} impact.`;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-foreground">{param.label} impact</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <Badge variant="outline" className="text-[10px]">{IMPACT_MEASUREMENT_LABELS[param.measurement]}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-2 pr-3 font-medium w-16">Level</th>
              <th className="py-2 pr-3 font-medium w-40">Label</th>
              {showQual && <th className="py-2 pr-3 font-medium">Qualitative description</th>}
              {showQuant && <th className="py-2 pr-3 font-medium w-32">Min</th>}
              {showQuant && <th className="py-2 pr-3 font-medium w-32">Max</th>}
            </tr>
          </thead>
          <tbody>
            {param.bands.map((b, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0 align-top">
                <td className="py-2 pr-3">
                  <Badge style={{ background: `hsl(${b.color})`, color: "white" }}>{b.level}</Badge>
                </td>
                <td className="py-2 pr-3">
                  <Input value={b.label} onChange={e => onChange(i, { label: e.target.value })} className="h-8" readOnly={readOnly} disabled={readOnly} />
                </td>
                {showQual && (
                  <td className="py-2 pr-3">
                    <Input
                      value={b.description ?? ""}
                      onChange={e => onChange(i, { description: e.target.value })}
                      placeholder={`e.g. ${param.label.toLowerCase()} impact at level ${b.level}…`}
                      className="h-8"
                      readOnly={readOnly}
                      disabled={readOnly}
                    />
                  </td>
                )}
                {showQuant && (
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      value={b.min ?? ""}
                      onChange={e => onChange(i, { min: e.target.value === "" ? undefined : Number(e.target.value) })}
                      className="h-8"
                      placeholder="—"
                      readOnly={readOnly}
                      disabled={readOnly}
                    />
                  </td>
                )}
                {showQuant && (
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      value={b.max ?? ""}
                      onChange={e => onChange(i, { max: e.target.value === "" ? undefined : Number(e.target.value) })}
                      className="h-8"
                      placeholder="—"
                      readOnly={readOnly}
                      disabled={readOnly}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default RiskStrategy;
