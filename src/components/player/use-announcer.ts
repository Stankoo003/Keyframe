"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tekst za `aria-live` region plejera.
 *
 * Postoji zato sto su sve kontrole custom: kad korisnik pritisne razmak, citac
 * ekrana ne kaze nista sam od sebe — nativni plejer bi rekao. Bez ovoga slepi
 * korisnik ne zna da li je akcija uopste primljena.
 *
 * Dva pravila drze region korisnim umesto bucnim:
 *
 *  1. Objave nastaju iz NAMERE korisnika, nikad iz `timeupdate`. Objavljivanje
 *     na svaki otkucaj vremena pretvorilo bi citac u neprekidan monolog.
 *  2. Ista poruka se ne ponavlja. Citaci ionako ume da preskoce identican
 *     sadrzaj, pa bi jedino sto bi se postiglo bio suvisan render.
 */
export function useAnnouncer() {
  const [message, setMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * `delayMs` postoji zbog drzanja strelice: dvadeset uzastopnih preskakanja
   * treba da da jednu zavrsnu objavu pozicije, a ne dvadeset isprekidanih.
   */
  const announce = useCallback((text: string, delayMs = 0) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (delayMs <= 0) {
      setMessage((prev) => (prev === text ? prev : text));
      return;
    }

    timerRef.current = setTimeout(() => {
      setMessage((prev) => (prev === text ? prev : text));
    }, delayMs);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { message, announce };
}

/**
 * Objavi `message` kad se `value` PROMENI — prvo renderovanje se preskace.
 *
 * Bez preskakanja bi plejer pri svakom ucitavanju strane odmah rekao
 * "Pauzirano", "Zvuk ukljucen", "Titlovi iskljuceni" — stanje koje korisnik
 * nije izazvao i koje mu ne znaci nista.
 *
 * Okidac je `value`, a ne `message`: poruka o poziciji se racuna u svakom
 * renderu i menja se na svaki otkucaj vremena, pa bi kao okidac pretvorila
 * region u monolog. `null` znaci "ova promena se ne objavljuje".
 */
export function useAnnounceOnChange<T>(
  value: T,
  message: string | null,
  announce: (text: string, delayMs?: number) => void,
  delayMs = 0,
): void {
  const previousRef = useRef<T>(value);

  useEffect(() => {
    if (Object.is(previousRef.current, value)) return;
    previousRef.current = value;

    if (message) announce(message, delayMs);
  }, [value, message, announce, delayMs]);
}
