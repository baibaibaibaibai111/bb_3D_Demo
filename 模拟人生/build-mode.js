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
  if (buildMode === "wall" || buildMode === "wallLine") {
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

  if (buildMode === "wallLine") {
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

  const height = 2.5;
  const boxGeo = new THREE.BoxGeometry(width, height, depth);

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

function placeDoorOrWindowOnWall(wall, type) {
  if (!wall || !wall.userData) return;
  const data = wall.userData;
  const wx = data.x;
  const wz = data.z;
  const dir = data.dir;
  if (dir !== "x" && dir !== "z") return;

  const rotY = dir === "x" ? Math.PI / 2 : 0;

  // 使用牆所在的網格座標來創建門或窗，佈局函數會根據旋轉自動對齊到牆中心
  const obj = createFurniture(wx, wz, type, rotY);

  // 門窗放上去後，這段牆的中間留出開口，僅保留未被覆蓋的牆體部分
  if (obj && wall.userData) {
    wall.userData.hasOpening = true;
    if (!obj.userData) obj.userData = {};
    obj.userData.attachedWall = wall;
    createOpeningCapsForWall(wall, type);
    wall.visible = false;
  }
}

function createOpeningCapsForWall(wall, type) {
  if (!wall || !wall.userData) return;
  const data = wall.userData;
  if (data.caps && data.caps.length) return;

  const height = 2.5;
  const thickness = 0.1;
  const dir = data.dir;
  const wallPos = wall.position;
  const material = wall.material;

  const caps = [];

  if (type === "door") {
    const openingWidth = 0.7; // 門在牆上的寬度，需與門幾何對應
    const sideWidth = (1 - openingWidth) / 2;
    const doorHeight = 2.2;

    if (sideWidth > 0) {
      const sideGeo =
        dir === "x"
          ? new THREE.BoxGeometry(sideWidth, height, thickness)
          : new THREE.BoxGeometry(thickness, height, sideWidth);

      const leftCap = new THREE.Mesh(sideGeo, material.clone());
      const rightCap = new THREE.Mesh(sideGeo.clone(), material.clone());

      if (dir === "x") {
        leftCap.position.set(wallPos.x - (openingWidth / 2 + sideWidth / 2), height / 2, wallPos.z);
        rightCap.position.set(wallPos.x + (openingWidth / 2 + sideWidth / 2), height / 2, wallPos.z);
      } else {
        leftCap.position.set(wallPos.x, height / 2, wallPos.z - (openingWidth / 2 + sideWidth / 2));
        rightCap.position.set(wallPos.x, height / 2, wallPos.z + (openingWidth / 2 + sideWidth / 2));
      }

      [leftCap, rightCap].forEach(cap => {
        cap.castShadow = true;
        cap.receiveShadow = true;
        cap.userData = { x: data.x, z: data.z, dir: data.dir };
        scene.add(cap);
        walls.push(cap);
        caps.push(cap);
      });
    }

    const capHeight = height - doorHeight;
    if (capHeight > 0) {
      const topGeo =
        dir === "x"
          ? new THREE.BoxGeometry(openingWidth, capHeight, thickness)
          : new THREE.BoxGeometry(thickness, capHeight, openingWidth);
      const topCap = new THREE.Mesh(topGeo, material.clone());
      if (dir === "x") {
        topCap.position.set(wallPos.x, doorHeight + capHeight / 2, wallPos.z);
      } else {
        topCap.position.set(wallPos.x, doorHeight + capHeight / 2, wallPos.z);
      }
      topCap.castShadow = true;
      topCap.receiveShadow = true;
      topCap.userData = { x: data.x, z: data.z, dir: data.dir };
      scene.add(topCap);
      walls.push(topCap);
      caps.push(topCap);
    }
  } else if (type === "window") {
    const openingWidth = 0.9; // 窗戶在牆上的寬度，需與窗幾何對應
    const sideWidth = (1 - openingWidth) / 2;
    const windowBottom = 0.6; // 窗戶下緣高度
    const windowTop = 2.0; // 窗戶上緣高度
    const bottomHeight = windowBottom;
    const topHeight = height - windowTop;

    if (sideWidth > 0) {
      const sideGeo =
        dir === "x"
          ? new THREE.BoxGeometry(sideWidth, height, thickness)
          : new THREE.BoxGeometry(thickness, height, sideWidth);

      const leftCap = new THREE.Mesh(sideGeo, material.clone());
      const rightCap = new THREE.Mesh(sideGeo.clone(), material.clone());

      if (dir === "x") {
        leftCap.position.set(wallPos.x - (openingWidth / 2 + sideWidth / 2), height / 2, wallPos.z);
        rightCap.position.set(wallPos.x + (openingWidth / 2 + sideWidth / 2), height / 2, wallPos.z);
      } else {
        leftCap.position.set(wallPos.x, height / 2, wallPos.z - (openingWidth / 2 + sideWidth / 2));
        rightCap.position.set(wallPos.x, height / 2, wallPos.z + (openingWidth / 2 + sideWidth / 2));
      }

      [leftCap, rightCap].forEach(cap => {
        cap.castShadow = true;
        cap.receiveShadow = true;
        cap.userData = { x: data.x, z: data.z, dir: data.dir };
        scene.add(cap);
        walls.push(cap);
        caps.push(cap);
      });
    }

    if (bottomHeight > 0) {
      const geoB =
        dir === "x"
          ? new THREE.BoxGeometry(openingWidth, bottomHeight, thickness)
          : new THREE.BoxGeometry(thickness, bottomHeight, openingWidth);
      const capB = new THREE.Mesh(geoB, material.clone());
      capB.position.set(wallPos.x, bottomHeight / 2, wallPos.z);
      capB.castShadow = true;
      capB.receiveShadow = true;
      capB.userData = { x: data.x, z: data.z, dir: data.dir };
      scene.add(capB);
      walls.push(capB);
      caps.push(capB);
    }

    if (topHeight > 0) {
      const geoT =
        dir === "x"
          ? new THREE.BoxGeometry(openingWidth, topHeight, thickness)
          : new THREE.BoxGeometry(thickness, topHeight, openingWidth);
      const capT = new THREE.Mesh(geoT, material.clone());
      capT.position.set(wallPos.x, windowTop + topHeight / 2, wallPos.z);
      capT.castShadow = true;
      capT.receiveShadow = true;
      capT.userData = { x: data.x, z: data.z, dir: data.dir };
      scene.add(capT);
      walls.push(capT);
      caps.push(capT);
    }
  }

  if (caps.length) {
    data.caps = caps;
  }
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

    if (buildMode === "wall" || buildMode === "wallLine") {
      draggingWall = true;
      controls.enabled = false;
      wallStart = { x, z };
      lastWallGrid = { x, z };
    }

    if (buildMode === "furniture") {
      const currentType = currentFurnitureType;

      // 門 / 窗：點擊牆體進行貼牆放置
      if (currentType === "door" || currentType === "window") {
        const hitWallForPlace = raycaster.intersectObjects(walls);
        if (hitWallForPlace.length) {
          const wall = hitWallForPlace[0].object;
          placeDoorOrWindowOnWall(wall, currentType);
          return;
        }
      }

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

  if (draggingWall && (buildMode === "wall" || buildMode === "wallLine")) {
    lastWallGrid = { x, z };
    updateWallPreview(wallStart, lastWallGrid);
  }

  if (draggingFurniture && buildMode === "furniture" && draggedFurniture) {
    const d = draggedFurniture.userData;
    const t = d && d.type;
    if (t === "door" || t === "window") {
      // 門窗保持貼牆，不支持拖拽移動
      return;
    }
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
    if (wallStart && lastWallGrid && draggingWall) {
      if (buildMode === "wallLine") {
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
      } else if (buildMode === "wall") {
        const startX = wallStart.x;
        const startZ = wallStart.z;
        const endX = lastWallGrid.x;
        const endZ = lastWallGrid.z;

        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minZ = Math.min(startZ, endZ);
        const maxZ = Math.max(startZ, endZ);

        // 四邊牆：上、下、左、右，形成一個矩形房間
        for (let x = minX; x <= maxX; x++) {
          createWall(x, minZ, "x");      // 北邊
          createWall(x, maxZ + 1, "x");  // 南邊
        }

        for (let z = minZ; z <= maxZ; z++) {
          createWall(minX, z, "z");      // 西邊
          createWall(maxX + 1, z, "z");  // 東邊
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
