import { describe, expect, it } from "vitest";
import {
  formatLocationLabel,
  formatSeconds,
  formatSourceLocation,
} from "./formatSourceLocation";

describe("formatSourceLocation", () => {
  it("never renders object-like location values", () => {
    const label = formatLocationLabel(
      {
        start: { offset: {} },
        end: { nested: true },
      },
      "WEBSITE",
    );

    expect(label).not.toContain("[object Object]");
    expect(label).toBe("Relevant passage from this source");
  });

  it("formats website domain and section", () => {
    expect(
      formatLocationLabel(
        {
          url: "https://www.chaicode.com/",
          headingPath: ["Home", "Cohorts"],
        },
        "WEBSITE",
      ),
    ).toBe("chaicode.com · Cohorts");
  });

  it("formats YouTube timestamps", () => {
    expect(formatSeconds(75.2)).toBe("1:15");
    expect(
      formatSourceLocation(
        {
          startSeconds: 75.2,
          endSeconds: 104.6,
        },
        "YOUTUBE",
      ),
    ).toEqual(["1:15-1:44"]);
  });

  it("formats PDF pages", () => {
    expect(formatLocationLabel({ pageNumber: 4 }, "PDF")).toBe("Page 4");
    expect(formatLocationLabel({ pageStart: 3, pageEnd: 5 }, "PDF")).toBe("Pages 3-5");
  });
});
