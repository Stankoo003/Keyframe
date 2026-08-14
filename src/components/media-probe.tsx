"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "ok" | "cors-error" | "http-error";

/**
 * Povlaci master playlistu iz browsera i prijavljuje ishod.
 *
 * Ovo je pravi cross-origin fetch sa app origina ka CDN-u — ako CORS na bucketu
 * nije podesen, ovde puca, dok bi `curl` i dalje prolazio (curl ne primenjuje
 * same-origin politiku). Zato je ova provera vrednija od komandne linije.
 */
export function MediaProbe({ url }: { url: string }) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;

    fetch(url)
      .then((response) => {
        if (cancelled) return;
        setStatus(response.ok ? "ok" : "http-error");
      })
      .catch(() => {
        // fetch odbija promise na CORS gresci — poruka nije dostupna skripti.
        if (!cancelled) setStatus("cors-error");
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  const label: Record<Status, string> = {
    checking: "proveravam…",
    ok: "dostupno, bez CORS greške",
    "cors-error": "CORS greška — proveri CORS policy na bucketu",
    "http-error": "odgovor nije 200",
  };

  const color: Record<Status, string> = {
    checking: "text-gray-500",
    ok: "text-green-600",
    "cors-error": "text-red-600",
    "http-error": "text-red-600",
  };

  return <span className={color[status]}>{label[status]}</span>;
}
