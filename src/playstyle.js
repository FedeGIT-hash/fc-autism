import * as T from 'three';

const TYPES = [
  { type: 'quickstep', label: 'QUICKSTEP', color: '#ffd400' },
  { type: 'bombeado', label: 'TIRO BOMBEADO', color: '#ff4fa0' },
  { type: 'balistico', label: 'PASE BALÍSTICO', color: '#ff7a2e' }
];

function roundedBadge(background, draw) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = 26;
  g.beginPath();
  g.moveTo(r, 0); g.lineTo(128 - r, 0); g.arcTo(128, 0, 128, r, r);
  g.lineTo(128, 128 - r); g.arcTo(128, 128, 128 - r, 128, r);
  g.lineTo(r, 128); g.arcTo(0, 128, 0, 128 - r, r);
  g.lineTo(0, r); g.arcTo(0, 0, r, 0, r); g.closePath();
  g.fillStyle = background; g.fill();
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 4; g.stroke();
  draw(g);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; return tex;
}

function drawRunner(g) {
  g.strokeStyle = '#141414'; g.fillStyle = '#141414'; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.arc(66, 30, 10, 0, Math.PI * 2); g.fill();                 // head
  g.lineWidth = 9; g.beginPath(); g.moveTo(64, 40); g.lineTo(55, 68); g.stroke(); // torso
  g.lineWidth = 8;
  g.beginPath(); g.moveTo(55, 68); g.lineTo(40, 96); g.stroke();               // front leg
  g.beginPath(); g.moveTo(55, 68); g.lineTo(77, 92); g.stroke();               // back leg
  g.lineWidth = 6;
  g.beginPath(); g.moveTo(62, 47); g.lineTo(44, 55); g.stroke();               // arms
  g.beginPath(); g.moveTo(62, 47); g.lineTo(83, 50); g.stroke();
}

function drawBomb(g) {
  g.strokeStyle = '#141414'; g.fillStyle = '#141414'; g.lineCap = 'round';
  g.beginPath(); g.arc(64, 92, 13, 0, Math.PI * 2); g.fill();                  // ball
  g.lineWidth = 7; g.beginPath(); g.arc(64, 42, 44, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); // arc
  g.beginPath(); g.moveTo(98, 46); g.lineTo(110, 33); g.lineTo(101, 67); g.closePath(); g.fill(); // arrowhead
}

function drawTriangle(g) {
  g.fillStyle = '#141414';
  g.beginPath(); g.moveTo(64, 22); g.lineTo(102, 100); g.lineTo(26, 100); g.closePath(); g.fill();
}

export class PlaystyleManager {
  constructor(scene, match) {
    this.scene = scene; this.match = match;
    this.textures = {
      quickstep: roundedBadge('#ffd400', drawRunner),
      bombeado: roundedBadge('#ff4fa0', drawBomb),
      balistico: roundedBadge('#ff7a2e', drawTriangle)
    };
    this.spawnTimer = 20; this.sphereActive = false; this.sphereTime = 0;
    const group = new T.Group();
    this.core = new T.Mesh(new T.SphereGeometry(.5, 24, 18), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe14d, emissiveIntensity: 1.6, roughness: .3 }));
    group.add(this.core);
    this.ring = new T.Mesh(new T.RingGeometry(.66, .82, 40), new T.MeshBasicMaterial({ color: 0xffe14d, side: T.DoubleSide, transparent: true, opacity: .85 }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = .02; group.add(this.ring);
    this.ring2 = new T.Mesh(new T.RingGeometry(.9, .96, 40), new T.MeshBasicMaterial({ color: 0xffe14d, side: T.DoubleSide, transparent: true, opacity: .4 }));
    this.ring2.rotation.x = -Math.PI / 2; this.ring2.position.y = .01; group.add(this.ring2);
    group.visible = false; this.sphere = group; scene.add(group);
  }
  reset() { this.sphereActive = false; this.sphere.visible = false; this.spawnTimer = 20; }
  spawn() {
    for (let i = 0; i < 12; i++) {
      const x = (Math.random() * 2 - 1) * 24, z = (Math.random() * 2 - 1) * 15;
      if (!this.match.players.some(p => Math.hypot(p.position.x - x, p.position.z - z) < 2.5)) {
        this.sphere.position.set(x, .55, z); this.sphere.visible = true; this.sphereActive = true; this.sphereTime = 0; this.sphere.scale.setScalar(1); return;
      }
    }
    this.sphere.position.set(0, .55, 8); this.sphere.visible = true; this.sphereActive = true; this.sphereTime = 0;
  }
  assign(player, type) {
    const meta = TYPES.find(t => t.type === type) || TYPES[0];
    player.playstyle = { type, time: type === 'quickstep' ? 6 : 15 };
    this.refreshIcon(player);
    this.match.onMessage(`${meta.label} · ${player.name}`, 1.6);
    this.match.audio.tone(520, .1);
  }
  clear(player) { player.playstyle = null; if (player.playstyleIcon) player.playstyleIcon.visible = false; }
  refreshIcon(player) {
    if (!player.playstyleIcon || !player.playstyle) return;
    player.playstyleIcon.visible = true;
    const map = this.textures[player.playstyle.type];
    if (map && player.playstyleIcon.material.map !== map) { player.playstyleIcon.material.map = map; player.playstyleIcon.material.needsUpdate = true; }
  }
  update(dt) {
    if (!this.match.running) return;
    if (this.sphereActive) {
      this.sphereTime += dt;
      const s = 1 + Math.sin(this.sphereTime * 4) * .08;
      this.sphere.scale.setScalar(s);
      this.sphere.position.y = .55 + Math.sin(this.sphereTime * 3) * .12;
      this.ring.rotation.z += dt * 1.5; this.ring2.rotation.z -= dt * 1.1;
      if (this.sphereTime > 15) { this.sphereActive = false; this.sphere.visible = false; }
      else {
        const p = this.match.players.find(pl => pl.slide <= 0 && pl.position.distanceTo(this.sphere.position) < 1.1);
        if (p) {
          this.sphereActive = false; this.sphere.visible = false;
          this.match.effects.burst(this.sphere.position, 20, 'grass');
          this.assign(p, TYPES[Math.floor(Math.random() * TYPES.length)].type);
        }
      }
    } else {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawn(); this.spawnTimer = 20; }
    }
    for (const p of this.match.players) {
      if (!p.playstyle) continue;
      p.playstyle.time -= dt;
      if (p.playstyle.time <= 0) this.clear(p);
      else this.refreshIcon(p);
    }
  }
}
