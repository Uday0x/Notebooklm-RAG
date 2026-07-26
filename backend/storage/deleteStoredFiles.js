import {
  deleteStoredFile,
} from "./deleteStoredFile.js";

export async function deleteStoredFiles(
  storagePaths
) {
  if (!Array.isArray(storagePaths)) {
    throw new Error(
      "storagePaths must be an array"
    );
  }

  const validPaths = storagePaths.filter(
    (storagePath) =>
      typeof storagePath === "string" &&
      storagePath.trim()
  );

  const results =
    await Promise.allSettled(
      validPaths.map((storagePath) =>
        deleteStoredFile(storagePath)
      )
    );

  const failedDeletes = results
    .map((result, index) => ({
      result,
      storagePath: validPaths[index],
    }))
    .filter(
      ({ result }) =>
        result.status === "rejected"
    );

  if (failedDeletes.length > 0) {
    const failedPaths = failedDeletes.map(
      ({ storagePath }) => storagePath
    );

    throw new Error(
      `Failed to delete files: ${failedPaths.join(", ")}`
    );
  }
}