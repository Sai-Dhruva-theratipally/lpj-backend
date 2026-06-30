const { parseBulkSaleJson } = require("./bulkSaleJsonParserService");

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_IMAGES = 5;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const extractionPrompt = `Extract jewellery sale rows from the uploaded handwritten or printed sale list image.

Return ONLY valid JSON. Do not include markdown, comments, prose, or code fences.

Return a JSON array where each object is one sale item row. If one bill has multiple sold items, repeat the same sNo, customerName, and date for each sold item.

Use these fields when visible:
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
- Multiple sales may be present in one image.
- Use field labels and visible context, not just column position.
- Keep barcode/tag/tray codes exactly as written when possible.
- Dates should be YYYY-MM-DD when clear.
- Numbers should be numbers, not strings.
- Use an empty string for missing values.
- Ignore unknown fields.`;

const makeError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const assertImages = (files = []) => {
  if (!files.length) {
    throw makeError("At least one sale list image is required", 400);
  }

  if (files.length > MAX_IMAGES) {
    throw makeError(`Upload up to ${MAX_IMAGES} images at a time`, 400);
  }

  files.forEach((file) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw makeError("Only JPG, PNG, and WEBP sale list images are supported", 400);
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
  const end = Math.max(trimmed.lastIndexOf("]"), trimmed.lastIndexOf("}"));
  return end >= start ? trimmed.slice(start, end + 1).trim() : trimmed;
};

const extractGeminiText = (data) => {
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason || "empty response";
    throw makeError(`AI did not return sale JSON (${reason})`, 502);
  }

  return text;
};

const callGeminiVision = async (files) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw makeError("GEMINI_API_KEY is not configured", 500);
  }

  if (typeof fetch !== "function") {
    throw makeError("This Node runtime does not support fetch required for AI image extraction", 500);
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
    throw makeError(data?.error?.message || "AI image extraction request failed", response.status >= 500 ? 502 : 400);
  }

  return extractGeminiText(data);
};

const extractSaleRowsFromImages = async (files = []) => {
  assertImages(files);

  const aiText = await callGeminiVision(files);
  const rawJson = stripJsonFences(aiText);

  let rows;
  try {
    rows = parseBulkSaleJson(rawJson);
  } catch (error) {
    error.message = `AI returned invalid sale JSON: ${error.message}`;
    throw error;
  }

  return {
    imageCount: files.length,
    model: GEMINI_MODEL,
    rawJson,
    rows,
  };
};

module.exports = {
  extractSaleRowsFromImages,
};
