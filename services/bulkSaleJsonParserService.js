const normalizeKey = (key) => String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const FIELD_ALIASES = {
  serialNo: ["sno", "serialno", "serialnumber", "billno", "billnumber", "bill"],
  customerName: ["customername", "customer", "name"],
  date: ["date", "saledate"],
  barcode: ["barcode", "tagcode", "tagid", "traycode", "itemcode", "identifier", "code"],
  quantity: ["quantity", "qty"],
  grossWeight: ["grossweight", "weight", "grosswt", "wt"],
  stoneWeight: ["stoneweight", "stonewt"],
  rate: ["rate", "salerate"],
  receivedItemType: ["receiveditemtype", "receivedtype", "itemtype"],
  receivedMetal: ["receivedmetal", "metalreceived", "receivedmetaltype"],
  receivedCategory: ["receivedcategory", "receivedcat"],
  receivedWeight: ["receivedweight", "receivedwt"],
  purity: ["purity", "receivedpurity"],
};

const aliasToField = Object.entries(FIELD_ALIASES).reduce((map, [field, aliases]) => {
  aliases.forEach((alias) => {
    map.set(alias, field);
  });
  return map;
}, new Map());

const normalizeDateInput = (value) => {
  if (!value) {
    return "";
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  if (!raw) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const dateParts = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dateParts) {
    const day = dateParts[1].padStart(2, "0");
    const month = dateParts[2].padStart(2, "0");
    const year = dateParts[3].length === 2 ? `20${dateParts[3]}` : dateParts[3];
    return `${year}-${month}-${day}`;
  }

  const parsedDate = new Date(raw);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().slice(0, 10);
  }

  return raw;
};

const parseNumberOrEmpty = (value) => {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : value;
};

const normalizeRawRow = (rawRow, index) => {
  const row = {
    rowId: `row-${index + 1}`,
    rowNumber: index + 1,
    serialNo: "",
    customerName: "",
    date: "",
    barcode: "",
    quantity: "",
    grossWeight: "",
    stoneWeight: "",
    rate: "",
    receivedItemType: "",
    receivedMetal: "",
    receivedCategory: "",
    receivedWeight: "",
    purity: "",
  };

  Object.entries(rawRow || {}).forEach(([key, value]) => {
    const field = aliasToField.get(normalizeKey(key));
    if (!field) {
      return;
    }
    row[field] = value;
  });

  row.serialNo = String(row.serialNo || "").trim();
  row.customerName = String(row.customerName || "").trim();
  row.date = normalizeDateInput(row.date);
  row.barcode = String(row.barcode || "").trim();
  row.quantity = parseNumberOrEmpty(row.quantity);
  row.grossWeight = parseNumberOrEmpty(row.grossWeight);
  row.stoneWeight = parseNumberOrEmpty(row.stoneWeight);
  row.rate = parseNumberOrEmpty(row.rate);
  row.receivedItemType = String(row.receivedItemType || "").trim();
  row.receivedMetal = String(row.receivedMetal || "").trim();
  row.receivedCategory = String(row.receivedCategory || "").trim();
  row.receivedWeight = parseNumberOrEmpty(row.receivedWeight);
  row.purity = String(row.purity || "").trim();

  return row;
};

const extractRows = (parsedJson) => {
  if (Array.isArray(parsedJson)) {
    return parsedJson;
  }

  if (parsedJson && typeof parsedJson === "object") {
    const rows = parsedJson.rows || parsedJson.items || parsedJson.data || parsedJson.sales;
    if (Array.isArray(rows)) {
      return rows;
    }
  }

  const error = new Error("JSON must be an array, or an object with rows/items/data/sales array");
  error.statusCode = 400;
  throw error;
};

const parseBulkSaleJson = (jsonText) => {
  if (!String(jsonText || "").trim()) {
    const error = new Error("JSON text is required");
    error.statusCode = 400;
    throw error;
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(jsonText);
  } catch (error) {
    const parseError = new Error(`Invalid JSON: ${error.message}`);
    parseError.statusCode = 400;
    throw parseError;
  }

  const rawRows = extractRows(parsedJson);
  if (rawRows.length === 0) {
    const error = new Error("JSON does not contain any sale rows");
    error.statusCode = 400;
    throw error;
  }

  return rawRows.map(normalizeRawRow);
};

module.exports = {
  parseBulkSaleJson,
};
