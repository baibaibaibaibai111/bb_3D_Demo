import { THREE, scene } from "../core/core.js";

/* ================= 世界數據與佈局（世界物件與通用操作） ================= */

const floors = [];
const walls = [];
const furnitures = [];
const destroyAnimations = [];

function createFloor(x, z) {
  for (let i = 0; i < floors.length; i++) {
    const g = floors[i].userData && floors[i].userData.grid;
    if (g && g.x === x && g.z === z) {
      return;
    }
  }
  // 把地板改成貼在地面上的薄平面，避免角色 / 寵物腳部被 0.1 高度的方塊包住造成「穿模」感
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0x999999 })
  );
  floor.rotation.x = -Math.PI / 2; // 水平鋪在地面上
  floor.position.set(x + 0.5, 0.001, z + 0.5);
  floor.receiveShadow = true;
  floor.userData.grid = { x, z };
  scene.add(floor);
  floors.push(floor);
}

function scheduleDestroy(targetArray, obj) {
  if (!obj) return;
  if (!obj.userData) obj.userData = {};
  if (obj.userData._destroying) return;
  obj.userData._destroying = true;

  if (targetArray) {
    const idx = targetArray.indexOf(obj);
    if (idx !== -1) {
      targetArray.splice(idx, 1);
    }
  }

  // 如果是門或窗被刪除，恢復其附著的牆體可見，關閉開口標記
  if (targetArray === furnitures) {
    const d = obj.userData;
    if (d && (d.type === "door" || d.type === "window") && d.attachedWall) {
      const w = d.attachedWall;
      if (w.userData) {
        w.userData.hasOpening = false;
        if (w.userData.caps && w.userData.caps.length) {
          w.userData.caps.forEach(cap => {
            const idxW = walls.indexOf(cap);
            if (idxW !== -1) {
              walls.splice(idxW, 1);
            }
            scene.remove(cap);
            if (cap.geometry && typeof cap.geometry.dispose === "function") {
              cap.geometry.dispose();
            }
            if (cap.material && typeof cap.material.dispose === "function") {
              cap.material.dispose();
            }
          });
          w.userData.caps = [];
        }
      }
      w.visible = true;
      d.attachedWall = null;
    }
  }

  destroyAnimations.push({
    object: obj,
    elapsed: 0,
    duration: 0.2
  });
}

function setObjectOpacity(obj, opacity) {
  if (!obj) return;
  if (typeof obj.traverse !== "function") return;
  obj.traverse(child => {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(m => {
          if (!m) return;
          m.transparent = true;
          m.opacity = opacity;
        });
      } else {
        child.material.transparent = true;
        child.material.opacity = opacity;
      }
    }
  });
}

function removeObjectFromScene(obj) {
  if (!obj) return;
  scene.remove(obj);
  if (typeof obj.traverse !== "function") return;
  obj.traverse(child => {
    if (child.geometry && typeof child.geometry.dispose === "function") {
      child.geometry.dispose();
    }
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(m => {
          if (m && typeof m.dispose === "function") {
            m.dispose();
          }
        });
      } else if (typeof child.material.dispose === "function") {
        child.material.dispose();
      }
    }
  });
}

function updateDoorsAndWindows(delta) {
  if (!furnitures.length) return;
  const doorSpeed = 3; // 每秒開關進度
  const windowSpeed = 2;

  furnitures.forEach(f => {
    const d = f.userData;
    if (!d || !d.type) return;

    if (d.type === "door") {
      const target = d.doorOpenTarget ? 1 : 0;
      let p = typeof d.doorOpenProgress === "number" ? d.doorOpenProgress : 0;
      if (p !== target) {
        const dir = target > p ? 1 : -1;
        p += dir * doorSpeed * delta;
        if (dir > 0 && p > target) p = target;
        if (dir < 0 && p < target) p = target;
        d.doorOpenProgress = p;

        const closedYaw = typeof d.rotationY === "number" ? d.rotationY : f.rotation.y || 0;
        const openYaw = closedYaw + Math.PI / 2;
        const yaw = closedYaw + (openYaw - closedYaw) * p;
        f.rotation.y = yaw;
      }
    } else if (d.type === "window") {
      const target = d.windowOpenTarget ? 1 : 0;
      let p = typeof d.windowOpenProgress === "number" ? d.windowOpenProgress : 0;
      if (p !== target) {
        const dir = target > p ? 1 : -1;
        p += dir * windowSpeed * delta;
        if (dir > 0 && p > target) p = target;
        if (dir < 0 && p < target) p = target;
        d.windowOpenProgress = p;

        const closedYaw = typeof d.rotationY === "number" ? d.rotationY : f.rotation.y || 0;
        const openYaw = closedYaw + Math.PI / 4;
        const yaw = closedYaw + (openYaw - closedYaw) * p;
        f.rotation.y = yaw;
      }
    }
  });
}

export {
  floors,
  walls,
  furnitures,
  destroyAnimations,
  createFloor,
  scheduleDestroy,
  setObjectOpacity,
  removeObjectFromScene,
  updateDoorsAndWindows
};
