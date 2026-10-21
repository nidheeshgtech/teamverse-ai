import { z } from "zod";
import { roles } from "@/lib/auth/roles";
import { presenceStatuses, type PresenceStatus } from "@/ui/presence";

// ---------- Schemas (validated at the server boundary) ----------

export const roomSchema = z.object({
  department: z.string(),
  /** Room centre on the floor plane, in scene metres. */
  x: z.number(),
  z: z.number(),
  width: z.number().positive(),
  depth: z.number().positive(),
});

export const sceneSchema = z.object({
  version: z.literal(1),
  /** True while the scene is primitive geometry awaiting final 3D assets. */
  placeholder: z.boolean().default(true),
  rooms: z.array(roomSchema),
});

export const seatSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  departmentSlug: z.string().nullable(),
  position: z.object({ x: z.number(), y: z.number().default(0), z: z.number(), rotation: z.number().default(0) }),
  assignedUserId: z.uuid().nullable(),
});

export const personSchema = z.object({
  userId: z.uuid(),
  displayName: z.string(),
  title: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  timezone: z.string(),
  role: z.enum(roles),
  departmentSlug: z.string().nullable(),
  /** The availability the person chose; only shown while they are actually connected. */
  availability: z.enum(presenceStatuses),
});

export const officeDataSchema = z.object({
  orgName: z.string(),
  orgIsDemo: z.boolean(),
  layoutName: z.string(),
  scene: sceneSchema,
  departments: z.array(z.object({ slug: z.string(), sortOrder: z.number() })),
  seats: z.array(seatSchema),
  people: z.array(personSchema),
});

export type Room = z.infer<typeof roomSchema>;
export type Seat = z.infer<typeof seatSchema>;
export type Person = z.infer<typeof personSchema>;
export type OfficeData = z.infer<typeof officeDataSchema>;

/** userId → live status. Missing means not connected (offline). */
export type PresenceMap = ReadonlyMap<string, PresenceStatus>;

export type Occupant = Person & { seat: Seat | null; status: PresenceStatus };

// ---------- Pure helpers ----------

export function buildOccupants(data: Pick<OfficeData, "people" | "seats">, presence: PresenceMap): Occupant[] {
  const seatByUser = new Map(data.seats.filter((s) => s.assignedUserId).map((s) => [s.assignedUserId!, s]));
  return data.people
    .map((p) => ({ ...p, seat: seatByUser.get(p.userId) ?? null, status: presence.get(p.userId) ?? ("offline" as const) }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function filterOccupants(occupants: Occupant[], department: string | null, query: string): Occupant[] {
  const q = query.trim().toLocaleLowerCase();
  return occupants.filter((o) => {
    if (department && o.departmentSlug !== department) return false;
    if (!q) return true;
    return [o.displayName, o.title ?? "", o.seat?.label ?? ""].some((field) => field.toLocaleLowerCase().includes(q));
  });
}

export function countByDepartment(occupants: Occupant[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const o of occupants) if (o.departmentSlug) counts.set(o.departmentSlug, (counts.get(o.departmentSlug) ?? 0) + 1);
  return counts;
}

/** Counts only people who are connected; "offline" is never counted as present. */
export function presenceSummary(occupants: Occupant[]) {
  const summary = { online: 0, busy: 0, away: 0, dnd: 0 };
  for (const o of occupants) if (o.status !== "offline") summary[o.status] += 1;
  return summary;
}

export function sceneBounds(rooms: Room[]) {
  if (rooms.length === 0) return { minX: -10, maxX: 10, minZ: -10, maxZ: 10, centerX: 0, centerZ: 0, width: 20, depth: 20 };
  const minX = Math.min(...rooms.map((r) => r.x - r.width / 2));
  const maxX = Math.max(...rooms.map((r) => r.x + r.width / 2));
  const minZ = Math.min(...rooms.map((r) => r.z - r.depth / 2));
  const maxZ = Math.max(...rooms.map((r) => r.z + r.depth / 2));
  return { minX, maxX, minZ, maxZ, centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2, width: maxX - minX, depth: maxZ - minZ };
}
