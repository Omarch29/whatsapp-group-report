/** What a language decides about numbers and dates (each copy carries one; see es.ts / en.ts). */
export type LocaleFormat = {
  /** BCP 47 tag for Intl. */
  locale: string;
  dateOrder: "dmy" | "mdy";
  /** Month names, 0 = January. */
  months: readonly string[];
  /** "marzo de 2024" / "March 2024". */
  monthYear: (name: string, year: string) => string;
  /** A formatted number as a percentage: "36,3 %" / "36.3%". */
  percent: (n: string) => string;
};

function isoParts(iso: string, fn: string): [string, string, string] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new Error(`${fn}: not an ISO date: ${JSON.stringify(iso)}`);
  return [m[1]!, m[2]!, m[3]!];
}

/** The number and date formatters of one locale; `web/src/lib/format.ts` binds them to the build's copy. */
export function formatsFor(l: LocaleFormat) {
  // `useGrouping: "always"`: CLDR's Spanish minimum grouping would otherwise print 4860 instead of 4.860.
  const num = new Intl.NumberFormat(l.locale, { useGrouping: "always", maximumFractionDigits: 1 });
  const fmt = (n: number): string => num.format(n);
  const order = (y: string, m: string, d: string) => (l.dateOrder === "dmy" ? `${d}/${m}/${y}` : `${m}/${d}/${y}`);
  return {
    /** 12345 -> "12.345" / "12,345"; 36.3 -> "36,3" / "36.3". */
    fmt,
    /** "2020-12-22" or "2020-12-22T14:54:36" -> "22/12/2020" / "12/22/2020" (no timezone shifts). */
    fmtDate(iso: string): string {
      const [y, m, d] = isoParts(iso, "fmtDate");
      return order(y, m, d);
    },
    /** "2023-09-01" -> "1/9/2023" / "9/1/2023": compact, for titles and axis labels. */
    fmtShortDate(iso: string): string {
      const [y, m, d] = isoParts(iso, "fmtShortDate");
      return order(y, String(Number(m)), String(Number(d)));
    },
    /** 0.032 -> "3,2 %" / "3.2%". */
    fmtShare: (share: number): string => l.percent(fmt(share * 100)),
    /** 3.2 -> "3,2 h" / "3.2 h". */
    fmtHours: (h: number): string => `${fmt(h)} h`,
    /** "2024-03" -> "marzo de 2024" / "March 2024". */
    fmtMonth(ym: string): string {
      const m = /^(\d{4})-(\d{2})$/.exec(ym);
      const name = m ? l.months[Number(m[2]) - 1] : undefined;
      if (!m || !name) throw new Error(`fmtMonth: not a YYYY-MM month: ${JSON.stringify(ym)}`);
      return l.monthYear(name, m[1]!);
    },
    /** Seconds in their natural unit: 1.8 -> "1,8 s", 10 -> "10 s", 120 -> "2 min", 90 -> "1,5 min". */
    fmtSeconds: (sec: number): string => (sec < 60 ? `${fmt(sec)} s` : `${fmt(sec / 60)} min`),
  };
}
