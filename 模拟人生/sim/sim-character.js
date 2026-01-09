import { THREE } from "../core/core.js";
import { GLTFLoader } from "three/examples/loaders/GLTFLoader.js";

// 女人角色 GLB 模型路徑
const WOMAN_MODEL_URL = new URL(
  "../public/models/woman/chisa_wuthering_waves.glb",
  import.meta.url
).href;

// 與原始盒子小人身高的相對比例：< 1 會顯得更嬌小一些
// 先設得比較小一點，避免人物在畫面裡過於巨大
const WOMAN_HEIGHT_RATIO = 0.1;

// 整體角色在世界中的縮放，進一步控制與地板 / 家具的相對尺寸
// 再縮小一截，讓人物在世界中顯得不那麼巨大
const CHARACTER_WORLD_SCALE = 0.02;

let womanModelLoading = false;

function buildWomanRigFromSkeleton(skeleton) {
  if (!skeleton || !Array.isArray(skeleton.bones)) return null;
  const bones = skeleton.bones;

  const findBone = names => {
    const lowerNames = names.map(n => String(n).toLowerCase());
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i];
      const nm = (b.name || "").toLowerCase();
      if (!nm) continue;
      for (let j = 0; j < lowerNames.length; j++) {
        if (nm.includes(lowerNames[j])) {
          return b;
        }
      }
    }
    return null;
  };

  const rig = {
    hips: findBone(["hips", "pelvis", "root"]),
    spine: findBone(["bip001spine2", "bip001spine1", "bip001spine", "spine2", "spine1", "spine", "chest", "upperchest"]),
    head: findBone(["bip001head", "head"]),
    leftUpperArm: findBone([
      "bip001lupperarm",
      "bip001lclavicle",
      "leftarm",
      "l_arm",
      "arm_l",
      "upperarm_l",
      "clavicle_l",
      "l_shoulder"
    ]),
    rightUpperArm: findBone([
      "bip001rupperarm",
      "bip001rclavicle",
      "rightarm",
      "r_arm",
      "arm_r",
      "upperarm_r",
      "clavicle_r",
      "r_shoulder"
    ]),
    leftUpperLeg: findBone([
      "bip001lthigh",
      "leftupleg",
      "leftthigh",
      "thigh_l",
      "upperleg_l",
      "l_thigh"
    ]),
    rightUpperLeg: findBone([
      "bip001rthigh",
      "rightupleg",
      "rightthigh",
      "thigh_r",
      "upperleg_r",
      "r_thigh"
    ]),
    leftLowerLeg: findBone([
      "bip001lcalf",
      "leftleg",
      "l_calf",
      "calf_l",
      "shin_l"
    ]),
    rightLowerLeg: findBone([
      "bip001rcalf",
      "rightleg",
      "r_calf",
      "calf_r",
      "shin_r"
    ]),
    leftLowerArm: findBone([
      "bip001lforearm",
      "leftforearm",
      "leftlowerarm",
      "forearm_l",
      "lowerarm_l",
      "l_forearm",
      "l_hand",
      "lefthand",
      "hand_l"
    ]),
    rightLowerArm: findBone([
      "bip001rforearm",
      "rightforearm",
      "rightlowerarm",
      "forearm_r",
      "lowerarm_r",
      "r_forearm",
      "r_hand",
      "righthand",
      "hand_r"
    ])
  };

  // 保存每個重要骨骼的初始旋轉，方便動畫在其基礎上做相對偏移
  const addBase = key => {
    if (rig[key] && rig[key].rotation) {
      rig[key + "BaseRot"] = rig[key].rotation.clone();
    }
  };

  [
    "hips",
    "spine",
    "head",
    "leftUpperArm",
    "rightUpperArm",
    "leftUpperLeg",
    "rightUpperLeg",
    "leftLowerLeg",
    "rightLowerLeg",
    "leftLowerArm",
    "rightLowerArm"
  ].forEach(addBase);

  return rig;
}

function attachWomanModelToCharacter(group, targetHeight) {
  if (!group || womanModelLoading) return;
  womanModelLoading = true;

  const loader = new GLTFLoader();
  loader.load(
    WOMAN_MODEL_URL,
    gltf => {
      womanModelLoading = false;
      const root = gltf && gltf.scene ? gltf.scene : null;
      if (!root) {
        console.warn("[sim] woman GLB loaded but no scene found");
        return;
      }

      console.log("[sim] woman gltf.scene", gltf.scene);

      // 設置陰影與基礎材質屬性
      root.traverse(obj => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          const mat = obj.material;
          if (mat) {
            // 保守處理：確保不會整體透明
            if (typeof mat.transparent === "boolean") mat.transparent = false;
            if (typeof mat.opacity === "number") mat.opacity = 1.0;
            if (typeof mat.depthWrite === "boolean") mat.depthWrite = true;
            mat.needsUpdate = true;
          }
        }
      });

      // 根據原始尺寸調整到與簡單小人相同的身高，並讓腳落在 y = 0
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      if (size.y > 0) {
        const baseTargetHeight =
          typeof targetHeight === "number" && targetHeight > 0 ? targetHeight : size.y;
        const finalTargetHeight = baseTargetHeight * WOMAN_HEIGHT_RATIO;
        const scale = finalTargetHeight / size.y;
        console.log("[sim] woman scale debug", {
          sizeY: size.y,
          baseTargetHeight,
          finalTargetHeight,
          scale
        });
        root.scale.setScalar(scale);

        // 重新計算腳到底部位置，使其落在地面
        const minY = box.min.y * scale;
        const yOffset = -minY;
        root.position.set(0, yOffset, 0);
      } else {
        root.position.set(0, 0, 0);
      }

      group.add(root);

      // 嘗試從 GLB 中獲取骨骼，構建一個簡單的女性骨架映射，供動畫系統使用
      let skinned = null;
      root.traverse(obj => {
        if (!skinned && obj.isSkinnedMesh && obj.skeleton) {
          skinned = obj;
        }
      });

      if (skinned && skinned.skeleton) {
        console.log(
          "[sim] woman bones",
          skinned.skeleton.bones.map(b => b && b.name)
        );
        const rig = buildWomanRigFromSkeleton(skinned.skeleton);
        if (rig) {
          group.userData.womanRig = rig;
          console.log("[sim] woman rig", rig);
        }
      }

      console.log("[sim] woman model attached to character");
    },
    undefined,
    err => {
      womanModelLoading = false;
      console.error("[sim] failed to load woman GLB", err);
    }
  );
}

function createCharacter() {
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

  // 以當前簡單小人模型的高度作為目標身高，供後續 GLB 模型縮放使用
  const baseBox = new THREE.Box3().setFromObject(group);
  const baseSize = new THREE.Vector3();
  baseBox.getSize(baseSize);
  const baseHeight = baseSize.y || 1.7;
  console.log("[sim] base character height", baseHeight, "box", baseBox);

  // 隱藏簡單幾何體，只保留作為姿勢與動畫的「骨架」，
  // 真正顯示由 GLB 女角色負責。
  [
    torso,
    pelvis,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    leftFoot,
    rightFoot
  ].forEach(part => {
    if (part) part.visible = false;
  });

  // 異步掛載女人 GLB 模型作為本體小人外觀
  attachWomanModelToCharacter(group, baseHeight);

  // 進一步縮放整個角色在世界中的尺寸
  group.scale.setScalar(CHARACTER_WORLD_SCALE);

  return group;
}

function resetCharacterPose(character) {
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

function updateCharacterRotationTowards(character, dirX, dirZ, delta) {
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

function getSleepHeadWorldPosition(furniture) {
  const bedHeadWorld = getBedHeadPosition(furniture).clone();
  const bedCenterWorld = furniture.position.clone();
  // 從床頭板「沿著床面方向」偏移一小段，讓頭貼著床頭這一側，而不是跑到床尾
  const toCenterDir = bedCenterWorld.clone().sub(bedHeadWorld);
  toCenterDir.y = 0;
  const dist = toCenterDir.length() || 1;
  toCenterDir.normalize();
  const pillowOffset = Math.min(0.25, dist * 0.5); // 靠近床頭一點點，類似枕頭厚度
  const targetHeadWorld = bedHeadWorld.clone().add(toCenterDir.multiplyScalar(pillowOffset));
  // Y 軸高度只比床頭板略高一點，避免整個身體懸空
  targetHeadWorld.y = bedHeadWorld.y + 0.05;
  return targetHeadWorld;
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

function applySleepPose(character, furniture) {
  if (!character || !furniture) return;

  const body = character.userData && character.userData.body;
  const head = character.userData && character.userData.head;
  const leftArm = character.userData && character.userData.leftArm;
  const rightArm = character.userData && character.userData.rightArm;
  const leftLeg = character.userData && character.userData.leftLeg;
  const rightLeg = character.userData && character.userData.rightLeg;
  const baseBodyY = character.userData && character.userData.baseBodyY;
  const baseHeadY = character.userData && character.userData.baseHeadY;

  // === 建立床的方向：從床頭板指向床尾（可躺的淺藍床墊方向） ===
  const bedHeadWorld = getBedHeadPosition(furniture).clone();
  const bedCenterWorld = furniture.position.clone();

  // 從床頭往床中心 / 床尾的方向，作為「頭 -> 腳」方向
  const bedForward = bedCenterWorld.clone().sub(bedHeadWorld);
  bedForward.y = 0;
  if (bedForward.lengthSq() === 0) {
    bedForward.set(0, 0, 1);
  } else {
    bedForward.normalize();
  }

  const upWorld = new THREE.Vector3(0, 1, 0);
  // uWorld：從角色原點指向頭部的方向（朝床頭）
  const uWorld = bedForward.clone().negate();
  const rWorld = upWorld.clone().cross(uWorld).normalize();
  if (rWorld.lengthSq() === 0) {
    // 非正常情況，隨便取一個水平方向
    rWorld.set(1, 0, 0);
  }
  const fWorld = upWorld.clone(); // 角色面朝上方（仰躺）

  const rotMatrix = new THREE.Matrix4();
  rotMatrix.makeBasis(rWorld, uWorld, fWorld);
  const euler = new THREE.Euler().setFromRotationMatrix(rotMatrix, "XYZ");

  // 角色頭部在本地座標中的初始位置（站立姿勢）
  let localHead = new THREE.Vector3(0, typeof baseHeadY === "number" ? baseHeadY : 1.45, 0.02);
  if (head) {
    localHead = head.position.clone();
    if (typeof baseHeadY === "number") {
      localHead.y = baseHeadY;
    }
  }

  // 將頭部本地偏移套用躺下後的旋轉，得到從角色原點到頭部的世界方向
  const rotatedHeadOffset = localHead.clone();
  rotatedHeadOffset.applyEuler(euler);

  // === 讓頭精確落在床頭側的目標點上（床頭 + 一點點往床墊方向） ===
  const targetHeadWorld = getSleepHeadWorldPosition(furniture);
  const characterWorldPos = targetHeadWorld.clone().sub(rotatedHeadOffset);

  character.position.copy(characterWorldPos);
  character.rotation.copy(euler);

  if (head && typeof head.getWorldPosition === "function") {
    // 第一步：平移整個角色，讓頭的世界座標精確對齊 sleepHeadTarget。
    const target = targetHeadWorld.clone();
    const current = head.getWorldPosition(new THREE.Vector3());
    const delta = target.clone().sub(current);
    character.position.add(delta);

    // 第二步：檢查身體是否在「床頭板外側」而不是床墊這一側，如果是就整體翻轉 180 度。
    let flipped = false;
    const bedHeadWorld2 = getBedHeadPosition(furniture).clone();
    const bedCenterWorld2 = furniture.position.clone();
    const bedForward2 = bedCenterWorld2.clone().sub(bedHeadWorld2);
    bedForward2.y = 0;
    if (bedForward2.lengthSq() > 0) {
      bedForward2.normalize();

      const headWorldAfterAlign = head.getWorldPosition(new THREE.Vector3());
      const vHead = headWorldAfterAlign.clone().sub(bedHeadWorld2);
      const bodyRef =
        body && typeof body.getWorldPosition === "function"
          ? body.getWorldPosition(new THREE.Vector3())
          : character.position.clone();
      const vBody = bodyRef.clone().sub(bedHeadWorld2);

      const projHead = vHead.dot(bedForward2);
      const projBody = vBody.dot(bedForward2);

      const bedSpan = bedCenterWorld2.clone().sub(bedHeadWorld2);
      bedSpan.y = 0;
      const bedLen = bedSpan.length() || 1;

      // 頭已經在床墊方向 (projHead >= 0)，但身體投影在床頭板外側 (projBody < 0)，說明整個人翻到了床外
      if (projHead >= 0 && projHead <= bedLen * 1.2 && projBody < -0.05) {
        const pivot = headWorldAfterAlign.clone();
        const axisY = new THREE.Vector3(0, 1, 0);

        // 以頭為中心，繞世界 Y 軸旋轉 180 度，把身體從床頭外側翻到床墊這一側
        character.position.sub(pivot);
        character.position.applyAxisAngle(axisY, Math.PI);
        character.position.add(pivot);

        character.rotation.y += Math.PI;
        flipped = true;
      }
    }

    const headWorld = head.getWorldPosition(new THREE.Vector3());
    console.log("sleep pose debug", {
      bedRotY: furniture.rotation && furniture.rotation.y,
      bedHeadYaw: getBedHeadYaw(furniture),
      bedCenter: furniture.position.clone(),
      bedHead: bedHeadWorld || getBedHeadPosition(furniture).clone(),
      sleepHeadTarget: targetHeadWorld.clone(),
      charPos: character.position.clone(),
      headWorld,
      flipped
    });
  }

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
}

function applySitOnBedEdgePose(character, furniture, furnRot) {
  if (!character || !furniture) return;

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
}

function applySitOnSofaPose(character, furniture, furnRot) {
  if (!character || !furniture) return;

  const offset = 0.7;
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
}

function applyWatchTVPose(character, furniture, furnRot) {
  if (!character || !furniture) return;

  const offset = 1.2;
  const dirX = Math.sin(furnRot);
  const dirZ = Math.cos(furnRot);

  character.position.x = furniture.position.x - dirX * offset;
  character.position.z = furniture.position.z - dirZ * offset;
  character.position.y = 0;
  const yaw = furnRot + Math.PI;
  character.rotation.set(0, yaw, 0);

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
}

function applyEatFoodPose(character, furniture, furnRot) {
  if (!character || !furniture) return;

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
  if (leftLeg) leftLeg.rotation.set(0, 0, 0);
  if (rightLeg) rightLeg.rotation.set(0, 0, 0);
}

function applyUseToiletPose(character, furniture, furnRot) {
  if (!character || !furniture) return;

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
  if (leftLeg) leftLeg.rotation.set(-Math.PI * 0.7 * 0.5, 0, 0);
  if (rightLeg) rightLeg.rotation.set(-Math.PI * 0.7 * 0.5, 0, 0);
}

function applyWashSinkPose(character, furniture, furnRot) {
  if (!character || !furniture) return;

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
  if (leftLeg) leftLeg.rotation.set(0, 0, 0);
  if (rightLeg) rightLeg.rotation.set(0, 0, 0);
}

function applyPillowFightPose(character, furniture, furnRot) {
  if (!character || !furniture) return;

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
}

export {
  createCharacter,
  resetCharacterPose,
  updateCharacterRotationTowards,
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
};
