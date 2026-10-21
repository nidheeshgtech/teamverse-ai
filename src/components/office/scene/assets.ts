"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Box3, Color, Group, Mesh, MeshStandardMaterial, Vector3, type Material, type Object3D } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

// PLACEHOLDER models: Kenney Furniture Kit + Mini Characters (CC0, see public/models/CREDITS.md),
// re-tinted to a warm modern-office palette. Swapped for the commissioned assets later; keep the
// names in FURNITURE / CHARACTERS stable so the scene code doesn't change.

export const FURNITURE = {
  desk: "/models/office/desk.glb",
  chair: "/models/office/chairDesk.glb",
  monitor: "/models/office/computerScreen.glb",
  keyboard: "/models/office/computerKeyboard.glb",
  laptop: "/models/office/laptop.glb",
  plantLarge: "/models/office/pottedPlant.glb",
  plantSmall1: "/models/office/plantSmall1.glb",
  plantSmall2: "/models/office/plantSmall2.glb",
  plantSmall3: "/models/office/plantSmall3.glb",
  sofa: "/models/office/loungeSofaLong.glb",
  sofaDesign: "/models/office/loungeDesignSofa.glb",
  coffeeTable: "/models/office/tableCoffeeGlass.glb",
  meetingTable: "/models/office/table.glb",
  meetingChair: "/models/office/chairModernCushion.glb",
  bookcase: "/models/office/bookcaseOpen.glb",
  bookcaseLow: "/models/office/bookcaseOpenLow.glb",
  floorLamp: "/models/office/lampRoundFloor.glb",
  rug: "/models/office/rugRectangle.glb",
} as const;
export type FurnitureName = keyof typeof FURNITURE;

export const CHARACTERS = [
  "character-female-a", "character-male-a", "character-female-b", "character-male-b",
  "character-female-c", "character-male-c", "character-female-d", "character-male-d",
  "character-female-e", "character-male-e", "character-female-f", "character-male-f",
] as const;
export type CharacterName = (typeof CHARACTERS)[number];
export const characterUrl = (name: CharacterName) => `/models/people/${name}.glb`;

/** Kenney furniture is modelled at roughly half scale; this brings a desk to ~0.76m high. */
export const FURNITURE_SCALE = 2;

// Warm modern office palette (scene-only colours; UI colours come from CSS tokens).
const palette: Record<string, { color: string; roughness: number; metalness: number; emissive?: string; emissiveIntensity?: number; opacity?: number }> = {
  wood: { color: "#c9a27a", roughness: 0.55, metalness: 0 },
  woodDark: { color: "#6b4a33", roughness: 0.6, metalness: 0 },
  metal: { color: "#25282d", roughness: 0.35, metalness: 0.6 },
  metalDark: { color: "#14161a", roughness: 0.3, metalness: 0.5 },
  metalMedium: { color: "#2d3137", roughness: 0.4, metalness: 0.5 },
  carpet: { color: "#33363d", roughness: 0.9, metalness: 0 },
  carpetBlue: { color: "#4b5260", roughness: 0.85, metalness: 0 },
  carpetDarker: { color: "#3b332d", roughness: 0.95, metalness: 0 },
  carpetWhite: { color: "#e9e4dc", roughness: 0.9, metalness: 0 },
  glass: { color: "#cfe6e0", roughness: 0.05, metalness: 0, opacity: 0.35 },
  lamp: { color: "#ffe3b0", roughness: 0.4, metalness: 0, emissive: "#ffc477", emissiveIntensity: 1.6 },
  plant: { color: "#3f7d4b", roughness: 0.75, metalness: 0 },
};

/** Per-model overrides (e.g. the lounge sofa shares the chair's fabric but should be mustard). */
const overrides: Partial<Record<FurnitureName, Record<string, string>>> = {
  sofa: { carpet: "#b8873b" },
  sofaDesign: { carpetBlue: "#7a7446" },
  rug: { carpet: "#4a4038", carpetDarker: "#2f2925" },
};

function tint(root: Object3D, model?: FurnitureName) {
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const apply = (material: Material) => {
      const spec = palette[material.name];
      if (!spec) return material;
      const next = new MeshStandardMaterial({
        name: material.name,
        color: new Color(overrides[model!]?.[material.name] ?? spec.color),
        roughness: spec.roughness,
        metalness: spec.metalness,
        transparent: spec.opacity !== undefined,
        opacity: spec.opacity ?? 1,
        emissive: spec.emissive ? new Color(spec.emissive) : undefined,
        emissiveIntensity: spec.emissiveIntensity ?? 0,
      });
      return next;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(apply) : apply(mesh.material);
  });
}

/** Clone of a furniture model, re-tinted, centred on X/Z with its base at y=0, at office scale. */
export function useFurniture(name: FurnitureName): Group {
  const { scene } = useGLTF(FURNITURE[name]);
  return useMemo(() => {
    const model = scene.clone(true);
    tint(model, name);
    const box = new Box3().setFromObject(model);
    const center = box.getCenter(new Vector3());
    model.position.set(-center.x, -box.min.y, -center.z);
    const wrapper = new Group();
    wrapper.add(model);
    wrapper.scale.setScalar(FURNITURE_SCALE);
    return wrapper;
  }, [scene, name]);
}

/** Size of a furniture model at office scale (for placing things on top of it). */
export function useFurnitureSize(name: FurnitureName): Vector3 {
  const { scene } = useGLTF(FURNITURE[name]);
  return useMemo(() => new Box3().setFromObject(scene).getSize(new Vector3()).multiplyScalar(FURNITURE_SCALE), [scene]);
}

/** Independent (skinned) clone of a character, so each person can hold their own pose. */
export function useCharacter(name: CharacterName) {
  const gltf = useGLTF(characterUrl(name));
  const root = useMemo(() => {
    const model = cloneSkinned(gltf.scene);
    model.traverse((node) => {
      const mesh = node as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = false;
      }
    });
    return model;
  }, [gltf.scene]);
  return { root, animations: gltf.animations };
}

export function preloadOfficeModels(characters: CharacterName[]) {
  for (const url of Object.values(FURNITURE)) useGLTF.preload(url);
  for (const name of new Set(characters)) useGLTF.preload(characterUrl(name));
}

/** Stable default figure for someone who hasn't picked one: never inferred from their name. */
export function defaultCharacter(userId: string): CharacterName {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return CHARACTERS[hash % CHARACTERS.length];
}

export const isCharacterName = (value: unknown): value is CharacterName => typeof value === "string" && (CHARACTERS as readonly string[]).includes(value);
