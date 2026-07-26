import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

import {
  config,
} from "../../config/index.js";

const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  ".flac",
  ".m4a",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".oga",
  ".ogg",
  ".wav",
  ".webm",
]);

const TEXT_GENERATION_MODEL_PATTERNS = [
  /^gpt-/i,
  /^o\d/i,
  /^chatgpt-/i,
  /^text-/i,
];

const KNOWN_TRANSCRIPTION_MODELS = new Set([
  "whisper-1",
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
]);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function transcribeAudioFile({
  filePath,
  model = config.audioTranscriptionModel,
  logger = console,
}) {
  await assertReadableAudioFile(filePath);
  assertTranscriptionModel(model);

  try {
    return await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model,
      response_format: "verbose_json",
    });
  } catch (error) {
    logOpenAITranscriptionError(error, logger);
    throw error;
  }
}

export async function assertReadableAudioFile(filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error(
      "Audio transcription file path is required"
    );
  }

  const extension = path.extname(filePath).toLowerCase();

  if (!SUPPORTED_AUDIO_EXTENSIONS.has(extension)) {
    throw new Error(
      `Unsupported audio file extension for transcription: ${extension || "(none)"}`
    );
  }

  let stats;

  try {
    stats = await fsPromises.stat(filePath);
  } catch (error) {
    throw new Error(
      `Audio transcription file is not readable: ${error.message}`
    );
  }

  if (!stats.isFile()) {
    throw new Error(
      "Audio transcription path is not a file"
    );
  }

  if (stats.size <= 0) {
    throw new Error(
      "Audio transcription file is empty"
    );
  }
}

export function assertTranscriptionModel(model) {
  if (!model || typeof model !== "string") {
    throw new Error(
      "AUDIO_TRANSCRIPTION_MODEL is required"
    );
  }

  if (KNOWN_TRANSCRIPTION_MODELS.has(model)) {
    return;
  }

  if (
    TEXT_GENERATION_MODEL_PATTERNS.some((pattern) =>
      pattern.test(model)
    )
  ) {
    throw new Error(
      `AUDIO_TRANSCRIPTION_MODEL must be an audio transcription model, not a text-generation model: ${model}`
    );
  }
}

export function getSafeOpenAIErrorFields(error) {
  return {
    name: error?.name,
    message: error?.message,
    status: error?.status,
    code: error?.code,
    type: error?.type,
    param: error?.param,
    cause: formatErrorCause(error?.cause),
  };
}

export function logOpenAITranscriptionError(
  error,
  logger = console
) {
  logger.error?.(
    "OpenAI transcription failed:",
    getSafeOpenAIErrorFields(error)
  );
}

function formatErrorCause(cause) {
  if (!cause) {
    return undefined;
  }

  return {
    name: cause.name,
    message: cause.message,
    code: cause.code,
  };
}
