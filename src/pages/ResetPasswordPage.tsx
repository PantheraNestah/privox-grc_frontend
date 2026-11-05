import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, ViewHeader } from "@/components/grc/auth-bits";
import { errorMessage, resetPassword } from "@/lib/password-reset";
import { cn } from "@/lib/utils";

/**
 * Target of the link in the password-reset e-mail: `/reset-password?token=...`.
 * The token is single use. A successful reset revokes every session, so the
 * user signs in again on each device.
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <KeyRound className="h-7 w-7" />
          </div>
          <ViewHeader
            tag="Password Reset"
            title="Invalid reset link"
            sub="This link is incomplete. Open the full link from your password reset email, or request a new one."
            center
          />
          <Button variant="outline" className="w-full" asChild>
            <Link to="/">Back to sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell>
        <div className="text-center">
          <span className="mx-auto mb-6 flex h-[68px] w-[68px] items-center justify-center rounded-full border-2 border-success/30 bg-success/10">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </span>
          <ViewHeader
            tag="Password Reset"
            title="Password updated"
            sub="Your password has been changed. Sign in with the new password."
            center
          />
          <Button variant="brand" className="w-full py-3" asChild>
            <Link to="/">Sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (password.length < 8) next.password = "Password must be at least 8 characters.";
    else if (password.length > 128) next.password = "Password must be at most 128 characters.";
    if (password !== confirm) next.confirm = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setServerError(null);
    try {
      await resetPassword({ token, newPassword: password, confirmPassword: confirm });
      setDone(true);
    } catch (err) {
      // 400: unknown, used or expired token, or a mismatch. 409: deactivated account.
      setServerError(
        errorMessage(err, "This reset link is invalid or has expired. Request a new one."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <form noValidate onSubmit={submit}>
        <ViewHeader
          tag="New Password"
          title="Set a new password"
          sub="Choose a password of 8 to 128 characters."
        />
        {serverError && (
          <Alert variant="destructive" className="mb-4 flex items-center gap-2 py-2.5 text-[13px]">
            <XCircle className="h-4 w-4 shrink-0" />
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <div className="mb-4">
          <Label htmlFor="reset-password" className="mb-1.5 block text-[12.5px] text-navy-dark">
            New password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <Input
              id="reset-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className={cn(
                "h-auto rounded-[10px] border-[1.5px] bg-offwhite py-3 pl-10 pr-10 text-[14.5px] text-navy-deep",
                errors.password && "border-destructive ring-[3px] ring-destructive/15",
              )}
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((s) => ({ ...s, password: undefined }));
              }}
              aria-invalid={!!errors.password || undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted transition hover:text-brand-accent"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
        </div>
        <div className="mb-5">
          <Label htmlFor="reset-confirm" className="mb-1.5 block text-[12.5px] text-navy-dark">
            Confirm new password
          </Label>
          <Input
            id="reset-confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            className={cn(
              "h-auto rounded-[10px] border-[1.5px] bg-offwhite py-3 px-3 text-[14.5px] text-navy-deep",
              errors.confirm && "border-destructive ring-[3px] ring-destructive/15",
            )}
            placeholder="Re-enter password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setErrors((s) => ({ ...s, confirm: undefined }));
            }}
            aria-invalid={!!errors.confirm || undefined}
          />
          {errors.confirm && <p className="mt-1 text-xs text-destructive">{errors.confirm}</p>}
        </div>
        <Button
          type="submit"
          variant="brand"
          disabled={submitting}
          className="h-auto w-full rounded-[10px] py-3 text-[15px] font-semibold"
        >
          {submitting ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-label="Please wait" /> : "Reset Password"}
        </Button>
        {!serverError && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-brand-muted">
            <AlertCircle className="h-3.5 w-3.5" /> The link works once and expires after 30 minutes.
          </p>
        )}
      </form>
    </AuthShell>
  );
}
