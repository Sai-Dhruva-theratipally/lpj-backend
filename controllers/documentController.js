const asyncHandler = require("../middleware/asyncHandler");
const Document = require("../models/Document");
const { deleteCloudinaryFile, getFileType, uploadFileToCloudinary } = require("../services/cloudinaryService");
const { sendSuccess } = require("../utils/apiResponse");

const buildDocumentPayload = (body, file, cloudinaryUpload) => {
  const fileType = getFileType(file.mimetype);

  if (!fileType) {
    const error = new Error("Only JPG, JPEG, PNG and PDF files are allowed");
    error.statusCode = 400;
    throw error;
  }

  return {
    title: body.title.trim(),
    description: body.description?.trim() || "",
    fileType,
    cloudinaryUrl: cloudinaryUpload.secure_url,
    cloudinaryPublicId: cloudinaryUpload.public_id,
    uploadedAt: new Date(),
  };
};

const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("Document file is required");
  }

  const cloudinaryUpload = await uploadFileToCloudinary(req.file);

  try {
    const document = await Document.create(buildDocumentPayload(req.body, req.file, cloudinaryUpload));
    return sendSuccess(res, 201, "Document uploaded successfully", document);
  } catch (error) {
    try {
      await deleteCloudinaryFile(cloudinaryUpload.public_id, getFileType(req.file.mimetype));
    } catch (cleanupError) {
      console.error(`Document upload cleanup failed: ${cleanupError.message}`);
    }

    throw error;
  }
});

const getDocuments = asyncHandler(async (req, res) => {
  const documents = await Document.find().sort({ uploadedAt: -1 });
  return sendSuccess(res, 200, "Documents fetched successfully", documents);
});

const searchDocuments = asyncHandler(async (req, res) => {
  const search = String(req.query.q || "").trim();

  if (!search) {
    return sendSuccess(res, 200, "Documents fetched successfully", []);
  }

  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const searchRegex = new RegExp(escapedSearch, "i");
  const documents = await Document.find({
    $or: [{ title: searchRegex }, { description: searchRegex }],
  }).sort({ uploadedAt: -1 });

  return sendSuccess(res, 200, "Documents searched successfully", documents);
});

const deleteDocument = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    res.status(404);
    throw new Error("Document not found");
  }

  await deleteCloudinaryFile(document.cloudinaryPublicId, document.fileType);
  await document.deleteOne();

  return sendSuccess(res, 200, "Document deleted successfully", { id: req.params.id });
});

module.exports = {
  deleteDocument,
  getDocuments,
  searchDocuments,
  uploadDocument,
};
