"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_ROLE, AGENT_ROLE } from "@/config/platform";

type Method = "email" | "password";

interface Props {
  passwordLoginEnabled: boolean;
}

export function InviteUserDialog({ passwordLoginEnabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<Method>(
    passwordLoginEnabled ? "password" : "email"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(AGENT_ROLE);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setMethod(passwordLoginEnabled ? "password" : "email");
    setName("");
    setEmail("");
    setRole(AGENT_ROLE);
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (method === "password") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          ...(method === "password" ? { password } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    name.trim() &&
    email.trim() &&
    (method === "email" ||
      (password.length >= 8 && password === confirmPassword));

  return (
    <>
      <Button
        onClick={handleOpen}
        size="sm"
        className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <PlusIcon className="size-4" />
        Add User
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              {method === "password"
                ? "Create a new account and set their password directly — no email required."
                : "Create a new account and send them an invitation email with sign-in instructions."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {passwordLoginEnabled && (
              <div className="space-y-1.5">
                <Label>How should they get access?</Label>
                <div className="flex gap-2">
                  {[
                    { value: "password" as const, label: "Set Password" },
                    { value: "email" as const, label: "Email Invite" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMethod(opt.value)}
                      className={`flex-1 py-2 text-sm font-medium rounded-md border transition-colors ${
                        method === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-accent/60"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Full name</Label>
              <Input
                id="invite-name"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <div className="flex gap-2">
                {[
                  { value: AGENT_ROLE, label: "Agent" },
                  { value: ADMIN_ROLE, label: "Admin" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={`flex-1 py-2 text-sm font-medium rounded-md border transition-colors ${
                      role === opt.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-accent/60"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
                method === "password" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="space-y-4 pt-0.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-password">Password</Label>
                    <Input
                      id="invite-password"
                      type="password"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required={method === "password"}
                      disabled={loading || method !== "password"}
                      tabIndex={method === "password" ? undefined : -1}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-password-confirm">
                      Confirm password
                    </Label>
                    <Input
                      id="invite-password-confirm"
                      type="password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required={method === "password"}
                      disabled={loading || method !== "password"}
                      tabIndex={method === "password" ? undefined : -1}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    They will not be notified — share the password with them
                    yourself.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="border-border text-foreground hover:bg-accent"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={loading || !canSubmit}
              >
                {loading
                  ? method === "password"
                    ? "Adding…"
                    : "Sending…"
                  : method === "password"
                    ? "Add User"
                    : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
