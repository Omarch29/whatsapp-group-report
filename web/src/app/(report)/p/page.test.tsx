import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PeopleIndex } from "@/components/PeopleIndex";
import { PersonHeader } from "@/components/PersonHeader";
import { colorFor } from "@/lib/colors";
import { fx } from "@/test/fixtures";
import { generateStaticParams } from "./[slug]/page";

const { people } = fx.global;
const tomi = people.find((p) => p.slug === "tomi")!;

describe("profile pages", () => {
  it("generateStaticParams lists only real people", async () => {
    const p = await generateStaticParams();
    expect(p.map((x) => x.slug)).not.toContain("resto");
    expect(p.map((x) => x.slug).sort()).toEqual(["ana", "bruno", "caro", "dani", "flor", "juli", "lucas", "nico", "tomi"]);
  });

  it("PeopleIndex links every person with name and nick", () => {
    render(<PeopleIndex people={people} nicknames={fx.nicknames} />);
    expect(screen.getByRole("heading", { level: 2, name: "Uno por uno" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tomi.*Tomate/ })).toHaveAttribute("href", "/p/tomi/");
    expect(screen.getByRole("link", { name: /Bruno.*El Brujo/ })).toHaveAttribute("href", "/p/bruno/");
    expect(screen.getByRole("link", { name: /Ana.*La Capitana/ })).toHaveAttribute("href", "/p/ana/");
  });

  it("PeopleIndex excludes resto", () => {
    render(<PeopleIndex people={people} nicknames={fx.nicknames} />);
    expect(screen.getAllByRole("link")).toHaveLength(people.length - 1);
    expect(screen.queryByRole("link", { name: /Resto/ })).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/p/resto/"]')).toBeNull();
  });

  it("PersonHeader shows name, nick and back link", () => {
    render(<PersonHeader person={tomi} nick="Tomate" />);
    expect(screen.getByRole("heading", { level: 1, name: "Tomi" })).toBeInTheDocument();
    expect(screen.getByText("Tomate")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al grupo" })).toHaveAttribute("href", "/");
    expect(screen.getByTestId("person-dot")).toHaveStyle({ background: colorFor(tomi.colorIndex) });
  });

  it("PersonHeader omits the nick line when there is none", () => {
    const { container } = render(<PersonHeader person={{ ...tomi, name: "Caro" }} />);
    const header = container.firstElementChild as HTMLElement;
    expect(within(header).getByRole("heading", { level: 1, name: "Caro" })).toBeInTheDocument();
    expect(header.querySelector("[data-nick]")).toBeNull();
  });
});
