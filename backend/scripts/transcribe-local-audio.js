import "dotenv/config";

import path from "node:path";

import {
  config,
} from "../config/index.js";
import {
  transcribeAudioFile,
} from "../parser/youtube/audioTranscription.client.js";

const audioFilePath = process.argv[2];

if (!audioFilePath) {
  console.error(
    "Usage: node scripts/transcribe-local-audio.js <audio-file-path>"
  );
  process.exit(1);
}

try {
  const resolvedPath = path.resolve(audioFilePath);

  console.log(
    `Transcribing ${resolvedPath} with model ${config.audioTranscriptionModel}`
  );

  const result = await transcribeAudioFile({
    filePath: resolvedPath,
    model: config.audioTranscriptionModel,
    logger: console,
  });

  console.log(
    JSON.stringify(
      {
        textLength: result?.text?.length ?? 0,
        segmentCount: Array.isArray(result?.segments)
          ? result.segments.length
          : 0,
        textPreview:
          typeof result?.text === "string"
            ? result.text.slice(0, 500)
            : "",
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(
    "Local audio transcription failed:",
    error.message
  );
  process.exit(1);
}
