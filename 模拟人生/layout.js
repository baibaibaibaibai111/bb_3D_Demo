import { THREE, scene } from "./core.js";

/* ================= 世界數據與佈局 ================= */

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
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.1, 1),
    new THREE.MeshStandardMaterial({ color: 0x999999 })
  );
  floor.position.set(x + 0.5, 0.05, z + 0.5);
  floor.receiveShadow = true;
  floor.userData.grid = { x, z };
  scene.add(floor);
  floors.push(floor);
}

function createWall(x, z, dir) {
  const height = 2.5;
  const thickness = 0.1;

  for (let i = 0; i < walls.length; i++) {
    const d = walls[i].userData;
    if (d && d.x === x && d.z === z && d.dir === dir) {
      return;
    }
  }

  const geo =
    dir === "x"
      ? new THREE.BoxGeometry(1, height, thickness)
      : new THREE.BoxGeometry(thickness, height, 1);

  const wall = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2 })
  );

  wall.position.set(
    dir === "x" ? x + 0.5 : x,
    height / 2,
    dir === "z" ? z + 0.5 : z
  );

  wall.castShadow = true;
  wall.receiveShadow = true;
  wall.userData = { x, z, dir };

  scene.add(wall);
  walls.push(wall);
}

function createFurniture(x, z, type, rotationY = 0) {
  for (let i = 0; i < furnitures.length; i++) {
    const g = furnitures[i].userData && furnitures[i].userData.grid;
    if (g && g.x === x && g.z === z) {
      return;
    }
  }

  let mainColor = 0x8bc34a;
  if (type === "bed") mainColor = 0x03a9f4;
  else if (type === "sofa") mainColor = 0x9c27b0;
  else if (type === "table") mainColor = 0xffc107;

  const group = new THREE.Group();
  let highlightTarget = null;

  if (type === "bed") {
    const baseGeo = new THREE.BoxGeometry(0.9, 0.3, 1.6);
    const headGeo = new THREE.BoxGeometry(0.9, 0.5, 0.2);
    const baseMat = new THREE.MeshStandardMaterial({ color: mainColor });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x01579b });

    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(0, 0.25, 0);
    base.castShadow = true;
    base.receiveShadow = true;

    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 0.45, -0.7);
    head.castShadow = true;
    head.receiveShadow = true;

    group.add(base);
    group.add(head);
    highlightTarget = base;
  } else if (type === "sofa") {
    const seatGeo = new THREE.BoxGeometry(1.1, 0.3, 0.7);
    const backGeo = new THREE.BoxGeometry(1.1, 0.5, 0.2);
    const armGeo = new THREE.BoxGeometry(0.2, 0.4, 0.7);
    const seatMat = new THREE.MeshStandardMaterial({ color: mainColor });
    const backMat = new THREE.MeshStandardMaterial({ color: 0x6a1b9a });
    const armMat = new THREE.MeshStandardMaterial({ color: 0x4a148c });

    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.set(0, 0.25, 0);
    seat.castShadow = true;
    seat.receiveShadow = true;

    const back = new THREE.Mesh(backGeo, backMat);
    back.position.set(0, 0.55, -0.25);
    back.castShadow = true;
    back.receiveShadow = true;

    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.55, 0.45, 0);
    armL.castShadow = true;
    armL.receiveShadow = true;

    const armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(0.55, 0.45, 0);
    armR.castShadow = true;
    armR.receiveShadow = true;

    group.add(seat, back, armL, armR);
    highlightTarget = seat;
  } else if (type === "table") {
    const topGeo = new THREE.BoxGeometry(1.0, 0.1, 1.0);
    const legGeo = new THREE.BoxGeometry(0.1, 0.6, 0.1);
    const topMat = new THREE.MeshStandardMaterial({ color: mainColor });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x795548 });

    const top = new THREE.Mesh(topGeo, topMat);
    top.position.set(0, 0.65, 0);
    top.castShadow = true;
    top.receiveShadow = true;

    const legOffsets = [
      [-0.45, 0.35, -0.45],
      [0.45, 0.35, -0.45],
      [-0.45, 0.35, 0.45],
      [0.45, 0.35, 0.45]
    ];

    group.add(top);
    legOffsets.forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      leg.receiveShadow = true;
      group.add(leg);
    });

    highlightTarget = top;
  } else {
    const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const mat = new THREE.MeshStandardMaterial({ color: mainColor });
    const box = new THREE.Mesh(geo, mat);
    box.position.set(0, 0.4, 0);
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);
    highlightTarget = box;
  }

  group.position.set(x + 0.5, 0, z + 0.5);
  group.rotation.y = rotationY;
  group.castShadow = true;
  group.receiveShadow = true;
  group.userData = {
    grid: { x, z },
    type,
    rotationY,
    highlightTarget
  };

  scene.add(group);
  furnitures.push(group);
  return group;
}

function isCellWalkable(x, z) {
  let hasFloor = false;
  for (let i = 0; i < floors.length; i++) {
    const g = floors[i].userData && floors[i].userData.grid;
    if (g && g.x === x && g.z === z) {
      hasFloor = true;
      break;
    }
  }
  if (!hasFloor) return false;

  for (let i = 0; i < furnitures.length; i++) {
    const g = furnitures[i].userData && furnitures[i].userData.grid;
    if (g && g.x === x && g.z === z) {
      return false;
    }
  }

  return true;
}

function hasWallBetweenCells(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  if (Math.abs(dx) + Math.abs(dz) !== 1) return false;

  if (dz === 1) {
    const wx = x1;
    const wz = z1 + 1;
    for (let i = 0; i < walls.length; i++) {
      const d = walls[i].userData;
      if (d && d.dir === "x" && d.x === wx && d.z === wz) return true;
    }
  } else if (dz === -1) {
    const wx = x1;
    const wz = z1;
    for (let i = 0; i < walls.length; i++) {
      const d = walls[i].userData;
      if (d && d.dir === "x" && d.x === wx && d.z === wz) return true;
    }
  } else if (dx === 1) {
    const wx = x1 + 1;
    const wz = z1;
    for (let i = 0; i < walls.length; i++) {
      const d = walls[i].userData;
      if (d && d.dir === "z" && d.x === wx && d.z === wz) return true;
    }
  } else if (dx === -1) {
    const wx = x1;
    const wz = z1;
    for (let i = 0; i < walls.length; i++) {
      const d = walls[i].userData;
      if (d && d.dir === "z" && d.x === wx && d.z === wz) return true;
    }
  }

  return false;
}

function canMoveCharacterTo(fromX, fromZ, toX, toZ) {
  const cx = Math.floor(fromX);
  const cz = Math.floor(fromZ);
  const nx = Math.floor(toX);
  const nz = Math.floor(toZ);

  if (nx === cx && nz === cz) {
    return true;
  }

  if (!isCellWalkable(nx, nz)) return false;
  if (hasWallBetweenCells(cx, cz, nx, nz)) return false;

  return true;
}

function findPath(startX, startZ, targetX, targetZ) {
  if (!isCellWalkable(targetX, targetZ)) return null;

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

  if (!isFinite(minX)) {
    return null;
  }

  minX -= 1;
  maxX += 1;
  minZ -= 1;
  maxZ += 1;

  const key = (x, z) => `${x},${z}`;
  const queue = [];
  const visited = new Set();
  const cameFrom = Object.create(null);

  const startKey = key(startX, startZ);
  queue.push({ x: startX, z: startZ });
  visited.add(startKey);
  cameFrom[startKey] = null;

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  let foundKey = null;

  while (queue.length) {
    const node = queue.shift();
    if (node.x === targetX && node.z === targetZ) {
      foundKey = key(node.x, node.z);
      break;
    }

    for (let i = 0; i < dirs.length; i++) {
      const dx = dirs[i][0];
      const dz = dirs[i][1];
      const nx = node.x + dx;
      const nz = node.z + dz;

      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;
      const nk = key(nx, nz);
      if (visited.has(nk)) continue;
      if (!isCellWalkable(nx, nz)) continue;
      if (hasWallBetweenCells(node.x, node.z, nx, nz)) continue;

      visited.add(nk);
      cameFrom[nk] = key(node.x, node.z);
      queue.push({ x: nx, z: nz });
    }
  }

  if (!foundKey) return null;

  const path = [];
  let currentKey = foundKey;
  while (currentKey) {
    const parts = currentKey.split(",");
    const x = parseInt(parts[0], 10);
    const z = parseInt(parts[1], 10);
    path.push({ x, z });
    currentKey = cameFrom[currentKey];
  }

  path.reverse();
  return path;
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

const layoutHistory = [];
let isRestoringLayout = false;

function getCurrentLayout() {
  return {
    floors: floors
      .map(f => f.userData && f.userData.grid)
      .filter(item => !!item),
    walls: walls
      .map(w => w.userData)
      .filter(item => !!item),
    furnitures: furnitures
      .map(f => {
        const d = f.userData;
        if (!d || !d.grid) return null;
        return {
          x: d.grid.x,
          z: d.grid.z,
          type: d.type || "bed",
          rotationY:
            typeof d.rotationY === "number" ? d.rotationY : (f.rotation && f.rotation.y) || 0
        };
      })
      .filter(item => !!item)
  };
}

function applyLayout(data) {
  destroyAnimations.forEach(item => {
    removeObjectFromScene(item.object);
  });
  destroyAnimations.length = 0;

  floors.forEach(f => {
    scene.remove(f);
  });
  walls.forEach(w => {
    scene.remove(w);
  });
  furnitures.forEach(f => {
    scene.remove(f);
  });
  floors.length = 0;
  walls.length = 0;
  furnitures.length = 0;

  if (data && data.floors) {
    data.floors.forEach(g => {
      if (g && typeof g.x === "number" && typeof g.z === "number") {
        createFloor(g.x, g.z);
      }
    });
  }

  if (data && data.walls) {
    data.walls.forEach(w => {
      if (w && typeof w.x === "number" && typeof w.z === "number" && w.dir) {
        createWall(w.x, w.z, w.dir);
      }
    });
  }

  if (data && data.furnitures) {
    data.furnitures.forEach(g => {
      if (g && typeof g.x === "number" && typeof g.z === "number") {
        createFurniture(
          g.x,
          g.z,
          g.type || "bed",
          typeof g.rotationY === "number" ? g.rotationY : 0
        );
      }
    });
  }
}

function saveLayoutSnapshot() {
  if (isRestoringLayout) return;
  const data = getCurrentLayout();
  layoutHistory.push(JSON.stringify(data));
  if (layoutHistory.length > 50) {
    layoutHistory.shift();
  }
}

function undoLastLayoutChange() {
  if (!layoutHistory.length) return;
  const json = layoutHistory.pop();
  let data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    return;
  }
  isRestoringLayout = true;
  applyLayout(data);
  isRestoringLayout = false;
}

function exportLayout() {
  const data = getCurrentLayout();
  const json = JSON.stringify(data);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(json).then(() => {
      alert("布局JSON已复制到剪贴板");
    }).catch(() => {
      prompt("复制以下布局JSON：", json);
    });
  } else {
    prompt("复制以下布局JSON：", json);
  }
}

function importLayout() {
  const json = prompt("粘贴布局JSON：");
  if (!json) return;
  let data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    alert("JSON 解析失败");
    return;
  }
  isRestoringLayout = true;
  applyLayout(data);
  isRestoringLayout = false;
}

export {
  floors,
  walls,
  furnitures,
  destroyAnimations,
  createFloor,
  createWall,
  createFurniture,
  isCellWalkable,
  hasWallBetweenCells,
  canMoveCharacterTo,
  findPath,
  scheduleDestroy,
  setObjectOpacity,
  removeObjectFromScene,
  exportLayout,
  importLayout,
  saveLayoutSnapshot,
  undoLastLayoutChange
};
