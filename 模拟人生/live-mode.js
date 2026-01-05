import { THREE, scene, camera, ground, raycaster, mouse, snap } from "./core.js";
import { floors, findPath, canMoveCharacterTo } from "./layout.js";

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
}

function handleLiveKeyDown(e) {
  if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
    moveForward = true;
  }
  if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
    moveBackward = true;
  }
  if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
    moveLeft = true;
  }
  if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
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

function handleLiveMouseDown(e) {
  if (e.button !== 0) return;
  updateMouseFromEvent(e);
  raycaster.setFromCamera(mouse, camera);

  const hit = raycaster.intersectObject(ground);
  if (!hit.length) return;

  ensureCharacter();
  const targetCellX = snap(hit[0].point.x);
  const targetCellZ = snap(hit[0].point.z);

  if (!character) return;
  const startCellX = Math.floor(character.position.x);
  const startCellZ = Math.floor(character.position.z);

  const path = findPath(startCellX, startCellZ, targetCellX, targetCellZ);
  if (!path || path.length < 2) {
    hasMoveTarget = false;
    if (moveMarker) moveMarker.visible = false;
    return;
  }

  pathCells = path;
  pathIndex = 1; // 0 是當前所在格子
  moveTarget = new THREE.Vector3(targetCellX + 0.5, 0, targetCellZ + 0.5);
  hasMoveTarget = true;

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
