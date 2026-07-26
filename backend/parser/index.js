import { SOURCE_TYPES } from "./parser.types.js";

import { parseText } from "./text/parseText.js";
import { parseVtt } from "./vtt/parseVtt.js";
import { parsePdf } from "./pdf/parsePdf.js";
import { parseDocx } from "./docx/parseDocx.js";
import { parseYoutube } from "./youtube/parseYoutube.js";
import { parseWebsite } from "./website/parseWebsite.js";

/**
 * Flow: Source type → select matching parser → return standard parser result.
 */
export async function parseSource(source) {
  if (!source?.sourceType) {
    throw new Error("sourceType is required");
  }

  switch (source.sourceType) {
    case SOURCE_TYPES.TEXT:
      return parseText(source);

    case SOURCE_TYPES.VTT:
      return parseVtt(source);

    case SOURCE_TYPES.PDF:
      return parsePdf(source);

    case SOURCE_TYPES.DOCX:
      return parseDocx(source);

    case SOURCE_TYPES.YOUTUBE:
      return parseYoutube(source);

    case SOURCE_TYPES.WEBSITE:
      return parseWebsite(source);

    default:
      throw new Error(
        `Unsupported source type: ${source.sourceType}`
      );
  }
}

export { SOURCE_TYPES };