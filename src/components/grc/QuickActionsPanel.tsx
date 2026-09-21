import { useState } from "react";
import { MoreHorizontal, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DEFAULT_QUICK_ACTIONS,
  ICON_BY_KEY,
  QUICK_ACTION_COLORS,
  QUICK_ACTION_ICONS,
  type QuickAction,
} from "@/data/quickActions";
import { MODULES, type ModuleDef } from "@/data/modules";

interface Props {
  modules?: ModuleDef[];
  onActionClick: (action: QuickAction) => void;
}

const emptyDraft: QuickAction = {
  id: "",
  title: "",
  description: "",
  iconKey: "zap",
  color: QUICK_ACTION_COLORS[0].value,
  moduleId: "",
};

export const QuickActionsPanel = ({ modules = MODULES, onActionClick }: Props) => {
  const [actions, setActions] = useState<QuickAction[]>(DEFAULT_QUICK_ACTIONS);
  const [editing, setEditing] = useState<QuickAction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const moduleOptions = modules.map((m) => ({ value: m.id, label: m.name }));

  const openNew = () => setEditing({ ...emptyDraft, id: `qa-${Date.now()}` });

  const save = (draft: QuickAction) => {
    if (!draft.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const exists = actions.some((a) => a.id === draft.id);
    setActions((prev) => (exists ? prev.map((p) => (p.id === draft.id ? draft : p)) : [...prev, draft]));
    setEditing(null);
    toast.success(exists ? "Quick action updated" : "Quick action created");
  };

  const remove = () => {
    if (!deleteId) return;
    setActions((prev) => prev.filter((a) => a.id !== deleteId));
    setDeleteId(null);
    toast.success("Quick action removed");
  };

  return (
    <Card className="self-start">
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base text-navy-deep">Quick actions</CardTitle>
          <CardDescription className="text-xs">Customise your shortcuts.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" className="text-brand-accent hover:text-navy" onClick={openNew}>
          <Plus /> New
        </Button>
      </CardHeader>

      <CardContent className="space-y-1 p-3 pt-0">
        {actions.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No quick actions yet.{" "}
            <button onClick={openNew} className="font-medium text-brand-accent hover:underline">
              Create your first one
            </button>
            .
          </p>
        )}
        {actions.map((action) => (
          <QuickActionRow
            key={action.id}
            action={action}
            modules={modules}
            onClick={() => onActionClick(action)}
            onEdit={() => setEditing(action)}
            onDelete={() => setDeleteId(action.id)}
          />
        ))}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[460px]">
          {editing && (
            <ActionForm
              draft={editing}
              moduleOptions={moduleOptions}
              onChange={setEditing}
              onSave={() => save(editing)}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this quick action?</AlertDialogTitle>
            <AlertDialogDescription>This shortcut will be permanently removed from your dashboard.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

/* ---------- Row ---------- */

const QuickActionRow = ({
  action,
  modules,
  onClick,
  onEdit,
  onDelete,
}: {
  action: QuickAction;
  modules: ModuleDef[];
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const Icon = ICON_BY_KEY[action.iconKey] ?? ICON_BY_KEY.zap ?? Zap;
  const moduleLabel = action.moduleId ? modules.find((m) => m.id === action.moduleId)?.name : null;

  return (
    <div className="flex items-start gap-1 rounded-lg transition-colors hover:bg-muted/60">
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-start gap-3 p-2 text-left">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `hsl(${action.color} / 0.12)` }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: `hsl(${action.color})` }} strokeWidth={1.7} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-navy-deep">{action.title}</span>
          {action.description && (
            <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{action.description}</span>
          )}
          {moduleLabel && (
            <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {moduleLabel}
            </span>
          )}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="mt-1 h-8 w-8 shrink-0 text-muted-foreground"
            aria-label={`Actions for ${action.title}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            onSelect={onDelete}
          >
            <Trash2 /> Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

/* ---------- Form ---------- */

const ActionForm = ({
  draft,
  moduleOptions,
  onChange,
  onSave,
  onCancel,
}: {
  draft: QuickAction;
  moduleOptions: { value: string; label: string }[];
  onChange: (d: QuickAction) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  const set = <K extends keyof QuickAction>(k: K, v: QuickAction[K]) => onChange({ ...draft, [k]: v });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <DialogHeader>
        <DialogTitle>{draft.title ? "Edit quick action" : "New quick action"}</DialogTitle>
        <DialogDescription>Configure a shortcut that appears on your dashboard.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-1.5">
          <Label htmlFor="qa-title">Title</Label>
          <Input
            id="qa-title"
            placeholder="e.g. Log Risk"
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qa-desc">Description</Label>
          <Textarea
            id="qa-desc"
            placeholder="Short helper text shown on the shortcut"
            rows={2}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qa-mod">Linked module</Label>
          <Select value={draft.moduleId || "none"} onValueChange={(v) => set("moduleId", v === "none" ? "" : v)}>
            <SelectTrigger id="qa-mod">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No module</SelectItem>
              {moduleOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Icon</Label>
          <div className="grid grid-cols-8 gap-1 rounded-lg border border-border p-2">
            {QUICK_ACTION_ICONS.map(({ key, icon: Ic, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => set("iconKey", key)}
                title={label}
                aria-label={label}
                aria-pressed={draft.iconKey === key}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md transition-colors",
                  draft.iconKey === key
                    ? "bg-brand-accent/15 text-brand-accent ring-2 ring-brand-accent"
                    : "text-muted-foreground hover:bg-muted hover:text-navy-deep",
                )}
              >
                <Ic className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Accent colour</Label>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTION_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => set("color", c.value)}
                title={c.label}
                aria-label={c.label}
                aria-pressed={draft.color === c.value}
                className={cn(
                  "h-8 w-8 rounded-full ring-offset-2 ring-offset-background transition",
                  draft.color === c.value ? "ring-2 ring-navy-deep" : "hover:scale-105",
                )}
                style={{ background: `hsl(${c.value})` }}
              />
            ))}
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="brand">
          Save
        </Button>
      </DialogFooter>
    </form>
  );
};
