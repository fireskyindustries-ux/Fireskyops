import { jsPDF } from "jspdf";

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
  doc.text("FIRESKY INDUSTRIES", 14, 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Field Ops Platform", 14, 18);
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
  doc.text(`Firesky Industries  ·  ${refNo}  ·  ${readyStatus}`, pw / 2, y, { align: "center" });

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
  doc.text(`Firesky Industries  ·  ${refNo}  ·  ${job.stage || ""}`, pw / 2, y, { align: "center" });

  doc.save(`${refNo}_${(job.customerName || "job").replace(/\s+/g, "_")}.pdf`);
}
