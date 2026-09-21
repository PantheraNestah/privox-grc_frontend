import { useState, useRef, useEffect, type ClipboardEvent, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell, ViewHeader, Steps } from "@/components/grc/auth-bits";
import { CredentialsForm } from "@/components/grc/CredentialsForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  return (
    <div>
      <ViewHeader tag="Secure Access" title="Welcome back" sub="Sign in to your organisation's GRC workspace." />

      <CredentialsForm
        identifierPlaceholder="you@organisation.com"
        failureLabel="Login failed"
        onForgotPassword={() => go("fp-email")}
        onSubmit={async (credentials) => {
          await login(credentials);
          onSuccess();
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
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <BackLink onClick={() => go("login")}>Back to sign in</BackLink>
      <Steps step={1} />
      <ViewHeader
        tag="Password Reset"
        title="Verify your identity"
        sub="Enter the email address registered to your organisation account."
      />
      <div className="mb-4">
        <Label htmlFor="fp-email" className="mb-1.5 block text-[12.5px] text-navy-dark">
          Organisation email address
        </Label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <Input
            id="fp-email"
            type="email"
            className={fieldInputCx(err)}
            placeholder="you@yourorganisation.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErr(false);
            }}
            aria-invalid={err || undefined}
          />
        </div>
        {err && <FieldError>Please enter a valid email address.</FieldError>}
      </div>
      <SubmitButton loading={loading}>Send Verification Code</SubmitButton>
    </form>
  );
};

/* ---------- Forgot: OTP ---------- */

const OTP_LENGTH = 6;
const emptyCode = () => Array.from({ length: OTP_LENGTH }, () => "");

const ForgotOtpView = ({ go }: { go: (v: View) => void }) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [vals, setVals] = useState(emptyCode);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const email = sessionStorage.getItem("fp-email") ?? "";
  const masked = email ? email.slice(0, 2) + "***@" + (email.split("@")[1] ?? "") : "";

  useEffect(() => {
    refs.current[0]?.focus();
    const t = setInterval(() => setSeconds((s) => (s <= 0 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const setAt = (i: number, v: string) => {
    const cleaned = v.replace(/\D/g, "").slice(-1);
    setVals((prev) => prev.map((x, idx) => (idx === i ? cleaned : x)));
    setErr(false);
    if (cleaned && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !vals[i] && i > 0) {
      refs.current[i - 1]?.focus();
      setVals((prev) => prev.map((x, idx) => (idx === i - 1 ? "" : x)));
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const txt = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    setVals(vals.map((_, i) => txt[i] ?? ""));
    refs.current[Math.min(txt.length, OTP_LENGTH - 1)]?.focus();
  };

  const submit = () => {
    const code = vals.join("");
    if (code.length < OTP_LENGTH) return setErr(true);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (code === "123456") go("fp-newpw");
      else {
        setErr(true);
        setVals(emptyCode());
        refs.current[0]?.focus();
      }
    }, 900);
  };

  const resend = () => {
    setSeconds(60);
    setVals(emptyCode());
    setErr(false);
    refs.current[0]?.focus();
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <BackLink onClick={() => go("fp-email")}>Change email</BackLink>
      <Steps step={2} />
      <ViewHeader
        tag="OTP Verification"
        title="Enter the code"
        sub="A 6-digit code was sent to your email and registered mobile number."
      />
      {err && (
        <Alert variant="destructive" className="mb-4 flex items-center gap-2 py-2.5 text-[13px]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>Incorrect or expired code. Try again. (Hint: use 123456)</AlertDescription>
        </Alert>
      )}
      <div className="mb-4">
        <Label className="mb-1.5 block text-[12.5px] text-navy-dark">Verification code</Label>
        <div className="flex gap-2 sm:gap-2.5" role="group" aria-label="Verification code">
          {vals.map((v, i) => (
            <Input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={v}
              maxLength={1}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1}`}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => onKey(i, e)}
              onPaste={onPaste}
              className={cn(
                "h-14 min-w-0 flex-1 rounded-[10px] border-[1.5px] bg-offwhite px-0 text-center font-mono text-xl font-semibold text-navy-deep md:text-xl",
                "focus-visible:border-brand-accent focus-visible:bg-white focus-visible:ring-[3px] focus-visible:ring-brand-accent/15 focus-visible:ring-offset-0",
                v && "border-navy bg-white",
              )}
            />
          ))}
        </div>
        <p className="mt-2.5 text-xs text-muted-foreground">
          Sent to <strong className="font-medium text-navy-dark">{masked || "you"}</strong> and your registered mobile.
        </p>
        <div className="mt-3 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          Didn't receive it?
          <button
            type="button"
            onClick={resend}
            disabled={seconds > 0}
            className="font-medium text-brand-accent underline underline-offset-2 disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
          >
            Resend code
          </button>
          {seconds > 0 && <span className="font-mono text-xs">({seconds}s)</span>}
        </div>
      </div>
      <SubmitButton loading={loading}>Verify Code</SubmitButton>
    </form>
  );
};

/* ---------- Forgot: new password ---------- */

const STRENGTH_LEVELS = [
  { width: "0%", bar: "bg-transparent", label: "—", text: "text-muted-foreground" },
  { width: "25%", bar: "bg-destructive", label: "Weak", text: "text-destructive" },
  { width: "50%", bar: "bg-warn", label: "Fair", text: "text-warn" },
  { width: "75%", bar: "bg-royal", label: "Good", text: "text-royal" },
  { width: "100%", bar: "bg-success", label: "Strong", text: "text-success" },
];

const passwordScore = (pw: string) =>
  [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;

const PasswordField = ({
  id,
  label,
  placeholder,
  value,
  invalid,
  onChange,
  children,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
  children?: React.ReactNode;
}) => {
  const [show, setShow] = useState(false);
  return (
    <div className="mb-4">
      <Label htmlFor={id} className="mb-1.5 block text-[12.5px] text-navy-dark">
        {label}
      </Label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
        <Input
          id={id}
          type={show ? "text" : "password"}
          className={cn(fieldInputCx(invalid), "pr-10")}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted transition hover:text-brand-accent"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {children}
    </div>
  );
};

const ForgotNewPwView = ({ go }: { go: (v: View) => void }) => {
  const [pw, setPw] = useState("");
  const [cf, setCf] = useState("");
  const [errs, setErrs] = useState<{ pw?: string; cf?: string }>({});
  const [loading, setLoading] = useState(false);

  const level = pw.length === 0 ? STRENGTH_LEVELS[0] : STRENGTH_LEVELS[passwordScore(pw)];

  const submit = () => {
    const next: typeof errs = {};
    if (pw.length < 8) next.pw = "Password must be at least 8 characters.";
    if (pw !== cf) next.cf = "Passwords do not match.";
    setErrs(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      go("fp-done");
    }, 1100);
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Steps step={3} />
      <ViewHeader
        tag="New Password"
        title="Set a new password"
        sub="Choose a strong password meeting your organisation's security policy."
      />
      <PasswordField
        id="fp-new-password"
        label="New password"
        placeholder="Minimum 8 characters"
        value={pw}
        invalid={!!errs.pw}
        onChange={(value) => {
          setPw(value);
          setErrs((s) => ({ ...s, pw: undefined }));
        }}
      >
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className={cn("h-full rounded-full transition-all", level.bar)} style={{ width: level.width }} />
        </div>
        <p className={cn("mt-1 font-mono text-[11.5px]", level.text)}>{level.label}</p>
        <FieldError>{errs.pw}</FieldError>
      </PasswordField>
      <PasswordField
        id="fp-confirm-password"
        label="Confirm new password"
        placeholder="Re-enter password"
        value={cf}
        invalid={!!errs.cf}
        onChange={(value) => {
          setCf(value);
          setErrs((s) => ({ ...s, cf: undefined }));
        }}
      >
        <FieldError>{errs.cf}</FieldError>
      </PasswordField>
      <div className="mt-5">
        <SubmitButton loading={loading}>Reset Password</SubmitButton>
      </div>
    </form>
  );
};

/* ---------- Forgot: done ---------- */

const ForgotDoneView = ({ go }: { go: (v: View) => void }) => (
  <div className="text-center">
    <span className="mx-auto mb-6 flex h-[68px] w-[68px] items-center justify-center rounded-full border-2 border-success/30 bg-success/10">
      <CheckCircle2 className="h-8 w-8 text-success" />
    </span>
    <ViewHeader
      tag="All Done"
      title="Password updated"
      sub="Your password has been successfully changed. Sign in with your new credentials."
      center
    />
    <Button variant="brand" onClick={() => go("login")} className="h-auto w-full rounded-[10px] py-3 text-[15px] font-semibold">
      Back to Sign In
    </Button>
  </div>
);
