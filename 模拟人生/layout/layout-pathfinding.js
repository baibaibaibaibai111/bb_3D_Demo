import { floors, walls, furnitures } from "./layout-world.js";

/* ================= 佈局：可走性與尋路 ================= */

function hasFloorAt(x, z) {
  for (let i = 0; i < floors.length; i++) {
    const g = floors[i].userData && floors[i].userData.grid;
    if (g && g.x === x && g.z === z) {
      return true;
    }
  }
  return false;
}

function isDoorOpenOnWall(wx, wz, dir) {
  for (let i = 0; i < furnitures.length; i++) {
    const f = furnitures[i];
    const d = f.userData;
    if (!d || d.type !== "door" || !d.grid) continue;

    const gx = d.grid.x;
    const gz = d.grid.z;
    const rot = typeof d.rotationY === "number" ? d.rotationY : f.rotation.y || 0;
    const s = Math.sin(rot);
    const c = Math.cos(rot);
    const alongX = Math.abs(s) > Math.abs(c);
    const doorDir = alongX ? "x" : "z";

    if (doorDir === dir && gx === wx && gz === wz) {
      return !!d.doorOpenTarget;
    }
  }
  return false;
}

function hasBlockingWallBetweenCells(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  if (Math.abs(dx) + Math.abs(dz) !== 1) return false;

  let wx;
  let wz;
  let dir;

  if (dz === 1) {
    wx = x1;
    wz = z1 + 1;
    dir = "x";
  } else if (dz === -1) {
    wx = x1;
    wz = z1;
    dir = "x";
  } else if (dx === 1) {
    wx = x1 + 1;
    wz = z1;
    dir = "z";
  } else {
    wx = x1;
    wz = z1;
    dir = "z";
  }

  // 檢查是否存在這段結構牆
  let hasWall = false;
  for (let i = 0; i < walls.length; i++) {
    const d = walls[i].userData;
    if (d && d.dir === dir && d.x === wx && d.z === wz) {
      hasWall = true;
      break;
    }
  }
  if (!hasWall) return false;

  // 有牆，但若該牆上有「已打開」的門，則視為可通行
  if (isDoorOpenOnWall(wx, wz, dir)) return false;

  return true;
}

function isCellWalkable(x, z) {
  if (!hasFloorAt(x, z)) return false;

  for (let i = 0; i < furnitures.length; i++) {
    const d = furnitures[i].userData;
    const g = d && d.grid;
    if (g && g.x === x && g.z === z) {
      const t = d && d.type;
      if (t === "door" || t === "window" || t === "ceilingLight") {
        continue;
      }
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

function isClosedRoomCell(startX, startZ) {
  if (!hasFloorAt(startX, startZ)) return false;

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

  if (!isFinite(minX)) return false;

  const margin = 1;
  const boundMinX = minX - margin;
  const boundMaxX = maxX + margin;
  const boundMinZ = minZ - margin;
  const boundMaxZ = maxZ + margin;

  const key = (x, z) => `${x},${z}`;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  const queue = [{ x: startX, z: startZ }];
  const visited = new Set([key(startX, startZ)]);

  while (queue.length) {
    const node = queue.shift();
    const cx = node.x;
    const cz = node.z;

    for (let i = 0; i < dirs.length; i++) {
      const dx = dirs[i][0];
      const dz = dirs[i][1];
      const nx = cx + dx;
      const nz = cz + dz;

      if (hasWallBetweenCells(cx, cz, nx, nz)) continue;

      if (nx < boundMinX || nx > boundMaxX || nz < boundMinZ || nz > boundMaxZ) {
        return false;
      }

      if (!hasFloorAt(nx, nz)) {
        return false;
      }

      const k = key(nx, nz);
      if (!visited.has(k)) {
        visited.add(k);
        queue.push({ x: nx, z: nz });
      }
    }
  }

  return true;
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
  if (hasBlockingWallBetweenCells(cx, cz, nx, nz)) return false;

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
      if (hasBlockingWallBetweenCells(node.x, node.z, nx, nz)) continue;

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

export {
  hasFloorAt,
  isDoorOpenOnWall,
  hasBlockingWallBetweenCells,
  isCellWalkable,
  hasWallBetweenCells,
  isClosedRoomCell,
  canMoveCharacterTo,
  findPath
};
