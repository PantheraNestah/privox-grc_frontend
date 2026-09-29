import { FlaskConical } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Shown on modules whose data is still browser-local (no backend contract yet).
 * Makes the prototype scope explicit so users do not read local demo state as
 * organisation-wide, authoritative data.
 */
export function PrototypeNotice({ module }: { module: string }) {
  return (
    <Alert className="mb-5 border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200">
      <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle>Prototype module</AlertTitle>
      <AlertDescription className="text-xs">
        {module} is a local prototype: data is stored only in this browser, is not shared with other users or
        devices, and is not organisation-authoritative. It will be replaced once the backend module is available.
      </AlertDescription>
    </Alert>
  );
}
