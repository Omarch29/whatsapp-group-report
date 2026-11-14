"use client";

import { animate } from "motion";
import { Fragment, useEffect, useState } from "react";
import { copy } from "../../content/copy";
import { fmt } from "@/lib/format";
import { useReducedMotion } from "@/lib/motion";

type Props = {
  value: number;
  /** Seconds. */
  duration?: number;
  format?: (n: number) => string;
  testId?: string;
};

/** Power3-out. */
const EASE = [0.22, 1, 0.36, 1] as const;

/** The build locale's thousands separator: "." (es-AR) or "," (en-US). */
const GROUP =
  new Intl.NumberFormat(copy.locale, { useGrouping: "always" }).formatToParts(1000).find((p) => p.type === "group")
    ?.value ?? "";

/** Wraps every thousands separator in a rose `<b>` (never the decimal mark). */
function withSeparators(text: string) {
  if (!GROUP) return text;
  return text.split(GROUP).flatMap((part, i) => [
    ...(i > 0
      ? [
          <b key={`s${i}`} className="sep">
            {GROUP}
          </b>,
        ]
      : []),
    <Fragment key={i}>{part}</Fragment>,
  ]);
}

/** Counts 0 -> value on mount; under reduced motion shows the final value at once. */
export function Ticker({ value, duration = 2.6, format = fmt, testId }: Props) {
  const reduced = useReducedMotion();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setCurrent(Number.isInteger(value) ? Math.round(v) : v),
    });
    return () => controls.stop();
  }, [reduced, value, duration]);

  return (
    <span data-testid={testId} role="img" aria-label={format(value)}>
      {withSeparators(format(reduced ? value : current))}
    </span>
  );
}
