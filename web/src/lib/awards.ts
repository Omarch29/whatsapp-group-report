import type { Award, AwardsData } from "./schema";

// Shared by the profile page (lede) and the PersonAwards list; kept out of "use client" modules
// so the server page gets the function, not a client reference.

/** The awards `slug` won and, apart, the ones where they were a finalist (a win is never listed twice). */
export function personAwards(awards: AwardsData, slug: string): { won: Award[]; finalist: Award[] } {
  const won = awards.filter((a) => a.winner?.slug === slug);
  const finalist = awards.filter((a) => a.winner?.slug !== slug && a.runnersUp.some((r) => r.slug === slug));
  return { won, finalist };
}
