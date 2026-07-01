"use client";

import { GoogleLogoIcon } from "@phosphor-icons/react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PRODUCT_NAME } from "@/config/platform";
import { authClient } from "@/lib/auth-client";

interface AuthFormProps {
  googleEnabled: boolean;
}

export function AuthForm({ googleEnabled }: AuthFormProps) {
  return (
    <Suspense fallback={null}>
      <AuthFormInner googleEnabled={googleEnabled} />
    </Suspense>
  );
}

function AuthFormInner({ googleEnabled }: AuthFormProps) {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: "/post-auth" });
    } catch {
      setError("Failed to sign in with Google. Please try again.");
      setGoogleLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const callbackURL = searchParams.get("next") ?? "/post-auth";
    const result = await authClient.signIn.magicLink({ email, callbackURL });
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? "Failed to send sign-in link.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="min-h-screen bg-public flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-bark text-cream font-bold text-lg mb-4">
            ST
          </div>
          <h1 className="text-2xl font-semibold text-bark">{PRODUCT_NAME}</h1>
          <p className="text-sm text-stone mt-1">Agent &amp; Admin Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-sand shadow-soft shadow-sm p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center size-12 rounded-full bg-bark/10 mb-2">
                <svg className="size-6 text-bark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-bark">Check your inbox</h2>
                <p className="text-sm text-stone mt-1">
                  We sent a sign-in link to{" "}
                  <span className="font-medium text-bark">{email}</span>
                </p>
              </div>
              <p className="text-xs text-stone">
                Didn&apos;t receive it?{" "}
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="underline underline-offset-4 hover:text-bark transition-colors"
                >
                  Try again
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-bark">Sign in</h2>
                <p className="text-sm text-stone mt-1">
                  No password needed — we&apos;ll email you a secure link.
                </p>
              </div>

              {/* Google button — only when configured */}
              {googleEnabled && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 border-sand text-bark hover:bg-cream"
                    disabled={submitting || googleLoading}
                    onClick={handleGoogleSignIn}
                  >
                    {googleLoading ? (
                      <span className="size-4 rounded-full border-2 border-bark/30 border-t-bark animate-spin inline-block" />
                    ) : (
                      <GoogleLogoIcon className="size-4" />
                    )}
                    Continue with Google
                  </Button>

                  <div className="flex items-center gap-3">
                    <Separator className="flex-1 bg-sand" />
                    <span className="text-xs text-stone">or</span>
                    <Separator className="flex-1 bg-sand" />
                  </div>
                </>
              )}

              {/* Magic link form */}
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-bark mb-1.5"
                  >
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="text-foreground"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full bg-bark hover:bg-bark/90 text-white"
                  disabled={submitting || googleLoading}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                      Sending link…
                    </span>
                  ) : (
                    "Send Sign-In Link"
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-stone mt-6">
          Looking to submit a support ticket?{" "}
          <a
            href="/"
            className="underline underline-offset-4 hover:text-bark transition-colors"
          >
            Go to customer portal
          </a>
        </p>
      </div>
    </main>
  );
}
