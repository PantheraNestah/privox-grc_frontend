import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AxiosError } from "axios";
import { usePlatformAuth } from "@/contexts/PlatformAuthContext";
import {
  AuthShell,
  ViewHeader,
  FieldLabel,
  inputCx,
  PrimaryBtn,
  ErrAlert,
} from "@/components/grc/auth-bits";

const PlatformLogin = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading } = usePlatformAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errs, setErrs] = useState<{ id?: boolean; pw?: boolean; alert?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/platform/dashboard", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  const submit = async () => {
    const next: typeof errs = {};
    if (!identifier.trim()) next.id = true;
    if (!password) next.pw = true;
    if (next.id || next.pw) return setErrs(next);

    setLoading(true);
    setErrs({});
    try {
      await login({ identifier: identifier.trim(), password, rememberMe });
      navigate("/platform/dashboard", { replace: true });
    } catch (err) {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message ||
            err.response?.data?.error ||
            `Sign-in failed (${err.response?.status ?? "network error"})`
          : "An unexpected error occurred. Please try again.";
      setErrs({ alert: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Platform Admin · Rsolve GRC Platform</title>
        <meta
          name="description"
          content="Platform administration sign-in for organisation onboarding, approvals and module assignment."
        />
        <link rel="canonical" href="/platform/login" />
      </Helmet>

      <AuthShell
        panelTitle={
          <>
            Platform
            <strong className="block font-semibold text-sky">Administration</strong>
          </>
        }
        panelSubtitle="Operator console for onboarding organisations, validating tenants and assigning platform modules."
        panelTags={["Organisations", "Approvals", "Modules", "Templates"]}
      >
        <ViewHeader
          tag="Platform Access"
          title="Administrator sign in"
          sub="Sign in with your platform operator credentials."
        />
        <ErrAlert show={!!errs.alert} msg={errs.alert ?? ""} />

        <div className="mb-4">
          <FieldLabel>Email or Username</FieldLabel>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
            <input
              className={inputCx(errs.id)}
              placeholder="operator@privox.io"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setErrs((s) => ({ ...s, id: false, alert: undefined }));
              }}
              autoComplete="username"
            />
          </div>
          {errs.id && !errs.alert && (
            <p className="text-xs text-destructive mt-1">Email or username is required.</p>
          )}
        </div>

        <div className="mb-4">
          <FieldLabel>Password</FieldLabel>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
            <input
              type={showPw ? "text" : "password"}
              className={inputCx(errs.pw)}
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrs((s) => ({ ...s, pw: false, alert: undefined }));
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-accent transition"
              aria-label="Toggle password"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errs.pw && !errs.alert && (
            <p className="text-xs text-destructive mt-1">Password is required.</p>
          )}
        </div>

        <div className="flex justify-between items-center mb-5">
          <label className="flex items-center gap-2 text-[13px] text-brand-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-3.5 h-3.5 accent-brand-accent"
            />{" "}
            Remember me
          </label>
        </div>

        <PrimaryBtn loading={loading} onClick={submit}>
          Sign In
        </PrimaryBtn>

        <p className="text-center text-xs text-brand-muted mt-4">
          Tenant user?{" "}
          <Link to="/" className="text-brand-accent font-medium hover:text-navy transition">
            Sign in to your organisation
          </Link>
        </p>
      </AuthShell>
    </>
  );
};

export default PlatformLogin;
