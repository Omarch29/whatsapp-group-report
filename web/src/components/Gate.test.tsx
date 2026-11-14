import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sha256HexSync } from "@/lib/hash";
import { mockReducedMotion } from "@/test/motion";
import { HashScroll } from "./report/HashScroll";
import { Gate } from "./Gate";

const hash = sha256HexSync("moño");

describe("<Gate>", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("hides children until the keyword matches, then persists", async () => {
    const user = userEvent.setup();
    render(
      <Gate hash={hash} title="Los del Parque">
        <p>secreto</p>
      </Gate>,
    );
    expect(screen.queryByText("secreto")).toBeNull();
    await user.type(screen.getByRole("textbox"), "moño");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("secreto")).toBeInTheDocument();
    expect(localStorage.getItem("wgr_gate")).toBe(hash);
  });

  it("shows the error line and keeps children hidden on a wrong word", async () => {
    const user = userEvent.setup();
    render(
      <Gate hash={hash} title="Los del Parque">
        <p>secreto</p>
      </Gate>,
    );
    await user.type(screen.getByRole("textbox"), "otra");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Esa no es.")).toBeInTheDocument();
    expect(screen.queryByText("secreto")).toBeNull();
    expect(localStorage.getItem("wgr_gate")).toBeNull();
  });

  it("renders children right away when the stored hash matches", () => {
    localStorage.setItem("wgr_gate", hash);
    render(
      <Gate hash={hash} title="Los del Parque">
        <p>secreto</p>
      </Gate>,
    );
    expect(screen.getByText("secreto")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("ignores a stored hash from another word", () => {
    localStorage.setItem("wgr_gate", sha256HexSync("vieja"));
    render(
      <Gate hash={hash} title="Los del Parque">
        <p>secreto</p>
      </Gate>,
    );
    expect(screen.queryByText("secreto")).toBeNull();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("keeps the current URL after unlocking", async () => {
    window.history.pushState({}, "", "/p/tomi");
    const user = userEvent.setup();
    render(
      <Gate hash={hash} title="Los del Parque">
        <p>perfil de tomi</p>
      </Gate>,
    );
    await user.type(screen.getByRole("textbox"), "moño");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("perfil de tomi")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/p/tomi");
    window.history.pushState({}, "", "/");
  });

  it("scrolls a shared block link into view once the gate unlocks", async () => {
    window.location.hash = "#muletillas";
    mockReducedMotion(false);
    // jsdom has no scrollIntoView; record which element was scrolled and how.
    const scrolled: { id: string; opts: unknown }[] = [];
    Element.prototype.scrollIntoView = function (this: Element, opts?: boolean | ScrollIntoViewOptions) {
      scrolled.push({ id: this.id, opts });
    };
    const user = userEvent.setup();
    render(
      <Gate hash={hash} title="Los del Parque">
        <HashScroll />
        <section id="muletillas">bloque</section>
      </Gate>,
    );
    expect(scrolled).toEqual([]);
    await user.type(screen.getByRole("textbox"), "moño");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("bloque")).toBeInTheDocument();
    expect(window.location.hash).toBe("#muletillas");
    expect(scrolled).toEqual([{ id: "muletillas", opts: { block: "start", behavior: "smooth" } }]);
    delete (Element.prototype as Partial<Element>).scrollIntoView;
    window.history.pushState({}, "", "/");
  });

  it("jumps to the shared block without smoothing under reduced motion", () => {
    window.location.hash = "#muletillas";
    localStorage.setItem("wgr_gate", hash);
    mockReducedMotion(true);
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <Gate hash={hash} title="Los del Parque">
        <HashScroll />
        <section id="muletillas">bloque</section>
      </Gate>,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "auto" });
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("muletillas"));
    delete (Element.prototype as Partial<Element>).scrollIntoView;
    window.history.pushState({}, "", "/");
  });

  it("shows a verification error when Web Crypto is unavailable", async () => {
    vi.stubGlobal("crypto", {});
    const user = userEvent.setup();
    render(
      <Gate hash={hash} title="Los del Parque">
        <p>secreto</p>
      </Gate>,
    );
    await user.type(screen.getByRole("textbox"), "moño");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("No se pudo verificar.")).toBeInTheDocument();
    expect(screen.queryByText("secreto")).toBeNull();
  });

  it("treats unreadable storage as locked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    render(
      <Gate hash={hash} title="Los del Parque">
        <p>secreto</p>
      </Gate>,
    );
    expect(screen.queryByText("secreto")).toBeNull();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("still unlocks in place when storage refuses the write", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const user = userEvent.setup();
    render(
      <Gate hash={hash} title="Los del Parque">
        <p>secreto</p>
      </Gate>,
    );
    await user.type(screen.getByRole("textbox"), "moño");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("secreto")).toBeInTheDocument();
  });
});
