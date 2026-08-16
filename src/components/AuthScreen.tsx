import { useState } from "react";
import { KeyRound, ShieldCheck, UserX } from "lucide-react";
import { Button, Field, Input } from "./ui-kit";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { Logo } from "./Logo";
import type { ThemeId } from "@/lib/theme";

export function AuthScreen({
  theme,
  onTheme,
  onSignIn,
  onSignUp,
  hasQuickLock,
  quickLockEmail,
  onQuickUnlock,
  onForgetDevice,
}: {
  theme: ThemeId;
  onTheme: (id: ThemeId) => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  hasQuickLock: boolean;
  quickLockEmail: string | null;
  onQuickUnlock: (password: string) => Promise<void>;
  onForgetDevice: () => void;
}) {
  const isSignupDisabled =
    import.meta.env.VITE_DISABLE_SIGNUP === "true" ||
    import.meta.env.VITE_DISABLE_SIGNUP === true;

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [useMaster, setUseMaster] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const quick = hasQuickLock && !useMaster;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!quick && mode === "signup") {
      if (isSignupDisabled) {
        setError("New vault creation is currently disabled by configuration.");
        return;
      }
      if (password.length < 8) {
        setError("Use at least 8 characters for your master password.");
        return;
      }
    }

    setBusy(true);
    try {
      if (quick) await onQuickUnlock(password);
      else
        await (mode === "signin" ? onSignIn : onSignUp)(
          email.trim().toLowerCase(),
          password,
        );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — desktop only */}
      <section className="hidden flex-col justify-between border-r border-border bg-surface-1 p-10 lg:flex">
        <div className="flex items-center gap-2.5 text-primary">
          <Logo className="size-9" />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Astral Notes
          </span>
        </div>
        <div className="max-w-sm">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">
            Notes that only you can read.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Everything is encrypted in your browser before it is stored. Share
            single notes with a separate password and an optional expiry —
            read-only, with nothing about your account attached.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li>· AES-GCM 256 · PBKDF2 310k iterations</li>
            <li>· Markdown, tags, search, instant autosave</li>
            <li>· Installable app with four pastel themes</li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Zero-knowledge storage · no trackers
        </p>
      </section>

      <section className="flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary lg:invisible">
              <Logo className="size-9" />
              <span className="text-sm font-semibold tracking-tight text-foreground">
                Astral Notes
              </span>
            </div>
            <ThemeSwitcher theme={theme} onChange={onTheme} />
          </div>

          <div className="card-surface p-6">
            <h1 className="text-xl font-semibold tracking-tight">
              {quick
                ? "Enter lock password"
                : mode === "signin"
                  ? "Unlock your vault"
                  : "Create your vault"}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {quick
                ? `Quick unlock for ${quickLockEmail}. This password lives only on this device — clearing site data or signing out removes it.`
                : "Your master password derives the encryption key in your browser. It is never stored or sent anywhere — lose it and the notes stay unreadable."}
            </p>

            <form onSubmit={submit} className="mt-5 space-y-3">
              {!quick ? (
                <Field label="Email">
                  <Input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    placeholder="you@example.com"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              ) : null}
              <Field label={quick ? "Lock password" : "Master password"}>
                <Input
                  type="password"
                  required
                  autoComplete={
                    quick || mode === "signin"
                      ? "current-password"
                      : "new-password"
                  }
                  value={password}
                  placeholder="••••••••"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>

              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={
                  busy || (!quick && mode === "signup" && isSignupDisabled)
                }
              >
                {busy
                  ? "Deriving key…"
                  : quick
                    ? "Unlock"
                    : mode === "signin"
                      ? "Unlock"
                      : isSignupDisabled
                        ? "Sign up disabled"
                        : "Create vault"}
              </Button>
            </form>

            {quick ? (
              <div className="mt-4 space-y-1.5 text-center text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setUseMaster(true);
                    setError(null);
                  }}
                  className="w-full text-muted-foreground transition-colors hover:text-foreground"
                >
                  Use master password instead
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onForgetDevice();
                    setUseMaster(true);
                  }}
                  className="w-full text-muted-foreground transition-colors hover:text-foreground"
                >
                  Forget this device
                </button>
              </div>
            ) : isSignupDisabled ? (
              <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground bg-surface-2/60 rounded-lg p-2">
                <UserX className="size-3.5" />
                <span>New vault registrations are currently closed</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                }}
                className="mt-4 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {mode === "signin"
                  ? "No vault yet? Create one"
                  : "Already have a vault? Unlock"}
              </button>
            )}
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            AES-GCM 256 · PBKDF2 310k · zero-knowledge storage
          </p>
          {hasQuickLock && useMaster ? (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <KeyRound className="size-3.5" /> Device lock stays saved locally
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
