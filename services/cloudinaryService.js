const multer = require("multer");
const path = require("path");
const cloudinary = require("../config/cloudinary");

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "application/pdf"]);
const DOCUMENT_FOLDER = "lpj/document-vault";

const ensureCloudinaryConfig = () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary environment variables are missing");
  }
};

const getFileType = (mimetype = "") => {
  if (mimetype === "application/pdf") {
    return "PDF";
  }

  if (mimetype.startsWith("image/")) {
    return "IMAGE";
  }

  return null;
};

const getResourceType = (fileType) => {
  return fileType === "PDF" ? "raw" : "image";
};

const buildPublicId = (file, fileType) => {
  const originalName = file.originalname
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  const extension = fileType === "PDF" ? path.extname(file.originalname).toLowerCase() : "";

  return `${DOCUMENT_FOLDER}/${Date.now()}-${originalName || "document"}${extension}`;
};

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const error = new Error("Only JPG, JPEG, PNG and PDF files are allowed");
    error.statusCode = 400;
    return cb(error);
  }

  return cb(null, true);
};

const uploadDocumentFile = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
}).single("document");

const uploadFileToCloudinary = async (file) => {
  ensureCloudinaryConfig();

  const fileType = getFileType(file.mimetype);

  if (!fileType) {
    throw new Error("Unsupported file type");
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: buildPublicId(file, fileType),
        resource_type: getResourceType(fileType),
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    uploadStream.end(file.buffer);
  });
};

const deleteCloudinaryFile = async (publicId, fileType) => {
  ensureCloudinaryConfig();

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: getResourceType(fileType),
  });

  if (!["ok", "not found"].includes(result.result)) {
    throw new Error(`Cloudinary delete failed: ${result.result}`);
  }

  return result;
};

module.exports = {
  deleteCloudinaryFile,
  getFileType,
  uploadFileToCloudinary,
  uploadDocumentFile,
};
