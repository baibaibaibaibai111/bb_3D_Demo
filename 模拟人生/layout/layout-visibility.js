import { THREE } from "../core/core.js";
import { floors, walls } from "./layout-world.js";

/* ================= 佈局：牆體可見性控制 ================= */

let wallVisibilityMode = "normal"; // normal | full | half

function setWallVisibilityMode(mode) {
  if (mode !== "normal" && mode !== "full" && mode !== "half") return;
  wallVisibilityMode = mode;
}

function getWallVisibilityMode() {
  return wallVisibilityMode;
}

function updateWallsForCameraView(camera) {
  if (!camera) return;

  if (wallVisibilityMode === "full") {
    walls.forEach(w => {
      w.visible = false;
    });
    return;
  }

  if (wallVisibilityMode === "normal") {
    walls.forEach(w => {
      if (w.userData && w.userData.hasOpening) return;
      w.visible = true;
    });
    return;
  }

  if (wallVisibilityMode !== "half") return;

  if (!walls.length) return;

  // 預設全部可見（有門窗開口的牆除外），後面再隱藏「相機與房間中心之間」整層的牆
  walls.forEach(w => {
    if (w.userData && w.userData.hasOpening) return;
    w.visible = true;
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  floors.forEach(f => {
    const g = f.userData && f.userData.grid;
    if (!g) return;
    if (g.x < minX) minX = g.x;
    if (g.x > maxX) maxX = g.x;
    if (g.z < minZ) minZ = g.z;
    if (g.z > maxZ) maxZ = g.z;
  });

  if (!isFinite(minX)) return;

  const target = new THREE.Vector3(
    (minX + maxX + 1) / 2,
    1.25,
    (minZ + maxZ + 1) / 2
  );

  const viewDir = target.clone().sub(camera.position);
  if (!viewDir.length()) return;

  const absX = Math.abs(viewDir.x);
  const absZ = Math.abs(viewDir.z);

  if (absX >= absZ) {
    // 主要朝 X 方向看：隱藏相機與房間中心之間的牆（按 X 範圍）
    const camX = camera.position.x;
    const centerX = target.x;
    const minCut = Math.min(camX, centerX);
    const maxCut = Math.max(camX, centerX);

    walls.forEach(w => {
      const x = w.position.x;
      if (x > minCut && x < maxCut) {
        w.visible = false;
      }
    });
  } else {
    // 主要朝 Z 方向看：隱藏相機與房間中心之間的牆（按 Z 範圍）
    const camZ = camera.position.z;
    const centerZ = target.z;
    const minCut = Math.min(camZ, centerZ);
    const maxCut = Math.max(camZ, centerZ);

    walls.forEach(w => {
      const z = w.position.z;
      if (z > minCut && z < maxCut) {
        w.visible = false;
      }
    });
  }
}

export { setWallVisibilityMode, getWallVisibilityMode, updateWallsForCameraView };
