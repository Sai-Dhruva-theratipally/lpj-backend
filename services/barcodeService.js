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

  if (!/^[A-Z0-9]{6}\d{5}$/.test(barcodeValue) && !/^\d{12}$/.test(barcodeValue)) {
    const error = new Error("Tag barcode must be 6 category characters followed by 5 digits");
    error.statusCode = 400;
    throw error;
  }

  return barcodeValue;
};

module.exports = {
  normalizeCode128Value,
  normalizeTagBarcodeValue,
};
