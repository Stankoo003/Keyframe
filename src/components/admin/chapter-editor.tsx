"use client";

import { useActionState, useMemo, useState } from "react";

import { FieldError } from "@/components/admin/field-error";
import type { AdminChapterDto } from "@/domain/admin-video";
import { chapterListSchema } from "@/lib/admin/schemas";
import { saveChaptersAction, type SaveChaptersState } from "@/server/actions/admin-chapters";

/** Lokalni identitet reda, NE isto sto i DB `id` — postoji da React zna koji
 *  red je koji kroz reorder, ostaje stabilan i za novododata poglavlja koja
 *  jos nemaju DB `id`. */
type EditableChapter = { key: string; title: string; startSeconds: number };

let nextKey = 0;
const freshKey = () => `new-${(nextKey += 1)}`;

const INPUT =
  "border-kf-line bg-kf-surface text-kf-ink w-full rounded-lg border px-2.5 py-1.5 text-[13px] outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kf-accent aria-invalid:border-kf-danger";

const INITIAL_STATE: SaveChaptersState = {};

/**
 * Dodaj/obrisi/preuredi/retime — sve lokalno, JEDNO "Sačuvaj" dugme salje ceo
 * niz odjednom (`saveChaptersAction` zamenjuje sva poglavlja u transakciji,
 * vidi `replaceChapters`). Strelice gore/dole umesto drag-and-drop: dostupno
 * tastaturom bez dodatne biblioteke ili ARIA live-region orkestracije koju
 * drag-and-drop zahteva.
 *
 * Zod sema je DELJENA sa server-side validacijom (`chapterListSchema` iz
 * `src/lib/admin/schemas.ts`, bez "server-only") — live greske ispod svakog
 * polja su tacno ono sto ce i server reci, ne aproksimacija.
 */
export function ChapterEditor({
  videoId,
  durationSeconds,
  initialChapters,
}: {
  videoId: string;
  durationSeconds: number;
  initialChapters: readonly AdminChapterDto[];
}) {
  const [chapters, setChapters] = useState<EditableChapter[]>(() =>
    initialChapters.map((chapter) => ({
      key: chapter.id,
      title: chapter.title,
      startSeconds: chapter.startSeconds,
    })),
  );
  const [state, formAction, pending] = useActionState(saveChaptersAction, INITIAL_STATE);

  /** Kljuc `"<index>:title"`/`"<index>:startSeconds"` — precizno, ne string-matching na tekst poruke. */
  const errors = useMemo(() => {
    const result = chapterListSchema(durationSeconds).safeParse(
      chapters.map(({ title, startSeconds }) => ({ title, startSeconds })),
    );
    if (result.success) return {};
    const map: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const index = issue.path[0];
      const field = issue.path[1];
      if (typeof index !== "number") continue;
      const key = typeof field === "string" ? `${index}:${field}` : `${index}:title`;
      (map[key] ??= []).push(issue.message);
    }
    return map;
  }, [chapters, durationSeconds]);

  const hasErrors = Object.keys(errors).length > 0;

  const update = (key: string, patch: Partial<EditableChapter>) => {
    setChapters((prev) => prev.map((chapter) => (chapter.key === key ? { ...chapter, ...patch } : chapter)));
  };

  const remove = (key: string) => {
    setChapters((prev) => prev.filter((chapter) => chapter.key !== key));
  };

  const move = (index: number, direction: -1 | 1) => {
    setChapters((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const add = () => {
    setChapters((prev) => [...prev, { key: freshKey(), title: "", startSeconds: 0 }]);
  };

  const onSave = () => {
    formAction({
      videoId,
      chapters: chapters.map(({ title, startSeconds }) => ({ title, startSeconds })),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {state.formError && (
        <p role="alert" className="text-kf-danger border-kf-danger rounded-lg border px-3 py-2 text-[13px]">
          {state.formError}
        </p>
      )}
      {state.savedAt && !state.formError && (
        <p role="status" className="text-kf-accent text-[13px]">
          Poglavlja sačuvana.
        </p>
      )}

      {chapters.length === 0 && (
        <p className="text-kf-mut text-[13px]">Nema poglavlja — dodaj prvo ispod.</p>
      )}

      <ul className="flex flex-col gap-3">
        {chapters.map((chapter, index) => {
          const titleId = `chapter-${chapter.key}-title`;
          const timeId = `chapter-${chapter.key}-time`;
          const titleErrors = errors[`${index}:title`];
          const timeErrors = errors[`${index}:startSeconds`];
          const hasRowError = !!titleErrors || !!timeErrors;

          return (
            <li
              key={chapter.key}
              className={`rounded-kf-thumb border p-3 ${hasRowError ? "border-kf-danger" : "border-kf-line"}`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-kf-mut2 mt-2 w-6 shrink-0 font-mono text-[12px]">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="flex-1">
                  <label htmlFor={titleId} className="sr-only">
                    Naslov poglavlja {index + 1}
                  </label>
                  <input
                    id={titleId}
                    value={chapter.title}
                    onChange={(event) => update(chapter.key, { title: event.target.value })}
                    placeholder="Naslov poglavlja"
                    aria-invalid={!!titleErrors}
                    aria-describedby={titleErrors ? `${titleId}-error` : undefined}
                    className={INPUT}
                  />
                </div>

                <div className="w-28 shrink-0">
                  <label htmlFor={timeId} className="sr-only">
                    Početak poglavlja {index + 1} u sekundama
                  </label>
                  <input
                    id={timeId}
                    type="number"
                    min={0}
                    step={1}
                    value={chapter.startSeconds}
                    onChange={(event) => update(chapter.key, { startSeconds: Number(event.target.value) })}
                    aria-invalid={!!timeErrors}
                    aria-describedby={timeErrors ? `${timeId}-error` : undefined}
                    className={`${INPUT} font-mono`}
                  />
                </div>

                <div className="mt-0.5 flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Pomeri poglavlje ${index + 1} gore`}
                    title="Gore"
                    className="border-kf-line hover:bg-kf-fill focus-visible:outline-kf-accent size-8 cursor-pointer rounded-md border text-[13px] disabled:cursor-default disabled:opacity-30 focus-visible:outline-2"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === chapters.length - 1}
                    aria-label={`Pomeri poglavlje ${index + 1} dole`}
                    title="Dole"
                    className="border-kf-line hover:bg-kf-fill focus-visible:outline-kf-accent size-8 cursor-pointer rounded-md border text-[13px] disabled:cursor-default disabled:opacity-30 focus-visible:outline-2"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(chapter.key)}
                    aria-label={`Obriši poglavlje ${index + 1}`}
                    title="Obriši"
                    className="border-kf-line text-kf-danger hover:bg-kf-danger-soft focus-visible:outline-kf-accent size-8 cursor-pointer rounded-md border text-[13px] focus-visible:outline-2"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <FieldError id={`${titleId}-error`} messages={titleErrors} />
              <FieldError id={`${timeId}-error`} messages={timeErrors} />
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={add}
          className="border-kf-line hover:bg-kf-fill focus-visible:outline-kf-accent rounded-kf-btn cursor-pointer border px-3.5 py-2 text-[13px] font-medium focus-visible:outline-2"
        >
          + Dodaj poglavlje
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={pending || hasErrors}
          className="bg-kf-ink text-kf-accent-ink rounded-kf-btn cursor-pointer px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-white disabled:cursor-default disabled:opacity-50"
        >
          {pending ? "Čuvam…" : "Sačuvaj poglavlja"}
        </button>
      </div>
    </div>
  );
}
