import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, Images, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, LoadingState } from "@/components/social-components";
import { postRepository } from "@/lib/repositories/post-repository";
import { schedulePost } from "@/lib/repositories/publish-queue-repository";
import { mediaRepository } from "@/lib/repositories/media-repository";
import { uploadStorageObject } from "@/lib/supabase/client";
import type { MediaAssetRow, PostRow } from "@/lib/supabase/types";

const FORMATS = [
  "Feed 1080x1350",
  "Feed quadrado 1080x1080",
  "Story 1080x1920",
  "Reels 1080x1920",
  "Carrossel 5 páginas",
  "Carrossel 8 páginas",
  "Facebook 1200x630",
];
const CHANNELS = ["Instagram", "Facebook", "Ambos"];
const MAX_CAROUSEL_SLOTS = 10;

type Slot = { id: string; url: string; isVideo: boolean; label: string };

function isCarouselFormat(format: string) {
  return format.toLowerCase().includes("carrossel");
}

function nowLocalPlusHour() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
  return iso.slice(0, 16);
}

function normalizeHashtags(raw: string) {
  return raw
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
}

export function ManualPublishPanel({
  session,
  brandId,
  onScheduled,
}: {
  session: { access_token: string } | null;
  brandId?: string | null;
  onScheduled: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [cta, setCta] = useState("");
  const [channel, setChannel] = useState<string>("Instagram");
  const [format, setFormat] = useState<string>("Feed 1080x1350");
  const [scheduledAt, setScheduledAt] = useState(nowLocalPlusHour());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryItems, setGalleryItems] = useState<MediaAssetRow[]>([]);

  const carousel = isCarouselFormat(format);
  const maxSlots = carousel ? MAX_CAROUSEL_SLOTS : 1;

  const loadGallery = useCallback(async () => {
    if (!session || !brandId) return;
    setGalleryLoading(true);
    try {
      const rows = await mediaRepository.listByBrand(
        session.access_token,
        brandId,
        "select=id,name,url,preview_url,media_type,created_at&order=created_at.desc&limit=60",
        false,
      );
      setGalleryItems(rows.filter((row) => row.url));
    } catch {
      // Galeria é um atalho opcional; falha aqui não deve travar o restante do formulário.
    } finally {
      setGalleryLoading(false);
    }
  }, [session, brandId]);

  useEffect(() => {
    if (galleryOpen) void loadGallery();
  }, [galleryOpen, loadGallery]);

  function addSlot(next: Slot) {
    setSlots((current) => {
      if (current.length >= maxSlots) {
        toast.info(
          carousel
            ? `Limite de ${MAX_CAROUSEL_SLOTS} páginas por carrossel.`
            : "Este formato aceita apenas 1 mídia. Troque para Carrossel para enviar várias.",
        );
        return current;
      }
      return [...current, next];
    });
  }

  function removeSlot(id: string) {
    setSlots((current) => current.filter((slot) => slot.id !== id));
  }

  async function handleFiles(fileList: FileList | null) {
    if (!session || !fileList?.length) return;
    setUploading(true);
    setError("");
    try {
      const files = Array.from(fileList).slice(0, maxSlots - slots.length);
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
        const storagePath = `${brandId ?? "manual"}/manual/${crypto.randomUUID()}-${safeName}`;
        const uploaded = await uploadStorageObject("creative-media", storagePath, session.access_token, file);
        addSlot({
          id: crypto.randomUUID(),
          url: uploaded.publicUrl,
          isVideo: file.type.startsWith("video/"),
          label: file.name,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar arquivo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function pickFromGallery(item: MediaAssetRow) {
    const url = item.url ?? item.preview_url ?? "";
    if (!url) return;
    addSlot({
      id: crypto.randomUUID(),
      url,
      isVideo: String(item.media_type ?? "").toLowerCase().includes("vídeo") || String(item.media_type ?? "").toLowerCase().includes("video"),
      label: item.name,
    });
  }

  function reset() {
    setTitle("");
    setCaption("");
    setHashtagsText("");
    setCta("");
    setSlots([]);
  }

  async function submit() {
    if (!session) return;
    setError("");
    if (!title.trim()) {
      setError("Dê um título para identificar a publicação.");
      return;
    }
    if (!slots.length) {
      setError("Envie ou selecione ao menos uma mídia final antes de agendar.");
      return;
    }
    if (carousel && slots.length < 2) {
      setError("Carrossel precisa de pelo menos 2 imagens/páginas.");
      return;
    }
    if (!scheduledAt) {
      setError("Escolha data e hora de publicação.");
      return;
    }
    setSaving(true);
    try {
      const first = slots[0];
      const post = await postRepository.create(session.access_token, {
        brand_id: brandId ?? undefined,
        title: title.trim(),
        channel,
        format,
        caption: caption.trim() || undefined,
        hashtags: normalizeHashtags(hashtagsText),
        cta: cta.trim() || undefined,
        media_url: !carousel && first.isVideo ? undefined : first.url,
        video_url: !carousel && first.isVideo ? first.url : undefined,
        carousel_media_urls: carousel ? slots.map((slot) => slot.url) : undefined,
        status: "aprovado",
        approved_at: new Date().toISOString(),
        scheduled_at: new Date(scheduledAt).toISOString(),
      } as Partial<PostRow>);

      await schedulePost(session.access_token, { id: post.id, channel }, new Date(scheduledAt).toISOString());

      toast.success("Publicação manual criada e agendada na fila.");
      reset();
      await onScheduled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar publicação manual.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-1 h-6 w-6 text-primary" />
        <div>
          <h3 className="text-xl font-bold">Publicação manual</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Suba mídia pronta (feed, story, carrossel com várias páginas etc.), escreva a legenda e agende —
            sem passar pela geração de IA. Vai para a mesma fila (<code>publish_queue</code>) usada pela
            publicação automática.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold">Título interno</span>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Story lançamento julho" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold">CTA</span>
          <Input value={cta} onChange={(event) => setCta(event.target.value)} placeholder="Ex.: Fale com a MYINC" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold">Formato</span>
          <Select
            value={format}
            onValueChange={(value) => {
              setFormat(value);
              if (!isCarouselFormat(value) && slots.length > 1) {
                setSlots((current) => current.slice(0, 1));
                toast.info("Formato não é carrossel: mantida apenas a primeira mídia.");
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold">Canal</span>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="md:col-span-2 space-y-2">
          <span className="text-sm font-semibold">Legenda</span>
          <Textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            className="min-h-24 resize-y"
            placeholder="Escreva a legenda final que vai para o Instagram/Facebook..."
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold">Hashtags</span>
          <Input
            value={hashtagsText}
            onChange={(event) => setHashtagsText(event.target.value)}
            placeholder="MYINC Arquitetura AltoPadrao"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold">Data e hora de publicação</span>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            Mídia final {carousel ? `(carrossel — ${slots.length}/${MAX_CAROUSEL_SLOTS} páginas, mínimo 2)` : "(imagem ou vídeo)"}
          </span>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple={carousel}
              className="hidden"
              onChange={(event) => void handleFiles(event.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={uploading || slots.length >= maxSlots}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" /> {uploading ? "Enviando..." : "Enviar arquivo"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={slots.length >= maxSlots}
              onClick={() => setGalleryOpen((open) => !open)}
            >
              <Images className="h-4 w-4" /> Galeria
            </Button>
          </div>
        </div>

        {slots.length ? (
          <div className="flex flex-wrap gap-3">
            {slots.map((slot, index) => (
              <div key={slot.id} className="group relative h-24 w-24 overflow-hidden rounded-xl border border-border bg-background/60">
                {slot.isVideo ? (
                  <video src={slot.url} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={slot.url} alt={slot.label} className="h-full w-full object-cover" />
                )}
                {carousel ? (
                  <span className="absolute left-1 top-1 rounded-full bg-background/90 px-1.5 py-0.5 text-[0.65rem] font-bold">
                    {index + 1}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeSlot(slot.id)}
                  className="absolute right-1 top-1 rounded-full bg-destructive/90 p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remover mídia"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhuma mídia selecionada ainda.</p>
        )}

        {galleryOpen ? (
          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between">
              <b className="text-sm">Selecionar da galeria</b>
              <Button type="button" variant="ghost" size="sm" onClick={() => setGalleryOpen(false)}>
                Fechar
              </Button>
            </div>
            {galleryLoading ? <LoadingState label="Carregando galeria..." /> : null}
            {!galleryLoading && !galleryItems.length ? (
              <p className="mt-2 text-xs text-muted-foreground">Nenhuma mídia na biblioteca ainda.</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-3">
              {galleryItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickFromGallery(item)}
                  disabled={slots.length >= maxSlots}
                  className="h-20 w-20 overflow-hidden rounded-xl border border-border transition-transform hover:scale-105 disabled:opacity-40"
                  title={item.name}
                >
                  {String(item.media_type ?? "").toLowerCase().includes("video") ? (
                    <video src={item.url ?? item.preview_url ?? ""} className="h-full w-full object-cover" muted />
                  ) : (
                    <img
                      src={item.preview_url ?? item.url ?? ""}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {slots.length ? (
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setSlots([])}>
            <Trash2 className="h-4 w-4" /> Limpar mídia selecionada
          </Button>
        ) : null}
      </div>

      <Button
        className="mt-5 rounded-full bg-gradient-primary text-primary-foreground"
        disabled={saving || !session}
        onClick={() => void submit()}
      >
        <CalendarClock className="h-4 w-4" />
        {saving ? "Agendando..." : "Criar e agendar publicação"}
      </Button>
    </div>
  );
}
