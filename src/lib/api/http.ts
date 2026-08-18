import { NextResponse } from "next/server";
import type { ZodError } from "zod";

import type { ApiErrorBody } from "@/domain/video";

/**
 * Jedinstven oblik HTTP odgovora za sve API rute.
 *
 * Postoji da se rute ne bi razilazile — klijent koji nauci da procita gresku sa
 * jednog endpointa ume da je procita sa svakog.
 */

/** 200 sa tipiziranim telom. */
export function ok<T>(body: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(body, init);
}

/**
 * 400 sa spiskom problema po polju.
 *
 * Koristi `error.issues` — jedini deo ZodError-a koji je isti u zod v3 i v4
 * (`format()` i `treeifyError()` se razlikuju izmedju verzija).
 */
export function badRequest(error: ZodError): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: {
        code: "VALIDATION_ERROR" as const,
        message: "Neispravni parametri zahteva.",
        details: error.issues.map((issue) => ({
          path: issue.path.join(".") || "(koren)",
          message: issue.message,
        })),
      },
    },
    { status: 400 },
  );
}

/** 404 sa porukom koja kaze sta nije nadjeno. */
export function notFound(message: string): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: {
        code: "NOT_FOUND" as const,
        message,
      },
    },
    { status: 404 },
  );
}
