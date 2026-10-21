import type { OfficeData, PresenceMap } from "./model";

// DEMO FIXTURE for the dev-only /dev/office preview. Generated from supabase/seed.sql so the
// preview matches the seeded demo organization. Never imported by production routes.
export const demoOfficeFixture: OfficeData = {
  "orgName": "Dubai Agency (Demo)",
  "orgIsDemo": true,
  "layoutName": "Main Office (Demo)",
  "scene": {
    "version": 1,
    "placeholder": true,
    "rooms": [
      {
        "department": "development",
        "x": -8,
        "z": -6,
        "width": 10,
        "depth": 8
      },
      {
        "department": "design",
        "x": 4,
        "z": -6,
        "width": 8,
        "depth": 8
      },
      {
        "department": "marketing",
        "x": -8,
        "z": 4,
        "width": 10,
        "depth": 7
      },
      {
        "department": "project-management",
        "x": 4,
        "z": 4,
        "width": 8,
        "depth": 7
      },
      {
        "department": "meeting-room",
        "x": 14,
        "z": -1,
        "width": 7,
        "depth": 9
      }
    ]
  },
  "departments": [
    {
      "slug": "development",
      "sortOrder": 1
    },
    {
      "slug": "design",
      "sortOrder": 2
    },
    {
      "slug": "marketing",
      "sortOrder": 3
    },
    {
      "slug": "project-management",
      "sortOrder": 4
    },
    {
      "slug": "meeting-room",
      "sortOrder": 5
    }
  ],
  "seats": [
    {
      "id": "f5000000-0000-4000-8000-000000000001",
      "label": "DEV-1",
      "departmentSlug": "development",
      "position": {
        "x": -10,
        "y": 0,
        "z": -8,
        "rotation": 0
      },
      "assignedUserId": "a0000000-0000-4000-8000-000000000002"
    },
    {
      "id": "f5000000-0000-4000-8000-000000000002",
      "label": "DEV-2",
      "departmentSlug": "development",
      "position": {
        "x": -8,
        "y": 0,
        "z": -8,
        "rotation": 0
      },
      "assignedUserId": "a0000000-0000-4000-8000-000000000004"
    },
    {
      "id": "f5000000-0000-4000-8000-000000000003",
      "label": "DEV-3",
      "departmentSlug": "development",
      "position": {
        "x": -6,
        "y": 0,
        "z": -8,
        "rotation": 0
      },
      "assignedUserId": "a0000000-0000-4000-8000-000000000011"
    },
    {
      "id": "f5000000-0000-4000-8000-000000000004",
      "label": "DEV-4",
      "departmentSlug": "development",
      "position": {
        "x": -8,
        "y": 0,
        "z": -4,
        "rotation": 180
      },
      "assignedUserId": null
    },
    {
      "id": "f5000000-0000-4000-8000-000000000005",
      "label": "DES-1",
      "departmentSlug": "design",
      "position": {
        "x": 3,
        "y": 0,
        "z": -8,
        "rotation": 0
      },
      "assignedUserId": "a0000000-0000-4000-8000-000000000003"
    },
    {
      "id": "f5000000-0000-4000-8000-000000000006",
      "label": "DES-2",
      "departmentSlug": "design",
      "position": {
        "x": 5,
        "y": 0,
        "z": -8,
        "rotation": 0
      },
      "assignedUserId": "a0000000-0000-4000-8000-000000000006"
    },
    {
      "id": "f5000000-0000-4000-8000-000000000007",
      "label": "DES-3",
      "departmentSlug": "design",
      "position": {
        "x": 4,
        "y": 0,
        "z": -4,
        "rotation": 180
      },
      "assignedUserId": null
    },
    {
      "id": "f5000000-0000-4000-8000-000000000008",
      "label": "MKT-1",
      "departmentSlug": "marketing",
      "position": {
        "x": -10,
        "y": 0,
        "z": 3,
        "rotation": 0
      },
      "assignedUserId": "a0000000-0000-4000-8000-000000000005"
    },
    {
      "id": "f5000000-0000-4000-8000-000000000009",
      "label": "MKT-2",
      "departmentSlug": "marketing",
      "position": {
        "x": -8,
        "y": 0,
        "z": 3,
        "rotation": 0
      },
      "assignedUserId": "a0000000-0000-4000-8000-000000000009"
    },
    {
      "id": "f5000000-0000-4000-8000-000000000010",
      "label": "MKT-3",
      "departmentSlug": "marketing",
      "position": {
        "x": -6,
        "y": 0,
        "z": 6,
        "rotation": 180
      },
      "assignedUserId": null
    },
    {
      "id": "f5000000-0000-4000-8000-000000000011",
      "label": "PM-1",
      "departmentSlug": "project-management",
      "position": {
        "x": 3,
        "y": 0,
        "z": 3,
        "rotation": 0
      },
      "assignedUserId": "a0000000-0000-4000-8000-000000000007"
    },
    {
      "id": "f5000000-0000-4000-8000-000000000012",
      "label": "PM-2",
      "departmentSlug": "project-management",
      "position": {
        "x": 5,
        "y": 0,
        "z": 3,
        "rotation": 0
      },
      "assignedUserId": "a0000000-0000-4000-8000-000000000008"
    },
    {
      "id": "f5000000-0000-4000-8000-000000000013",
      "label": "PM-3",
      "departmentSlug": "project-management",
      "position": {
        "x": 4,
        "y": 0,
        "z": 6,
        "rotation": 180
      },
      "assignedUserId": "a0000000-0000-4000-8000-000000000010"
    },
    {
      "id": "f5000000-0000-4000-8000-000000000014",
      "label": "MTG-1",
      "departmentSlug": "meeting-room",
      "position": {
        "x": 13,
        "y": 0,
        "z": -3,
        "rotation": 90
      },
      "assignedUserId": null
    },
    {
      "id": "f5000000-0000-4000-8000-000000000015",
      "label": "MTG-2",
      "departmentSlug": "meeting-room",
      "position": {
        "x": 13,
        "y": 0,
        "z": 1,
        "rotation": 90
      },
      "assignedUserId": null
    },
    {
      "id": "f5000000-0000-4000-8000-000000000016",
      "label": "MTG-3",
      "departmentSlug": "meeting-room",
      "position": {
        "x": 15,
        "y": 0,
        "z": -3,
        "rotation": 270
      },
      "assignedUserId": null
    },
    {
      "id": "f5000000-0000-4000-8000-000000000017",
      "label": "MTG-4",
      "departmentSlug": "meeting-room",
      "position": {
        "x": 15,
        "y": 0,
        "z": 1,
        "rotation": 270
      },
      "assignedUserId": null
    }
  ],
  "people": [
    {
      "userId": "a0000000-0000-4000-8000-000000000001",
      "displayName": "Demo Admin",
      "title": "Workspace Owner",
      "avatarUrl": null,
      "timezone": "Asia/Dubai",
      "role": "owner",
      "departmentSlug": null,
      "character": null,
      "availability": "online"
    },
    {
      "userId": "a0000000-0000-4000-8000-000000000002",
      "displayName": "Tariq Mansour",
      "title": "VP Engineering",
      "avatarUrl": null,
      "timezone": "Asia/Dubai",
      "role": "admin",
      "departmentSlug": "development",
      "character": "character-male-a",
      "availability": "online"
    },
    {
      "userId": "a0000000-0000-4000-8000-000000000003",
      "displayName": "Sara Al-Hashimi",
      "title": "Lead UI/UX Designer",
      "avatarUrl": null,
      "timezone": "Asia/Dubai",
      "role": "admin",
      "departmentSlug": "design",
      "character": "character-female-a",
      "availability": "online"
    },
    {
      "userId": "a0000000-0000-4000-8000-000000000004",
      "displayName": "Zayd Benali",
      "title": "Senior Full-Stack Engineer",
      "avatarUrl": null,
      "timezone": "Asia/Dubai",
      "role": "member",
      "departmentSlug": "development",
      "character": "character-male-b",
      "availability": "online"
    },
    {
      "userId": "a0000000-0000-4000-8000-000000000005",
      "displayName": "Noor Khalid",
      "title": "Marketing Lead",
      "avatarUrl": null,
      "timezone": "Asia/Dubai",
      "role": "member",
      "departmentSlug": "marketing",
      "character": "character-female-b",
      "availability": "online"
    },
    {
      "userId": "a0000000-0000-4000-8000-000000000006",
      "displayName": "Layla Nour",
      "title": "Product Designer",
      "avatarUrl": null,
      "timezone": "Asia/Dubai",
      "role": "member",
      "departmentSlug": "design",
      "character": "character-female-c",
      "availability": "online"
    },
    {
      "userId": "a0000000-0000-4000-8000-000000000007",
      "displayName": "Hamdan Zayed",
      "title": "Project Manager",
      "avatarUrl": null,
      "timezone": "Asia/Dubai",
      "role": "member",
      "departmentSlug": "project-management",
      "character": "character-male-c",
      "availability": "online"
    },
    {
      "userId": "a0000000-0000-4000-8000-000000000008",
      "displayName": "Nour Merhi",
      "title": "Scrum Master",
      "avatarUrl": null,
      "timezone": "Asia/Dubai",
      "role": "member",
      "departmentSlug": "project-management",
      "character": "character-female-d",
      "availability": "online"
    },
    {
      "userId": "a0000000-0000-4000-8000-000000000009",
      "displayName": "Fatima Rashid",
      "title": "Content Strategist",
      "avatarUrl": null,
      "timezone": "Asia/Dubai",
      "role": "member",
      "departmentSlug": "marketing",
      "character": "character-female-e",
      "availability": "online"
    },
    {
      "userId": "a0000000-0000-4000-8000-000000000010",
      "displayName": "Marcus Sterling",
      "title": "Delivery Director",
      "avatarUrl": null,
      "timezone": "Asia/Dubai",
      "role": "member",
      "departmentSlug": "project-management",
      "character": "character-male-d",
      "availability": "online"
    },
    {
      "userId": "a0000000-0000-4000-8000-000000000011",
      "displayName": "Zaid Chen",
      "title": "Frontend Engineer",
      "avatarUrl": null,
      "timezone": "Asia/Dubai",
      "role": "member",
      "departmentSlug": "development",
      "character": "character-male-e",
      "availability": "online"
    }
  ]
};

// SIMULATED presence for the dev preview only — real presence comes from Supabase Realtime.
export const demoPresenceFixture: PresenceMap = new Map([
  ["a0000000-0000-4000-8000-000000000002", "online"],
  ["a0000000-0000-4000-8000-000000000003", "online"],
  ["a0000000-0000-4000-8000-000000000004", "busy"],
  ["a0000000-0000-4000-8000-000000000006", "online"],
  ["a0000000-0000-4000-8000-000000000007", "dnd"],
  ["a0000000-0000-4000-8000-000000000008", "away"],
  ["a0000000-0000-4000-8000-000000000011", "online"],
]);
