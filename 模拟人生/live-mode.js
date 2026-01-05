import { THREE, scene, camera, ground, raycaster, mouse, snap } from "./core.js";
import { floors, furnitures, findPath, canMoveCharacterTo } from "./layout.js";

/* ================= 生活模式與角色邏輯 ================= */

let character = null;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

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

function updateCharacterRotationTowards(dirX, dirZ, delta) {
  if (!character) return;
  const len = Math.hypot(dirX, dirZ) || 1;
  const ndx = dirX / len;
  const ndz = dirZ / len;
  const targetAngle = Math.atan2(ndx, ndz);

  let current = character.rotation.y;
  let diff = targetAngle - current;
  diff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;

  const turnSpeed = 8; // rad/s
  const maxStep = turnSpeed * delta;
  if (Math.abs(diff) <= maxStep) {
    current = targetAngle;
  } else {
    current += Math.sign(diff) * maxStep;
  }
  character.rotation.y = current;
}

function ensureCharacter() {
  if (character) return character;

  const group = new THREE.Group();

  // 簡單人形：頭、軀幹、骨盆、手臂和雙腿
  const skinColor = 0xffe0bd;
  const shirtColor = 0x2196f3;
  const pantsColor = 0x455a64;
  const shoeColor = 0x212121;

  // 軀幹
  const torsoGeo = new THREE.BoxGeometry(0.45, 0.6, 0.25);
  const torsoMat = new THREE.MeshStandardMaterial({ color: shirtColor });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.set(0, 0.95, 0);
  torso.castShadow = true;
  torso.receiveShadow = true;

  // 骨盆 / 腰
  const pelvisGeo = new THREE.BoxGeometry(0.35, 0.25, 0.22);
  const pelvisMat = new THREE.MeshStandardMaterial({ color: pantsColor });
  const pelvis = new THREE.Mesh(pelvisGeo, pelvisMat);
  pelvis.position.set(0, 0.7, 0);
  pelvis.castShadow = true;
  pelvis.receiveShadow = true;

  // 頭
  const headGeo = new THREE.SphereGeometry(0.22, 18, 18);
  const headMat = new THREE.MeshStandardMaterial({ color: skinColor });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 1.45, 0.02);
  head.castShadow = true;
  head.receiveShadow = true;

  // 手臂
  const armGeo = new THREE.BoxGeometry(0.12, 0.55, 0.18);
  const armMat = new THREE.MeshStandardMaterial({ color: shirtColor });
  const armOffsetX = 0.45 / 2 + 0.12 / 2 + 0.02;
  const armY = 0.98;

  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-armOffsetX, armY, 0);
  leftArm.castShadow = true;
  leftArm.receiveShadow = true;

  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(armOffsetX, armY, 0);
  rightArm.castShadow = true;
  rightArm.receiveShadow = true;

  // 腿
  const legGeo = new THREE.BoxGeometry(0.16, 0.75, 0.2);
  const legMat = new THREE.MeshStandardMaterial({ color: pantsColor });
  const legOffsetX = 0.18;
  const legY = 0.375;

  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-legOffsetX, legY, 0);
  leftLeg.castShadow = true;
  leftLeg.receiveShadow = true;

  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(legOffsetX, legY, 0);
  rightLeg.castShadow = true;
  rightLeg.receiveShadow = true;

  // 腳
  const footGeo = new THREE.BoxGeometry(0.18, 0.08, 0.3);
  const footMat = new THREE.MeshStandardMaterial({ color: shoeColor });
  const footY = 0.04;

  const leftFoot = new THREE.Mesh(footGeo, footMat);
  leftFoot.position.set(-legOffsetX, footY, 0.05);
  leftFoot.castShadow = true;
  leftFoot.receiveShadow = true;

  const rightFoot = new THREE.Mesh(footGeo, footMat);
  rightFoot.position.set(legOffsetX, footY, 0.05);
  rightFoot.castShadow = true;
  rightFoot.receiveShadow = true;

  group.add(torso);
  group.add(pelvis);
  group.add(head);
  group.add(leftArm);
  group.add(rightArm);
  group.add(leftLeg);
  group.add(rightLeg);
  group.add(leftFoot);
  group.add(rightFoot);

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
  group.castShadow = true;
  group.receiveShadow = true;

  group.userData = {
    body: torso,
    head,
    baseBodyY: torso.position.y,
    baseHeadY: head.position.y,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg
  };

  scene.add(group);
  character = group;
  return character;
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
}

function updateMouseFromEvent(e) {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
}

function resetCharacterPose() {
  if (!character || !character.userData) return;
  const body = character.userData.body;
  const head = character.userData.head;
  const leftArm = character.userData.leftArm;
  const rightArm = character.userData.rightArm;
  const leftLeg = character.userData.leftLeg;
  const rightLeg = character.userData.rightLeg;
  const baseBodyY = character.userData.baseBodyY;
  const baseHeadY = character.userData.baseHeadY;

  character.rotation.set(0, character.rotation.y, 0);

  if (body) {
    body.position.y = baseBodyY;
    body.rotation.set(0, 0, 0);
  }
  if (head) {
    head.position.y = baseHeadY;
    head.rotation.set(0, 0, 0);
  }
  if (leftArm) leftArm.rotation.set(0, 0, 0);
  if (rightArm) rightArm.rotation.set(0, 0, 0);
  if (leftLeg) leftLeg.rotation.set(0, 0, 0);
  if (rightLeg) rightLeg.rotation.set(0, 0, 0);
}

function getFurnitureRoot(target) {
  if (!target) return null;
  let current = target;
  while (current) {
    if (furnitures.includes(current)) return current;
    current = current.parent;
  }
  return null;
}

function getBedHeadYaw(furniture) {
  if (!furniture || typeof furniture.localToWorld !== "function") return 0;
  // 床模型的床頭在本地座標 (0, 0, -1) 方向上（對應 head 方塊 z = -0.7）
  const localHead = new THREE.Vector3(0, 0, -1);
  const worldHead = localHead.clone();
  furniture.localToWorld(worldHead);

  const center = furniture.position;
  const dx = worldHead.x - center.x;
  const dz = worldHead.z - center.z;
  const len = Math.hypot(dx, dz) || 1;
  const ndx = dx / len;
  const ndz = dz / len;
  // 和角色一樣的 yaw 計算方式：atan2(x, z)
  const yaw = Math.atan2(ndx, ndz);
  console.log("bed rot", furniture.rotation.y, "head yaw", yaw);
  return yaw;
}

function getBedHeadPosition(furniture) {
  if (!furniture || typeof furniture.localToWorld !== "function") {
    return furniture && furniture.position
      ? furniture.position.clone()
      : new THREE.Vector3();
  }
  // 床頭板中心的大致位置：對應 layout.js 中 head 方塊中心 (0, 0.45, -0.7)
  const local = new THREE.Vector3(0, 0.45, -0.7);
  const world = local.clone();
  furniture.localToWorld(world);
  return world;
}

function getInteractionMenuElement() {
  if (interactionMenuElement) return interactionMenuElement;
  const div = document.createElement("div");
  div.id = "interactionMenu";
  div.style.position = "fixed";
  div.style.zIndex = "1000";
  div.style.background = "rgba(0, 0, 0, 0.85)";
  div.style.color = "#fff";
  div.style.fontSize = "12px";
  div.style.borderRadius = "4px";
  div.style.padding = "4px";
  div.style.minWidth = "80px";
  div.style.display = "none";
  document.body.appendChild(div);
  interactionMenuElement = div;
  return interactionMenuElement;
}

function hideInteractionMenu() {
  if (interactionMenuElement) {
    interactionMenuElement.style.display = "none";
    interactionMenuElement.innerHTML = "";
  }
}

function startFurnitureInteraction(furniture, actionId) {
  if (!furniture || !furniture.userData || !furniture.userData.grid) return;
  ensureCharacter();
  if (!character) return;

  const bedX = furniture.userData.grid.x;
  const bedZ = furniture.userData.grid.z;

  const startCellX = Math.floor(character.position.x);
  const startCellZ = Math.floor(character.position.z);

  // 優先尋路到床周圍的可走格子，而不是家具所在格子本身
  const candidates = [
    { x: bedX + 1, z: bedZ },
    { x: bedX - 1, z: bedZ },
    { x: bedX, z: bedZ + 1 },
    { x: bedX, z: bedZ - 1 }
  ];

  let chosenPath = null;
  let chosenCell = null;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const path = findPath(startCellX, startCellZ, c.x, c.z);
    if (path && path.length >= 2) {
      chosenPath = path;
      chosenCell = c;
      break;
    }
  }

  // 如果周圍沒有合適的可走格子，最後再嘗試直接走到床所在格子
  if (!chosenPath) {
    const fallbackPath = findPath(startCellX, startCellZ, bedX, bedZ);
    if (!fallbackPath || fallbackPath.length < 2) {
      pendingInteraction = null;
      return;
    }
    chosenPath = fallbackPath;
    chosenCell = { x: bedX, z: bedZ };
  }

  pathCells = chosenPath;
  pathIndex = 1; // 0 是當前所在格子
  moveTarget = new THREE.Vector3(chosenCell.x + 0.5, 0, chosenCell.z + 0.5);
  hasMoveTarget = true;
  pendingInteraction = { furniture, actionId };

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

function enterSleepPose(furniture, furnRot) {
  ensureCharacter();
  if (!character) return;

  const body = character.userData && character.userData.body;
  const head = character.userData && character.userData.head;
  const leftArm = character.userData && character.userData.leftArm;
  const rightArm = character.userData && character.userData.rightArm;
  const leftLeg = character.userData && character.userData.leftLeg;
  const rightLeg = character.userData && character.userData.rightLeg;
  const baseBodyY = character.userData && character.userData.baseBodyY;
  const baseHeadY = character.userData && character.userData.baseHeadY;

  // 角色頭部在本地座標中的初始位置（站立姿勢）
  let localHead = new THREE.Vector3(0, typeof baseHeadY === "number" ? baseHeadY : 1.45, 0.02);
  if (head) {
    localHead = head.position.clone();
    if (typeof baseHeadY === "number") {
      localHead.y = baseHeadY;
    }
  }

  // 最終朝向：指向床頭方向
  const yaw = getBedHeadYaw(furniture);
  const pitch = Math.PI / 2; // 仰躺
  const euler = new THREE.Euler(pitch, yaw, 0, "XYZ");

  // 將頭部本地偏移套用躺下後的旋轉，得到從角色原點到頭部的世界方向
  const rotatedHeadOffset = localHead.clone();
  rotatedHeadOffset.applyEuler(euler);

  // 目標頭部世界位置：床頭板附近稍微抬高一點
  const targetHeadWorld = getBedHeadPosition(furniture).clone();
  targetHeadWorld.y += 0.15;

  // 反推角色原點的位置，使得頭部剛好落在床頭位置
  const characterWorldPos = targetHeadWorld.clone().sub(rotatedHeadOffset);
  character.position.copy(characterWorldPos);
  character.rotation.copy(euler);

  if (body && typeof baseBodyY === "number") {
    body.position.y = baseBodyY;
    body.rotation.set(0, 0, 0);
  }
  if (head && typeof baseHeadY === "number") {
    head.position.y = baseHeadY;
    head.rotation.set(0, 0, 0);
  }
  if (leftArm) leftArm.rotation.set(0, 0, 0);
  if (rightArm) rightArm.rotation.set(0, 0, 0);
  if (leftLeg) leftLeg.rotation.set(0, 0, 0);
  if (rightLeg) rightLeg.rotation.set(0, 0, 0);

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

  const offset = 0.9;
  const dirX = Math.sin(furnRot);
  const dirZ = Math.cos(furnRot);

  character.position.x = furniture.position.x + dirX * offset;
  character.position.z = furniture.position.z + dirZ * offset;
  character.position.y = 0;
  character.rotation.set(0, furnRot, 0);

  const body = character.userData && character.userData.body;
  const head = character.userData && character.userData.head;
  const leftArm = character.userData && character.userData.leftArm;
  const rightArm = character.userData && character.userData.rightArm;
  const leftLeg = character.userData && character.userData.leftLeg;
  const rightLeg = character.userData && character.userData.rightLeg;
  const baseBodyY = character.userData && character.userData.baseBodyY;
  const baseHeadY = character.userData && character.userData.baseHeadY;

  if (body && typeof baseBodyY === "number") {
    body.position.y = baseBodyY;
    body.rotation.set(0, 0, 0);
  }
  if (head && typeof baseHeadY === "number") {
    head.position.y = baseHeadY;
    head.rotation.set(0, 0, 0);
  }
  if (leftArm) leftArm.rotation.set(0, 0, 0);
  if (rightArm) rightArm.rotation.set(0, 0, 0);
  if (leftLeg) leftLeg.rotation.set(-Math.PI * 0.7 * 0.5, 0, 0);
  if (rightLeg) rightLeg.rotation.set(-Math.PI * 0.7 * 0.5, 0, 0);

  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;

  interactionState = "sit_edge";
  interactionTimer = 0;
}

function enterPillowFightPose(furniture, furnRot) {
  ensureCharacter();
  if (!character) return;

  const offset = 0.6;
  const dirX = Math.sin(furnRot);
  const dirZ = Math.cos(furnRot);

  character.position.x = furniture.position.x + dirX * offset;
  character.position.z = furniture.position.z + dirZ * offset;
  character.position.y = 0;
  character.rotation.set(0, furnRot, 0);

  const body = character.userData && character.userData.body;
  const head = character.userData && character.userData.head;
  const leftArm = character.userData && character.userData.leftArm;
  const rightArm = character.userData && character.userData.rightArm;
  const leftLeg = character.userData && character.userData.leftLeg;
  const rightLeg = character.userData && character.userData.rightLeg;
  const baseBodyY = character.userData && character.userData.baseBodyY;
  const baseHeadY = character.userData && character.userData.baseHeadY;

  if (body && typeof baseBodyY === "number") {
    body.position.y = baseBodyY;
    body.rotation.set(0, 0, 0);
  }
  if (head && typeof baseHeadY === "number") {
    head.position.y = baseHeadY;
    head.rotation.set(0, 0, 0);
  }
  if (leftArm) leftArm.rotation.set(0, 0, 0);
  if (rightArm) rightArm.rotation.set(0, 0, 0);
  if (leftLeg) leftLeg.rotation.set(0, 0, 0);
  if (rightLeg) rightLeg.rotation.set(0, 0, 0);

  hasMoveTarget = false;
  pathCells = null;
  pathIndex = 0;
  if (moveMarker) moveMarker.visible = false;

  interactionState = "pillow_fight";
  interactionTimer = 0;
}

function showInteractionMenuForFurniture(furniture, clientX, clientY) {
  const type = furniture.userData && furniture.userData.type;
  const menu = getInteractionMenuElement();
  menu.innerHTML = "";
  const options = [];

  if (type === "bed") {
    options.push(
      { id: "sleep", label: "上床睡觉" },
      { id: "sit_edge", label: "坐在床边" },
      { id: "pillow_fight", label: "枕头大战（占位）" }
    );
  } else if (type === "door") {
    const d = furniture.userData || {};
    const isOpen = !!d.doorOpenTarget;
    options.push({ id: isOpen ? "door_close" : "door_open", label: isOpen ? "关门" : "开门" });
  } else if (type === "window") {
    const d = furniture.userData || {};
    const isOpen = !!d.windowOpenTarget;
    options.push({ id: isOpen ? "window_close" : "window_open", label: isOpen ? "关窗" : "开窗" });
  }

  if (!options.length) {
    return;
  }

  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.textContent = opt.label;
    btn.style.display = "block";
    btn.style.width = "100%";
    btn.style.margin = "2px 0";
    btn.style.padding = "2px 4px";
    btn.style.fontSize = "12px";
    btn.style.cursor = "pointer";
    btn.style.border = "1px solid #555";
    btn.style.borderRadius = "3px";
    btn.style.background = "#333";
    btn.addEventListener("click", () => {
      hideInteractionMenu();
      if (opt.id === "door_open") {
        if (!furniture.userData) furniture.userData = {};
        furniture.userData.doorOpenTarget = true;
      } else if (opt.id === "door_close") {
        if (!furniture.userData) furniture.userData = {};
        furniture.userData.doorOpenTarget = false;
      } else if (opt.id === "window_open") {
        if (!furniture.userData) furniture.userData = {};
        furniture.userData.windowOpenTarget = true;
      } else if (opt.id === "window_close") {
        if (!furniture.userData) furniture.userData = {};
        furniture.userData.windowOpenTarget = false;
      } else {
        startFurnitureInteraction(furniture, opt.id);
      }
    });
    menu.appendChild(btn);
  });

  const padding = 4;
  menu.style.left = `${clientX + padding}px`;
  menu.style.top = `${clientY + padding}px`;
  menu.style.display = "block";
}

function handleLiveMouseDown(e) {
  if (e.button !== 0) return;
  hideInteractionMenu();
  updateMouseFromEvent(e);
  raycaster.setFromCamera(mouse, camera);

  // 優先檢測家具點擊
  const furnitureHits = raycaster.intersectObjects(furnitures, true);
  if (furnitureHits.length) {
    const root = getFurnitureRoot(furnitureHits[0].object) || furnitureHits[0].object;
    showInteractionMenuForFurniture(root, e.clientX, e.clientY);
    return;
  }

  // 其餘情況仍然是點擊地面移動
  const hit = raycaster.intersectObject(ground);
  if (!hit.length) return;

  ensureCharacter();
  const targetCellX = snap(hit[0].point.x);
  const targetCellZ = snap(hit[0].point.z);

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
  if (!character) return;

  const speed = 3;
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
          } else if (pendingInteraction.actionId === "pillow_fight") {
            enterPillowFightPose(furn, furnRot);
          }
          pendingInteraction = null;
        }
      }
    }
  }

  // 行走動畫：身體輕微上下起伏 + 手臂腿前後擺動
  const body = character.userData && character.userData.body;
  const head = character.userData && character.userData.head;
  const leftArm = character.userData && character.userData.leftArm;
  const rightArm = character.userData && character.userData.rightArm;
  const leftLeg = character.userData && character.userData.leftLeg;
  const rightLeg = character.userData && character.userData.rightLeg;
  if (interactionState === "sleep_enter") {
    interactionTimer += delta;
    const enterDuration = 1.2; // 總時長：先坐下，再躺下
    const t = Math.min(1, interactionTimer / enterDuration);

    if (sleepTarget && sleepTarget.furniture) {
      const furn = sleepTarget.furniture;
      const furnRot = sleepTarget.furnRot;
      const yawSit = furnRot;
      const yawLie = getBedHeadYaw(furn); // 頭朝床頭方向

      const centerX = furn.position.x;
      const centerZ = furn.position.z;
      const headPos = getBedHeadPosition(furn);
      const dirX = Math.sin(furnRot);
      const dirZ = Math.cos(furnRot);
      const edgeOffset = 0.9;
      const edgeX = centerX + dirX * edgeOffset;
      const edgeZ = centerZ + dirZ * edgeOffset;

      const seatY = 0.35;
      const lieY = 0.45;

      const split = 0.4; // 前 40%：坐下，後 60%：從坐姿轉為躺姿
      if (t < split) {
        const k = t / split;

        character.position.x = edgeX;
        character.position.z = edgeZ;
        character.position.y = seatY * k;
        character.rotation.set(0, yawSit, 0);

        const legBend = -Math.PI * 0.7 * k;
        if (leftLeg) leftLeg.rotation.x = legBend;
        if (rightLeg) rightLeg.rotation.x = legBend;
        if (leftArm) leftArm.rotation.x = 0;
        if (rightArm) rightArm.rotation.x = 0;
      } else {
        const u = (t - split) / (1 - split);

        // 從床邊坐姿平移到床頭附近並躺下
        character.position.x = edgeX + (headPos.x - edgeX) * u;
        character.position.z = edgeZ + (headPos.z - edgeZ) * u;
        character.position.y = seatY + (headPos.y + 0.1 - seatY) * u;

        const pitch = Math.PI / 2 * u; // 從直立逐漸後仰到躺平
        const yaw = yawSit + (yawLie - yawSit) * u; // 朝向從面向床過渡到床頭
        character.rotation.set(pitch, yaw, 0);

        // 保持局部旋轉為 0，由整體 pitch 控制躺下
        if (body) body.rotation.set(0, 0, 0);
        if (head) head.rotation.set(0, 0, 0);

        const legBend = -Math.PI * 0.7 * (1 - u);
        if (leftLeg) leftLeg.rotation.x = legBend;
        if (rightLeg) rightLeg.rotation.x = legBend;
        if (leftArm) leftArm.rotation.x = 0;
        if (rightArm) rightArm.rotation.x = 0;
      }
    }

    if (t >= 1) {
      if (sleepTarget && sleepTarget.furniture) {
        enterSleepPose(sleepTarget.furniture, sleepTarget.furnRot);
      }
      sleepTarget = null;
    }
    return;
  }
  if (interactionState === "sleep") {
    interactionTimer += delta;
    const breathe = Math.sin(interactionTimer * 1.5) * 0.02;
    const baseBodyY = character.userData && character.userData.baseBodyY;
    const baseHeadY = character.userData && character.userData.baseHeadY;
    if (body && typeof baseBodyY === "number") {
      body.position.y = baseBodyY + breathe;
    }
    if (head && typeof baseHeadY === "number") {
      head.position.y = baseHeadY + breathe * 0.6;
    }
    if (leftArm) leftArm.rotation.x = 0;
    if (rightArm) rightArm.rotation.x = 0;
    if (leftLeg) leftLeg.rotation.x = 0;
    if (rightLeg) rightLeg.rotation.x = 0;
    return;
  }

  if (interactionState === "sit_edge") {
    interactionTimer += delta;
    const idle = Math.sin(interactionTimer * 2) * 0.02;
    const baseBodyY = character.userData && character.userData.baseBodyY;
    const baseHeadY = character.userData && character.userData.baseHeadY;
    if (body && typeof baseBodyY === "number") {
      body.position.y = baseBodyY + idle;
    }
    if (head && typeof baseHeadY === "number") {
      head.position.y = baseHeadY + idle * 0.5;
    }
    if (leftArm) leftArm.rotation.x = 0;
    if (rightArm) rightArm.rotation.x = 0;
    if (leftLeg) leftLeg.rotation.x = -Math.PI * 0.7 * 0.5;
    if (rightLeg) rightLeg.rotation.x = -Math.PI * 0.7 * 0.5;
    return;
  }

  if (interactionState === "pillow_fight") {
    interactionTimer += delta;
    const bounce = Math.abs(Math.sin(interactionTimer * 6)) * 0.04;
    const armSwing = Math.sin(interactionTimer * 10) * 1.0;
    const legSwing = Math.cos(interactionTimer * 8) * 0.4;
    const baseBodyY = character.userData && character.userData.baseBodyY;
    const baseHeadY = character.userData && character.userData.baseHeadY;
    if (body && typeof baseBodyY === "number") {
      body.position.y = baseBodyY + bounce;
    }
    if (head && typeof baseHeadY === "number") {
      head.position.y = baseHeadY + bounce * 0.6;
    }
    if (leftArm) leftArm.rotation.x = armSwing;
    if (rightArm) rightArm.rotation.x = -armSwing;
    if (leftLeg) leftLeg.rotation.x = -legSwing * 0.5;
    if (rightLeg) rightLeg.rotation.x = legSwing * 0.5;

    if (interactionTimer > 3) {
      interactionState = null;
      interactionTimer = 0;
      resetCharacterPose();
    }
    return;
  }

  if (movedThisFrame) {
    walkPhase += delta * 10;
  } else {
    walkPhase = Math.max(0, walkPhase - delta * 10);
  }

  const walkAmount = Math.sin(walkPhase) * 0.05;
  if (body) {
    body.position.y = 0.5 + walkAmount;
  }
  if (head) {
    head.position.y = 1.1 + walkAmount * 0.6;
  }

  const swing = Math.sin(walkPhase) * 0.4;
  const counterSwing = Math.cos(walkPhase) * 0.4;

  if (leftArm && rightArm) {
    leftArm.rotation.x = swing;
    rightArm.rotation.x = -swing;
  }

  if (leftLeg && rightLeg) {
    leftLeg.rotation.x = -counterSwing * 0.6;
    rightLeg.rotation.x = counterSwing * 0.6;
  }
}

export {
  ensureCharacter,
  resetLiveState,
  handleLiveKeyDown,
  handleLiveKeyUp,
  handleLiveMouseDown,
  updateLive
};
