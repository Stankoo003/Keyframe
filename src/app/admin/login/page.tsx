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
    <div className="flex min-h-full items-center justify-center px-5">
      <form action={formAction} className="border-kf-line bg-kf-surface rounded-kf-card w-full max-w-90 border p-6">
        <h1 className="mb-5 text-[18px] font-semibold tracking-[-0.02em]">Keyframe admin</h1>

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
          className="bg-kf-ink text-kf-accent-ink rounded-kf-btn mt-4 w-full cursor-pointer px-4 py-2.5 text-[14px] font-semibold transition-colors hover:bg-white disabled:cursor-default disabled:opacity-50"
        >
          {pending ? "Prijava…" : "Prijavi se"}
        </button>
      </form>
    </div>
  );
}
