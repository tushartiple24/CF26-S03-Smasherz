import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ScenarioRun, NodeState, ServiceType } from '../types';
import { getCurrentNodeState } from '../data/dataStore';
import {
  BuildingMeshGroup,
  createBuildingMesh,
  applyBuildingStateStyle,
  SERVICE_COLORS,
} from './BuildingMeshKit';

export interface SceneCallbacks {
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null, mousePos?: { x: number; y: number }) => void;
}

interface ConduitItem {
  upstreamId: string;
  dependentId: string;
  weight: number;
  curve: THREE.CatmullRomCurve3;
  tubeMesh: THREE.Mesh;
  particles: THREE.Points;
  particlePositions: Float32Array;
  particleProgress: Float32Array;
  speed: number;
}

interface DistrictInfo {
  center: [number, number];
  name: string;
  serviceType: string;
  color: number;
}

const DISTRICT_COORDINATES: Record<string, DistrictInfo> = {
  power: { center: [-18, -14], name: 'Power & Grid Sector', serviceType: 'power', color: 0xf59e0b },
  water: { center: [-18, 14], name: 'Water Utilities Basin', serviceType: 'water', color: 0x06b6d4 },
  healthcare: { center: [18, 14], name: 'Medical & Life Support Campus', serviceType: 'healthcare', color: 0x10b981 },
  transport: { center: [18, -14], name: 'Metro & Transit Logistics Hub', serviceType: 'transport', color: 0x8b5cf6 },
  communications: { center: [0, 0], name: 'Telecom & Core Relay Network', serviceType: 'communications', color: 0xec4899 },
};

export class CityScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private callbacks: SceneCallbacks;

  private buildings: Map<string, BuildingMeshGroup> = new Map();
  private conduits: ConduitItem[] = [];
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  // Particle systems for smoke & sparks
  private smokeParticles: THREE.Points | null = null;
  private smokePositions!: Float32Array;
  private smokeVelocities!: Float32Array;
  private smokeLifetimes!: Float32Array;
  private smokeStates!: Float32Array; // 0 = inactive, 1 = degraded, 2 = failed
  private smokeMaxCount = 600;

  // Selection marker
  private selectionRing: THREE.Mesh | null = null;
  private selectionPin: THREE.Group | null = null;

  // Animation frame & camera tween
  private animationFrameId: number | null = null;
  private isDestroyed = false;
  private targetCameraPos: THREE.Vector3 | null = null;
  private targetControlsTarget: THREE.Vector3 | null = null;
  private cameraLerpAlpha = 0.08;

  // Active state cache
  private activeRun: ScenarioRun | null = null;
  private currentTick = 0;
  private selectedNodeId: string | null = null;
  private hoveredNodeId: string | null = null;

  constructor(container: HTMLElement, callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0f1d);
    this.scene.fog = new THREE.FogExp2(0x0a0f1d, 0.012);

    // 2. Camera setup (isometric-leaning starting view)
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 1000);
    this.camera.position.set(38, 44, 46);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.05; // Prevent dipping below ground
    this.controls.minDistance = 10;
    this.controls.maxDistance = 140;
    this.controls.target.set(0, 2, 0);

    // 5. Build Environment & Lighting
    this.initLights();
    this.initGroundAndDistricts();
    this.initSmokeParticles();
    this.initSelectionIndicator();

    // 6. Event listeners
    this.onWindowResize = this.onWindowResize.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);

    window.addEventListener('resize', this.onWindowResize);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);

    // 7. Start render loop
    this.animate = this.animate.bind(this);
    this.animate(0);
  }

  private initLights() {
    // Ambient cool fill
    const ambientLight = new THREE.AmbientLight(0x1e293b, 1.4);
    this.scene.add(ambientLight);

    // Moonlight (Directional with soft shadows)
    const moonLight = new THREE.DirectionalLight(0x94a3b8, 1.8);
    moonLight.position.set(30, 60, 40);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 2048;
    moonLight.shadow.mapSize.height = 2048;
    moonLight.shadow.camera.near = 10;
    moonLight.shadow.camera.far = 160;
    const d = 45;
    moonLight.shadow.camera.left = -d;
    moonLight.shadow.camera.right = d;
    moonLight.shadow.camera.top = d;
    moonLight.shadow.camera.bottom = -d;
    moonLight.shadow.bias = -0.0005;
    this.scene.add(moonLight);

    // Secondary subtle rim light for night-city skyline definition
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    rimLight.position.set(-40, 30, -30);
    this.scene.add(rimLight);
  }

  private initGroundAndDistricts() {
    // Main urban floor plane
    const groundGeo = new THREE.PlaneGeometry(160, 160);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x070b14,
      roughness: 0.95,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Subtle grid overlay for high-tech spatial feel
    const gridHelper = new THREE.GridHelper(140, 40, 0x1e293b, 0x0f172a);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);

    // Roadway cross & avenues connecting districts
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
    });

    const roadHoriz = new THREE.Mesh(new THREE.BoxGeometry(100, 0.04, 3.2), roadMat);
    roadHoriz.position.set(0, 0.02, 0);
    const roadVert = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.04, 100), roadMat);
    roadVert.position.set(0, 0.02, 0);
    this.scene.add(roadHoriz, roadVert);

    // Road glowing center dashed stripes
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
    for (let x = -45; x <= 45; x += 4) {
      const stripeH = new THREE.Mesh(new THREE.BoxGeometry(2, 0.05, 0.2), stripeMat);
      stripeH.position.set(x, 0.03, 0);
      this.scene.add(stripeH);

      const stripeV = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 2), stripeMat);
      stripeV.position.set(0, 0.03, x);
      this.scene.add(stripeV);
    }

    // District Boundary Plazas
    Object.entries(DISTRICT_COORDINATES).forEach(([_, dist]) => {
      const plazaWidth = 24;
      const plazaDepth = 20;
      const plazaGeo = new THREE.BoxGeometry(plazaWidth, 0.15, plazaDepth);
      const plazaMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.9,
      });
      const plaza = new THREE.Mesh(plazaGeo, plazaMat);
      plaza.position.set(dist.center[0], 0.07, dist.center[1]);
      plaza.receiveShadow = true;
      this.scene.add(plaza);

      // District glowing border curb
      const curbGeo = new THREE.BoxGeometry(plazaWidth + 0.6, 0.18, plazaDepth + 0.6);
      const curbMat = new THREE.MeshStandardMaterial({
        color: dist.color,
        emissive: dist.color,
        emissiveIntensity: 0.15,
        roughness: 0.5,
      });
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(dist.center[0], 0.05, dist.center[1]);
      this.scene.add(curb);
    });
  }

  private initSmokeParticles() {
    const geo = new THREE.BufferGeometry();
    this.smokePositions = new Float32Array(this.smokeMaxCount * 3);
    this.smokeVelocities = new Float32Array(this.smokeMaxCount * 3);
    this.smokeLifetimes = new Float32Array(this.smokeMaxCount);
    this.smokeStates = new Float32Array(this.smokeMaxCount);

    for (let i = 0; i < this.smokeMaxCount; i++) {
      this.smokePositions[i * 3 + 1] = -999; // start hidden
      this.smokeLifetimes[i] = 0;
      this.smokeStates[i] = 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.smokePositions, 3));
    geo.setAttribute('stateType', new THREE.BufferAttribute(this.smokeStates, 1));

    // Custom particle shader for smoke & sparks
    const pMaterial = new THREE.PointsMaterial({
      size: 0.85,
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.smokeParticles = new THREE.Points(geo, pMaterial);
    this.scene.add(this.smokeParticles);
  }

  private initSelectionIndicator() {
    // Hexagonal glowing ground ring
    const ringGeo = new THREE.RingGeometry(3.6, 4.2, 6);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    this.selectionRing = new THREE.Mesh(ringGeo, ringMat);
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = 0.25;
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);

    // Floating Target Pin / Diamond
    this.selectionPin = new THREE.Group();
    const pinGeo = new THREE.OctahedronGeometry(0.6, 0);
    const pinMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
    });
    const pin = new THREE.Mesh(pinGeo, pinMat);
    this.selectionPin.add(pin);
    this.selectionPin.visible = false;
    this.scene.add(this.selectionPin);
  }

  /**
   * Load or update scenario geometry
   */
  public loadScenario(scenarioRun: ScenarioRun, currentTick: number) {
    this.activeRun = scenarioRun;
    this.currentTick = currentTick;

    // Clear old buildings & conduits
    this.buildings.forEach(b => this.scene.remove(b.root));
    this.buildings.clear();

    this.conduits.forEach(c => {
      this.scene.remove(c.tubeMesh);
      this.scene.remove(c.particles);
    });
    this.conduits = [];

    // Group nodes by service_type to position them neatly
    const nodesByType: Record<string, typeof scenarioRun.scenario.nodes> = {};
    scenarioRun.scenario.nodes.forEach(node => {
      if (!nodesByType[node.service_type]) nodesByType[node.service_type] = [];
      nodesByType[node.service_type].push(node);
    });

    const nodePositions = new Map<string, THREE.Vector3>();

    // Build building meshes
    Object.entries(nodesByType).forEach(([serviceType, nodes]) => {
      const dist = DISTRICT_COORDINATES[serviceType] || {
        center: [0, 0],
        name: serviceType,
        serviceType,
        color: 0x64748b,
      };

      const count = nodes.length;
      const cols = count > 2 ? 2 : count;

      nodes.forEach((node, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const offsetX = (col - (cols - 1) / 2) * 8.5;
        const offsetZ = (row - (Math.ceil(count / cols) - 1) / 2) * 7.5;

        const posX = dist.center[0] + offsetX;
        const posZ = dist.center[1] + offsetZ;

        const building = createBuildingMesh(node.id, node.service_type, node.name, idx);
        building.root.position.set(posX, 0, posZ);
        building.basePosition.set(posX, 0, posZ);
        this.scene.add(building.root);
        this.buildings.set(node.id, building);

        nodePositions.set(node.id, new THREE.Vector3(posX, 0, posZ));
      });
    });

    // Build glowing 3D conduits for edges
    scenarioRun.scenario.edges.forEach(edge => {
      const upBuilding = this.buildings.get(edge.upstream_id);
      const depBuilding = this.buildings.get(edge.dependent_id);

      if (upBuilding && depBuilding) {
        const start = upBuilding.basePosition.clone().add(upBuilding.roofPosition);
        const end = depBuilding.basePosition.clone().add(depBuilding.roofPosition);

        // Control point for a smooth overhead arch
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const distance = start.distanceTo(end);
        mid.y += Math.max(3.5, distance * 0.22);

        const curve = new THREE.CatmullRomCurve3([start, mid, end]);

        // Base glowing conduit tube
        const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.09, 6, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.7,
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        this.scene.add(tubeMesh);

        // Flowing energy pulse points along conduit
        const pulseCount = 8;
        const pGeo = new THREE.BufferGeometry();
        const pPositions = new Float32Array(pulseCount * 3);
        const pProgress = new Float32Array(pulseCount);

        for (let p = 0; p < pulseCount; p++) {
          pProgress[p] = p / pulseCount;
          const pt = curve.getPoint(pProgress[p]);
          pPositions[p * 3] = pt.x;
          pPositions[p * 3 + 1] = pt.y;
          pPositions[p * 3 + 2] = pt.z;
        }

        pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
        const pMat = new THREE.PointsMaterial({
          color: 0x38bdf8,
          size: 0.55,
          transparent: true,
          blending: THREE.AdditiveBlending,
        });
        const particles = new THREE.Points(pGeo, pMat);
        this.scene.add(particles);

        this.conduits.push({
          upstreamId: edge.upstream_id,
          dependentId: edge.dependent_id,
          weight: edge.weight,
          curve,
          tubeMesh,
          particles,
          particlePositions: pPositions,
          particleProgress: pProgress,
          speed: 0.35,
        });
      }
    });

    this.updateSceneState(currentTick, this.selectedNodeId);
  }

  /**
   * Update visual states for all buildings & conduits when tick or selection changes
   */
  public updateSceneState(currentTick: number, selectedId: string | null = null) {
    this.currentTick = currentTick;
    this.selectedNodeId = selectedId;

    if (!this.activeRun) return;

    // Update building styles based on snapshot state
    this.buildings.forEach((building, nodeId) => {
      const state = getCurrentNodeState(this.activeRun!, nodeId, currentTick);
      applyBuildingStateStyle(building, state, performance.now());
    });

    // Update Conduit styling based on upstream node state
    this.conduits.forEach(conduit => {
      const upState = getCurrentNodeState(this.activeRun!, conduit.upstreamId, currentTick);
      const tubeMat = conduit.tubeMesh.material as THREE.MeshBasicMaterial;
      const pMat = conduit.particles.material as THREE.PointsMaterial;

      if (upState === 'operational') {
        tubeMat.color.setHex(0x38bdf8);
        tubeMat.opacity = 0.65;
        pMat.color.setHex(0x38bdf8);
        conduit.speed = 0.35;
      } else if (upState === 'degraded') {
        tubeMat.color.setHex(0xf59e0b);
        tubeMat.opacity = 0.45;
        pMat.color.setHex(0xf59e0b);
        conduit.speed = 0.15;
      } else {
        // Failed
        tubeMat.color.setHex(0x475569);
        tubeMat.opacity = 0.2;
        pMat.color.setHex(0xef4444);
        conduit.speed = 0.05;
      }
    });

    // Update Selection Ring
    if (selectedId && this.buildings.has(selectedId)) {
      const b = this.buildings.get(selectedId)!;
      if (this.selectionRing) {
        this.selectionRing.position.set(b.basePosition.x, 0.2, b.basePosition.z);
        this.selectionRing.visible = true;
      }
      if (this.selectionPin) {
        this.selectionPin.position.set(
          b.basePosition.x + b.roofPosition.x,
          b.basePosition.y + b.roofPosition.y + 1.6,
          b.basePosition.z + b.roofPosition.z
        );
        this.selectionPin.visible = true;
      }
    } else {
      if (this.selectionRing) this.selectionRing.visible = false;
      if (this.selectionPin) this.selectionPin.visible = false;
    }
  }

  /**
   * Smoothly fly camera to focus on a chosen building
   */
  public flyToBuilding(nodeId: string) {
    const building = this.buildings.get(nodeId);
    if (!building) return;

    const targetPos = building.basePosition.clone().add(building.roofPosition);
    this.targetControlsTarget = targetPos.clone();

    // Offset camera smoothly for an isometric vantage point of this building
    this.targetCameraPos = new THREE.Vector3(
      targetPos.x + 14,
      targetPos.y + 12,
      targetPos.z + 16
    );
  }

  public resetCamera() {
    this.targetControlsTarget = new THREE.Vector3(0, 2, 0);
    this.targetCameraPos = new THREE.Vector3(38, 44, 46);
  }

  public setTopDownCamera() {
    this.targetControlsTarget = new THREE.Vector3(0, 0, 0);
    this.targetCameraPos = new THREE.Vector3(0, 68, 0.1);
  }

  public setIsometricCamera() {
    this.targetControlsTarget = new THREE.Vector3(0, 2, 0);
    this.targetCameraPos = new THREE.Vector3(-36, 40, 36);
  }

  private onPointerMove(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const colliders = this.scene.children
      .flatMap(c => (c instanceof THREE.Group ? c.children : [c]))
      .filter(m => m.name.startsWith('collider_'));

    const intersects = this.raycaster.intersectObjects(colliders);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const nodeId = hit.userData.nodeId;
      if (nodeId !== this.hoveredNodeId) {
        this.hoveredNodeId = nodeId;
        this.container.style.cursor = 'pointer';
        this.callbacks.onNodeHover(nodeId, { x: event.clientX, y: event.clientY });
      }
    } else {
      if (this.hoveredNodeId !== null) {
        this.hoveredNodeId = null;
        this.container.style.cursor = 'default';
        this.callbacks.onNodeHover(null);
      }
    }
  }

  private onPointerDown(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const colliders = this.scene.children
      .flatMap(c => (c instanceof THREE.Group ? c.children : [c]))
      .filter(m => m.name.startsWith('collider_'));

    const intersects = this.raycaster.intersectObjects(colliders);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const nodeId = hit.userData.nodeId;
      this.callbacks.onNodeClick(nodeId);
      this.flyToBuilding(nodeId);
    }
  }

  private onWindowResize() {
    if (!this.container || this.isDestroyed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private updateParticles(delta: number, timeMs: number) {
    if (!this.activeRun || !this.smokeParticles) return;

    let pIdx = 0;
    this.buildings.forEach((building, nodeId) => {
      const state = getCurrentNodeState(this.activeRun!, nodeId, this.currentTick);
      if (state === 'operational') return;

      const anchor = building.basePosition.clone().add(building.particleAnchor);
      const isFailed = state === 'failed';
      const countPerBuilding = isFailed ? 8 : 4;

      for (let i = 0; i < countPerBuilding; i++) {
        if (pIdx >= this.smokeMaxCount) break;

        this.smokeLifetimes[pIdx] += delta;
        if (this.smokeLifetimes[pIdx] > 1.8) {
          // Reset particle to rooftop anchor
          this.smokeLifetimes[pIdx] = Math.random() * 0.3;
          this.smokePositions[pIdx * 3] = anchor.x + (Math.random() - 0.5) * 1.2;
          this.smokePositions[pIdx * 3 + 1] = anchor.y + Math.random() * 0.4;
          this.smokePositions[pIdx * 3 + 2] = anchor.z + (Math.random() - 0.5) * 1.2;

          this.smokeVelocities[pIdx * 3] = (Math.random() - 0.5) * 0.4;
          this.smokeVelocities[pIdx * 3 + 1] = isFailed ? 1.4 + Math.random() * 1.0 : 0.8 + Math.random() * 0.5;
          this.smokeVelocities[pIdx * 3 + 2] = (Math.random() - 0.5) * 0.4;
        } else {
          // Move upward with subtle breeze
          this.smokePositions[pIdx * 3] += this.smokeVelocities[pIdx * 3] * delta;
          this.smokePositions[pIdx * 3 + 1] += this.smokeVelocities[pIdx * 3 + 1] * delta;
          this.smokePositions[pIdx * 3 + 2] += this.smokeVelocities[pIdx * 3 + 2] * delta;
        }
        pIdx++;
      }
    });

    // Hide remainder
    for (let i = pIdx; i < this.smokeMaxCount; i++) {
      this.smokePositions[i * 3 + 1] = -999;
    }

    this.smokeParticles.geometry.attributes.position.needsUpdate = true;
  }

  private animate(time: number) {
    if (this.isDestroyed) return;

    this.animationFrameId = requestAnimationFrame(this.animate);
    const delta = 0.016;

    // Smooth camera lerp if flying to building/view
    if (this.targetCameraPos) {
      this.camera.position.lerp(this.targetCameraPos, this.cameraLerpAlpha);
      if (this.camera.position.distanceTo(this.targetCameraPos) < 0.2) {
        this.targetCameraPos = null;
      }
    }
    if (this.targetControlsTarget) {
      this.controls.target.lerp(this.targetControlsTarget, this.cameraLerpAlpha);
      if (this.controls.target.distanceTo(this.targetControlsTarget) < 0.2) {
        this.targetControlsTarget = null;
      }
    }

    this.controls.update();

    // Animate energy pulses along conduits
    this.conduits.forEach(conduit => {
      const positions = conduit.particlePositions;
      const progress = conduit.particleProgress;
      const pulseCount = progress.length;

      for (let p = 0; p < pulseCount; p++) {
        progress[p] = (progress[p] + conduit.speed * delta) % 1.0;
        const pt = conduit.curve.getPoint(progress[p]);
        positions[p * 3] = pt.x;
        positions[p * 3 + 1] = pt.y;
        positions[p * 3 + 2] = pt.z;
      }
      conduit.particles.geometry.attributes.position.needsUpdate = true;
    });

    // Animate light flicker / beacon strobe for active degraded/failed nodes
    if (this.activeRun) {
      this.buildings.forEach(building => {
        const state = getCurrentNodeState(this.activeRun!, building.nodeId, this.currentTick);
        if (state !== 'operational') {
          applyBuildingStateStyle(building, state, time);
        }
      });
    }

    // Animate Selection pin bounce & rotate
    if (this.selectionPin && this.selectionPin.visible) {
      this.selectionPin.rotation.y += 0.03;
      this.selectionPin.position.y += Math.sin(time * 0.005) * 0.006;
    }
    if (this.selectionRing && this.selectionRing.visible) {
      this.selectionRing.rotation.z += 0.01;
    }

    // Update Smoke & Spark particles
    this.updateParticles(delta, time);

    this.renderer.render(this.scene, this.camera);
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);
    if (this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
      this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    this.renderer.dispose();
  }
}
