import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "@/lib/auth/paths";
import { homePathFor, isAdminRole } from "@/lib/auth/roles";
import { generateInviteToken, hashInviteToken, looksLikeInviteToken } from "@/features/invitations/token";
import { createHash } from "node:crypto";

describe("safeNextPath", () => {
  it.each([
    ["/office", "/office"],
    ["/comms?c=1", "/comms?c=1"],
    [null, "/"],
    ["", "/"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["javascript:alert(1)", "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("isPublicPath", () => {
  it("allows sign-in and invite pages only", () => {
    expect(isPublicPath("/sign-in")).toBe(true);
    expect(isPublicPath("/invite/abc")).toBe(true);
    expect(isPublicPath("/office")).toBe(false);
    expect(isPublicPath("/admin")).toBe(false);
    expect(isPublicPath("/sign-in-elsewhere")).toBe(false);
    expect(isPublicPath("/invite")).toBe(false);
  });
});

describe("roles", () => {
  it("routes admins to the office and members to their inbox", () => {
    expect(homePathFor("owner")).toBe("/office");
    expect(homePathFor("admin")).toBe("/office");
    expect(homePathFor("member")).toBe("/comms");
    expect(isAdminRole("member")).toBe(false);
  });
});

describe("invite tokens", () => {
  it("are 256-bit url-safe and unique", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toBe(b);
    expect(looksLikeInviteToken(a)).toBe(true);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
  });

  it("hash to lowercase hex sha-256 (must match the SQL functions)", () => {
    expect(hashInviteToken("abc")).toBe(createHash("sha256").update("abc").digest("hex"));
    expect(hashInviteToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects malformed tokens before hitting the database", () => {
    expect(looksLikeInviteToken("short")).toBe(false);
    expect(looksLikeInviteToken("x".repeat(42) + "!")).toBe(false);
  });
});
