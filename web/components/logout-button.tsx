"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      className="rounded-xl border border-cyan-300/40 bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-100"
      onClick={() => signOut({ callbackUrl: "/" })}
      type="button"
    >
      Logout
    </button>
  );
}
