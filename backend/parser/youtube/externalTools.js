import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runTool(
  command,
  args,
  options = {}
) {
  try {
    const result = await execFileAsync(
      command,
      args,
      {
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
        ...options,
      }
    );

    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const wrappedError = new Error(
      error.stderr?.trim() ||
        error.message ||
        `${command} failed`
    );
    wrappedError.code = error.code;
    wrappedError.stdout = error.stdout;
    wrappedError.stderr = error.stderr;
    throw wrappedError;
  }
}

export async function checkToolAvailable(
  command,
  args = ["--version"]
) {
  try {
    await runTool(command, args, {
      timeout: 5000,
    });
    return true;
  } catch (error) {
    return false;
  }
}

export async function checkYoutubeFallbackTools({
  logger = console,
  failOnMissing = false,
} = {}) {
  const checks = await Promise.all([
    checkToolAvailable("yt-dlp"),
    checkToolAvailable("ffmpeg"),
  ]);

  const missing = [];

  if (!checks[0]) {
    missing.push("yt-dlp");
  }

  if (!checks[1]) {
    missing.push("ffmpeg");
  }

  if (missing.length > 0) {
    const message = `YouTube audio fallback dependency missing: ${missing.join(", ")}`;

    if (failOnMissing) {
      throw new Error(message);
    }

    logger.warn(message);
  } else {
    logger.log(
      "YouTube audio fallback dependencies available: yt-dlp, ffmpeg"
    );
  }

  return {
    ok: missing.length === 0,
    missing,
  };
}
