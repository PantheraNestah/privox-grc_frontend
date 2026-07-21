import { useState } from "react";
import { Plus, Pencil, Trash2, ArrowRight, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  QUICK_ACTION_ICONS, QUICK_ACTION_COLORS, ICON_BY_KEY,
  type QuickAction, DEFAULT_QUICK_ACTIONS,
} from "@/data/quickActions";
import { MODULES, MODULE_OPTIONS } from "@/data/modules";

interface Props {
  onActionClick: (action: QuickAction) => void;
}

const emptyDraft: QuickAction = {
  id: "", title: "", description: "", iconKey: "zap", color: QUICK_ACTION_COLORS[0].value, moduleId: "",
};

export const QuickActionsPanel = ({ onActionClick }: Props) => {
  const [actions, setActions] = useState<QuickAction[]>(DEFAULT_QUICK_ACTIONS);
  const [editing, setEditing] = useState<QuickAction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNew = () => setEditing({ ...emptyDraft, id: `qa-${Date.now()}` });
  const openEdit = (a: QuickAction) => setEditing(a);

  const save = (draft: QuickAction) => {
    if (!draft.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setActions(prev => {
      const exists = prev.some(p => p.id === draft.id);
      return exists ? prev.map(p => p.id === draft.id ? draft : p) : [...prev, draft];
    });
    setEditing(null);
    toast.success(actions.some(a => a.id === draft.id) ? "Quick action updated" : "Quick action created");
  };

  const remove = () => {
    if (!deleteId) return;
    setActions(prev => prev.filter(a => a.id !== deleteId));
    setDeleteId(null);
    toast.success("Quick action removed");
  };

  return (
    <aside className="bg-card rounded-2xl border border-brand-accent/10 shadow-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-navy-deep flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-brand-accent" /> Quick Actions
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">Customise your shortcuts</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1 text-xs font-medium text-brand-accent hover:text-navy transition px-2 py-1 rounded-md hover:bg-brand-accent/10">
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      <div className="space-y-3">
        {actions.length === 0 && (
          <div className="text-center py-8 text-sm text-brand-muted">
            No quick actions yet. <button onClick={openNew} className="text-brand-accent font-medium hover:underline">Create your first one</button>.
          </div>
        )}
        {actions.map((a, i) => (
          <QuickActionCard key={a.id} action={a} index={i}
            onClick={() => onActionClick(a)}
            onEdit={() => openEdit(a)}
            onDelete={() => setDeleteId(a.id)}
          />
        ))}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-[460px]">
          {editing && <ActionForm draft={editing} onChange={setEditing} onSave={() => save(editing)} onCancel={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this quick action?</AlertDialogTitle>
            <AlertDialogDescription>This shortcut will be permanently removed from your dashboard.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
};

/* ---------- Quick action card ---------- */

const QuickActionCard = ({
  action, index, onClick, onEdit, onDelete,
}: { action: QuickAction; index: number; onClick: () => void; onEdit: () => void; onDelete: () => void }) => {
  const Icon = ICON_BY_KEY[action.iconKey] ?? ICON_BY_KEY.zap;
  const moduleLabel = action.moduleId ? MODULES.find(m => m.id === action.moduleId)?.name : null;

  return (
    <div
      className="group relative rounded-xl border border-brand-accent/10 bg-offwhite/70 p-3.5 transition-all hover:border-brand-accent/30 hover:shadow-card animate-card-in"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <button onClick={onClick} className="w-full text-left flex items-start gap-3">
        <span
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
          style={{ background: `hsl(${action.color} / 0.12)` }}
        >
          <Icon className="w-5 h-5" style={{ color: `hsl(${action.color})` }} strokeWidth={1.7} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13.5px] font-semibold text-navy-deep truncate">{action.title}</span>
            <ArrowRight className="w-3 h-3 text-brand-muted transition-transform group-hover:translate-x-0.5" />
          </div>
          {action.description && (
            <p className="text-[11.5px] text-brand-muted leading-snug mt-0.5 line-clamp-2">{action.description}</p>
          )}
          {moduleLabel && (
            <span className="inline-block mt-1.5 text-[10px] font-mono text-brand-muted bg-surface px-1.5 py-0.5 rounded">
              {moduleLabel}
            </span>
          )}
        </div>
      </button>

      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1 rounded text-brand-muted hover:text-brand-accent hover:bg-white" aria-label="Edit">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={onDelete} className="p-1 rounded text-brand-muted hover:text-destructive hover:bg-white" aria-label="Delete">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

/* ---------- Form ---------- */

const ActionForm = ({
  draft, onChange, onSave, onCancel,
}: { draft: QuickAction; onChange: (d: QuickAction) => void; onSave: () => void; onCancel: () => void }) => {
  const set = <K extends keyof QuickAction>(k: K, v: QuickAction[K]) => onChange({ ...draft, [k]: v });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{draft.title ? "Edit quick action" : "New quick action"}</DialogTitle>
        <DialogDescription>Configure a shortcut that appears on your dashboard.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div>
          <Label htmlFor="qa-title">Title</Label>
          <Input id="qa-title" placeholder="e.g. Log Risk" value={draft.title} onChange={e => set("title", e.target.value)} />
        </div>

        <div>
          <Label htmlFor="qa-desc">Description</Label>
          <Textarea id="qa-desc" placeholder="Short helper text shown on the box" rows={2} value={draft.description} onChange={e => set("description", e.target.value)} />
        </div>

        <div>
          <Label htmlFor="qa-mod">Linked module</Label>
          <Select value={draft.moduleId || "none"} onValueChange={v => set("moduleId", v === "none" ? "" : v)}>
            <SelectTrigger id="qa-mod"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No module</SelectItem>
              {MODULE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Icon</Label>
          <div className="grid grid-cols-8 gap-1.5 mt-1.5 p-2 rounded-lg border bg-offwhite/60">
            {QUICK_ACTION_ICONS.map(({ key, icon: Ic, label }) => (
              <button key={key} type="button" onClick={() => set("iconKey", key)} title={label}
                className={cn(
                  "aspect-square rounded-md flex items-center justify-center transition",
                  draft.iconKey === key
                    ? "bg-brand-accent/15 text-brand-accent ring-2 ring-brand-accent"
                    : "text-brand-muted hover:bg-white hover:text-navy"
                )}>
                <Ic className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Accent colour</Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {QUICK_ACTION_COLORS.map(c => (
              <button key={c.value} type="button" onClick={() => set("color", c.value)} title={c.label}
                className={cn(
                  "w-8 h-8 rounded-full transition ring-offset-2 ring-offset-background",
                  draft.color === c.value ? "ring-2 ring-navy-deep scale-110" : "hover:scale-105"
                )}
                style={{ background: `hsl(${c.value})` }}
                aria-label={c.label}
              />
            ))}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave} className="bg-gradient-primary text-white">Save</Button>
      </DialogFooter>
    </>
  );
};
