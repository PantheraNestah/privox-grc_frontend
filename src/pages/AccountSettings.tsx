import { useState, type ComponentProps } from "react";
import { Helmet } from "react-helmet-async";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/grc/common/PageHeader";
import { TENANT_HOME } from "@/components/grc/common/home-links";
import { useChangePassword } from "@/hooks/use-account";

interface FieldErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const PasswordInput = ({ className, ...props }: Omit<ComponentProps<typeof Input>, "type">) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className={`pr-10 ${className ?? ""}`} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};

const AccountSettings = () => {
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setErrors({});
  };

  const submit = async () => {
    const next: FieldErrors = {};
    if (!currentPassword) next.currentPassword = "Enter your current password.";
    if (newPassword.length < 8) next.newPassword = "Password must be at least 8 characters.";
    if (newPassword && newPassword === currentPassword) {
      next.newPassword = "Choose a password different from your current one.";
    }
    if (newPassword !== confirmPassword) next.confirmPassword = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      await changePassword.mutateAsync({ currentPassword, newPassword, confirmPassword });
      toast.success("Password changed successfully.");
      reset();
    } catch (err) {
      const status = (err as { response?: { status?: number } } | null)?.response?.status;
      if (status === 400) {
        setErrors({ currentPassword: "Your current password is incorrect." });
      } else if (status === 401) {
        toast.error("Your session has expired. Please sign in again.");
      } else {
        const message = (err as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;
        toast.error(message || "Couldn't change your password. Please try again.");
      }
    }
  };

  return (
    <>
      <Helmet>
        <title>Account Settings · Rsolve GRC Platform</title>
        <meta name="description" content="Change your own account password." />
        <link rel="canonical" href="/settings/account" />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[{ label: "Settings" }, { label: "Account" }]}
        title="Account Settings"
        description="Manage your own sign-in credentials. This does not affect other members of your organization."
      />

      <Alert className="mb-5 py-2.5">
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Changing your password signs you out of other sessions and cannot be undone. Contact an administrator
          if you have lost access to your account.
        </AlertDescription>
      </Alert>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-navy-deep">
            <KeyRound className="h-4 w-4 text-brand-accent" /> Change password
          </CardTitle>
          <CardDescription className="text-xs">
            Enter your current password, then choose a new one of at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <PasswordInput
                id="current-password"
                autoComplete="current-password"
                value={currentPassword}
                aria-invalid={!!errors.currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setErrors((s) => ({ ...s, currentPassword: undefined }));
                }}
              />
              {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                value={newPassword}
                aria-invalid={!!errors.newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setErrors((s) => ({ ...s, newPassword: undefined }));
                }}
              />
              {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                aria-invalid={!!errors.confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrors((s) => ({ ...s, confirmPassword: undefined }));
                }}
              />
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="brand"
                disabled={changePassword.isPending || !currentPassword || !newPassword || !confirmPassword}
              >
                {changePassword.isPending && <Loader2 className="animate-spin" />} Update password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
};

export default AccountSettings;
