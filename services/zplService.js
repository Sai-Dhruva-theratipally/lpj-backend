const { normalizeTagBarcodeValue } = require("./barcodeService");

const LABEL = {
  dpi: 203,
  widthDots: 736, // 92 mm at 203 dpi
  heightDots: 120, // 15 mm at 203 dpi
};

const escapeZplText = (value) => {
  return String(value ?? "-")
    .replace(/\^/g, " ")
    .replace(/~/g, " ")
    .trim();
};

const formatWeight = (value) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toFixed(3) : "0.000";
};

const formatCategory = (item) => {
  const categoryCode = escapeZplText(item.categoryCode || "");
  const category = escapeZplText(item.category || "");
  const categoryValue = categoryCode && category ? `${categoryCode}/${category}` : categoryCode || category || "-";

  return categoryValue.slice(0, 22);
};

const getTrayIdentifier = (item) => item.trayCode || item.categoryCode || item.trayName || item.category || item._id;

const generateManualTextTagLabelZpl = (item) => {
  const category = escapeZplText(item.category).slice(0, 22);
  const code = escapeZplText(item.code).slice(0, 16);

  if (!category || category === "-") {
    const error = new Error("Category is required for manual tag printing");
    error.statusCode = 400;
    throw error;
  }

  if (!/^\d+$/.test(code)) {
    const error = new Error("Code must be numeric for manual tag printing");
    error.statusCode = 400;
    throw error;
  }

  return [
    "^XA",
    "^CI28",
    `^PW${LABEL.widthDots}`,
    `^LL${LABEL.heightDots}`,
    "^LH0,0",
    "^PR3",
    "^MD20",
    // Manual text-only tag: category on the left, numeric code on the right.
    `^FO26,36^A0N,42,38^FD${category}^FS`,
    `^FO410,34^A0N,46,42^FD${code}^FS`,
    "^XZ",
  ].join("\n");
};

const generateTagLabelZpl = (item) => {
  const barcodeValue = normalizeTagBarcodeValue(item.tagId || item.tagNo);
  const grossWeight = formatWeight(item.grossWeight ?? item.weight);
  const stoneWeight = formatWeight(item.stoneWeight);
  const category = formatCategory(item);

  return [
    "^XA",
    "^CI28",
    `^PW${LABEL.widthDots}`,
    `^LL${LABEL.heightDots}`,
    "^LH0,0",
    "^PR3",
    "^MD20",
    "^BY1,3.25,68",
    "^A0N,60,54",
    // Left section: tag code and jewellery weights.
    `^FO18,10^A0N,25,23^FD${escapeZplText(barcodeValue)}^FS`,
    `^FO18,38^A0N,21,19^FD${category}^FS`,
    `^FO18,62^A0N,21,19^FDWt: ${grossWeight}^FS`,
    `^FO18,86^A0N,21,19^FDSt.Wt: ${stoneWeight}^FS`,
    // Right section: CODE128 barcode with human-readable tag id below it.
    `^FO276,4^BCN,78,Y,N,N^FD${barcodeValue}^FS`,
    "^XZ",
  ].join("\n");
};

const generateTrayLabelZpl = (item) => {
  const trayId = escapeZplText(getTrayIdentifier(item));
  const quantity = Number(item.quantity ?? 0);
  const grossWeight = formatWeight(item.grossWeight ?? item.totalWeight ?? item.weight);
  const stoneWeight = formatWeight(item.stoneWeight);

  return [
    "^XA",
    "^CI28",
    `^PW${LABEL.widthDots}`,
    `^LL${LABEL.heightDots}`,
    "^LH0,0",
    "^PR3",
    "^MD20",
    // Text-only tray label. Tray labels intentionally do not include a barcode.
    `^FO18,8^A0N,24,22^FDTray: ${trayId}^FS`,
    `^FO18,38^A0N,20,18^FDQty: ${quantity}^FS`,
    `^FO18,64^A0N,20,18^FDWt: ${grossWeight}^FS`,
    `^FO260,64^A0N,20,18^FDSt.Wt: ${stoneWeight}^FS`,
    "^XZ",
  ].join("\n");
};

const generateInventoryLabelZpl = (item) => {
  if (item.stockType === "TAG") {
    return generateTagLabelZpl(item);
  }

  if (item.stockType === "TRAY") {
    return generateTrayLabelZpl(item);
  }

  const error = new Error("Unsupported stock type for printing");
  error.statusCode = 400;
  throw error;
};

const generateBatchZpl = (items) => items.map(generateInventoryLabelZpl).join("\n");

const generateManualTextTagBatchZpl = (item, quantity = 1) => {
  const labelCount = Math.min(Math.max(Number(quantity) || 1, 1), 100);

  return Array.from({ length: labelCount }, () => generateManualTextTagLabelZpl(item)).join("\n");
};

module.exports = {
  LABEL,
  generateBatchZpl,
  generateInventoryLabelZpl,
  generateManualTextTagBatchZpl,
  generateManualTextTagLabelZpl,
  generateTagLabelZpl,
  generateTrayLabelZpl,
};
