/** Three.js club floor — walkable rooms with CGI avatars. */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { resolveClubAvatarUrl } from './club-avatars.js?v=35';

const ZONES = {
  bar: { x: -6, z: -2, r: 2.5, id: 'bar' },
  dj: { x: 0, z: -8, r: 2, id: 'dj' },
  poker: { x: -7, z: 5, r: 2, id: 'poker' },
  roulette: { x: 7, z: 5, r: 2, id: 'roulette' },
  slots: { x: 7, z: -3, r: 2, id: 'slots' }
};

export class ClubEngine {
  constructor(container, { room, profile, onZone, onMove }) {
    this.container = container;
    this.room = room;
    this.profile = profile;
    this.onZone = onZone || (() => {});
    this.onMove = onMove || (() => {});
    this.pos = { x: 0, z: 6 };
    this.rot = 0;
    this.move = { x: 0, z: 0 };
    this.dancing = false;
    this.nearZone = null;
    this.remoteMeshes = new Map();
    this.loader = new GLTFLoader();
    this.clock = new THREE.Clock();
    this._avatarCache = new Map();

    this.proceduralMeshes = [];
    this.interiorRoot = null;

    this.initRenderer();
    this.buildRoom();
    this.loadInteriorBackdrop();
    this.loadPlayerAvatar();
    this.bindInput();
    this.animate();
  }

  initRenderer() {
    const w = this.container.clientWidth || 360;
    const h = this.container.clientHeight || 520;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(this.room.fog, 8, 42);
    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100);
    this.camera.position.set(0, 7, 12);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.classList.add('club-three-canvas');
  }

  buildRoom() {
    const p = this.room.palette;
    this.scene.background = new THREE.Color(p.floor);

    const amb = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(amb);
    const a = new THREE.PointLight(this.room.lightA, 2.2, 30);
    a.position.set(-6, 8, -4);
    this.scene.add(a);
    const b = new THREE.PointLight(this.room.lightB, 1.8, 30);
    b.position.set(6, 7, 2);
    this.scene.add(b);
    this.spot = new THREE.SpotLight(0xffffff, 1.2);
    this.spot.position.set(0, 14, 0);
    this.spot.angle = 0.5;
    this.scene.add(this.spot);

    const floorGeo = new THREE.PlaneGeometry(28, 28, 14, 14);
    const floorMat = new THREE.MeshStandardMaterial({
      color: p.floor,
      emissive: p.accent,
      emissiveIntensity: 0.08,
      roughness: 0.4,
      metalness: 0.3
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.floor = floor;

    this.grid = new THREE.GridHelper(26, 26, p.accent, 0x222222);
    this.grid.position.y = 0.02;
    this.scene.add(this.grid);

    this.addBox(-6, 1.2, -2, 5, 2.4, 1.5, p.bar, 'BAR');
    this.addBox(0, 0.8, -8, 4, 1.6, 3, 0x111111, 'DJ');
    this.addPortal(-7, 0, 5, p.accent, 'POKER');
    this.addPortal(7, 0, 5, 0xe53935, 'ROULETTE');
    this.addPortal(7, 0, -3, 0xffc107, 'POKIERS');

    if (this.room.decor === 'boho') {
      for (let i = 0; i < 6; i++) {
        const plant = new THREE.Mesh(
          new THREE.ConeGeometry(0.4, 1.2, 6),
          new THREE.MeshStandardMaterial({ color: 0x2e7d32 })
        );
        plant.position.set(-8 + i * 3, 0.6, -6 + (i % 2) * 2);
        this.scene.add(plant);
      }
    }
    if (this.room.decor === 'velvet') {
      for (let i = 0; i < 4; i++) {
        this.addBox(-9 + i * 5, 0.5, 8, 3, 1, 2, 0x4a148c);
      }
    }
    if (this.room.decor === 'strip') {
      this.addStripDecor();
    }
  }

  addStripDecor() {
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0xff4081,
      emissive: 0xff1744,
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.2
    });
    [-4, 4].forEach((x) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 12), poleMat);
      pole.position.set(x, 1.6, -1);
      this.scene.add(pole);
      this.proceduralMeshes.push(pole);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.04, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0xff4081, emissive: 0xff4081, emissiveIntensity: 0.8 })
      );
      ring.position.set(x, 2.8, -1);
      ring.rotation.x = Math.PI / 2;
      this.scene.add(ring);
      this.proceduralMeshes.push(ring);
    });
    for (let i = 0; i < 5; i++) {
      this.addBox(-10 + i * 5, 0.55, 7, 3.5, 1.1, 1.8, 0x311b92);
    }
  }

  loadInteriorBackdrop() {
    const url = this.room.interiorGlb;
    if (!url) return;

    this.loader.load(
      url,
      (gltf) => {
        this.setProceduralVisible(false);
        const root = gltf.scene;
        root.traverse((c) => {
          if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });
        const scale = this.room.interiorScale || 0.4;
        root.scale.setScalar(scale);
        root.position.y = this.room.interiorY || 0;
        root.rotation.y = this.room.interiorRotY || 0;

        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        root.position.x -= center.x * scale;
        root.position.z -= center.z * scale;

        this.interiorRoot = root;
        this.scene.add(root);
      },
      undefined,
      () => {
        this.setProceduralVisible(true);
      }
    );
  }

  setProceduralVisible(on) {
    if (this.floor) this.floor.visible = on;
    if (this.grid) this.grid.visible = on;
    this.proceduralMeshes.forEach((m) => { m.visible = on; });
    this.scene.children.forEach((c) => {
      if (c.userData?.clubProcedural) c.visible = on;
    });
  }

  addBox(x, y, z, w, h, d, color, label) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 })
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.userData.clubProcedural = true;
    this.scene.add(mesh);
    this.proceduralMeshes.push(mesh);
    if (label) this.addLabel(label, x, h + 1.2, z);
  }

  addPortal(x, y, z, color, label) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.08, 8, 32),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 })
    );
    ring.position.set(x, 2, z);
    ring.userData.clubProcedural = true;
    this.scene.add(ring);
    this.proceduralMeshes.push(ring);
    this.addLabel(label, x, 3.5, z);
  }

  addLabel(text, x, y, z) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffc107';
    ctx.font = 'bold 28px Oswald,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 42);
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    spr.position.set(x, y, z);
    spr.scale.set(3, 0.75, 1);
    this.scene.add(spr);
  }

  async loadPlayerAvatar() {
    this.playerGroup = new THREE.Group();
    this.scene.add(this.playerGroup);
    const url = resolveClubAvatarUrl(this.profile);
    const model = await this.loadAvatarModel(url);
    model.scale.setScalar(1);
    model.position.y = 0;
    this.playerGroup.add(model);
    this.playerModel = model;
    this.playerGroup.position.set(this.pos.x, 0, this.pos.z);
  }

  async loadAvatarModel(url) {
    if (this._avatarCache.has(url)) {
      return this._avatarCache.get(url).clone();
    }
    return new Promise((resolve) => {
      this.loader.load(
        url,
        (gltf) => {
          const root = gltf.scene;
          root.traverse((c) => {
            if (c.isMesh) {
              c.castShadow = true;
              c.receiveShadow = true;
            }
          });
          const box = new THREE.Box3().setFromObject(root);
          const h = box.max.y - box.min.y || 1.7;
          root.scale.setScalar(1.75 / h);
          root.position.y = -(box.min.y * (1.75 / h));
          this._avatarCache.set(url, root);
          resolve(root.clone());
        },
        undefined,
        () => resolve(this.fallbackHuman(0xb388ff))
      );
    });
  }

  fallbackHuman(color) {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.45 });
    const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 4, 8), cloth);
    body.position.y = 1.1;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), skin);
    head.position.y = 1.85;
    g.add(body, head);
    return g;
  }

  async upsertRemote(id, data) {
    let g = this.remoteMeshes.get(id);
    if (!g) {
      g = new THREE.Group();
      this.scene.add(g);
      const preset = data.avatarPreset || 'hostess';
      const url = data.avatarUrl || resolveClubAvatarUrl({ clubAvatarPreset: preset });
      const model = await this.loadAvatarModel(url);
      g.add(model);
      this.remoteMeshes.set(id, g);
    }
    g.position.set(data.x || 0, 0, data.z || 0);
    g.rotation.y = data.rot || 0;
    if (data.dancing) g.position.y = Math.sin(Date.now() * 0.01) * 0.08;
    else g.position.y = 0;
  }

  removeRemote(id) {
    const g = this.remoteMeshes.get(id);
    if (g) {
      this.scene.remove(g);
      this.remoteMeshes.delete(id);
    }
  }

  getLocalState() {
    return {
      x: this.pos.x,
      z: this.pos.z,
      rot: this.rot,
      dancing: this.dancing,
      nearBar: this.nearZone?.id === 'bar',
      onDanceFloor: Math.hypot(this.pos.x, this.pos.z - 2) < 10
    };
  }

  getPosition() {
    return { x: this.pos.x, z: this.pos.z };
  }

  setMove(x, z) {
    this.move.x = x;
    this.move.z = z;
  }

  setDancing(on) {
    this.dancing = !!on;
  }

  bindInput() {
    this._onKey = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') this.move.z = -1;
      if (k === 's' || k === 'arrowdown') this.move.z = 1;
      if (k === 'a' || k === 'arrowleft') this.move.x = -1;
      if (k === 'd' || k === 'arrowright') this.move.x = 1;
    };
    this._onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (['w', 's', 'arrowup', 'arrowdown'].includes(k)) this.move.z = 0;
      if (['a', 'd', 'arrowleft', 'arrowright'].includes(k)) this.move.x = 0;
    };
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKeyUp);
    this._onResize = () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this._onResize);
  }

  update(dt) {
    const speed = 4.5 * dt;
    if (Math.abs(this.move.x) > 0.05 || Math.abs(this.move.z) > 0.05) {
      this.pos.x = THREE.MathUtils.clamp(this.pos.x + this.move.x * speed, -12, 12);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z + this.move.z * speed, -12, 12);
      this.rot = Math.atan2(this.move.x, this.move.z);
      this.dancing = false;
    }
    if (this.playerGroup) {
      this.playerGroup.position.set(this.pos.x, this.dancing ? Math.sin(Date.now() * 0.012) * 0.12 : 0, this.pos.z);
      this.playerGroup.rotation.y = this.rot;
    }

    const t = Date.now() * 0.001;
    if (this.floor?.material?.emissiveIntensity !== undefined) {
      this.floor.material.emissiveIntensity = 0.06 + Math.sin(t * this.room.bpm / 60) * 0.06;
    }

    let near = null;
    let best = 999;
    for (const z of Object.values(ZONES)) {
      const d = Math.hypot(this.pos.x - z.x, this.pos.z - z.z);
      if (d < z.r && d < best) {
        best = d;
        near = z;
      }
    }
    if (near?.id !== this.nearZone?.id) {
      this.nearZone = near;
      this.onZone(near);
    }
    this.onMove(this.getLocalState());
  }

  animate() {
    this.raf = requestAnimationFrame(() => this.animate());
    const dt = this.clock.getDelta();
    this.update(dt);
    this.camera.position.lerp(
      new THREE.Vector3(this.pos.x, 6.5, this.pos.z + 10),
      0.08
    );
    this.camera.lookAt(this.pos.x, 1.5, this.pos.z);
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('resize', this._onResize);
    this.remoteMeshes.forEach((g) => this.scene.remove(g));
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}