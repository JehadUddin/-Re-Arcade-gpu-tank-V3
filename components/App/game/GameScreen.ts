/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState, useRef } from 'react';
import { em } from '@lib/engine/engine_manager';
import { screenManager } from '@lib/screen/screen_manager';
import { Screen } from '@lib/screen/screen';
import { gfx3Manager } from '@lib/gfx3/gfx3_manager';
import { gfx3MeshRenderer } from '@lib/gfx3_mesh/gfx3_mesh_renderer';
import { coreManager, SizeMode } from '@lib/core/core_manager';
import { gfx3PostRenderer, PostParam } from '@lib/gfx3_post/gfx3_post_renderer';
import { gfx3JoltManager, JOLT_LAYER_MOVING, JOLT_RVEC3_TO_VEC3, VEC3_TO_JOLT_RVEC3, Gfx3Jolt } from '@lib/gfx3_jolt/gfx3_jolt_manager';
import { Gfx3Camera } from '@lib/gfx3_camera/gfx3_camera';
import { Gfx3Mesh } from '@lib/gfx3_mesh/gfx3_mesh';
import { Quaternion } from '@lib/core/quaternion';
import { UT } from '@lib/core/utils';
import { eventManager } from '@lib/core/event_manager';
import { Gfx3Drawable, Gfx3MeshEffect } from '@lib/gfx3/gfx3_drawable';
import { inputManager } from '@lib/input/input_manager';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Bomb, LogIn, LogOut } from 'lucide-react';
import { Tank } from './Tank';
import { Environment } from './Environment';
import { Enemy } from './Enemy';
import { Explosion } from './Explosion';
import { createBoxMesh } from './GameUtils';
import { ObjectPool } from '@lib/core/object_pool';

// --- PROJECTILE SYSTEM ---
export enum ProjectileType {
  SHELL = 'shell',
  GRENADE = 'grenade'
}

export interface Projectile {
  body: any;
  life: number;
  type: ProjectileType;
  ownerId: string;
  mesh: Gfx3Mesh;
  lastVel: vec3;
}

export class GameScreen extends Screen {
  camera: Gfx3Camera;
  tank: Tank;
  level: Environment;
  enemies: Enemy[] = [];
  explosions: Explosion[] = [];
  explosionPool: ObjectPool<Explosion>;
  projectiles: Projectile[] = [];
  shellMesh: Gfx3Mesh;
  grenadeMesh: Gfx3Mesh;
  moveDir = { x: 0, y: 0 };
  virtualFireNormal: boolean = false;
  virtualFireGrenade: boolean = false;
  wasFiring = false;
  
  cameraYaw = 0; 
  cameraPitch = 0.2;
  cameraDistance = 12;
  isReady: boolean = false;
  cameraLookTarget: vec3 = [0, 0, 0];
  rightClickFire: boolean = false;
  
  constructor() {
    super();
    this.camera = new Gfx3Camera(0);
    this.tank = new Tank();
    this.level = new Environment();
    
    this.explosionPool = new ObjectPool<Explosion>(new Explosion(), 600, (obj: Explosion) => {
        obj.active = false;
        return {};
    });

    // Projectiles
    this.projectiles = [];
    
    // Create base meshes for projectiles
    this.shellMesh = createBoxMesh(0.4, 0.4, 0.6, [1.0, 0.8, 0.2]); // Visible golden shell
    this.grenadeMesh = createBoxMesh(0.6, 0.6, 0.6, [0.4, 0.4, 0.4]); // Grenade body

    // Spawn exactly 3 enemies as requested
    while (this.enemies.length < 3) {
       const x = (Math.random() - 0.5) * 120;
       const z = (Math.random() - 0.5) * 120;
       if (Math.abs(x) < 25 && Math.abs(z) < 25) continue;
       this.enemies.push(new Enemy(x, 35, z));
    }

    if (typeof window !== 'undefined') {
       window.addEventListener('pointerdown', this.handleGlobalPointerDown);
       window.addEventListener('pointerup', this.handleGlobalPointerUp);
    }
  }

  handleGlobalPointerDown = (e: PointerEvent) => {
    if (e.button === 2) { // Right click
      if (inputManager.isPointerLockCaptured()) {
         this.rightClickFire = true;
      }
    }
  };

  handleGlobalPointerUp = (e: PointerEvent) => {
    if (e.button === 2) {
      this.rightClickFire = false;
    }
  };

  async onEnter() {
    // Fix canvas sizing bug - set to FULL mode
    coreManager.setSize(window.innerWidth, window.innerHeight, SizeMode.FULL);
    
    gfx3PostRenderer.setParam(PostParam.PIXELATION_ENABLED, 0.0);
    
    // Load Models
    await Promise.all([
      this.tank.load(),
      Enemy.initMeshes()
    ]);
    
    // Desktop Controls
    inputManager.registerAction('keyboard', 'KeyW', 'THR_FWD');
    inputManager.registerAction('keyboard', 'KeyS', 'THR_BWD');
    inputManager.registerAction('keyboard', 'KeyA', 'STR_LFT');
    inputManager.registerAction('keyboard', 'KeyD', 'STR_RGT');
    inputManager.registerAction('keyboard', 'KeyQ', 'CAM_L');
    inputManager.registerAction('keyboard', 'KeyC', 'CAM_R');
    inputManager.registerAction('keyboard', 'KeyR', 'CAM_Z_IN');
    inputManager.registerAction('keyboard', 'KeyF', 'CAM_Z_OUT');
    inputManager.registerAction('keyboard', 'Space', 'FIRE');
    inputManager.registerAction('keyboard', 'KeyG', 'FIRE_ALT'); 
    inputManager.registerAction('keyboard', 'ShiftLeft', 'FIRE_ALT'); 
    inputManager.registerAction('keyboard', 'KeyE', 'FIRE_ALT'); 
    // Mouse button mapping is handled via isMouseDown for Left, 
    // but we can register if we have button indices in InputSource, but currently we don't.
    // However handleGlobalPointerDown handles right click. 
    // Let's add Shift for grenade.

    inputManager.setPointerLockEnabled(true);
    eventManager.subscribe(inputManager, 'E_MOUSE_MOVE', this, this.handleMouseMove);

    this.camera.setPosition(0, 10, -10);
    this.camera.lookAt(0, 0, 0);
    this.camera.getView().setBgColor(0.53, 0.81, 0.92, 1.0); // Sky blue
    
    const tankPos = this.tank.body.getPosition();
    this.cameraLookTarget = [tankPos[0], tankPos[1] + 1.5, tankPos[2]];
    this.isReady = true;
  }

  handleMouseMove = (data: any) => {
    if (inputManager.isPointerLockCaptured() || inputManager.isMouseDown()) {
       this.cameraYaw -= data.movementX * 0.005;
       this.cameraPitch += data.movementY * 0.005;
       
       // Limit pitch to avoid flipping over and going way below ground
       this.cameraPitch = Math.max(-0.1, Math.min(Math.PI / 2 - 0.1, this.cameraPitch));
    }
  };

  update(ts: number) {
    inputManager.update(ts);
    gfx3JoltManager.update(ts);

    if (inputManager.isActiveAction('CAM_L')) this.cameraYaw -= 0.05;
    if (inputManager.isActiveAction('CAM_R')) this.cameraYaw += 0.05;
    if (inputManager.isActiveAction('CAM_Z_IN')) this.cameraDistance = Math.max(5, this.cameraDistance - 0.5);
    if (inputManager.isActiveAction('CAM_Z_OUT')) this.cameraDistance = Math.min(40, this.cameraDistance + 0.5);

    let kbX = 0;
    let kbY = 0;
    if (inputManager.isActiveAction('THR_FWD')) kbY += 1;
    if (inputManager.isActiveAction('THR_BWD')) kbY -= 1;
    if (inputManager.isActiveAction('STR_LFT')) kbX -= 1;
    if (inputManager.isActiveAction('STR_RGT')) kbX += 1;

    const combinedMoveDir = { 
      x: kbX + (Math.abs(this.moveDir.x) > 0.1 ? this.moveDir.x : 0),
      y: kbY + (Math.abs(this.moveDir.y) > 0.1 ? this.moveDir.y : 0)
    };
    
    combinedMoveDir.x = Math.max(-1, Math.min(1, combinedMoveDir.x));
    combinedMoveDir.y = Math.max(-1, Math.min(1, combinedMoveDir.y));

    const currentFiringInput = inputManager.isActiveAction('FIRE') || 
                          (inputManager.isMouseDown() && inputManager.isPointerLockCaptured() && !this.rightClickFire);
    const isFiringNormal = this.virtualFireNormal || currentFiringInput;
    const isFiringGrenade = this.virtualFireGrenade || this.rightClickFire || inputManager.isActiveAction('FIRE_ALT');

    this.level.update(ts);

    // Spawn Projectiles from Tank
    const shots = this.tank.update(ts, combinedMoveDir, isFiringNormal, isFiringGrenade, this.cameraYaw, this.cameraPitch, this.level);
    
    if (shots.normal) {
       this.handleTankShoot(ProjectileType.SHELL);
    }
    if (shots.grenade) {
       this.handleTankShoot(ProjectileType.GRENADE);
    }

    // Update Enemies & Spawn their projectiles
    const playerPos = this.tank.visualPos;
    for (const enemy of this.enemies) {
       const res = enemy.update(ts, playerPos, this.level);
       if (res.didShoot && res.muzzlePos && res.dir) {
           const quat = enemy.visualQ;
           this.spawnProjectile(ProjectileType.SHELL, res.muzzlePos[0], res.muzzlePos[1], res.muzzlePos[2], quat, 'enemy', 1.0);
           
           const exp = this.explosionPool.acquire() as Explosion;
           if (exp) {
               exp.reset(res.muzzlePos[0], res.muzzlePos[1], res.muzzlePos[2], [1.0, 0.5, 0.1], res.dir);
               this.explosions.push(exp);
           }
       }
    }
    
    // Update Shared Projectiles Logic
    this.updateProjectiles(ts);

    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
        const alive = this.explosions[i].update(ts);
        if (!alive) {
            this.explosionPool.dispose(this.explosions[i]);
            this.explosions.splice(i, 1);
        }
    }
    
    // Convert spherical to cartesian coords for the camera offset
    // Camera is pos relative to target
    const cy = this.cameraYaw;
    const cp = this.cameraPitch;
    
    // We add math to find offset pos based on orbit
    const camOffset = [
        Math.sin(cy) * Math.cos(cp) * this.cameraDistance,
        Math.sin(cp) * this.cameraDistance,
        Math.cos(cy) * Math.cos(cp) * this.cameraDistance
    ];
    
    const targetHeightOffset = 1.5;
    const followPos = playerPos;
    
    // Safety check for followPos to prevent NaN camera
    if (!followPos || isNaN(followPos[0]) || isNaN(followPos[1]) || isNaN(followPos[2])) {
        return;
    }

    const camTarget = [
        followPos[0] + camOffset[0],
        followPos[1] + camOffset[1] + targetHeightOffset,
        followPos[2] + camOffset[2]
    ] as vec3;
    
    const camPos = this.camera.getPosition();
    // Smooth frame-rate independent lerp
    const posLerpRate = 1.0 - Math.exp(-10.0 * (ts / 1000));
    const targetLerpRate = 1.0 - Math.exp(-15.0 * (ts / 1000));

    const lerpedPos = UT.VEC3_LERP(camPos, camTarget, posLerpRate);
    
    const desiredLookTarget = [followPos[0], followPos[1] + targetHeightOffset, followPos[2]] as vec3;
    this.cameraLookTarget = UT.VEC3_LERP(this.cameraLookTarget, desiredLookTarget, targetLerpRate);
    
    // Final NaN check before setting
    if (!isNaN(lerpedPos[0]) && !isNaN(lerpedPos[1]) && !isNaN(lerpedPos[2])) {
        let shakeX = 0, shakeY = 0, shakeZ = 0;
        const totalRecoil = this.tank.shellRecoil + this.tank.grenadeRecoil * 0.5;
        if (totalRecoil > 0) {
            const mag = totalRecoil * 0.1;
            shakeX = (Math.random() - 0.5) * mag;
            shakeY = (Math.random() - 0.5) * mag;
            shakeZ = (Math.random() - 0.5) * mag;
        }

        this.camera.setPosition(lerpedPos[0] + shakeX, lerpedPos[1] + shakeY, lerpedPos[2] + shakeZ);
        this.camera.lookAt(this.cameraLookTarget[0] + shakeX * 0.5, this.cameraLookTarget[1] + shakeY * 0.5, this.cameraLookTarget[2] + shakeZ * 0.5);
    }
  }

  handleTankShoot(type: ProjectileType) {
    const muzzle = this.tank.getMuzzleData(this.cameraPitch);
    const spawnX = muzzle.muzzlePos[0];
    const spawnY = muzzle.muzzlePos[1];
    const spawnZ = muzzle.muzzlePos[2];
    const dir = muzzle.dir;

    // Calculate orientation from muzzle direction
    const yaw = Math.atan2(-dir[0], -dir[2]);
    const pitch = Math.asin(dir[1]);
    const muzzleQ = Quaternion.createFromEuler(yaw, pitch, 0, 'YXZ');

    this.spawnProjectile(type, spawnX, spawnY, spawnZ, muzzleQ, 'player');
    
    // Muzzle Flash
    const exp = this.explosionPool.acquire() as Explosion;
    if (exp) {
        exp.reset(spawnX, spawnY, spawnZ, type === ProjectileType.GRENADE ? [1.0, 0.5, 0.2] : [1.0, 0.9, 0.3], dir, type === ProjectileType.GRENADE ? 2.5 : 1.5, 'muzzle');
        this.explosions.push(exp);
    }
  }

  draw() {
    gfx3MeshRenderer.drawDirLight([0.6, -1.0, 0.4], [1.0, 0.95, 0.85], [1.0, 1.0, 1.0], 1.2);
    gfx3MeshRenderer.setAmbientColor([0.4, 0.4, 0.45]);

    const camPos = this.camera.getPosition();
    this.level.draw(camPos);
    this.tank.draw(this.cameraPitch);
    for (const enemy of this.enemies) {
       enemy.draw();
    }
    for (const exp of this.explosions) {
       exp.draw();
    }

    // Draw active projectiles
    const scaleShell: vec3 = [1.5, 1.5, 1.5];
    const scaleGrenade: vec3 = [1.2, 1.2, 1.2];
    const ZERO: vec3 = [0, 0, 0];

    for (const p of this.projectiles) {
       const pPos = p.body.body.GetPosition();
       const pRot = p.body.body.GetRotation();
       const q = new Quaternion(pRot.GetW(), pRot.GetX(), pRot.GetY(), pRot.GetZ());
       
       const matProj = UT.MAT4_TRANSFORM(
           [pPos.GetX(), pPos.GetY(), pPos.GetZ()], 
           ZERO, 
           p.type === ProjectileType.GRENADE ? scaleGrenade : scaleShell, 
           q
       );
       gfx3MeshRenderer.drawMesh(p.mesh, matProj);
    }
  }

  spawnProjectile(type: ProjectileType, x: number, y: number, z: number, q: Quaternion, ownerId: string, speedMod: number = 1.0) {
    let finalY = y;
    let finalQ = q;

    const direction = finalQ.rotateVector([0, 0, -1]);
    const pMesh = type === ProjectileType.GRENADE ? this.grenadeMesh : this.shellMesh;
    
    // Physics body
    const pBody = gfx3JoltManager.addBox({
      width: type === ProjectileType.GRENADE ? 0.6 : 0.4,
      height: type === ProjectileType.GRENADE ? 0.6 : 0.4,
      depth: type === ProjectileType.GRENADE ? 0.6 : 0.6,
      x: x, y: finalY, z: z,
      rotation: new Gfx3Jolt.Quat(finalQ.x, finalQ.y, finalQ.z, finalQ.w),
      motionType: Gfx3Jolt.EMotionType_Dynamic,
      layer: JOLT_LAYER_MOVING,
      settings: { 
          mMassPropertiesOverride: 0.1, 
          mRestitution: 0.025 // Reduced bounce by 75%
      }
    });

    if (type === ProjectileType.SHELL) {
        gfx3JoltManager.bodyInterface.SetGravityFactor(pBody.body.GetID(), 0); // Shells never drop
    }

    let forwardSpeed = type === ProjectileType.GRENADE ? 30 : 120; // Faster shells for linear feel
    let upwardVel = type === ProjectileType.GRENADE ? 15 : 0;
    
    forwardSpeed *= speedMod;

    const pVel = new Gfx3Jolt.Vec3(
      direction[0] * forwardSpeed, 
      (direction[1] * forwardSpeed) + upwardVel, 
      direction[2] * forwardSpeed
    );
    gfx3JoltManager.bodyInterface.SetLinearVelocity(pBody.body.GetID(), pVel);

    if (type === ProjectileType.GRENADE) {
        const angVel = new Gfx3Jolt.Vec3((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40);
        gfx3JoltManager.bodyInterface.SetAngularVelocity(pBody.body.GetID(), angVel);
    }

    this.projectiles.push({
      body: pBody,
      life: 5.0,
      type,
      ownerId,
      mesh: pMesh,
      lastVel: [pVel.GetX(), pVel.GetY(), pVel.GetZ()]
    });
  }

  updateProjectiles(ts: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= ts / 1000;

      const pPos = p.body.body.GetPosition();
      const pPos3: vec3 = [pPos.GetX(), pPos.GetY(), pPos.GetZ()];
      const curV = p.body.body.GetLinearVelocity();

      if (p.life <= 0) {
        // Explode on life expiry for grenades
        if (p.type === ProjectileType.GRENADE) {
            this.onProjectileEnvironmentImpact(p, pPos3);
        }
        gfx3JoltManager.remove(p.body.bodyId);
        this.projectiles.splice(i, 1);
        continue;
      }
      
      // Trails
      if (p.type === ProjectileType.GRENADE && Math.random() < 0.15) {
          const exp = this.explosionPool.acquire() as Explosion;
          if (exp) {
              exp.reset(pPos3[0], pPos3[1], pPos3[2], [0.4, 0.4, 0.4], undefined, 1.2, 'trail');
              this.explosions.push(exp);
          }
      }

      // Check hits
      let destroyed = false;

      if (p.ownerId === 'player') {
          // Player projectiles vs Enemies
          for (const enemy of this.enemies) {
              if (enemy.hp <= 0) continue;
              const ePos = enemy.physicsBody.body.GetPosition();
              const dist = UT.VEC3_DISTANCE(pPos3, [ePos.GetX(), ePos.GetY() + 0.3, ePos.GetZ()]); // Offset y a bit to reach center of gravity
              
              if (dist < 3.5) {
                  this.onProjectileHit(p, enemy, pPos3);
                  destroyed = true;
                  break;
              }
          }
      } else {
          // Enemy projectiles vs Player
          const pPosPlayer = this.tank.visualPos;
          const distToPlayer = UT.VEC3_DISTANCE(pPos3, [pPosPlayer[0], pPosPlayer[1] + 0.5, pPosPlayer[2]]);
          if (distToPlayer < 3.5) {
              this.onProjectileHit(p, this.tank, pPos3);
              destroyed = true;
          }
      }

      if (!destroyed) {
          // Environment Impact (Ground or Walls)
          // Use vector distance to catch direction changes (bounces) effectively
          const velDiff = UT.VEC3_DISTANCE(p.lastVel, [curV.GetX(), curV.GetY(), curV.GetZ()]);
          // Grant 0.1s of immunity to impact detection (was 0.04s) and increase threshold
          const impacted = pPos.GetY() < -15.0 || (p.life < 4.90 && velDiff > 12);

          if (impacted) {
              this.onProjectileEnvironmentImpact(p, pPos3);
              destroyed = true;
          }
      }

      if (destroyed) {
          gfx3JoltManager.remove(p.body.bodyId);
          this.projectiles.splice(i, 1);
      } else {
          p.lastVel = [curV.GetX(), curV.GetY(), curV.GetZ()];
          
          // Self-orient shells (not grenades)
          if (p.type === ProjectileType.SHELL) {
             const velLen = Math.sqrt(curV.GetX()*curV.GetX() + curV.GetY()*curV.GetY() + curV.GetZ()*curV.GetZ());
             if (velLen > 0.1) {
                const dir = UT.VEC3_NORMALIZE([curV.GetX(), curV.GetY(), curV.GetZ()]);
                const yaw = Math.atan2(-dir[0], -dir[2]);
                const pitch = Math.asin(dir[1]);
                const q = Quaternion.createFromEuler(yaw, pitch, 0, 'YXZ');
                const joltQuat = new Gfx3Jolt.Quat(q.x, q.y, q.z, q.w);
                gfx3JoltManager.bodyInterface.SetRotation(p.body.body.GetID(), joltQuat, Gfx3Jolt.EActivation_Activate);
             }
          }
      }
    }
  }

  onProjectileHit(p: Projectile, target: any, hitPos: vec3) {
      const isEnemy = target instanceof Enemy;
      const dmg = p.type === ProjectileType.GRENADE ? 100 : 35;
      
      if (isEnemy) {
          target.hp -= dmg;
          const ePos = target.physicsBody.body.GetPosition();
          
          // Visuals
          const exp = this.explosionPool.acquire() as Explosion;
          if (exp) {
              exp.reset(hitPos[0], hitPos[1], hitPos[2], [1, 0.6, 0.2], undefined, p.type === ProjectileType.GRENADE ? 3.0 : 0.12);
              this.explosions.push(exp);
          }

          if (target.hp <= 0) {
              const expDeath = this.explosionPool.acquire() as Explosion;
              if (expDeath) {
                  expDeath.reset(ePos.GetX(), ePos.GetY(), ePos.GetZ(), [0.8, 0.2, 0.1], undefined, 2.5);
                  this.explosions.push(expDeath);
              }
              gfx3JoltManager.remove(target.physicsBody.bodyId);
          }
      } else {
          // Hit Player
          this.tank.hp -= dmg;
          const exp = this.explosionPool.acquire() as Explosion;
          if (exp) {
              exp.reset(hitPos[0], hitPos[1], hitPos[2], [1, 0.1, 0.1], undefined, 0.2);
              this.explosions.push(exp);
          }
          // Recoil/Shake for player
          this.tank.recoil = Math.max(this.tank.recoil, 0.5);
      }
      
      if (p.type === ProjectileType.GRENADE) {
          this.applyAOE(hitPos, 12, 100);
      }
  }

  onProjectileEnvironmentImpact(p: Projectile, pos: vec3) {
      const exp = this.explosionPool.acquire() as Explosion;
      if (exp) {
          const color: [number, number, number] = p.type === ProjectileType.GRENADE ? [0.8, 0.4, 0.1] : [0.6, 0.6, 0.6];
          exp.reset(pos[0], pos[1], pos[2], color, undefined, p.type === ProjectileType.GRENADE ? 4.0 : 1.0, p.type === ProjectileType.GRENADE ? 'grenade' : undefined);
          this.explosions.push(exp);
      }

      if (p.type === ProjectileType.GRENADE) {
          this.applyAOE(pos, 12, 100);
      }
  }

  applyAOE(origin: vec3, radius: number, damage: number) {
      // Affect enemies
      for (const enemy of this.enemies) {
          if (enemy.hp <= 0) continue;
          const ePos = enemy.physicsBody.body.GetPosition();
          const dist = UT.VEC3_DISTANCE(origin, [ePos.GetX(), ePos.GetY(), ePos.GetZ()]);
          if (dist < radius) {
              enemy.hp -= damage;
              // Push away
              const pushDir = UT.VEC3_NORMALIZE(UT.VEC3_SUBSTRACT([ePos.GetX(), ePos.GetY() + 0.5, ePos.GetZ()], origin));
              const pushForce = new Gfx3Jolt.Vec3(pushDir[0] * 2000, pushDir[1] * 1000, pushDir[2] * 2000);
              gfx3JoltManager.bodyInterface.AddImpulse(enemy.physicsBody.body.GetID(), pushForce);
              
              if (enemy.hp <= 0) {
                  gfx3JoltManager.remove(enemy.physicsBody.bodyId);
              }
          }
      }

      // Affect player
      const pPosPlayer = this.tank.visualPos;
      const distToPlayer = UT.VEC3_DISTANCE(origin, pPosPlayer);
      if (distToPlayer < radius) {
          this.tank.hp -= damage;
          this.tank.recoil = Math.max(this.tank.recoil, 1.0);
      }
  }

  render(ts: number) {
    if (!this.isReady) return;
    
    gfx3Manager.beginDrawing();
    this.draw();
    gfx3Manager.endDrawing();
    
    gfx3Manager.beginRender();
    gfx3Manager.beginPassRender(0); 
    gfx3MeshRenderer.render(ts);
    gfx3Manager.endPassRender();
    gfx3Manager.endRender();
  }
}