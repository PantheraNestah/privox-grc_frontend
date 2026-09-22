import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

/**
 * "Install app" action, shown only when the browser has offered an install
 * prompt (i.e. the PWA criteria are met and it isn't already installed).
 */
export function InstallAppButton() {
  const { canInstall, promptInstall } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <Button
      variant="outline"
      onClick={async () => {
        const outcome = await promptInstall();
        if (outcome === "accepted") toast.success("Installing Rsolve GRC…");
      }}
    >
      <Smartphone /> Install app
    </Button>
  );
}
