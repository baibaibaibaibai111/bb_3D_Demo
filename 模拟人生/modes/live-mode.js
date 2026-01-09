import { THREE, scene, camera, ground, raycaster, mouse, snap, controls } from "../core/core.js";
import { GLTFLoader } from "three/examples/loaders/GLTFLoader.js";
import { floors, furnitures, findPath, canMoveCharacterTo, scheduleDestroy } from "../layout/layout.js";
import {
  createCharacter,
  resetCharacterPose as simResetCharacterPose,
  updateCharacterRotationTowards as simUpdateCharacterRotationTowards,
  getBedHeadYaw,
  getSleepHeadWorldPosition,
  applySleepPose,
  applySitOnBedEdgePose,
  applySitOnSofaPose,
  applyWatchTVPose,
  applyEatFoodPose,
  applyUseToiletPose,
  applyWashSinkPose,
  applyPillowFightPose
} from "../sim/sim-character.js";
import { updateCharacterAnimation } from "../sim/sim-character-anim.js";
import {
  isSleepingWithLightOnCore,
  findFurnitureForNeedCore,
  startFurnitureInteractionCore
} from "../sim/sim-interactions.js";
import {
  hideInteractionMenu,
  showInteractionMenuForFurniture,
  showInteractionMenuForPet
} from "../sim/sim-interaction-menu.js";
import { getFurnitureRoot } from "./build-mode.js";
import {
  NEED_KEYS,
  getCurrentMoodLabel,
  getMoodSpeedMultiplier,
  getPersonalityNeedPriority,
  getInteractionPreferenceScore,
  getPersonalityAdjustedRefuseChance,
  tickNeeds,
  getNeedsSnapshot,
  setAllNeeds
} from "../sim/sim-needs.js";

/* ================= 生活模式與角色邏輯 ================= */

let character = null;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isRunKeyDown = false; // Shift 跑步鍵狀態

// 鏡頭平移狀態（方向鍵控制）
let camPanUp = false;
let camPanDown = false;
let camPanLeft = false;
let camPanRight = false;

const CAMERA_PAN_SPEED = 6; // 鏡頭平移速度（世界單位/秒）
const DEFAULT_CAMERA_OFFSET = new THREE.Vector3(8, 8, 8); // 聚焦角色時，相機相對角色的預設偏移

let moveTarget = null; // THREE.Vector3 | null
let hasMoveTarget = false;
let moveMarker = null;
let pathCells = null;
let pathIndex = 0;
let walkPhase = 0;
let pendingInteraction = null; // { furniture, actionId }
let interactionMenuElement = null;
let interactionState = null; // "sleep" | "sit_edge" | "pillow_fight" | null
let interactionTimer = 0;
let sleepTarget = null; // { furniture, furnRot } | null

let pet = null;
let petLoading = false;
let petEnabled = true;

let petMixer = null;
let petAnimActions = {
  idle: null,
  run: null,
  sleep: null
};
let currentPetActionName = null;

let moodToastElement = null;
let isAutoInteraction = false;

// 自由意志：空閒時根據性格偏好主動找點事做
let freeWillTimer = 0;
let nextFreeWillDelay = 0;
const FREE_WILL_IDLE_BASE_INTERVAL = 8; // 基礎間隔（秒）
const FREE_WILL_IDLE_RANDOM_INTERVAL = 6; // 額外隨機抖動（秒）

let petIdleTimer = 0;
let petLongIdleTimer = 0;
let isRidingPet = false; // 是否正騎乘在寵物身上

const PET_YAW_FIX = Math.PI / 2; // 豹子模型的可視前方相對於邏輯朝向逆時針旋轉 90 度

let petBackHeightWorld = 0.4; // 粗略估計豹子背部高度，用於計算騎乘時小人的 Y

// 豹子專用貼圖：當 GLTFLoader 未能解析 SpecGloss 擴展、導致 material.map 為 null 時，
// 用這些貼圖補上顏色與法線，不覆蓋已存在的貼圖。
let petDiffuseMap = null;
let petNormalMap = null;
let petSpecGlossMap = null;
let petTextureLoader = null;

function ensurePetTexturesLoaded() {
  if (!petTextureLoader) {
    petTextureLoader = new THREE.TextureLoader();
  }

  const baseUrl = new URL(
    "../public/models/leopard/textures/",
    import.meta.url
  ).href;

  if (!petDiffuseMap) {
    petDiffuseMap = petTextureLoader.load(
      baseUrl + "CH_NPC_MOB_SLeopard_A01_MI_BYN_diffuse.png"
    );
    if (petDiffuseMap.colorSpace !== undefined && THREE.SRGBColorSpace) {
      petDiffuseMap.colorSpace = THREE.SRGBColorSpace;
    }
    // glTF 使用的貼圖約定 flipY = false
    petDiffuseMap.flipY = false;
  }

  if (!petNormalMap) {
    petNormalMap = petTextureLoader.load(
      baseUrl + "CH_NPC_MOB_SLeopard_A01_MI_BYN_normal.png"
    );
    petNormalMap.flipY = false;
  }

  if (!petSpecGlossMap) {
    petSpecGlossMap = petTextureLoader.load(
      baseUrl + "CH_NPC_MOB_SLeopard_A01_MI_BYN_specularGlossiness.jpeg"
    );
    petSpecGlossMap.flipY = false;
  }
}

function resetFreeWillTimer() {
  freeWillTimer = 0;
  nextFreeWillDelay =
    FREE_WILL_IDLE_BASE_INTERVAL + Math.random() * FREE_WILL_IDLE_RANDOM_INTERVAL;
}

function setPetEnabled(enabled) {
  petEnabled = !!enabled;
  if (pet) {
    pet.visible = petEnabled;
  }
}

function getRiderHeight() {
  if (!pet || !character) return 0.6;

  // 估算豹子背部世界高度：基於預先計算的包圍盒與一點點額外抬高避免腿完全穿模
  const backY = petBackHeightWorld;

  // 小人腰部本地高度約 0.7，乘以縮放得到世界高度
  const charScaleY = character.scale && typeof character.scale.y === "number" ? character.scale.y : 1;
  const hipOffset = 0.7 * charScaleY;

  const seatExtra = 0.07; // 稍微往下沉一點，更貼近豹子背

  let riderHeight = backY + seatExtra - hipOffset;
  if (!Number.isFinite(riderHeight)) riderHeight = 0.6;
  if (riderHeight < 0.05) riderHeight = 0.05;
  return riderHeight;
}

function startPetInteraction(actionId) {
  if (!pet || !character) return;

  if (actionId === "pet_ride") {
    // 切換騎乘狀態：若已在騎乘，則視為下馬
    isRidingPet = !isRidingPet;

    if (isRidingPet) {
      // 讓角色坐到豹子背上方一點的位置
      const riderHeight = getRiderHeight();
      character.position.x = pet.position.x;
      character.position.z = pet.position.z;
      character.position.y = riderHeight;
    } else {
      // 下馬時回到地面
      character.position.y = 0;
    }

    return;
  }

  // 其他互動暫時只給出提示，後續可補充具體姿勢與動畫
  if (actionId === "pet_headpat") {
    showMoodToast("摸了摸寵物的頭");
  } else if (actionId === "pet_feed") {
    showMoodToast("給寵物投喂了一點東西");
  } else if (actionId === "pet_hug") {
    showMoodToast("抱了抱寵物");
  }
}

function initPetAnimations(gltf) {
  if (!gltf || !Array.isArray(gltf.animations) || !gltf.animations.length || !pet) {
    return;
  }

  const clips = gltf.animations;
  console.log("[pet] available animations:", clips.map(clip => clip.name));

  petMixer = new THREE.AnimationMixer(pet);

  function pickClip(preferredNames, fallbackIndex) {
    const lowerPreferred = preferredNames.map(name => String(name).toLowerCase());
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const nm = (clip.name || "").toLowerCase();
      if (!nm) continue;
      for (let j = 0; j < lowerPreferred.length; j++) {
        if (nm.includes(lowerPreferred[j])) {
          return clip;
        }
      }
    }
    if (typeof fallbackIndex === "number" && clips[fallbackIndex]) {
      return clips[fallbackIndex];
    }
    return clips[0];
  }

  const nameMap = {};
  clips.forEach(clip => {
    const key = (clip.name || "").toLowerCase();
    if (key) {
      nameMap[key] = clip;
    }
  });

  // 針對當前豹子模型明確指定：
  // idle  -> LeopardALL_Idle
  // run   -> LeopardALL_Run（退化到 Walk）
  // sleep -> LeopardALL_Graze（睡在床邊時使用）
  // sit   -> LeopardALL_Sick（長時間發呆時，坐/趴在小人旁邊）
  const idleClip =
    nameMap["leopardall_idle"] || pickClip(["idle", "stand", "breath", "rest"], 0);
  const runClip =
    nameMap["leopardall_run"] ||
    nameMap["leopardall_walk"] ||
    pickClip(["run", "sprint", "walk", "jog"], 0);
  const sleepClip =
    nameMap["leopardall_graze"] ||
    nameMap["leopardall_idle"] ||
    pickClip(["idle", "rest"], 0);
  const sitClip =
    nameMap["leopardall_sick"] ||
    nameMap["leopardall_graze"] ||
    idleClip;

  petAnimActions.idle = petMixer.clipAction(idleClip);
  petAnimActions.run = petMixer.clipAction(runClip);
  petAnimActions.sleep = petMixer.clipAction(sleepClip);
  petAnimActions.sit = petMixer.clipAction(sitClip);

  Object.keys(petAnimActions).forEach(key => {
    const action = petAnimActions[key];
    if (!action) return;
    action.loop = THREE.LoopRepeat;
    action.clampWhenFinished = false;
    action.enabled = false;
  });

  // 預設使用待機動畫
  playPetAction("idle");
}

function playPetAction(name) {
  if (!petMixer || !petAnimActions) return;
  const next = petAnimActions[name];
  if (!next) return;
  if (currentPetActionName === name) return;

  let timeScale = 1;
  if (name === "run") timeScale = 1.3;
  if (name === "sleep") timeScale = 0.6;
  if (name === "sit") timeScale = 0.7;
  next.timeScale = timeScale;

  const prev = currentPetActionName ? petAnimActions[currentPetActionName] : null;

  if (prev && prev !== next) {
    prev.enabled = true;
    next.enabled = true;
    next.reset();
    next.play();
    prev.crossFadeTo(next, 0.25, false);
  } else {
    next.enabled = true;
    next.reset();
    next.play();
  }

  next.setEffectiveWeight(1);

  currentPetActionName = name;
}

function updatePetAnimationByState(isMoving, isSleeping) {
  if (!petMixer) return;
  if (isSleeping) {
    playPetAction("sleep");
  } else if (isMoving) {
    playPetAction("run");
  } else if (petLongIdleTimer > 6) {
    // 長時間發呆：坐在小人身旁
    playPetAction("sit");
  } else {
    playPetAction("idle");
  }
}

function loadPetModel() {
  if (pet || petLoading || !petEnabled) return;
  petLoading = true;

  const loader = new GLTFLoader();
  const url = new URL(
    "../public/models/leopard/animated_stylized_leopard__3d_animal_model.glb",
    import.meta.url
  ).href;
  console.log("[pet] loading leopard GLB from", url);

  loader.load(
    url,
    gltf => {
      petLoading = false;
      const leopard = gltf && gltf.scene ? gltf.scene : null;
      if (!leopard) {
        console.warn("[pet] GLTF loaded but no scene found");
        return;
      }

      // 調試：檢查場景與每個 mesh 的材質貼圖是否存在
      console.log("[pet] gltf.scene", gltf.scene);

      leopard.traverse(obj => {
        if (obj.isMesh) {
          console.log("[pet] mesh material", obj.name, obj.material);
          obj.castShadow = true;
          obj.receiveShadow = true;

          const applyMat = mat => {
            if (!mat) return;
            // 若 GLTFLoader 未給此材質設置 diffuse map（map 為 null），
            // 則使用豹子原始貼圖補上；已存在的貼圖一律不覆蓋。
            if (!mat.map) {
              ensurePetTexturesLoaded();
              if (petDiffuseMap) {
                mat.map = petDiffuseMap;
              }
            }
            if (!mat.normalMap && petNormalMap) {
              ensurePetTexturesLoaded();
              mat.normalMap = petNormalMap;
            }

            // 基於目前 GLTFLoader 未能解析 SpecGloss 擴展的情況，
            // 適度調整金屬度/粗糙度，避免整體過黑。
            if (typeof mat.metalness === "number") {
              mat.metalness = 0.0;
            }
            if (typeof mat.roughness === "number") {
              mat.roughness = 0.7;
            }

            // 僅修正渲染方式，不覆蓋 glTF 其它屬性
            mat.side = THREE.DoubleSide;
            if (mat.alphaMap) {
              mat.alphaTest = 0.5;
            } else {
              // 沒有單獨 alphaMap 時，關閉整體透明，避免模型發虛
              if (typeof mat.transparent === "boolean") mat.transparent = false;
              if (typeof mat.opacity === "number") mat.opacity = 1.0;
              if (typeof mat.depthWrite === "boolean") mat.depthWrite = true;
            }
            mat.needsUpdate = true;
          };

          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => applyMat(m));
          } else if (obj.material) {
            applyMat(obj.material);
          }
        }
      });

      // 粗略縮放到與小人接近的尺寸，之後可視覺調整
      leopard.scale.set(0.9, 0.9, 0.9);

      ensureCharacter();
      if (character) {
        leopard.position.set(
          character.position.x + 0.8,
          0,
          character.position.z + 0.8
        );
      } else {
        leopard.position.set(0.5, 0, 0.5);
      }

      scene.add(leopard);
      pet = leopard;
      console.log("[pet] leopard model added to scene");

      // 根據實際縮放後的模型包圍盒估算背部高度（略低於整體高度）
      const bbox = new THREE.Box3().setFromObject(leopard);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      // 取從腳到背部大約 60% 高度的位置作為背的高度估計
      petBackHeightWorld = bbox.min.y + size.y * 0.6;

      initPetAnimations(gltf);
    },
    undefined,
    error => {
      petLoading = false;
      console.error("[pet] failed to load leopard GLTF", error);
    }
  );
}

function updatePetFollow(delta, movedThisFrame) {
  if (!petEnabled || !pet || !character) return;

  const isSleeping =
    interactionState === "sleep" || interactionState === "sleep_enter";
  const isMoving =
    movedThisFrame ||
    hasMoveTarget ||
    moveForward ||
    moveBackward ||
    moveLeft ||
    moveRight;

  // 騎乘時由角色驅動位置，寵物貼在角色下方並播放「跑」或「待機」動作
  if (isRidingPet) {
    const riderHeight = getRiderHeight();

    // 寵物跟隨角色的平面位置
    pet.position.x = character.position.x;
    pet.position.z = character.position.z;
    pet.position.y = 0;

    // 角色保持在背上
    character.position.y = riderHeight;

    // 寵物朝向角色當前朝向
    const dirX = Math.sin(character.rotation.y);
    const dirZ = Math.cos(character.rotation.y);
    pet.lookAt(
      pet.position.x + dirX,
      pet.position.y,
      pet.position.z + dirZ
    );
    pet.rotation.y += PET_YAW_FIX;

    updatePetAnimationByState(isMoving, false);
    return;
  }

  updatePetAnimationByState(isMoving, isSleeping);

  let targetX = character.position.x - 0.8;
  let targetZ = character.position.z - 0.6;
  let speed = 2.8;

  if (isSleeping && sleepTarget && sleepTarget.furniture) {
    const furn = sleepTarget.furniture;
    const yaw =
      (sleepTarget.furnRot && Number.isFinite(sleepTarget.furnRot)
        ? sleepTarget.furnRot
        : furn.rotation && typeof furn.rotation.y === "number"
        ? furn.rotation.y
        : 0);
    const distFromBed = 1;
    const localX = 0;
    const localZ = distFromBed;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const worldOffsetX = localX * cos - localZ * sin;
    const worldOffsetZ = localX * sin + localZ * cos;
    targetX = furn.position.x + worldOffsetX;
    targetZ = furn.position.z + worldOffsetZ;
    speed = 2;
  } else if (!isMoving && !interactionState) {
    // 小人站立發呆：短時間內原地小幅晃動，久了之後坐在旁邊
    petIdleTimer += delta;
    petLongIdleTimer += delta;

    const baseDist = petLongIdleTimer > 6 ? 0.4 : 0.8;
    const wobbleAmp = 0.05;
    const wobbleSpeed = 1.5;
    const wobble = Math.sin(petIdleTimer * wobbleSpeed) * wobbleAmp;

    targetX = character.position.x - baseDist;
    targetZ = character.position.z - 0.6 + wobble;
    speed = petLongIdleTimer > 6 ? 1.5 : 1.0;
  } else if (isMoving) {
    petIdleTimer = 0;
    petLongIdleTimer = 0;
    speed = 4;
  } else {
    petIdleTimer = 0;
    petLongIdleTimer = 0;
  }

  const dx = targetX - pet.position.x;
  const dz = targetZ - pet.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.02) return;

  const maxStep = speed * delta;
  const ratio = Math.min(1, maxStep / (dist || 1));
  pet.position.x += dx * ratio;
  pet.position.z += dz * ratio;
  pet.position.y = 0;

  let lookX = character.position.x;
  let lookZ = character.position.z;
  if (isSleeping && sleepTarget && sleepTarget.furniture) {
    lookX = sleepTarget.furniture.position.x;
    lookZ = sleepTarget.furniture.position.z;
  }

  pet.lookAt(lookX, pet.position.y, lookZ);
  pet.rotation.y += PET_YAW_FIX;
}

function updateCharacterRotationTowards(dirX, dirZ, delta) {
  if (!character) return;
  simUpdateCharacterRotationTowards(character, dirX, dirZ, delta);
}

function ensureCharacter() {
  if (character) return character;

  const group = createCharacter();

  let spawnX = 0.5;
  let spawnZ = 0.5;
  if (floors.length > 0) {
    const g = floors[0].userData && floors[0].userData.grid;
    if (g) {
      spawnX = g.x + 0.5;
      spawnZ = g.z + 0.5;
    }
  }

  group.position.set(spawnX, 0, spawnZ);
  scene.add(group);
  character = group;
  return character;
}

function focusCameraOnCharacter() {
  ensureCharacter();
  if (!character) return;

  const target = new THREE.Vector3(
    character.position.x,
    character.position.y + 1.5,
    character.position.z
  );

  camera.position.set(
    target.x + DEFAULT_CAMERA_OFFSET.x,
    target.y + DEFAULT_CAMERA_OFFSET.y,
    target.z + DEFAULT_CAMERA_OFFSET.z
  );

  if (controls && controls.target) {
    controls.target.copy(target);
    controls.update();
  } else {
    camera.lookAt(target);
  }
}

function resetLiveState() {
  moveForward = false;
  moveBackward = false;
  moveLeft = false;
  moveRight = false;
  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;
  pendingInteraction = null;
  interactionState = null;
  interactionTimer = 0;
  resetCharacterPose();
  // 刷新需求與心情面板：保持當前數值不變，只觸發 UI 更新
  const snapshot = getNeedsSnapshot();
  if (snapshot) {
    setAllNeeds(snapshot);
  }
  resetFreeWillTimer();
}

function handleLiveKeyDown(e) {
  if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
    if (interactionState) {
      interactionState = null;
      interactionTimer = 0;
      resetCharacterPose();
    }
    moveForward = true;
  }
  if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
    if (interactionState) {
      interactionState = null;
      interactionTimer = 0;
      resetCharacterPose();
    }
    moveBackward = true;
  }
  if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
    if (interactionState) {
      interactionState = null;
      interactionTimer = 0;
      resetCharacterPose();
    }
    moveLeft = true;
  }
  if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
    if (interactionState) {
      interactionState = null;
      interactionTimer = 0;
      resetCharacterPose();
    }
    moveRight = true;
  }
  if (e.key === "Shift") {
    isRunKeyDown = true;
  }
  if (e.key === "f" || e.key === "F") {
    focusCameraOnCharacter();
  }
}

function handleLiveKeyUp(e) {
  if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
    moveForward = false;
  }
  if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
    moveBackward = false;
  }
  if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
    moveLeft = false;
  }
  if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
    moveRight = false;
  }
  if (e.key === "Shift") {
    isRunKeyDown = false;
  }
}

function updateMouseFromEvent(e) {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
}

function resetCharacterPose() {
  if (!character) return;
  simResetCharacterPose(character);
}

function isSleepingWithLightOn() {
  ensureCharacter();
  if (!character) return false;
  return isSleepingWithLightOnCore(interactionState, character, furnitures);
}

function updateNeedsAndMood(delta) {
  tickNeeds(delta, interactionState, isSleepingWithLightOn());
}

function updateLiveCamera(delta) {
  if (!camPanUp && !camPanDown && !camPanLeft && !camPanRight) return;

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  const forwardLen = Math.hypot(forward.x, forward.z) || 1;
  forward.x /= forwardLen;
  forward.z /= forwardLen;

  const right = new THREE.Vector3(forward.z, 0, -forward.x);

  let panX = 0;
  let panZ = 0;

  if (camPanUp) {
    panX += forward.x;
    panZ += forward.z;
  }
  if (camPanDown) {
    panX -= forward.x;
    panZ -= forward.z;
  }
  if (camPanRight) {
    panX += right.x;
    panZ += right.z;
  }
  if (camPanLeft) {
    panX -= right.x;
    panZ -= right.z;
  }

  const len = Math.hypot(panX, panZ);
  if (len === 0) return;
  panX /= len;
  panZ /= len;

  const step = CAMERA_PAN_SPEED * delta;
  panX *= step;
  panZ *= step;

  camera.position.x += panX;
  camera.position.z += panZ;

  if (controls && controls.target) {
    controls.target.x += panX;
    controls.target.z += panZ;
  }
}

// 供按鈕單次調用的鏡頭平移：direction = "up" | "down" | "left" | "right"，distance 為世界單位距離
function panCameraOnce(direction, distance) {
  const dist = typeof distance === "number" && Number.isFinite(distance) ? distance : 2;

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  const forwardLen = Math.hypot(forward.x, forward.z) || 1;
  forward.x /= forwardLen;
  forward.z /= forwardLen;

  const right = new THREE.Vector3(forward.z, 0, -forward.x);

  let panX = 0;
  let panZ = 0;

  if (direction === "up") {
    panX += forward.x;
    panZ += forward.z;
  } else if (direction === "down") {
    panX -= forward.x;
    panZ -= forward.z;
  } else if (direction === "right") {
    panX += right.x;
    panZ += right.z;
  } else if (direction === "left") {
    panX -= right.x;
    panZ -= right.z;
  }

  const len = Math.hypot(panX, panZ);
  if (len === 0) return;
  panX = (panX / len) * dist;
  panZ = (panZ / len) * dist;

  camera.position.x += panX;
  camera.position.z += panZ;

  if (controls && controls.target) {
    controls.target.x += panX;
    controls.target.z += panZ;
  }
}

// 床頭位置與躺下頭部目標點的計算、以及床頭朝向 yaw，現由 sim-character.js 提供：
// getBedHeadYaw / getSleepHeadWorldPosition

function showMoodToast(message) {
  if (typeof document === "undefined") return;

  if (!moodToastElement) {
    const div = document.createElement("div");
    div.style.position = "fixed";
    div.style.left = "50%";
    div.style.top = "24px";
    div.style.transform = "translateX(-50%)";
    div.style.padding = "4px 10px";
    div.style.borderRadius = "4px";
    div.style.background = "rgba(0, 0, 0, 0.85)";
    div.style.color = "#fff";
    div.style.fontSize = "12px";
    div.style.zIndex = "1100";
    div.style.pointerEvents = "none";
    document.body.appendChild(div);
    moodToastElement = div;
  }

  moodToastElement.textContent = message;
  moodToastElement.style.display = "block";

  if (moodToastElement._hideTimer) {
    clearTimeout(moodToastElement._hideTimer);
  }
  moodToastElement._hideTimer = setTimeout(() => {
    if (!moodToastElement) return;
    moodToastElement.style.display = "none";
  }, 1500);
}

function startFurnitureInteraction(furniture, actionId) {
  if (!furniture || !furniture.userData || !furniture.userData.grid) return;
  ensureCharacter();
  if (!character) return;

  const state = {
    isAutoInteraction,
    pendingInteraction,
    hasMoveTarget,
    pathCells,
    pathIndex,
    moveMarker,
    moveTarget
  };

  const updated = startFurnitureInteractionCore(furniture, actionId, character, state, showMoodToast);

  isAutoInteraction = updated.isAutoInteraction;
  pendingInteraction = updated.pendingInteraction;
  hasMoveTarget = updated.hasMoveTarget;
  pathCells = updated.pathCells;
  pathIndex = updated.pathIndex;
  moveMarker = updated.moveMarker;
  moveTarget = updated.moveTarget;
}

function findFurnitureForNeed(needKey) {
  return findFurnitureForNeedCore(needKey, character, furnitures);
}

function maybeAutoSatisfyCriticalNeed() {
  const snapshot = getNeedsSnapshot();
  if (!snapshot) return;

  // 根據性格偏好，計算「主觀緊急度」最高的需求
  let bestKey = null;
  let bestScore = 0;
  NEED_KEYS.forEach(key => {
    const raw = typeof snapshot[key] === "number" ? snapshot[key] : 0;
    const score = getPersonalityNeedPriority(key, raw);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  });
  if (!bestKey) return;

  const rawValue = typeof snapshot[bestKey] === "number" ? snapshot[bestKey] : 0;
  const value = rawValue;
  const CRITICAL = 20;
  if (value > CRITICAL) return;

  // 玩家正在用按鍵控制時，不強行接管
  if (moveForward || moveBackward || moveLeft || moveRight) return;

  const moodLabel = getCurrentMoodLabel();

  // 已經在對應需求的互動中，就不要再打斷
  if (interactionState) {
    if (
      (bestKey === "sleep" && (interactionState === "sleep" || interactionState === "sleep_enter")) ||
      (bestKey === "hunger" && interactionState === "eat_food") ||
      (bestKey === "bladder" && interactionState === "toilet_use") ||
      (bestKey === "fun" &&
        (interactionState === "tv_watch" || interactionState === "sofa_sit" || interactionState === "pillow_fight")) ||
      (bestKey === "hygiene" && interactionState === "sink_wash")
    ) {
      return;
    }
  }

  ensureCharacter();
  if (!character) return;

  const target = findFurnitureForNeed(bestKey);
  if (!target) return;

  // 如果當前已經在朝同一個目標移動，就不重複設置
  if (
    hasMoveTarget &&
    pendingInteraction &&
    pendingInteraction.furniture === target.furniture &&
    pendingInteraction.actionId === target.actionId
  ) {
    return;
  }

  // 打斷當前移動和非關鍵互動，優先滿足最糟需求
  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;
  interactionState = null;
  interactionTimer = 0;
  sleepTarget = null;
  resetCharacterPose();

  isAutoInteraction = true;
  startFurnitureInteraction(target.furniture, target.actionId);

  if (moodLabel === "崩溃中") {
    showMoodToast("我受不了了，先去滿足自己的需求！");
  } else {
    showMoodToast("心情好差，只想先滿足自己的需求…");
  }
}

// 自由意志：在非緊急情況下，空閒一段時間後，根據性格與偏好主動選擇一個行為
function maybeDoFreeWillAction(delta) {
  // 玩家正在用按鍵控制或角色正在移動 / 互動時，不觸發自由意志
  const playerControlling = moveForward || moveBackward || moveLeft || moveRight;
  const busy =
    playerControlling ||
    hasMoveTarget ||
    !!pendingInteraction ||
    !!interactionState ||
    !!sleepTarget;

  if (busy) {
    resetFreeWillTimer();
    return;
  }

  freeWillTimer += delta;
  if (nextFreeWillDelay <= 0) {
    resetFreeWillTimer();
  }
  if (freeWillTimer < nextFreeWillDelay) return;

  const snapshot = getNeedsSnapshot();
  if (!snapshot) {
    resetFreeWillTimer();
    return;
  }

  const CRITICAL = 20;

  // 候選：與具體互動行為對應的需求鍵
  const candidateNeedKeys = ["sleep", "hunger", "bladder", "fun", "hygiene"];

  ensureCharacter();
  if (!character) {
    resetFreeWillTimer();
    return;
  }

  let bestTarget = null;
  let bestScore = 0;

  candidateNeedKeys.forEach(key => {
    const raw = typeof snapshot[key] === "number" ? snapshot[key] : 0;
    const value = Math.max(0, Math.min(100, raw));

    // 緊急情況會由 maybeAutoSatisfyCriticalNeed 處理，這裡只處理非緊急
    if (value <= CRITICAL) return;

    const target = findFurnitureForNeed(key);
    if (!target || !target.furniture || !target.actionId) return;

    // 需求越低越想去做，但這裡只是弱化版（因為還沒有到臨界值）
    const needUrgency = (100 - value) / 100; // 0~1

    // 行為偏好：來自性格設定，範圍約 [-2, 2]
    const pref = getInteractionPreferenceScore(target.actionId) || 0;
    const prefNorm = (pref + 2) / 4; // 映射到 0~1，0.5 為中立

    // 綜合分數：更偏向性格喜好，其次才是略微下降的需求
    const score = needUrgency * 0.3 + prefNorm * 0.7;
    if (score <= 0.05) return;

    if (score > bestScore) {
      bestScore = score;
      bestTarget = target;
    }
  });

  if (!bestTarget) {
    resetFreeWillTimer();
    return;
  }

  // 略帶隨機性，避免每次到點都必然觸發
  if (Math.random() < 0.25) {
    resetFreeWillTimer();
    return;
  }

  // 觸發一次自由行為
  isAutoInteraction = true;
  startFurnitureInteraction(bestTarget.furniture, bestTarget.actionId);
  showMoodToast("我想做點自己喜歡的事…");

  resetFreeWillTimer();
}

function enterSleepPose(furniture, furnRot) {
  ensureCharacter();
  if (!character) return;

  applySleepPose(character, furniture);

  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;

  interactionState = "sleep";
  interactionTimer = 0;
}

function enterSitOnBedEdgePose(furniture, furnRot) {
  ensureCharacter();
  if (!character) return;

  applySitOnBedEdgePose(character, furniture, furnRot);

  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;

  interactionState = "sit_edge";
  interactionTimer = 0;
}

function enterSitOnSofaPose(furniture, furnRot) {
  ensureCharacter();
  if (!character) return;

  applySitOnSofaPose(character, furniture, furnRot);

  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;

  interactionState = "sofa_sit";
  interactionTimer = 0;
}

function enterWatchTVPose(furniture, furnRot) {
  ensureCharacter();
  if (!character) return;

  applyWatchTVPose(character, furniture, furnRot);

  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;

  interactionState = "tv_watch";
  interactionTimer = 0;
}

function enterEatFoodPose(furniture, furnRot) {
  ensureCharacter();
  if (!character) return;

  applyEatFoodPose(character, furniture, furnRot);

  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;

  scheduleDestroy(furnitures, furniture);
  interactionState = "eat_food";
  interactionTimer = 0;
}

function enterUseToiletPose(furniture, furnRot) {
  ensureCharacter();
  if (!character) return;

  applyUseToiletPose(character, furniture, furnRot);

  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;

  interactionState = "toilet_use";
  interactionTimer = 0;
}

function enterWashSinkPose(furniture, furnRot) {
  ensureCharacter();
  if (!character) return;

  applyWashSinkPose(character, furniture, furnRot);

  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;

  interactionState = "sink_wash";
  interactionTimer = 0;
}

function enterFridgeEatPose(furniture, furnRot) {
  ensureCharacter();
  if (!character) return;

  // 使用與直接吃食物相同的姿勢，只是位置參考變為冰箱
  applyEatFoodPose(character, furniture, furnRot);

  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;

  interactionState = "fridge_eat";
  interactionTimer = 0;
}

function enterPlayGuitarPose(furniture, furnRot) {
  ensureCharacter();
  if (!character) return;

  // 先重用枕頭戰的站立揮動姿勢，作為彈吉他的佔位動畫
  applyPillowFightPose(character, furniture, furnRot);

  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;

  interactionState = "play_guitar";
  interactionTimer = 0;
}

function enterUseComputerPose(furniture, furnRot) {
  ensureCharacter();
  if (!character) return;

  // 重用沙發坐姿，將角色安排在桌前就座
  applySitOnSofaPose(character, furniture, furnRot);

  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;

  interactionState = "use_computer";
  interactionTimer = 0;
}

function enterShowerPose(furniture, furnRot) {
  ensureCharacter();
  if (!character) return;

  // 目前重用洗手池洗漱的站立姿勢，作為淋浴的簡化版本
  applyWashSinkPose(character, furniture, furnRot);

  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;

  interactionState = "shower_wash";
  interactionTimer = 0;
}

function enterBathtubPose(furniture, furnRot) {
  ensureCharacter();
  if (!character) return;

  // 先重用坐床邊姿勢，近似表現泡在浴缸裡
  applySitOnBedEdgePose(character, furniture, furnRot);

  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;

  interactionState = "bathtub_bath";
  interactionTimer = 0;
}

function enterPillowFightPose(furniture, furnRot) {
  ensureCharacter();
  if (!character) return;

  applyPillowFightPose(character, furniture, furnRot);

  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;

  interactionState = "pillow_fight";
  interactionTimer = 0;
}

function handleLiveMouseDown(e) {
  if (e.button !== 0) return;
  hideInteractionMenu();
  updateMouseFromEvent(e);
  raycaster.setFromCamera(mouse, camera);

  ensureCharacter();

  // 單次射線檢測：角色 + 寵物 + 家具
  const targets = [];
  if (pet) targets.push(pet);
  if (character) targets.push(character);
  if (furnitures && furnitures.length) {
    for (let i = 0; i < furnitures.length; i++) {
      if (furnitures[i]) targets.push(furnitures[i]);
    }
  }

  const hits = targets.length ? raycaster.intersectObjects(targets, true) : [];

  // 調試輸出：觀察點擊時實際命中了哪些物件
  if (typeof console !== "undefined" && console.log) {
    console.log("[live-click] targets=", targets.length, "hits=", hits.length,
      hits.map(h => (h.object && h.object.name) || "<noname>"));
  }

  function isDescendantOf(root, obj) {
    if (!root || !obj) return false;
    let cur = obj;
    while (cur) {
      if (cur === root) return true;
      cur = cur.parent;
    }
    return false;
  }

  if (hits.length) {
    // 先在所有命中結果中尋找寵物 / 小人，避免被其它物件遮擋
    let petHit = null;
    let simHit = null;

    for (let i = 0; i < hits.length; i++) {
      const obj = hits[i].object;
      if (!petHit && pet && isDescendantOf(pet, obj)) {
        petHit = hits[i];
      }
      if (!simHit && character && isDescendantOf(character, obj)) {
        simHit = hits[i];
      }
    }

    // 1) 若有命中寵物：打開寵物互動菜單
    if (petHit && pet) {
      if (console && console.log) {
        console.log("[live-click] hit pet -> show pet menu");
      }
      showInteractionMenuForPet(pet, e.clientX, e.clientY, (_pet, actionId) => {
        startPetInteraction(actionId);
      });
      return;
    }

    // 2) 若有命中小人：騎乘時視為對寵物互動，否則打開性格面板
    if (simHit && character) {
      if (console && console.log) {
        console.log("[live-click] hit character; isRidingPet=", isRidingPet);
      }
      if (isRidingPet && pet) {
        showInteractionMenuForPet(pet, e.clientX, e.clientY, (_pet, actionId) => {
          startPetInteraction(actionId);
        });
      } else if (
        typeof window !== "undefined" &&
        typeof window.togglePersonalityPanelFromSimClick === "function"
      ) {
        window.togglePersonalityPanelFromSimClick();
      }
      return;
    }

    // 3) 其餘命中若為有交互類型的家具，則打開家具菜單
    const first = hits[0].object;
    const root = getFurnitureRoot(first) || first;
    if (root && root.userData && root.userData.type) {
      if (console && console.log) {
        console.log("[live-click] hit furniture type=", root.userData.type);
      }
      showInteractionMenuForFurniture(root, e.clientX, e.clientY, (f, actionId) => {
        startFurnitureInteraction(f, actionId);
      });
      return;
    }
    // 否則視為無效命中，後續落回到地面點擊處理
  }

  // 其餘情況仍然是點擊地面移動
  const hit = raycaster.intersectObject(ground);
  if (console && console.log) {
    console.log("[live-click] ground hit count=", hit.length);
  }
  if (!hit.length) return;

  ensureCharacter();
  const groundPoint = hit[0].point;

  // 若沒有直接命中寵物 mesh，但點擊位置在寵物附近，視為寵物點擊
  if (pet) {
    const dxPet = groundPoint.x - pet.position.x;
    const dzPet = groundPoint.z - pet.position.z;
    const distPet = Math.hypot(dxPet, dzPet);
    const PET_CLICK_RADIUS = 1.4; // 可點擊半徑（世界單位），放大一些方便點擊身體
    if (distPet <= PET_CLICK_RADIUS) {
      if (console && console.log) {
        console.log("[live-click] ground near pet (", distPet, ") -> treat as pet click");
      }
      showInteractionMenuForPet(pet, e.clientX, e.clientY, (_pet, actionId) => {
        startPetInteraction(actionId);
      });
      return;
    }
  }

  const targetCellX = snap(groundPoint.x);
  const targetCellZ = snap(groundPoint.z);

  if (!character) return;
  const startCellX = Math.floor(character.position.x);
  const startCellZ = Math.floor(character.position.z);

  // 點擊地面開始移動時，取消當前的床上交互姿勢
  if (interactionState) {
    interactionState = null;
    interactionTimer = 0;
    sleepTarget = null;
    resetCharacterPose();
  }

   // 點擊地面時若正在騎乘，順便下馬
  if (isRidingPet) {
    isRidingPet = false;
    character.position.y = 0;
  }

  const path = findPath(startCellX, startCellZ, targetCellX, targetCellZ);
  if (!path || path.length < 2) {
    hasMoveTarget = false;
    pendingInteraction = null;
    if (moveMarker) moveMarker.visible = false;
    return;
  }

  pathCells = path;
  pathIndex = 1; // 0 是當前所在格子
  moveTarget = new THREE.Vector3(targetCellX + 0.5, 0, targetCellZ + 0.5);
  hasMoveTarget = true;
  pendingInteraction = null;

  if (!moveMarker) {
    const geo = new THREE.CircleGeometry(0.3, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.7 });
    moveMarker = new THREE.Mesh(geo, mat);
    moveMarker.rotation.x = -Math.PI / 2;
    moveMarker.position.y = 0.01;
    scene.add(moveMarker);
  }
  moveMarker.position.x = moveTarget.x;
  moveMarker.position.z = moveTarget.z;
  moveMarker.visible = true;
}

function updateLive(delta) {
  ensureCharacter();
  if (!character) return;

  if (petEnabled && !pet && !petLoading) {
    loadPetModel();
  }

  maybeAutoSatisfyCriticalNeed();

  // 在沒有緊急需求、且處於空閒狀態時，偶爾觸發基於性格與偏好的自由行為
  maybeDoFreeWillAction(delta);

  const moodFactor = getMoodSpeedMultiplier();
  // 基礎移動速度：WASD 默認為慢走，按住 Shift 進入跑步；騎乘時有獨立的更快速度
  const WALK_SPEED = 1.4;
  const RUN_SPEED = 3.5;
  const RIDE_WALK_SPEED = 3.0;
  const RIDE_RUN_SPEED = 6.0;
  const isRunningNow = isRunKeyDown || isRidingPet;
  let baseSpeed;
  if (isRidingPet) {
    baseSpeed = isRunKeyDown ? RIDE_RUN_SPEED : RIDE_WALK_SPEED;
  } else {
    baseSpeed = isRunKeyDown ? RUN_SPEED : WALK_SPEED;
  }
  const speed = baseSpeed * moodFactor;
  let dirX = 0;
  let dirZ = 0;
  if (moveForward) dirZ -= 1;
  if (moveBackward) dirZ += 1;
  if (moveLeft) dirX -= 1;
  if (moveRight) dirX += 1;

  let movedThisFrame = false;

  if (dirX !== 0 || dirZ !== 0) {
    const len = Math.hypot(dirX, dirZ) || 1;
    const ndx = dirX / len;
    const ndz = dirZ / len;
    const step = speed * delta;

    // 先嘗試在 X 軸方向移動
    if (ndx !== 0) {
      const targetX = character.position.x + ndx * step;
      const targetZ = character.position.z;
      if (canMoveCharacterTo(character.position.x, character.position.z, targetX, targetZ)) {
        character.position.x = targetX;
        character.position.z = targetZ;
        movedThisFrame = true;
      }
    }

    // 再嘗試在 Z 軸方向移動
    if (ndz !== 0) {
      const targetX = character.position.x;
      const targetZ = character.position.z + ndz * step;
      if (canMoveCharacterTo(character.position.x, character.position.z, targetX, targetZ)) {
        character.position.x = targetX;
        character.position.z = targetZ;
        movedThisFrame = true;
      }
    }

    if (movedThisFrame) {
      character.position.y = 0;
      updateCharacterRotationTowards(ndx, ndz, delta);
    }

    hasMoveTarget = false;
    pathCells = null;
    pathIndex = 0;
    if (moveMarker) moveMarker.visible = false;
  } else if (hasMoveTarget && pathCells && pathCells.length > 1) {
    const currentCell = pathCells[Math.min(pathIndex, pathCells.length - 1)];
    const targetX = currentCell.x + 0.5;
    const targetZ = currentCell.z + 0.5;
    const dx = targetX - character.position.x;
    const dz = targetZ - character.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.05) {
      const step = speed * delta;
      const ratio = Math.min(1, step / dist);
      const moveX = dx * ratio;
      const moveZ = dz * ratio;
      const nx = character.position.x + moveX;
      const nz = character.position.z + moveZ;
      if (canMoveCharacterTo(character.position.x, character.position.z, nx, nz)) {
        character.position.x = nx;
        character.position.z = nz;
        character.position.y = 0;
        const dirNX = dx / (dist || 1);
        const dirNZ = dz / (dist || 1);
        updateCharacterRotationTowards(dirNX, dirNZ, delta);
        movedThisFrame = true;
      } else {
        hasMoveTarget = false;
        pathCells = null;
        pathIndex = 0;
        if (moveMarker) moveMarker.visible = false;
        pendingInteraction = null;
      }
    } else {
      pathIndex++;
      if (pathIndex >= pathCells.length) {
        character.position.x = targetX;
        character.position.z = targetZ;
        character.position.y = 0;
        hasMoveTarget = false;
        pathCells = null;
        pathIndex = 0;
        if (moveMarker) moveMarker.visible = false;
        if (pendingInteraction && pendingInteraction.furniture) {
          const furn = pendingInteraction.furniture;
          const furnRot =
            (furn.rotation && typeof furn.rotation.y === "number"
              ? furn.rotation.y
              : furn.userData && typeof furn.userData.rotationY === "number"
              ? furn.userData.rotationY
              : 0);

          if (pendingInteraction.actionId === "sleep") {
            sleepTarget = { furniture: furn, furnRot };
            interactionState = "sleep_enter";
            interactionTimer = 0;
          } else if (pendingInteraction.actionId === "sit_edge") {
            enterSitOnBedEdgePose(furn, furnRot);
          } else if (pendingInteraction.actionId === "sofa_sit") {
            enterSitOnSofaPose(furn, furnRot);
          } else if (pendingInteraction.actionId === "tv_watch") {
            enterWatchTVPose(furn, furnRot);
          } else if (pendingInteraction.actionId === "eat_food") {
            enterEatFoodPose(furn, furnRot);
          } else if (pendingInteraction.actionId === "use_toilet") {
            enterUseToiletPose(furn, furnRot);
          } else if (pendingInteraction.actionId === "wash_sink") {
            enterWashSinkPose(furn, furnRot);
          } else if (pendingInteraction.actionId === "fridge_eat") {
            enterFridgeEatPose(furn, furnRot);
          } else if (pendingInteraction.actionId === "play_guitar") {
            enterPlayGuitarPose(furn, furnRot);
          } else if (pendingInteraction.actionId === "use_computer") {
            enterUseComputerPose(furn, furnRot);
          } else if (pendingInteraction.actionId === "shower_wash") {
            enterShowerPose(furn, furnRot);
          } else if (pendingInteraction.actionId === "bathtub_bath") {
            enterBathtubPose(furn, furnRot);
          } else if (pendingInteraction.actionId === "pillow_fight") {
            enterPillowFightPose(furn, furnRot);
          }
          pendingInteraction = null;
        }
      }
    }
  }

  updatePetFollow(delta, movedThisFrame);

  if (petMixer) {
    petMixer.update(delta);
  }

  // 根據方向鍵輸入平移鏡頭
  updateLiveCamera(delta);

  const moveSpeed = speed;
  const isRunning = isRunningNow;

  const animResult = updateCharacterAnimation(
    character,
    delta,
    moodFactor,
    movedThisFrame,
    interactionState,
    interactionTimer,
    sleepTarget,
    walkPhase,
    getBedHeadYaw,
    getSleepHeadWorldPosition,
    enterSleepPose,
    resetCharacterPose,
    updateNeedsAndMood,
    isRunning,
    isRidingPet
  );

  interactionState = animResult.interactionState;
  interactionTimer = animResult.interactionTimer;
  sleepTarget = animResult.sleepTarget;
  walkPhase = animResult.walkPhase;
}

export {
  ensureCharacter,
  resetLiveState,
  handleLiveKeyDown,
  handleLiveKeyUp,
  handleLiveMouseDown,
  updateLive,
  setPetEnabled,
  focusCameraOnCharacter,
  panCameraOnce
};
