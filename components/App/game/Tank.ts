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

    this.physicsBody = gfx3JoltManager.addCylinder({
      radius: 1.3, height: 0.8,
      x: 0, y: 0.5, z: 0,
      motionType: Gfx3Jolt.EMotionType_Dynamic,
      layer: JOLT_LAYER_MOVING,
      settings: { 
        mAngularDamping: 4.0, 
        mLinearDamping: 2.0, 
        mMassPropertiesOverride: 3000.0,
        mFriction: 0.05,     // Negligible friction for extremely slick sliding against obstacles
        mRestitution: 0.05   // Very low bounce
      } 
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
    const rotSpeed = 2.0;

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
    
    // 1. Activate body if we have input/movement intentions to wake up from Jolt sleep
    if (moveDir.x !== 0.0 || moveDir.y !== 0.0) {
      gfx3JoltManager.bodyInterface.ActivateBody(this.physicsBody.body.GetID());
    }

    // Steering Logic - Directly integrate user input into rotation yaw
    this.rotation += moveDir.x * rotSpeed * (ts / 1000);
    const PI2 = Math.PI * 2;
    this.rotation = (this.rotation + Math.PI) % PI2;
    if (this.rotation < 0) this.rotation += PI2;
    this.rotation -= Math.PI;

    // Enforce flat physics rotation (0 pitch/roll) to completely prevent tilted physical corners from penetrating the floor mesh and causing the tank to get stuck
    const qLock = Quaternion.createFromEuler(this.rotation, 0, 0, 'YXZ');
    const joltQuat = new Gfx3Jolt.Quat(qLock.x, qLock.y, qLock.z, qLock.w);
    gfx3JoltManager.bodyInterface.SetRotation(this.physicsBody.body.GetID(), joltQuat, Gfx3Jolt.EActivation_Activate);
    
    // Ensure Jolt's internal angular velocity is zeroed out to prevent any solver-induced rotation battles
    gfx3JoltManager.bodyInterface.SetAngularVelocity(this.physicsBody.body.GetID(), new Gfx3Jolt.Vec3(0, 0, 0));
    
    const throttle = moveDir.y;
    const targetVelocity = throttle * speed;
    const accelRate = throttle !== 0 ? 0.08 : 0.15; // Snappier acceleration
    this.velocity = UT.LERP(this.velocity, targetVelocity, accelRate);

    // Physics Update - Move along mesh forward (-Z direction at rotation 0)
    const forward = [Math.sin(this.rotation), 0, -Math.cos(this.rotation)] as vec3;
    const linVel = UT.VEC3_SCALE(forward, this.velocity);
    
    const pos = this.physicsBody.body.GetPosition();
    const curVel = this.physicsBody.body.GetLinearVelocity();
    
    // Whiskers multi-raycast sliding prediction to prevent wall phasing completely!
    let finalLinVel = [linVel[0], linVel[2]];
    const speedLen = Math.sqrt(linVel[0] * linVel[0] + linVel[2] * linVel[2]);
    if (speedLen > 0.01) {
        const dx = linVel[0] / speedLen;
        const dz = linVel[2] / speedLen;
        
        // 3 directions: center (0°), left (-30°), right (+30°)
        const dirs = [
            [dx, dz],
            [dx * 0.866 - dz * 0.5, dx * 0.5 + dz * 0.866],
            [dx * 0.866 + dz * 0.5, -dx * 0.5 + dz * 0.866]
        ];
        
        const rayLength = 1.3 + 0.45; // radius (1.3) + padding (0.45)
        
        for (const dir of dirs) {
            const startX = pos.GetX();
            const startY = pos.GetY();
            const startZ = pos.GetZ();
            
            const endX = startX + dir[0] * rayLength;
            const endY = startY;
            const endZ = startZ + dir[1] * rayLength;
            
            const ray = gfx3JoltManager.createRay(startX, startY, startZ, endX, endY, endZ);
            if (ray.body && ray.normal) {
                const hitBodyId = ray.body.GetID().GetIndex();
                const ourBodyId = this.physicsBody.body.GetID().GetIndex();
                if (hitBodyId !== ourBodyId) {
                    const nx = ray.normal.GetX();
                    const nz = ray.normal.GetZ();
                    const nLen = Math.sqrt(nx * nx + nz * nz);
                    if (nLen > 0.001) {
                        const hnx = nx / nLen;
                        const hnz = nz / nLen;
                        
                        // Dot product between desired velocity and normal
                        const dot = finalLinVel[0] * hnx + finalLinVel[1] * hnz;
                        if (dot < 0) {
                            // Substract the component that pushes into the wall
                            finalLinVel[0] -= dot * hnx;
                            finalLinVel[1] -= dot * hnz;
                        }
                    }
                }
            }
        }
    }
    
    // Direct velocity assignment ensures perfect responsiveness and bypasses high friction values,
    // while keeping gravity or vertical recoil impulses (curVel.GetY()) fully managed.
    const runVel = new Gfx3Jolt.Vec3(finalLinVel[0], curVel.GetY(), finalLinVel[1]);
    gfx3JoltManager.bodyInterface.SetLinearVelocity(this.physicsBody.body.GetID(), runVel);

    // Grounding failsafe (Softened to avoid popping, helps when clipped or airborne)
    const bottomY = pos.GetY() - 0.4; 
    if (bottomY < -0.1) { 
        const penetration = -0.1 - bottomY;
        const upForce = penetration * 20000; // Softer correction
        gfx3JoltManager.bodyInterface.AddImpulse(this.physicsBody.body.GetID(), new Gfx3Jolt.Vec3(0, upForce * (ts/1000), 0));
        
        // Dampen downward velocity if penetrating
        if (curVel.GetY() < -1.0) {
            gfx3JoltManager.bodyInterface.SetLinearVelocity(this.physicsBody.body.GetID(), new Gfx3Jolt.Vec3(curVel.GetX(), curVel.GetY() * 0.8, curVel.GetZ()));
        }
    }

    const visualYawQ = Quaternion.createFromEuler(this.rotation, 0, 0, 'YXZ');
    
    // Improved Ground Mapping: Cast a ray to find the surface normal
    let targetUp: vec3 = [0, 1, 0];
    // Start raycast slightly below the physical bottom (0.4 below center) to avoid hitting ourselves
    const startY = pos.GetY() - 0.42;
    const ray = gfx3JoltManager.createRay(pos.GetX(), startY, pos.GetZ(), pos.GetX(), pos.GetY() - 3.0, pos.GetZ());
    
    // Only accept normals that are mostly vertical (> 45 degrees) to ignore walls
    if (ray.normal && ray.normal.GetY() > 0.707) {
        // Double check we didn't hit our own body ID in case of overlaps
        const hitBodyId = ray.body ? ray.body.GetID().GetIndex() : -1;
        const ourBodyId = this.physicsBody.body.GetID().GetIndex();
        if (hitBodyId !== ourBodyId) {
            targetUp = [ray.normal.GetX(), ray.normal.GetY(), ray.normal.GetZ()];
        }
    }
    
    // Smoothly lerp towards ground orientation
    this.currentUp = UT.VEC3_LERP(this.currentUp, targetUp, 8.0 * (ts / 1000));
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
    // Physics center is at 0.4 from bottom (Height 0.8). Visual center is at 0.45 from bottom.
    // Offset = -0.4 + 0.45 = +0.05
    this.visualPos = [pos.GetX(), pos.GetY() + 0.05, pos.GetZ()];
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
    // Barrel mesh is 2.25 units deep. We push it 1.5 units FURTHER out to avoid self-collision when turning.
    const tipOffset = -3.0; 
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

