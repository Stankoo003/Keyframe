/**
 * Jedino mesto na kome se cita process.env.
 * Puca odmah pri startu ako fali obavezna varijabla, umesto da app padne kasnije
 * sa nejasnom greskom iz drajvera baze.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Nedostaje environment varijabla ${name}. Kopiraj .env.example u .env.local i popuni je.`,
    );
  }
  return value;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  /** Lozinka za jedini admin nalog — poredi se protiv unosa u login formi. */
  ADMIN_PASSWORD: required("ADMIN_PASSWORD"),
  /**
   * Kljuc za potpisivanje admin session cookie-a. Namerno ODVOJEN od
   * `ADMIN_PASSWORD` — kompromitovan potpis (npr. procurela env varijabla na
   * jednoj masini) ne sme automatski da otkrije i samu lozinku.
   */
  AUTH_SESSION_SECRET: required("AUTH_SESSION_SECRET"),
} as const;

export const isDev = env.NODE_ENV === "development";
