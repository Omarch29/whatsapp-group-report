import { copy } from "../../content/copy";
import { formatsFor } from "../../i18n/formats";

// Numbers and dates in the build's locale (copy.locale, copy.dateOrder, copy.months): es-AR or en-US.
const f = formatsFor(copy);

/** 12345 -> "12.345" (es) / "12,345" (en). */
export const fmt = f.fmt;
/** "2020-12-22" -> "22/12/2020" (es) / "12/22/2020" (en). */
export const fmtDate = f.fmtDate;
/** "2023-09-01" -> "1/9/2023" (es) / "9/1/2023" (en). */
export const fmtShortDate = f.fmtShortDate;
/** 0.032 -> "3,2 %" (es) / "3.2%" (en). */
export const fmtShare = f.fmtShare;
/** 3.2 -> "3,2 h" (es) / "3.2 h" (en). */
export const fmtHours = f.fmtHours;
/** "2024-03" -> "marzo de 2024" (es) / "March 2024" (en). */
export const fmtMonth = f.fmtMonth;
/** 1.8 -> "1,8 s"; 120 -> "2 min". */
export const fmtSeconds = f.fmtSeconds;
