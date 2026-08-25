import * as THREE from 'three';
import { ServiceType, NodeState } from '../types';

export interface BuildingMeshGroup {
  root: THREE.Group;
  nodeId: string;
  serviceType: ServiceType;
  basePosition: THREE.Vector3;
  windowMaterials: THREE.MeshStandardMaterial[];
  beaconMesh: THREE.Mesh | null;
  beaconLight: THREE.PointLight | null;
  coreMesh: THREE.Mesh | null;
  roofPosition: THREE.Vector3;
  particleAnchor: THREE.Vector3;
  districtColor: number;
}

// District Themes & Color Accents
export const SERVICE_COLORS: Record<string, { main: number; emissive: number; glow: string; label: string }> = {
  power: { main: 0xf59e0b, emissive: 0xd97706, glow: '#f59e0b', label: 'Power & Grid' },
  water: { main: 0x06b6d4, emissive: 0x0891b2, glow: '#06b6d4', label: 'Water Utilities' },
  healthcare: { main: 0x10b981, emissive: 0x059669, glow: '#10b981', label: 'Healthcare & Life Support' },
  transport: { main: 0x8b5cf6, emissive: 0x7c3aed, glow: '#8b5cf6', label: 'Transit & Logistics' },
  communications: { main: 0xec4899, emissive: 0xdb2777, glow: '#ec4899', label: 'Telecom & Networks' },
};

/**
 * Creates a flat-shaded low-poly building tailored to the service type
 */
export function createBuildingMesh(
  nodeId: string,
  serviceType: ServiceType,
  name: string,
  indexInDistrict: number
): BuildingMeshGroup {
  const group = new THREE.Group();
  group.name = `building_${nodeId}`;

  const colors = SERVICE_COLORS[serviceType] || {
    main: 0x64748b,
    emissive: 0x475569,
    glow: '#64748b',
    label: serviceType,
  };

  const windowMaterials: THREE.MeshStandardMaterial[] = [];
  let beaconMesh: THREE.Mesh | null = null;
  let beaconLight: THREE.PointLight | null = null;
  let coreMesh: THREE.Mesh | null = null;

  // Base materials (dark concrete / steel architecture)
  const concreteDark = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
    metalness: 0.2,
    flatShading: true,
  });

  const concreteMedium = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.7,
    metalness: 0.3,
    flatShading: true,
  });

  const metalAccent = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.4,
    metalness: 0.7,
    flatShading: true,
  });

  // Window material will be dynamically tinted based on node state
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfde047,
    emissiveIntensity: 0.9,
    roughness: 0.2,
    metalness: 0.1,
    flatShading: true,
  });
  windowMaterials.push(windowMat);

  // Pedestal / Plot foundation
  const baseWidth = 5.6;
  const baseDepth = 5.6;
  const baseHeight = 0.5;
  const plotGeo = new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth);
  const plotMesh = new THREE.Mesh(plotGeo, concreteDark);
  plotMesh.position.y = baseHeight / 2;
  plotMesh.castShadow = true;
  plotMesh.receiveShadow = true;
  group.add(plotMesh);

  // Plot border curb
  const curbGeo = new THREE.BoxGeometry(baseWidth + 0.4, 0.15, baseDepth + 0.4);
  const curbMat = new THREE.MeshStandardMaterial({
    color: colors.main,
    emissive: colors.emissive,
    emissiveIntensity: 0.25,
    roughness: 0.6,
  });
  const curbMesh = new THREE.Mesh(curbGeo, curbMat);
  curbMesh.position.y = 0.08;
  group.add(curbMesh);

  let totalHeight = 4.0;
  const roofPosition = new THREE.Vector3(0, totalHeight, 0);
  const particleAnchor = new THREE.Vector3(0, totalHeight + 0.5, 0);

  // Custom architectural kit based on service_type
  if (serviceType === 'power') {
    // POWER: Transformer Station & Cooling Silos / Generator Turbine Block
    totalHeight = 4.2;

    // Main heavy substation housing
    const mainBlockGeo = new THREE.BoxGeometry(3.6, 2.8, 3.4);
    const mainBlock = new THREE.Mesh(mainBlockGeo, concreteMedium);
    mainBlock.position.y = baseHeight + 1.4;
    mainBlock.castShadow = true;
    group.add(mainBlock);

    // Glowing energy core chamber
    const coreGeo = new THREE.BoxGeometry(1.6, 1.4, 3.5);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.2,
      roughness: 0.1,
    });
    coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(0, baseHeight + 1.4, 0);
    group.add(coreMesh);

    // Twin cooling cylinders / transformers
    const cylGeo = new THREE.CylinderGeometry(0.7, 0.8, 2.6, 10);
    const cyl1 = new THREE.Mesh(cylGeo, metalAccent);
    cyl1.position.set(-1.1, baseHeight + 1.3, -1.1);
    const cyl2 = new THREE.Mesh(cylGeo, metalAccent);
    cyl2.position.set(1.1, baseHeight + 1.3, -1.1);
    group.add(cyl1, cyl2);

    // Substation transformer coils / insulator racks
    const coilGeo = new THREE.BoxGeometry(0.3, 1.2, 0.3);
    for (let c = -1; c <= 1; c++) {
      const coil = new THREE.Mesh(coilGeo, metalAccent);
      coil.position.set(c * 0.9, baseHeight + 3.2, 0.8);
      group.add(coil);
    }

    roofPosition.set(0, baseHeight + 3.0, 0);
    particleAnchor.set(0, baseHeight + 3.6, 0);
  } else if (serviceType === 'water') {
    // WATER: Cylindrical Filtration Tanks & Pump manifolds
    totalHeight = 4.6;

    // Filtration reservoir tank 1
    const tank1Geo = new THREE.CylinderGeometry(1.4, 1.5, 3.2, 14);
    const tank1 = new THREE.Mesh(tank1Geo, concreteMedium);
    tank1.position.set(-0.9, baseHeight + 1.6, -0.6);
    tank1.castShadow = true;
    group.add(tank1);

    // Filtration reservoir tank 2
    const tank2Geo = new THREE.CylinderGeometry(1.1, 1.2, 3.8, 12);
    const tank2 = new THREE.Mesh(tank2Geo, metalAccent);
    tank2.position.set(1.0, baseHeight + 1.9, 0.6);
    tank2.castShadow = true;
    group.add(tank2);

    // Water level glass indicator strip (emissive)
    const gaugeGeo = new THREE.BoxGeometry(0.2, 2.2, 0.3);
    coreMesh = new THREE.Mesh(gaugeGeo, windowMat);
    coreMesh.position.set(-0.9, baseHeight + 1.6, 0.8);
    group.add(coreMesh);

    // Pump house block
    const pumpGeo = new THREE.BoxGeometry(2.0, 1.8, 2.0);
    const pumpMesh = new THREE.Mesh(pumpGeo, concreteDark);
    pumpMesh.position.set(0.7, baseHeight + 0.9, -1.0);
    group.add(pumpMesh);

    // Interconnecting pipe bridge
    const pipeGeo = new THREE.CylinderGeometry(0.18, 0.18, 2.2, 8);
    const pipe = new THREE.Mesh(pipeGeo, metalAccent);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, baseHeight + 2.6, 0);
    group.add(pipe);

    roofPosition.set(1.0, baseHeight + 3.8, 0.6);
    particleAnchor.set(1.0, baseHeight + 4.2, 0.6);
  } else if (serviceType === 'healthcare') {
    // HEALTHCARE: Multi-tier Medical Hospital Wing with Rooftop Helipad
    totalHeight = 5.8;

    // Main hospital tower
    const mainTowerGeo = new THREE.BoxGeometry(3.2, 4.4, 3.0);
    const mainTower = new THREE.Mesh(mainTowerGeo, concreteMedium);
    mainTower.position.y = baseHeight + 2.2;
    mainTower.castShadow = true;
    group.add(mainTower);

    // Emergency wing extension
    const wingGeo = new THREE.BoxGeometry(1.8, 2.2, 2.4);
    const wing = new THREE.Mesh(wingGeo, concreteDark);
    wing.position.set(1.8, baseHeight + 1.1, 0.3);
    group.add(wing);

    // Window bands (3 levels of illuminated patient suites)
    for (let floor = 0; floor < 3; floor++) {
      const windowStripGeo = new THREE.BoxGeometry(3.3, 0.45, 0.1);
      const wFront = new THREE.Mesh(windowStripGeo, windowMat);
      wFront.position.set(0, baseHeight + 1.2 + floor * 1.1, 1.52);
      const wBack = new THREE.Mesh(windowStripGeo, windowMat);
      wBack.position.set(0, baseHeight + 1.2 + floor * 1.1, -1.52);
      group.add(wFront, wBack);
    }

    // Glowing Medical Red/Cyan Cross Sign on facade
    const crossVert = new THREE.BoxGeometry(0.25, 0.8, 0.1);
    const crossHoriz = new THREE.BoxGeometry(0.8, 0.25, 0.1);
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.5,
    });
    const cV = new THREE.Mesh(crossVert, crossMat);
    cV.position.set(-0.8, baseHeight + 3.4, 1.55);
    const cH = new THREE.Mesh(crossHoriz, crossMat);
    cH.position.set(-0.8, baseHeight + 3.4, 1.55);
    group.add(cV, cH);

    // Rooftop Helipad
    const helipadGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.15, 16);
    const helipadMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
    });
    const helipad = new THREE.Mesh(helipadGeo, helipadMat);
    helipad.position.set(0.4, baseHeight + 4.5, 0);
    group.add(helipad);

    // Helipad 'H' marking
    const hBarGeo = new THREE.BoxGeometry(0.6, 0.05, 0.12);
    const hLegGeo = new THREE.BoxGeometry(0.12, 0.05, 0.7);
    const hMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfacc15,
      emissiveIntensity: 0.8,
    });
    const hBar = new THREE.Mesh(hBarGeo, hMat);
    hBar.position.set(0.4, baseHeight + 4.6, 0);
    const hLeg1 = new THREE.Mesh(hLegGeo, hMat);
    hLeg1.position.set(0.15, baseHeight + 4.6, 0);
    const hLeg2 = new THREE.Mesh(hLegGeo, hMat);
    hLeg2.position.set(0.65, baseHeight + 4.6, 0);
    group.add(hBar, hLeg1, hLeg2);

    roofPosition.set(0.4, baseHeight + 4.6, 0);
    particleAnchor.set(0.4, baseHeight + 5.2, 0);
  } else if (serviceType === 'transport') {
    // TRANSPORT: Transit Terminal / Rail Hub with Control Tower & Overhead Gantry
    totalHeight = 5.2;

    // Terminal station platform hall
    const hallGeo = new THREE.BoxGeometry(3.8, 1.8, 3.2);
    const hall = new THREE.Mesh(hallGeo, concreteMedium);
    hall.position.y = baseHeight + 0.9;
    hall.castShadow = true;
    group.add(hall);

    // Elevated Traffic / Dispatch Control Tower
    const towerGeo = new THREE.BoxGeometry(1.6, 4.2, 1.6);
    const tower = new THREE.Mesh(towerGeo, concreteDark);
    tower.position.set(-1.0, baseHeight + 2.1, 0.8);
    tower.castShadow = true;
    group.add(tower);

    // Tower Observation Cabin (surrounded by window ribbon)
    const cabinGeo = new THREE.BoxGeometry(2.0, 0.8, 2.0);
    const cabin = new THREE.Mesh(cabinGeo, windowMat);
    cabin.position.set(-1.0, baseHeight + 3.8, 0.8);
    group.add(cabin);

    // Overhead Signal Gantry & Rail Track mockup
    const railMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.2 });
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.15), railMat);
    rail1.position.set(0, baseHeight + 0.1, -1.2);
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.15), railMat);
    rail2.position.set(0, baseHeight + 0.1, -0.8);
    group.add(rail1, rail2);

    roofPosition.set(-1.0, baseHeight + 4.4, 0.8);
    particleAnchor.set(-1.0, baseHeight + 5.0, 0.8);
  } else {
    // COMMUNICATIONS: Tall Telecom Tower & Server Data Relay Array
    totalHeight = 6.4;

    // Server bunker foundation
    const bunkerGeo = new THREE.BoxGeometry(3.2, 2.0, 3.2);
    const bunker = new THREE.Mesh(bunkerGeo, concreteDark);
    bunker.position.y = baseHeight + 1.0;
    bunker.castShadow = true;
    group.add(bunker);

    // Server rack illuminated ventilation slits
    const ventGeo = new THREE.BoxGeometry(2.8, 0.3, 0.1);
    const vent1 = new THREE.Mesh(ventGeo, windowMat);
    vent1.position.set(0, baseHeight + 0.7, 1.62);
    const vent2 = new THREE.Mesh(ventGeo, windowMat);
    vent2.position.set(0, baseHeight + 1.3, 1.62);
    group.add(vent1, vent2);

    // Lattice telecom mast
    const mastGeo = new THREE.CylinderGeometry(0.3, 0.7, 4.4, 6);
    const mast = new THREE.Mesh(mastGeo, metalAccent);
    mast.position.set(0, baseHeight + 4.0, 0);
    group.add(mast);

    // Microwave Satellite Dishes
    const dishGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.15, 12);
    const dish1 = new THREE.Mesh(dishGeo, concreteMedium);
    dish1.rotation.x = Math.PI / 4;
    dish1.position.set(0.6, baseHeight + 3.8, 0.3);
    const dish2 = new THREE.Mesh(dishGeo, concreteMedium);
    dish2.rotation.z = -Math.PI / 4;
    dish2.position.set(-0.6, baseHeight + 4.6, -0.3);
    group.add(dish1, dish2);

    roofPosition.set(0, baseHeight + 6.2, 0);
    particleAnchor.set(0, baseHeight + 6.6, 0);
  }

  // Roof State Beacon Mesh (glowing sphere on top)
  const beaconGeo = new THREE.SphereGeometry(0.35, 12, 12);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.2,
    roughness: 0.1,
  });
  beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
  beaconMesh.position.copy(roofPosition);
  beaconMesh.name = `beacon_${nodeId}`;
  group.add(beaconMesh);

  // Point light for localized building glow at night
  beaconLight = new THREE.PointLight(0x10b981, 1.2, 12, 1.5);
  beaconLight.position.copy(roofPosition);
  beaconLight.position.y += 0.3;
  group.add(beaconLight);

  // Bounding box collider for raycasting
  const colliderGeo = new THREE.BoxGeometry(baseWidth, totalHeight + 1.0, baseDepth);
  const colliderMat = new THREE.MeshBasicMaterial({
    visible: false,
    wireframe: true,
  });
  const collider = new THREE.Mesh(colliderGeo, colliderMat);
  collider.position.y = (totalHeight + 1.0) / 2;
  collider.userData = { nodeId, name, serviceType };
  collider.name = `collider_${nodeId}`;
  group.add(collider);

  return {
    root: group,
    nodeId,
    serviceType,
    basePosition: new THREE.Vector3(),
    windowMaterials,
    beaconMesh,
    beaconLight,
    coreMesh,
    roofPosition,
    particleAnchor,
    districtColor: colors.main,
  };
}

/**
 * Apply visual styling to a building based on state:
 * - operational -> warm/golden steady window glow, steady beacon
 * - degraded -> amber flicker, dimmed windows
 * - failed -> unlit windows, flashing red roof beacon
 */
export function applyBuildingStateStyle(
  building: BuildingMeshGroup,
  state: NodeState,
  timeMs: number
) {
  const { windowMaterials, beaconMesh, beaconLight, coreMesh } = building;

  if (state === 'operational') {
    // Windows: warm, steady
    windowMaterials.forEach(m => {
      m.color.setHex(0xfffbeb);
      m.emissive.setHex(0xfde047);
      m.emissiveIntensity = 0.85;
    });

    if (beaconMesh) {
      (beaconMesh.material as THREE.MeshStandardMaterial).color.setHex(0x10b981);
      (beaconMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x10b981);
      (beaconMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.0;
    }

    if (beaconLight) {
      beaconLight.color.setHex(0x38bdf8);
      beaconLight.intensity = 1.0;
    }

    if (coreMesh) {
      (coreMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.0;
    }
  } else if (state === 'degraded') {
    // Windows: amber flickering
    const flicker = 0.4 + Math.sin(timeMs * 0.008 + building.root.id) * 0.35;
    windowMaterials.forEach(m => {
      m.color.setHex(0xf59e0b);
      m.emissive.setHex(0xd97706);
      m.emissiveIntensity = flicker;
    });

    const beaconFlicker = Math.sin(timeMs * 0.012) > 0 ? 1.4 : 0.2;
    if (beaconMesh) {
      (beaconMesh.material as THREE.MeshStandardMaterial).color.setHex(0xf59e0b);
      (beaconMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xd97706);
      (beaconMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = beaconFlicker;
    }

    if (beaconLight) {
      beaconLight.color.setHex(0xf59e0b);
      beaconLight.intensity = beaconFlicker * 1.5;
    }

    if (coreMesh) {
      (coreMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = flicker;
    }
  } else {
    // Failed: Dark unlit windows, flashing intense red roof beacon
    windowMaterials.forEach(m => {
      m.color.setHex(0x1e293b);
      m.emissive.setHex(0x0f172a);
      m.emissiveIntensity = 0.05;
    });

    // Intense warning beacon strobe
    const strobe = (Math.floor(timeMs / 280) % 2 === 0) ? 2.5 : 0.1;
    if (beaconMesh) {
      (beaconMesh.material as THREE.MeshStandardMaterial).color.setHex(0xef4444);
      (beaconMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xdc2626);
      (beaconMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = strobe;
    }

    if (beaconLight) {
      beaconLight.color.setHex(0xef4444);
      beaconLight.intensity = strobe * 2.0;
    }

    if (coreMesh) {
      (coreMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.05;
    }
  }
}
