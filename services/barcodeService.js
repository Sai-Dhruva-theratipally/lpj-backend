const TAG_BARCODE_LENGTH = 12;

const normalizeCode128Value = (value) => {
  const barcodeValue = String(value ?? "").trim();

  if (!barcodeValue) {
    const error = new Error("Barcode value is required");
    error.statusCode = 400;
    throw error;
  }

  if (!/^[\x20-\x7E]+$/.test(barcodeValue)) {
    const error = new Error("Barcode value must contain printable ASCII characters only");
    error.statusCode = 400;
    throw error;
  }

  return barcodeValue;
};

const normalizeTagBarcodeValue = (tagId) => {
  const barcodeValue = normalizeCode128Value(tagId);

  if (!/^\d{12}$/.test(barcodeValue)) {
    const error = new Error(`Tag barcode must be a ${TAG_BARCODE_LENGTH} digit tag id`);
    error.statusCode = 400;
    throw error;
  }

  return barcodeValue;
};

module.exports = {
  normalizeCode128Value,
  normalizeTagBarcodeValue,
};
