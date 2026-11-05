/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

interface ActiveTracer {
  line: THREE.Line;
  startPoint: THREE.Vector3;
  endPoint: THREE.Vector3;
  progress: number;
  duration: number;
}

interface ActiveFireball {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  timer: number;
  duration: number;
  maxScale: number;
}

interface SparkParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
}

export class VFXManager {
  private scene: THREE.Scene;

  // Active bullet tracers
  private activeTracers: ActiveTracer[] = [];
  private tracerMaterial: THREE.LineBasicMaterial;

  // Active 3D spherical fireballs from explosive barrels
  private activeFireballs: ActiveFireball[] = [];

  // Impact Sparks & Gore Particle System (Instanced / Points pool)
  private maxSparks = 500;
  private sparks: SparkParticle[] = [];
  private sparkGeo: THREE.BufferGeometry;
  private sparkPositions: Float32Array;
  private sparkColors: Float32Array;
  private sparkPoints: THREE.Points;
  private quality: 'standard' | 'optimized' = 'standard';

  // Muzzle flash 3D starburst mesh
  private muzzleFlashGroup: THREE.Group;
  private muzzleFlashLight: THREE.PointLight;
  private muzzleFlashTimer: number = 0;

  public setVisualQuality(quality: 'standard' | 'optimized') {
    this.quality = quality;
  }

  constructor(scene: THREE.Scene, weaponGroup: THREE.Group) {
    this.scene = scene;

    // 1. Tracer Material (Bright glowing yellow-orange)
    this.tracerMaterial = new THREE.LineBasicMaterial({
      color: 0xffd166,
      linewidth: 2,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });

    // 2. Spark Particle System
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkPositions = new Float32Array(this.maxSparks * 3);
    this.sparkColors = new Float32Array(this.maxSparks * 3);

    // Initialize all offscreen
    for (let i = 0; i < this.maxSparks; i++) {
      this.sparkPositions[i * 3 + 1] = -999;
      this.sparkColors[i * 3] = 1.0;
      this.sparkColors[i * 3 + 1] = 0.8;
      this.sparkColors[i * 3 + 2] = 0.2;
    }

    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    this.sparkGeo.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3));

    // Procedural glowing round spark texture
    const sparkCanvas = document.createElement('canvas');
    sparkCanvas.width = 32;
    sparkCanvas.height = 32;
    const sCtx = sparkCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 210, 80, 0.9)');
    grad.addColorStop(0.7, 'rgba(255, 90, 20, 0.4)');
    grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 32, 32);

    const sparkTex = new THREE.CanvasTexture(sparkCanvas);

    const sparkMat = new THREE.PointsMaterial({
      size: 0.22,
      map: sparkTex,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.sparkPoints = new THREE.Points(this.sparkGeo, sparkMat);
    scene.add(this.sparkPoints);

    // 3. Muzzle Flash Starburst Mesh (attached to pistol barrel)
    this.muzzleFlashGroup = new THREE.Group();
    // Tip of barrel is at (0, 0.04, -0.34) relative to weaponGroup
    this.muzzleFlashGroup.position.set(0, 0.04, -0.34);
    this.muzzleFlashGroup.visible = false;
    weaponGroup.add(this.muzzleFlashGroup);

    // Starburst cross-planes
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffe066,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const crossGeo = new THREE.PlaneGeometry(0.18, 0.18);
    const p1 = new THREE.Mesh(crossGeo, flashMat);
    this.muzzleFlashGroup.add(p1);

    const p2 = new THREE.Mesh(crossGeo, flashMat);
    p2.rotation.y = Math.PI / 2;
    this.muzzleFlashGroup.add(p2);

    const p3 = new THREE.Mesh(crossGeo, flashMat);
    p3.rotation.z = Math.PI / 4;
    this.muzzleFlashGroup.add(p3);

    // Intense local point light
    this.muzzleFlashLight = new THREE.PointLight(0xffb703, 0, 10);
    this.muzzleFlashGroup.add(this.muzzleFlashLight);
  }

  /**
   * Trigger muzzle flash at the pistol barrel
   */
  public triggerMuzzleFlash() {
    this.muzzleFlashGroup.visible = true;
    this.muzzleFlashGroup.rotation.z = Math.random() * Math.PI * 2;
    this.muzzleFlashLight.intensity = 4.5;
    this.muzzleFlashTimer = 0.055; // 55ms
  }

  /**
   * Spawn a fast glowing bullet tracer beam from muzzle to hit position
   */
  public spawnTracer(startWorldPos: THREE.Vector3, endWorldPos: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      startWorldPos.clone(),
      startWorldPos.clone(), // starts at muzzle, expands to end
    ]);

    const line = new THREE.Line(geo, this.tracerMaterial);
    this.scene.add(line);

    this.activeTracers.push({
      line,
      startPoint: startWorldPos.clone(),
      endPoint: endWorldPos.clone(),
      progress: 0,
      duration: 0.07, // 70ms fast beam travel
    });
  }

  /**
   * Spawn ricochet sparks and impact burst at hit point
   */
  public spawnImpactParticles(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    count = 12,
    isTarget = false
  ) {
    const finalCount = this.quality === 'optimized' ? Math.max(6, Math.floor(count * 0.6)) : count;
    for (let i = 0; i < finalCount; i++) {
      if (this.sparks.length >= this.maxSparks) break;

      // Reflect direction outward from normal with spread
      const spreadX = (Math.random() - 0.5) * 1.5;
      const spreadY = Math.random() * 1.2;
      const spreadZ = (Math.random() - 0.5) * 1.5;

      const vel = new THREE.Vector3(
        normal.x * 3.0 + spreadX * 2.0,
        normal.y * 3.0 + spreadY * 2.5 + 1.0,
        normal.z * 3.0 + spreadZ * 2.0
      );

      const color = isTarget
        ? new THREE.Color(1.0, 0.4 + Math.random() * 0.4, 0.1) // Target orange/yellow
        : new THREE.Color(1.0, 0.8 + Math.random() * 0.2, 0.3); // Metal/wall sparks

      this.sparks.push({
        position: point.clone().addScaledVector(normal, 0.04),
        velocity: vel,
        color,
        size: 0.2,
        life: 0.22 + Math.random() * 0.12,
        maxLife: 0.34,
      });
    }
  }

  /**
   * Spawn visceral dark blood / necrotic sludge splatter on zombie bullet hit
   */
  public spawnBloodSplatter(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    isHeadshot: boolean = false
  ) {
    const baseCount = isHeadshot ? 28 : 16;
    const count = this.quality === 'optimized' ? Math.floor(baseCount * 0.6) : baseCount;
    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= this.maxSparks) break;

      const spreadScale = isHeadshot ? 4.5 : 2.5;
      const vel = new THREE.Vector3(
        normal.x * 2.0 + (Math.random() - 0.5) * spreadScale,
        normal.y * 2.0 + Math.random() * spreadScale + (isHeadshot ? 2.5 : 1.0),
        normal.z * 2.0 + (Math.random() - 0.5) * spreadScale
      );

      // Dark crimson / necrotic zombie blood tint, with gold sparks if critical headshot
      const isGoldSpark = isHeadshot && Math.random() < 0.35;
      const color = isGoldSpark
        ? new THREE.Color(1.0, 0.85, 0.2) // Critical golden shimmer spark
        : new THREE.Color(0.65 + Math.random() * 0.25, 0.02, 0.05); // Visceral blood crimson

      this.sparks.push({
        position: point.clone().add(
          new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1)
        ),
        velocity: vel,
        color,
        size: isHeadshot ? 0.28 : 0.2,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
      });
    }
  }

  /**
   * Spawn rising ash ember particles when a zombie expires and dissolves into dust
   */
  public spawnZombieAshDissolve(center: THREE.Vector3) {
    const baseCount = 32;
    const count = this.quality === 'optimized' ? 18 : baseCount;
    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= this.maxSparks) break;

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        Math.random() * 2.5 + 1.2, // Rising upwards
        (Math.random() - 0.5) * 1.5
      );

      // Burnt ash / ember glow
      const isGlowingEmber = Math.random() < 0.45;
      const color = isGlowingEmber
        ? new THREE.Color(1.0, 0.45 + Math.random() * 0.3, 0.05) // Glowing orange ash ember
        : new THREE.Color(0.3, 0.3, 0.32); // Charcoal smoke flake

      this.sparks.push({
        position: center.clone().add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.6,
            Math.random() * 1.2,
            (Math.random() - 0.5) * 0.6
          )
        ),
        velocity: vel,
        color,
        size: 0.26,
        life: 0.6 + Math.random() * 0.45,
        maxLife: 1.15, // strictly <= 1.2s
      });
    }
  }

  /**
   * Spawn destruction debris when a target dummy collapses
   */
  public spawnTargetDebris(center: THREE.Vector3) {
    for (let i = 0; i < 24; i++) {
      if (this.sparks.length >= this.maxSparks) break;

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6.0,
        Math.random() * 5.0 + 2.0,
        (Math.random() - 0.5) * 6.0
      );

      this.sparks.push({
        position: center.clone().add(
          new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.6, (Math.random() - 0.5) * 0.4)
        ),
        velocity: vel,
        color: new THREE.Color(0.9, 0.2 + Math.random() * 0.6, 0.1),
        size: 0.32,
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7,
      });
    }
  }

  /**
   * Spawn 3D expanding spherical fireball and smoke/fire particle shockwave for explosive barrels
   */
  public spawnExplosion(center: THREE.Vector3) {
    // 1. 3D Expanding Spherical Fireball Mesh lasting 800ms
    const fireballGeo = new THREE.SphereGeometry(0.8, 16, 12);
    const fireballMat = new THREE.MeshBasicMaterial({
      color: 0xff3700,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const fireballMesh = new THREE.Mesh(fireballGeo, fireballMat);
    fireballMesh.position.copy(center);
    this.scene.add(fireballMesh);

    // Inner bright white/yellow core
    const coreGeo = new THREE.SphereGeometry(0.45, 12, 10);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xfff4b8,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    fireballMesh.add(coreMesh);

    // Dynamic point light flash
    const flashLight = new THREE.PointLight(0xff5500, 8.5, 18);
    flashLight.position.copy(center);
    this.scene.add(flashLight);

    // Record active fireball
    this.activeFireballs.push({
      mesh: fireballMesh,
      light: flashLight,
      timer: 0,
      duration: 0.8, // 800ms
      maxScale: 4.8,
    });

    // 2. Expanding particle shockwave of fire sparks and dark smoke
    const count = this.quality === 'optimized' ? 24 : 45;
    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= this.maxSparks) break;

      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.15) * Math.PI * 0.5;
      const speed = 4.0 + Math.random() * 8.5;

      const vel = new THREE.Vector3(
        Math.cos(angle) * Math.cos(elevation) * speed,
        Math.sin(elevation) * speed + 2.5,
        Math.sin(angle) * Math.cos(elevation) * speed
      );

      const isSmoke = Math.random() < 0.42;
      const color = isSmoke
        ? new THREE.Color(0.2, 0.2, 0.22) // Charred black/grey smoke
        : new THREE.Color(1.0, 0.2 + Math.random() * 0.6, 0.05); // Fiery orange/yellow flame

      this.sparks.push({
        position: center.clone().add(
          new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.5, (Math.random() - 0.5) * 0.4)
        ),
        velocity: vel,
        color,
        size: isSmoke ? 0.35 : 0.28,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8, // strictly <= 1.2s
      });
    }
  }

  /**
   * Per-frame animation tick
   */
  public update(delta: number) {
    // 1. Muzzle Flash Timer
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= delta;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlashGroup.visible = false;
        this.muzzleFlashLight.intensity = 0;
      }
    }

    // 2. Active Tracers Update
    for (let i = this.activeTracers.length - 1; i >= 0; i--) {
      const tracer = this.activeTracers[i];
      tracer.progress += delta / tracer.duration;

      if (tracer.progress >= 1.0) {
        this.scene.remove(tracer.line);
        tracer.line.geometry.dispose();
        this.activeTracers.splice(i, 1);
      } else {
        // Line expands towards endpoint
        const currentEnd = tracer.startPoint.clone().lerp(tracer.endPoint, Math.min(1, tracer.progress * 1.8));
        const currentStart = tracer.startPoint.clone().lerp(tracer.endPoint, Math.max(0, tracer.progress * 1.2 - 0.2));

        const positions = tracer.line.geometry.attributes.position as THREE.BufferAttribute;
        positions.setXYZ(0, currentStart.x, currentStart.y, currentStart.z);
        positions.setXYZ(1, currentEnd.x, currentEnd.y, currentEnd.z);
        positions.needsUpdate = true;
      }
    }

    // 3. Active 3D Fireballs Animation
    for (let i = this.activeFireballs.length - 1; i >= 0; i--) {
      const fb = this.activeFireballs[i];
      fb.timer += delta;
      const progress = Math.min(1.0, fb.timer / fb.duration);

      const scale = 1.0 + (fb.maxScale - 1.0) * Math.sin(progress * Math.PI * 0.5);
      fb.mesh.scale.setScalar(scale);

      const mat = fb.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.92 * (1.0 - progress));
      fb.light.intensity = Math.max(0, 8.5 * (1.0 - progress));

      if (progress >= 1.0) {
        this.scene.remove(fb.mesh);
        this.scene.remove(fb.light);
        fb.mesh.geometry.dispose();
        mat.dispose();
        fb.light.dispose();
        this.activeFireballs.splice(i, 1);
      }
    }

    // 4. Sparks & Debris Particles Simulation
    const gravity = -18.0;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.life -= delta;

      if (p.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }

      // Physics integration
      p.velocity.y += gravity * delta;
      p.position.addScaledVector(p.velocity, delta);

      // Floor bounce at y = 0
      if (p.position.y < 0.05) {
        p.position.y = 0.05;
        p.velocity.y = -p.velocity.y * 0.35;
        p.velocity.x *= 0.7;
        p.velocity.z *= 0.7;
      }
    }

    // Update GPU particle buffer attributes
    const posAttr = this.sparkGeo.attributes.position as THREE.BufferAttribute;
    const colAttr = this.sparkGeo.attributes.color as THREE.BufferAttribute;

    for (let i = 0; i < this.maxSparks; i++) {
      if (i < this.sparks.length) {
        const p = this.sparks[i];
        posAttr.setXYZ(i, p.position.x, p.position.y, p.position.z);
        const alpha = p.life / p.maxLife;
        colAttr.setXYZ(i, p.color.r * alpha, p.color.g * alpha, p.color.b * alpha);
      } else {
        posAttr.setXYZ(i, 0, -999, 0); // Hide offscreen
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  public reset() {
    this.activeTracers.forEach((t) => {
      this.scene.remove(t.line);
      t.line.geometry.dispose();
    });
    this.activeTracers = [];

    this.activeFireballs.forEach((fb) => {
      this.scene.remove(fb.mesh);
      this.scene.remove(fb.light);
      fb.mesh.geometry.dispose();
      (fb.mesh.material as THREE.Material).dispose();
      fb.light.dispose();
    });
    this.activeFireballs = [];

    this.sparks = [];
    if (this.muzzleFlashGroup) {
      this.muzzleFlashGroup.visible = false;
    }
    if (this.muzzleFlashLight) {
      this.muzzleFlashLight.intensity = 0;
    }
  }

  public dispose() {
    this.reset();
    this.scene.remove(this.sparkPoints);
    this.sparkGeo.dispose();
    this.tracerMaterial.dispose();
  }
}
