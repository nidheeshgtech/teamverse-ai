"use client";

import { Bounds, Grid, OrbitControls, useBounds } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, type RefObject } from "react";
import { Box3, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { sceneBounds, type Occupant, type Room, type Seat } from "@/features/office/model";
import { cameraPosition, sceneTheme, type SceneTokens } from "./scene-theme";
import { AvatarFigure, avatarLabelAnchor } from "./avatar-figure";
import { LabelProjector, type LabelAnchor } from "./label-projector";
import { MeetingTable, Plants, RoomShell, roomLabelAnchor } from "./room-shell";
import { Workstations } from "./workstations";

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

export default function OfficeScene(props: OfficeSceneProps) {
  const { rooms, seats, occupants, performance, reducedMotion, tokens } = props;
  const bounds = useMemo(() => sceneBounds(rooms), [rooms]);
  const seated = useMemo(() => occupants.filter((o) => o.seat), [occupants]);
  const anchors = useMemo<LabelAnchor[]>(
    () => [
      ...rooms.map((r) => ({ id: `room:${r.department}`, position: roomLabelAnchor(r) })),
      ...seated.map((o) => ({ id: `person:${o.userId}`, position: avatarLabelAnchor(o) })),
    ],
    [rooms, seated],
  );

  return (
    <Canvas
      orthographic
      frameloop="demand"
      shadows={performance ? false : "percentage"}
      dpr={performance ? 1 : [1, 2]}
      gl={{ antialias: !performance, alpha: true, powerPreference: performance ? "low-power" : "high-performance" }}
      camera={{ position: cameraPosition, zoom: 20, near: 1, far: 500 }}
      onPointerMissed={() => props.onSelect(null)}
      data-testid="office-canvas"
    >
      <ambientLight color={sceneTheme.ambient} intensity={0.7} />
      <directionalLight
        position={[30, 45, 20]}
        intensity={1.2}
        castShadow={!performance}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <pointLight position={[bounds.minX + 4, 6, bounds.minZ + 4]} color={sceneTheme.accentCyan} intensity={60} distance={35} />
      <pointLight position={[bounds.maxX - 4, 6, bounds.maxZ - 4]} color={sceneTheme.accentEmerald} intensity={75} distance={35} />

      <Bounds fit clip observe margin={0.9} maxDuration={reducedMotion ? 0 : 0.6}>
        <group>
          {/* Floor slab + grid, sized to the layout with a 1.5m margin. */}
          <mesh position={[bounds.centerX, -0.3, bounds.centerZ]} receiveShadow>
            <boxGeometry args={[bounds.width + 3, 0.6, bounds.depth + 3]} />
            <meshStandardMaterial color={sceneTheme.floor} roughness={0.8} metalness={0.1} />
          </mesh>
          <Grid
            position={[bounds.centerX, 0.01, bounds.centerZ]}
            args={[bounds.width + 3, bounds.depth + 3]}
            cellSize={1}
            cellColor={sceneTheme.floorGrid}
            sectionSize={0}
            fadeDistance={200}
          />

          {rooms.map((room) => (
            <RoomShell
              key={room.department}
              room={room}
              color={tokens[`dept-${room.department}` as keyof SceneTokens] ?? tokens.primary}
              dimmed={props.departmentFilter !== null && props.departmentFilter !== room.department}
              performance={performance}
            />
          ))}

          <Workstations seats={seats} tokens={tokens} performance={performance} />
          {rooms
            .filter((r) => r.department === "meeting-room")
            .map((r) => (
              <MeetingTable key="table" room={r} seats={seats.filter((s) => s.departmentSlug === "meeting-room")} />
            ))}
          <Plants bounds={bounds} />

          {seated.map((occupant) => (
            <AvatarFigure
              key={occupant.userId}
              occupant={occupant}
              tokens={tokens}
              selected={occupant.userId === props.selectedId}
              dimmed={props.departmentFilter !== null && occupant.departmentSlug !== props.departmentFilter}
              performance={performance}
              hovered={occupant.userId === props.hoveredId}
              onHover={props.onHover}
              onSelect={props.onSelect}
            />
          ))}
        </group>
        <CameraDirector command={props.camera} />
      </Bounds>

      <LabelProjector anchors={anchors} layer={props.labelLayer} />

      <Controls reducedMotion={reducedMotion} />
    </Canvas>
  );
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

/** Executes recenter/focus commands from the HUD through drei's Bounds (animated unless reduced motion). */
function CameraDirector({ command }: { command: CameraCommand | null }) {
  const api = useBounds();
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!command) return;
    if (command.kind === "recenter" || !command.target) {
      api.refresh().clip().fit();
    } else {
      const { x, z } = command.target;
      api.refresh(new Box3(new Vector3(x - 5, 0, z - 5), new Vector3(x + 5, 2.5, z + 5))).fit();
    }
    invalidate();
  }, [api, command, invalidate]);

  return null;
}
