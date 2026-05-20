import { gfx3JoltManager, JOLT_LAYER_MOVING, Gfx3Jolt } from '@lib/gfx3_jolt/gfx3_jolt_manager';
import { Gfx3Mesh } from '@lib/gfx3_mesh/gfx3_mesh';
import { Gfx3MeshJSM } from '@lib/gfx3_mesh/gfx3_mesh_jsm';
import { gfx3MeshRenderer } from '@lib/gfx3_mesh/gfx3_mesh_renderer';
import { Quaternion } from '@lib/core/quaternion';
import { UT } from '@lib/core/utils';
import { createBoxMesh, createUnitBoxMesh } from './GameUtils';

// Helper for shortest angle distance
function ANGLE_DISTANCE(a: number, b: number): number {
    let diff = (b - a + Math.PI) % (Math.PI * 2) - Math.PI;
    return diff < -Math.PI ? diff + Math.PI * 2 : diff;
}

/**
 * The Tank class represents the player-controlled vehicle.
 * It manages multiple mesh components (body, turret, barrel, etc.)
 * and integrates with Jolt Physics for movement.
 */
export class Tank {
  static hpGreen: Gfx3Mesh;
  static hpRed: Gfx3Mesh;
  static hpInit: boolean = false;

  body: Gfx3Mesh;
  turret: Gfx3Mesh;
  barrel: Gfx3Mesh;
  trackL: Gfx3Mesh;
  trackR: Gfx3Mesh;
  engine: Gfx3Mesh;
  hatch: Gfx3Mesh;
  antenna: Gfx3Mesh;
  physicsBody: any;
  velocity: number = 0;
  rotation: number = 0;
  visualPos: vec3 = [0, 0, 0];
  visualQ: Quaternion = new Quaternion();
  shellRecoil: number = 0;
  grenadeRecoil: number = 0;
  turretYaw: number = 0;
  wasFiringInternal: boolean = false;
  currentUp: vec3 = [0, 1, 0];
  hp: number = 100;
  recoil: number = 0;

  static initHPMeshes() {
    if (Tank.hpInit) return;
    Tank.hpGreen = createUnitBoxMesh([0, 1, 0]);
    Tank.hpRed = createUnitBoxMesh([1, 0, 0]);
    Tank.hpInit = true;
  }
  
  constructor() {
    Tank.initHPMeshes();
    const chassisColor: [number, number, number] = [0.4, 0.5, 0.3];
    const turretColor: [number, number, number] = [0.35, 0.45, 0.25];
    const trackColor: [number, number, number] = [0.15, 0.15, 0.15];
    const engineColor: [number, number, number] = [0.2, 0.2, 0.2];

    // Initial placeholders until JSM models load
    this.body = createBoxMesh(2.25, 0.9, 3.3, chassisColor);
    this.turret = createBoxMesh(1.65, 0.75, 1.65, turretColor);
    this.barrel = createBoxMesh(0.3, 0.3, 2.25, [0.2, 0.2, 0.2]);
    this.trackL = createBoxMesh(0.6, 0.9, 3.6, trackColor);
    this.trackR = createBoxMesh(0.6, 0.9, 3.6, trackColor);
    this.engine = createBoxMesh(1.8, 0.6, 0.9, engineColor);
    this.hatch = createBoxMesh(0.6, 0.15, 0.6, [0.15, 0.15, 0.15]);
    this.antenna = createBoxMesh(0.05, 1.5, 0.05, [0.1, 0.1, 0.1]);

    this.physicsBody = gfx3JoltManager.addBox({
      width: 3.45, height: 1.5, depth: 3.6,
      x: 0, y: 25, z: 0,
      motionType: Gfx3Jolt.EMotionType_Dynamic,
      layer: JOLT_LAYER_MOVING,
      settings: { mAngularDamping: 4.0, mLinearDamping: 2.0, mMassPropertiesOverride: 3000.0 } 
    });
  }

  /**
   * Loads high-fidelity JSM models for the tank components.
   */
  async load() {
    const bodyJSM = new Gfx3MeshJSM();
    const turretJSM = new Gfx3MeshJSM();
    const barrelJSM = new Gfx3MeshJSM();

    try {
      await Promise.all([
        bodyJSM.loadFromFile('models/tank_body.jsm'),
        turretJSM.loadFromFile('models/tank_turret.jsm'),
        barrelJSM.loadFromFile('models/tank_barrel.jsm')
      ]);

      this.body = bodyJSM;
      this.turret = turretJSM;
      this.barrel = barrelJSM;
    } catch (e) {
      console.warn('Failed to load JSM models, falling back to procedural boxes.', e);
    }
  }

  /**
   * Updates physics and syncs mesh transforms.
   */
  update(ts: number, moveDir: { x: number, y: number }, fireNormal: boolean, fireGrenade: boolean, cameraYaw: number = 0, cameraPitch: number = 0, level?: Environment): { normal: boolean, grenade: boolean } {
    const speed = 10;
    const rotSpeed = 1.8;

    let didShootNormal = false;
    let didShootGrenade = false;

    if (fireNormal && this.shellRecoil <= 0) {
      this.shellRecoil = 1.0;
      didShootNormal = true;
    }

    if (fireGrenade && this.grenadeRecoil <= 0) {
      this.grenadeRecoil = 1.0;
      didShootGrenade = true;
    }

    this.shellRecoil -= (ts / 1000) * 5; 
    if (this.shellRecoil < 0) this.shellRecoil = 0;

    this.grenadeRecoil -= (ts / 1000) * 2; // Grenades have slower fire rate
    if (this.grenadeRecoil < 0) this.grenadeRecoil = 0;
    
    // Steering Logic
    const targetAngularVelY = -moveDir.x * rotSpeed;
    const joltAngVel = new Gfx3Jolt.Vec3(0, targetAngularVelY, 0);
    gfx3JoltManager.bodyInterface.SetAngularVelocity(this.physicsBody.body.GetID(), joltAngVel);

    // Get physics rotation to extract current yaw
    const currentRot = this.physicsBody.body.GetRotation();
    const currentPhysQ = new Quaternion(currentRot.GetW(), currentRot.GetX(), currentRot.GetY(), currentRot.GetZ());
    
    // Propperly extract world yaw from the physics body orientation
    // We look at where the mesh forward (-Z) is pointing.
    const meshForward = currentPhysQ.rotateVector([0, 0, -1]);
    const physYaw = Math.atan2(meshForward[0], -meshForward[2]);
    
    this.rotation = physYaw; 
    
    const throttle = moveDir.y;
    const targetVelocity = throttle * speed;
    const accelRate = throttle !== 0 ? 0.05 : 0.1;
    this.velocity = UT.LERP(this.velocity, targetVelocity, accelRate);

    // Physics Update - Move along mesh forward (-Z direction at rotation 0)
    const forward = [Math.sin(this.rotation), 0, -Math.cos(this.rotation)] as vec3;
    const linVel = UT.VEC3_SCALE(forward, this.velocity);
    
    const curVel = this.physicsBody.body.GetLinearVelocity();
    
    // Instead of hard-setting velocity which fights the collision solver, 
    // we use a PD controller approach (adding forces) to approach the target velocity.
    const mass = 3000.0; // matching mMassPropertiesOverride
    const velDiffX = linVel[0] - curVel.GetX();
    const velDiffZ = linVel[2] - curVel.GetZ();
    
    // Proportional gain for the velocity controller - reduced for a "heavier" inertia feel
    const kp = 4.0; 
    const maxForce = 50000.0; // Higher force needed to move 3000kg
    const forceX = Math.max(-maxForce, Math.min(maxForce, velDiffX * mass * kp));
    const forceZ = Math.max(-maxForce, Math.min(maxForce, velDiffZ * mass * kp));
    
    const joltForce = new Gfx3Jolt.Vec3(forceX, 0, forceZ);
    gfx3JoltManager.bodyInterface.AddForce(this.physicsBody.body.GetID(), joltForce, Gfx3Jolt.EActivation_Activate);
    
    const pos = this.physicsBody.body.GetPosition();

    // Grounding failsafe (optimized for flat terrain)
    const bottomY = pos.GetY() - 0.75; // Physics center is at 0.75
    if (bottomY < -0.05) { // If bottom is below flat ground (y=0)
        const penetration = -0.05 - bottomY;
        const upForce = penetration * 40000; // Strong push back to surface
        gfx3JoltManager.bodyInterface.AddForce(this.physicsBody.body.GetID(), new Gfx3Jolt.Vec3(0, upForce, 0), Gfx3Jolt.EActivation_Activate);
        // Kill downward momentum
        const currentVel = this.physicsBody.body.GetLinearVelocity();
        if (currentVel.GetY() < 0) {
            gfx3JoltManager.bodyInterface.SetLinearVelocity(this.physicsBody.body.GetID(), new Gfx3Jolt.Vec3(currentVel.GetX(), 0, currentVel.GetZ()));
        }
    }

    const visualYawQ = Quaternion.createFromEuler(this.rotation, 0, 0, 'YXZ');
    
    // Get ground normal from a single center ray - much more stable than 4 corners for physics
    let targetUp: vec3 = [0, 1, 0];
    const ray = gfx3JoltManager.createRay(pos.GetX(), pos.GetY() + 0.5, pos.GetZ(), pos.GetX(), pos.GetY() - 2.5, pos.GetZ());
    if (ray.normal && ray.normal.GetY() > 0.5) {
        targetUp = [ray.normal.GetX(), ray.normal.GetY(), ray.normal.GetZ()];
    }
    
    // Smoothly lerp the current up vector towards the ground normal
    this.currentUp = UT.VEC3_LERP(this.currentUp, targetUp, 6.0 * (ts / 1000));
    this.currentUp = UT.VEC3_NORMALIZE(this.currentUp);

    const up: vec3 = [0, 1, 0];
    let axis = UT.VEC3_CROSS(up, this.currentUp);
    const dot = UT.VEC3_DOT(up, this.currentUp);
    
    let visualQ = visualYawQ;
    // Only align visuals if there's a valid angle
    if (UT.VEC3_LENGTH(axis) > 0.001 && Math.abs(dot) < 0.999) {
        axis = UT.VEC3_NORMALIZE(axis);
        const clampedDot = Math.max(-1, Math.min(1, dot));
        const angle = Math.acos(clampedDot);
        const alignQ = Quaternion.createFromAxisAngle(axis, angle);
        visualQ = alignQ.mul(visualYawQ.w, visualYawQ.x, visualYawQ.y, visualYawQ.z); 
    }

    // Sync Visual State for draw()
    // Physics center is at 0.75 from bottom (Height 1.5). Visual center is at 0.45 from bottom.
    // Offset = -0.75 + 0.45 = -0.3
    this.visualPos = [pos.GetX(), pos.GetY() - 0.3, pos.GetZ()];
    this.visualQ = visualQ;
    
    // Update Turret Yaw to follow camera (0 = -Z in atan2(x, -z) space)
    this.turretYaw = cameraYaw;
    
    return { normal: didShootNormal, grenade: didShootGrenade };
  }

  /**
   * Returns the exact world position and direction of the barrel tip.
   * Calculated using the same hierarchical logic as draw() for perfect sync.
   */
  getMuzzleData(cameraPitch: number = 0): { muzzlePos: vec3, dir: vec3 } {
    const scale: vec3 = [1, 1, 1];
    const ZERO: vec3 = [0, 0, 0];
    const ID_QUAT = new Quaternion();

    // Hull Matrix
    const matHull = UT.MAT4_TRANSFORM(this.visualPos, ZERO, scale, this.visualQ);
    
    // Turret Matrix (Relative to Hull)
    const bodyForward = this.visualQ.rotateVector([0, 0, -1]);
    const bodyYaw = Math.atan2(bodyForward[0], -bodyForward[2]);
    const localYaw = ANGLE_DISTANCE(bodyYaw, this.turretYaw);
    const localYawQ = Quaternion.createFromEuler(-localYaw, 0, 0, 'YXZ');
    const matTurretLocal = UT.MAT4_TRANSFORM([0, 0.825, 0.15], ZERO, scale, localYawQ);
    const matTurretWorld = UT.MAT4_MULTIPLY(matHull, matTurretLocal);

    // Barrel Matrix (Relative to Turret)
    const visualRecoil = this.shellRecoil > 0 ? this.shellRecoil * 0.45 : 0;
    const clampedPitch = Math.max(-0.3, Math.min(0.25, cameraPitch));
    const localPitchQ = Quaternion.createFromEuler(0, -clampedPitch, 0, 'YXZ');
    const matBarrelLocal = UT.MAT4_TRANSFORM([0, 0.1, -1.2 + visualRecoil], ZERO, scale, localPitchQ);
    const matBarrelWorld = UT.MAT4_MULTIPLY(matTurretWorld, matBarrelLocal);

    // Tip Offset (-Z)
    // Barrel mesh is 2.25 units deep. We push it 0.5 units further out to avoid self-collision.
    const tipOffset = -1.625; 
    const muzzlePos = UT.MAT4_MULTIPLY_BY_VEC3(matBarrelWorld, [0, 0, tipOffset]);
    const dir = UT.VEC3_NORMALIZE(UT.VEC3_SUBSTRACT(muzzlePos, UT.MAT4_MULTIPLY_BY_VEC3(matBarrelWorld, [0, 0, 0])));

    return { muzzlePos, dir };
  }

  /**
   * Renders all tank components using hierarchical matrix transformations.
   * This ensures all parts remain perfectly locked to the hull regardless of frame jitter.
   */
  draw(cameraPitch: number = 0) {
    const scale: vec3 = [1, 1, 1];
    const ZERO: vec3 = [0, 0, 0];
    const ID_QUAT = new Quaternion();
    
    // 1. Hull - World Matrix
    // Note: We use the visuals stored in update() to ensure ground-alignment is preserved.
    const matHull = UT.MAT4_TRANSFORM(this.visualPos, ZERO, scale, this.visualQ);
    gfx3MeshRenderer.drawMesh(this.body, matHull);

    // 2. Tracks (Relative to Hull)
    const matTrackL_World = UT.MAT4_MULTIPLY(matHull, UT.MAT4_TRANSFORM([-1.425, -0.05, 0], ZERO, scale, ID_QUAT));
    gfx3MeshRenderer.drawMesh(this.trackL, matTrackL_World);

    const matTrackR_World = UT.MAT4_MULTIPLY(matHull, UT.MAT4_TRANSFORM([1.425, -0.05, 0], ZERO, scale, ID_QUAT));
    gfx3MeshRenderer.drawMesh(this.trackR, matTrackR_World);

    // 3. Engine (Relative to Hull)
    const matEngine_World = UT.MAT4_MULTIPLY(matHull, UT.MAT4_TRANSFORM([0, 0.3, 1.8], ZERO, scale, ID_QUAT));
    gfx3MeshRenderer.drawMesh(this.engine, matEngine_World);

    // 4. Turret (Relative to Hull)
    const bodyForward = this.visualQ.rotateVector([0, 0, -1]);
    const bodyYaw = Math.atan2(bodyForward[0], -bodyForward[2]);
    const localYaw = ANGLE_DISTANCE(bodyYaw, this.turretYaw);
    const localYawQ = Quaternion.createFromEuler(-localYaw, 0, 0, 'YXZ');

    const matTurretLocal = UT.MAT4_TRANSFORM([0, 0.825, 0.15], ZERO, scale, localYawQ);
    const matTurretWorld = UT.MAT4_MULTIPLY(matHull, matTurretLocal);
    gfx3MeshRenderer.drawMesh(this.turret, matTurretWorld);

    // 5. Barrel (Relative to Turret)
    const visualRecoil = this.shellRecoil > 0 ? this.shellRecoil * 0.45 : 0;
    const maxDepress = 0.25; 
    const maxElevate = 0.3;
    const clampedPitch = Math.max(-maxElevate, Math.min(maxDepress, cameraPitch));
    const localPitchQ = Quaternion.createFromEuler(0, -clampedPitch, 0, 'YXZ');

    const matBarrelLocal = UT.MAT4_TRANSFORM([0, 0.1, -1.2 + visualRecoil], ZERO, scale, localPitchQ);
    const matBarrelWorld = UT.MAT4_MULTIPLY(matTurretWorld, matBarrelLocal);
    gfx3MeshRenderer.drawMesh(this.barrel, matBarrelWorld);

    // 6. Accessories (Relative to Turret)
    const matHatchWorld = UT.MAT4_MULTIPLY(matTurretWorld, UT.MAT4_TRANSFORM([-0.3, 0.375, -0.2], ZERO, scale, ID_QUAT));
    gfx3MeshRenderer.drawMesh(this.hatch, matHatchWorld);

    const matAntennaWorld = UT.MAT4_MULTIPLY(matTurretWorld, UT.MAT4_TRANSFORM([0.4, 0.375, -0.4], ZERO, scale, ID_QUAT));
    gfx3MeshRenderer.drawMesh(this.antenna, matAntennaWorld);
  }
}

