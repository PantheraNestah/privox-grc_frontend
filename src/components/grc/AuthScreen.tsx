import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AuthShell,
  ViewHeader,
  FieldLabel,
  inputCx,
  PrimaryBtn,
  ErrAlert,
  Steps,
} from "@/components/grc/auth-bits";
import { cn } from "@/lib/utils";
import { AxiosError } from "axios";

type View = "login" | "fp-email" | "fp-otp" | "fp-newpw" | "fp-done";

const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export const AuthScreen = () => {
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

  return (
    <AuthShell animating={animating} formKey={view}>
      {view === "login" && <LoginView go={go} onSuccess={() => navigate("/dashboard")} />}
      {view === "fp-email" && <ForgotEmailView go={go} />}
      {view === "fp-otp" && <ForgotOtpView go={go} />}
      {view === "fp-newpw" && <ForgotNewPwView go={go} />}
      {view === "fp-done" && <ForgotDoneView go={go} />}
    </AuthShell>
  );
};

/* ---------- Login ---------- */

const LoginView = ({ go, onSuccess }: { go: (v: View) => void; onSuccess: () => void }) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [p, setP] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errs, setErrs] = useState<{ id?: boolean; p?: boolean; alert?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next: typeof errs = {};
    if (!identifier.trim()) next.id = true;
    if (!p) next.p = true;
    if (next.id || next.p) return setErrs(next);

    setLoading(true);
    setErrs({});
    try {
      await login({
        identifier: identifier.trim(),
        password: p,
        rememberMe,
      });
      onSuccess();
    } catch (err) {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message ||
            err.response?.data?.error ||
            `Login failed (${err.response?.status ?? "network error"})`
          : "An unexpected error occurred. Please try again.";
      setErrs({ alert: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <ViewHeader tag="Secure Access" title="Welcome back" sub="Sign in to your organisation's GRC workspace." />
      <ErrAlert show={!!errs.alert} msg={errs.alert ?? ""} />

      <div className="mb-4">
        <FieldLabel>Email or Username</FieldLabel>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input className={inputCx(errs.id)} placeholder="you@organisation.com" value={identifier}
            onChange={e => { setIdentifier(e.target.value); setErrs(s => ({ ...s, id: false, alert: undefined })); }}
            autoComplete="username" />
        </div>
        {errs.id && !errs.alert && <p className="text-xs text-destructive mt-1">Email or username is required.</p>}
      </div>

      <div className="mb-4">
        <FieldLabel>Password</FieldLabel>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input type={showPw ? "text" : "password"} className={inputCx(errs.p)} placeholder="••••••••" value={p}
            onChange={e => { setP(e.target.value); setErrs(s => ({ ...s, p: false, alert: undefined })); }}
            onKeyDown={e => e.key === "Enter" && submit()}
            autoComplete="current-password" />
          <button type="button" onClick={() => setShowPw(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-accent transition" aria-label="Toggle password">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errs.p && !errs.alert && <p className="text-xs text-destructive mt-1">Password is required.</p>}
      </div>

      <div className="flex justify-between items-center mb-5">
        <label className="flex items-center gap-2 text-[13px] text-brand-muted cursor-pointer select-none">
          <input type="checkbox" checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
            className="w-3.5 h-3.5 accent-brand-accent" /> Remember me
        </label>
        <button onClick={() => go("fp-email")} className="text-[13px] font-medium text-brand-accent hover:text-navy transition">
          Forgot password?
        </button>
      </div>

      <PrimaryBtn loading={loading} onClick={submit}>Sign In</PrimaryBtn>
      <p className="text-center text-xs text-brand-muted mt-4">
        Don't have access? Contact your <strong className="text-navy-dark font-medium">GRC Administrator</strong>.
      </p>
      <p className="text-center text-xs text-brand-muted mt-3">
        Platform operator?{" "}
        <Link to="/platform/login" className="text-brand-accent font-medium hover:text-navy transition">
          Sign in to Platform Admin
        </Link>
      </p>
    </div>
  );
};

/* ---------- Forgot: email ---------- */

const ForgotEmailView = ({ go }: { go: (v: View) => void }) => {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = () => {
    if (!isEmail(email)) return setErr(true);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      sessionStorage.setItem("fp-email", email);
      go("fp-otp");
    }, 1100);
  };

  return (
    <div>
      <button onClick={() => go("login")} className="flex items-center gap-1.5 text-[13.5px] text-brand-muted hover:text-navy mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Back to sign in
      </button>
      <Steps step={1} />
      <ViewHeader tag="Password Reset" title="Verify your identity" sub="Enter the email address registered to your organisation account." />
      <div className="mb-4">
        <FieldLabel>Organisation email address</FieldLabel>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input type="email" className={inputCx(err)} placeholder="you@yourorganisation.com" value={email}
            onChange={e => { setEmail(e.target.value); setErr(false); }} />
        </div>
        {err && <p className="text-xs text-destructive mt-1">Please enter a valid email address.</p>}
      </div>
      <PrimaryBtn loading={loading} onClick={submit}>Send Verification Code</PrimaryBtn>
    </div>
  );
};

/* ---------- Forgot: OTP ---------- */

const ForgotOtpView = ({ go }: { go: (v: View) => void }) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [vals, setVals] = useState(["", "", "", "", "", ""]);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const email = sessionStorage.getItem("fp-email") ?? "";
  const masked = email ? email.slice(0, 2) + "***@" + (email.split("@")[1] ?? "") : "";

  useEffect(() => {
    refs.current[0]?.focus();
    const t = setInterval(() => setSeconds(s => (s <= 0 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const setAt = (i: number, v: string) => {
    const cleaned = v.replace(/\D/g, "").slice(-1);
    setVals(prev => prev.map((x, idx) => (idx === i ? cleaned : x)));
    setErr(false);
    if (cleaned && i < 5) refs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !vals[i] && i > 0) {
      refs.current[i - 1]?.focus();
      setVals(prev => prev.map((x, idx) => (idx === i - 1 ? "" : x)));
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const txt = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = vals.map((_, i) => txt[i] ?? "");
    setVals(next);
    refs.current[Math.min(txt.length, 5)]?.focus();
  };

  const submit = () => {
    const code = vals.join("");
    if (code.length < 6) return setErr(true);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (code === "123456") go("fp-newpw");
      else { setErr(true); setVals(["", "", "", "", "", ""]); refs.current[0]?.focus(); }
    }, 900);
  };

  const resend = () => {
    setSeconds(60);
    setVals(["", "", "", "", "", ""]);
    setErr(false);
    refs.current[0]?.focus();
  };

  return (
    <div>
      <button onClick={() => go("fp-email")} className="flex items-center gap-1.5 text-[13.5px] text-brand-muted hover:text-navy mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Change email
      </button>
      <Steps step={2} />
      <ViewHeader tag="OTP Verification" title="Enter the code" sub="A 6-digit code was sent to your email and registered mobile number." />
      <ErrAlert show={err} msg="Incorrect or expired code. Try again. (Hint: use 123456)" />
      <div className="mb-4">
        <FieldLabel>Verification code</FieldLabel>
        <div className="flex gap-2.5">
          {vals.map((v, i) => (
            <input key={i} ref={el => (refs.current[i] = el)} value={v} maxLength={1} inputMode="numeric"
              onChange={e => setAt(i, e.target.value)} onKeyDown={e => onKey(i, e)} onPaste={onPaste}
              className={cn(
                "w-12 h-14 text-center text-xl font-semibold font-mono rounded-[10px] border-[1.5px] bg-offwhite text-navy-deep outline-none transition",
                "focus:border-brand-accent focus:bg-white focus:ring-[3px] focus:ring-brand-accent/15",
                v ? "border-navy bg-white" : "border-border"
              )} />
          ))}
        </div>
        <p className="text-xs text-brand-muted mt-2.5">
          Sent to <strong className="text-navy-dark font-medium">{masked || "you"}</strong> and your registered mobile.
        </p>
        <div className="flex items-center gap-1.5 mt-3 text-[13px] text-brand-muted">
          Didn't receive it?
          <button onClick={resend} disabled={seconds > 0}
            className="text-brand-accent font-medium underline underline-offset-2 disabled:text-brand-muted disabled:no-underline disabled:cursor-default">
            Resend code
          </button>
          {seconds > 0 && <span className="font-mono text-xs">({seconds}s)</span>}
        </div>
      </div>
      <PrimaryBtn loading={loading} onClick={submit}>Verify Code</PrimaryBtn>
    </div>
  );
};

/* ---------- Forgot: new password ---------- */

const ForgotNewPwView = ({ go }: { go: (v: View) => void }) => {
  const [pw, setPw] = useState("");
  const [cf, setCf] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [errs, setErrs] = useState<{ pw?: string; cf?: string }>({});
  const [loading, setLoading] = useState(false);

  const score = (() => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  })();
  const levels = [
    { w: "0%",   color: "transparent",          label: "—",      text: "text-brand-muted" },
    { w: "25%",  color: "hsl(var(--error))",   label: "Weak",   text: "text-destructive" },
    { w: "50%",  color: "hsl(var(--warn))",    label: "Fair",   text: "text-warn" },
    { w: "75%",  color: "hsl(var(--royal))",   label: "Good",   text: "text-royal" },
    { w: "100%", color: "hsl(var(--success))", label: "Strong", text: "text-success" },
  ];
  const lvl = pw.length === 0 ? levels[0] : levels[score];

  const submit = () => {
    const next: typeof errs = {};
    if (pw.length < 8) next.pw = "Password must be at least 8 characters.";
    if (pw !== cf) next.cf = "Passwords do not match.";
    setErrs(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); go("fp-done"); }, 1100);
  };

  return (
    <div>
      <Steps step={3} />
      <ViewHeader tag="New Password" title="Set a new password" sub="Choose a strong password meeting your organisation's security policy." />
      <div className="mb-4">
        <FieldLabel>New password</FieldLabel>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input type={showPw ? "text" : "password"} className={inputCx(!!errs.pw)} placeholder="Minimum 8 characters" value={pw}
            onChange={e => { setPw(e.target.value); setErrs(s => ({ ...s, pw: undefined })); }} />
          <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-accent">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="h-1 rounded-full bg-surface mt-2 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: lvl.w, background: lvl.color }} />
        </div>
        <p className={cn("text-[11.5px] mt-1 font-mono", lvl.text)}>{lvl.label}</p>
        {errs.pw && <p className="text-xs text-destructive mt-1">{errs.pw}</p>}
      </div>
      <div className="mb-5">
        <FieldLabel>Confirm new password</FieldLabel>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input type={showCf ? "text" : "password"} className={inputCx(!!errs.cf)} placeholder="Re-enter password" value={cf}
            onChange={e => { setCf(e.target.value); setErrs(s => ({ ...s, cf: undefined })); }} />
          <button type="button" onClick={() => setShowCf(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-accent">
            {showCf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errs.cf && <p className="text-xs text-destructive mt-1">{errs.cf}</p>}
      </div>
      <PrimaryBtn loading={loading} onClick={submit}>Reset Password</PrimaryBtn>
    </div>
  );
};

/* ---------- Forgot: done ---------- */

const ForgotDoneView = ({ go }: { go: (v: View) => void }) => (
  <div className="text-center">
    <div className="w-[68px] h-[68px] rounded-full bg-success/10 border-2 border-success/30 flex items-center justify-center mx-auto mb-6 animate-pop-in">
      <CheckCircle2 className="w-8 h-8 text-success" />
    </div>
    <ViewHeader tag="All Done" title="Password updated" sub="Your password has been successfully changed. Sign in with your new credentials." center />
    <PrimaryBtn onClick={() => go("login")}>Back to Sign In</PrimaryBtn>
  </div>
);
