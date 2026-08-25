"use client";

import { useActionState } from "react";

import { loginAction, type LoginFormState } from "@/server/actions/admin-auth";

const INITIAL_STATE: LoginFormState = {};

/**
 * Van `(protected)` grupe — vidi komentar u `../(protected)/layout.tsx` za
 * zasto ova stranica namerno NE prolazi kroz `requireAdminSession()`.
 */
export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL_STATE);

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <form action={formAction} className="border-kf-line bg-kf-surface rounded-kf-card w-full max-w-90 border p-6">
        <div className="mb-5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="border-kf-accent flex size-5 items-center justify-center rounded-md border-[1.5px]"
            >
              <span className="bg-kf-accent block size-1.25 rounded-[1px]" />
            </span>
            <h1 className="text-[18px] font-semibold tracking-[-0.02em]">Keyframe</h1>
            <span className="border-kf-line-strong text-kf-mut rounded-[5px] border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.14em]">
              ADMIN
            </span>
          </div>
          <p className="text-kf-mut mt-2.5 text-[13px]">Prijavi se da upravljaš snimcima.</p>
        </div>

        {state.formError && (
          <p id="password-error" role="alert" className="text-kf-danger mb-4 text-[13px]">
            {state.formError}
          </p>
        )}

        <label htmlFor="password" className="text-kf-mut mb-1.5 block text-[12px] font-medium">
          Lozinka
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          aria-invalid={!!state.formError}
          aria-describedby={state.formError ? "password-error" : undefined}
          className="border-kf-line bg-kf-bg text-kf-ink aria-invalid:border-kf-danger w-full rounded-lg border px-3 py-2 text-[14px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kf-accent"
        />

        <button
          type="submit"
          disabled={pending}
          className="bg-kf-ink text-kf-accent-ink rounded-kf-btn kf-focus-ring mt-4 w-full cursor-pointer px-4 py-2.5 text-[14px] font-semibold transition-colors hover:bg-white disabled:cursor-default disabled:opacity-50"
        >
          {pending ? "Prijava…" : "Prijavi se"}
        </button>
      </form>
    </main>
  );
}
