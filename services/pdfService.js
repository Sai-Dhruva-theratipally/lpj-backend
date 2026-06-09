const PDFDocument = require("pdfkit");

const SHOP_NAME = "Lakshmi Prasanna Jewellers";

const formatValue = (value) => {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
};

const buildColumns = (rows) => {
  const preferred = [
    "metalType",
    "category",
    "item",
    "tagNumber",
    "tagId",
    "identifier",
    "stockType",
    "pieces",
    "weight",
    "date",
    "saleDate",
    "cancelledAt",
    "month",
    "transactionId",
    "saleId",
    "seller",
    "customer",
    "categoryCode",
    "quantity",
    "grossWeight",
    "stoneWeight",
    "purity",
    "status",
    "transactionCount",
    "reason",
  ];
  const keys = new Set(rows.flatMap((row) => Object.keys(row)));
  return preferred.filter((key) => keys.has(key));
};

const drawTextLine = (doc, label, value) => {
  doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
  doc.font("Helvetica").text(formatValue(value));
};

const streamReportPdf = (res, report) => {
  const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
  const filename = `${report.reportType || "report"}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  doc.pipe(res);
  doc.font("Helvetica-Bold").fontSize(18).text(SHOP_NAME);
  doc.moveDown(0.3);
  doc.fontSize(14).text(report.title);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(9).text(`Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`);
  doc.moveDown(0.6);

  doc.fontSize(9);
  drawTextLine(
    doc,
    "Applied Filters",
    Object.entries(report.filters || {})
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ") || "None",
  );
  doc.moveDown(0.6);

  drawTextLine(doc, "Total Quantity", report.totals?.quantity ?? 0);
  drawTextLine(doc, "Total Gross Wt", report.totals?.grossWeight ?? 0);
  drawTextLine(doc, "Total Stone Wt", report.totals?.stoneWeight ?? 0);
  doc.moveDown(0.8);

  const rows = report.rows || [];
  const columns = buildColumns(rows);

  if (!rows.length || !columns.length) {
    doc.fontSize(11).text("No records found.");
    doc.end();
    return;
  }

  const tableLeft = doc.x;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = usableWidth / columns.length;
  const rowHeight = 22;

  const drawRow = (row, y, isHeader = false) => {
    columns.forEach((column, index) => {
      const x = tableLeft + index * columnWidth;
      doc
        .font(isHeader ? "Helvetica-Bold" : "Helvetica")
        .fontSize(8)
        .text(isHeader ? column : formatValue(row[column]), x + 3, y + 5, {
          width: columnWidth - 6,
          height: rowHeight - 6,
          ellipsis: true,
        });
      doc.rect(x, y, columnWidth, rowHeight).stroke();
    });
  };

  let y = doc.y;
  drawRow({}, y, true);
  y += rowHeight;

  rows.forEach((row) => {
    if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
      doc.addPage();
      y = doc.page.margins.top;
      drawRow({}, y, true);
      y += rowHeight;
    }
    drawRow(row, y);
    y += rowHeight;
  });

  doc.end();
};

module.exports = {
  streamReportPdf,
};
