"use client";

import { SignOutIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="flex items-center gap-2 text-xs text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors w-full mt-1"
    >
      <SignOutIcon className="size-3.5" />
      Sign out
    </button>
  );
}
