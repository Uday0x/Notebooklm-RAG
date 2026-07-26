import fs from "fs/promises";
import path from "path";
import { config } from "../config/index.js";

export async function deleteStoredFile(storagePath) {
  if (!storagePath) {
    return;
  }

  const absolutePath = path.resolve(storagePath);
  const uploadRoot = path.resolve(
    config.uploadDirectory
  );

  if (
    absolutePath !== uploadRoot &&
    !absolutePath.startsWith(
      `${uploadRoot}${path.sep}`
    )
  ) {
    throw new Error(
      "Refusing to delete file outside upload directory"
    );
  }

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}
