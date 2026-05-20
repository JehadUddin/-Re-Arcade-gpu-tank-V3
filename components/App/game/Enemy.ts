import { JOLT_LAYER_MOVING, JOLT_RVEC3_TO_VEC3, Gfx3Jolt, gfx3JoltManager } from '@lib/gfx3_jolt/gfx3_jolt_manager';
import { Gfx3Mesh } from '@lib/gfx3_mesh/gfx3_mesh';
import { Gfx3MeshJSM } from '@lib/gfx3_mesh/gfx3_mesh_jsm';
import { gfx3MeshRenderer } from '@lib/gfx3_mesh/gfx3_mesh_renderer';
import { Quaternion } from '@lib/core/quaternion';
import { UT } from '@lib/core/utils';
import { createBoxMesh, createUnitBoxMesh } from './GameUtils';

/**
 * The Enemy class represents an AI-controlled tank.
 * It uses static shared meshes for better performance across many instances.
 */
export class Enemy {
  static bodyMesh: Gfx3Mesh;
  static turretMesh: Gfx3Mesh;
  static barrelMesh: Gfx3Mesh;
  static trackLMesh: Gfx3Mesh;
  static trackRMesh: Gfx3Mesh;
  static engineMesh: Gfx3Mesh;
  static hatchMesh: Gfx3Mesh;
  static antennaMesh: Gfx3Mesh;
  static projMesh: Gfx3Mesh;
  static hpGreen: Gfx3Mesh;
  static hpRed: Gfx3Mesh;
  static initialized = false;

  /**
   * Initializes shared meshes for all enemy instances.
   * Supports falling back to procedural boxes if JSM files are missing.
   */
  static async initMeshes() {
    if (Enemy.initialized) return;
    
    const bodyJSM = new Gfx3MeshJSM();
    const turretJSM = new Gfx3MeshJSM();
    const barrelJSM = new Gfx3MeshJSM();

    try {
      await Promise.all([
        bodyJSM.loadFromFile('models/tank_body.jsm'),
        turretJSM.loadFromFile('models/tank_turret.jsm'),
        barrelJSM.loadFromFile('models/tank_barrel.jsm')
      ]);

      Enemy.bodyMesh = bodyJSM;
      Enemy.turretMesh = turretJSM;
      Enemy.barrelMesh = barrelJSM;
    } catch (e) {
      console.warn('Enemy: Failed to load JSM models, falling back to boxes.', e);
      
      const chassisColor: [number, number, number] = [0.8, 0.2, 0.2]; 
      const turretColor: [number, number, number] = [0.6, 0.1, 0.1];
      Enemy.bodyMesh = createBoxMesh(2.25, 0.9, 3.3, chassisColor);
      Enemy.turretMesh = createBoxMesh(1.65, 0.75, 1.65, turretColor);
      Enemy.barrelMesh = createBoxMesh(0.3, 0.3, 2.25, [0.2, 0.2, 0.2]);
    }

    const trackColor: [number, number, number] = [0.15, 0.15, 0.15];
    const engineColor: [number, number, number] = [0.2, 0.2, 0.2];
    Enemy.trackLMesh = createBoxMesh(0.6, 0.9, 3.6, trackColor);
    Enemy.trackRMesh = createBoxMesh(0.6, 0.9, 3.6, trackColor);
    Enemy.engineMesh = createBoxMesh(1.8, 0.6, 0.9, engineColor);
    Enemy.hatchMesh = createBoxMesh(0.6, 0.15, 0.6, [0.15, 0.15, 0.15]);
    Enemy.antennaMesh = createBoxMesh(0.05, 1.5, 0.05, [0.1, 0.1, 0.1]);
    Enemy.projMesh = createBoxMesh(0.6, 0.6, 0.6, [1.0, 0.2, 0.0]);
    Enemy.hpGreen = createUnitBoxMesh([0, 1, 0]);
    Enemy.hpRed = createUnitBoxMesh([1, 0, 0]);

    Enemy.initialized = true;
  }

  physicsBody: any;
  
  rotation: number = 0;
  visualPos: vec3 = [0, 0, 0];
  visualQ: Quaternion = new Quaternion();
  recoil: number = 0;
  shootCooldown: number = 0;
  hp: number = 100;
  currentUp: vec3 = [0, 1, 0];
  
  constructor(x: number, y: number, z: number) {
    if (!Enemy.initialized) {
       Enemy.initMeshes(); 
    }

    // Dimensions match player Tank for consistency
    // Hull(2.25, 0.9, 3.3) + 2*Tracks(0.6, 0.9, 3.6) = 3.45 width, 3.6 depth
    this.physicsBody = gfx3JoltManager.addBox({
      width: 3.45, height: 1.5, depth: 3.6, 
      x, y, z,
      motionType: Gfx3Jolt.EMotionType_Dynamic,
      layer: JOLT_LAYER_MOVING,
      settings: { mAngularDamping: 5.0, mLinearDamping: 2.0, mMassPropertiesOverride: 3000.0 }
    });
  }


  update(ts: number, targetPos: any, level?: Environment): { didShoot: boolean, muzzlePos?: vec3, dir?: vec3 } {
    if (this.hp <= 0) return { didShoot: false };

    this.recoil -= (ts / 1000) * 5; 
    if (this.recoil < 0) this.recoil = 0;
    
    this.shootCooldown -= ts / 1000;

    // Jolt Logic
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
    
    const myPos = JOLT_RVEC3_TO_VEC3(pos);
    
    const dx = targetPos[0] - myPos[0];
    const dz = targetPos[2] - myPos[2];
    const dist = Math.sqrt(dx*dx + dz*dz);
    
    const targetAngle = Math.atan2(-dx, -dz);
    
    // Smooth rotation towards target
    const PI2 = Math.PI * 2;
    let angleDiff = (targetAngle - this.rotation) % PI2;
    if (angleDiff > Math.PI) angleDiff -= PI2;
    if (angleDiff < -Math.PI) angleDiff += PI2;
    
    const rotSpeed = 2.0;    
    
    // Use SetAngularVelocity for stable steering
    const joltAngVel = new Gfx3Jolt.Vec3(0, Math.sign(angleDiff) * Math.min(Math.abs(angleDiff) * 5.0, rotSpeed), 0);
    gfx3JoltManager.bodyInterface.SetAngularVelocity(this.physicsBody.body.GetID(), joltAngVel);

    // Update this.rotation from the actual physics body to prevent visual drift
    const currentRot = this.physicsBody.body.GetRotation();
    const qPhys = new Quaternion(currentRot.GetW(), currentRot.GetX(), currentRot.GetY(), currentRot.GetZ());
    const [[ax, ay, az], angle] = qPhys.toAxisAngle();
    this.rotation = ay > 0 ? angle : -angle; 

    // Simple Chase - Stop when close
    const speed = 5;
    let throttle = 0;
    if (dist > 15) {
        throttle = 1; // Move forward
    } else if (dist < 10) {
        throttle = -0.5; // Back up a bit
    }

    const forward = [Math.sin(this.rotation), 0, -Math.cos(this.rotation)] as vec3;
    const linVel = UT.VEC3_SCALE(forward, throttle * speed);
    
    const curVel = this.physicsBody.body.GetLinearVelocity();
    
    const mass = 3000.0;
    const velDiffX = linVel[0] - curVel.GetX();
    const velDiffZ = linVel[2] - curVel.GetZ();
    const kp = 4.0;
    const maxForce = 40000.0;
    const forceX = Math.max(-maxForce, Math.min(maxForce, velDiffX * mass * kp));
    const forceZ = Math.max(-maxForce, Math.min(maxForce, velDiffZ * mass * kp));
    const joltForce = new Gfx3Jolt.Vec3(forceX, 0, forceZ);
    gfx3JoltManager.bodyInterface.AddForce(this.physicsBody.body.GetID(), joltForce, Gfx3Jolt.EActivation_Activate);
    
    const curPos = this.physicsBody.body.GetPosition();
    const visualYawQ = Quaternion.createFromEuler(this.rotation, 0, 0, 'YXZ');
    
    // Smooth banking visuals
    let targetUp: vec3 = [0, 1, 0];
    const ray = gfx3JoltManager.createRay(curPos.GetX(), curPos.GetY() + 0.5, curPos.GetZ(), curPos.GetX(), curPos.GetY() - 2.5, curPos.GetZ());
    if (ray.normal && ray.normal.GetY() > 0.5) {
        targetUp = [ray.normal.GetX(), ray.normal.GetY(), ray.normal.GetZ()];
    }
    
    this.currentUp = UT.VEC3_LERP(this.currentUp, targetUp, 6.0 * (ts / 1000));
    this.currentUp = UT.VEC3_NORMALIZE(this.currentUp);

    const up: vec3 = [0, 1, 0];
    let axis = UT.VEC3_CROSS(up, this.currentUp);
    const dot = UT.VEC3_DOT(up, this.currentUp);
    let visualQ = visualYawQ;
    if (UT.VEC3_LENGTH(axis) > 0.001 && Math.abs(dot) < 0.999) {
        axis = UT.VEC3_NORMALIZE(axis);
        const clampedDot = Math.max(-1, Math.min(1, dot));
        const angle = Math.acos(clampedDot);
        const alignQ = Quaternion.createFromAxisAngle(axis, angle);
        visualQ = alignQ.mul(visualYawQ.w, visualYawQ.x, visualYawQ.y, visualYawQ.z);
    }
    
    // Sync Visuals with Physics
    // Physics center is at 0.75 from bottom (Height 1.5). Visual center is at 0.45 from bottom.
    // Correct Offset = -0.75 + 0.45 = -0.3
    this.visualPos = [curPos.GetX(), curPos.GetY() - 0.3, curPos.GetZ()];
    this.visualQ = visualQ;

    let didShoot = false;
    let muzzlePos: vec3 | undefined = undefined;
    let dir: vec3 | undefined = undefined;

    // Shoot Logic
    if (dist < 40 && Math.abs(angleDiff) < 0.2 && this.shootCooldown <= 0) {
        const muzzleData = this.getMuzzleData(visualQ);
        muzzlePos = muzzleData.muzzlePos;
        dir = muzzleData.dir;
        this.shootCooldown = 2.5; // Slightly longer cooldown
        this.recoil = 1.0;
        didShoot = true;
    }
    
    return { didShoot, muzzlePos, dir };
  }
  
  getMuzzleData(q: Quaternion): { muzzlePos: vec3, dir: vec3 } {
    const ENEMY_SCALE = 1.0;
    const unitScale: vec3 = [1, 1, 1];
    const ZERO: vec3 = [0, 0, 0];
    const ID_QUAT = new Quaternion();
    
    const visualRecoil = this.recoil > 0 ? this.recoil * 0.45 : 0;
    
    // Hull Matrix (World)
    const matHull = UT.MAT4_TRANSFORM(this.visualPos, ZERO, [ENEMY_SCALE, ENEMY_SCALE, ENEMY_SCALE], this.visualQ);
    
    // Turret Matrix (Relative to Hull)
    // For enemy, turret doesn't have independent yaw yet, so use identity
    const matTurretLocal = UT.MAT4_TRANSFORM([0, 0.825, 0.15], ZERO, unitScale, ID_QUAT);
    const matTurretWorld = UT.MAT4_MULTIPLY(matHull, matTurretLocal);
    
    // Barrel Matrix (Relative to Turret)
    const matBarrelLocal = UT.MAT4_TRANSFORM([0, 0.1, -1.2 + visualRecoil], ZERO, unitScale, ID_QUAT);
    const matBarrelWorld = UT.MAT4_MULTIPLY(matTurretWorld, matBarrelLocal);
    
    // Tip Offset (-Z)
    // Barrel mesh is 2.25 units deep. We push it slightly further out to avoid self-collision.
    const tipOffset = -1.625;
    const muzzlePos = UT.MAT4_MULTIPLY_BY_VEC3(matBarrelWorld, [0, 0, tipOffset]);
    const dir = UT.VEC3_NORMALIZE(UT.VEC3_SUBSTRACT(muzzlePos, UT.MAT4_MULTIPLY_BY_VEC3(matBarrelWorld, [0, 0, 0])));
    
    return { muzzlePos, dir };
  }

  draw() {
    if (this.hp <= 0) return;

    const ENEMY_SCALE = 1.0;
    const scale: vec3 = [ENEMY_SCALE, ENEMY_SCALE, ENEMY_SCALE];
    const unitScale: vec3 = [1, 1, 1];
    const ZERO: vec3 = [0, 0, 0];
    const ID_QUAT = new Quaternion();

    // 1. Hull - World Matrix
    const matHull = UT.MAT4_TRANSFORM(this.visualPos, ZERO, scale, this.visualQ);
    gfx3MeshRenderer.drawMesh(Enemy.bodyMesh, matHull);

    // 2. Tracks (Relative to Hull)
    const matTrackL_Local = UT.MAT4_TRANSFORM([-1.425, -0.05, 0], ZERO, unitScale, ID_QUAT);
    const matTrackL_World = UT.MAT4_MULTIPLY(matHull, matTrackL_Local);
    gfx3MeshRenderer.drawMesh(Enemy.trackLMesh, matTrackL_World);

    const matTrackR_Local = UT.MAT4_TRANSFORM([1.425, -0.05, 0], ZERO, unitScale, ID_QUAT);
    const matTrackR_World = UT.MAT4_MULTIPLY(matHull, matTrackR_Local);
    gfx3MeshRenderer.drawMesh(Enemy.trackRMesh, matTrackR_World);

    // 3. Engine (Relative to Hull)
    const matEngine_Local = UT.MAT4_TRANSFORM([0, 0.3, 1.8], ZERO, unitScale, ID_QUAT);
    const matEngine_World = UT.MAT4_MULTIPLY(matHull, matEngine_Local);
    gfx3MeshRenderer.drawMesh(Enemy.engineMesh, matEngine_World);

    // 4. Turret (Relative to Hull) (Offset matches player)
    const matTurretLocal = UT.MAT4_TRANSFORM([0, 0.825, 0.15], ZERO, unitScale, ID_QUAT);
    const matTurretWorld = UT.MAT4_MULTIPLY(matHull, matTurretLocal);
    gfx3MeshRenderer.drawMesh(Enemy.turretMesh, matTurretWorld);

    // 5. Barrel (Relative to Turret)
    const visualRecoil = this.recoil > 0 ? this.recoil * 0.45 : 0;
    const matBarrelLocal = UT.MAT4_TRANSFORM([0, 0.1, -1.2 + visualRecoil], ZERO, unitScale, ID_QUAT);
    const matBarrelWorld = UT.MAT4_MULTIPLY(matTurretWorld, matBarrelLocal);
    gfx3MeshRenderer.drawMesh(Enemy.barrelMesh, matBarrelWorld);

    // 6. Accessories (Relative to Turret)
    const matHatchWorld = UT.MAT4_MULTIPLY(matTurretWorld, UT.MAT4_TRANSFORM([-0.3, 0.375, -0.2], ZERO, unitScale, ID_QUAT));
    gfx3MeshRenderer.drawMesh(Enemy.hatchMesh, matHatchWorld);

    const matAntennaWorld = UT.MAT4_MULTIPLY(matTurretWorld, UT.MAT4_TRANSFORM([0.4, 0.375, -0.4], ZERO, unitScale, ID_QUAT));
    gfx3MeshRenderer.drawMesh(Enemy.antennaMesh, matAntennaWorld);
  }
}
