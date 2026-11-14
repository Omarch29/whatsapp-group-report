import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAPTER_IDS, CHAPTER_PAGES } from "@/chapters";
import { chapterById } from "@/lib/chapters";
import { mockReducedMotion } from "@/test/motion";
import Home from "./page";

afterEach(() => vi.unstubAllGlobals());

// Chapter routes against the real web/data files (server components rendered as plain async functions).
describe("chapter routes", () => {
  it("every chapter route renders its blocks' ids, each with its «Copiar link»", async () => {
    mockReducedMotion(true);
    for (const id of CHAPTER_IDS) {
      const { container, unmount } = render(await CHAPTER_PAGES[id]());
      for (const b of chapterById(id).blocks) {
        expect(container.querySelector(`#${b.id}[data-block]`), `${id}#${b.id}`).not.toBeNull();
        const share = container.querySelector(`button[data-copy-link="${b.id}"]`);
        expect(share, `${id}#${b.id} «Copiar link»`).toHaveTextContent("Copiar link");
      }
      unmount();
    }
  });

  it("the v1 chapters state their criterion beside the chart", async () => {
    mockReducedMotion(true);
    const cases: [keyof typeof CHAPTER_PAGES, string, string][] = [
      ["carrera", "race", "Mensajes acumulados por mes."],
      ["horas", "heatmap", "Mensajes por hora y día de la semana."],
      ["parejas", "graph", "Respuestas en menos de 10 minutos entre dos personas."],
      ["salidas", "door", "Reingresos detectados en los mensajes de sistema."],
      ["eventos", "rail", "Días en que el grupo volvió a nombrar el evento."],
      ["records", "length", "Caracteres por mensaje de texto."],
      ["records", "per-day", "Mensajes de todo el grupo en un mismo día."],
      ["records", "poll", "Votos sumados de todas las opciones."],
      ["records", "night", "entre las 3 y las 6 de la mañana"],
      ["diccionario", "cloud", "Palabras nacidas en el grupo, por cantidad de usos."],
    ];
    for (const [chapter, id, text] of cases) {
      const { container, unmount } = render(await CHAPTER_PAGES[chapter]());
      expect(container.querySelector(`#${id} [data-criterion]`), id).toHaveTextContent(text);
      unmount();
    }
  });

  it("/ links to the first chapter", async () => {
    mockReducedMotion(true);
    const { container } = render(await Home());
    expect(screen.getByRole("link", { name: "Empezar" })).toHaveAttribute("href", "/censo/");
    expect(container.querySelector("#intro[data-block]")).not.toBeNull();
  });
});
