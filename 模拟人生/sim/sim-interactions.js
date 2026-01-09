import { THREE, scene } from "../core/core.js";
import { findPath } from "../layout/layout.js";
import {
  getCurrentMoodLabel,
  getInteractionPreferenceScore,
  getPersonalityAdjustedRefuseChance
} from "./sim-needs.js";

function isSleepingWithLightOnCore(interactionState, character, furnitures) {
  if (!furnitures || !furnitures.length) return false;
  if (interactionState !== "sleep" && interactionState !== "sleep_enter") return false;
  if (!character) return false;

  const refPos = character.position;
  const maxDistSq = 16; // 4 格左右範圍內

  for (let i = 0; i < furnitures.length; i++) {
    const f = furnitures[i];
    const t = f.userData && f.userData.type;
    if (t !== "ceilingLight") continue;
    const lightOn = f.userData && f.userData.lightOn;
    if (!lightOn) continue;
    const dx = f.position.x - refPos.x;
    const dz = f.position.z - refPos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 <= maxDistSq) {
      return true;
    }
  }

  return false;
}

function findFurnitureForNeedCore(needKey, character, furnitures) {
  if (!character || !furnitures || !furnitures.length) return null;

  // 將需求鍵映射到「家具類型 => 行為 ID」的表，允許一個需求對應多種家具
  let typeToAction = null;
  switch (needKey) {
    case "sleep":
      typeToAction = { bed: "sleep" };
      break;
    case "hunger":
      // 既可以直接吃現成食物，也可以去冰箱裡拿東西吃
      typeToAction = { food: "eat_food", fridge: "fridge_eat" };
      break;
    case "bladder":
      typeToAction = { toilet: "use_toilet" };
      break;
    case "fun":
      // 電視 / 沙發 / 枕頭戰 / 吉他 / 電腦桌 都算娛樂
      typeToAction = {
        tv: "tv_watch",
        sofa: "sofa_sit",
        guitar: "play_guitar",
        computerDesk: "use_computer"
      };
      break;
    case "hygiene":
      // 洗手池 + 淋浴 + 浴缸 都可以恢復清潔
      typeToAction = { sink: "wash_sink", shower: "shower_wash", bathtub: "bathtub_bath" };
      break;
    default:
      return null;
  }

  if (!typeToAction) return null;

  let bestFurniture = null;
  let bestActionId = null;
  let bestDistSq = Infinity;

  for (let i = 0; i < furnitures.length; i++) {
    const f = furnitures[i];
    const t = f.userData && f.userData.type;
    if (!t || !Object.prototype.hasOwnProperty.call(typeToAction, t)) continue;

    const dx = f.position.x - character.position.x;
    const dz = f.position.z - character.position.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestDistSq) {
      bestDistSq = d2;
      bestFurniture = f;
      bestActionId = typeToAction[t];
    }
  }

  if (!bestFurniture || !bestActionId) return null;
  return { furniture: bestFurniture, actionId: bestActionId };
}

function startFurnitureInteractionCore(furniture, actionId, character, state, showMoodToast) {
  const auto = state.isAutoInteraction;
  state.isAutoInteraction = false;

  // 心情 + 性格 共同決定：是否拒絕玩家點擊的互動
  if (!auto) {
    const moodLabel = getCurrentMoodLabel();

    let baseRefuse = 0;
    if (moodLabel === "崩溃中") baseRefuse = 1.0;
    else if (moodLabel === "不舒服") baseRefuse = 0.4;

    const finalRefuseChance = getPersonalityAdjustedRefuseChance(baseRefuse, actionId);

    if (finalRefuseChance >= 1) {
      if (typeof showMoodToast === "function") {
        showMoodToast("我现在完全不想做这件事……");
      }
      state.pendingInteraction = null;
      state.hasMoveTarget = false;
      state.pathCells = null;
      state.pathIndex = 0;
      if (state.moveMarker) state.moveMarker.visible = false;
      return state;
    }

    if (finalRefuseChance > 0 && Math.random() < finalRefuseChance) {
      if (typeof showMoodToast === "function") {
        const pref = getInteractionPreferenceScore(actionId);
        if (pref < 0) {
          showMoodToast("这种事我真的不太喜欢……");
        } else if (pref > 0) {
          showMoodToast("本來还想做点別的……");
        } else {
          showMoodToast("我不太想做……");
        }
      }
      state.pendingInteraction = null;
      state.hasMoveTarget = false;
      state.pathCells = null;
      state.pathIndex = 0;
      if (state.moveMarker) state.moveMarker.visible = false;
      return state;
    }
  }

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
      state.pendingInteraction = null;
      return state;
    }
    chosenPath = fallbackPath;
    chosenCell = { x: bedX, z: bedZ };
  }

  state.pathCells = chosenPath;
  state.pathIndex = 1; // 0 是當前所在格子
  state.moveTarget = new THREE.Vector3(chosenCell.x + 0.5, 0, chosenCell.z + 0.5);
  state.hasMoveTarget = true;
  state.pendingInteraction = { furniture, actionId };

  if (!state.moveMarker) {
    const geo = new THREE.CircleGeometry(0.3, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.7 });
    state.moveMarker = new THREE.Mesh(geo, mat);
    state.moveMarker.rotation.x = -Math.PI / 2;
    state.moveMarker.position.y = 0.01;
    scene.add(state.moveMarker);
  }
  state.moveMarker.position.x = state.moveTarget.x;
  state.moveMarker.position.z = state.moveTarget.z;
  state.moveMarker.visible = true;

  return state;
}

export { isSleepingWithLightOnCore, findFurnitureForNeedCore, startFurnitureInteractionCore };
