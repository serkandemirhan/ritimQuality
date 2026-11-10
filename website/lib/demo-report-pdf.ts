import {
  displayNumber as fmt,
  type DemoDocument,
  type DemoReading,
} from "./drawing-demo";
import {
  reportFields,
  withDemoMetadata,
  type ReportMetadata,
} from "./report-metadata";
import { placeMarkers } from "./drawing-markers";
import {
  analyzeDemoReport,
  demoReportRowValues,
  demoReportStatusLabel,
  type DemoReportRow,
} from "./demo-report-analysis";

/** Local, paginated A4 export. Report pages are rasterized to preserve Turkish glyphs. */
export type DemoReportPdfOptions = { debug?: boolean };
export const demoDofNumber = (reportNumber: string) =>
  `DÖF-DEMO-${
    reportNumber
      .toLocaleUpperCase("tr-TR")
      .replace(/[^A-Z0-9]/g, "")
      .slice(-8) || "00000001"
  }`;
export async function createDemoReportPdf(
  doc: DemoDocument,
  metadata: ReportMetadata,
  readings: Record<string, DemoReading>,
  options: DemoReportPdfOptions = {},
): Promise<Blob> {
  metadata = withDemoMetadata(metadata);
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const analysis = analyzeDemoReport(doc, readings);
  const pdf = await PDFDocument.create();
  pdf.setTitle(
    `${metadata.partName || "Parça"} · Ölçüm ve kalite kontrol raporu`,
  );
  pdf.setAuthor("Ritim Quality");
  pdf.setSubject("Demo ölçüm raporu");
  const canvas = document.createElement("canvas");
  canvas.width = 1240;
  canvas.height = 1754;
  const c = canvas.getContext("2d")!;
  const pages: ArrayBuffer[] = [];
  const ink = "#172b36",
    muted = "#60737b",
    accent = "#b9553e",
    line = "#d8e1e3",
    soft = "#f3f6f6",
    green = "#26704d",
    red = "#a63d2f",
    amber = "#89631d";
  let y = 0;
  const text = (
    value: string,
    x: number,
    top: number,
    size = 18,
    color = ink,
    bold = false,
    align: CanvasTextAlign = "left",
  ) => {
    c.font = `${bold ? "700" : "400"} ${size}px "Segoe UI",Arial,sans-serif`;
    c.fillStyle = color;
    c.textAlign = align;
    c.fillText(value, x, top);
    c.textAlign = "left";
  };
  const wrap = (value: string, width: number, size = 18, bold = false) => {
    c.font = `${bold ? "700" : "400"} ${size}px "Segoe UI",Arial,sans-serif`;
    const words = String(value || "—").split(/\s+/),
      rows: string[] = [];
    let row = "";
    for (const word of words) {
      const next = row ? `${row} ${word}` : word;
      if (c.measureText(next).width > width && row) {
        rows.push(row);
        row = word;
      } else row = next;
    }
    if (row) rows.push(row);
    return rows.length ? rows : ["—"];
  };
  const paragraph = (
    value: string,
    x: number,
    top: number,
    width: number,
    size = 18,
    color = ink,
    bold = false,
  ) => {
    const rows = wrap(value, width, size, bold);
    rows.forEach((row, index) =>
      text(row, x, top + index * (size + 7), size, color, bold),
    );
    return rows.length * (size + 7);
  };
  const fitted = (
    value: string,
    x: number,
    top: number,
    width: number,
    size = 19,
    color = ink,
    bold = false,
    minSize = 19,
  ) => {
    let fittedSize = size;
    c.font = `${bold ? "700" : "400"} ${fittedSize}px "Segoe UI",Arial,sans-serif`;
    while (fittedSize > minSize && c.measureText(value).width > width) {
      fittedSize--;
      c.font = `${bold ? "700" : "400"} ${fittedSize}px "Segoe UI",Arial,sans-serif`;
    }
    text(value, x, top, fittedSize, color, bold);
  };
  const header = () => {
    c.fillStyle = "white";
    c.fillRect(0, 0, 1240, 1754);
    c.fillStyle = accent;
    [25, 40, 55].forEach((height, index) =>
      c.fillRect(60 + index * 14, 110 - height, 8, height),
    );
    text("ritim", 116, 94, 44, ink, true);
    text("quality", 232, 94, 25, muted);
    text("ÖLÇÜM VE KALİTE KONTROL RAPORU", 1180, 69, 20, ink, true, "right");
    text(
      `DEMO · ${metadata.reportNumber} · Rev. ${metadata.revision || "—"}`,
      1180,
      102,
      16,
      accent,
      false,
      "right",
    );
    c.fillStyle = ink;
    c.fillRect(60, 132, 1120, 2);
    y = 176;
  };
  const flush = async () => {
    c.fillStyle = line;
    c.fillRect(60, 1640, 1120, 1);
    text(
      "Ritim Quality · Demo raporu · Üretim onayı veya resmi kalite kabul belgesi değildir.",
      60,
      1674,
      15,
      muted,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(Error("PDF sayfası hazırlanamadı.")),
        "image/png",
      ),
    );
    pages.push(await blob.arrayBuffer());
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const newPage = async () => {
    await flush();
    header();
  };
  const ensure = async (height: number) => {
    if (y + height > 1600) await newPage();
  };
  const statusColor =
    analysis.status === "conforming"
      ? green
      : analysis.status === "nonconforming"
        ? red
        : analysis.status === "incomplete"
          ? amber
          : muted;
  const card = (label: string, value: string, x: number, width: number) => {
    c.fillStyle = "white";
    c.fillRect(x, y, width, 72);
    c.strokeStyle = line;
    c.strokeRect(x, y, width, 72);
    text(label.toLocaleUpperCase("tr-TR"), x + 12, y + 22, 12, muted, true);
    text(value, x + 12, y + 55, 25, ink, true);
  };
  const tableHeader = (title: string, example = false) => {
    text(title.toLocaleUpperCase("tr-TR"), 60, y, 20, ink, true);
    y += 24;
    c.fillStyle = soft;
    c.fillRect(60, y, 1120, 52);
    const labels = [
      "No",
      "Karakteristik",
      "Nominal",
      "Tolerans aralığı",
      "Ölçülen",
      "Sapma / limit dışı",
      "Sonuç",
    ];
    const xs = [60, 115, 385, 510, 700, 835, 1050],
      widths = [55, 270, 125, 190, 135, 215, 130];
    labels.forEach((label, index) =>
      text(label, xs[index] + 6, y + 33, 19, muted, true),
    );
    y += 60;
    return { xs, widths, example };
  };
  const tableRow = async (
    row: DemoReportRow,
    context: ReturnType<typeof tableHeader>,
  ) => {
    const r = row.reading,
      values = demoReportRowValues(row),
      p = row.point;
    const compact = [
      values[0],
      values[1],
      values[2],
      `${fmt(p.lower)} – ${fmt(p.upper)} ${p.unit}`,
      values[5],
      `${values[6]} / ${values[7]}`,
      values[8],
    ];
    const characteristicRows = wrap(
      compact[1],
      context.widths[1] - 12,
      19,
      true,
    );
    const resultRows = wrap(compact[6], context.widths[6] - 12, 19);
    const deviationRows = wrap(compact[5], context.widths[5] - 12, 19);
    const rowHeight =
      Math.max(
        66,
        characteristicRows.length * 27,
        resultRows.length * 26,
        deviationRows.length * 26,
      ) + (r?.note ? 28 : 0);
    if (y + rowHeight > 1600) {
      await newPage();
      context = tableHeader(
        context.example
          ? "Otomatik demo örnekleri"
          : "Gerçek kullanıcı ölçümleri",
        context.example,
      );
    }
    if (row.status === "fail") {
      c.fillStyle = "#fff2ef";
      c.fillRect(60, y, 1120, rowHeight);
    } else if (row.status === "demo") {
      c.fillStyle = "#f5f6f6";
      c.fillRect(60, y, 1120, rowHeight);
    }
    compact.forEach((value, index) => {
      const color =
        index === 6
          ? row.status === "fail"
            ? red
            : row.status === "pass"
              ? green
              : muted
          : ink;
      if (index === 1 || index === 5 || index === 6)
        paragraph(
          value,
          context.xs[index] + 6,
          y + 25,
          context.widths[index] - 12,
          19,
          color,
          index === 1,
        );
      else
        fitted(
          value,
          context.xs[index] + 6,
          y + 25,
          context.widths[index] - 12,
          19,
          color,
          index === 1,
          19,
        );
    });
    if (r?.note) text(`Not: ${r.note}`, 120, y + rowHeight - 10, 17, muted);
    c.fillStyle = line;
    c.fillRect(60, y + rowHeight - 1, 1120, 1);
    y += rowHeight;
    return context;
  };
  try {
    header();
    text(metadata.partName || "Parça ölçüm raporu", 60, y, 29, ink, true);
    text("DEMO RAPORU", 1180, y, 16, accent, true, "right");
    y += 42;
    c.fillStyle = "#fff2ed";
    c.fillRect(60, y, 1120, 54);
    text(
      "Bu rapor gösterim amaçlıdır. Üretim onayı veya resmi kalite kabul belgesi değildir.",
      80,
      y + 33,
      17,
      "#8c3828",
      true,
    );
    y += 78;
    for (let index = 0; index < reportFields.length; index += 3) {
      let height = 0;
      reportFields.slice(index, index + 3).forEach(([key, label], offset) => {
        const x = 60 + offset * 380;
        text(label.toLocaleUpperCase("tr-TR"), x, y, 12, muted, true);
        const raw = metadata[key] || "—";
        const value =
          key === "reportDate" && /^\d{4}-\d{2}-\d{2}$/.test(raw)
            ? raw.split("-").reverse().join(".")
            : raw;
        height = Math.max(
          height,
          paragraph(value, x, y + 25, 350, 17, ink, true),
        );
      });
      y += height + 38;
    }
    await ensure(190);
    c.fillStyle = statusColor;
    c.fillRect(60, y, 300, 126);
    text("TEKNİK MUAYENE SONUCU", 80, y + 30, 13, "white", true);
    text(demoReportStatusLabel(analysis.status), 80, y + 70, 25, "white", true);
    text(
      analysis.status === "nonconforming"
        ? "En az bir gerçek ölçüm tolerans dışında."
        : analysis.status === "conforming"
          ? "Tüm gerçek ölçümler uygun."
          : analysis.status === "incomplete"
            ? "Kontrol planı tamamlanmadı."
            : "Karar için gerçek ölçüm yok.",
      80,
      y + 100,
      13,
      "white",
    );
    const labels: [string, number][] = [
      ["Toplam", analysis.summary.total],
      ["Ölçülen", analysis.summary.measured],
      ["Uygun", analysis.summary.passed],
      ["Uygunsuz", analysis.summary.failed],
      ["Demo örneği", analysis.summary.examples],
    ];
    labels.forEach(([label, value], index) =>
      card(label, String(value), 380 + index * 158, 156),
    );
    y += 150;
    text("BALONLANMIŞ TEKNİK RESİM", 60, y, 18, ink, true);
    text(
      `Kaynak: ${doc.name} · Sayfa 1 / ${doc.pages}`,
      1180,
      y,
      14,
      muted,
      false,
      "right",
    );
    y += 24;
    const image = new Image();
    image.src = doc.preview;
    await image.decode();
    const maxHeight = Math.min(630, 1540 - y),
      width = Math.min(1120, (maxHeight * doc.width) / doc.height),
      height = (width * doc.height) / doc.width,
      x = 60 + (1120 - width) / 2;
    c.drawImage(image, x, y, width, height);
    const markers = placeMarkers(
      doc.points,
      doc.sources,
      doc.width / doc.height,
    );
    doc.points.forEach((point, index) => {
      const marker = markers[index];
      if (!marker || point.x === null || point.y === null) return;
      const row = analysis.rows[index],
        color =
          row.status === "pass" ? green : row.status === "fail" ? red : muted,
        mx = x + (marker.x * width) / 100,
        my = y + (marker.y * height) / 100;
      c.strokeStyle = color;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x + (point.x * width) / 100, y + (point.y * height) / 100);
      c.lineTo(mx, my);
      c.stroke();
      c.fillStyle = "white";
      c.beginPath();
      c.arc(mx, my, 13, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      text(String(index + 1), mx, my + 5, 14, color, true, "center");
    });
    y += height + 28;
    text(
      "Yeşil: uygun · Kırmızı: uygunsuz · Gri: ölçülmedi, değerlendirilemedi veya demo örneği",
      60,
      y,
      13,
      muted,
    );
    await newPage();
    let context = tableHeader("Gerçek kullanıcı ölçümleri");
    if (!analysis.actual.length) {
      text("Gerçek kullanıcı ölçümü bulunmuyor.", 60, y + 22, 17, muted);
      y += 52;
    }
    for (const row of analysis.actual) context = await tableRow(row, context);
    if (analysis.failed.length) {
      await ensure(120 + Math.ceil(analysis.failed.length / 2) * 98);
      y += 18;
      text("UYGUNSUZLUK ÖZETİ", 60, y, 20, red, true);
      text(
        `DEMO DÖF NO: ${demoDofNumber(metadata.reportNumber)}`,
        1180,
        y,
        16,
        red,
        true,
        "right",
      );
      y += 26;
      for (const [index, row] of analysis.failed.entries()) {
        const x = 60 + (index % 2) * 560;
        if (index % 2 === 0 && index > 0) y += 98;
        const direction =
            row.direction === "above" ? "üst sınır üstü" : "alt sınır altı",
          p = row.point,
          value = row.reading!.value;
        c.fillStyle = "#fff2ef";
        c.fillRect(x, y, 544, 88);
        fitted(
          `#${row.pointNumber} · ${p.name}`,
          x + 12,
          y + 23,
          520,
          17,
          ink,
          true,
          15,
        );
        fitted(
          `${fmt(value)} ${p.unit} · limit dışı ${fmt(row.outOfTolerance)} ${p.unit} (${direction})`,
          x + 12,
          y + 47,
          520,
          16,
          red,
          false,
          14,
        );
        const left = x + 14,
          right = x + 530,
          barY = y + 69,
          span = Math.max((p.upper ?? value) - (p.lower ?? value), 0.000001),
          scaleMin = (p.lower ?? value) - span,
          scaleMax = (p.upper ?? value) + span,
          relative = (value - scaleMin) / (scaleMax - scaleMin),
          marker = left + Math.max(0, Math.min(1, relative)) * (right - left);
        c.strokeStyle = "#aebfc3";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(left, barY);
        c.lineTo(right, barY);
        c.stroke();
        c.strokeStyle = green;
        c.lineWidth = 6;
        c.beginPath();
        c.moveTo(left + (right - left) / 3, barY);
        c.lineTo(left + ((right - left) * 2) / 3, barY);
        c.stroke();
        c.fillStyle = red;
        c.beginPath();
        c.arc(marker, barY, 7, 0, Math.PI * 2);
        c.fill();
        if (row.reading?.note)
          fitted(
            `Not: ${row.reading.note}`,
            x + 12,
            y + 84,
            520,
            13,
            muted,
            false,
            12,
          );
      }
      y += 94;
    }
    if (analysis.examples.length) {
      await ensure(120);
      y += 26;
      context = tableHeader("Otomatik demo örnekleri", true);
      for (const row of analysis.examples)
        context = await tableRow(row, context);
    }
    await ensure(110);
    y += 24;
    c.fillStyle = soft;
    c.fillRect(60, y, 1120, 82);
    text("VERİ AYRIMI", 80, y + 27, 17, ink, true);
    paragraph(
      "Gerçek kullanıcı ölçümleri teknik sonuca dahil edilir. Otomatik demo örnekleri gerçek ölçüm değildir, üretim kararına ve uygunluk istatistiklerine katılmaz.",
      80,
      y + 55,
      1080,
      17,
      muted,
    );
    y += 106;
    await ensure(112);
    c.strokeStyle = line;
    c.strokeRect(60, y, 1120, 92);
    text("İZLENEBİLİRLİK", 80, y + 27, 17, ink, true);
    fitted(
      `Rapor: ${metadata.reportNumber} · Revizyon: ${metadata.revision} · Tarih: ${metadata.reportDate}`,
      80,
      y + 52,
      1060,
      17,
      ink,
      false,
      15,
    );
    fitted(
      `Lot/Seri: ${metadata.lotNumber} · Numune: ${metadata.sampleNumber} · Ölçümü yapan: ${metadata.inspector} · Cihaz: ${metadata.instrument}`,
      80,
      y + 76,
      1060,
      17,
      muted,
      false,
      14,
    );
    y += 112;
    if (options.debug) {
      await ensure(72 + analysis.actual.length * 34);
      text("SAYISAL KAYIT DOĞRULAMASI · DEBUG", 60, y, 16, ink, true);
      y += 18;
      c.fillStyle = soft;
      c.fillRect(60, y, 1120, 34);
      text("Nokta", 72, y + 22, 12, muted, true);
      text("Özgün kullanıcı girdisi", 170, y + 22, 12, muted, true);
      text("Saklanan sayı (kanonik nokta)", 610, y + 22, 12, muted, true);
      text("PDF gösterimi", 930, y + 22, 12, muted, true);
      y += 34;
      for (const row of analysis.actual) {
        const raw = row.reading?.rawInput || "Eski kayıtta mevcut değil";
        const stored = String(row.reading!.value);
        text(`#${row.pointNumber}`, 72, y + 22, 13, ink, true);
        fitted(
          raw,
          170,
          y + 22,
          410,
          13,
          row.reading?.rawInput ? ink : amber,
          false,
          12,
        );
        fitted(stored, 610, y + 22, 290, 13, ink, false, 12);
        fitted(fmt(row.reading!.value), 930, y + 22, 230, 13, ink, false, 12);
        c.fillStyle = line;
        c.fillRect(60, y + 33, 1120, 1);
        y += 34;
      }
      text(
        "Özgün girişi bulunmayan eski kayıtların sayısal değeri otomatik olarak yeniden yorumlanmaz.",
        60,
        y + 22,
        12,
        muted,
      );
      y += 34;
    }
    await flush();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (const [index, bytes] of pages.entries()) {
      const embedded = await pdf.embedPng(bytes),
        page = pdf.addPage([595.28, 841.89]);
      page.drawImage(embedded, { x: 0, y: 0, width: 595.28, height: 841.89 });
      page.drawText(`Sayfa ${index + 1} / ${pages.length}`, {
        x: 500,
        y: 20,
        size: 7,
        font,
        color: rgb(0.35, 0.42, 0.45),
      });
    }
    const bytes = await pdf.save();
    return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
