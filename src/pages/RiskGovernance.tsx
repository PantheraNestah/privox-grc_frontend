import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronRight, ChevronDown, Plus, Pencil, Trash2, Building2, Network, Lock, Layers, Info } from "lucide-react";
import { TopNav } from "@/components/grc/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  uid,
  ORG_TYPE_LABELS, ORG_TYPE_COLORS,
  getOrgDescendantChain,
  LINE_OF_DEFENSE_LABELS, LINE_OF_DEFENSE_SHORT, LINE_OF_DEFENSE_COLORS,
  OFFERING_KIND_LABELS, OFFERING_KIND_COLORS,
  loadOrgTypes, saveOrgTypes,
  type OrgNode, type OrgNodeType, type OrgOffering, type OfferingKind, type OrgTypeDef,
} from "@/data/orgStore";
import { loadDocuments, type PolicyDocument } from "@/data/documentsStore";
import { loadStrategy, type StrategyConfig } from "@/data/strategyStore";
import { loadAssessments, type InitiativeAssessment } from "@/data/assessmentStore";
import { loadUsers, type AppUser } from "@/data/userStore";
import { useActiveUser } from "@/hooks/use-active-user";
import { useAuth } from "@/contexts/AuthContext";
import { can } from "@/data/userStore";
import { OrgNodeInsightsPanel } from "@/components/grc/OrgNodeInsightsPanel";
import {
  useOrgNodes, useCreateOrgNode, useUpdateOrgNode, useMoveOrgNode, useSoftDeleteOrgNode,
} from "@/hooks/use-org-nodes";
import { fromOrgNodeResponse, toCreateOrgNodeRequest, toUpdateOrgNodeRequest } from "@/lib/org-node-mapping";

// Hierarchy types are now admin-managed; see the "Hierarchy Types" card.

interface NodeFormState {
  id?: string;
  name: string;
  type: OrgNodeType;
  parentId: string | null;
  description: string;
  lineOfDefense?: 1 | 2 | 3;
  offerings: OrgOffering[];
}

const emptyForm = (parentId: string | null = null, type: OrgNodeType = "company"): NodeFormState => ({
  name: "", type, parentId, description: "", offerings: [],
});

const RiskGovernance = () => {
  const activeUser = useActiveUser();
  const isAdmin = can.manageUsers(activeUser.role);
  // Only the GRC Administrator sees the full org tree. Every other role —
  // including Risk Manager and Executive — is scoped to their own unit and
  // everything beneath it, so a staff member in (e.g.) Travel never sees
  // sibling branches like Risk.
  const canSeeAll = isAdmin;

  const { organization } = useAuth();
  const orgId = organization?.id;
  const { data: orgNodeResponses } = useOrgNodes(orgId);
  const createNode = useCreateOrgNode(orgId ?? "");
  const updateNode = useUpdateOrgNode(orgId ?? "");
  const moveNode = useMoveOrgNode(orgId ?? "");
  const softDeleteNode = useSoftDeleteOrgNode(orgId ?? "");
  const allNodes = useMemo(
    () => (orgNodeResponses ?? []).map(fromOrgNodeResponse),
    [orgNodeResponses],
  );

  // Scope nodes: privileged roles see everything; everyone else sees only their
  // assigned org unit and everything beneath it.
  const nodes = useMemo(() => {
    if (canSeeAll) return allNodes;
    if (!activeUser.orgNodeId) return [];
    const scope = getOrgDescendantChain(allNodes, activeUser.orgNodeId);
    if (scope.length === 0) return [];
    // Re-root the user's unit so the tree renders cleanly.
    return scope.map(n =>
      n.id === activeUser.orgNodeId ? { ...n, parentId: null } : n
    );
  }, [allNodes, canSeeAll, activeUser.orgNodeId]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NodeFormState>(emptyForm());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Bulk-add child-units state
  const [bulkParentId, setBulkParentId] = useState<string | null>(null);
  const [bulkType, setBulkType] = useState<OrgNodeType>("company");
  const [bulkNames, setBulkNames] = useState("");

  // Roll-up data sources for the insights panel
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [strategy, setStrategy] = useState<StrategyConfig>({ pillars: [], objectives: [] });
  const [assessments, setAssessments] = useState<InitiativeAssessment[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  // Selected node for side panel
  const [insightNodeId, setInsightNodeId] = useState<string | null>(null);

  // Admin-managed hierarchy type registry
  const [orgTypes, setOrgTypes] = useState<OrgTypeDef[]>([]);
  const TYPE_OPTIONS = useMemo<OrgNodeType[]>(() => orgTypes.map(t => t.key), [orgTypes]);

  useEffect(() => {
    setDocuments(loadDocuments());
    setStrategy(loadStrategy());
    setAssessments(loadAssessments());
    setUsers(loadUsers());
    setOrgTypes(loadOrgTypes());
    const refresh = () => setOrgTypes(loadOrgTypes());
    window.addEventListener("rsolve:org-types-changed", refresh);
    return () => window.removeEventListener("rsolve:org-types-changed", refresh);
  }, []);

  const persistOrgTypes = (next: OrgTypeDef[]) => {
    setOrgTypes(next);
    saveOrgTypes(next);
  };

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, OrgNode[]>();
    nodes.forEach(n => {
      const arr = map.get(n.parentId) ?? [];
      arr.push(n);
      map.set(n.parentId, arr);
    });
    return map;
  }, [nodes]);

  // Pre-compute per-node roll-up counts (objectives, initiatives, docs, users)
  // including descendants so a Department reflects everything beneath it.
  const descendantsOf = useMemo(() => {
    const map = new Map<string, Set<string>>();
    nodes.forEach(n => {
      const set = new Set<string>([n.id]);
      const stack = [n.id];
      while (stack.length) {
        const cur = stack.pop()!;
        (childrenOf.get(cur) ?? []).forEach(k => {
          if (!set.has(k.id)) { set.add(k.id); stack.push(k.id); }
        });
      }
      map.set(n.id, set);
    });
    return map;
  }, [nodes, childrenOf]);

  const countsByNode = useMemo(() => {
    const map = new Map<string, { objectives: number; initiatives: number; documents: number; users: number }>();
    nodes.forEach(n => {
      const desc = descendantsOf.get(n.id) ?? new Set([n.id]);
      const objs = strategy.objectives.filter(o => o.linkedOrgNodeIds.some(id => desc.has(id)));
      const initiatives = objs.reduce((s, o) => s + o.initiatives.length, 0);
      const documentsCount = documents.filter(d => d.linkedOrgNodeIds.some(id => desc.has(id))).length;
      const usersCount = users.filter(u => u.orgNodeId && desc.has(u.orgNodeId)).length;
      map.set(n.id, { objectives: objs.length, initiatives, documents: documentsCount, users: usersCount });
    });
    return map;
  }, [nodes, descendantsOf, strategy, documents, users]);


  const roots = childrenOf.get(null) ?? [];

  const openCreate = (parentId: string | null = null) => {
    const parent = parentId ? nodes.find(n => n.id === parentId) : null;
    const suggested: OrgNodeType = parent ? suggestChildType(parent.type) : "group";
    setForm(emptyForm(parentId, suggested));
    setDialogOpen(true);
  };

  const openEdit = (node: OrgNode) => {
    setForm({
      id: node.id,
      name: node.name,
      type: node.type,
      parentId: node.parentId,
      description: node.description ?? "",
      lineOfDefense: node.lineOfDefense,
      offerings: node.offerings ?? [],
    });
    setDialogOpen(true);
  };

  const submitForm = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const trimmed = {
      name: form.name.trim(),
      type: form.type,
      description: form.description.trim() || undefined,
      lineOfDefense: form.lineOfDefense,
      offerings: form.offerings,
    };
    try {
      if (form.id) {
        const original = nodes.find(n => n.id === form.id);
        await updateNode.mutateAsync({ nodeId: form.id, body: toUpdateOrgNodeRequest(trimmed) });
        if (original && original.parentId !== form.parentId) {
          await moveNode.mutateAsync({ nodeId: form.id, body: { newParentId: form.parentId } });
        }
        toast.success("Updated");
      } else {
        await createNode.mutateAsync(toCreateOrgNodeRequest({ ...trimmed, parentId: form.parentId }));
        if (form.parentId) {
          setExpanded(prev => new Set(prev).add(form.parentId!));
        }
        toast.success("Added");
      }
      setDialogOpen(false);
    } catch {
      toast.error(form.id ? "Failed to update unit" : "Failed to add unit");
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      // Backend soft-delete cascades to all descendants' effectiveTo in one transaction.
      await softDeleteNode.mutateAsync(deleteId);
      setDeleteId(null);
      toast.success("Removed");
    } catch {
      toast.error("Failed to remove unit");
    }
  };

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openBulkAdd = (parentId: string | null) => {
    const parent = parentId ? nodes.find(n => n.id === parentId) : null;
    setBulkParentId(parentId);
    setBulkType(parent ? suggestChildType(parent.type) : "company");
    setBulkNames("");
  };

  const submitBulk = async () => {
    const names = bulkNames.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
    if (names.length === 0) {
      toast.error("Add at least one name (one per line or comma-separated).");
      return;
    }
    try {
      // Sequential, not Promise.all: each create call needs to succeed against
      // the same parent, and keeping requests in order makes a partial failure
      // easy to reason about (created-so-far vs. not-yet-attempted).
      for (const name of names) {
        await createNode.mutateAsync(
          toCreateOrgNodeRequest({ name, type: bulkType, parentId: bulkParentId, description: undefined }),
        );
      }
      if (bulkParentId) setExpanded(prev => new Set(prev).add(bulkParentId));
      toast.success(`Added ${names.length} unit${names.length === 1 ? "" : "s"}`);
      setBulkParentId(null);
      setBulkNames("");
    } catch {
      toast.error("Failed to add all units — some may have been created");
    }
  };

  const totalCount = nodes.length;
  const processCount = nodes.filter(n => n.type === "process" || n.type === "subprocess").length;

  const insightNode = insightNodeId ? nodes.find(n => n.id === insightNodeId) ?? null : null;
  const insightDescendants = insightNodeId ? descendantsOf.get(insightNodeId) ?? new Set([insightNodeId]) : new Set<string>();

  return (
    <>
      <Helmet>
        <title>Risk Governance · Rsolve GRC Platform</title>
        <meta name="description" content="Set up your organization structure — group, companies, departments, divisions, sections, processes and sub-processes — and visualise it as an org map." />
        <link rel="canonical" href="/governance/risk-governance" />
      </Helmet>

      <div className="flex flex-col min-h-screen">
        <TopNav />

        <main className="flex-1 px-5 md:px-10 py-8 md:py-9">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link to="/governance" className="hover:text-foreground transition-colors">Governance Management</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Risk Governance</span>
          </nav>

          <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[25px] font-semibold tracking-tight text-foreground">Risk Governance</h1>
              <p className="text-[13.5px] text-muted-foreground mt-0.5 max-w-2xl">
                Define your organisation structure — group of companies, departments, divisions, sections, processes and sub-processes.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/governance">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Governance
              </Link>
            </Button>
          </header>

          {!isAdmin && (
            <Card className="p-4 mb-5 border-warn/40 bg-warn/5">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-warn mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Read-only view</p>
                  <p className="text-xs text-muted-foreground">
                    Only the GRC Administrator can create or modify the organisation structure. You're viewing as <strong>{activeUser.name}</strong>.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <StatCard icon={<Network className="w-4 h-4" />} label="Org units" value={totalCount} />
            <StatCard icon={<Building2 className="w-4 h-4" />} label="Top-level entities" value={roots.length} />
            <StatCard icon={<Network className="w-4 h-4" />} label="Processes & sub-processes" value={processCount} />
          </div>

          {/* Hierarchy Types (admin-managed) */}
          {isAdmin && (
            <HierarchyTypesCard
              types={orgTypes}
              nodes={allNodes}
              onChange={persistOrgTypes}
            />
          )}

          {/* Tree */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-base font-semibold text-foreground">Organisation Structure</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click any unit to see roll-up insights (objectives, initiatives, documents, users) for it and everything beneath it.
                </p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => openBulkAdd(null)}>
                    <Layers className="w-4 h-4 mr-1.5" /> Bulk add
                  </Button>
                  <Button size="sm" onClick={() => openCreate(null)} className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-1.5" /> Add top-level
                  </Button>
                </div>
              )}
            </div>

            {roots.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                <Building2 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground">No organisation defined yet</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  {isAdmin
                    ? "Start by adding a Group, Company or any other top-level entity."
                    : "The GRC Administrator hasn't set up the organisation yet."}
                </p>
                {isAdmin && (
                  <Button size="sm" onClick={() => openCreate(null)}>
                    <Plus className="w-4 h-4 mr-1.5" /> Add first entity
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {roots.map(node => (
                  <TreeRow
                    key={node.id}
                    node={node}
                    depth={0}
                    childrenOf={childrenOf}
                    expanded={expanded}
                    onToggle={toggle}
                    onAddChild={openCreate}
                    onBulkAddChild={openBulkAdd}
                    onEdit={openEdit}
                    onDelete={(id) => setDeleteId(id)}
                    onOpenInsights={(id) => setInsightNodeId(id)}
                    counts={countsByNode}
                    canEdit={isAdmin}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Org Map */}
          <Card className="p-5 mt-5">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Organisation Map</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Visual representation of your organisation grouped by the Three Lines of Defense, all the way down to processes and sub-processes.</p>
              </div>
            </div>
            {roots.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-border rounded-lg">
                <Network className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Your org map will appear here once you add entities above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                <OrgMapSwimLanes nodes={nodes} childrenOf={childrenOf} users={users} />
              </div>
            )}

            {/* 3LoD summary table */}
            <ThreeLodSummary nodes={nodes} users={users} />

            {/* Legend */}
            <div className="mt-5 pt-4 border-t border-border space-y-2">
              <div className="flex flex-wrap gap-2">
                {([1, 2, 3] as const).map(l => (
                  <span
                    key={l}
                    className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: `hsl(${LINE_OF_DEFENSE_COLORS[l]} / 0.15)`, color: `hsl(${LINE_OF_DEFENSE_COLORS[l]})` }}
                  >
                    {LINE_OF_DEFENSE_SHORT[l]}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {TYPE_OPTIONS.map(t => (
                  <span
                    key={t}
                    className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: `hsl(${ORG_TYPE_COLORS[t]} / 0.12)`, color: `hsl(${ORG_TYPE_COLORS[t]})` }}
                  >
                    {ORG_TYPE_LABELS[t]}
                  </span>
                ))}
                {(Object.keys(OFFERING_KIND_LABELS) as OfferingKind[]).map(k => (
                  <span
                    key={k}
                    className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-dashed"
                    style={{ borderColor: `hsl(${OFFERING_KIND_COLORS[k]} / 0.6)`, color: `hsl(${OFFERING_KIND_COLORS[k]})` }}
                  >
                    {OFFERING_KIND_LABELS[k]}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </main>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit org unit" : "Add org unit"}</DialogTitle>
            <DialogDescription>
              {form.parentId
                ? `Adding under ${nodes.find(n => n.id === form.parentId)?.name ?? "parent"}.`
                : "Adding as a top-level entity."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Name *</Label>
                <Input
                  id="org-name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Acme Holdings"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-type">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as OrgNodeType }))}>
                  <SelectTrigger id="org-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map(t => (
                      <SelectItem key={t} value={t}>{ORG_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org-parent">Parent</Label>
              <Select
                value={form.parentId ?? "__root__"}
                onValueChange={(v) => setForm(f => ({ ...f, parentId: v === "__root__" ? null : v }))}
              >
                <SelectTrigger id="org-parent"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">— Top level —</SelectItem>
                  {nodes
                    .filter(n => n.id !== form.id)
                    .map(n => (
                      <SelectItem key={n.id} value={n.id}>
                        {ORG_TYPE_LABELS[n.type]} · {n.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org-desc">Description</Label>
              <Textarea
                id="org-desc"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description of this org unit"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org-lod">Line of Defense</Label>
              <Select
                value={form.lineOfDefense ? String(form.lineOfDefense) : "__none__"}
                onValueChange={(v) => setForm(f => ({ ...f, lineOfDefense: v === "__none__" ? undefined : (Number(v) as 1 | 2 | 3) }))}
              >
                <SelectTrigger id="org-lod"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Not classified —</SelectItem>
                  <SelectItem value="1">{LINE_OF_DEFENSE_LABELS[1]}</SelectItem>
                  <SelectItem value="2">{LINE_OF_DEFENSE_LABELS[2]}</SelectItem>
                  <SelectItem value="3">{LINE_OF_DEFENSE_LABELS[3]}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Inherited from the nearest classified ancestor unless set explicitly.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Offerings</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => setForm(f => ({
                    ...f,
                    offerings: [...f.offerings, { id: uid("off"), kind: "product_name", label: "" }],
                  }))}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
              {form.offerings.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No offerings yet — add products, frameworks, programs or services owned by this unit.</p>
              ) : (
                <div className="space-y-2">
                  {form.offerings.map((o, idx) => (
                    <div key={o.id} className="flex gap-2 items-center">
                      <Select
                        value={o.kind}
                        onValueChange={(v) => setForm(f => ({
                          ...f,
                          offerings: f.offerings.map((x, i) => i === idx ? { ...x, kind: v as OfferingKind } : x),
                        }))}
                      >
                        <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(OFFERING_KIND_LABELS) as OfferingKind[]).map(k => (
                            <SelectItem key={k} value={k}>{OFFERING_KIND_LABELS[k]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={o.label}
                        placeholder="e.g. Privox GRC Platform"
                        onChange={(e) => setForm(f => ({
                          ...f,
                          offerings: f.offerings.map((x, i) => i === idx ? { ...x, label: e.target.value } : x),
                        }))}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-destructive"
                        onClick={() => setForm(f => ({
                          ...f,
                          offerings: f.offerings.filter((_, i) => i !== idx),
                        }))}
                        aria-label="Remove offering"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitForm} className="bg-primary hover:bg-primary/90">
              {form.id ? "Save changes" : "Add unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this org unit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also remove all nested units beneath it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk-add child units dialog */}
      <Dialog open={bulkParentId !== null} onOpenChange={(o) => { if (!o) { setBulkParentId(null); setBulkNames(""); } }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Bulk add units</DialogTitle>
            <DialogDescription>
              {bulkParentId
                ? <>Adding under <strong>{nodes.find(n => n.id === bulkParentId)?.name}</strong>. One name per line, or comma-separated.</>
                : <>Adding as top-level entities.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-type">Type for all new units</Label>
              <Select value={bulkType} onValueChange={(v) => setBulkType(v as OrgNodeType)}>
                <SelectTrigger id="bulk-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(t => (
                    <SelectItem key={t} value={t}>{ORG_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-names">Names</Label>
              <Textarea
                id="bulk-names"
                rows={6}
                value={bulkNames}
                onChange={(e) => setBulkNames(e.target.value)}
                placeholder={"Finance\nOperations\nHuman Resources"}
              />
              <p className="text-[10px] text-muted-foreground">
                {bulkNames.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean).length} unit(s) ready to add
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkParentId(null); setBulkNames(""); }}>Cancel</Button>
            <Button onClick={submitBulk} className="bg-primary hover:bg-primary/90">Add all</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insights side panel */}
      <OrgNodeInsightsPanel
        node={insightNode}
        open={!!insightNode}
        onClose={() => setInsightNodeId(null)}
        descendantIds={insightDescendants}
        documents={documents}
        strategy={strategy}
        assessments={assessments}
        users={users}
      />
    </>
  );
};

function suggestChildType(parent: OrgNodeType): OrgNodeType {
  const order: OrgNodeType[] = ["group", "company", "department", "division", "section", "process", "subprocess"];
  const idx = order.indexOf(parent);
  if (idx === -1) return parent; // custom type — keep same kind by default
  return order[Math.min(idx + 1, order.length - 1)];
}

interface StatCardProps { icon: React.ReactNode; label: string; value: number; }
const StatCard = ({ icon, label, value }: StatCardProps) => (
  <Card className="p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
      {icon}
      <span>{label}</span>
    </div>
    <p className="text-2xl font-semibold text-foreground">{value}</p>
  </Card>
);

interface NodeCounts { objectives: number; initiatives: number; documents: number; users: number; }

interface TreeRowProps {
  node: OrgNode;
  depth: number;
  childrenOf: Map<string | null, OrgNode[]>;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onBulkAddChild: (parentId: string) => void;
  onEdit: (node: OrgNode) => void;
  onDelete: (id: string) => void;
  onOpenInsights: (id: string) => void;
  counts: Map<string, NodeCounts>;
  canEdit: boolean;
}

const TreeRow = ({
  node, depth, childrenOf, expanded, onToggle, onAddChild, onBulkAddChild,
  onEdit, onDelete, onOpenInsights, counts, canEdit,
}: TreeRowProps) => {
  const kids = childrenOf.get(node.id) ?? [];
  const isOpen = expanded.has(node.id);
  const color = ORG_TYPE_COLORS[node.type];
  const c = counts.get(node.id) ?? { objectives: 0, initiatives: 0, documents: 0, users: 0 };

  return (
    <div>
      <div
        className="group flex items-center gap-2 py-2 pr-2 rounded-md hover:bg-muted/50 transition-colors"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <button
          onClick={() => onToggle(node.id)}
          className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={isOpen ? "Collapse" : "Expand"}
          disabled={kids.length === 0}
        >
          {kids.length > 0 ? (
            isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-border" />
          )}
        </button>

        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: `hsl(${color} / 0.12)`, color: `hsl(${color})` }}
        >
          {ORG_TYPE_LABELS[node.type]}
        </span>

        <button
          onClick={() => onOpenInsights(node.id)}
          className="text-sm font-medium text-foreground truncate text-left hover:underline underline-offset-2 decoration-dotted"
          title="View roll-up insights"
        >
          {node.name}
        </button>

        {/* Roll-up count badges */}
        <div className="flex items-center gap-1 ml-2">
          {c.objectives > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5" title={`${c.objectives} objective${c.objectives === 1 ? "" : "s"}`}>
              O {c.objectives}
            </Badge>
          )}
          {c.initiatives > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5" title={`${c.initiatives} initiative${c.initiatives === 1 ? "" : "s"}`}>
              I {c.initiatives}
            </Badge>
          )}
          {c.documents > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5" title={`${c.documents} document${c.documents === 1 ? "" : "s"}`}>
              D {c.documents}
            </Badge>
          )}
          {c.users > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5" title={`${c.users} user${c.users === 1 ? "" : "s"}`}>
              U {c.users}
            </Badge>
          )}
        </div>

        <Button size="icon" variant="ghost" className="h-7 w-7 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onOpenInsights(node.id)} aria-label="Insights">
          <Info className="w-3.5 h-3.5" />
        </Button>

        {canEdit && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onAddChild(node.id)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Child
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onBulkAddChild(node.id)} title="Add several at once">
              <Layers className="w-3.5 h-3.5 mr-1" /> Bulk
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(node)} aria-label="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(node.id)} aria-label="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {node.description && (
        <div style={{ paddingLeft: `${depth * 20 + 40}px` }} className="pb-1">
          <p className="text-xs text-muted-foreground mb-1">{node.description}</p>
        </div>
      )}

      {isOpen && kids.map(child => (
        <TreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          childrenOf={childrenOf}
          expanded={expanded}
          onToggle={onToggle}
          onAddChild={onAddChild}
          onBulkAddChild={onBulkAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
          onOpenInsights={onOpenInsights}
          counts={counts}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
};

// ----- Effective Line of Defense (inherits from nearest classified ancestor) -----
function effectiveLod(node: OrgNode, byId: Map<string, OrgNode>): 1 | 2 | 3 | undefined {
  let cur: OrgNode | undefined = node;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    if (cur.lineOfDefense) return cur.lineOfDefense;
    seen.add(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return undefined;
}

// ----- Org Map (visual tree) -----
interface OrgMapNodeProps {
  node: OrgNode;
  childrenOf: Map<string | null, OrgNode[]>;
  users?: AppUser[];
}

const OrgMapNode = ({ node, childrenOf, users = [] }: OrgMapNodeProps) => {
  const kids = childrenOf.get(node.id) ?? [];
  const color = ORG_TYPE_COLORS[node.type];
  const nodeUsers = users.filter(u => u.orgNodeId === node.id);
  const offerings = node.offerings ?? [];

  return (
    <div className="flex flex-col items-center">
      {/* Node card */}
      <div
        className="rounded-lg border bg-card px-3 py-2 min-w-[160px] max-w-[220px] shadow-sm text-center"
        style={{ borderColor: `hsl(${color} / 0.45)` }}
      >
        <div
          className="text-[9px] font-semibold uppercase tracking-wider mb-1"
          style={{ color: `hsl(${color})` }}
        >
          {ORG_TYPE_LABELS[node.type]}
        </div>
        <div className="text-xs font-semibold text-foreground leading-tight break-words">
          {node.name}
        </div>

        {offerings.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1 justify-center">
            {offerings.map(o => (
              <span
                key={o.id}
                className="text-[9px] font-medium px-1.5 py-0.5 rounded border"
                style={{
                  borderColor: `hsl(${OFFERING_KIND_COLORS[o.kind]} / 0.5)`,
                  color: `hsl(${OFFERING_KIND_COLORS[o.kind]})`,
                  background: `hsl(${OFFERING_KIND_COLORS[o.kind]} / 0.06)`,
                }}
                title={OFFERING_KIND_LABELS[o.kind]}
              >
                {o.label || OFFERING_KIND_LABELS[o.kind]}
              </span>
            ))}
          </div>
        )}

        {nodeUsers.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1 justify-center">
            {nodeUsers.map(u => (
              <span
                key={u.id}
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-foreground text-background"
                title={`${u.title || u.role} — ${u.email}`}
              >
                {u.title || u.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Connector + children */}
      {kids.length > 0 && (
        <>
          <div className="w-px h-5 bg-border" />
          <div className="relative flex items-start justify-center gap-4">
            {kids.length > 1 && (
              <div className="absolute top-0 left-0 right-0 h-px bg-border" />
            )}
            {kids.map(child => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-5 bg-border -mt-5" />
                <OrgMapNode node={child} childrenOf={childrenOf} users={users} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ----- Three Lines of Defense swim-lanes wrapper -----
interface OrgMapSwimLanesProps {
  nodes: OrgNode[];
  childrenOf: Map<string | null, OrgNode[]>;
  users: AppUser[];
}

const OrgMapSwimLanes = ({ nodes, childrenOf, users }: OrgMapSwimLanesProps) => {
  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const roots = childrenOf.get(null) ?? [];

  // For each root, decide which lane its sub-tree belongs to. We split a root
  // by its direct children's effective LoD so e.g. a single Group with Business
  // + Control + Audit children renders the children into the correct lanes.
  const lanes: Record<1 | 2 | 3, OrgNode[]> = { 1: [], 2: [], 3: [] };
  const unclassified: OrgNode[] = [];

  roots.forEach(root => {
    const rootLod = effectiveLod(root, byId);
    const directKids = childrenOf.get(root.id) ?? [];
    const kidLods = new Set(directKids.map(k => effectiveLod(k, byId)).filter(Boolean) as (1 | 2 | 3)[]);

    if (rootLod && kidLods.size <= 1) {
      lanes[rootLod].push(root);
    } else if (kidLods.size > 0) {
      // Split: render each direct child into its own lane.
      directKids.forEach(k => {
        const lod = effectiveLod(k, byId);
        if (lod) lanes[lod].push(k);
        else unclassified.push(k);
      });
    } else {
      unclassified.push(root);
    }
  });

  const orderedLanes: (1 | 2 | 3)[] = [1, 2, 3];

  return (
    <div className="space-y-3 min-w-full">
      {unclassified.length > 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Unclassified — assign a Line of Defense to these units
          </div>
          <div className="flex items-start gap-6 flex-wrap">
            {unclassified.map(n => (
              <OrgMapNode key={n.id} node={n} childrenOf={childrenOf} users={users} />
            ))}
          </div>
        </div>
      )}
      {orderedLanes.map(l => {
        const items = lanes[l];
        if (items.length === 0) return null;
        return (
          <div
            key={l}
            className="rounded-lg border p-3"
            style={{
              borderColor: `hsl(${LINE_OF_DEFENSE_COLORS[l]} / 0.4)`,
              background: `hsl(${LINE_OF_DEFENSE_COLORS[l]} / 0.05)`,
            }}
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-wider mb-3 px-2 py-0.5 rounded inline-block"
              style={{
                background: `hsl(${LINE_OF_DEFENSE_COLORS[l]} / 0.15)`,
                color: `hsl(${LINE_OF_DEFENSE_COLORS[l]})`,
              }}
            >
              {LINE_OF_DEFENSE_SHORT[l]}
            </div>
            <div className="flex items-start gap-6 flex-wrap">
              {items.map(n => (
                <OrgMapNode key={n.id} node={n} childrenOf={childrenOf} users={users} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ----- 3LoD summary table -----
const ThreeLodSummary = ({ nodes, users }: { nodes: OrgNode[]; users: AppUser[] }) => {
  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const lanes: Record<1 | 2 | 3, OrgNode[]> = { 1: [], 2: [], 3: [] };
  nodes.forEach(n => {
    const lod = effectiveLod(n, byId);
    if (lod) lanes[lod].push(n);
  });

  const rows: { lod: 1 | 2 | 3; subtitle: string; units: OrgNode[]; userList: AppUser[] }[] = [
    { lod: 1, subtitle: "Ownership", units: lanes[1], userList: users.filter(u => u.orgNodeId && lanes[1].some(n => n.id === u.orgNodeId)) },
    { lod: 2, subtitle: "Oversight & Control", units: lanes[2], userList: users.filter(u => u.orgNodeId && lanes[2].some(n => n.id === u.orgNodeId)) },
    { lod: 3, subtitle: "Independent Assurance", units: lanes[3], userList: users.filter(u => u.orgNodeId && lanes[3].some(n => n.id === u.orgNodeId)) },
  ];

  if (rows.every(r => r.units.length === 0)) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-foreground mb-2">Governance Map: Three Lines of Defense (3LoD)</h3>
      <p className="text-xs text-muted-foreground mb-3">Visual representation of the governance lines of defense across the organization.</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40 text-left">
              <th className="px-3 py-2 font-semibold w-[28%]">Line</th>
              <th className="px-3 py-2 font-semibold">Org Units</th>
              <th className="px-3 py-2 font-semibold w-[28%]">People</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.lod}
                className="border-t border-border align-top"
                style={{ background: `hsl(${LINE_OF_DEFENSE_COLORS[r.lod]} / 0.04)` }}
              >
                <td className="px-3 py-2">
                  <div className="font-semibold" style={{ color: `hsl(${LINE_OF_DEFENSE_COLORS[r.lod]})` }}>
                    {LINE_OF_DEFENSE_SHORT[r.lod]}
                  </div>
                  <div className="text-[11px] text-muted-foreground">({r.subtitle})</div>
                </td>
                <td className="px-3 py-2">
                  {r.units.length === 0
                    ? <span className="text-muted-foreground italic">— none —</span>
                    : (
                      <div className="flex flex-wrap gap-1">
                        {r.units.map(u => (
                          <span key={u.id} className="text-[10px] px-1.5 py-0.5 rounded bg-card border border-border">
                            {ORG_TYPE_LABELS[u.type]}: {u.name}
                          </span>
                        ))}
                      </div>
                    )}
                </td>
                <td className="px-3 py-2">
                  {r.userList.length === 0
                    ? <span className="text-muted-foreground italic">— none assigned —</span>
                    : (
                      <div className="flex flex-wrap gap-1">
                        {r.userList.map(u => (
                          <span key={u.id} className="text-[10px] px-1.5 py-0.5 rounded bg-foreground text-background">
                            {u.title || u.name}
                          </span>
                        ))}
                      </div>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ----- Hierarchy Types management card -----
const TYPE_COLOR_PALETTE: { label: string; value: string }[] = [
  { label: "Navy", value: "231 53% 37%" },
  { label: "Blue", value: "210 61% 49%" },
  { label: "Sky", value: "192 60% 53%" },
  { label: "Teal", value: "180 60% 40%" },
  { label: "Green", value: "158 53% 49%" },
  { label: "Amber", value: "34 89% 61%" },
  { label: "Orange", value: "20 90% 55%" },
  { label: "Red", value: "352 70% 55%" },
  { label: "Pink", value: "330 70% 60%" },
  { label: "Purple", value: "265 88% 66%" },
  { label: "Indigo", value: "230 76% 64%" },
  { label: "Slate", value: "220 15% 45%" },
];

interface HierarchyTypesCardProps {
  types: OrgTypeDef[];
  nodes: OrgNode[];
  onChange: (next: OrgTypeDef[]) => void;
}

const HierarchyTypesCard = ({ types, nodes, onChange }: HierarchyTypesCardProps) => {
  const usageByKey = useMemo(() => {
    const map = new Map<string, number>();
    nodes.forEach(n => map.set(n.type, (map.get(n.type) ?? 0) + 1));
    return map;
  }, [nodes]);

  const updateType = (key: string, patch: Partial<OrgTypeDef>) => {
    onChange(types.map(t => t.key === key ? { ...t, ...patch } : t));
  };

  const removeType = (key: string) => {
    const def = types.find(t => t.key === key);
    if (!def) return;
    if (def.builtin) {
      toast.error("Built-in types can be renamed but not deleted");
      return;
    }
    if ((usageByKey.get(key) ?? 0) > 0) {
      toast.error("Type is in use — reassign those units first");
      return;
    }
    onChange(types.filter(t => t.key !== key));
    toast.success("Removed");
  };

  return (
    <Card className="p-5 mb-5">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Hierarchy Types</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            The organisation structure API supports a fixed set of tiers (Group, Company, Department, Division, Section, Process, Sub-process). You can rename and recolour them here, but new custom tiers can't be added — org units are validated against this fixed list server-side.
          </p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {types.map(t => {
          const inUse = usageByKey.get(t.key) ?? 0;
          return (
            <div key={t.key} className="flex flex-wrap items-center gap-2 p-2 rounded-md border border-border bg-card">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: `hsl(${t.color})` }}
              />
              <Input
                className="h-8 w-[180px]"
                value={t.label}
                onChange={e => updateType(t.key, { label: e.target.value })}
              />
              <Select value={t.color} onValueChange={(v) => updateType(t.key, { color: v })}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_COLOR_PALETTE.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: `hsl(${p.value})` }} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{t.key}</span>
              {t.builtin && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Built-in</Badge>
              )}
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5" title="Number of units using this type">
                {inUse} in use
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 ml-auto text-destructive hover:text-destructive disabled:opacity-30"
                onClick={() => removeType(t.key)}
                disabled={t.builtin || inUse > 0}
                title={t.builtin ? "Built-in" : inUse > 0 ? "Type is in use" : "Remove"}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })}
      </div>

    </Card>
  );
};

export default RiskGovernance;

