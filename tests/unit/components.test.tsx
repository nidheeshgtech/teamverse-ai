import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, initialsFor } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { PresenceDot } from "@/ui/presence";

describe("initialsFor", () => {
  it.each([
    ["Tariq Mansour", "TM"],
    ["Sara Al-Hashimi", "SA"],
    ["Noor", "N"],
    ["  layla   k  nour ", "LN"],
    ["", ""],
  ])("%s → %s", (name, expected) => expect(initialsFor(name)).toBe(expected));
});

describe("PresenceDot", () => {
  it("is announced with its label", () => {
    render(<PresenceDot status="dnd" label="Do not disturb" />);
    expect(screen.getByRole("img", { name: "Do not disturb" })).toHaveAttribute("data-status", "dnd");
  });

  it("is hidden from assistive tech without a label", () => {
    const { container } = render(<PresenceDot status="online" />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Avatar", () => {
  it("falls back to initials and exposes presence", async () => {
    render(<Avatar name="Tariq Mansour" status="online" statusLabel="Online" />);
    expect(await screen.findByText("TM")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Online" })).toBeInTheDocument();
  });
});

describe("Button", () => {
  it("defaults to type=button so it never submits forms by accident", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "button");
  });
});
