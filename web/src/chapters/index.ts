import type { ReactElement } from "react";
import Carrera from "./carrera";
import Censo from "./censo";
import Conclusion from "./conclusion";
import Diccionario from "./diccionario";
import Emojis from "./emojis";
import Encuestas from "./encuestas";
import Eventos from "./eventos";
import Horas from "./horas";
import Lenguaje from "./lenguaje";
import Menciones from "./menciones";
import Multimedia from "./multimedia";
import Parejas from "./parejas";
import Personas from "./personas";
import Premios from "./premios";
import Records from "./records";
import Ritmo from "./ritmo";
import Salidas from "./salidas";

/**
 * The chapters after the introduction, in reading order. An id is the chapter's Spanish slug and never changes:
 * code and data name chapters by id, the public URL segment comes from the build's copy (`chapterHref`).
 */
export const CHAPTER_IDS = [
  "censo",
  "carrera",
  "horas",
  "parejas",
  "lenguaje",
  "multimedia",
  "emojis",
  "encuestas",
  "ritmo",
  "menciones",
  "salidas",
  "eventos",
  "records",
  "diccionario",
  "premios",
  "personas",
  "conclusion",
] as const;

/** A chapter id, or "" for the introduction (the root, "/"). */
export type ChapterId = (typeof CHAPTER_IDS)[number] | "";

/** Each chapter's page body (a server component), served by app/(report)/[chapter]/. */
export const CHAPTER_PAGES: Record<Exclude<ChapterId, "">, () => Promise<ReactElement>> = {
  censo: Censo,
  carrera: Carrera,
  horas: Horas,
  parejas: Parejas,
  lenguaje: Lenguaje,
  multimedia: Multimedia,
  emojis: Emojis,
  encuestas: Encuestas,
  ritmo: Ritmo,
  menciones: Menciones,
  salidas: Salidas,
  eventos: Eventos,
  records: Records,
  diccionario: Diccionario,
  premios: Premios,
  personas: Personas,
  conclusion: Conclusion,
};
