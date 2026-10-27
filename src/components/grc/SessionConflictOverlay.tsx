import { RefreshCw, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

/**
 * Blocking notice for a tab whose organization changed elsewhere.
 *
 * While this is visible the axios request interceptor rejects tenant requests,
 * so nothing this tab still holds can be written into the new organization.
 * There is intentionally no dismiss action: only a reload picks up the shared
 * session cleanly.
 */
export function SessionConflictOverlay() {
  const { sessionConflict } = useAuth();
  if (!sessionConflict) return null;

  const switched = sessionConflict.kind === "switched";
  const organization = sessionConflict.organizationName;
  const title = switched
    ? "This tab is out of date"
    : "A different account signed in";
  const body = switched
    ? `You switched to ${organization ?? "another organization"} in another tab. Reload this tab to continue with the new organization.`
    : "Someone signed in to another organization or account in another tab. Reload this tab to continue with the current session.";

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-conflict-title"
      aria-describedby="session-conflict-body"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-deep/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-foreground shadow-2xl">
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-warn/15 text-warn">
          <ShieldAlert className="h-6 w-6" aria-hidden />
        </span>
        <h2
          id="session-conflict-title"
          className="text-lg font-semibold tracking-tight text-navy-deep"
        >
          {title}
        </h2>
        <p id="session-conflict-body" className="mt-2 text-[13.5px] leading-relaxed text-brand-muted">
          {body}
        </p>
        <Button
          variant="brand"
          className="mt-5 h-auto w-full gap-2 rounded-[10px] py-2.5 text-[14px] font-semibold"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> Reload
        </Button>
      </div>
    </div>
  );
}
