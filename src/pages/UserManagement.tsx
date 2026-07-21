import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronRight, Plus, Pencil, Trash2, Users, ShieldAlert } from "lucide-react";
import { TopNav } from "@/components/grc/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  loadUsers, saveUsers, newUser, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_COLORS,
  can, type AppUser, type UserRole,
} from "@/data/userStore";
import { useActiveUser } from "@/hooks/use-active-user";
import { loadOrgNodes, ORG_TYPE_LABELS, type OrgNode } from "@/data/orgStore";

const ROLES: UserRole[] = ["admin", "input_user", "approver", "risk_manager", "executive"];

const UserManagement = () => {
  const activeUser = useActiveUser();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [dialog, setDialog] = useState<{ user: AppUser; isNew: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null);

  useEffect(() => {
    setUsers(loadUsers());
    setOrgNodes(loadOrgNodes());
  }, []);

  const persist = (next: AppUser[]) => {
    setUsers(next);
    saveUsers(next);
    window.dispatchEvent(new CustomEvent("rsolve:active-user-changed"));
  };

  const orgNodeMap = useMemo(() => new Map(orgNodes.map(n => [n.id, n])), [orgNodes]);

  const isAdmin = can.manageUsers(activeUser.role);

  const handleSave = (u: AppUser, isNew: boolean) => {
    if (!u.name.trim()) { toast.error("Name is required"); return; }
    if (!u.email.trim()) { toast.error("Email is required"); return; }
    const next = isNew ? [...users, u] : users.map(x => x.id === u.id ? u : x);
    persist(next);
    setDialog(null);
    toast.success(isNew ? "User added" : "User updated");
  };

  const handleDelete = (u: AppUser) => {
    if (u.role === "admin" && users.filter(x => x.role === "admin").length === 1) {
      toast.error("Cannot delete the last administrator");
      return;
    }
    persist(users.filter(x => x.id !== u.id));
    setConfirmDelete(null);
    toast.success("User removed");
  };

  const counts = useMemo(() => {
    const c: Record<UserRole, number> = { admin: 0, input_user: 0, approver: 0, risk_manager: 0, executive: 0 };
    users.forEach(u => { c[u.role]++; });
    return c;
  }, [users]);

  return (
    <>
      <Helmet>
        <title>User Management · Rsolve GRC Platform</title>
        <meta name="description" content="Manage users, assign roles and link them to the Risk Governance organisation structure." />
        <link rel="canonical" href="/settings/users" />
      </Helmet>

      <div className="flex flex-col min-h-screen">
        <TopNav />

        <main className="flex-1 px-5 md:px-10 py-8 md:py-9">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">User Management</span>
          </nav>

          <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[25px] font-semibold tracking-tight text-foreground">User Management</h1>
              <p className="text-[13.5px] text-muted-foreground mt-0.5 max-w-2xl">
                Create users, assign their role and link them to a unit in the Risk Governance hierarchy.
                Roles control who can build the strategic plan, submit assessments and approve.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard">
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                </Link>
              </Button>
              {isAdmin && (
                <Button size="sm" onClick={() => setDialog({ user: newUser(), isNew: true })} className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-1.5" /> Add User
                </Button>
              )}
            </div>
          </header>

          {!isAdmin && (
            <Card className="p-4 mb-5 border-warn/40 bg-warn/5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-warn mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Read-only view</p>
                  <p className="text-xs text-muted-foreground">Only administrators can add, edit or remove users. Use the user switcher in the top-right to preview as an admin.</p>
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            {ROLES.map(r => (
              <Card key={r} className="p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: `hsl(${ROLE_COLORS[r]})` }} />
                  {ROLE_LABELS[r]}
                </div>
                <p className="text-2xl font-semibold text-foreground">{counts[r]}</p>
              </Card>
            ))}
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">All users</h2>
              <Badge variant="secondary" className="text-[10px]">{users.length}</Badge>
            </div>

            {users.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground">No users yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold">Name</th>
                      <th className="text-left px-4 py-2 font-semibold">Email</th>
                      <th className="text-left px-4 py-2 font-semibold">Role</th>
                      <th className="text-left px-4 py-2 font-semibold">Org Unit</th>
                      <th className="text-right px-4 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => {
                      const node = u.orgNodeId ? orgNodeMap.get(u.orgNodeId) : null;
                      return (
                        <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-foreground">{u.name || "—"}</p>
                            {u.title && <p className="text-[11px] text-muted-foreground">{u.title}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1"
                              style={{
                                background: `hsl(${ROLE_COLORS[u.role]} / 0.12)`,
                                borderColor: `hsl(${ROLE_COLORS[u.role]} / 0.4)`,
                                color: `hsl(${ROLE_COLORS[u.role]})`,
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${ROLE_COLORS[u.role]})` }} />
                              {ROLE_LABELS[u.role]}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            {node ? (
                              <span className="inline-flex items-center gap-1.5 text-xs">
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{ORG_TYPE_LABELS[node.type]}</span>
                                <span className="text-foreground">{node.name}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {isAdmin && (
                              <>
                                <Button size="icon" variant="ghost" className="h-7 w-7"
                                  onClick={() => setDialog({ user: u, isNew: false })} aria-label="Edit">
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                  onClick={() => setConfirmDelete(u)} aria-label="Delete">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-4 mt-5">
            <h3 className="text-sm font-semibold text-foreground mb-2">Role definitions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {ROLES.map(r => (
                <div key={r} className="flex items-start gap-2.5 p-2.5 rounded-md border border-border bg-muted/20">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: `hsl(${ROLE_COLORS[r]})` }} />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{ROLE_LABELS[r]}</p>
                    <p className="text-[11px] text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </main>
      </div>

      <UserDialog
        state={dialog}
        orgNodes={orgNodes}
        onClose={() => setDialog(null)}
        onSave={handleSave}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{confirmDelete?.name}</strong>. Their submitted assessments and approval decisions will remain on record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const UserDialog = ({ state, orgNodes, onClose, onSave }: {
  state: { user: AppUser; isNew: boolean } | null;
  orgNodes: OrgNode[];
  onClose: () => void;
  onSave: (u: AppUser, isNew: boolean) => void;
}) => {
  const [draft, setDraft] = useState<AppUser | null>(null);
  useEffect(() => { setDraft(state?.user ?? null); }, [state]);
  if (!draft || !state) return null;

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{state.isNew ? "Add user" : "Edit user"}</DialogTitle>
          <DialogDescription>
            Set their name, role and (optionally) the organisation unit they belong to.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Full name *</Label>
              <Input id="u-name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Jane Smith" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-title">Job title</Label>
              <Input id="u-title" value={draft.title ?? ""} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Risk Analyst" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-email">Email *</Label>
            <Input id="u-email" type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder="user@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-role">Role *</Label>
            <Select value={draft.role} onValueChange={(v) => setDraft({ ...draft, role: v as UserRole })}>
              <SelectTrigger id="u-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(r => (
                  <SelectItem key={r} value={r}>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: `hsl(${ROLE_COLORS[r]})` }} />
                      {ROLE_LABELS[r]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{ROLE_DESCRIPTIONS[draft.role]}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-org">Organisation unit (optional)</Label>
            <Select
              value={draft.orgNodeId ?? "__none__"}
              onValueChange={(v) => setDraft({ ...draft, orgNodeId: v === "__none__" ? undefined : v })}
            >
              <SelectTrigger id="u-org">
                <SelectValue placeholder="No unit assigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— No unit assigned —</SelectItem>
                {orgNodes
                  .filter(n => n.type !== "process" && n.type !== "subprocess")
                  .map(n => (
                    <SelectItem key={n.id} value={n.id}>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1.5">{ORG_TYPE_LABELS[n.type]}</span>
                      {n.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Required for Input Users and Approvers. Admins, Risk Managers and Executives don't need a unit.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft, state.isNew)} className="bg-primary hover:bg-primary/90">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserManagement;
