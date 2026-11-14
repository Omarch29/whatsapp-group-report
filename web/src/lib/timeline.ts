// Layout of the Censo timeline rail: columns of same-day milestones on a time axis that
// keeps date order and real gaps, but pushes a column right when it would overlap the last.

type Dated = { when: string };

export type TimelineOptions = {
  /** Column (chip) width in px. */
  col: number;
  /** Minimum horizontal space between columns in px. */
  gap: number;
  /** Scale where nothing is pushed: px per day. */
  pxPerDay: number;
  /** Milestones per column; a busier day continues in the next column. */
  maxStack: number;
  /** Left and right padding of the track in px. */
  pad: number;
};

export type TimelineColumn = {
  x: number;
  /** "YYYY-MM-DD" of its milestones. */
  day: string;
  /** First column of its day (carries the date label). */
  first: boolean;
  /** Indexes into the input items, in input order. */
  items: number[];
};

export type TimelineLayout = {
  columns: TimelineColumn[];
  /** Column and stack position (0 = nearest the axis) of each input item. */
  slots: { column: number; stack: number }[];
  /** 1 January of every year after the first, placed in the gaps between columns. */
  ticks: { label: string; x: number }[];
  width: number;
  /** Monotone (day, x) anchors of the rail's time axis; see `xForDay` and `dayForX`. */
  points: [number, number][];
};

const DAY_MS = 86_400_000;
const utc = (iso: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new Error(`not an ISO date: ${JSON.stringify(iso)}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

/** Whole days from `from` to the calendar day of `iso` (time of day ignored). */
export function dayIndex(iso: string, from: string): number {
  return Math.round((utc(iso) - utc(from)) / DAY_MS);
}

/** Items must be sorted by `when` (census.json is). */
export function layoutTimeline(
  items: readonly Dated[],
  period: { from: string; to: string },
  { col, gap, pxPerDay, maxStack, pad }: TimelineOptions,
): TimelineLayout {
  const columns: TimelineColumn[] = [];
  const slots: TimelineLayout["slots"] = [];
  items.forEach((it, i) => {
    const day = it.when.slice(0, 10);
    const last = columns.at(-1);
    if (last && last.day === day && last.items.length < maxStack) {
      slots.push({ column: columns.length - 1, stack: last.items.length });
      last.items.push(i);
      return;
    }
    const byDate = pad + Math.max(0, dayIndex(day, period.from)) * pxPerDay;
    const x = last ? Math.max(byDate, last.x + col + gap) : byDate;
    columns.push({ x, day, first: last?.day !== day, items: [i] });
    slots.push({ column: columns.length - 1, stack: 0 });
  });

  // Monotone day -> x map through the gaps: each day spans [its first column, the end of its last).
  const total = Math.max(0, dayIndex(period.to, period.from)) + 1;
  const points: [number, number][] = [[0, pad]];
  for (const c of columns) {
    const d = Math.max(0, dayIndex(c.day, period.from));
    if (c.first) points.push([d, c.x]);
    const end: [number, number] = [d + 1, c.x + col];
    const prev = points.at(-1)!;
    if (prev[0] === end[0]) points[points.length - 1] = end;
    else points.push(end);
  }
  const lastX = points.at(-1)![1];
  const endX = Math.max(lastX + gap, pad + total * pxPerDay);
  points.push([Math.max(total, points.at(-1)![0] + 1), endX]);
  const xAt = (d: number) => xForDay(points, d);

  const ticks: TimelineLayout["ticks"] = [];
  const y0 = Number(period.from.slice(0, 4));
  const y1 = Number(period.to.slice(0, 4));
  for (let y = y0 + 1; y <= y1; y++) {
    ticks.push({ label: String(y), x: xAt(dayIndex(`${y}-01-01`, period.from)) });
  }

  return { columns, slots, ticks, width: endX + pad, points };
}

/** Piecewise-linear lookup through monotone [a, b] anchors (a non-decreasing). */
function lerpThrough(points: readonly [number, number][], v: number, from: 0 | 1): number {
  const to = from === 0 ? 1 : 0;
  const first = points[0];
  if (!first) return 0;
  if (v <= first[from]) return first[to];
  for (let k = 1; k < points.length; k++) {
    const p0 = points[k - 1]!;
    const p1 = points[k]!;
    if (v <= p1[from]) {
      const span = p1[from] - p0[from];
      return span === 0 ? p1[to] : p0[to] + ((v - p0[from]) / span) * (p1[to] - p0[to]);
    }
  }
  return points.at(-1)![to];
}

/** Rail x of a day index (between columns it interpolates through the gaps). */
export function xForDay(points: readonly [number, number][], day: number): number {
  return lerpThrough(points, day, 0);
}

/** Day index at a rail x: the inverse of `xForDay`, used to map the visible rail onto the overview. */
export function dayForX(points: readonly [number, number][], x: number): number {
  return lerpThrough(points, x, 1);
}
