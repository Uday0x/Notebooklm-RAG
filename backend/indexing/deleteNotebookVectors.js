import { qdrantClient } from "./qdrant.client.js";
import { config } from "../config/index.js";

const COLLECTION_NAME =
  config.qdrantCollection;

export async function deleteNotebookVectors(
  notebookId
) {
  if (!notebookId) {
    throw new Error(
      "notebookId is required"
    );
  }

  await qdrantClient.delete(
    COLLECTION_NAME,
    {
      filter: {
        must: [
          {
            key: "notebookId",
            match: {
              value: notebookId,
            },
          },
        ],
      },
    }
  );
}
