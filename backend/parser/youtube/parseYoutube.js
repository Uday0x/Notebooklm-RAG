import { fetchTranscript } from "youtube-transcript";

import { SOURCE_TYPES } from "../parser.types.js";
import {
  assertNonEmptySegments,
  cleanText,
} from "../parser.utils.js";
import {
  transcribeYoutubeAudio,
} from "./youtubeAudioFallback.js";

/**
 * Flow: YouTube URL/video ID → youtube-transcript → timestamp-aware segments.
 */

function extractVideoId(value) {
  if (!value || typeof value !== "string") {
    throw new Error(
      "YouTube parser requires a URL or video ID"
    );
  }

  const trimmedValue = value.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmedValue)) {
    return trimmedValue;
  }

  const url = new URL(trimmedValue);

  if (url.hostname.includes("youtu.be")) {
    return url.pathname.split("/").filter(Boolean)[0];
  }

  if (url.hostname.includes("youtube.com")) {
    if (url.pathname.startsWith("/shorts/")) {
      return url.pathname.split("/")[2];
    }

    if (url.pathname.startsWith("/embed/")) {
      return url.pathname.split("/")[2];
    }

    return url.searchParams.get("v");
  }

  throw new Error("Unsupported YouTube URL");
}

export async function parseYoutube({
  url,
  videoId,
  title = "YouTube video",
  language,
  onProgress,
  logger = console,
  fetchTranscriptImpl = fetchTranscript,
  audioFallbackImpl = transcribeYoutubeAudio,
}) {
  const resolvedVideoId = extractVideoId(
    videoId ?? url
  );

  const resolvedUrl =
    url ||
    `https://www.youtube.com/watch?v=${resolvedVideoId}`;

  logger.log(
    `YouTube caption attempt started for video ${resolvedVideoId}`
  );

  await onProgress?.(15);

  try {
    const transcript = await fetchTranscriptImpl(
      resolvedVideoId,
      language
        ? {
            lang: language,
          }
        : undefined
    );

    const segments = normalizeCaptionSegments({
      transcript,
      resolvedVideoId,
      resolvedUrl,
    });

    if (segments.length === 0) {
      throw new Error(
        "YouTube captions were empty"
      );
    }

    return {
      title,
      sourceType: SOURCE_TYPES.YOUTUBE,
      metadata: {
        transcriptSource:
          "youtube-captions",
      },
      segments: assertNonEmptySegments(
        segments,
        SOURCE_TYPES.YOUTUBE
      ),
    };
  } catch (captionError) {
    if (!isCaptionUnavailableError(captionError)) {
      throw captionError;
    }

    logger.warn(
      `YouTube captions unavailable for video ${resolvedVideoId}: ${captionError.message}`
    );

    await onProgress?.(18);

    const fallback = await audioFallbackImpl({
      url: resolvedUrl,
      videoId: resolvedVideoId,
      title,
      logger,
      onProgress,
    });

    await onProgress?.(28);

    return {
      title: fallback.title || title,
      sourceType: SOURCE_TYPES.YOUTUBE,
      metadata: {
        transcriptSource:
          fallback.transcriptSource ||
          "audio-transcription",
      },
      segments: assertNonEmptySegments(
        fallback.segments,
        SOURCE_TYPES.YOUTUBE
      ),
    };
  }
}

function normalizeCaptionSegments({
  transcript,
  resolvedVideoId,
  resolvedUrl,
}) {
  return transcript
    .map((item, index) => {
      const startSeconds = Number(item.offset ?? 0);
      const durationSeconds = Number(item.duration ?? 0);
      const text = cleanText(item.text);

      return {
        text,
        location: {
          videoId: resolvedVideoId,
          url: resolvedUrl,
          sourceUrl: resolvedUrl,
          cueIndex: index + 1,
          startSeconds,
          endSeconds: startSeconds + durationSeconds,
          transcriptSource:
            "youtube-captions",
        },
        metadata: {
          transcriptSource:
            "youtube-captions",
        },
      };
    })
    .filter((segment) => segment.text);
}

function isCaptionUnavailableError(error) {
  const message = String(
    error?.message ?? ""
  ).toLowerCase();

  return (
    message.includes("caption") ||
    message.includes("subtitle") ||
    message.includes("transcript") ||
    message.includes("disabled") ||
    message.includes("unavailable") ||
    message.includes("unsupported") ||
    message.includes("empty") ||
    message.includes("no element found")
  );
}
