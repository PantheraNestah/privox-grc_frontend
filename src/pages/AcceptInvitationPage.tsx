import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, ViewHeader } from "@/components/grc/auth-bits";
import { useAuth } from "@/contexts/AuthContext";
import { useAcceptInvitation, useInvitationDetails } from "@/hooks/use-organization";
import { cn } from "@/lib/utils";

// ─── Password strength ────────────────────────────────────

const STRENGTH_LEVELS = [
  { width: "0%", bar: "bg-transparent", label: "—", text: "text-muted-foreground" },
  { width: "25%", bar: "bg-destructive", label: "Weak", text: "text-destructive" },
  { width: "50%", bar: "bg-amber-500", label: "Fair", text: "text-amber-600" },
  { width: "75%", bar: "bg-blue-600", label: "Good", text: "text-blue-600" },
  { width: "100%", bar: "bg-emerald-600", label: "Strong", text: "text-emerald-600" },
] as const;

function calculatePasswordScore(pw: string): number {
  return [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
}

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

function messageOf(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
    ?? (error as { message?: string })?.message;
  return message || fallback;
}

// ─── Page ─────────────────────────────────────────────────

const AcceptInvitationPage = () => {
  const [searchParams] = useSearchParams();
  const rawToken = searchParams.get("token")?.trim() ?? "";
  const navigate = useNavigate();
  const auth = useAuth();

  const invitationQuery = useInvitationDetails(rawToken || null);
  const acceptMutation = useAcceptInvitation(rawToken);

  // New-user registration state
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Existing-user sign-in state
  const [existingPassword, setExistingPassword] = useState("");
  const [showExistingPassword, setShowExistingPassword] = useState(false);
  const [submittingExistingLogin, setSubmittingExistingLogin] = useState(false);

  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const pwLevel = useMemo(
    () => (password ? STRENGTH_LEVELS[calculatePasswordScore(password)] : STRENGTH_LEVELS[0]),
    [password],
  );

  // ── Missing token ──────────────────────────────────────
  if (!rawToken) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <KeyRound className="h-7 w-7" />
          </div>
          <ViewHeader
            tag="Security Check"
            title="Missing Invitation Link"
            sub="No invitation token was found in the URL. Please open the complete link from your invitation email."
            center
          />
          <Button variant="outline" className="w-full" asChild>
            <Link to="/">Back to Sign In</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  // ── Loading / pre-validation ───────────────────────────
  if (invitationQuery.isLoading) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="mb-4 h-9 w-9 animate-spin text-brand-accent" />
          <p className="text-base font-medium text-navy-deep">Verifying invitation…</p>
          <p className="text-sm text-brand-muted">Validating the secure token with the GRC server</p>
        </div>
      </AuthShell>
    );
  }

  // ── Terminal error states ──────────────────────────────
  if (invitationQuery.isError) {
    const status = statusOf(invitationQuery.error);

    if (status === 409) {
      return (
        <AuthShell>
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <ViewHeader
              tag="Invitation Status"
              title="Already Accepted"
              sub="This invitation has already been accepted and activated. Sign in to access your organization."
              center
            />
            <Button variant="brand" className="w-full" asChild>
              <Link to="/">Sign In to Platform</Link>
            </Button>
          </div>
        </AuthShell>
      );
    }

    if (status === 410) {
      return (
        <AuthShell>
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Clock className="h-7 w-7" />
            </div>
            <ViewHeader
              tag="Invitation Status"
              title="Invitation Expired"
              sub="This invitation has expired or was revoked by an administrator. Invitation links are valid for 7 days."
              center
            />
            <p className="mb-6 text-xs text-brand-muted">
              Please contact your organization administrator to request a fresh invitation link.
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/">Back to Home</Link>
            </Button>
          </div>
        </AuthShell>
      );
    }

    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="h-7 w-7" />
          </div>
          <ViewHeader
            tag="Verification Failed"
            title="Invalid Invitation"
            sub="We couldn't locate this invitation. The link may be broken, incomplete or mistyped."
            center
          />
          <Button variant="outline" className="w-full" asChild>
            <Link to="/">Return to Sign In</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  const details = invitationQuery.data!;
  const invitedEmail = details.email?.toLowerCase() ?? "";
  const signedInEmail = auth.user?.email?.toLowerCase() ?? "";
  const isMatchingSession = auth.isAuthenticated && !!signedInEmail && signedInEmail === invitedEmail;
  const isConflictingSession = auth.isAuthenticated && !!signedInEmail && signedInEmail !== invitedEmail;

  // ── New user: accept + auto-login ──────────────────────
  const handleNewUserSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      nextErrors.fullName = "Full name is required (minimum 2 characters).";
    }
    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await acceptMutation.mutateAsync({
        fullName: fullName.trim(),
        username: username.trim() || undefined,
        password,
        confirmPassword,
      });

      // Acceptance returns membership metadata, not a session — mint one now.
      await auth.login({ identifier: details.email, password, rememberMe: true });
      toast.success(`Welcome to Privox GRC! You've joined ${details.organizationName}.`);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(messageOf(err, "Failed to accept invitation."));
    }
  };

  // ── Existing + signed in: one-click accept ─────────────
  const handleExistingAuthenticatedAccept = async () => {
    try {
      await acceptMutation.mutateAsync(undefined);
      await auth.refreshSession();
      toast.success(`Successfully joined ${details.organizationName}!`);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(messageOf(err, "Failed to join organization."));
    }
  };

  // ── Existing + signed out: sign in then accept ─────────
  const handleExistingLoginAndAccept = async (event: FormEvent) => {
    event.preventDefault();
    if (!existingPassword) {
      setErrors({ existingPassword: "Password is required." });
      return;
    }

    setSubmittingExistingLogin(true);
    try {
      await auth.login({ identifier: details.email, password: existingPassword, rememberMe: true });
      await acceptMutation.mutateAsync(undefined);
      await auth.refreshSession();
      toast.success(`Welcome back! Successfully joined ${details.organizationName}.`);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(messageOf(err, "Invalid credentials or unable to accept invitation."));
    } finally {
      setSubmittingExistingLogin(false);
    }
  };

  const orgPill = (
    <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-offwhite px-3 py-1 text-xs font-medium text-navy-dark">
      <Building2 className="h-3.5 w-3.5 text-brand-accent" />
      {details.organizationName}
    </div>
  );

  // ── Scenario B: existing user ──────────────────────────
  if (details.existingUser) {
    return (
      <AuthShell>
        <div>
          {orgPill}
          <ViewHeader
            tag="Account Invitation"
            title="Join Organization"
            sub={`You have been invited to join ${details.organizationName} on Privox GRC.`}
          />

          {isMatchingSession && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900">
                <div className="flex items-center gap-2 font-medium">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  Signed in as {auth.user?.fullName} ({auth.user?.email})
                </div>
                <p className="mt-1 text-xs text-emerald-700">
                  Click below to link this organization to your existing account.
                </p>
              </div>

              <Button
                variant="brand"
                className="w-full py-3"
                disabled={acceptMutation.isPending}
                onClick={handleExistingAuthenticatedAccept}
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting…
                  </>
                ) : (
                  "Accept Invitation & Join"
                )}
              </Button>
            </div>
          )}

          {isConflictingSession && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Account Conflict</AlertTitle>
                <AlertDescription className="text-xs">
                  You are currently signed in as <strong>{auth.user?.email}</strong>. This invitation was sent to{" "}
                  <strong>{details.email}</strong>.
                </AlertDescription>
              </Alert>

              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  await auth.logout();
                  toast.info("Signed out. Please accept the invitation with the correct account.");
                }}
              >
                Sign Out &amp; Switch Account
              </Button>
            </div>
          )}

          {!auth.isAuthenticated && (
            <form onSubmit={handleExistingLoginAndAccept} className="space-y-4">
              <div className="rounded-lg border bg-offwhite/50 p-3 text-xs text-brand-muted">
                An account with email <strong className="text-navy-deep">{details.email}</strong> already exists.
                Enter your password to accept this invitation.
              </div>

              <div>
                <Label htmlFor="existing-email" className="text-xs text-navy-dark">
                  Email
                </Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                  <Input
                    id="existing-email"
                    type="email"
                    disabled
                    value={details.email}
                    className="bg-muted pl-9 text-xs font-medium text-navy-deep"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="existing-password" className="text-xs text-navy-dark">
                  Password
                </Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                  <Input
                    id="existing-password"
                    type={showExistingPassword ? "text" : "password"}
                    value={existingPassword}
                    onChange={(event) => {
                      setExistingPassword(event.target.value);
                      setErrors((prev) => ({ ...prev, existingPassword: undefined }));
                    }}
                    placeholder="Enter your password"
                    className="pl-9 pr-10 text-xs"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowExistingPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-navy"
                    aria-label={showExistingPassword ? "Hide password" : "Show password"}
                  >
                    {showExistingPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.existingPassword && (
                  <p className="mt-1 text-xs text-destructive">{errors.existingPassword}</p>
                )}
              </div>

              <Button
                type="submit"
                variant="brand"
                className="w-full py-3 text-sm font-semibold"
                disabled={submittingExistingLogin || acceptMutation.isPending}
              >
                {submittingExistingLogin || acceptMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in &amp; accepting…
                  </>
                ) : (
                  "Sign In & Accept Invitation"
                )}
              </Button>
            </form>
          )}
        </div>
      </AuthShell>
    );
  }

  // ── Scenario A: new user registration ──────────────────
  return (
    <AuthShell>
      <div>
        {orgPill}
        <ViewHeader
          tag="Account Registration"
          title="Accept Invitation"
          sub={`Complete your account setup to join ${details.organizationName} on Privox GRC.`}
        />

        <form onSubmit={handleNewUserSubmit} className="space-y-4" noValidate>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="invitation-email" className="text-[12.5px] text-navy-dark">
                Email address
              </Label>
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified via invitation
              </span>
            </div>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
              <Input
                id="invitation-email"
                type="email"
                readOnly
                disabled
                value={details.email}
                className="cursor-not-allowed border-dashed bg-offwhite pl-9 text-[13.5px] font-medium text-navy-deep opacity-85"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="full-name" className="text-[12.5px] text-navy-dark">
              Full name <span className="text-destructive">*</span>
            </Label>
            <div className="relative mt-1.5">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
              <Input
                id="full-name"
                type="text"
                placeholder="e.g. Jane Doe"
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value);
                  setErrors((prev) => ({ ...prev, fullName: undefined }));
                }}
                className={cn("pl-9 text-[13.5px]", errors.fullName && "border-destructive ring-1 ring-destructive")}
                autoComplete="name"
              />
            </div>
            {errors.fullName && <p className="mt-1 text-xs text-destructive">{errors.fullName}</p>}
          </div>

          <div>
            <Label htmlFor="username" className="text-[12.5px] text-navy-dark">
              Username <span className="text-xs text-brand-muted">(optional)</span>
            </Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-muted">@</span>
              <Input
                id="username"
                type="text"
                placeholder="janedoe"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""));
                  setErrors((prev) => ({ ...prev, username: undefined }));
                }}
                className="pl-8 text-[13.5px]"
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password" className="text-[12.5px] text-navy-dark">
              Password <span className="text-destructive">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                className={cn("pl-9 pr-10 text-[13.5px]", errors.password && "border-destructive ring-1 ring-destructive")}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted transition hover:text-brand-accent"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className={cn("h-full rounded-full transition-all duration-300", pwLevel.bar)}
                style={{ width: pwLevel.width }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className={pwLevel.text}>Strength: {pwLevel.label}</span>
              <span className="text-muted-foreground">Min. 8 chars, 1 uppercase, 1 number</span>
            </div>
            {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
          </div>

          <div>
            <Label htmlFor="confirm-password" className="text-[12.5px] text-navy-dark">
              Confirm password <span className="text-destructive">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }}
                className={cn(
                  "pl-9 pr-10 text-[13.5px]",
                  errors.confirmPassword && "border-destructive ring-1 ring-destructive",
                )}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted transition hover:text-brand-accent"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="mt-1 text-xs text-destructive">{errors.confirmPassword}</p>}
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="brand"
              className="h-auto w-full rounded-[10px] py-3 text-[15px] font-semibold"
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account &amp; joining…
                </>
              ) : (
                "Create Account & Join"
              )}
            </Button>
          </div>

          <p className="text-center text-[12px] text-brand-muted">
            Already have an account under a different email?{" "}
            <Link to="/" className="font-medium text-brand-accent hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </AuthShell>
  );
};

export default AcceptInvitationPage;
