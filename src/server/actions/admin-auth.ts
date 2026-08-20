"use server";

import { timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env, isDev } from "@/lib/env";
import { ADMIN_SESSION_COOKIE, signSession, verifySession } from "@/server/auth/session";

export type LoginFormState = { formError?: string };

/** SHA-256 pa `timingSafeEqual` — konstantno vreme BEZ zahteva da su ulazi iste duzine. */
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Login preko jedne deljene lozinke (`ADMIN_PASSWORD`) — nema username, nema
 * vise naloga. Uspeh postavlja potpisan httpOnly cookie i redirektuje na
 * `/admin`; neuspeh vraca gresku za `useActionState` na login formi.
 */
export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const password = String(formData.get("password") ?? "");

  if (!password || !safeEqual(password, env.ADMIN_PASSWORD)) {
    return { formError: "Pogrešna lozinka." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, await signSession(env.AUTH_SESSION_SECRET), {
    httpOnly: true,
    secure: !isDev,
    sameSite: "lax",
    path: "/",
  });

  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}

/**
 * Odbrana u dubinu za mutacije — `src/proxy.ts` je primarna barijera za
 * stranice, ali Server Action se moze pozvati direktno POST-om ka istoj
 * putanji, pa svaka mutacija mora i sama da proveri sesiju.
 */
export async function requireAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const valid = await verifySession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value, env.AUTH_SESSION_SECRET);
  if (!valid) redirect("/admin/login");
}
