import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  parseYoutube,
} from "../parser/youtube/parseYoutube.js";
import {
  transcribeYoutubeAudio,
} from "../parser/youtube/youtubeAudioFallback.js";

function createLogger() {
  const logs = [];

  return {
    logs,
    log(message) {
      logs.push(["log", message]);
    },
    warn(message) {
      logs.push(["warn", message]);
    },
  };
}

test("parseYoutube uses existing captions when available", async () => {
  const result = await parseYoutube({
    videoId: "abc123def45",
    title: "Captioned video",
    fetchTranscriptImpl: async () => [
      {
        text: "Hello from captions",
        offset: 1,
        duration: 2,
      },
    ],
  });

  assert.equal(result.title, "Captioned video");
  assert.equal(result.sourceType, "YOUTUBE");
  assert.equal(
    result.metadata.transcriptSource,
    "youtube-captions"
  );
  assert.equal(result.segments.length, 1);
  assert.equal(
    result.segments[0].location.startSeconds,
    1
  );
  assert.equal(
    result.segments[0].location.endSeconds,
    3
  );
  assert.equal(
    result.segments[0].location.videoId,
    "abc123def45"
  );
  assert.equal(
    result.segments[0].location.url,
    "https://www.youtube.com/watch?v=abc123def45"
  );
});

test("parseYoutube falls back to audio transcription when captions are disabled", async () => {
  const progress = [];

  const result = await parseYoutube({
    url: "https://www.youtube.com/watch?v=abc123def45",
    title: "Fallback video",
    onProgress: (value) => progress.push(value),
    fetchTranscriptImpl: async () => {
      throw new Error("Transcript is disabled");
    },
    audioFallbackImpl: async () => ({
      title: "Fallback video",
      transcriptSource:
        "audio-transcription",
      segments: [
        {
          text: "Generated from audio",
          location: {
            startSeconds: 0,
            endSeconds: 4,
            videoId: "abc123def45",
            url: "https://www.youtube.com/watch?v=abc123def45",
            transcriptSource:
              "audio-transcription",
          },
        },
      ],
    }),
  });

  assert.equal(
    result.metadata.transcriptSource,
    "audio-transcription"
  );
  assert.equal(
    result.segments[0].text,
    "Generated from audio"
  );
  assert.deepEqual(progress, [15, 18, 28]);
});

test("audio fallback fails cleanly when audio download fails", async () => {
  const logger = createLogger();

  await assert.rejects(
    () =>
      transcribeYoutubeAudio({
        url: "https://www.youtube.com/watch?v=abc123def45",
        videoId: "abc123def45",
        logger,
        run: async (command, args) => {
          if (args.includes("--dump-json")) {
            return {
              stdout: JSON.stringify({
                title: "Public video",
                duration: 12,
              }),
            };
          }

          throw new Error("yt-dlp download failed");
        },
      }),
    /audio fallback tools could not process|could not complete/i
  );

  assert.ok(
    logger.logs.some(([level, message]) =>
      `${level}:${message}`.includes(
        "temp cleanup completed"
      )
    )
  );
});

test("audio fallback fails cleanly when transcription fails", async () => {
  const logger = createLogger();
  let tempDirectory;

  await assert.rejects(
    () =>
      transcribeYoutubeAudio({
        url: "https://www.youtube.com/watch?v=abc123def45",
        videoId: "abc123def45",
        logger,
        run: async (command, args) => {
          if (args.includes("--dump-json")) {
            return {
              stdout: JSON.stringify({
                title: "Public video",
                duration: 12,
              }),
            };
          }

          const outputTemplate =
            args[args.indexOf("-o") + 1];
          tempDirectory = path.dirname(outputTemplate);
          await fs.writeFile(
            path.join(tempDirectory, "audio.mp3"),
            "small audio"
          );

          return {
            stdout: "",
          };
        },
        transcribe: async () => {
          const error = new Error(
            "OpenAI transcription request failed"
          );
          error.status = 401;
          error.code = "invalid_api_key";
          error.type = "invalid_request_error";
          throw error;
        },
      }),
    /audio transcription could not complete: OpenAI transcription request failed/i
  );

  await assert.rejects(
    () => fs.stat(tempDirectory),
    /ENOENT/
  );
});

test("audio fallback normalizes transcription segments and removes temp files", async () => {
  const logger = createLogger();
  let tempDirectory;

  const result = await transcribeYoutubeAudio({
    url: "https://www.youtube.com/watch?v=abc123def45",
    videoId: "abc123def45",
    logger,
    run: async (command, args) => {
      assert.ok(["yt-dlp", "ffmpeg"].includes(command));

      if (args.includes("--dump-json")) {
        return {
          stdout: JSON.stringify({
            title: "Public video",
            duration: 12,
          }),
        };
      }

      const outputTemplate =
        args[args.indexOf("-o") + 1];
      tempDirectory = path.dirname(outputTemplate);
      await fs.writeFile(
        path.join(tempDirectory, "audio.mp3"),
        "small audio"
      );

      return {
        stdout: "",
      };
    },
    transcribe: async () => ({
      text: "Generated transcript",
      segments: [
        {
          text: "Generated transcript",
          start: 2,
          end: 5,
        },
      ],
    }),
  });

  assert.equal(result.title, "Public video");
  assert.equal(
    result.transcriptSource,
    "audio-transcription"
  );
  assert.deepEqual(result.segments, [
    {
      text: "Generated transcript",
      location: {
        startSeconds: 2,
        endSeconds: 5,
        videoId: "abc123def45",
        url: "https://www.youtube.com/watch?v=abc123def45",
        transcriptSource:
          "audio-transcription",
      },
      metadata: {
        transcriptSource:
          "audio-transcription",
      },
    },
  ]);

  await assert.rejects(
    () => fs.stat(tempDirectory),
    /ENOENT/
  );
  assert.ok(
    logger.logs.some(([, message]) =>
      message.includes(
        "Transcription completed"
      )
    )
  );
});
