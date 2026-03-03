"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      className="rounded-xl border border-slate-300/35 bg-slate-800/50 px-3 py-2 text-sm font-semibold text-slate-100"
      onClick={() => signOut({ callbackUrl: "/login" })}
      type="button"
    >
      Logout
    </button>
  );
}
