"use client";

import { createContext, useContext, type ReactNode } from "react";
import { copy } from "../../../content/copy";
import { CHAPTERS, type Chapter } from "@/lib/chapters";

type Report = { title: string; chapters: readonly Chapter[] };

/** Without a provider (unit tests) every chapter is on and the title is a placeholder. */
const ReportContext = createContext<Report>({ title: copy.nav.report, chapters: CHAPTERS });

/**
 * The report's title and its enabled chapters (`chaptersFor` of the data's flags), computed once in the
 * report layout, so the sidebar, the drawer and the pagers all agree on what exists.
 */
export function ReportProvider({ title, chapters, children }: Report & { children: ReactNode }) {
  return <ReportContext.Provider value={{ title, chapters }}>{children}</ReportContext.Provider>;
}

export function useReport(): Report {
  return useContext(ReportContext);
}
