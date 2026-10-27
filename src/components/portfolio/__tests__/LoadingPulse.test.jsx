import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { LoadingPulse } from "../LoadingPulse";

const STATEMENTS = ["Gathering leads…", "Matching opportunities…", "Working out the rate…"];

const bar = () => document.querySelector("[aria-hidden='true'] > div");
const width = () => parseFloat(bar().style.width);

describe("LoadingPulse", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts on the first statement", () => {
    render(<LoadingPulse statements={STATEMENTS} />);
    expect(screen.getByText(STATEMENTS[0])).toBeInTheDocument();
  });

  it("moves through the statements as the wait goes on", () => {
    render(<LoadingPulse statements={STATEMENTS} interval={1000} />);

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(STATEMENTS[1])).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(STATEMENTS[2])).toBeInTheDocument();
  });

  it("settles on the last statement rather than looping", () => {
    // A list that cycles back to the top reads as stuck.
    render(<LoadingPulse statements={STATEMENTS} interval={1000} />);

    // Each step schedules the next, so the timers need flushing one at a time
    // rather than in a single long jump.
    for (let i = 0; i < 10; i += 1) act(() => vi.advanceTimersByTime(1000));

    expect(screen.getByText(STATEMENTS[2])).toBeInTheDocument();
    expect(screen.queryByText(STATEMENTS[0])).not.toBeInTheDocument();
  });

  it("advances the bar by a shrinking amount", () => {
    render(<LoadingPulse statements={STATEMENTS} interval={1000} />);
    const first = width();

    act(() => vi.advanceTimersByTime(1000));
    const second = width();
    act(() => vi.advanceTimersByTime(1000));
    const third = width();

    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
    // Decelerating, so each step adds less than the one before it.
    expect(third - second).toBeLessThan(second - first);
  });

  it("never fills the bar — no endpoint here reports real progress", () => {
    render(<LoadingPulse statements={STATEMENTS} interval={1000} />);

    for (let i = 0; i < 60; i += 1) act(() => vi.advanceTimersByTime(1000));

    expect(width()).toBeLessThan(100);
  });

  it("announces itself politely rather than trapping focus", () => {
    render(<LoadingPulse statements={STATEMENTS} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});
