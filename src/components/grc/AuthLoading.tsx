import { Loader2 } from "lucide-react";

/** Full-screen placeholder shown while a stored session is being restored. */
export function AuthLoading() {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-brand-accent" aria-hidden />
      <span className="sr-only">Restoring your session…</span>
    </div>
  );
}
