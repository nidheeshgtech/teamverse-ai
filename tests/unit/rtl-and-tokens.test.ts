import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(join(root, "src")).filter((f) => !f.endsWith("tokens.css"));

describe("RTL-ready rules", () => {
  // Physical-direction utilities; logical equivalents are ms/me/ps/pe/start/end/text-start/text-end.
  const physical =
    /(?<![\w-])-?(ml|mr|pl|pr|left|right|text-left|text-right|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|border-l|border-r|scroll-ml|scroll-mr)-[\w[]/;
  const physicalCss = /(margin|padding)-(left|right)\s*:|(?<![-\w])(left|right)\s*:|text-align:\s*(left|right)/;

  it.each(files)("%s uses logical properties only", (file) => {
    const text = readFileSync(file, "utf8");
    const offenders = text.split("\n").filter((line) => (file.endsWith(".css") ? physicalCss.test(line) : physical.test(line)));
    expect(offenders).toEqual([]);
  });
});

describe("design tokens", () => {
  const design = parse(readFileSync(join(root, "design/DESIGN.md"), "utf8").match(/^---\n([\s\S]*?)\n---/)![1]);
  const tokensCss = readFileSync(join(root, "src/styles/tokens.css"), "utf8");

  it("exposes every DESIGN.md color as a CSS variable and Tailwind color", () => {
    for (const [name, value] of Object.entries<string>(design.colors)) {
      expect(tokensCss).toContain(`--tv-color-${name}: ${value};`);
      expect(tokensCss).toContain(`--color-${name}: var(--tv-color-${name});`);
    }
  });

  it("exposes every type style as a utility", () => {
    for (const name of Object.keys(design.typography)) expect(tokensCss).toContain(`@utility type-${name} {`);
  });

  it("uses the space-* spacing tokens (bare sm/md/lg collide with Tailwind sizes)", () => {
    const bare = /(?<![\w-])-?(p|px|py|ps|pe|pt|pb|m|mx|my|ms|me|mt|mb|gap|gap-x|gap-y|inset|start|end|top|bottom)-(2xs|xs|sm|md|lg|xl|2xl|3xl)(?![\w-])/;
    const offenders = files
      .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
      .flatMap((f) => readFileSync(f, "utf8").split("\n").filter((l) => bare.test(l)).map((l) => `${f}: ${l.trim()}`));
    expect(offenders).toEqual([]);
  });

  it("keeps components free of raw hex colors", () => {
    const hex = /#[0-9a-fA-F]{3,8}\b/;
    const offenders = files
      .filter((f) => f.endsWith(".tsx"))
      .flatMap((f) => readFileSync(f, "utf8").split("\n").filter((l) => hex.test(l) && !l.includes("themeColor")).map((l) => `${f}: ${l.trim()}`));
    expect(offenders).toEqual([]);
  });
});
