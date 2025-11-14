import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

// ===================================
// CONFIGURAÇÕES GLOBAIS
// ===================================
const CONFIG = {
  // Movimento
  MOVEMENT_SPEED: 200,
  ROTATION_SPEED: 8,
  RUN_SPEED_MULTIPLIER: 1.5,

  // Física do pulo
  JUMP_VELOCITY: 70,
  GRAVITY: -180,
  MAX_FALL_SPEED: -300,
  GROUND_LEVEL: 0,
  COYOTE_TIME: 0.15,

  // Animação
  ANIMATION_FADE_DURATION: 0.15,
  JUMP_UP_THRESHOLD: 10,
  JUMP_DOWN_THRESHOLD: -10,

  // Câmera
  CAMERA_FOV: 65,
  CAMERA_DISTANCE: 280,
  CAMERA_HEIGHT: 140,
  CAMERA_FOLLOW_SMOOTHNESS: 0.08,

  // Visual
  MODEL_SCALE: 0.3,
  SHADOW_MAP_SIZE: 2048,

  // Sistema de Combate com Física
  ATTACK: {
    PUNCH: {
      COOLDOWN: 0.5,
      MIN_RANGE: 20, // Distância mínima
      MAX_RANGE: 100, // Distância máxima
      ANGLE: Math.PI / 3, // Ângulo do cone
      FORCE: 250, // Força do impulso
      KNOCKBACK: 0.8, // Multiplicador de knockback
      HIT_WINDOW: 0.25, // Quando o hit acontece
      DURATION: 0.6,
      DAMAGE: 15,
    },
    KICK: {
      COOLDOWN: 0.8,
      MIN_RANGE: 30,
      MAX_RANGE: 140,
      ANGLE: Math.PI / 2.5,
      FORCE: 450,
      KNOCKBACK: 1.5,
      HIT_WINDOW: 0.35,
      DURATION: 0.9,
      DAMAGE: 25,
    },
  },

  // Física dos objetos
  PHYSICS: {
    FRICTION: 0.92, // Atrito do chão
    AIR_RESISTANCE: 0.98, // Resistência do ar
    BOUNCE: 0.3, // Quão elástico é o objeto
    ROTATION_DAMPING: 0.95, // Amortecimento da rotação
    MIN_VELOCITY: 0.01, // Velocidade mínima antes de parar
  },

  // Colisão
  CHARACTER_RADIUS: 30, // Raio de colisão do personagem
  OBJECT_RADIUS: 35, // Raio de colisão dos cubos (metade da diagonal)
};

// ===================================
// MÓDULO: OBJETO COM FÍSICA
// ===================================
class PhysicsObject {
  constructor(mesh) {
    this.mesh = mesh;
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.angularVelocity = new THREE.Vector3(0, 0, 0);
    this.mass = 1.0;
    this.isGrounded = false;
    this.health = 100;
    this.maxHealth = 100;

    // Cria barra de vida
    this.createHealthBar();
  }

  createHealthBar() {
    const barWidth = 60;
    const barHeight = 4;

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    this.healthBar = new THREE.Sprite(material);
    this.healthBar.scale.set(barWidth, barHeight, 1);
    this.mesh.add(this.healthBar);
    this.healthBar.position.set(0, 40, 0);

    this.healthBarCanvas = canvas;
    this.healthBarCtx = ctx;
    this.updateHealthBar();
  }

  updateHealthBar() {
    const ctx = this.healthBarCtx;
    const canvas = this.healthBarCanvas;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fundo
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Barra de vida
    const healthPercent = this.health / this.maxHealth;
    const barWidth = canvas.width * healthPercent;

    // Cor baseada na vida
    if (healthPercent > 0.6) {
      ctx.fillStyle = "#00ff00";
    } else if (healthPercent > 0.3) {
      ctx.fillStyle = "#ffff00";
    } else {
      ctx.fillStyle = "#ff0000";
    }

    ctx.fillRect(0, 0, barWidth, canvas.height);

    // Borda
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    this.healthBar.material.map.needsUpdate = true;
  }

  applyForce(force, point) {
    // Aplica força linear
    this.velocity.add(force.clone().multiplyScalar(1 / this.mass));

    // Aplica torque (rotação) baseado no ponto de impacto
    const centerToPoint = point.clone().sub(this.mesh.position);
    const torque = new THREE.Vector3().crossVectors(centerToPoint, force);
    this.angularVelocity.add(torque.multiplyScalar(0.01 / this.mass));
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    this.updateHealthBar();

    if (this.health <= 0) {
      this.onDestroy();
    }
  }

  onDestroy() {
    // Efeito de destruição
    const material = this.mesh.material;
    const originalColor = material.color.clone();

    let opacity = 1;
    const fadeOut = () => {
      opacity -= 0.05;
      material.opacity = opacity;
      material.transparent = true;

      if (opacity > 0) {
        requestAnimationFrame(fadeOut);
      } else {
        this.mesh.visible = false;
        // Regenera após 5 segundos
        setTimeout(() => this.respawn(), 5000);
      }
    };
    fadeOut();
  }

  respawn() {
    this.health = this.maxHealth;
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this.mesh.material.opacity = 1;
    this.mesh.material.transparent = false;
    this.mesh.visible = true;
    this.mesh.rotation.set(0, 0, 0);
    this.updateHealthBar();
  }

  update(delta) {
    // Aplica gravidade
    if (!this.isGrounded) {
      this.velocity.y += CONFIG.GRAVITY * delta;
    }

    // Aplica velocidade
    this.mesh.position.add(this.velocity.clone().multiplyScalar(delta));

    // Aplica rotação angular
    this.mesh.rotation.x += this.angularVelocity.x * delta;
    this.mesh.rotation.y += this.angularVelocity.y * delta;
    this.mesh.rotation.z += this.angularVelocity.z * delta;

    // Colisão com o chão
    const groundY = 25; // Altura do centro do cubo
    if (this.mesh.position.y <= groundY) {
      this.mesh.position.y = groundY;

      // Bounce
      if (Math.abs(this.velocity.y) > 5) {
        this.velocity.y *= -CONFIG.PHYSICS.BOUNCE;
      } else {
        this.velocity.y = 0;
        this.isGrounded = true;
      }
    } else {
      this.isGrounded = false;
    }

    // Aplicar atrito
    if (this.isGrounded) {
      this.velocity.x *= CONFIG.PHYSICS.FRICTION;
      this.velocity.z *= CONFIG.PHYSICS.FRICTION;
      this.angularVelocity.multiplyScalar(CONFIG.PHYSICS.ROTATION_DAMPING);
    } else {
      // Resistência do ar
      this.velocity.x *= CONFIG.PHYSICS.AIR_RESISTANCE;
      this.velocity.z *= CONFIG.PHYSICS.AIR_RESISTANCE;
    }

    // Para o objeto se estiver muito devagar
    if (this.velocity.length() < CONFIG.PHYSICS.MIN_VELOCITY) {
      this.velocity.set(0, this.velocity.y, 0);
    }

    if (this.angularVelocity.length() < 0.01) {
      this.angularVelocity.set(0, 0, 0);
    }

    // Mantém a barra de vida sempre virada para a câmera
    if (this.healthBar) {
      this.healthBar.quaternion.copy(this.mesh.quaternion);
    }
  }
}

// ===================================
// MÓDULO: GERENCIADOR DE UI
// ===================================
class UIManager {
  constructor() {
    this.loadingScreen = null;
    this.combatFeedback = null;
    this.hitIndicator = null;
  }

  createLoadingScreen() {
    const loader = document.createElement("div");
    loader.id = "loading-screen";
    loader.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      font-family: Arial, sans-serif;
      z-index: 1000;
      transition: opacity 0.5s;
    `;

    loader.innerHTML = `
      <div style="text-align: center;">
        <h1 style="font-size: 3em; margin: 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">⚔️</h1>
        <h2 style="margin: 20px 0;">Sistema de Combate</h2>
        <div id="loading-progress" style="
          width: 300px;
          height: 8px;
          background: rgba(255,255,255,0.2);
          border-radius: 10px;
          overflow: hidden;
          margin: 20px 0;
        ">
          <div id="loading-bar" style="
            width: 0%;
            height: 100%;
            background: white;
            transition: width 0.3s;
            border-radius: 10px;
          "></div>
        </div>
        <p id="loading-text" style="font-size: 0.9em; opacity: 0.8;">Preparando ambiente...</p>
      </div>
    `;

    document.body.appendChild(loader);
    this.loadingScreen = loader;
  }

  updateLoadingProgress(percent, text) {
    const bar = document.getElementById("loading-bar");
    const textEl = document.getElementById("loading-text");
    if (bar) bar.style.width = `${percent}%`;
    if (textEl) textEl.textContent = text;
  }

  hideLoadingScreen() {
    if (this.loadingScreen) {
      this.loadingScreen.style.opacity = "0";
      setTimeout(() => this.loadingScreen.remove(), 500);
    }
  }

  createInstructions() {
    const instructions = document.createElement("div");
    instructions.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 20px 30px;
      border-radius: 15px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      text-align: center;
      pointer-events: none;
      z-index: 100;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;

    instructions.innerHTML = `
      <div style="margin-bottom: 10px; font-size: 18px; font-weight: bold;">⚔️ CONTROLES DE COMBATE</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left;">
        <div><strong>WASD/Setas:</strong> Mover</div>
        <div><strong>ESPAÇO:</strong> Pular</div>
        <div><strong>SHIFT:</strong> Correr</div>
        <div><strong>Mouse:</strong> Câmera</div>
        <div style="color: #ffdd57;"><strong>J:</strong> Soco 👊</div>
        <div style="color: #ff6b6b;"><strong>K:</strong> Chute 🦵</div>
      </div>
      <div style="margin-top: 15px; font-size: 12px; opacity: 0.7;">
        💡 Aproxime-se dos cubos para acertá-los!
      </div>
    `;

    document.body.appendChild(instructions);

    setTimeout(() => {
      instructions.style.transition = "opacity 1s";
      instructions.style.opacity = "0";
      setTimeout(() => instructions.remove(), 1000);
    }, 15000);
  }

  createCombatFeedback() {
    const feedback = document.createElement("div");
    feedback.id = "combat-feedback";
    feedback.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-family: 'Arial Black', sans-serif;
      font-size: 64px;
      font-weight: bold;
      color: white;
      text-shadow: 
        3px 3px 0px rgba(0,0,0,0.8),
        -1px -1px 0px rgba(0,0,0,0.8),
        1px -1px 0px rgba(0,0,0,0.8),
        -1px 1px 0px rgba(0,0,0,0.8);
      pointer-events: none;
      z-index: 200;
      opacity: 0;
      transition: all 0.1s;
    `;
    document.body.appendChild(feedback);
    this.combatFeedback = feedback;
  }

  createHitIndicator() {
    const indicator = document.createElement("div");
    indicator.id = "hit-indicator";
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 15px 25px;
      border-radius: 10px;
      font-family: Arial, sans-serif;
      font-size: 16px;
      pointer-events: none;
      z-index: 150;
      display: none;
    `;
    document.body.appendChild(indicator);
    this.hitIndicator = indicator;
  }

  showCombatHit(type, damage, distance, combo) {
    if (!this.combatFeedback) this.createCombatFeedback();

    const messages = {
      punch: ["💥 POW!", "👊 BAM!", "🔥 HIT!"],
      kick: ["💥 BOOM!", "🦵 CRASH!", "⚡ SMASH!"],
    };

    const msg =
      messages[type][Math.floor(Math.random() * messages[type].length)];
    this.combatFeedback.innerHTML = `
      ${msg}<br>
      <span style="font-size: 32px;">${damage} DMG</span>
      ${
        combo > 1
          ? `<br><span style="font-size: 28px; color: #ffdd57;">x${combo} COMBO!</span>`
          : ""
      }
    `;

    this.combatFeedback.style.color = type === "kick" ? "#ff6b6b" : "#ffdd57";
    this.combatFeedback.style.opacity = "1";
    this.combatFeedback.style.transform = "translate(-50%, -50%) scale(1.2)";

    setTimeout(() => {
      this.combatFeedback.style.opacity = "0";
      this.combatFeedback.style.transform = "translate(-50%, -50%) scale(0.8)";
    }, 600);

    // Mostra indicador de distância
    this.showHitInfo(type, distance, combo);
  }

  showCombatMiss(type, reason = "") {
    if (!this.combatFeedback) this.createCombatFeedback();

    const messages = {
      "too-far": "🎯 MUITO LONGE!",
      "too-close": "⚠️ MUITO PERTO!",
      "wrong-angle": "↔️ FORA DE ALCANCE!",
      default: type === "punch" ? "👊 ERROU..." : "🦵 ERROU...",
    };

    this.combatFeedback.textContent = messages[reason] || messages["default"];
    this.combatFeedback.style.color = "#888888";
    this.combatFeedback.style.fontSize = "48px";
    this.combatFeedback.style.opacity = "0.7";
    this.combatFeedback.style.transform = "translate(-50%, -50%) scale(1)";

    setTimeout(() => {
      this.combatFeedback.style.opacity = "0";
    }, 400);
  }

  showHitInfo(type, distance, combo) {
    if (!this.hitIndicator) this.createHitIndicator();

    this.hitIndicator.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">${
        type === "punch" ? "👊 SOCO" : "🦵 CHUTE"
      }</div>
      <div>Distância: ${Math.round(distance)}u</div>
      ${combo > 1 ? `<div style="color: #ffdd57;">Combo: x${combo}</div>` : ""}
    `;

    this.hitIndicator.style.display = "block";

    setTimeout(() => {
      this.hitIndicator.style.display = "none";
    }, 2000);
  }
}

// ===================================
// MÓDULO: SISTEMA DE COMBATE
// ===================================
class CombatSystem {
  constructor(model, scene, uiManager) {
    this.model = model;
    this.scene = scene;
    this.ui = uiManager;
    this.attackState = {
      punch: { canAttack: true, cooldownTimer: 0 },
      kick: { canAttack: true, cooldownTimer: 0 },
    };
    this.physicsObjects = [];
    this.comboCounter = 0;
    this.lastAttackTime = 0;

    // Debug visual
    this.debugMesh = null;
    this.createDebugVisualization();
  }

  createDebugVisualization() {
    // Cria um cone para visualizar o alcance do ataque (debug)
    const geometry = new THREE.ConeGeometry(1, 1, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.2,
      wireframe: true,
    });
    this.debugMesh = new THREE.Mesh(geometry, material);
    this.debugMesh.visible = false;
    this.scene.add(this.debugMesh);
  }

  addPhysicsObject(physicsObj) {
    this.physicsObjects.push(physicsObj);
  }

  tryAttack(type, isJumping) {
    if (!this.model || isJumping) return false;

    const state = this.attackState[type];
    if (!state || !state.canAttack) return false;

    const config = CONFIG.ATTACK[type.toUpperCase()];

    // Bloqueia novo ataque
    state.canAttack = false;
    state.cooldownTimer = config.COOLDOWN;

    // Atualiza combo
    const now = Date.now();
    if (now - this.lastAttackTime < 1500) {
      this.comboCounter++;
    } else {
      this.comboCounter = 1;
    }
    this.lastAttackTime = now;

    // Agenda o hit no momento apropriado da animação
    setTimeout(
      () => this.performAttack(type, config),
      config.HIT_WINDOW * 1000
    );

    return true;
  }

  performAttack(type, config) {
    if (!this.model) return;

    // Posição e direção do personagem
    const yaw = this.model.rotation.y;
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const origin = this.model.position.clone();
    origin.y += 50; // Altura aproximada do soco/chute

    // Detecta hits
    const result = this.detectHits(origin, forward, config);

    if (result.hits.length > 0) {
      result.hits.forEach((hit) => {
        this.applyHitEffects(hit, config, type);
      });

      const firstHit = result.hits[0];
      this.ui.showCombatHit(
        type,
        config.DAMAGE * this.comboCounter,
        firstHit.distance,
        this.comboCounter
      );
    } else {
      this.ui.showCombatMiss(type, result.reason);
    }

    // Visualização debug (temporária)
    this.showDebugVisualization(
      origin,
      forward,
      config,
      result.hits.length > 0
    );
  }

  detectHits(origin, forward, config) {
    const hits = [];
    let closestDistance = Infinity;
    let reason = "default";

    this.physicsObjects.forEach((physObj) => {
      if (!physObj.mesh.visible) return;

      const toObj = physObj.mesh.position.clone().sub(origin);
      const horizontal = new THREE.Vector3(toObj.x, 0, toObj.z);
      const dist = horizontal.length();

      // Verifica distância mínima
      if (dist < config.MIN_RANGE) {
        if (dist < closestDistance) {
          closestDistance = dist;
          reason = "too-close";
        }
        return;
      }

      // Verifica distância máxima
      if (dist > config.MAX_RANGE) {
        if (dist < closestDistance) {
          closestDistance = dist;
          reason = "too-far";
        }
        return;
      }

      // Verifica ângulo
      const angle = Math.acos(
        Math.max(-1, Math.min(1, forward.dot(horizontal.normalize())))
      );

      if (angle > config.ANGLE / 2) {
        if (dist < closestDistance) {
          closestDistance = dist;
          reason = "wrong-angle";
        }
        return;
      }

      // Hit válido!
      hits.push({
        physicsObject: physObj,
        distance: dist,
        direction: horizontal.normalize(),
        angle: angle,
        impactPoint: physObj.mesh.position.clone(),
      });
    });

    // Ordena por distância (mais próximo primeiro)
    hits.sort((a, b) => a.distance - b.distance);

    return { hits, reason };
  }

  applyHitEffects(hit, config, type) {
    const { physicsObject, distance, direction, impactPoint } = hit;

    // Calcula força baseada na distância (mais perto = mais força)
    const distanceFactor =
      1 - (distance - config.MIN_RANGE) / (config.MAX_RANGE - config.MIN_RANGE);
    const comboMultiplier = 1.0 + (this.comboCounter - 1) * 0.3;
    const totalForce =
      config.FORCE * config.KNOCKBACK * distanceFactor * comboMultiplier;

    // Aplica força com componente vertical
    const forceVector = direction.clone().multiplyScalar(totalForce);
    forceVector.y = totalForce * 0.4; // Lança o objeto para cima

    physicsObject.applyForce(forceVector, impactPoint);

    // Aplica dano
    const damage = Math.round(config.DAMAGE * comboMultiplier);
    physicsObject.takeDamage(damage);

    // Efeito visual de impacto
    this.createImpactEffect(impactPoint, type);

    console.log(
      `💥 ${type.toUpperCase()} | Dist: ${Math.round(
        distance
      )}u | Força: ${Math.round(totalForce)} | DMG: ${damage} | Combo: x${
        this.comboCounter
      }`
    );
  }

  createImpactEffect(position, type) {
    // Cria partículas no ponto de impacto
    const particleCount = 15;
    const geometry = new THREE.SphereGeometry(2, 4, 4);
    const color = type === "kick" ? 0xff6b6b : 0xffdd57;
    const material = new THREE.MeshBasicMaterial({ color: color });

    for (let i = 0; i < particleCount; i++) {
      const particle = new THREE.Mesh(geometry, material.clone());
      particle.position.copy(position);

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 100,
        Math.random() * 80 + 40,
        (Math.random() - 0.5) * 100
      );

      this.scene.add(particle);

      // Anima partícula
      const startTime = Date.now();
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;

        if (elapsed < 0.5) {
          particle.position.add(velocity.clone().multiplyScalar(0.016));
          velocity.y -= 300 * 0.016; // Gravidade
          particle.scale.multiplyScalar(0.95);
          particle.material.opacity = 1 - elapsed * 2;
          particle.material.transparent = true;

          requestAnimationFrame(animate);
        } else {
          this.scene.remove(particle);
          particle.geometry.dispose();
          particle.material.dispose();
        }
      };

      animate();
    }
  }

  showDebugVisualization(origin, forward, config, hit) {
    if (!this.debugMesh) return;

    // Configura o cone de debug
    const radius = Math.tan(config.ANGLE / 2) * config.MAX_RANGE;
    this.debugMesh.scale.set(radius, config.MAX_RANGE, radius);
    this.debugMesh.position.copy(origin);
    this.debugMesh.rotation.x = Math.PI / 2;
    this.debugMesh.rotation.z = -Math.atan2(forward.x, forward.z);
    this.debugMesh.material.color.setHex(hit ? 0x00ff00 : 0xff0000);
    this.debugMesh.visible = true;

    // Esconde após 200ms
    setTimeout(() => {
      if (this.debugMesh) this.debugMesh.visible = false;
    }, 200);
  }

  update(delta) {
    // Atualiza cooldowns
    Object.keys(this.attackState).forEach((type) => {
      const state = this.attackState[type];
      if (state.cooldownTimer > 0) {
        state.cooldownTimer -= delta;
        if (state.cooldownTimer <= 0) {
          state.cooldownTimer = 0;
          state.canAttack = true;
        }
      }
    });

    // Reset combo
    if (Date.now() - this.lastAttackTime > 2000) {
      this.comboCounter = 0;
    }

    // Atualiza física dos objetos
    this.physicsObjects.forEach((physObj) => {
      physObj.update(delta);
    });
  }
}

// ===================================
// MÓDULO: GERENCIADOR DE ANIMAÇÕES
// ===================================
class AnimationManager {
  constructor(mixer) {
    this.mixer = mixer;
    this.actions = {};
    this.activeAction = null;
    this.currentActionName = "";
  }

  addAction(name, clip) {
    this.actions[name] = this.mixer.clipAction(clip);
  }

  play(name, loop = true) {
    if (!this.actions[name] || this.currentActionName === name) return;

    const newAction = this.actions[name];

    if (loop) {
      newAction.loop = THREE.LoopRepeat;
      newAction.clampWhenFinished = false;
    } else {
      newAction.loop = THREE.LoopOnce;
      newAction.clampWhenFinished = true;
    }

    if (this.activeAction && this.activeAction !== newAction) {
      this.activeAction.fadeOut(CONFIG.ANIMATION_FADE_DURATION);
    }

    newAction.reset().fadeIn(CONFIG.ANIMATION_FADE_DURATION).play();

    this.activeAction = newAction;
    this.currentActionName = name;
  }

  findAndPlay(partialName, loop = true) {
    const name = Object.keys(this.actions).find((k) =>
      k.toLowerCase().includes(partialName.toLowerCase())
    );

    if (name) this.play(name, loop);
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
  }

  getActionNames() {
    return Object.keys(this.actions);
  }

  setSpeed(speed) {
    if (this.mixer) {
      this.mixer.timeScale = speed;
    }
  }
}

// ===================================
// CONTROLADOR PRINCIPAL
// ===================================
class CharacterController {
  constructor() {
    this.ui = new UIManager();
    this.ui.createLoadingScreen();

    this.initScene();
    this.initLights();
    this.initGround();
    this.initControls();
    this.initInput();

    this.loader = new FBXLoader();
    this.clock = new THREE.Clock();

    // Estado do personagem
    this.model = null;
    this.mixer = null;
    this.animManager = null;
    this.combatSystem = null;

    // Física
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.isOnGround = true;
    this.isJumping = false;
    this.coyoteTimer = 0;
    this.jumpPhase = "none";

    // Input
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      run: false,
    };

    // Câmera
    this.cameraOffset = new THREE.Vector3(
      0,
      CONFIG.CAMERA_HEIGHT,
      CONFIG.CAMERA_DISTANCE
    );

    // Colisão
    this.collidableObjects = [];

    this.gui = null;
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 600, 1200);

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.CAMERA_FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    this.camera.position.set(0, CONFIG.CAMERA_HEIGHT, CONFIG.CAMERA_DISTANCE);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(this.renderer.domElement);
  }

  initLights() {
    this.dirLight = new THREE.DirectionalLight(0xffffff, 3);
    this.dirLight.position.set(150, 250, 100);
    this.dirLight.castShadow = true;

    const shadowCam = this.dirLight.shadow.camera;
    shadowCam.top = shadowCam.right = 400;
    shadowCam.bottom = shadowCam.left = -400;
    shadowCam.near = 0.1;
    shadowCam.far = 600;
    this.dirLight.shadow.mapSize.set(
      CONFIG.SHADOW_MAP_SIZE,
      CONFIG.SHADOW_MAP_SIZE
    );
    this.dirLight.shadow.bias = -0.0001;
    this.dirLight.shadow.radius = 2;

    this.scene.add(this.dirLight);

    const ambient = new THREE.AmbientLight(0x666666, 2);
    this.scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
    hemiLight.position.set(0, 300, 0);
    this.scene.add(hemiLight);
  }

  initGround() {
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x558855,
      roughness: 0.8,
      metalness: 0.2,
    });

    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.gridHelper = new THREE.GridHelper(2000, 100, 0x888888, 0x444444);
    this.gridHelper.position.y = 0.1;
    this.scene.add(this.gridHelper);
  }

  createEnvironmentObjects() {
    const cubeGeometry = new THREE.BoxGeometry(50, 50, 50);
    const positions = [
      [200, 25, 0],
      [-200, 25, 0],
      [0, 25, 200],
      [0, 25, -200],
      [200, 25, 200],
      [-200, 25, -200],
    ];

    positions.forEach((pos, i) => {
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(i / positions.length, 0.7, 0.5),
        roughness: 0.5,
        metalness: 0.3,
      });

      const cube = new THREE.Mesh(cubeGeometry, material);
      cube.position.set(...pos);
      cube.castShadow = true;
      cube.receiveShadow = true;
      this.scene.add(cube);

      // Adiciona física ao cubo
      const physicsObj = new PhysicsObject(cube);
      this.combatSystem.addPhysicsObject(physicsObj);

      // Adiciona à lista de objetos colidíveis
      this.collidableObjects.push({
        mesh: cube,
        radius: CONFIG.OBJECT_RADIUS,
      });
    });
  }

  initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 100, 0);
    this.controls.minDistance = 150;
    this.controls.maxDistance = 600;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.enablePan = false;
  }

  initInput() {
    document.addEventListener("keydown", (e) => this.onKeyDown(e));
    document.addEventListener("keyup", (e) => this.onKeyUp(e));
    window.addEventListener("resize", () => this.onResize());

    this.ui.createInstructions();
  }

  onKeyDown(e) {
    if (e.repeat) return;

    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        this.keys.forward = true;
        break;
      case "KeyS":
      case "ArrowDown":
        this.keys.backward = true;
        break;
      case "KeyA":
      case "ArrowLeft":
        this.keys.left = true;
        break;
      case "KeyD":
      case "ArrowRight":
        this.keys.right = true;
        break;
      case "Space":
        e.preventDefault();
        this.keys.jump = true;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.keys.run = true;
        break;
      case "KeyR":
        this.resetPosition();
        break;
      case "KeyJ":
        this.attack("punch");
        break;
      case "KeyK":
        this.attack("kick");
        break;
    }
  }

  onKeyUp(e) {
    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        this.keys.forward = false;
        break;
      case "KeyS":
      case "ArrowDown":
        this.keys.backward = false;
        break;
      case "KeyA":
      case "ArrowLeft":
        this.keys.left = false;
        break;
      case "KeyD":
      case "ArrowRight":
        this.keys.right = false;
        break;
      case "Space":
        this.keys.jump = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.keys.run = false;
        break;
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  attack(type) {
    if (!this.combatSystem) return;

    const success = this.combatSystem.tryAttack(type, this.isJumping);
    if (success) {
      this.animManager.findAndPlay(type, false);
    }
  }

  async loadFBX(filename) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        `./models/${filename}`,
        (obj) => resolve(obj),
        (xhr) => {
          const percent = (xhr.loaded / xhr.total) * 100;
          console.log(`📦 ${filename}: ${percent.toFixed(0)}%`);
        },
        (err) => reject(err)
      );
    });
  }

  async loadModelAndAnimations() {
    const animationFiles = [
      "Idle.fbx",
      "Jumping.fbx",
      "jumping-down.fbx",
      "running.fbx",
      "punch.fbx",
      "kick.fbx",
    ];

    try {
      this.ui.updateLoadingProgress(10, "Carregando modelo principal...");

      const mainModel = await this.loadFBX(animationFiles[0]);
      mainModel.scale.setScalar(CONFIG.MODEL_SCALE);

      mainModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.needsUpdate = true;
            child.material.side = THREE.FrontSide;
          }
        }
      });

      this.scene.add(mainModel);
      this.model = mainModel;
      this.mixer = new THREE.AnimationMixer(this.model);
      this.animManager = new AnimationManager(this.mixer);
      this.combatSystem = new CombatSystem(this.model, this.scene, this.ui);

      this.ui.updateLoadingProgress(30, "Configurando animações...");

      if (mainModel.animations?.length > 0) {
        const clip = mainModel.animations[0];
        const clipName = this.getClipName(animationFiles[0], clip, 0);
        this.animManager.addAction(clipName, clip);
      }

      const progressStep = 50 / animationFiles.length;
      for (let i = 1; i < animationFiles.length; i++) {
        const filename = animationFiles[i];
        this.ui.updateLoadingProgress(
          30 + progressStep * i,
          `Carregando ${filename}...`
        );

        const obj = await this.loadFBX(filename);

        if (obj.animations?.length > 0) {
          const clip = obj.animations[0];
          const clipName = this.getClipName(filename, clip, i);
          this.animManager.addAction(clipName, clip);
        }
      }

      // Cria objetos com física DEPOIS do combatSystem estar pronto
      this.createEnvironmentObjects();

      this.ui.updateLoadingProgress(90, "Finalizando...");
      this.setupGUI();
      this.ui.updateLoadingProgress(100, "Pronto!");

      setTimeout(() => this.ui.hideLoadingScreen(), 500);
      console.log("🎉 Sistema de combate carregado!");
    } catch (err) {
      console.error("❌ Erro ao carregar assets:", err);
      this.ui.updateLoadingProgress(
        0,
        "Erro ao carregar! Verifique o console."
      );
    }
  }

  getClipName(filename, clip, index) {
    const baseName = filename.replace(".fbx", "");
    return `${baseName}_${clip.name || `Anim_${index}`}`;
  }

  updateJumpAnimation() {
    if (!this.model || !this.animManager) return;

    const velocityY = this.velocity.y;

    if (velocityY > CONFIG.JUMP_UP_THRESHOLD && this.jumpPhase !== "rising") {
      this.jumpPhase = "rising";
      this.animManager.findAndPlay("jumping", false);
    } else if (
      velocityY < CONFIG.JUMP_DOWN_THRESHOLD &&
      this.jumpPhase !== "falling"
    ) {
      this.jumpPhase = "falling";
      this.animManager.findAndPlay("jumping-down", false);
    }
  }

  tryJump() {
    const canJump =
      (this.isOnGround || this.coyoteTimer > 0) && !this.isJumping;

    if (canJump) {
      this.velocity.y = CONFIG.JUMP_VELOCITY;
      this.isOnGround = false;
      this.isJumping = true;
      this.jumpPhase = "rising";
      this.coyoteTimer = 0;
      this.animManager.findAndPlay("jumping", false);
    }
  }

  updateMovement(delta) {
    if (!this.model) return;

    if (!this.isOnGround && this.coyoteTimer > 0) {
      this.coyoteTimer -= delta;
    }

    // Aplicar gravidade
    this.velocity.y = Math.max(
      this.velocity.y + CONFIG.GRAVITY * delta,
      CONFIG.MAX_FALL_SPEED
    );

    // Processar pulo
    if (this.keys.jump && !this.isJumping) {
      this.tryJump();
      this.keys.jump = false;
    }

    // Atualiza animação de pulo
    this.updateJumpAnimation();

    // Movimento horizontal
    const speedMultiplier = this.keys.run ? CONFIG.RUN_SPEED_MULTIPLIER : 1;
    const moveSpeed = CONFIG.MOVEMENT_SPEED * speedMultiplier * delta;
    const moveDir = new THREE.Vector3(0, 0, 0);
    let isMoving = false;

    if (this.keys.forward) {
      moveDir.z -= 1;
      isMoving = true;
    }
    if (this.keys.backward) {
      moveDir.z += 1;
      isMoving = true;
    }
    if (this.keys.left) {
      moveDir.x -= 1;
      isMoving = true;
    }
    if (this.keys.right) {
      moveDir.x += 1;
      isMoving = true;
    }

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();

      // Rotação suave em direção ao movimento
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      const currentAngle = this.model.rotation.y;
      let angleDiff = targetAngle - currentAngle;

      // Normaliza para o caminho mais curto
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // Aplica rotação suave
      this.model.rotation.y += angleDiff * CONFIG.ROTATION_SPEED * delta;

      // Calcula nova posição
      const moveDist = moveSpeed;
      const newX = this.model.position.x + Math.sin(targetAngle) * moveDist;
      const newZ = this.model.position.z + Math.cos(targetAngle) * moveDist;

      // Verifica colisão antes de mover
      const newPos = new THREE.Vector3(newX, this.model.position.y, newZ);
      if (!this.checkCollision(newPos)) {
        this.model.position.x = newX;
        this.model.position.z = newZ;
      } else {
        // Tenta deslizar ao longo da parede
        const slideX = new THREE.Vector3(
          newX,
          this.model.position.y,
          this.model.position.z
        );
        const slideZ = new THREE.Vector3(
          this.model.position.x,
          this.model.position.y,
          newZ
        );

        if (!this.checkCollision(slideX)) {
          this.model.position.x = newX;
        } else if (!this.checkCollision(slideZ)) {
          this.model.position.z = newZ;
        }
      }
    }

    // Trocar animação (exceto durante pulo ou ataque)
    if (
      !this.isJumping &&
      this.combatSystem.attackState.punch.canAttack &&
      this.combatSystem.attackState.kick.canAttack
    ) {
      if (isMoving) {
        this.animManager.findAndPlay("running");
      } else {
        this.animManager.findAndPlay("idle");
      }
    }

    // Aplicar velocidade vertical
    this.model.position.y += this.velocity.y * delta;

    // Colisão com chão
    if (this.model.position.y <= CONFIG.GROUND_LEVEL) {
      this.model.position.y = CONFIG.GROUND_LEVEL;
      this.velocity.y = 0;

      if (this.isJumping) {
        this.isJumping = false;
        this.jumpPhase = "none";
      }

      this.isOnGround = true;
      this.coyoteTimer = CONFIG.COYOTE_TIME;
    } else {
      if (this.isOnGround) {
        this.coyoteTimer = CONFIG.COYOTE_TIME;
      }
      this.isOnGround = false;
    }
  }

  checkCollision(newPosition) {
    // Verifica colisão com todos os objetos colidíveis
    for (let i = 0; i < this.collidableObjects.length; i++) {
      const obj = this.collidableObjects[i];

      // Ignora objetos invisíveis (destruídos)
      if (!obj.mesh.visible) continue;

      const objPos = obj.mesh.position;
      const distance = new THREE.Vector2(
        newPosition.x - objPos.x,
        newPosition.z - objPos.z
      ).length();

      const minDistance = CONFIG.CHARACTER_RADIUS + obj.radius;

      if (distance < minDistance) {
        return true; // Colisão detectada
      }
    }

    return false; // Sem colisão
  }

  updateCamera() {
    if (!this.model) return;

    const targetPos = this.model.position.clone();
    const targetLookAt = targetPos.clone();
    targetLookAt.y += 100;

    this.controls.target.lerp(targetLookAt, CONFIG.CAMERA_FOLLOW_SMOOTHNESS);
  }

  resetCamera() {
    this.camera.position.set(0, CONFIG.CAMERA_HEIGHT, CONFIG.CAMERA_DISTANCE);
    this.controls.target.set(0, 100, 0);
  }

  resetPosition() {
    if (this.model) {
      this.model.position.set(0, 0, 0);
      this.model.rotation.set(0, 0, 0);
      this.velocity.set(0, 0, 0);
      this.isJumping = false;
      this.jumpPhase = "none";
      this.animManager.findAndPlay("idle");
    }
    this.resetCamera();
  }

  setupGUI() {
    this.gui = new GUI();
    this.gui.title("⚔️ Controles de Combate");

    const animNames = this.animManager.getActionNames();
    if (animNames.length === 0) return;

    const guiControls = {
      animation: animNames[0],
      speed: 1.0,
      lightIntensity: 3,
      shadowsEnabled: true,
      showGrid: true,
      debugVisualization: false,
      showColliders: false,
      punchRange: CONFIG.ATTACK.PUNCH.MAX_RANGE,
      kickRange: CONFIG.ATTACK.KICK.MAX_RANGE,
      jump: () => this.tryJump(),
      punch: () => this.attack("punch"),
      kick: () => this.attack("kick"),
      resetCamera: () => this.resetCamera(),
      resetPosition: () => this.resetPosition(),
    };

    // Pasta de Animações
    const animFolder = this.gui.addFolder("🎬 Animações");
    animFolder
      .add(guiControls, "animation", animNames)
      .name("Animação")
      .onChange((n) => this.animManager.play(n));

    animFolder
      .add(guiControls, "speed", 0.1, 3, 0.1)
      .name("Velocidade")
      .onChange((v) => this.animManager.setSpeed(v));

    animFolder.add(guiControls, "jump").name("⬆️ Pular");

    // Pasta de Combate
    const combatFolder = this.gui.addFolder("⚔️ Combate");
    combatFolder.add(guiControls, "punch").name("👊 Soco (J)");
    combatFolder.add(guiControls, "kick").name("🦵 Chute (K)");

    combatFolder
      .add(guiControls, "punchRange", 50, 200, 10)
      .name("Alcance Soco")
      .onChange((v) => (CONFIG.ATTACK.PUNCH.MAX_RANGE = v));

    combatFolder
      .add(guiControls, "kickRange", 80, 250, 10)
      .name("Alcance Chute")
      .onChange((v) => (CONFIG.ATTACK.KICK.MAX_RANGE = v));

    combatFolder
      .add(guiControls, "debugVisualization")
      .name("Debug Visual")
      .onChange((v) => {
        if (this.combatSystem.debugMesh) {
          this.combatSystem.debugMesh.visible = v;
        }
      });

    combatFolder
      .add(guiControls, "showColliders")
      .name("Mostrar Colisões")
      .onChange((v) => this.toggleColliderVisualization(v));

    combatFolder.open();

    // Pasta de Visual
    const visualFolder = this.gui.addFolder("💡 Visual");
    visualFolder
      .add(guiControls, "lightIntensity", 0, 10, 0.5)
      .name("Intensidade da Luz")
      .onChange((v) => (this.dirLight.intensity = v));

    visualFolder
      .add(guiControls, "shadowsEnabled")
      .name("Sombras")
      .onChange((v) => {
        this.renderer.shadowMap.enabled = v;
        this.dirLight.castShadow = v;
      });

    visualFolder
      .add(guiControls, "showGrid")
      .name("Mostrar Grade")
      .onChange((v) => {
        this.gridHelper.visible = v;
      });

    // Pasta de Personagem
    const charFolder = this.gui.addFolder("🎮 Personagem");
    charFolder.add(guiControls, "resetCamera").name("🔄 Resetar Câmera");
    charFolder.add(guiControls, "resetPosition").name("🔄 Resetar Posição");

    // Inicia com a primeira animação
    this.animManager.play(animNames[0]);
  }

  toggleColliderVisualization(show) {
    // Remove visualizações anteriores
    if (this.colliderHelpers) {
      this.colliderHelpers.forEach((helper) => this.scene.remove(helper));
    }
    this.colliderHelpers = [];

    if (show) {
      // Adiciona círculo para o personagem
      const charGeometry = new THREE.CircleGeometry(
        CONFIG.CHARACTER_RADIUS,
        32
      );
      const charMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      });
      const charHelper = new THREE.Mesh(charGeometry, charMaterial);
      charHelper.rotation.x = -Math.PI / 2;
      charHelper.position.y = 1;
      this.model.add(charHelper);
      this.colliderHelpers.push(charHelper);

      // Adiciona círculos para os objetos
      this.collidableObjects.forEach((obj) => {
        const objGeometry = new THREE.CircleGeometry(obj.radius, 32);
        const objMaterial = new THREE.MeshBasicMaterial({
          color: 0xff0000,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
        });
        const objHelper = new THREE.Mesh(objGeometry, objMaterial);
        objHelper.rotation.x = -Math.PI / 2;
        objHelper.position.y = 1;
        obj.mesh.add(objHelper);
        this.colliderHelpers.push(objHelper);
      });
    }
  }

  animate = () => {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);

    if (this.animManager) {
      this.animManager.update(delta);
    }

    if (this.combatSystem) {
      this.combatSystem.update(delta);
    }

    this.updateMovement(delta);
    this.updateCamera();
    this.controls.update();

    this.renderer.render(this.scene, this.camera);
  };

  async init() {
    await this.loadModelAndAnimations();
    this.animate();
  }
}

// ===================================
// EXECUTAR
// ===================================
const controller = new CharacterController();
controller.init().catch((err) => {
  console.error("❌ Erro :", err);
  const loader = document.getElementById("loading-screen");
  if (loader) {
    loader.querySelector("#loading-text").textContent =
      "Erro ao carregar! Verifique se os arquivos FBX estão na pasta ./models/";
  }
});
