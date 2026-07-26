import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import {
  config,
  SUPPORTED_FILE_EXTENSIONS,
  SUPPORTED_MIME_TYPES,
} from "../config/index.js";

const uploadDirectory = path.resolve(
  config.uploadDirectory
);

fs.mkdirSync(uploadDirectory, {
  recursive: true,
});

const allowedExtensions = new Set(
  SUPPORTED_FILE_EXTENSIONS
);

const allowedMimeTypes = new Set(
  SUPPORTED_MIME_TYPES
);

const storage = multer.diskStorage({
  destination(request, file, callback) {
    callback(null, uploadDirectory);
  },

  filename(request, file, callback) {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${extension}`;

    callback(null, uniqueName);
  },
});

function fileFilter(request, file, callback) {
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  const validExtension =
    allowedExtensions.has(extension);

  const validMimeType =
    allowedMimeTypes.has(file.mimetype);

  if (!validExtension || !validMimeType) {
    return callback(
      new Error(
        "Only PDF, DOCX, TXT and VTT files are allowed"
      )
    );
  }

  callback(null, true);
}

export const uploadSourceFile = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: config.maxUploadBytes,
    files: 1,
  },
}).single("file");
