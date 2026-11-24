"use client";

import {
  BookOpenCheck,
  Check,
  ChevronDown,
  ImagePlus,
  PenLine,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { FocusTimer } from "@/components/focus-timer";
import { CategoryIcon } from "@/components/lane-badge";
import { Notice } from "@/components/ui";
import {
  ApiError,
  createCheckin,
  uploadEvidenceImage,
  type CategoryConfig,
  type CategorySlug,
  type CheckInCreated,
  type ScoringMode,
} from "@/lib/api";
import { CATEGORY_META, formatPointsLabel } from "@/lib/categories";
import { enqueueOfflineCheckin } from "@/lib/offline-queue";
import { safeImageUrl } from "@/lib/url";

interface CheckinFormProps {
  challengeId: string;
  scoringMode: ScoringMode;
  categoryConfigs: CategoryConfig[];
  otherChallengesCount: number;
  onCreated: (checkin: CheckInCreated) => void;
  onPresenceChanged?: () => void;
}

export function CheckinForm({
  challengeId,
  scoringMode,
  categoryConfigs,
  otherChallengesCount,
  onCreated,
  onPresenceChanged,
}: CheckinFormProps) {
  const enabledConfigs = categoryConfigs.filter((c) => c.is_enabled);
  const [categorySlug, setCategorySlug] = useState<CategorySlug>(
    enabledConfigs[0]?.slug ?? "leetcode",
  );
  const [title, setTitle] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [description, setDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [difficulty, setDifficulty] = useState<"" | "Easy" | "Medium" | "Hard">("");
  const [language, setLanguage] = useState("");
  const [repository, setRepository] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [pagesRead, setPagesRead] = useState("");
  const [topic, setTopic] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");

  const [onlyThisChallenge, setOnlyThisChallenge] = useState(false);
  const canCrosspost = otherChallengesCount > 0;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!justPublished) return;
    const timer = setTimeout(() => setJustPublished(false), 1800);
    return () => clearTimeout(timer);
  }, [justPublished]);

  useEffect(() => {
    if (enabledConfigs.length > 0 && !enabledConfigs.some((c) => c.slug === categorySlug)) {
      setCategorySlug(enabledConfigs[0].slug);
    }
  }, [challengeId, categorySlug, enabledConfigs]);

  function positiveNumber(value: string): number | undefined {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  function buildMetadata(): Record<string, unknown> {
    if (categorySlug === "leetcode") {
      return {
        difficulty: difficulty || undefined,
        language: language.trim() || undefined,
      };
    }
    if (categorySlug === "project") {
      return {
        repository: repository.trim() || undefined,
        duration_minutes: positiveNumber(durationMinutes),
      };
    }
    if (categorySlug === "books") {
      return {
        book_title: bookTitle.trim() || undefined,
        pages_read: positiveNumber(pagesRead),
      };
    }
    return {
      topic: topic.trim() || undefined,
      duration_minutes: positiveNumber(durationMinutes),
    };
  }

  async function handleImageFile(file: File) {
    setError(null);
    setUploadingImage(true);
    try {
      const res = await uploadEvidenceImage(file);
      setImageUrl(res.image_url);
      setShowDetails(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar imagem.");
    } finally {
      setUploadingImage(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void handleImageFile(file);
    }
    event.target.value = "";
  }

  function handlePaste(event: ClipboardEvent<HTMLFormElement>) {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          void handleImageFile(file);
          break;
        }
      }
    }
  }

  async function submitCheckin() {
    if (!title.trim()) {
      setError("Informe o título da tarefa para publicar.");
      titleRef.current?.focus();
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    const payload = {
      category_slug: categorySlug,
      title: title.trim(),
      description: description.trim() || undefined,
      evidence_url: evidenceUrl.trim() || undefined,
      image_url: imageUrl ?? undefined,
      metadata_json: buildMetadata(),
      publish_to_all_challenges: canCrosspost && !onlyThisChallenge,
    };

    if (typeof window !== "undefined" && !window.navigator.onLine) {
      enqueueOfflineCheckin(challengeId, payload);
      setTitle("");
      setDescription("");
      setEvidenceUrl("");
      setImageUrl(null);
      setSuccessMessage("Sem conexão: check-in salvo na fila offline e será enviado automaticamente.");
      setJustPublished(true);
      setSubmitting(false);
      return;
    }

    try {
      const created = await createCheckin(challengeId, payload);
      setTitle("");
      setDescription("");
      setEvidenceUrl("");
      setImageUrl(null);
      const parts = [
        `Check-in publicado (${formatPointsLabel(
          created.points_awarded,
          scoringMode,
          created.status,
        )}).`,
      ];
      if (created.also_published_in.length > 0) {
        parts.push(`Também em: ${created.also_published_in.join(", ")}.`);
      }
      if (created.skipped_challenges.length > 0) {
        parts.push(`Não foi para: ${created.skipped_challenges.join(", ")}.`);
      }
      if (created.newly_unlocked_badges && created.newly_unlocked_badges.length > 0) {
        parts.push(
          `Nova(s) conquista(s) desbloqueada(s): ${created.newly_unlocked_badges.length}!`,
        );
      }
      setSuccessMessage(parts.join(" "));
      setJustPublished(true);
      onCreated(created);
      titleRef.current?.focus();
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        enqueueOfflineCheckin(challengeId, payload);
        setTitle("");
        setDescription("");
        setEvidenceUrl("");
        setImageUrl(null);
        setSuccessMessage(
          "Servidor inacessível: check-in salvo na fila offline para envio assim que reconectar.",
        );
        setJustPublished(true);
      } else {
        setError(err instanceof Error ? err.message : "Erro ao registrar check-in.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitCheckin();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void submitCheckin();
    }
  }

  const detailsLabel =
    categorySlug === "books"
      ? "livro, páginas, notas, print, link"
      : categorySlug === "leetcode"
        ? "linguagem, notas, print, link"
        : "tempo, tema, notas, print, link";
  const previewImg = safeImageUrl(imageUrl);

  return (
    <form
      onSubmit={handleSubmit}
      onPaste={handlePaste}
      aria-labelledby="checkin-form-title"
      className="card relative flex flex-col gap-4 overflow-hidden p-4 sm:p-5"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-accent-bright via-gold to-grape"
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/12 text-accent-text">
            <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2
              id="checkin-form-title"
              className="text-lg leading-tight font-extrabold tracking-tight text-ink-strong"
            >
              O que você estudou hoje?
            </h2>
            <p className="text-sm text-ink-2">Registre a atividade e mantenha o ritmo.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <FocusTimer
            challengeId={challengeId}
            categorySlug={categorySlug}
            onPresenceChanged={onPresenceChanged}
            onFinishMinutes={(minutes) => {
              setDurationMinutes(String(minutes));
              setShowDetails(true);
              titleRef.current?.focus();
            }}
          />
          <span className="hidden shrink-0 text-xs text-ink-2 md:inline">
            <kbd className="rounded-md border border-lane bg-well px-1.5 py-0.5 font-mono text-[11px] text-ink-strong">
              Ctrl+Enter
            </kbd>{" "}
            publica
          </span>
        </div>
      </div>

      <fieldset>
        <legend className="sr-only">Categoria de estudo</legend>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 sm:flex-wrap sm:overflow-visible">
          {enabledConfigs.map((cfg) => {
            const meta = CATEGORY_META[cfg.slug];
            const active = cfg.slug === categorySlug;
            return (
              <button
                key={cfg.slug}
                type="button"
                aria-pressed={active}
                onClick={() => setCategorySlug(cfg.slug)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border py-1.5 pr-3 pl-1.5 text-sm font-semibold transition-[background-color,border-color,box-shadow] ${
                  active
                    ? meta.chipActiveClass
                    : "border-lane bg-card text-ink-3 hover:border-lane-strong hover:text-ink-strong"
                }`}
              >
                <CategoryIcon slug={cfg.slug} size="md" checked={active} />
                {meta.shortLabel}
              </button>
            );
          })}
        </div>
      </fieldset>

      {categorySlug === "leetcode" && (
        <div className="flex flex-wrap items-center gap-2">
          <span id="checkin-difficulty-label" className="text-xs font-semibold text-ink-3">
            Dificuldade
          </span>
          <div
            role="group"
            aria-labelledby="checkin-difficulty-label"
            className="inline-flex rounded-xl border border-lane bg-well p-0.5"
          >
            {(
              [
                { value: "Easy", label: "Fácil" },
                { value: "Medium", label: "Médio" },
                { value: "Hard", label: "Difícil" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={difficulty === opt.value}
                onClick={() => setDifficulty((prev) => (prev === opt.value ? "" : opt.value))}
                className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors ${
                  difficulty === opt.value
                    ? "bg-card text-ink-strong shadow-card ring-1 ring-lane"
                    : "text-ink-2 hover:text-ink-strong"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {scoringMode === "points" && !difficulty && (
            <span className="text-xs text-ink-2">Sem escolher, pontua como Fácil.</span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <label className="sr-only" htmlFor="checkin-title-input">
            Título da tarefa
          </label>
          <PenLine
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-muted"
          />
          <input
            ref={titleRef}
            id="checkin-title-input"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (successMessage) setSuccessMessage(null);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ex.: Merge K Sorted Lists / Cap. 5 do DDIA"
            aria-invalid={error ? true : undefined}
            className="field min-h-12 pl-10 text-base"
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting || uploadingImage}
          aria-live="polite"
          className={`btn min-h-12 px-6 text-base ${
            justPublished ? "bg-success text-shell hover:bg-success" : "btn-primary"
          }`}
        >
          {submitting ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> Publicando...
            </>
          ) : justPublished ? (
            <>
              <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> Publicado
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" /> Publicar
            </>
          )}
        </button>
      </div>

      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-expanded={showDetails}
            aria-controls="checkin-details"
            onClick={() => setShowDetails((prev) => !prev)}
            className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-lg text-xs font-semibold text-ink-2 transition-colors hover:text-accent-text"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
            {showDetails ? "Ocultar detalhes opcionais" : `Adicionar detalhes (${detailsLabel})`}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploadingImage}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-semibold text-ink-2 transition-colors hover:text-accent-text"
          >
            <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
            {uploadingImage ? "Enviando print..." : imageUrl ? "Trocar print" : "Anexar print (Ctrl+V)"}
          </button>
        </div>

        {canCrosspost && (
          <label className="flex min-h-9 w-fit items-center gap-2 text-xs text-ink-3">
            <input
              type="checkbox"
              checked={onlyThisChallenge}
              onChange={(e) => setOnlyThisChallenge(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            <span>
              <span className="font-semibold text-ink-strong">Publicar apenas neste desafio</span>
              {!onlyThisChallenge && (
                <span className="text-ink-2">
                  {" "}
                  · também vai para{" "}
                  {otherChallengesCount === 1
                    ? "seu outro desafio"
                    : `seus outros ${otherChallengesCount} desafios`}
                </span>
              )}
            </span>
          </label>
        )}
      </div>

      {showDetails && (
        <div
          id="checkin-details"
          className="animate-reveal flex flex-col gap-3 rounded-2xl bg-well p-3.5 ring-1 ring-lane-soft"
        >
          {categorySlug === "leetcode" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                Linguagem
                <input
                  type="text"
                  value={language}
                  placeholder="Ex.: Python, Go, TypeScript"
                  onChange={(e) => setLanguage(e.target.value)}
                  className="field bg-card"
                />
              </label>
            </div>
          )}

          {categorySlug === "books" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                Nome do livro
                <input
                  type="text"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="Ex.: Designing Data-Intensive Applications"
                  className="field bg-card"
                />
              </label>
              <label className="field-label">
                Páginas lidas
                <input
                  type="number"
                  min={1}
                  value={pagesRead}
                  placeholder="Ex.: 20"
                  onChange={(e) => setPagesRead(e.target.value)}
                  className="field bg-card tabular-nums"
                />
              </label>
            </div>
          )}

          {categorySlug === "project" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                Repositório / Projeto
                <input
                  type="text"
                  value={repository}
                  onChange={(e) => setRepository(e.target.value)}
                  placeholder="Ex.: octocat/meu-projeto"
                  className="field bg-card"
                />
              </label>
              <label className="field-label">
                Minutos dedicados
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={durationMinutes}
                  placeholder="Ex.: 45"
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="field bg-card tabular-nums"
                />
              </label>
            </div>
          )}

          {(categorySlug === "esw" || categorySlug === "data") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                Subtema
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={
                    categorySlug === "esw"
                      ? "Ex.: System Design, Testes, Arquitetura"
                      : "Ex.: SQL, ETL, Pandas, Machine Learning"
                  }
                  className="field bg-card"
                />
              </label>
              <label className="field-label">
                Minutos dedicados
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={durationMinutes}
                  placeholder="Ex.: 45"
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="field bg-card tabular-nums"
                />
              </label>
            </div>
          )}

          <label className="field-label">
            Descrição livre (opcional)
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Anotações em Markdown, trechos de código ou o que você aprendeu..."
              className="field bg-card py-2.5"
            />
          </label>

          <label className="field-label">
            Link de evidência (opcional)
            <input
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://..."
              className="field bg-card"
            />
          </label>

          {previewImg && (
            <div className="relative w-fit overflow-hidden rounded-xl border border-lane bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImg} alt="Prévia da evidência anexada" className="max-h-40 w-auto" />
              <button
                type="button"
                aria-label="Remover print anexado"
                onClick={() => setImageUrl(null)}
                className="absolute top-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-shell/85 text-white hover:bg-shell"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      )}

      {successMessage && (
        <Notice tone="success" onDismiss={() => setSuccessMessage(null)}>
          {successMessage}
        </Notice>
      )}
    </form>
  );
}
