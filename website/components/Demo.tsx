"use client";
import { sitePath } from "@/lib/site-path";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileDown,
  FileText,
  Focus,
  LoaderCircle,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { readDemoPdf } from "@/lib/read-demo-pdf";
import { drawingRules, isoTolerance } from "@/lib/drawing-tolerances";
import { placeMarkers } from "@/lib/drawing-markers";
import {
  csvReport,
  displayNumber as fmt,
  MAX_MANUAL,
  numeric,
  parseMeasurementInput,
  verdict,
  type ControlPoint,
  type DemoDocument,
  type DemoReading,
} from "@/lib/drawing-demo";
import { track } from "@/lib/analytics";
import { Button } from "./ui/button";
import { ApplicationEntry } from "./ApplicationEntry";
import {
  initialReportMetadata,
  withDemoMetadata,
  type ReportMetadata,
} from "@/lib/report-metadata";
import { ReportDetails } from "./ReportDetails";
import { DemoReportDownload } from "./DemoReportDownload";
import { DemoProcessing } from "./DemoProcessing";
import "./demo.css";
import "./demo-report.css";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Demo({
  standalone = false,
  initialSample = false,
}: {
  standalone?: boolean;
  initialSample?: boolean;
}) {
  const [doc, setDoc] = useState<DemoDocument | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [drag, setDrag] = useState(false);
  const [active, setActive] = useState(0),
    [raw, setRaw] = useState(""),
    [note, setNote] = useState(""),
    [readings, setReadings] = useState<Record<string, DemoReading>>({});
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [showSignup, setShowSignup] = useState(false),
    [showReport, setShowReport] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false),
    [consent, setConsent] = useState(false),
    [aiUsed, setAiUsed] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [ready, setReady] = useState(false);
  const [firstSaved, setFirstSaved] = useState(false),
    [focusMode, setFocusMode] = useState(false);
  const [metadata, setMetadata] = useState<ReportMetadata | null>(null);
  const rules = drawingRules(doc?.sources || []),
    markers = doc
      ? placeMarkers(doc.points, doc.sources, doc.width / doc.height)
      : [];
  const fileInput = useRef<HTMLInputElement>(null),
    measureInput = useRef<HTMLInputElement>(null),
    workbench = useRef<HTMLDivElement>(null),
    reportRef = useRef<HTMLElement>(null),
    signupRef = useRef<HTMLDivElement>(null);
  const pending = useRef(false),
    generation = useRef(0),
    abort = useRef<AbortController | null>(null),
    dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(
      null,
    );
  const point = doc?.points[active],
    manualPoints = doc?.points.slice(0, MAX_MANUAL) || [],
    manualCount = manualPoints.filter(
      (p) => readings[p.id]?.kind === "manual",
    ).length;
  const complete =
    manualPoints.length > 0 && manualCount === manualPoints.length;
  const value = numeric(raw),
    state =
      point && value !== null
        ? point.unit
          ? verdict(value, point)
          : "unknown"
        : null;
  useEffect(() => {
    setReady(true);
    const controller = new AbortController();
    void fetch(sitePath("/api/demo-analysis"), { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => setAiAvailable(d.available === true))
      .catch(() => {});
    return () => {
      controller.abort();
      abort.current?.abort();
      generation.current++;
    };
  }, []);
  const updatePoint = (change: Partial<ControlPoint>) => {
    if (!doc || !point) return;
    const changesBounds =
      "lower" in change ||
      "upper" in change ||
      "nominal" in change ||
      "unit" in change;
    setDoc({
      ...doc,
      points: doc.points.map((p) =>
        p.id === point.id
          ? {
              ...p,
              ...(changesBounds
                ? { toleranceSource: "Kullanıcı tarafından düzenlendi" }
                : {}),
              ...change,
            }
          : p,
      ),
    });
    setReadings((prev) => {
      const next = { ...prev };
      delete next[point.id];
      return next;
    });
    setShowReport(false);
    setError("");
  };
  const choose = (index: number) => {
    if (!doc || index >= MAX_MANUAL) return;
    const target = doc.points[index],
      saved = readings[target.id];
    setActive(index);
    setRaw(
      saved ? (saved.rawInput ?? String(saved.value).replace(".", ",")) : "",
    );
    setNote(saved?.note || "");
    setError("");
    setPan({ x: 0, y: 0 });
    track("balloon_selected");
  };
  const load = async (file: File) => {
    if (pending.current) return;
    pending.current = true;
    const controller = new AbortController();
    abort.current = controller;
    const run = ++generation.current;
    setError("");
    setBusy("İlk sayfa okunuyor…");
    try {
      let loaded = await readDemoPdf(
        file,
        (message) => {
          if (run === generation.current) setBusy(message);
        },
        controller.signal,
      );
      if (run !== generation.current) return;
      if (file.name === "ornek-baglanti-plakasi.pdf") {
        const names = [
          "Plaka toplam genişliği",
          "Sağ montaj deliği çapı",
          "Plaka toplam yüksekliği",
          "İç pencere yüksekliği",
          "İç pencere genişliği",
          "Alt delik merkez mesafesi",
          "Plaka kalınlığı",
        ];
        loaded = {
          ...loaded,
          points: loaded.points.map((point, index) => ({
            ...point,
            name: names[index] || point.name,
          })),
        };
      }
      setDoc(loaded);
      setMetadata(withDemoMetadata(initialReportMetadata(loaded.sources)));
      setActive(0);
      setRaw("");
      setNote("");
      setReadings({});
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setShowReport(false);
      setShowSignup(false);
      setFirstSaved(false);
      setConsent(false);
      setAiUsed(false);
      track("demo_started");
      setTimeout(
        () =>
          workbench.current?.scrollIntoView({
            block: "start",
            behavior: "smooth",
          }),
        100,
      );
    } catch (e) {
      if (run === generation.current)
        setError(
          e instanceof Error
            ? e.message
            : "PDF açılamadı. Başka bir dosya deneyin.",
        );
    } finally {
      if (run === generation.current) {
        pending.current = false;
        setBusy("");
      }
    }
  };
  const cancelProcessing = () => {
    generation.current++;
    abort.current?.abort(new Error("İşlem durduruldu."));
    pending.current = false;
    setBusy("");
    setError(
      "İşlem durduruldu. PDF’yi yeniden seçerek tekrar deneyebilirsiniz.",
    );
  };
  const sample = async () => {
    try {
      setError("");
      const response = await fetch(sitePath("/demo-plate.pdf"));
      if (!response.ok) throw Error();
      await load(
        new File([await response.blob()], "ornek-baglanti-plakasi.pdf", {
          type: "application/pdf",
        }),
      );
    } catch {
      setError("Örnek dosya açılamadı. Kendi PDF dosyanızla deneyebilirsiniz.");
    }
  };
  useEffect(() => {
    if (initialSample && ready && !doc && !pending.current) void sample();
  }, [initialSample, ready, doc]);
  useEffect(() => {
    if (!focusMode) return;
    const viewport = window.visualViewport,
      scrollY = window.scrollY,
      update = () => {
        document.documentElement.style.setProperty(
          "--dd-viewport-height",
          `${viewport?.height || window.innerHeight}px`,
        );
        document.documentElement.style.setProperty(
          "--dd-viewport-top",
          `${viewport?.offsetTop || 0}px`,
        );
      };
    update();
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--dd-viewport-height");
      document.documentElement.style.removeProperty("--dd-viewport-top");
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [focusMode]);
  const analyze = async () => {
    if (!doc || !consent || pending.current) return;
    pending.current = true;
    setError("");
    setBusy("İlk sayfadaki ölçüler analiz ediliyor…");
    const controller = new AbortController();
    abort.current = controller;
    const run = generation.current;
    try {
      const response = await fetch(sitePath("/api/demo-analysis"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Consent": "accepted",
        },
        body: JSON.stringify({ image: doc.preview, sources: doc.sources }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Analiz tamamlanamadı.");
      if (run !== generation.current) return;
      setDoc({ ...doc, points: data.points });
      setReadings({});
      setRaw("");
      setNote("");
      setActive(0);
      setAiUsed(true);
      setShowReport(false);
    } catch (e) {
      if (run === generation.current)
        setError(
          e instanceof Error && e.name !== "AbortError"
            ? e.message
            : "Analiz durduruldu.",
        );
    } finally {
      if (run === generation.current) {
        pending.current = false;
        setBusy("");
      }
    }
  };
  const save = () => {
    if (!doc || !point) return;
    const parsed = parseMeasurementInput(raw);
    if (!parsed) {
      setError("Geçerli bir ölçüm girin. Örneğin 32,01.");
      measureInput.current?.focus();
      return;
    }

    const isFirst = manualCount === 0;
    const next = {
      ...readings,
      [point.id]: {
        value: parsed.value,
        rawInput: parsed.rawInput,
        note,
        kind: "manual" as const,
      },
    };
    setReadings(next);
    setError("");
    if (isFirst) setFirstSaved(true);
    track("measurement_entered");
    const nextIndex = manualPoints.findIndex((p) => !next[p.id]);
    if (nextIndex < 0) {
      for (const p of doc.points.slice(MAX_MANUAL))
        next[p.id] = { value: p.nominal, note: "", kind: "simulated" };
      setReadings({ ...next });
      setShowReport(true);
      track("demo_completed");
      track("report_preview_opened");
      setFocusMode(false);
      measureInput.current?.blur();
      setTimeout(
        () =>
          reportRef.current?.scrollIntoView({
            block: "start",
            behavior: "smooth",
          }),
        350,
      );
    } else {
      setActive(nextIndex);
      setRaw("");
      setNote("");
      setPan({ x: 0, y: 0 });
      measureInput.current?.focus();
    }
  };
  const stageTransform =
    zoom === 1 && pan.x === 0 && pan.y === 0
      ? "none"
      : `translate(${pan.x + (point?.x != null ? (50 - point.x) * zoom : 0)}%, ${pan.y + (point?.y != null ? (50 - point.y) * zoom : 0)}%) scale(${zoom})`;
  return (
    <section
      id="canli-demo"
      className={`drawing-demo container ${standalone ? "standalone" : ""}`}
      aria-labelledby="demo-title"
    >
      <div className="dd-heading">
        <div>
          <span className="eyebrow">
            {initialSample
              ? "İLK ÖLÇÜMÜNÜZÜ YAPIN"
              : "SİZİN ÇİZİMİNİZ. İLK KONTROL PLANINIZ."}
          </span>
          {standalone ? (
            <h1 id="demo-title">
              PDF’yi bırakın.
              <br />
              <em>İlk ölçümü birlikte yapalım.</em>
            </h1>
          ) : (
            <h2 id="demo-title">
              {initialSample
                ? "Noktayı seçin. Ölçüyü girin."
                : "Bir PDF ile başlayın."}
              <br />
              {initialSample ? "Sonucu anında görün." : "Farkı kendiniz görün."}
            </h2>
          )}
          <p>
            {initialSample
              ? "Doğrulanmış montaj plakası ve hazır boyutsal kontrol planıyla başlayın."
              : "İlk sayfadan kontrol noktalarını çıkarın, beş ölçüm girin."}
            <br />
            Sonucu ve raporunuzu bu ekranda görün.
          </p>
        </div>
        <div className="dd-free">
          <ShieldCheck size={17} /> Kayıt yok. Kredi kartı yok.
        </div>
      </div>
      <ol className="dd-steps" aria-label="Demo adımları">
        {(initialSample
          ? ["Örnek parça hazır", "Noktayı seç ve ölç", "Sonucu ve raporu gör"]
          : ["PDF’yi bırak", "Planı incele ve ölç", "Sonucu gör"]
        ).map((label, i) => (
          <li
            key={label}
            className={
              (doc ? (complete ? 2 : 1) : 0) === i
                ? "current"
                : (doc ? (complete ? 2 : 1) : 0) > i
                  ? "done"
                  : ""
            }
          >
            <span>
              {(doc ? (complete ? 2 : 1) : 0) > i ? (
                <Check size={15} />
              ) : (
                String(i + 1).padStart(2, "0")
              )}
            </span>
            <strong>{label}</strong>
            {i < 2 && <ChevronRight size={16} />}
          </li>
        ))}
      </ol>
      <input
        ref={fileInput}
        className="dd-file-input"
        type="file"
        accept="application/pdf,.pdf"
        aria-label="PDF teknik resim seç"
        disabled={!ready || Boolean(busy)}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void load(file);
          e.target.value = "";
        }}
      />
      {!doc ? (
        <div
          className={`dd-drop ${drag ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const file = e.dataTransfer.files[0];
            if (file) void load(file);
          }}
        >
          {busy ? (
            <DemoProcessing message={busy} onCancel={cancelProcessing} />
          ) : (
            <>
              <div className="dd-upload-symbol">
                <UploadCloud size={32} strokeWidth={1.4} />
                <span>PDF</span>
              </div>
              <h3>Teknik resminizi buraya sürükleyin</h3>
              <p>PDF · En fazla 15 MB · Yalnızca ilk sayfa</p>
              <Button
                onClick={() => fileInput.current?.click()}
                disabled={!ready || Boolean(busy)}
              >
                {busy ? (
                  <LoaderCircle className="dd-spin" size={18} />
                ) : (
                  <Plus size={18} />
                )}{" "}
                {busy || "PDF dosyası seç"}
              </Button>
              <div className="dd-example">
                Elinizde çizim yok mu?{" "}
                <button
                  disabled={!ready || Boolean(busy)}
                  onClick={() => void sample()}
                >
                  Örnek çizimle deneyin <ArrowRight size={14} />
                </button>
              </div>
              <span className="dd-local">
                <ShieldCheck size={14} /> Dosyanız, analiz izni vermedikçe
                tarayıcınızda kalır.
              </span>
            </>
          )}
        </div>
      ) : (
        <div
          className={`dd-bench ${focusMode ? "focus-mode" : ""}`}
          id="demo-workbench"
          ref={workbench}
          aria-busy={Boolean(busy)}
        >
          <div className="dd-filebar">
            <div>
              <span className="dd-file-icon">
                <FileText size={22} />
              </span>
              <div>
                <strong>{doc.name}</strong>
                <small>
                  Sayfa 1 / {doc.pages} ·{" "}
                  {doc.pages > 1 ? "Diğer sayfalar işlenmedi" : "İlk sayfa"} ·{" "}
                  {doc.points.length} kontrol noktası
                </small>
              </div>
            </div>
            <button
              onClick={() => fileInput.current?.click()}
              disabled={!ready || Boolean(busy)}
            >
              <RotateCcw size={14} /> PDF değiştir
            </button>
          </div>
          {metadata && (
            <ReportDetails
              value={metadata}
              onChange={setMetadata}
              defaultOpen={!initialSample}
            />
          )}
          <div className="dd-origin">
            <span>
              <span className="live-dot" />
              {aiUsed
                ? "Yapay zekâ taslağı"
                : doc.extraction === "ocr"
                  ? "Görüntüden okunan ölçü adayları"
                  : "PDF metninden oluşturulan taslak"}
            </span>
            <span>Ölçümden önce çizimle doğrulayın.</span>
          </div>
          {(rules.isoNote || rules.holeNote) && (
            <div className="dd-rules">
              <strong>Çizim notları</strong>
              {rules.isoNote && (
                <span>
                  {rules.unit && `Birim: ${rules.unit} · `}
                  {rules.isoNote}
                </span>
              )}
              {rules.holeNote && (
                <span>
                  Delik merkezi mesafeleri için özel not: {rules.holeNote}
                </span>
              )}
              <small>
                Ölçünün yanındaki özel tolerans önceliklidir. Genel toleransla
                doldurulan noktalarda özel notların uygulanıp uygulanmadığını
                kontrol edin.
              </small>
            </div>
          )}
          {doc.warning && (
            <p role="alert" className="dd-error">
              {doc.warning}
            </p>
          )}
          <div className="dd-columns">
            <section className="dd-drawing-panel" aria-label="PDF ilk sayfa">
              <div className="dd-toolbar">
                <button
                  className="dd-toggle-markers"
                  aria-pressed={showMarkers}
                  onClick={() => setShowMarkers((v) => !v)}
                >
                  {showMarkers ? "İşaretleri gizle" : "İşaretleri göster"}
                </button>
                <span>TEKNİK RESİM · 01</span>
                <div>
                  <button
                    aria-label="Uzaklaştır"
                    onClick={() => setZoom((z) => Math.max(1, z - 0.35))}
                  >
                    <Minus size={16} />
                  </button>
                  <button
                    aria-label="Yakınlaştır"
                    onClick={() => setZoom((z) => Math.min(3, z + 0.35))}
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    aria-label="Seçili ölçüye odaklan"
                    onClick={() => {
                      setZoom(1.7);
                      setPan({ x: 0, y: 0 });
                    }}
                  >
                    <Focus size={16} />
                  </button>
                  <button
                    aria-label="Tüm çizimi göster"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                  >
                    <Maximize2 size={16} />
                  </button>
                </div>
              </div>
              <div
                className="dd-canvas"
                style={{
                  aspectRatio: doc.width / doc.height,
                  touchAction: zoom > 1 ? "none" : "pan-y",
                }}
                onPointerDown={(e) => {
                  if (zoom === 1 || (e.target as HTMLElement).closest("button"))
                    return;
                  dragStart.current = {
                    x: e.clientX,
                    y: e.clientY,
                    px: pan.x,
                    py: pan.y,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const start = dragStart.current;
                  if (!start) return;
                  const box = e.currentTarget.getBoundingClientRect();
                  setPan({
                    x: Math.max(
                      -200,
                      Math.min(
                        200,
                        start.px + ((e.clientX - start.x) / box.width) * 100,
                      ),
                    ),
                    y: Math.max(
                      -200,
                      Math.min(
                        200,
                        start.py + ((e.clientY - start.y) / box.height) * 100,
                      ),
                    ),
                  });
                }}
                onPointerUp={() => {
                  dragStart.current = null;
                }}
                onPointerCancel={() => {
                  dragStart.current = null;
                }}
              >
                <div className="dd-stage" style={{ transform: stageTransform }}>
                  <img
                    src={doc.preview}
                    alt="Yüklenen PDF’nin ilk sayfası"
                    draggable={false}
                  />
                  {showMarkers && (
                    <svg
                      className="dd-leaders"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      {doc.points.map((p, i) =>
                        markers[i] && p.x !== null && p.y !== null ? (
                          <line
                            key={p.id}
                            x1={p.x}
                            y1={p.y}
                            x2={markers[i]!.x}
                            y2={markers[i]!.y}
                            className={i === active ? "active" : ""}
                          />
                        ) : null,
                      )}
                    </svg>
                  )}
                  {showMarkers &&
                    doc.points.map((p, i) =>
                      p.x !== null && p.y !== null && markers[i] ? (
                        <button
                          key={p.id}
                          className={`dd-pin ${i === active ? "active" : ""} ${i >= MAX_MANUAL ? "automatic" : readings[p.id] ? verdict(readings[p.id].value, p) : ""}`}
                          style={{
                            left: markers[i]!.x + "%",
                            top: markers[i]!.y + "%",
                            transform: `translate(-50%,-50%) scale(${1 / zoom})`,
                          }}
                          disabled={i >= MAX_MANUAL}
                          aria-label={`${i + 1}. kontrol noktası: ${p.name}`}
                          onClick={() => choose(i)}
                        >
                          {i + 1}
                        </button>
                      ) : null,
                    )}
                </div>
              </div>
              <div className="dd-drawing-note">
                <span>
                  <i /> Sizin ölçümleriniz
                </span>
                <span>
                  <i /> Otomatik örnek satırları
                </span>
                <small>Yakınlaştırıp sürükleyebilirsiniz.</small>
              </div>
              <div className="dd-plan">
                <div className="dd-plan-heading">
                  <strong>Kontrol planı</strong>
                  <span>
                    {doc.points.length} nokta · İlk {manualPoints.length} ölçüm
                    size ait
                  </span>
                </div>
                <div className="dd-plan-list">
                  {doc.points.map((p, i) => {
                    const r = readings[p.id];
                    return (
                      <button
                        key={p.id}
                        className={`dd-plan-row ${i === active ? "selected" : ""}`}
                        disabled={i >= MAX_MANUAL}
                        onClick={() => choose(i)}
                      >
                        <span className="dd-row-number">{i + 1}</span>
                        <span>
                          <strong>{p.name}</strong>
                          <small>{p.original}</small>
                          {p.lower !== null && p.upper !== null && (
                            <small className="dd-plan-tolerance">
                              {fmt(p.lower)} – {fmt(p.upper)} {p.unit} ·{" "}
                              {p.toleranceSource?.startsWith("ISO")
                                ? "Genel tolerans"
                                : "Özel tolerans"}
                            </small>
                          )}
                        </span>
                        <span
                          className={`dd-row-result ${r?.kind === "manual" ? verdict(r.value, p) : ""}`}
                        >
                          {i >= MAX_MANUAL
                            ? "Otomatik örnek"
                            : r
                              ? `${fmt(r.value)} ${p.unit}`
                              : "Ölçüm bekliyor"}
                          {r?.kind === "manual" && (
                            <small>
                              {
                                {
                                  pass: "Uygun",
                                  fail: "Uygunsuz",
                                  unknown: "Değerlendirilemedi",
                                }[!p.unit ? "unknown" : verdict(r.value, p)]
                              }
                            </small>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
            <section
              className={`dd-measure ${focusMode ? "focus-mode" : ""}`}
              aria-label="Ölçüm girişi"
            >
              {point ? (
                <>
                  <div className="dd-measure-top">
                    <span className="eyebrow">SİZİN ÖLÇÜMÜNÜZ</span>
                    <span>
                      {manualCount} / {manualPoints.length}
                    </span>
                  </div>
                  <div className="dd-progress">
                    <span
                      style={{
                        width: (manualCount / manualPoints.length) * 100 + "%",
                      }}
                    />
                  </div>
                  <div className="dd-point-title">
                    <span>{active + 1}</span>
                    <div>
                      <h3>{point.name}</h3>
                      <p>
                        {point.unit || "Birim doğrulanmalı"} ·{" "}
                        {point.x === null
                          ? "Çizimdeki konumu doğrulayın"
                          : "Çizimde işaretli nokta"}
                      </p>
                    </div>
                  </div>
                  <div className="dd-focus-preview" aria-hidden={!focusMode}>
                    <div
                      className="dd-focus-stage"
                      style={
                        point.x !== null && point.y !== null
                          ? ({
                              "--dd-focus-x": `${Math.min(77, Math.max(23, point.x))}`,
                              "--dd-focus-y": `${Math.min(77, Math.max(23, point.y))}`,
                            } as React.CSSProperties)
                          : undefined
                      }
                    >
                      <img
                        src={doc.preview}
                        alt="Seçili ölçü noktasının teknik resimdeki konumu"
                      />
                      {point.x !== null && point.y !== null && markers[active] && (
                        <>
                          <svg
                            className="dd-focus-leader"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            aria-hidden="true"
                          >
                            <line
                              x1={point.x}
                              y1={point.y}
                              x2={markers[active]!.x}
                              y2={markers[active]!.y}
                            />
                            <circle cx={point.x} cy={point.y} r="1.25" />
                          </svg>
                          <span
                            style={{
                              left: `${markers[active]!.x}%`,
                              top: `${markers[active]!.y}%`,
                            }}
                          >
                            {active + 1}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="dd-source">
                    <FileText size={15} />
                    <span>
                      Çizimdeki ifade<strong>{point.original}</strong>
                    </span>
                  </div>
                  <div className="dd-limits">
                    <div>
                      Alt sınır<strong>{fmt(point.lower)}</strong>
                    </div>
                    <div>
                      Nominal<strong>{fmt(point.nominal)}</strong>
                    </div>
                    <div>
                      Üst sınır<strong>{fmt(point.upper)}</strong>
                    </div>
                  </div>
                  {point.toleranceSource && (
                    <p className="dd-tolerance-source">
                      {point.toleranceSource}
                    </p>
                  )}
                  {point.source === "ocr" && (
                    <p className="dd-small">
                      Görüntüden okunan ölçüyü ve uygulanan toleransı çizimle
                      karşılaştırın.
                    </p>
                  )}
                  <details
                    className="dd-edit"
                    key={point.id}
                    open={
                      point.lower === null ||
                      point.upper === null ||
                      !point.unit
                        ? true
                        : undefined
                    }
                  >
                    <summary>Ölçü ve toleransları düzenle</summary>
                    <div className="dd-edit-fields">
                      {point.name.startsWith("Yarıçap") &&
                        rules.isoClass &&
                        point.unit === "mm" && (
                          <label>
                            Yarıçap türü
                            <select
                              aria-label="Yarıçap türü"
                              defaultValue=""
                              onChange={(e) => {
                                if (!e.target.value || !rules.isoClass) return;
                                const t = isoTolerance(
                                  point.nominal,
                                  rules.isoClass,
                                  e.target.value as "linear" | "edge",
                                );
                                if (t !== null)
                                  updatePoint({
                                    lower: Number(
                                      (point.nominal - t).toFixed(8),
                                    ),
                                    upper: Number(
                                      (point.nominal + t).toFixed(8),
                                    ),
                                    toleranceSource: `ISO 2768-${rules.isoClass} · ${e.target.value === "edge" ? "Kenar yuvarlatma" : "Diğer yarıçap"} ±${fmt(t)} mm`,
                                    reviewed: false,
                                  });
                              }}
                            >
                              <option value="">Çizimden seçin</option>
                              <option value="edge">
                                Kenar yuvarlatma (dış köşe)
                              </option>
                              <option value="linear">Diğer yarıçap</option>
                            </select>
                          </label>
                        )}
                      <label>
                        Nominal
                        <input
                          aria-label="Nominal değeri düzenle"
                          inputMode="decimal"
                          defaultValue={String(point.nominal).replace(".", ",")}
                          onBlur={(e) => {
                            const n = numeric(e.target.value);
                            if (n !== null)
                              updatePoint({ nominal: n, reviewed: false });
                          }}
                        />
                      </label>
                      <label>
                        Alt sınır
                        <input
                          key={String(point.lower)}
                          aria-label="Alt sınırı düzenle"
                          inputMode="decimal"
                          defaultValue={
                            point.lower === null
                              ? ""
                              : String(point.lower).replace(".", ",")
                          }
                          onBlur={(e) =>
                            updatePoint({
                              lower: numeric(e.target.value),
                              reviewed: false,
                            })
                          }
                        />
                      </label>
                      <label>
                        Üst sınır
                        <input
                          key={String(point.upper)}
                          aria-label="Üst sınırı düzenle"
                          inputMode="decimal"
                          defaultValue={
                            point.upper === null
                              ? ""
                              : String(point.upper).replace(".", ",")
                          }
                          onBlur={(e) =>
                            updatePoint({
                              upper: numeric(e.target.value),
                              reviewed: false,
                            })
                          }
                        />
                      </label>
                      <label>
                        Birim
                        <select
                          aria-label="Ölçüm birimi"
                          value={point.unit}
                          onChange={(e) =>
                            updatePoint({
                              unit: e.target.value,
                              reviewed: false,
                            })
                          }
                        >
                          <option value="">Seçin</option>
                          {["mm", "inch", "°", "µm"].map((u) => (
                            <option key={u}>{u}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </details>

                  <label className="dd-input-label" htmlFor="demo-measurement">
                    Ölçülen değer
                    <span className="dd-input-label-result">
                      {state === "pass" && <b className="pass">✓ Uygun</b>}
                      {state === "fail" && <b className="fail">× Uygunsuz</b>}
                      {state === "unknown" && <b className="unknown">? Belirsiz</b>}
                      <i>{point.unit}</i>
                    </span>
                  </label>
                  <div
                    className={`dd-input-wrap ${raw ? "has-value" : "empty"} ${state || ""}`}
                  >
                    <input
                      ref={measureInput}
                      id="demo-measurement"
                      className="dd-input"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-describedby="demo-measurement-format"
                      value={raw}
                      onFocus={() => {
                        if (matchMedia("(max-width: 600px)").matches)
                          setFocusMode(true);
                      }}
                      onBlur={() => setTimeout(() => setFocusMode(false), 120)}
                      onChange={(e) => {
                        setRaw(e.target.value);
                        setError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") save();
                      }}
                    />
                    <span
                      id="demo-measurement-format"
                      className="dd-input-mask"
                    >
                      <b>Biçim</b> 00,00
                    </span>
                  </div>
                  <div
                    className={`dd-status ${state || "empty"}`}
                    role="status"
                  >
                    {state === "pass" ? (
                      <>
                        <Check size={18} /> Tolerans içinde · Uygun
                      </>
                    ) : state === "fail" ? (
                      <>
                        <X size={18} /> Tolerans dışında · Uygunsuz
                      </>
                    ) : state === "unknown" ? (
                      "Tolerans veya birim eksik. Demo ölçümünü kaydedebilirsiniz; uygunluk değerlendirilmez."
                    ) : (
                      "Ölçümü girin, sonucu anında görün."
                    )}
                  </div>
                  {state === "fail" && (
                    <label className="dd-note">
                      Uygunsuzluk notu
                      <textarea
                        value={note}
                        maxLength={2000}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        placeholder="Örn. Çap üst sınırın üzerinde."
                      />
                    </label>
                  )}
                  <Button
                    className="dd-save"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={save}
                    disabled={!ready || Boolean(busy) || value === null}
                  >
                    {readings[point.id]?.kind === "manual"
                      ? "Ölçümü güncelle"
                      : "Ölçümü kaydet"}{" "}
                    <ArrowRight size={17} />
                  </Button>
                  {firstSaved && (
                    <div className="dd-first-save" role="status">
                      <strong>İlk ölçümünüz kaydedildi!</strong>
                      <span>
                        Bir ölçü noktası daha deneyin veya kalite raporunuzu
                        inceleyin.
                      </span>
                      <div>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setFirstSaved(false);
                            measureInput.current?.focus();
                          }}
                        >
                          Sonraki ölçüme geç
                        </button>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setFirstSaved(false);
                            setShowReport(true);
                            setTimeout(
                              () =>
                                reportRef.current?.scrollIntoView({
                                  block: "start",
                                  behavior: "smooth",
                                }),
                              100,
                            );
                          }}
                        >
                          Rapora göz at
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="dd-small">
                    En fazla 5 noktayı siz ölçersiniz. Kalan satırlar örnek
                    değerlerle tamamlanır.
                  </p>
                </>
              ) : (
                <div className="dd-no-points">
                  <FileText size={32} />
                  <h3>Ölçüleri güvenle okuyamadık.</h3>
                  <p>
                    Metin ve görüntü okuma sonucunda yeterince güvenilir ölçü
                    bulunamadı. Daha net bir PDF ile tekrar deneyebilirsiniz.
                  </p>
                  {!aiAvailable && (
                    <p>
                      Yapay zekâ bağlantısı şu anda açık değil. Metin içeren
                      başka bir PDF seçebilir veya örnek çizimi
                      deneyebilirsiniz.
                    </p>
                  )}
                  <Button variant="outline" onClick={() => void sample()}>
                    Örnek çizimle dene <ArrowRight size={16} />
                  </Button>
                </div>
              )}
              {aiAvailable && manualCount === 0 && !aiUsed && (
                <div className="dd-ai">
                  <strong>
                    <Sparkles size={16} /> Yapay zekâ ile ayrıntılı analiz
                  </strong>
                  <label>
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />{" "}
                    İlk sayfa görüntüsünün ve metninin analiz için OpenAI’a
                    gönderilmesine izin veriyorum.
                  </label>
                  <Button
                    variant="outline"
                    disabled={!consent || Boolean(busy)}
                    onClick={() => void analyze()}
                  >
                    İlk sayfayı analiz et <Sparkles size={15} />
                  </Button>
                  <small>Orijinal dosya ve diğer sayfalar gönderilmez.</small>
                </div>
              )}
            </section>
          </div>
          {busy && (
            <div className="dd-busy">
              <DemoProcessing message={busy} onCancel={cancelProcessing} />
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="dd-error">
          {error}
        </p>
      )}
      {doc && metadata && manualCount > 0 && showReport && (
        <section
          ref={reportRef}
          className="dd-report"
          aria-label="Ölçüm sonuç raporu"
        >
          <DemoReportDownload
            doc={doc}
            metadata={metadata}
            readings={readings}
          />
          <div className="dd-report-footer">
            <span>Demo raporu · Üretim onayı değildir.</span>
            <div>
              <Button
                variant="outline"
                onClick={() =>
                  download(
                    "ritim-demo-raporu.csv",
                    csvReport(doc.points, readings, withDemoMetadata(metadata)),
                    "text/csv;charset=utf-8",
                  )
                }
              >
                <FileDown size={15} /> CSV indir
              </Button>
            </div>
          </div>
          <div className="dd-conversion">
            <div>
              <span className="eyebrow">
                KENDİ PARÇALARINIZ İÇİN DE HAZIR MISINIZ?
              </span>
              <h3>
                Teknik resimden rapora.
                <br />
                Tek çalışma alanında.
              </h3>
              <p>
                Teknik resimlerinizi yükleyin, kontrol planlarınızı oluşturun ve
                ölçümlerinizi tek yerde yönetin.
              </p>
            </div>
            <div>
              <Button
                onClick={() => {
                  setShowSignup(true);
                  setTimeout(
                    () =>
                      signupRef.current?.scrollIntoView({
                        block: "start",
                        behavior: "smooth",
                      }),
                    100,
                  );
                }}
              >
                Ücretsiz hesabımı oluştur <ArrowRight size={18} />
              </Button>
              <button
                className="dd-continue"
                onClick={() => setShowReport(false)}
              >
                Demoya devam et
              </button>
            </div>
          </div>
        </section>
      )}
      {showSignup && (
        <div ref={signupRef} className="dd-signup">
          <ApplicationEntry signup />
          <p className="dd-small">
            Demo dosyası otomatik olarak hesabınıza aktarılmaz. Sonuçlarınızı
            yukarıdan indirebilirsiniz.
          </p>
        </div>
      )}
      {!doc && (
        <div className="dd-under">
          <span>
            <Check size={14} /> Kendi PDF’nizle deneyin
          </span>
          <span>
            <Check size={14} /> Beş ölçümü siz girin
          </span>
          <span>
            <Check size={14} /> Raporu hemen görün
          </span>
        </div>
      )}
    </section>
  );
}
