import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  config,
  OPENAI_TRANSCRIPTION_FILE_LIMIT_BYTES,
} from "../../config/index.js";
import { cleanText } from "../parser.utils.js";
import { runTool } from "./externalTools.js";
import { transcribeAudioFile } from "./audioTranscription.client.js";

const AUDIO_OUTPUT_TEMPLATE = "audio.%(ext)s";
const CHUNK_SECONDS = 600;

export class YoutubeFallbackError extends Error {
  constructor(message) {
    super(message);
    this.name = "YoutubeFallbackError";
  }
}

export async function transcribeYoutubeAudio({
  url,
  videoId,
  title,
  logger = console,
  onProgress,
  run = runTool,
  transcribe = transcribeAudioFile,
  fsApi = fs,
} = {}) {
  if (!config.youtubeAudioFallbackEnabled) {
    throw new YoutubeFallbackError(
      "YouTube audio transcription fallback is disabled"
    );
  }

  const tempDirectory = await fsApi.mkdtemp(
    path.join(os.tmpdir(), "youtube-audio-")
  );

  logger.log(
    `YouTube audio fallback started for video ${videoId}`
  );

  try {
    const metadata = await getVideoMetadata({
      url,
      run,
    });

    rejectUnsafeMetadata(metadata);
    rejectLongVideo(metadata);
    await onProgress?.(19);

    const audioPath = await downloadAudio({
      url,
      tempDirectory,
      run,
      logger,
      fsApi,
    });
    await onProgress?.(22);

    const preparedFiles = await prepareAudioFiles({
      audioPath,
      tempDirectory,
      durationSeconds: Number(metadata.duration),
      run,
      fsApi,
    });

    logger.log(
      `Transcription started for video ${videoId}`
    );
    await onProgress?.(24);

    const segments = [];

    for (const item of preparedFiles) {
      const result = await transcribe({
        filePath: item.filePath,
        model: config.audioTranscriptionModel,
        logger,
      });

      segments.push(
        ...normalizeTranscriptionSegments({
          result,
          offsetSeconds: item.offsetSeconds,
          videoId,
          url,
        })
      );

      const completed =
        preparedFiles.indexOf(item) + 1;
      const progress =
        24 +
        Math.round(
          (completed / preparedFiles.length) * 4
        );
      await onProgress?.(progress);
    }

    logger.log(
      `Transcription completed for video ${videoId}`
    );

    return {
      title:
        cleanText(metadata.title) ||
        title ||
        "YouTube video",
      transcriptSource: "audio-transcription",
      segments,
    };
  } catch (error) {
    if (error instanceof YoutubeFallbackError) {
      throw error;
    }

    throw new YoutubeFallbackError(
      friendlyFallbackFailure(error)
    );
  } finally {
    if (process.env.KEEP_YOUTUBE_TEMP_FILES === "true") {
      logger.log(
        `KEEP_YOUTUBE_TEMP_FILES=true; preserving YouTube audio fallback temp directory: ${tempDirectory}`
      );
    } else {
      await fsApi.rm(tempDirectory, {
        recursive: true,
        force: true,
      });
    }

    logger.log(
      `YouTube audio fallback temp cleanup completed for video ${videoId}`
    );
  }
}

export async function getVideoMetadata({
  url,
  run = runTool,
}) {
  const { stdout } = await run("yt-dlp", [
    "--dump-json",
    "--no-playlist",
    "--skip-download",
    url,
  ]);

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new YoutubeFallbackError(
      "Unable to read YouTube video metadata"
    );
  }
}

function rejectUnsafeMetadata(metadata) {
  const availability =
    String(metadata.availability ?? "").toLowerCase();

  if (
    metadata.is_private ||
    metadata.needs_auth ||
    availability.includes("private") ||
    availability.includes("premium") ||
    availability.includes("subscriber") ||
    availability.includes("members")
  ) {
    throw new YoutubeFallbackError(
      "This YouTube video is private or restricted"
    );
  }

  if (Number(metadata.age_limit) >= 18) {
    throw new YoutubeFallbackError(
      "This YouTube video is age restricted"
    );
  }
}

function rejectLongVideo(metadata) {
  const durationSeconds = Number(metadata.duration);

  if (
    Number.isFinite(durationSeconds) &&
    durationSeconds >
      config.youtubeMaxDurationSeconds
  ) {
    throw new YoutubeFallbackError(
      `This YouTube video is longer than the configured ${config.youtubeMaxDurationSeconds} second limit`
    );
  }
}

async function downloadAudio({
  url,
  tempDirectory,
  run,
  logger,
  fsApi,
}) {
  await run("yt-dlp", [
    "--no-playlist",
    "--extract-audio",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "8",
    "-f",
    "ba[filesize<50M]/bestaudio/best",
    "--max-filesize",
    String(config.youtubeMaxAudioBytes),
    "-o",
    path.join(tempDirectory, AUDIO_OUTPUT_TEMPLATE),
    url,
  ]);

  const files = await fsApi.readdir(tempDirectory);
  const audioFile = files.find((fileName) =>
    /\.(mp3|m4a|webm|opus|ogg|wav)$/i.test(fileName)
  );

  if (!audioFile) {
    throw new YoutubeFallbackError(
      "Audio download did not produce a readable audio file"
    );
  }

  const audioPath = path.join(tempDirectory, audioFile);
  const stats = await fsApi.stat(audioPath);

  if (!stats.isFile() || stats.size <= 0) {
    throw new YoutubeFallbackError(
      "Audio download produced an empty or unreadable audio file"
    );
  }

  if (stats.size > config.youtubeMaxAudioBytes) {
    throw new YoutubeFallbackError(
      "Downloaded YouTube audio exceeds the configured size limit"
    );
  }

  logger.log(
    `YouTube audio downloaded (${stats.size} bytes): ${audioPath}`
  );

  return audioPath;
}

async function prepareAudioFiles({
  audioPath,
  tempDirectory,
  durationSeconds,
  run,
  fsApi,
}) {
  const stats = await fsApi.stat(audioPath);
  const apiLimit = Math.min(
    config.youtubeMaxAudioBytes,
    OPENAI_TRANSCRIPTION_FILE_LIMIT_BYTES
  );

  if (stats.size <= apiLimit) {
    return [
      {
        filePath: audioPath,
        offsetSeconds: 0,
      },
    ];
  }

  const compressedPath = path.join(
    tempDirectory,
    "compressed.mp3"
  );

  await run("ffmpeg", [
    "-y",
    "-i",
    audioPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "32k",
    compressedPath,
  ]);

  const compressedStats =
    await fsApi.stat(compressedPath);

  if (compressedStats.size <= apiLimit) {
    return [
      {
        filePath: compressedPath,
        offsetSeconds: 0,
      },
    ];
  }

  if (!Number.isFinite(durationSeconds)) {
    throw new YoutubeFallbackError(
      "Audio is too large to transcribe and video duration is unavailable for safe splitting"
    );
  }

  return splitAudio({
    audioPath: compressedPath,
    tempDirectory,
    durationSeconds,
    run,
    fsApi,
    apiLimit,
  });
}

async function splitAudio({
  audioPath,
  tempDirectory,
  durationSeconds,
  run,
  fsApi,
  apiLimit,
}) {
  const chunks = [];

  for (
    let offsetSeconds = 0;
    offsetSeconds < durationSeconds;
    offsetSeconds += CHUNK_SECONDS
  ) {
    const chunkPath = path.join(
      tempDirectory,
      `chunk-${offsetSeconds}.mp3`
    );

    await run("ffmpeg", [
      "-y",
      "-ss",
      String(offsetSeconds),
      "-t",
      String(CHUNK_SECONDS),
      "-i",
      audioPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "32k",
      chunkPath,
    ]);

    const chunkStats = await fsApi.stat(chunkPath);

    if (chunkStats.size > apiLimit) {
      throw new YoutubeFallbackError(
        "A split YouTube audio chunk exceeds the transcription size limit"
      );
    }

    chunks.push({
      filePath: chunkPath,
      offsetSeconds,
    });
  }

  return chunks;
}

export function normalizeTranscriptionSegments({
  result,
  offsetSeconds = 0,
  videoId,
  url,
}) {
  const rawSegments = Array.isArray(result?.segments)
    ? result.segments
    : [];

  if (rawSegments.length > 0) {
    return rawSegments
      .map((segment) => ({
        text: cleanText(segment.text),
        location: {
          startSeconds:
            Number(segment.start ?? 0) +
            offsetSeconds,
          endSeconds:
            Number(segment.end ?? segment.start ?? 0) +
            offsetSeconds,
          videoId,
          url,
          transcriptSource:
            "audio-transcription",
        },
        metadata: {
          transcriptSource:
            "audio-transcription",
        },
      }))
      .filter((segment) => segment.text);
  }

  const text = cleanText(result?.text);

  return text
    ? [
        {
          text,
          location: {
            startSeconds: offsetSeconds,
            endSeconds: offsetSeconds,
            videoId,
            url,
            transcriptSource:
              "audio-transcription",
          },
          metadata: {
            transcriptSource:
              "audio-transcription",
          },
        },
      ]
    : [];
}

function friendlyFallbackFailure(error) {
  const safeMessage = error?.message
    ? `: ${error.message}`
    : "";
  const message = String(
    error?.message ?? ""
  ).toLowerCase();

  if (
    message.includes("private") ||
    message.includes("members") ||
    message.includes("sign in") ||
    message.includes("login")
  ) {
    return "This YouTube video is private, restricted, or inaccessible";
  }

  if (
    message.includes("file is larger") ||
    message.includes("max-filesize") ||
    message.includes("too large")
  ) {
    return "This YouTube video audio is too large to transcribe";
  }

  if (
    message.includes("ffmpeg") ||
    message.includes("yt-dlp")
  ) {
    return "YouTube audio fallback tools could not process this video";
  }

  return `YouTube captions were unavailable and audio transcription could not complete${safeMessage}`;
}
