import { useId, useState, type ReactNode } from "react";
import { AxiosError } from "axios";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PortalMismatchError } from "@/lib/auth-session";
import { cn } from "@/lib/utils";

export interface Credentials {
  identifier: string;
  password: string;
  rememberMe: boolean;
}

interface CredentialsFormProps {
  identifierPlaceholder: string;
  /** Prefix for the fallback error, e.g. "Login failed" -> "Login failed (500)". */
  failureLabel: string;
  onSubmit: (credentials: Credentials) => Promise<void>;
  onForgotPassword?: () => void;
  footer?: ReactNode;
}

const fieldInputCx = (invalid: boolean) =>
  cn(
    "h-auto rounded-[10px] border-[1.5px] bg-offwhite py-3 pl-10 pr-3 text-[14.5px] text-navy-deep md:text-[14.5px]",
    "focus-visible:border-brand-accent focus-visible:bg-white focus-visible:ring-[3px] focus-visible:ring-brand-accent/15 focus-visible:ring-offset-0",
    invalid && "border-destructive ring-[3px] ring-destructive/15",
  );

function errorMessage(err: unknown, failureLabel: string): string {
  if (err instanceof PortalMismatchError) return err.message;
  if (err instanceof AxiosError) {
    return (
      err.response?.data?.message ||
      err.response?.data?.error ||
      `${failureLabel} (${err.response?.status ?? "network error"})`
    );
  }
  return "An unexpected error occurred. Please try again.";
}

/**
 * Shared sign-in form for the tenant and platform-admin portals, built on the
 * shadcn `Input` / `Label` / `Checkbox` / `Button` / `Alert` primitives.
 */
export function CredentialsForm({
  identifierPlaceholder,
  failureLabel,
  onSubmit,
  onForgotPassword,
  footer,
}: CredentialsFormProps) {
  const uid = useId();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [invalid, setInvalid] = useState<{ identifier?: boolean; password?: boolean }>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next = { identifier: !identifier.trim(), password: !password };
    if (next.identifier || next.password) return setInvalid(next);

    setLoading(true);
    setInvalid({});
    setAlert(null);
    try {
      await onSubmit({ identifier: identifier.trim(), password, rememberMe });
    } catch (err) {
      setAlert(errorMessage(err, failureLabel));
    } finally {
      setLoading(false);
    }
  };

  const clearAlert = () => setAlert(null);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {alert && (
        <Alert variant="destructive" className="mb-4 flex items-center gap-2 py-2.5 text-[13px]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>{alert}</AlertDescription>
        </Alert>
      )}

      <div className="mb-4">
        <Label htmlFor={`${uid}-identifier`} className="mb-1.5 block text-[12.5px] text-navy-dark">
          Email or Username
        </Label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <Input
            id={`${uid}-identifier`}
            className={fieldInputCx(!!invalid.identifier)}
            placeholder={identifierPlaceholder}
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setInvalid((s) => ({ ...s, identifier: false }));
              clearAlert();
            }}
            autoComplete="username"
            aria-invalid={invalid.identifier}
          />
        </div>
        {invalid.identifier && (
          <p className="mt-1 text-xs text-destructive">Email or username is required.</p>
        )}
      </div>

      <div className="mb-4">
        <Label htmlFor={`${uid}-password`} className="mb-1.5 block text-[12.5px] text-navy-dark">
          Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <Input
            id={`${uid}-password`}
            type={showPassword ? "text" : "password"}
            className={cn(fieldInputCx(!!invalid.password), "pr-10")}
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setInvalid((s) => ({ ...s, password: false }));
              clearAlert();
            }}
            autoComplete="current-password"
            aria-invalid={invalid.password}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted transition hover:text-brand-accent"
            aria-label="Toggle password"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {invalid.password && <p className="mt-1 text-xs text-destructive">Password is required.</p>}
      </div>

      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${uid}-remember`}
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
          />
          <Label
            htmlFor={`${uid}-remember`}
            className="cursor-pointer select-none text-[13px] font-normal text-brand-muted"
          >
            Remember me
          </Label>
        </div>
        {onForgotPassword && (
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-[13px] font-medium text-brand-accent transition hover:text-navy"
          >
            Forgot password?
          </button>
        )}
      </div>

      <Button
        type="submit"
        disabled={loading}
        className={cn(
          "h-auto w-full rounded-[10px] py-3 text-[15px] font-semibold text-white shadow-button transition",
          "bg-gradient-primary hover:bg-gradient-primary hover:-translate-y-px hover:opacity-90 hover:shadow-card-hover active:translate-y-0",
          "disabled:transform-none disabled:opacity-60",
        )}
      >
        {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-label="Signing in" /> : "Sign In"}
      </Button>

      {footer}
    </form>
  );
}
