import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useAuth, type LoginResult } from "@/contexts/AuthContext";
import { AuthShell, ViewHeader, Steps } from "@/components/grc/auth-bits";
import { CredentialsForm } from "@/components/grc/CredentialsForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage, requestPasswordReset } from "@/lib/password-reset";
import { cn } from "@/lib/utils";

type View = "login" | "fp-email" | "fp-sent";

const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export const AuthScreen = ({ organizationHint }: { organizationHint?: string }) => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("login");
  const [animating, setAnimating] = useState(false);

  const go = (next: View) => {
    if (next === view) return;
    setAnimating(true);
    setTimeout(() => {
      setView(next);
      setAnimating(false);
    }, 200);
  };

  const onSignedIn = (result: LoginResult) => {
    // A multi-organization user must choose before there is a session to use.
    navigate(result.status === "organization-required" ? "/choose-organization" : "/dashboard");
  };

  return (
    <AuthShell animating={animating} formKey={view}>
      {view === "login" && (
        <LoginView go={go} onSuccess={onSignedIn} organizationHint={organizationHint} />
      )}
      {view === "fp-email" && <ForgotEmailView go={go} />}
      {view === "fp-sent" && <ForgotSentView go={go} />}
    </AuthShell>
  );
};

/* ---------- Login ---------- */

const LoginView = ({
  go,
  onSuccess,
  organizationHint,
}: {
  go: (v: View) => void;
  onSuccess: (result: LoginResult) => void;
  organizationHint?: string;
}) => {
  const { login, authNotice, clearAuthNotice } = useAuth();

  return (
    <div>
      <ViewHeader title="Welcome back" sub="Sign in to your organisation's GRC workspace." />

      <CredentialsForm
        identifierPlaceholder="you@organisation.com"
        failureLabel="Login failed"
        notice={authNotice}
        onDismissNotice={clearAuthNotice}
        onForgotPassword={() => go("fp-email")}
        onSubmit={async (credentials) => {
          const result = await login({ ...credentials, organizationId: organizationHint });
          onSuccess(result);
        }}
        footer={
          <>
            <p className="text-center text-xs text-brand-muted mt-4">
              Don't have access? Contact your <strong className="text-navy-dark font-medium">GRC Administrator</strong>.
            </p>
            <p className="text-center text-xs text-brand-muted mt-3">
              Platform operator?{" "}
              <Link to="/platform/login" className="text-brand-accent font-medium hover:text-navy transition">
                Sign in to Platform Admin
              </Link>
            </p>
          </>
        }
      />
    </div>
  );
};

/* ---------- Shared bits for the forgot-password flow ---------- */

const fieldInputCx = (invalid?: boolean) =>
  cn(
    "h-auto rounded-[10px] border-[1.5px] bg-offwhite py-3 pl-10 pr-3 text-[14.5px] text-navy-deep md:text-[14.5px]",
    "focus-visible:border-brand-accent focus-visible:bg-white focus-visible:ring-[3px] focus-visible:ring-brand-accent/15 focus-visible:ring-offset-0",
    invalid && "border-destructive ring-[3px] ring-destructive/15",
  );

const SubmitButton = ({ loading, children }: { loading?: boolean; children: string }) => (
  <Button type="submit" variant="brand" disabled={loading} className="h-auto w-full rounded-[10px] py-3 text-[15px] font-semibold">
    {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-label="Please wait" /> : children}
  </Button>
);

const BackLink = ({ onClick, children }: { onClick: () => void; children: string }) => (
  <button
    type="button"
    onClick={onClick}
    className="mb-6 flex items-center gap-1.5 text-[13.5px] text-muted-foreground transition hover:text-navy"
  >
    <ArrowLeft className="h-4 w-4" /> {children}
  </button>
);

const FieldError = ({ children }: { children?: string }) =>
  children ? <p className="mt-1 text-xs text-destructive">{children}</p> : null;

/* ---------- Forgot: request the reset link ---------- */

const ForgotEmailView = ({ go }: { go: (v: View) => void }) => {
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!isEmail(email.trim())) return setInvalid(true);
    setLoading(true);
    setServerError(null);
    try {
      // The server answers the same way whether or not the account exists.
      await requestPasswordReset(email.trim());
      go("fp-sent");
    } catch (err) {
      setServerError(errorMessage(err, "We could not send the reset link. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <BackLink onClick={() => go("login")}>Back to sign in</BackLink>
      <Steps step={1} />
      <ViewHeader
        tag="Password Reset"
        title="Forgot your password?"
        sub="Enter the email address on your account. If it exists, we will send a link to set a new password."
      />
      {serverError && (
        <Alert variant="destructive" className="mb-4 flex items-center gap-2 py-2.5 text-[13px]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <div className="mb-4">
        <Label htmlFor="fp-email" className="mb-1.5 block text-[12.5px] text-navy-dark">
          Email address
        </Label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <Input
            id="fp-email"
            type="email"
            autoComplete="email"
            className={fieldInputCx(invalid)}
            placeholder="you@yourorganisation.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setInvalid(false);
            }}
            aria-invalid={invalid || undefined}
          />
        </div>
        {invalid && <FieldError>Please enter a valid email address.</FieldError>}
      </div>
      <SubmitButton loading={loading}>Send Reset Link</SubmitButton>
    </form>
  );
};

/* ---------- Forgot: link sent ---------- */

const ForgotSentView = ({ go }: { go: (v: View) => void }) => (
  <div className="text-center">
    <span className="mx-auto mb-6 flex h-[68px] w-[68px] items-center justify-center rounded-full border-2 border-success/30 bg-success/10">
      <CheckCircle2 className="h-8 w-8 text-success" />
    </span>
    <ViewHeader
      tag="Password Reset"
      title="Check your email"
      sub="If an account exists for that address, password reset instructions have been sent. The link expires after 30 minutes and works once."
      center
    />
    <Button variant="brand" onClick={() => go("login")} className="h-auto w-full rounded-[10px] py-3 text-[15px] font-semibold">
      Back to Sign In
    </Button>
  </div>
);
