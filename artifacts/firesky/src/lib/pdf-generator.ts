import { jsPDF } from "jspdf";
import { brand } from "@/brand.config";

const ORANGE = [232, 93, 4] as const;
const DARK = [17, 24, 39] as const;
const GRAY = [107, 114, 128] as const;
const LIGHT_GRAY = [229, 231, 235] as const;
const WHITE = [255, 255, 255] as const;

function setColor(doc: jsPDF, rgb: readonly [number, number, number], type: "fill" | "text" | "draw" = "fill") {
  if (type === "fill") doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  else if (type === "text") doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  else doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function header(doc: jsPDF, title: string, refNo: string) {
  const pw = doc.internal.pageSize.getWidth();
  setColor(doc, ORANGE, "fill");
  doc.rect(0, 0, pw, 28, "F");
  setColor(doc, WHITE, "text");
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(brand.name.toUpperCase(), 14, 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(brand.appTitle, 14, 18);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, pw - 14, 11, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(refNo, pw - 14, 18, { align: "right" });
  const today = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  doc.text(`Generated: ${today}`, pw - 14, 24, { align: "right" });
}

function sectionTitle(doc: jsPDF, text: string, y: number) {
  setColor(doc, ORANGE, "text");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(text.toUpperCase(), 14, y);
  setColor(doc, ORANGE, "draw");
  doc.setLineWidth(0.5);
  doc.line(14, y + 1.5, doc.internal.pageSize.getWidth() - 14, y + 1.5);
  setColor(doc, DARK, "text");
  return y + 6;
}

function row(doc: jsPDF, label: string, value: string, x: number, y: number, colW = 85) {
  setColor(doc, GRAY, "text");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(label + ":", x, y);
  setColor(doc, DARK, "text");
  doc.setFont("helvetica", "normal");
  const maxW = colW - 35;
  const lines = doc.splitTextToSize(value || "—", maxW);
  doc.text(lines, x + 32, y);
  return y + 5 * Math.max(1, lines.length);
}

export async function generateInspectionPDF(inspection: any, customerName?: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 14;

  const refNo = `INS-${String(inspection.id).padStart(5, "0")}`;

  header(doc, "SITE INSPECTION REPORT", refNo);

  let y = 36;

  y = sectionTitle(doc, "Inspection Details", y);
  const inspDate = inspection.inspectedAt
    ? new Date(inspection.inspectedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })
    : "Unknown";
  const col2x = pw / 2 + 2;
  const colW = (pw - margin * 2) / 2;
  y = Math.max(
    row(doc, "Customer", customerName || inspection.customerName || `#${inspection.customerId}`, margin, y, colW),
    row(doc, "Farm Name", inspection.farmName || "—", col2x, y - 5, colW) + 5
  );
  y = Math.max(
    row(doc, "Inspected", inspDate, margin, y, colW),
    row(doc, "Location", inspection.nearestTown || "—", col2x, y - 5, colW) + 5
  );
  y += 4;

  y = sectionTitle(doc, "Tank Requirements", y);
  y = Math.max(
    row(doc, "Tank Size", inspection.tankSize || "—", margin, y, colW),
    row(doc, "Quantity", String(inspection.tankQuantity || 1), col2x, y - 5, colW) + 5
  );

  const boolVal = (v?: boolean | null) => (v ? "Yes" : "No");
  y = Math.max(
    row(doc, "Requires Stand", boolVal(inspection.requiresStand), margin, y, colW),
    row(doc, "Requires Plinth", boolVal(inspection.requiresPlinth), col2x, y - 5, colW) + 5
  );
  if (inspection.standHeight) {
    y = row(doc, "Stand Height", inspection.standHeight, margin, y, colW);
  }
  if (inspection.pipeLength) {
    y = Math.max(
      row(doc, "Pipe Length", `${inspection.pipeLength}m`, margin, y, colW),
      row(doc, "Pipe Details", inspection.pipeDetails || "—", col2x, y - 5, colW) + 5
    );
  }
  y += 4;

  y = sectionTitle(doc, "Site Access", y);
  y = Math.max(
    row(doc, "Truck Access", boolVal(inspection.truckAccess), margin, y, colW),
    row(doc, "Trailer Access", boolVal(inspection.trailerAccess), col2x, y - 5, colW) + 5
  );
  y = Math.max(
    row(doc, "Dist. from Road", inspection.distanceFromRoad ? `${inspection.distanceFromRoad}m` : "—", margin, y, colW),
    row(doc, "Dist. from House", inspection.distanceFromHouse ? `${inspection.distanceFromHouse}m` : "—", col2x, y - 5, colW) + 5
  );
  if (inspection.groundCondition) {
    y = row(doc, "Ground Condition", inspection.groundCondition, margin, y, colW);
  }
  if (inspection.offloadingConstraints) {
    y = row(doc, "Offloading", inspection.offloadingConstraints, margin, y, pw - margin * 2);
  }
  y += 4;

  if (inspection.notes) {
    y = sectionTitle(doc, "Notes", y);
    setColor(doc, DARK, "text");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(inspection.notes, pw - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 4;
  }

  const photos = (inspection.photoUrls ?? []).filter(Boolean).slice(0, 4);
  if (photos.length > 0) {
    if (y + 80 > ph - 20) { doc.addPage(); y = 20; }
    y = sectionTitle(doc, "Site Photos", y);
    const photoW = (pw - margin * 2 - 4) / 2;
    const photoH = 52;
    for (let i = 0; i < photos.length; i++) {
      const col = i % 2;
      const photoX = margin + col * (photoW + 4);
      const photoY = y + Math.floor(i / 2) * (photoH + 3);
      if (photoY + photoH > ph - 20) { doc.addPage(); y = 20; }
      try {
        doc.addImage(photos[i], "JPEG", photoX, photoY, photoW, photoH, undefined, "FAST");
        setColor(doc, LIGHT_GRAY, "draw");
        doc.setLineWidth(0.3);
        doc.rect(photoX, photoY, photoW, photoH);
      } catch {
        // skip bad image
      }
    }
    const rows = Math.ceil(photos.length / 2);
    y += rows * (photoH + 3) + 4;
  }

  if (y + 55 > ph - 10) { doc.addPage(); y = 20; }
  y = sectionTitle(doc, "Sign-Off", y);

  if (inspection.signatureUrl) {
    try {
      doc.addImage(inspection.signatureUrl, "PNG", margin, y, 80, 25);
      setColor(doc, LIGHT_GRAY, "draw");
      doc.setLineWidth(0.3);
      doc.rect(margin, y, 80, 25);
    } catch {
      // skip bad image
    }
    if (inspection.signedOffBy) {
      setColor(doc, DARK, "text");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`Signed off by: ${inspection.signedOffBy}`, margin, y + 29);
    }
    if (inspection.signedOffAt) {
      const signedDate = new Date(inspection.signedOffAt).toLocaleDateString("en-ZA", {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
      } as any);
      setColor(doc, GRAY, "text");
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(signedDate, margin, y + 34);
    }
  } else {
    setColor(doc, LIGHT_GRAY, "draw");
    doc.setLineWidth(0.3);
    doc.rect(margin, y, 80, 25);
    setColor(doc, GRAY, "text");
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("Not yet signed off", margin + 2, y + 13);
    setColor(doc, DARK, "text");
    doc.setFont("helvetica", "normal");
    doc.text("Signature ___________________________  Date: ___________________", margin, y + 32);
  }

  y = ph - 10;
  setColor(doc, LIGHT_GRAY, "draw");
  doc.setLineWidth(0.3);
  doc.line(margin, y - 4, pw - margin, y - 4);
  setColor(doc, GRAY, "text");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const readyStatus = inspection.siteReadyToQuote ? "Ready to Quote" : "Not Ready to Quote";
  doc.text(`${brand.name}  ·  ${refNo}  ·  ${readyStatus}`, pw / 2, y, { align: "center" });

  doc.save(`${refNo}_${(customerName || inspection.customerName || "inspection").replace(/\s+/g, "_")}.pdf`);
}

export async function generateJobPDF(job: any) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 14;
  const col2x = pw / 2 + 2;
  const colW = (pw - margin * 2) / 2;

  const refNo = `JOB-${String(job.id).padStart(5, "0")}`;

  header(doc, "JOB SIGN-OFF REPORT", refNo);

  let y = 36;

  y = sectionTitle(doc, "Job Details", y);
  y = Math.max(
    row(doc, "Customer", job.customerName || `#${job.customerId}`, margin, y, colW),
    row(doc, "Job Title", job.title || "—", col2x, y - 5, colW) + 5
  );
  y = Math.max(
    row(doc, "Stage", job.stage || "—", margin, y, colW),
    row(doc, "Job Type", job.jobType || "—", col2x, y - 5, colW) + 5
  );
  y = Math.max(
    row(doc, "Tank Size", job.tankSize || "—", margin, y, colW),
    row(doc, "Quantity", String(job.tankQuantity || 1), col2x, y - 5, colW) + 5
  );
  if (job.estimatedValue) {
    y = row(doc, "Est. Value", `R ${Number(job.estimatedValue).toLocaleString("en-ZA")}`, margin, y, colW);
  }
  y += 4;

  if (job.notes) {
    y = sectionTitle(doc, "Notes", y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    setColor(doc, DARK, "text");
    const lines = doc.splitTextToSize(job.notes, pw - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 4;
  }

  if (y + 55 > ph - 10) { doc.addPage(); y = 20; }
  y = sectionTitle(doc, "Customer Sign-Off", y);

  if (job.signatureUrl) {
    try {
      doc.addImage(job.signatureUrl, "PNG", margin, y, 80, 25);
      setColor(doc, LIGHT_GRAY, "draw");
      doc.setLineWidth(0.3);
      doc.rect(margin, y, 80, 25);
    } catch {
      // skip bad image
    }
    if (job.signedOffBy) {
      setColor(doc, DARK, "text");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`Signed off by: ${job.signedOffBy}`, margin, y + 29);
    }
    if (job.signedOffAt) {
      const signedDate = new Date(job.signedOffAt).toLocaleDateString("en-ZA", {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
      } as any);
      setColor(doc, GRAY, "text");
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(signedDate, margin, y + 34);
    }
  } else {
    setColor(doc, LIGHT_GRAY, "draw");
    doc.setLineWidth(0.3);
    doc.rect(margin, y, 80, 25);
    setColor(doc, GRAY, "text");
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("Not yet signed off", margin + 2, y + 13);
    setColor(doc, DARK, "text");
    doc.setFont("helvetica", "normal");
    doc.text("Signature ___________________________  Date: ___________________", margin, y + 32);
  }

  y = ph - 10;
  setColor(doc, LIGHT_GRAY, "draw");
  doc.setLineWidth(0.3);
  doc.line(margin, y - 4, pw - margin, y - 4);
  setColor(doc, GRAY, "text");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`${brand.name}  ·  ${refNo}  ·  ${job.stage || ""}`, pw / 2, y, { align: "center" });

  doc.save(`${refNo}_${(job.customerName || "job").replace(/\s+/g, "_")}.pdf`);
}

const LOAD_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export async function generateDeliveryNotePDF(job: any, loads: any[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 14;
  const col2x = pw / 2 + 2;
  const colW = (pw - margin * 2) / 2;

  const refNo = `DN-${String(job.id).padStart(5, "0")}`;
  const jobRef = `JOB-${String(job.id).padStart(5, "0")}`;
  const today = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

  header(doc, "DELIVERY NOTE / JOB CARD", refNo);

  let y = 36;

  // ── Customer + Job Details ────────────────────────────────────────────────
  y = sectionTitle(doc, "Customer Details", y);
  const custStart = y;
  y = row(doc, "Name", job.customerName || `#${job.customerId}`, margin, y, colW);
  if (job.customerPhone) y = row(doc, "Phone", job.customerPhone, margin, y, colW);
  if (job.customerEmail) y = row(doc, "Email", job.customerEmail, margin, y, colW);
  if (job.customerVatNumber) y = row(doc, "VAT No", job.customerVatNumber, margin, y, colW);
  if (job.customerBillingAddress) {
    const billing = [job.customerBillingAddress, job.customerBillingCity, job.customerBillingProvince, job.customerBillingPostalCode].filter(Boolean).join(", ");
    y = row(doc, "Billing", billing, margin, y, colW);
  }
  const custEnd = y;

  let jy = custStart;
  jy = row(doc, "Reference", jobRef, col2x, jy, colW);
  if (job.jobType) jy = row(doc, "Type", job.jobType.replace(/_/g, " "), col2x, jy, colW);
  if (job.tankSize || job.tankQuantity) jy = row(doc, "Tanks", `${job.tankQuantity ?? 1}x ${job.tankSize || "—"}`, col2x, jy, colW);
  if (job.assignedStaff) jy = row(doc, "Assigned", job.assignedStaff, col2x, jy, colW);

  y = Math.max(custEnd, jy) + 6;

  // ── Goods Ordered ─────────────────────────────────────────────────────────
  if (job.tankSize || job.tankQuantity) {
    y = sectionTitle(doc, "Goods Ordered", y);
    setColor(doc, ORANGE, "draw");
    doc.setLineWidth(0.5);
    const boxH = 14;
    doc.rect(margin, y - 2, pw - margin * 2, boxH);
    setColor(doc, DARK, "text");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`${job.tankQuantity ?? 1}x ${job.tankSize || "Tank"}`, margin + 3, y + 5);
    const typeLabel = (job.jobType || "full_install") === "delivery_only" ? "Delivery Only" : "Full Installation";
    setColor(doc, GRAY, "text");
    doc.setFont("helvetica", "normal");
    doc.text(typeLabel, pw - margin - 3, y + 5, { align: "right" });
    y += boxH + 4;
  }

  // ── Delivery Loads Table ──────────────────────────────────────────────────
  y = sectionTitle(doc, "Delivery Loads", y);

  const cols = [
    { label: "Load", x: margin, w: 18 },
    { label: "Items", x: margin + 18, w: 40 },
    { label: "Scheduled Date", x: margin + 58, w: 42 },
    { label: "Driver", x: margin + 100, w: 42 },
    { label: "Status", x: margin + 142, w: pw - margin - margin - 142 },
  ];

  // Table header row
  setColor(doc, LIGHT_GRAY, "fill");
  doc.rect(margin, y - 3, pw - margin * 2, 8, "F");
  setColor(doc, DARK, "text");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  cols.forEach(c => doc.text(c.label, c.x + 1, y + 2));
  y += 8;

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (loads.length === 0) {
    setColor(doc, GRAY, "text");
    doc.text("No delivery loads recorded", pw / 2, y + 3, { align: "center" });
    y += 10;
  } else {
    loads.forEach((l, i) => {
      if (y + 8 > ph - 20) { doc.addPage(); y = 20; }
      if (i % 2 === 0) {
        setColor(doc, [249, 250, 251] as any, "fill");
        doc.rect(margin, y - 2, pw - margin * 2, 7, "F");
      }
      setColor(doc, DARK, "text");
      const items = l.tankQuantity && l.tankSize ? `${l.tankQuantity}x ${l.tankSize}` : l.tankSize || l.tankQuantity || "—";
      const sched = l.scheduledDate ? new Date(l.scheduledDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—";
      doc.text(`Load ${l.loadNumber}`, cols[0].x + 1, y + 3);
      doc.text(String(items), cols[1].x + 1, y + 3);
      doc.text(sched, cols[2].x + 1, y + 3);
      doc.text(l.driverName || "—", cols[3].x + 1, y + 3);
      doc.text(LOAD_STATUS_LABELS[l.status] || l.status || "—", cols[4].x + 1, y + 3);
      setColor(doc, LIGHT_GRAY, "draw");
      doc.setLineWidth(0.2);
      doc.line(margin, y + 5, pw - margin, y + 5);
      y += 7;
    });
  }
  y += 6;

  // ── Notes ────────────────────────────────────────────────────────────────
  if (job.notes) {
    if (y + 20 > ph - 40) { doc.addPage(); y = 20; }
    y = sectionTitle(doc, "Notes", y);
    setColor(doc, DARK, "text");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(job.notes, pw - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 6;
  }

  // ── Signature blocks ──────────────────────────────────────────────────────
  if (y + 40 > ph - 14) { doc.addPage(); y = 20; }
  y += 6;

  const sigW = (pw - margin * 2 - 10) / 2;

  // Customer sig
  setColor(doc, DARK, "draw");
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + sigW, y);
  setColor(doc, DARK, "text");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("Received by (Customer)", margin, y + 5);
  setColor(doc, GRAY, "text");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("By signing below, you confirm receipt of the above goods.", margin, y + 10);
  setColor(doc, LIGHT_GRAY, "draw");
  doc.setLineWidth(0.3);
  doc.line(margin, y + 26, margin + sigW, y + 26);
  setColor(doc, GRAY, "text");
  doc.setFontSize(7.5);
  doc.text("Signature", margin, y + 31);
  doc.text("Date: _______________", margin + sigW - 38, y + 31);

  // Driver sig
  const sig2x = margin + sigW + 10;
  setColor(doc, DARK, "draw");
  doc.setLineWidth(0.5);
  doc.line(sig2x, y, sig2x + sigW, y);
  setColor(doc, DARK, "text");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("Delivered by (Driver / Agent)", sig2x, y + 5);
  setColor(doc, GRAY, "text");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(`${brand.name} representative`, sig2x, y + 10);
  setColor(doc, LIGHT_GRAY, "draw");
  doc.setLineWidth(0.3);
  doc.line(sig2x, y + 26, sig2x + sigW, y + 26);
  setColor(doc, GRAY, "text");
  doc.setFontSize(7.5);
  doc.text("Signature", sig2x, y + 31);
  doc.text("Date: _______________", sig2x + sigW - 38, y + 31);

  // ── Footer ────────────────────────────────────────────────────────────────
  y = ph - 10;
  setColor(doc, LIGHT_GRAY, "draw");
  doc.setLineWidth(0.3);
  doc.line(margin, y - 4, pw - margin, y - 4);
  setColor(doc, GRAY, "text");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`${brand.name}  ·  ${refNo}  ·  Generated: ${today}`, pw / 2, y, { align: "center" });

  doc.save(`${refNo}_${(job.customerName || "job").replace(/\s+/g, "_")}.pdf`);
}
