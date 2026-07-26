import { fetchTranscript } from "youtube-transcript";

import { SOURCE_TYPES } from "../parser.types.js";
import {
  assertNonEmptySegments,
  cleanText,
} from "../parser.utils.js";

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
}) {
  const resolvedVideoId = extractVideoId(
    videoId ?? url
  );

  const transcript = await fetchTranscript(
    resolvedVideoId,
    language
      ? {
          lang: language,
        }
      : undefined
  );

  const segments = transcript
    .map((item, index) => {
      const startSeconds = Number(item.offset ?? 0);
      const durationSeconds = Number(item.duration ?? 0);
      const text = cleanText(item.text);

      return {
        text,
        location: {
          videoId: resolvedVideoId,
          sourceUrl: `https://www.youtube.com/watch?v=${resolvedVideoId}`,
          cueIndex: index + 1,
          startSeconds,
          endSeconds: startSeconds + durationSeconds,
        },
      };
    })
    .filter((segment) => segment.text);

  return {
    title,
    sourceType: SOURCE_TYPES.YOUTUBE,
    segments: assertNonEmptySegments(
      segments,
      SOURCE_TYPES.YOUTUBE
    ),
  };
}