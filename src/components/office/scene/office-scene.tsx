"use client";

import { Bounds, OrbitControls, useBounds } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, type RefObject } from "react";
import { PMREMGenerator, Vector3 } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { sceneBounds, type Occupant, type Room, type Seat } from "@/features/office/model";
import { defaultCharacter, isCharacterName, preloadOfficeModels } from "./assets";
import { CornerPlants, Lounge, MeetingSet, personTagAnchor, RoomDecor, SeatedPerson, Workstation } from "./furniture";
import { LabelProjector, type LabelAnchor } from "./label-projector";
import { RoomShell, roomLabelAnchor } from "./room-shell";
import { cameraPosition, sceneTheme, type SceneTokens } from "./scene-theme";

export type CameraCommand = { kind: "recenter" | "focus"; target?: { x: number; z: number }; nonce: number };

export type OfficeSceneProps = {
  rooms: Room[];
  seats: Seat[];
  occupants: Occupant[];
  selectedId: string | null;
  hoveredId: string | null;
  departmentFilter: string | null;
  /** DOM layer holding elements with data-anchor="room:<slug>" / "person:<userId>". */
  labelLayer: RefObject<HTMLDivElement | null>;
  tokens: SceneTokens;
  performance: boolean;
  reducedMotion: boolean;
  camera: CameraCommand | null;
  onSelect: (userId: string | null) => void;
  onHover: (userId: string | null) => void;
};

const characterFor = (o: Occupant) => (isCharacterName(o.character) ? o.character : defaultCharacter(o.userId));

/** A point on the open floor (not inside any room) for the lounge, if there is one. */
function freeFloorSpot(rooms: Room[], bounds: ReturnType<typeof sceneBounds>): [number, number] | null {
  const inside = (x: number, z: number, pad: number) => rooms.some((r) => Math.abs(x - r.x) < r.width / 2 + pad && Math.abs(z - r.z) < r.depth / 2 + pad);
  for (const [x, z] of [[bounds.centerX, bounds.centerZ], [bounds.centerX, bounds.maxZ + 3], [bounds.maxX + 4, bounds.centerZ]] as const) {
    if (!inside(x, z, 1.5)) return [x, z];
  }
  return null;
}

/**
 * PLACEHOLDER 3D office in the warm "modern office" direction of the product owner's reference:
 * glass rooms with warm LED edges, real furniture and seated people (CC0 models), soft shadows.
 * Layout, rooms and seats are data (office_layouts.scene + office_seats); models are swappable
 * for the commissioned assets (see design/3D-ASSET-BRIEF.md).
 */
export default function OfficeScene(props: OfficeSceneProps) {
  const { rooms, seats, occupants, performance, reducedMotion, tokens } = props;
  const bounds = useMemo(() => sceneBounds(rooms), [rooms]);
  const seated = useMemo(() => occupants.filter((o) => o.seat), [occupants]);
  // Only connected people sit at their desks; an empty chair means "not connected".
  const present = useMemo(() => seated.filter((o) => o.status !== "offline"), [seated]);
  const lounge = useMemo(() => freeFloorSpot(rooms, bounds), [rooms, bounds]);
  const anchors = useMemo<LabelAnchor[]>(
    () => [
      ...rooms.map((r) => ({ id: `room:${r.department}`, position: roomLabelAnchor(r) })),
      ...seated.map((o) => ({ id: `person:${o.userId}`, position: personTagAnchor(o) })),
    ],
    [rooms, seated],
  );

  useEffect(() => preloadOfficeModels(present.map(characterFor)), [present]);

  const color = (slug: string | null) => tokens[`dept-${slug}` as keyof SceneTokens] ?? tokens.primary;
  const dimmedDept = (slug: string | null) => props.departmentFilter !== null && props.departmentFilter !== slug;

  return (
    <Canvas
      orthographic
      frameloop="demand"
      shadows={performance ? false : "soft"}
      dpr={performance ? 1 : [1, 2]}
      gl={{ antialias: !performance, alpha: true, powerPreference: performance ? "low-power" : "high-performance" }}
      camera={{ position: cameraPosition, zoom: 20, near: 1, far: 500 }}
      onPointerMissed={() => props.onSelect(null)}
      data-testid="office-canvas"
    >
      {!performance ? <SceneEnvironment /> : null}
      <ambientLight color={sceneTheme.ambient} intensity={performance ? 1.1 : 0.45} />
      <hemisphereLight color={sceneTheme.keyLight} groundColor={sceneTheme.floorEdge} intensity={0.5} />
      <directionalLight
        position={[18, 40, 26]}
        color={sceneTheme.keyLight}
        intensity={1.5}
        castShadow={!performance}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
      />
      <directionalLight position={[-30, 20, -10]} color={sceneTheme.fillLight} intensity={0.25} />

      <Bounds fit clip observe margin={0.8} maxDuration={reducedMotion ? 0 : 0.6}>
        <group>
          {/* Floor slab, sized to the layout with a margin. */}
          <mesh position={[bounds.centerX, -0.3, bounds.centerZ]} receiveShadow>
            <boxGeometry args={[bounds.width + 4, 0.6, bounds.depth + 4]} />
            <meshStandardMaterial color={sceneTheme.floor} roughness={0.35} metalness={0.08} />
          </mesh>

          {rooms.map((room) => (
            <RoomShell key={room.department} room={room} dimmed={dimmedDept(room.department)} performance={performance} />
          ))}

          <Suspense fallback={null}>
            {seats
              .filter((s) => s.departmentSlug !== "meeting-room")
              .map((seat) => (
                <Workstation key={seat.id} seat={seat} glow={color(seat.departmentSlug)} />
              ))}
            {rooms
              .filter((r) => r.department === "meeting-room")
              .map((r) => (
                <MeetingSet key="meeting" room={r} seats={seats.filter((s) => s.departmentSlug === "meeting-room")} />
              ))}
            {rooms
              .filter((r) => r.department !== "meeting-room")
              .map((r) => (
                <RoomDecor key={r.department} room={r} />
              ))}
            {lounge ? <Lounge x={lounge[0]} z={lounge[1]} /> : null}
            <CornerPlants
              points={[
                [bounds.minX - 1, bounds.minZ - 1],
                [bounds.maxX + 1, bounds.minZ - 1],
                [bounds.minX - 1, bounds.maxZ + 1],
                [bounds.maxX + 1, bounds.maxZ + 1],
              ]}
            />
            {present.map((occupant) => (
              <SeatedPerson
                key={occupant.userId}
                occupant={occupant}
                character={characterFor(occupant)}
                selected={occupant.userId === props.selectedId}
                hovered={occupant.userId === props.hoveredId}
                dimmed={dimmedDept(occupant.departmentSlug)}
                ringColor={tokens.primary}
                onHover={props.onHover}
                onSelect={props.onSelect}
              />
            ))}
          </Suspense>
        </group>
        <CameraDirector command={props.camera} />
      </Bounds>

      <LabelProjector anchors={anchors} layer={props.labelLayer} />

      <Controls reducedMotion={reducedMotion} />
    </Canvas>
  );
}

/** Soft studio reflections from a procedural room (no HDR file to download). */
function SceneEnvironment() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene, invalidate } = get();
    const pmrem = new PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = texture;
    scene.environmentIntensity = 0.35;
    invalidate();
    return () => {
      scene.environment = null;
      texture.dispose();
      pmrem.dispose();
    };
  }, [get]);
  return null;
}

function Controls({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <OrbitControls
      makeDefault
      enableDamping={!reducedMotion}
      minZoom={8}
      maxZoom={120}
      minPolarAngle={Math.PI / 8}
      maxPolarAngle={Math.PI / 2.3}
      screenSpacePanning={false}
      keyPanSpeed={20}
      ref={(controls: OrbitControlsImpl | null) => {
        // Arrow keys pan when the canvas wrapper has focus.
        const wrapper = controls?.domElement?.closest("[data-office-canvas]") as HTMLElement | null;
        if (controls && wrapper) controls.listenToKeyEvents(wrapper);
      }}
    />
  );
}

/** Focus zoom: a desk cluster fills the view without the camera diving into the room. */
const FOCUS_ZOOM = 55;

/** Recenter fits the whole floor (drei Bounds); focus keeps the isometric angle and zooms on a desk. */
function CameraDirector({ command }: { command: CameraCommand | null }) {
  const api = useBounds();
  const get = useThree((s) => s.get);

  useEffect(() => {
    if (!command) return;
    const { camera, controls, invalidate } = get();
    if (command.kind === "recenter" || !command.target) {
      api.refresh().clip().fit();
    } else if (controls && "target" in controls) {
      const orbit = controls as unknown as OrbitControlsImpl;
      const offset = new Vector3().subVectors(camera.position, orbit.target);
      orbit.target.set(command.target.x, 0, command.target.z);
      camera.position.copy(orbit.target).add(offset);
      camera.zoom = FOCUS_ZOOM;
      camera.updateProjectionMatrix();
      orbit.update();
    }
    invalidate();
  }, [api, command, get]);

  return null;
}
