/**
 * Greška vezana za jedno polje forme.
 *
 * `role="alert"` znaci da citac ekrana ODMAH najavi tekst kad se pojavi u
 * DOM-u — ne samo vizuelno preko boje. Poziv mesto MORA da postavi
 * `aria-invalid` i `aria-describedby={id}` na samom `<input>`/`<select>`,
 * ovaj element samo iscrtava poruku i nosi `id` na koji se `aria-describedby`
 * kaci.
 */
export function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p id={id} role="alert" className="text-kf-danger mt-1 text-[12px] leading-[1.4]">
      {messages.join(" ")}
    </p>
  );
}
