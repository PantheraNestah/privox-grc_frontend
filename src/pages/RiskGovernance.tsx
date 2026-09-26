import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  ChevronRight, ChevronDown, Plus, Pencil, Trash2, Building2, Network, Lock, Layers, Info,
  LayoutTemplate, MoreHorizontal, X, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  uid,
  ORG_TYPE_LABELS, ORG_TYPE_COLORS,
  LINE_OF_DEFENSE_LABELS, LINE_OF_DEFENSE_SHORT, LINE_OF_DEFENSE_COLORS,
  OFFERING_KIND_LABELS, OFFERING_KIND_COLORS,
  loadOrgTypes, saveOrgTypes,
  effectiveLod,
  type OrgNode, type OrgNodeType, type OrgOffering, type OfferingKind, type OrgTypeDef,
} from "@/data/orgStore";
import { loadDocuments, type PolicyDocument } from "@/data/documentsStore";
import { loadStrategy, type StrategyConfig } from "@/data/strategyStore";
import { loadAssessments, type InitiativeAssessment } from "@/data/assessmentStore";
import { loadUsers, type AppUser } from "@/data/userStore";
import { useActiveUser } from "@/hooks/use-active-user";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, TENANT_HOME } from "@/components/grc/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/grc/common/states";
import { TemplatePicker } from "@/components/grc/governance/TemplatePicker";
import { OrgNodeInsightsPanel } from "@/components/grc/OrgNodeInsightsPanel";
import { OrgMapGraph } from "@/components/grc/OrgMapGraph";
import {
  useOrgNodes, useCreateOrgNode, useUpdateOrgNode, useMoveOrgNode, useSoftDeleteOrgNode,
} from "@/hooks/use-org-nodes";
import { fromOrgNodeResponse, toCreateOrgNodeRequest, toUpdateOrgNodeRequest } from "@/lib/org-node-mapping";
import { downloadTextFile, orgNodesToCsv, orgNodesToJson } from "@/lib/orgTreeExport";

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

  const { organization, permissions } = useAuth();
  const orgId = organization?.id;
  // Segregation of duties: contributors draft/edit nodes; approvers move/delete
  // them; template cloning stays a full organization-administrator action.
  const canContribute =
    permissions.includes("orgnode.contribute") || permissions.includes("organization.manage");
  const canApprove =
    permissions.includes("orgnode.approve") || permissions.includes("organization.manage");
  const isAdmin = permissions.includes("organization.manage");
  const canApplyTemplates = isAdmin;
  const orgNodesQuery = useOrgNodes(orgId);
  const { data: orgNodeResponses } = orgNodesQuery;
  const createNode = useCreateOrgNode(orgId ?? "");
  const updateNode = useUpdateOrgNode(orgId ?? "");
  const moveNode = useMoveOrgNode(orgId ?? "");
  const softDeleteNode = useSoftDeleteOrgNode(orgId ?? "");
  const allNodes = useMemo(
    () => (orgNodeResponses ?? []).map(fromOrgNodeResponse),
    [orgNodeResponses],
  );

  // View scoping is resolved server-side: the API narrows the response to the
  // units the signed-in user may see (privileged roles receive the full tree,
  // node leaders receive their own subtree), so the UI renders exactly what the
  // backend authorises rather than re-implementing the rules in the browser.
  const nodes = allNodes;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NodeFormState>(emptyForm());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);

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
  // "The organisation has no tree at all" (not just an empty scope for a restricted role).
  const orgIsEmpty = orgNodesQuery.isSuccess && allNodes.length === 0;
  const templateParents = useMemo(
    () => allNodes.map(n => ({ id: n.id, label: `${ORG_TYPE_LABELS[n.type]} · ${n.name}` })),
    [allNodes],
  );

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

  /** Export the tree the API returned (already scoped server-side). */
  const exportTree = (format: "csv" | "json") => {
    if (nodes.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const base = `organisation-structure-${stamp}`;
    try {
      if (format === "csv") {
        downloadTextFile(`${base}.csv`, orgNodesToCsv(nodes), "text/csv;charset=utf-8");
      } else {
        downloadTextFile(
          `${base}.json`,
          orgNodesToJson(nodes, {
            organizationName: organization?.name ?? null,
            organizationId: orgId ?? null,
          }),
          "application/json",
        );
      }
      toast.success(
        `Exported ${nodes.length} org unit${nodes.length === 1 ? "" : "s"} as ${format.toUpperCase()}`,
      );
    } catch {
      toast.error("Failed to export the organisation structure");
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

      <PageHeader
        home={TENANT_HOME}
        crumbs={[{ label: "Governance", to: "/governance" }, { label: "Risk Governance" }]}
        title="Risk Governance"
        description="Define your organisation structure — group of companies, departments, divisions, sections, processes and sub-processes."
      />

      <div className="space-y-6">
        {!canContribute && !canApprove && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>Read-only view</AlertTitle>
            <AlertDescription>
              Creating or editing the organisation structure requires the Governance Contributor role;
              approving structural changes requires the Governance Approver role. You're viewing as{" "}
              <strong>{activeUser.name}</strong>.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard icon={<Network className="h-4 w-4" />} label="Org units" value={totalCount} />
          <StatCard icon={<Building2 className="h-4 w-4" />} label="Top-level entities" value={roots.length} />
          <StatCard icon={<Network className="h-4 w-4" />} label="Processes & sub-processes" value={processCount} />
        </div>

        {isAdmin && (
          <HierarchyTypesCard types={orgTypes} nodes={allNodes} onChange={persistOrgTypes} />
        )}

        {/* Tree */}
        <Card>
          <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base text-navy-deep">Organisation Structure</CardTitle>
              <CardDescription className="text-xs">
                Select any unit to see roll-up insights (objectives, initiatives, documents, users) for it and everything beneath it.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {nodes.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Download /> Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportTree("csv")}>Export as CSV</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportTree("json")}>Export as JSON</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {canApplyTemplates && orgId && !orgIsEmpty && (
                <Button
                  size="sm"
                  variant="outline"
                  aria-expanded={templatesOpen}
                  onClick={() => setTemplatesOpen(o => !o)}
                >
                  <LayoutTemplate /> Add from template
                </Button>
              )}
              {isAdmin && (
                <>
                  <Button size="sm" variant="outline" onClick={() => openBulkAdd(null)}>
                    <Layers /> Bulk add
                  </Button>
                  <Button size="sm" variant="brand" onClick={() => openCreate(null)}>
                    <Plus /> Add top-level
                  </Button>
                </>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {templatesOpen && canApplyTemplates && orgId && !orgIsEmpty && (
              <Card className="bg-muted/30 shadow-none">
                <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                  <div className="space-y-1.5">
                    <CardTitle className="text-sm text-navy-deep">Add from template</CardTitle>
                    <CardDescription className="text-xs">
                      Copy a ready-made structure under an existing unit, or at the top level.
                    </CardDescription>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => setTemplatesOpen(false)}
                    aria-label="Close template picker"
                  >
                    <X />
                  </Button>
                </CardHeader>
                <CardContent>
                  <TemplatePicker
                    orgId={orgId}
                    canManage
                    parents={templateParents}
                    onCloned={() => setTemplatesOpen(false)}
                  />
                </CardContent>
              </Card>
            )}

            {orgNodesQuery.isLoading ? (
              <div className="space-y-2" role="status">
                <span className="sr-only">Loading organisation structure…</span>
                <Skeleton className="h-9 w-full" />
                <Skeleton className="ml-6 h-9 w-[calc(100%-1.5rem)]" />
                <Skeleton className="ml-6 h-9 w-[calc(100%-1.5rem)]" />
              </div>
            ) : orgNodesQuery.isError ? (
              <ErrorState
                title="Couldn't load the organisation structure"
                message={orgNodesQuery.error instanceof Error ? orgNodesQuery.error.message : "Failed to load org units."}
              />
            ) : roots.length === 0 ? (
              <div className="space-y-6">
                <EmptyState
                  icon={Building2}
                  title="No organisation defined yet"
                  description={
                    orgIsEmpty
                      ? canContribute
                        ? "Start by adding a Group, Company or any other top-level entity"
                          + (canApplyTemplates ? ", or copy a ready-made template below." : ".")
                        : "The GRC Administrator hasn't set up the organisation yet."
                      : "No org unit is assigned to you yet."
                  }
                  action={
                    canContribute && (
                      <Button size="sm" variant="brand" onClick={() => openCreate(null)}>
                        <Plus /> Add first entity
                      </Button>
                    )
                  }
                />
                {orgIsEmpty && orgId && (
                  <>
                    <Separator />
                    <section className="space-y-3" aria-labelledby="start-from-template">
                      <div>
                        <h3 id="start-from-template" className="text-sm font-semibold text-navy-deep">
                          Start from a template
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {canApplyTemplates
                            ? "Pick a ready-made structure. It's copied into your organisation and every unit stays editable."
                            : "Ask an organization administrator to start from a template."}
                        </p>
                      </div>
                      <TemplatePicker orgId={orgId} canManage={canApplyTemplates} />
                    </section>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
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
                    canContribute={canContribute}
                    canApprove={canApprove}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Org Map */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-navy-deep">Organisation Map</CardTitle>
            <CardDescription className="text-xs">
              Your organisation grouped by the Three Lines of Defense, all the way down to processes and sub-processes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {roots.length === 0 ? (
              <EmptyState
                icon={Network}
                title="Nothing to map yet"
                description="Your org map will appear here once you add entities above."
              />
            ) : (
              <OrgMapGraph
                nodes={nodes}
                childrenOf={childrenOf}
                users={users}
                onNodeSelect={(id) => setInsightNodeId(id)}
              />
            )}

            <ThreeLodSummary nodes={nodes} users={users} />

            {/* Legend */}
            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex flex-wrap gap-2">
                {([1, 2, 3] as const).map(l => (
                  <ColorBadge key={l} color={LINE_OF_DEFENSE_COLORS[l]}>{LINE_OF_DEFENSE_SHORT[l]}</ColorBadge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {TYPE_OPTIONS.map(t => (
                  <ColorBadge key={t} color={ORG_TYPE_COLORS[t]}>{ORG_TYPE_LABELS[t]}</ColorBadge>
                ))}
                {(Object.keys(OFFERING_KIND_LABELS) as OfferingKind[]).map(k => (
                  <ColorBadge key={k} color={OFFERING_KIND_COLORS[k]} outline>{OFFERING_KIND_LABELS[k]}</ColorBadge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[520px]">
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
            <Button variant="brand" onClick={submitForm}>
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
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[520px]">
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
            <Button variant="brand" onClick={submitBulk}>Add all</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insights side panel */}
      <OrgNodeInsightsPanel
        orgId={orgId}
        node={insightNode}
        open={!!insightNode}
        onClose={() => setInsightNodeId(null)}
        descendantIds={insightDescendants}
        documents={documents}
        strategy={strategy}
        assessments={assessments}
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

/** Small tinted pill driven by an HSL triplet (type / line-of-defense / offering colours). */
const ColorBadge = ({ color, outline, children }: { color: string; outline?: boolean; children: React.ReactNode }) => (
  <Badge
    variant="outline"
    className={`text-[10px] font-semibold uppercase tracking-wider ${outline ? "border-dashed bg-transparent" : "border-transparent"}`}
    style={{
      background: outline ? undefined : `hsl(${color} / 0.12)`,
      borderColor: outline ? `hsl(${color} / 0.6)` : undefined,
      color: `hsl(${color})`,
    }}
  >
    {children}
  </Badge>
);

interface StatCardProps { icon: React.ReactNode; label: string; value: number; }
const StatCard = ({ icon, label, value }: StatCardProps) => (
  <Card>
    <CardContent className="p-4">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-semibold text-navy-deep">{value}</p>
    </CardContent>
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
  canContribute: boolean;
  canApprove: boolean;
}

const TreeRow = ({
  node, depth, childrenOf, expanded, onToggle, onAddChild, onBulkAddChild,
  onEdit, onDelete, onOpenInsights, counts, canContribute, canApprove,
}: TreeRowProps) => {
  const kids = childrenOf.get(node.id) ?? [];
  const isOpen = expanded.has(node.id);
  const c = counts.get(node.id) ?? { objectives: 0, initiatives: 0, documents: 0, users: 0 };
  const rollups: [string, string, number][] = [
    ["O", "objective", c.objectives],
    ["I", "initiative", c.initiatives],
    ["D", "document", c.documents],
    ["U", "user", c.users],
  ];

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-md py-1.5 pr-1 transition-colors hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 20 + 4}px` }}
      >
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0 text-muted-foreground"
          onClick={() => onToggle(node.id)}
          aria-label={isOpen ? "Collapse" : "Expand"}
          aria-expanded={kids.length > 0 ? isOpen : undefined}
          disabled={kids.length === 0}
        >
          {kids.length > 0 ? (
            isOpen ? <ChevronDown /> : <ChevronRight />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-border" />
          )}
        </Button>

        <ColorBadge color={ORG_TYPE_COLORS[node.type]}>{ORG_TYPE_LABELS[node.type]}</ColorBadge>

        <button
          type="button"
          onClick={() => onOpenInsights(node.id)}
          className="min-w-0 truncate text-left text-sm font-medium text-navy-deep decoration-dotted underline-offset-2 hover:underline"
          title="View roll-up insights"
        >
          {node.name}
        </button>

        <div className="ml-1 hidden items-center gap-1 sm:flex">
          {rollups.map(([letter, label, count]) =>
            count > 0 ? (
              <Badge
                key={letter}
                variant="secondary"
                className="px-1.5 text-[10px] font-medium"
                title={`${count} ${label}${count === 1 ? "" : "s"}`}
              >
                {letter} {count}
              </Badge>
            ) : null,
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => onOpenInsights(node.id)}
            aria-label="Insights"
          >
            <Info />
          </Button>

          {(canContribute || canApprove) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label="Unit actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {canContribute && (
                  <>
                    <DropdownMenuItem onSelect={() => onAddChild(node.id)}>
                      <Plus /> Add child
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onBulkAddChild(node.id)}>
                      <Layers /> Bulk add children
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onEdit(node)}>
                      <Pencil /> Edit
                    </DropdownMenuItem>
                  </>
                )}
                {canContribute && canApprove && <DropdownMenuSeparator />}
                {canApprove && (
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onSelect={() => onDelete(node.id)}
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {node.description && (
        <p className="pb-1 text-xs text-muted-foreground" style={{ paddingLeft: `${depth * 20 + 40}px` }}>
          {node.description}
        </p>
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
          canContribute={canContribute}
          canApprove={canApprove}
        />
      ))}
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
    <div>
      <h3 className="text-sm font-semibold text-navy-deep">Governance Map: Three Lines of Defense (3LoD)</h3>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
        The governance lines of defense across the organisation.
      </p>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">Line</TableHead>
              <TableHead>Org units</TableHead>
              <TableHead className="w-[28%]">People</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.lod} className="align-top">
                <TableCell>
                  <div className="text-sm font-semibold" style={{ color: `hsl(${LINE_OF_DEFENSE_COLORS[r.lod]})` }}>
                    {LINE_OF_DEFENSE_SHORT[r.lod]}
                  </div>
                  <div className="text-[11px] text-muted-foreground">({r.subtitle})</div>
                </TableCell>
                <TableCell>
                  {r.units.length === 0
                    ? <span className="text-xs italic text-muted-foreground">— none —</span>
                    : (
                      <div className="flex flex-wrap gap-1">
                        {r.units.map(u => (
                          <Badge key={u.id} variant="outline" className="text-[10px] font-normal">
                            {ORG_TYPE_LABELS[u.type]}: {u.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                </TableCell>
                <TableCell>
                  {r.userList.length === 0
                    ? <span className="text-xs italic text-muted-foreground">— none assigned —</span>
                    : (
                      <div className="flex flex-wrap gap-1">
                        {r.userList.map(u => (
                          <Badge key={u.id} variant="secondary" className="text-[10px] font-normal">
                            {u.title || u.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-navy-deep">Hierarchy Types</CardTitle>
        <CardDescription className="text-xs">
          The organisation structure API supports a fixed set of tiers (Group, Company, Department, Division, Section, Process, Sub-process). You can rename and recolour them here, but new custom tiers can't be added — org units are validated against this fixed list server-side.
        </CardDescription>
      </CardHeader>

      <CardContent className="divide-y divide-border">
        {types.map(t => {
          const inUse = usageByKey.get(t.key) ?? 0;
          return (
            <div key={t.key} className="flex flex-wrap items-center gap-2 py-2 first:pt-0 last:pb-0">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: `hsl(${t.color})` }}
                aria-hidden
              />
              <Input
                className="h-8 w-[180px]"
                value={t.label}
                aria-label={`Label for ${t.key}`}
                onChange={e => updateType(t.key, { label: e.target.value })}
              />
              <Select value={t.color} onValueChange={(v) => updateType(t.key, { color: v })}>
                <SelectTrigger className="h-8 w-[140px]" aria-label={`Colour for ${t.key}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_COLOR_PALETTE.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: `hsl(${p.value})` }} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.key}</span>
              {t.builtin && (
                <Badge variant="secondary" className="px-1.5 text-[10px] font-normal">Built-in</Badge>
              )}
              <Badge variant="secondary" className="px-1.5 text-[10px] font-normal" title="Number of units using this type">
                {inUse} in use
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto h-8 w-8 text-destructive hover:text-destructive disabled:opacity-30"
                onClick={() => removeType(t.key)}
                disabled={t.builtin || inUse > 0}
                aria-label={`Remove ${t.key} type`}
                title={t.builtin ? "Built-in" : inUse > 0 ? "Type is in use" : "Remove"}
              >
                <Trash2 />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default RiskGovernance;

