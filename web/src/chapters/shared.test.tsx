import { describe, expect, it } from "vitest";
import { copyFor } from "../../i18n";
import { heatPeak } from "./shared";

describe("heatPeak", () => {
  // facts.peakDow is the pipeline's singular day name (scripts/wa/lang/{es,en}.py DOW), in the report's language.
  it.each([
    ["es", "sábado", "El pico: los sábados a las 22 h."],
    ["es", "viernes", "El pico: los viernes a las 22 h."],
    ["en", "Saturday", "The peak: Saturdays at 22:00."],
    ["en", "Friday", "The peak: Fridays at 22:00."],
  ] as const)("%s %s", (lang, peakDow, line) => {
    expect(heatPeak({ peakDow, peakHour: 22 }, copyFor(lang))).toBe(line);
  });

  it("keeps the day as given when it is not one of the copy's day names", () => {
    expect(heatPeak({ peakDow: "Samstag", peakHour: 9 }, copyFor("en"))).toBe("The peak: Samstag at 9:00.");
  });
});
