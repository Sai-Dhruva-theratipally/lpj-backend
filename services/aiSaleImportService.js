const { parseBulkSaleJson } = require("./bulkSaleJsonParserService");

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_IMAGES = 5;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const extractionPrompt = `You are extracting sales from handwritten or tabular jewellery shop sale sheets.

Return ONLY valid JSON. Do not include markdown, comments, prose, or code fences.

Return a JSON array of sale row objects. Column order in the image may vary. Use field names and visible labels, not position alone.

Extract these fields when present:
- sNo
- customerName
- date
- barcode
- quantity
- grossWeight
- stoneWeight
- rate
- receivedItemType
- receivedMetal
- receivedCategory
- receivedWeight
- purity

Rules:
- Ignore unknown fields.
- Use null or an empty string for missing visible values.
- Keep barcode/tag/tray codes exactly as written when possible.
- Dates should be YYYY-MM-DD when the date is clear.
- Numbers should be numbers, not strings.
- If one bill has multiple sold items, return one row per sold item with the same sNo, customerName, and date.
- If received item details are on the same bill, repeat those received fields on the relevant row.`;

const assertImages = (files = []) => {
  if (!files.length) {
    const error = new Error("At least one sale sheet image is required");
    error.statusCode = 400;
    throw error;
  }

  if (files.length > MAX_IMAGES) {
    const error = new Error(`Upload up to ${MAX_IMAGES} images at a time`);
    error.statusCode = 400;
    throw error;
  }

  files.forEach((file) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const error = new Error("Only JPG, PNG, and WEBP sale sheet images are supported");
      error.statusCode = 400;
      throw error;
    }
  });
};

const stripJsonFences = (text) => {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    return fenced[1].trim();
  }

  const firstArray = trimmed.indexOf("[");
  const firstObject = trimmed.indexOf("{");
  const starts = [firstArray, firstObject].filter((index) => index >= 0);
  if (!starts.length) {
    return trimmed;
  }

  const start = Math.min(...starts);
  const endArray = trimmed.lastIndexOf("]");
  const endObject = trimmed.lastIndexOf("}");
  const end = Math.max(endArray, endObject);

  return end >= start ? trimmed.slice(start, end + 1).trim() : trimmed;
};

const extractGeminiText = (data) => {
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason || "empty response";
    const error = new Error(`Gemini did not return sale JSON (${reason})`);
    error.statusCode = 502;
    throw error;
  }

  return text;
};

const callGeminiVision = async (files) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY is not configured");
    error.statusCode = 500;
    throw error;
  }

  if (typeof fetch !== "function") {
    const error = new Error("This Node runtime does not support fetch required for Gemini calls");
    error.statusCode = 500;
    throw error;
  }

  const parts = [
    { text: extractionPrompt },
    ...files.map((file) => ({
      inlineData: {
        mimeType: file.mimetype,
        data: file.buffer.toString("base64"),
      },
    })),
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error?.message || "Gemini request failed";
    const error = new Error(message);
    error.statusCode = response.status >= 500 ? 502 : 400;
    throw error;
  }

  return extractGeminiText(data);
};

const extractSaleRowsFromImages = async (files = []) => {
  assertImages(files);

  const geminiText = await callGeminiVision(files);
  const jsonText = stripJsonFences(geminiText);

  let rows;
  try {
    rows = parseBulkSaleJson(jsonText);
  } catch (error) {
    error.message = `Gemini returned invalid sale JSON: ${error.message}`;
    throw error;
  }

  return {
    rawJson: jsonText,
    rows,
    imageCount: files.length,
    model: GEMINI_MODEL,
  };
};

module.exports = {
  extractSaleRowsFromImages,
};
