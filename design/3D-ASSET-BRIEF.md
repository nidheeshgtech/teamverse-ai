# 3D asset brief — TeamVerse AI virtual office

For the 3D artist producing the final office. The current scene uses free CC0 placeholder models
(Kenney) and is labelled "Placeholder 3D" in the app until these assets arrive.
Art direction: the product owner's reference render (warm modern office, evening light, glass
rooms with warm LED edges, polished stone floor, plants, seated people with floating name tags).

## How the scene is built (please keep this in mind)
- **Data-driven layout.** Rooms (position, width, depth) and desk seats (x, z, rotation) come from
  the database, not from the model file. So we need **modular pieces**, not one baked office:
  rooms are assembled from wall/glass segments around any rectangle, and a workstation is placed at
  every seat.
- **Real time in the browser** (three.js / React Three Fiber), on laptops and phones. Budgets below.
- **Camera:** fixed isometric-style orthographic view from above (+X/+Z), user can orbit/zoom.
- **Name tags are HTML overlays**, not part of the 3D model.

## Deliverables (GLB / glTF 2.0)
| Asset | Notes |
|---|---|
| Workstation: desk, office chair, monitor (+ separate screen mesh), keyboard, desk lamp | Screen as its own mesh named `screen` so we can tint/glow it per department |
| Meeting table (8–10 seats) + meeting chair | |
| Wall segment (solid), glass segment, door segment, corner post, LED strip | Tileable at 1 m; LED as its own mesh named `led` (we drive emissive) |
| Floor tiles: room floor, corridor stone | Tileable textures |
| Decor: 3–4 plants (small/large), sofa, coffee table, rug, bookcase, floor lamp, central planter | |
| People: 6–10 characters (varied, inclusive), rigged on one shared skeleton | Animations: `sit_typing` (loop), `sit_idle` (loop), `idle`, `walk`. Seated pose must fit the chair |

## Technical requirements
- **Units:** metres, Y-up, forward = -Z. Origin at the floor, centred (desk/chair centred on X/Z).
- **Scale reference:** desk 0.75 m high, ~1.4 × 0.7 m; chair seat 0.45 m; person ~1.70 m standing.
- **Workstation pivot:** desk centre; the person sits on the +Z side facing -Z (toward the monitor).
- **Poly budget:** workstation ≤ 8k tris total; person ≤ 6k tris (LOD1 ≤ 2k); decor ≤ 3k each.
  Whole floor with 40 people should stay under ~500k tris.
- **Materials:** PBR metallic-roughness. Prefer a shared texture atlas; textures ≤ 1024² (people
  ≤ 512²), delivered as PNG/JPG (we compress to KTX2/WebP).
- **Naming:** meaningful node/material names (`desk_wood`, `chair_fabric`, `screen`, `led`).
- **No baked lighting into albedo** (we light in real time); an optional AO map is welcome.
- **Licensing:** we need rights to use in a commercial web app, delivered with the license.

## What we do on our side
Draco/meshopt compression, texture compression, instancing for repeated furniture, lazy loading
(phones open the 2D plan by default), and swapping the files in `public/models/` without changing
the scene code (model names are listed in `src/components/office/scene/assets.ts`).
