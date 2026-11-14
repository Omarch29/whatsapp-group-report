import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fx } from "@/test/fixtures";
import { mockReducedMotion } from "@/test/motion";
import { RecordPair } from "./RecordPair";

afterEach(() => vi.unstubAllGlobals());

describe("<RecordPair>", () => {
  it("formats the record date, or shows whenLabel instead when given", () => {
    mockReducedMotion(true);
    const { unmount } = render(
      <RecordPair label="L" record={{ value: 5, who: "tomi", when: "2024-03-02" }} people={fx.global.people} />,
    );
    expect(screen.getByText("Tomi, 02/03/2024")).toBeInTheDocument();
    unmount();
    render(
      <RecordPair
        label="L"
        record={{ value: 5, who: "tomi", when: "2024-01-01", whenLabel: "en 2024" }}
        people={fx.global.people}
      />,
    );
    expect(screen.getByText("Tomi, en 2024")).toBeInTheDocument();
  });

  it("starts the caption at the date for a record of the whole group (no who)", () => {
    mockReducedMotion(true);
    render(<RecordPair label="L" record={{ value: 17, when: "2025-02-15" }} caption="entre todos" people={fx.global.people} />);
    expect(screen.getByText("15/02/2025")).toBeInTheDocument();
    expect(screen.getByText("· entre todos")).toBeInTheDocument();
  });
});
