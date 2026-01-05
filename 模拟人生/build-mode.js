import { THREE, scene, camera, ground, raycaster, mouse, snap, controls } from "./core.js";
import {
  floors,
  walls,
  furnitures,
  createFloor,
  createWall,
  createFurniture as layoutCreateFurniture,
  scheduleDestroy,
  saveLayoutSnapshot
} from "./layout.js";

/* ================= 建造模式：狀態與交互 ================= */

let buildMode = "floor"; // floor | wall | furniture | destroy
let wallStart = null;
let lastWallGrid = null;
let wallPreview = null;

let floorStart = null;
let lastFloorGrid = null;
let floorPreview = null;

let currentFurnitureType = "bed";
let selectedFurniture = null;

let draggingFloor = false;
let draggingWall = false;
let draggingFurniture = false;
let draggedFurniture = null;

function getBuildMode() {
  return buildMode;
}

function setBuildMode(mode) {
  buildMode = mode;
  if (buildMode === "wall") {
    wallStart = null;
    lastWallGrid = null;
  } else {
    clearWallPreview();
  }
}

function getCurrentFurnitureType() {
  return currentFurnitureType;
}

function setCurrentFurnitureType(type) {
  currentFurnitureType = type;
}

function getSelectedFurniture() {
  return selectedFurniture;
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

function setSelectedFurniture(obj) {
  const root = getFurnitureRoot(obj) || obj || null;

  const getHighlight = target => {
    if (!target) return null;
    const rootObj = getFurnitureRoot(target) || target;
    if (rootObj.userData && rootObj.userData.highlightTarget) {
      return rootObj.userData.highlightTarget;
    }
    return rootObj;
  };

  const prev = getHighlight(selectedFurniture);
  if (prev && prev.material && prev.material.emissive) {
    prev.material.emissive.setHex(0x000000);
  }

  selectedFurniture = root;

  const cur = getHighlight(selectedFurniture);
  if (cur && cur.material && cur.material.emissive) {
    cur.material.emissive.setHex(0x444444);
  }
}

function clearWallPreview() {
  if (wallPreview) {
    scene.remove(wallPreview);
    if (wallPreview.geometry) wallPreview.geometry.dispose();
    if (wallPreview.material) wallPreview.material.dispose();
    wallPreview = null;
  }
  if (floorPreview) {
    scene.remove(floorPreview);
    if (floorPreview.geometry) floorPreview.geometry.dispose();
    if (floorPreview.material) floorPreview.material.dispose();
    floorPreview = null;
  }
}

function updateWallPreview(start, end) {
  if (!start || !end) {
    clearWallPreview();
    return;
  }

  const dx = end.x - start.x;
  const dz = end.z - start.z;
  if (dx === 0 && dz === 0) {
    clearWallPreview();
    return;
  }

  let x1 = start.x;
  let z1 = start.z;
  let x2 = end.x;
  let z2 = end.z;

  if (Math.abs(dx) >= Math.abs(dz)) {
    z2 = z1;
  } else {
    x2 = x1;
  }

  const height = 2.5;
  const thickness = 0.1;
  let length;
  let centerX;
  let centerZ;
  let boxGeo;

  if (Math.abs(dx) >= Math.abs(dz)) {
    const from = Math.min(x1, x2);
    const to = Math.max(x1, x2);
    length = Math.max(1, to - from);
    centerX = from + length / 2;
    centerZ = z1;
    boxGeo = new THREE.BoxGeometry(length, height, thickness);
  } else {
    const from = Math.min(z1, z2);
    const to = Math.max(z1, z2);
    length = Math.max(1, to - from);
    centerX = x1;
    centerZ = from + length / 2;
    boxGeo = new THREE.BoxGeometry(thickness, height, length);
  }

  const edges = new THREE.EdgesGeometry(boxGeo);
  const material = new THREE.LineDashedMaterial({
    color: 0xffff00,
    dashSize: 0.4,
    gapSize: 0.2
  });

  const line = new THREE.LineSegments(edges, material);
  line.position.set(centerX, height / 2, centerZ);
  line.computeLineDistances();

  clearWallPreview();
  wallPreview = line;
  scene.add(wallPreview);
}

function updateFloorPreview(start, end) {
  if (!start || !end) {
    clearWallPreview();
    return;
  }

  const startX = start.x;
  const startZ = start.z;
  const endX = end.x;
  const endZ = end.z;

  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  const minZ = Math.min(startZ, endZ);
  const maxZ = Math.max(startZ, endZ);

  const width = Math.max(1, maxX - minX + 1);
  const depth = Math.max(1, maxZ - minZ + 1);

  const centerX = minX + width / 2;
  const centerZ = minZ + depth / 2;

  const boxGeo = new THREE.BoxGeometry(width, 0.02, depth);

  const edges = new THREE.EdgesGeometry(boxGeo);
  const material = new THREE.LineDashedMaterial({
    color: 0x00ff00,
    dashSize: 0.4,
    gapSize: 0.2
  });

  const line = new THREE.LineSegments(edges, material);
  line.position.set(centerX, 0.02, centerZ);
  line.computeLineDistances();

  // 共用 clearWallPreview 來清理所有預覽（牆體 + 地板）
  clearWallPreview();
  floorPreview = line;
  scene.add(floorPreview);
}

function updateMouseFromEvent(e) {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
}

function createFurniture(x, z, type = currentFurnitureType, rotationY = 0) {
  const obj = layoutCreateFurniture(x, z, type, rotationY);
  if (obj) {
    setSelectedFurniture(obj);
  }
  return obj;
}

function handleBuildMouseDown(e) {
  updateMouseFromEvent(e);
  raycaster.setFromCamera(mouse, camera);

  const hit = raycaster.intersectObject(ground);
  if (!hit.length) return;

  const x = snap(hit[0].point.x);
  const z = snap(hit[0].point.z);

  if (e.button === 0 || e.button === 2) {
    saveLayoutSnapshot();
  }

  // 左键
  if (e.button === 0) {
    if (buildMode === "destroy") {
      const hitFurniture = raycaster.intersectObjects(furnitures, true);
      if (hitFurniture.length) {
        const obj = hitFurniture[0].object;
        const root = getFurnitureRoot(obj) || obj;
        if (selectedFurniture === root) {
          setSelectedFurniture(null);
        }
        scheduleDestroy(furnitures, root);
        return;
      }

      const hitWall = raycaster.intersectObjects(walls);
      if (hitWall.length) {
        const w = hitWall[0].object;
        scheduleDestroy(walls, w);
        return;
      }

      const hitFloor = raycaster.intersectObjects(floors);
      if (hitFloor.length) {
        const f = hitFloor[0].object;
        scheduleDestroy(floors, f);
      }
      return;
    }

    if (buildMode === "floor") {
      draggingFloor = true;
      controls.enabled = false;
      floorStart = { x, z };
      lastFloorGrid = { x, z };
      createFloor(x, z);
    }

    if (buildMode === "wall") {
      draggingWall = true;
      controls.enabled = false;
      wallStart = { x, z };
      lastWallGrid = { x, z };
    }

    if (buildMode === "furniture") {
      const hitFurniture = raycaster.intersectObjects(furnitures, true);
      if (hitFurniture.length) {
        const root = getFurnitureRoot(hitFurniture[0].object) || hitFurniture[0].object;
        setSelectedFurniture(root);
        draggingFurniture = true;
        draggedFurniture = root;
        controls.enabled = false;
      } else {
        const created = createFurniture(x, z);
        if (created) {
          draggingFurniture = true;
          draggedFurniture = created;
          controls.enabled = false;
        }
      }
    }
  }

  // 右键删除地板或家具
  if (e.button === 2) {
    const hitFurniture = raycaster.intersectObjects(furnitures, true);
    if (hitFurniture.length) {
      const obj = hitFurniture[0].object;
      const root = getFurnitureRoot(obj) || obj;
      scene.remove(root);
      const idxF = furnitures.indexOf(root);
      if (idxF !== -1) {
        furnitures.splice(idxF, 1);
      }
      if (selectedFurniture === root) {
        setSelectedFurniture(null);
      }
      return;
    }

    const hitFloor = raycaster.intersectObjects(floors);
    if (!hitFloor.length) return;

    const f = hitFloor[0].object;
    scene.remove(f);
    const idx = floors.indexOf(f);
    if (idx !== -1) {
      floors.splice(idx, 1);
    }
  }
}

function handleBuildMouseMove(e) {
  if (!draggingFloor && !draggingWall && !draggingFurniture) return;
  updateMouseFromEvent(e);
  raycaster.setFromCamera(mouse, camera);

  const hit = raycaster.intersectObject(ground);
  if (!hit.length) return;

  const x = snap(hit[0].point.x);
  const z = snap(hit[0].point.z);

  if (draggingFloor && buildMode === "floor") {
    createFloor(x, z);
    lastFloorGrid = { x, z };
    if (floorStart) {
      updateFloorPreview(floorStart, lastFloorGrid);
    }
  }

  if (draggingWall && buildMode === "wall") {
    lastWallGrid = { x, z };
    updateWallPreview(wallStart, lastWallGrid);
  }

  if (draggingFurniture && buildMode === "furniture" && draggedFurniture) {
    draggedFurniture.position.x = x + 0.5;
    draggedFurniture.position.z = z + 0.5;
    if (!draggedFurniture.userData) {
      draggedFurniture.userData = {};
    }
    draggedFurniture.userData.grid = { x, z };
  }
}

function resetBuildInteraction() {
  draggingFloor = false;
  draggingWall = false;
  draggingFurniture = false;
  draggedFurniture = null;
  wallStart = null;
  lastWallGrid = null;
   floorStart = null;
   lastFloorGrid = null;
  clearWallPreview();
}

function handleBuildMouseUp(e) {
  if (e.button === 0) {
    // 牆體拖拽建牆
    if (buildMode === "wall" && wallStart && lastWallGrid && draggingWall) {
      const start = wallStart;
      const end = lastWallGrid;
      const dx = end.x - start.x;
      const dz = end.z - start.z;

      if (dx !== 0 || dz !== 0) {
        if (Math.abs(dx) >= Math.abs(dz)) {
          const z = start.z;
          const from = Math.min(start.x, end.x);
          const to = Math.max(start.x, end.x);
          for (let i = from; i < to; i++) {
            createWall(i, z, "x");
          }
        } else {
          const x = start.x;
          const from = Math.min(start.z, end.z);
          const to = Math.max(start.z, end.z);
          for (let i = from; i < to; i++) {
            createWall(x, i, "z");
          }
        }
      }
    }

    // 地板矩形框選鋪設
    if (buildMode === "floor" && floorStart && lastFloorGrid && draggingFloor) {
      const startX = floorStart.x;
      const startZ = floorStart.z;
      const endX = lastFloorGrid.x;
      const endZ = lastFloorGrid.z;

      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      const minZ = Math.min(startZ, endZ);
      const maxZ = Math.max(startZ, endZ);

      for (let ix = minX; ix <= maxX; ix++) {
        for (let iz = minZ; iz <= maxZ; iz++) {
          createFloor(ix, iz);
        }
      }
    }
  }

  resetBuildInteraction();
  controls.enabled = true;
}

export {
  getBuildMode,
  setBuildMode,
  getCurrentFurnitureType,
  setCurrentFurnitureType,
  getSelectedFurniture,
  setSelectedFurniture,
  getFurnitureRoot,
  clearWallPreview,
  updateWallPreview,
  handleBuildMouseDown,
  handleBuildMouseMove,
  handleBuildMouseUp,
  resetBuildInteraction
};
