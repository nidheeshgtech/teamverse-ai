import { describe, expect, it } from "vitest";
import { demoOfficeFixture, demoPresenceFixture } from "@/features/office/fixture";
import { buildOccupants, countByDepartment, filterOccupants, officeDataSchema, presenceSummary, sceneBounds } from "@/features/office/model";
import { presenceTopic, statusesFromPresenceState } from "@/features/presence/presence-state";

describe("office model", () => {
  it("the demo fixture satisfies the server schema", () => {
    expect(() => officeDataSchema.parse(demoOfficeFixture)).not.toThrow();
  });

  it("treats anyone not connected as offline, never as their saved availability", () => {
    const occupants = buildOccupants(demoOfficeFixture, new Map());
    expect(occupants.every((o) => o.status === "offline")).toBe(true);
    expect(presenceSummary(occupants)).toEqual({ online: 0, busy: 0, away: 0, dnd: 0 });
  });

  it("joins people to their assigned seats", () => {
    const tariq = buildOccupants(demoOfficeFixture, demoPresenceFixture).find((o) => o.displayName === "Tariq Mansour");
    expect(tariq?.seat?.label).toBe("DEV-1");
    expect(tariq?.status).toBe("online");
    const admin = buildOccupants(demoOfficeFixture, demoPresenceFixture).find((o) => o.displayName === "Demo Admin");
    expect(admin?.seat).toBeNull();
  });

  it("filters by department and by name, title or desk (case-insensitive)", () => {
    const occupants = buildOccupants(demoOfficeFixture, demoPresenceFixture);
    expect(filterOccupants(occupants, "development", "").map((o) => o.displayName)).toEqual(["Tariq Mansour", "Zaid Chen", "Zayd Benali"]);
    expect(filterOccupants(occupants, null, "sara").map((o) => o.displayName)).toEqual(["Sara Al-Hashimi"]);
    expect(filterOccupants(occupants, null, "pm-2").map((o) => o.displayName)).toEqual(["Nour Merhi"]);
    expect(filterOccupants(occupants, null, "  VP engineering ").map((o) => o.displayName)).toEqual(["Tariq Mansour"]);
    expect(filterOccupants(occupants, "design", "tariq")).toEqual([]);
  });

  it("counts people per department and summarises live presence", () => {
    const occupants = buildOccupants(demoOfficeFixture, demoPresenceFixture);
    expect(countByDepartment(occupants).get("project-management")).toBe(3);
    expect(presenceSummary(occupants)).toEqual({ online: 4, busy: 1, away: 1, dnd: 1 });
  });

  it("computes scene bounds from room centres and sizes", () => {
    const b = sceneBounds(demoOfficeFixture.scene.rooms);
    expect(b.minX).toBe(-13);
    expect(b.maxX).toBe(17.5);
    expect(b.minZ).toBe(-10);
    expect(b.maxZ).toBe(7.5);
    expect(sceneBounds([]).width).toBeGreaterThan(0);
  });
});

describe("presence state", () => {
  it("uses the latest entry per user and drops invalid or offline payloads", () => {
    const map = statusesFromPresenceState({
      a: [{ status: "online" }, { status: "busy" }],
      b: [{ status: "offline" }],
      c: [{ status: "watching-you" }],
      d: [{}],
      e: [{ status: "dnd" }],
    });
    expect([...map]).toEqual([
      ["a", "busy"],
      ["e", "dnd"],
    ]);
  });

  it("namespaces the private channel by organization", () => {
    expect(presenceTopic("d0000000-0000-4000-8000-000000000001")).toBe("org:d0000000-0000-4000-8000-000000000001:presence");
  });
});
