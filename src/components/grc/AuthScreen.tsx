import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, User, Lock, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { Logo, BrandName } from "@/components/grc/Logo";
import { cn } from "@/lib/utils";

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
    <div className="flex min-h-screen flex-col md:flex-row bg-offwhite">
      {/* Left brand panel */}
      <aside className="relative hidden md:flex md:w-[44%] flex-col justify-between overflow-hidden bg-navy-deep p-14 text-white shrink-0">
        <div className="absolute inset-0 auth-radial" />
        <div className="absolute inset-0 dot-grid" />
        <div className="absolute -top-32 -right-36 w-[420px] h-[420px] rounded-full border border-accent/20" />
        <div className="absolute top-10 -right-16 w-60 h-60 rounded-full border border-accent/30" />
        <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full border border-accent/20" />
        <div className="absolute bottom-16 left-10 w-40 h-40 rounded-full border border-accent/30" />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-12">
            <Logo />
            <BrandName className="text-2xl font-semibold tracking-tight" />
          </div>
          <h1 className="text-4xl font-light leading-tight tracking-tight mb-4">
            Governance, Risk<br />&amp; Compliance
            <strong className="block font-semibold text-sky">Unified Platform</strong>
          </h1>
          <p className="text-sm leading-relaxed text-brand-muted max-w-xs">
            A centralised GRC solution empowering organisations to manage risk, ensure compliance, and maintain operational continuity.
          </p>
        </div>

        <div className="relative z-10">
          <div className="flex flex-wrap gap-2 mb-7">
            {["Governance", "Risk Management", "Compliance", "Data Protection", "Resilience", "Cyber Risk"].map(c => (
              <span key={c} className="font-mono text-[10.5px] font-medium tracking-wider px-2.5 py-1 rounded-full bg-accent/15 border border-accent/30 text-sky">
                {c}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-brand-muted/40">© 2026 Rsolve. All rights reserved.</p>
        </div>
      </aside>

      {/* Right form panel */}
      <main className="relative flex-1 flex items-center justify-center bg-white px-6 py-12 md:px-10 md:py-12">
        <div className="absolute inset-x-0 top-0 h-1 top-stripe" />
        <div className={cn("w-full max-w-md", !animating && "animate-slide-in")} key={view}>
          {view === "login" && <LoginView go={go} onSuccess={() => navigate("/dashboard")} />}
          {view === "fp-email" && <ForgotEmailView go={go} />}
          {view === "fp-otp" && <ForgotOtpView go={go} />}
          {view === "fp-newpw" && <ForgotNewPwView go={go} />}
          {view === "fp-done" && <ForgotDoneView go={go} />}
        </div>
      </main>
    </div>
  );
};

/* ---------- shared bits ---------- */

const ViewHeader = ({ tag, title, sub, center }: { tag: string; title: string; sub: string; center?: boolean }) => (
  <div className={cn("mb-7", center && "text-center")}>
    <p className="font-mono text-[10.5px] tracking-[0.15em] uppercase text-brand-accent mb-2">{tag}</p>
    <h2 className="text-[27px] font-semibold tracking-tight text-navy-deep mb-1.5">{title}</h2>
    <p className="text-[13.5px] leading-relaxed text-brand-muted">{sub}</p>
  </div>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[12.5px] font-medium text-navy-dark mb-1.5">{children}</label>
);

const inputCx = (err?: boolean) =>
  cn(
    "w-full rounded-[10px] border-[1.5px] bg-offwhite py-3 pl-10 pr-3 text-[14.5px] text-navy-deep outline-none transition",
    "focus:border-brand-accent focus:bg-white focus:ring-[3px] focus:ring-brand-accent/15",
    err ? "border-destructive ring-[3px] ring-destructive/15" : "border-border"
  );

const PrimaryBtn = ({ loading, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => (
  <button
    {...rest}
    disabled={loading || rest.disabled}
    className={cn(
      "w-full rounded-[10px] py-3 text-[15px] font-semibold text-white shadow-button transition",
      "bg-gradient-primary hover:opacity-90 hover:-translate-y-px hover:shadow-card-hover active:translate-y-0",
      "disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none",
      rest.className
    )}
  >
    {loading ? (
      <span className="inline-block w-[18px] h-[18px] border-2 border-white/40 border-t-white rounded-full animate-spin align-middle" />
    ) : children}
  </button>
);

const ErrAlert = ({ msg, show }: { msg: string; show: boolean }) =>
  show ? (
    <div className="flex items-center gap-2 mb-4 px-3.5 py-2.5 rounded-lg bg-destructive/8 border border-destructive/25 text-[13px] text-destructive">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span>{msg}</span>
    </div>
  ) : null;

const Steps = ({ step }: { step: 1 | 2 | 3 }) => {
  const dot = (n: 1 | 2 | 3) =>
    n < step ? "bg-success text-white" : n === step ? "bg-navy text-white ring-4 ring-navy/15" : "bg-surface text-brand-muted";
  const line = (after: 1 | 2) => (after < step ? "bg-success" : "bg-surface");
  return (
    <div className="flex items-center mb-7">
      {[1, 2, 3].map(n => (
        <div key={n} className="flex items-center">
          <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-semibold transition", dot(n as 1 | 2 | 3))}>
            {n < step ? "✓" : n}
          </div>
          {n < 3 && <div className={cn("h-0.5 w-10 transition", line(n as 1 | 2))} />}
        </div>
      ))}
    </div>
  );
};

/* ---------- Login ---------- */

const LoginView = ({ go, onSuccess }: { go: (v: View) => void; onSuccess: () => void }) => {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errs, setErrs] = useState<{ u?: boolean; p?: boolean; alert?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = () => {
    const next: typeof errs = {};
    if (!u.trim()) next.u = true;
    if (!p) next.p = true;
    if (next.u || next.p) return setErrs(next);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (u === "admin" && p === "admingrc2026") onSuccess();
      else setErrs({ u: true, p: true, alert: "Invalid username or password. Please try again." });
    }, 900);
  };

  return (
    <div>
      <ViewHeader tag="Secure Access" title="Welcome back" sub="Sign in to your organisation's GRC workspace." />
      <ErrAlert show={!!errs.alert} msg={errs.alert ?? ""} />

      <div className="mb-4">
        <FieldLabel>Username</FieldLabel>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input className={inputCx(errs.u)} placeholder="your.username" value={u}
            onChange={e => { setU(e.target.value); setErrs(s => ({ ...s, u: false, alert: undefined })); }} />
        </div>
        {errs.u && !errs.alert && <p className="text-xs text-destructive mt-1">Username is required.</p>}
      </div>

      <div className="mb-4">
        <FieldLabel>Password</FieldLabel>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input type={showPw ? "text" : "password"} className={inputCx(errs.p)} placeholder="••••••••" value={p}
            onChange={e => { setP(e.target.value); setErrs(s => ({ ...s, p: false, alert: undefined })); }}
            onKeyDown={e => e.key === "Enter" && submit()} />
          <button type="button" onClick={() => setShowPw(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-accent transition" aria-label="Toggle password">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errs.p && !errs.alert && <p className="text-xs text-destructive mt-1">Password is required.</p>}
      </div>

      <div className="flex justify-between items-center mb-5">
        <label className="flex items-center gap-2 text-[13px] text-brand-muted cursor-pointer">
          <input type="checkbox" className="w-3.5 h-3.5 accent-brand-accent" /> Remember me
        </label>
        <button onClick={() => go("fp-email")} className="text-[13px] font-medium text-brand-accent hover:text-navy transition">
          Forgot password?
        </button>
      </div>

      <PrimaryBtn loading={loading} onClick={submit}>Sign In</PrimaryBtn>
      <p className="text-center text-xs text-brand-muted mt-4">
        Don't have access? Contact your <strong className="text-navy-dark font-medium">GRC Administrator</strong>.
      </p>
      <p className="text-center text-[11px] text-brand-muted/60 mt-3 font-mono">
        demo: admin / admingrc2026
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
