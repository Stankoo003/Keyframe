"use client";

import { useActionState } from "react";

import { FieldError } from "@/components/admin/field-error";
import type { VideoFormState } from "@/server/actions/admin-videos";

const LABEL = "text-kf-mut mb-1.5 block text-[12px] font-medium tracking-[0.01em]";
const INPUT =
  "border-kf-line bg-kf-surface text-kf-ink w-full rounded-lg border px-3 py-2 text-[14px] outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kf-accent aria-invalid:border-kf-danger";

const INITIAL_STATE: VideoFormState = {};

/**
 * Forma metapodataka — deljena za "novi video" i "izmeni video" (razlikuje se
 * samo po `action`-u i pocetnim vrednostima). Svako polje nosi
 * `aria-invalid`/`aria-describedby` ka svom `FieldError`-u — vidi taj fajl za
 * zasto (AC trazi da se greske NAJAVE, ne samo prikazu).
 */
export function VideoForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prevState: VideoFormState, formData: FormData) => Promise<VideoFormState>;
  initial?: {
    slug?: string;
    title?: string;
    description?: string | null;
    durationSeconds?: number;
    posterPath?: string | null;
    manifestPath?: string;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-[560px] flex-col gap-4">
      {state.formError && (
        <p role="alert" className="text-kf-danger border-kf-danger rounded-lg border px-3 py-2 text-[13px]">
          {state.formError}
        </p>
      )}

      <div>
        <label htmlFor="slug" className={LABEL}>
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          defaultValue={initial?.slug}
          aria-invalid={!!errors.slug}
          aria-describedby={errors.slug ? "slug-error" : undefined}
          className={INPUT}
        />
        <FieldError id="slug-error" messages={errors.slug} />
      </div>

      <div>
        <label htmlFor="title" className={LABEL}>
          Naslov
        </label>
        <input
          id="title"
          name="title"
          defaultValue={initial?.title}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "title-error" : undefined}
          className={INPUT}
        />
        <FieldError id="title-error" messages={errors.title} />
      </div>

      <div>
        <label htmlFor="description" className={LABEL}>
          Opis
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={initial?.description ?? ""}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "description-error" : undefined}
          className={INPUT}
        />
        <FieldError id="description-error" messages={errors.description} />
      </div>

      <div>
        <label htmlFor="durationSeconds" className={LABEL}>
          Trajanje (sekunde)
        </label>
        <input
          id="durationSeconds"
          name="durationSeconds"
          type="number"
          min={1}
          step={1}
          defaultValue={initial?.durationSeconds}
          aria-invalid={!!errors.durationSeconds}
          aria-describedby={errors.durationSeconds ? "durationSeconds-error" : undefined}
          className={INPUT}
        />
        <FieldError id="durationSeconds-error" messages={errors.durationSeconds} />
      </div>

      <div>
        <label htmlFor="manifestPath" className={LABEL}>
          Putanja do manifesta
        </label>
        <input
          id="manifestPath"
          name="manifestPath"
          placeholder="hls/moj-snimak/master.m3u8"
          defaultValue={initial?.manifestPath}
          aria-invalid={!!errors.manifestPath}
          aria-describedby={errors.manifestPath ? "manifestPath-error" : undefined}
          className={`${INPUT} font-mono text-[13px]`}
        />
        <FieldError id="manifestPath-error" messages={errors.manifestPath} />
      </div>

      <div>
        <label htmlFor="posterPath" className={LABEL}>
          Putanja do postera (opciono)
        </label>
        <input
          id="posterPath"
          name="posterPath"
          placeholder="hls/moj-snimak/poster.jpg"
          defaultValue={initial?.posterPath ?? ""}
          aria-invalid={!!errors.posterPath}
          aria-describedby={errors.posterPath ? "posterPath-error" : undefined}
          className={`${INPUT} font-mono text-[13px]`}
        />
        <FieldError id="posterPath-error" messages={errors.posterPath} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-kf-ink text-kf-accent-ink rounded-kf-btn mt-1 cursor-pointer px-4 py-2.5 text-[14px] font-semibold transition-colors hover:bg-white disabled:cursor-default disabled:opacity-50"
      >
        {pending ? "Čuvam…" : submitLabel}
      </button>
    </form>
  );
}
