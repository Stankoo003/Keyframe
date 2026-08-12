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
} as const;

export const isDev = env.NODE_ENV === "development";
