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

  if (type === "ceilingLight" && !isClosedRoomCell(x, z)) {
    alert("吊灯只能放在封闭房间里（需要有地板并由墙围成的房间）");
    return;
  }

  let mainColor = 0x8bc34a;
  if (type === "bed") mainColor = 0x03a9f4;
  else if (type === "sofa") mainColor = 0x9c27b0;
  else if (type === "table") mainColor = 0xffc107;
  else if (type === "door") mainColor = 0x795548;
  else if (type === "window") mainColor = 0x90a4ae;
  else if (type === "ceilingLight") mainColor = 0xfff59d;
  else if (type === "tv") mainColor = 0x2196f3;
  else if (type === "food") mainColor = 0xff7043;
  else if (type === "toilet") mainColor = 0xffffff;
  else if (type === "sink") mainColor = 0x90caf9;

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
  } else if (type === "tv") {
    const baseGeo = new THREE.BoxGeometry(0.8, 0.1, 0.3);
    const screenGeo = new THREE.BoxGeometry(0.8, 0.45, 0.05);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x424242 });
    const screenMat = new THREE.MeshStandardMaterial({
      color: mainColor,
      emissive: mainColor,
      emissiveIntensity: 0.6
    });

    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(0, 0.05, 0);
    base.castShadow = true;
    base.receiveShadow = true;

    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 0.4, -0.1);
    screen.castShadow = true;
    screen.receiveShadow = true;

    group.add(base);
    group.add(screen);
    highlightTarget = screen;
  } else if (type === "food") {
    const plateGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.05, 16);
    const foodGeo = new THREE.SphereGeometry(0.15, 12, 12);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const foodMat = new THREE.MeshStandardMaterial({ color: mainColor });

    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set(0, 0.05, 0);
    plate.castShadow = true;
    plate.receiveShadow = true;

    const foodMesh = new THREE.Mesh(foodGeo, foodMat);
    foodMesh.position.set(0, 0.15, 0);
    foodMesh.castShadow = true;
    foodMesh.receiveShadow = true;

    group.add(plate);
    group.add(foodMesh);
    highlightTarget = foodMesh;
  } else if (type === "toilet") {
    const baseGeo = new THREE.BoxGeometry(0.4, 0.2, 0.5);
    const tankGeo = new THREE.BoxGeometry(0.4, 0.35, 0.15);
    const seatGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16);
    const mat = new THREE.MeshStandardMaterial({ color: mainColor });

    const base = new THREE.Mesh(baseGeo, mat);
    base.position.set(0, 0.1, 0);
    base.castShadow = true;
    base.receiveShadow = true;

    const tank = new THREE.Mesh(tankGeo, mat);
    tank.position.set(0, 0.4, -0.15);
    tank.castShadow = true;
    tank.receiveShadow = true;

    const seat = new THREE.Mesh(seatGeo, mat);
    seat.position.set(0, 0.28, 0.05);
    seat.rotation.x = Math.PI / 2;
    seat.castShadow = true;
    seat.receiveShadow = true;

    group.add(base);
    group.add(tank);
    group.add(seat);
    highlightTarget = seat;
  } else if (type === "sink") {
    const basinGeo = new THREE.BoxGeometry(0.6, 0.2, 0.4);
    const standGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const faucetGeo = new THREE.BoxGeometry(0.05, 0.15, 0.05);
    const basinMat = new THREE.MeshStandardMaterial({ color: mainColor });
    const standMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5 });
    const faucetMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae });

    const stand = new THREE.Mesh(standGeo, standMat);
    stand.position.set(0, 0.3, 0);
    stand.castShadow = true;
    stand.receiveShadow = true;

    const basin = new THREE.Mesh(basinGeo, basinMat);
    basin.position.set(0, 0.65, 0);
    basin.castShadow = true;
    basin.receiveShadow = true;

    const faucet = new THREE.Mesh(faucetGeo, faucetMat);
    faucet.position.set(0, 0.85, -0.1);
    faucet.castShadow = true;
    faucet.receiveShadow = true;

    group.add(stand);
    group.add(basin);
    group.add(faucet);
    highlightTarget = basin;
  } else if (type === "door") {
    const doorGeo = new THREE.BoxGeometry(0.08, 2.2, 0.7);
    const doorMat = new THREE.MeshStandardMaterial({ color: mainColor });
    const door = new THREE.Mesh(doorGeo, doorMat);
    // 放在牆的幾何中心，實際的牆面會在放置門時隱藏掉，避免穿模
    door.position.set(0, 1.1, 0);
    door.castShadow = true;
    door.receiveShadow = true;
    group.add(door);
    highlightTarget = door;
  } else if (type === "window") {
    const frameGeo = new THREE.BoxGeometry(0.08, 1.4, 0.9);
    const glassGeo = new THREE.BoxGeometry(0.04, 1.0, 0.8);
    const frameMat = new THREE.MeshStandardMaterial({ color: mainColor });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x90caf9,
      transparent: true,
      opacity: 0.5
    });

    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(0, 1.3, 0);
    frame.castShadow = true;
    frame.receiveShadow = true;

    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 1.3, 0);
    glass.castShadow = false;
    glass.receiveShadow = false;

    group.add(frame);
    group.add(glass);
    highlightTarget = frame;
  } else if (type === "ceilingLight") {
    const rodGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8);
    const lampGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5 });
    const lampMat = new THREE.MeshStandardMaterial({
      color: mainColor,
      emissive: mainColor,
      emissiveIntensity: 0.8
    });

    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.set(0, 2.2, 0);
    rod.castShadow = false;
    rod.receiveShadow = false;

    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(0, 1.8, 0);
    lamp.castShadow = true;
    lamp.receiveShadow = true;

    const light = new THREE.PointLight(0xfff8e1, 1, 6);
    light.position.set(0, 1.8, 0);

    group.add(rod);
    group.add(lamp);
    group.add(light);
    highlightTarget = lamp;
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

  if (type === "door" || type === "window") {
    const rot = typeof rotationY === "number" ? rotationY : 0;
    const s = Math.sin(rot);
    const c = Math.cos(rot);
    const alongX = Math.abs(s) > Math.abs(c);
    if (alongX) {
      // 與 X 方向牆對齊（水平牆，中心在 (x+0.5, z)）
      group.position.set(x + 0.5, 0, z);
    } else {
      // 與 Z 方向牆對齊（垂直牆，中心在 (x, z+0.5)）
      group.position.set(x, 0, z + 0.5);
    }
    group.rotation.y = rot;
  } else {
    group.position.set(x + 0.5, 0, z + 0.5);
    group.rotation.y = rotationY;
  }
  group.castShadow = true;
  group.receiveShadow = true;
  group.userData = {
    grid: { x, z },
    type,
    rotationY,
    highlightTarget,
    // 門窗開關狀態（0 關，1 開），動畫在 live-mode.js 中插值
    doorOpenTarget: type === "door" ? false : undefined,
    doorOpenProgress: type === "door" ? 0 : undefined,
    windowOpenTarget: type === "window" ? false : undefined,
    windowOpenProgress: type === "window" ? 0 : undefined,
    wall: undefined
  };

  scene.add(group);
  furnitures.push(group);
  return group;
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
        // 可以在沒有牆阻擋的情況下走到邊界外，說明不是封閉房間
        return false;
      }

      if (!hasFloorAt(nx, nz)) {
        // 可以在沒有牆阻擋的情況下走到沒有地板的格子，說明不是封閉房間
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
const layoutRedoHistory = [];
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
  // 新的操作產生後，清空可以重做的歷史
  layoutRedoHistory.length = 0;
}

function undoLastLayoutChange() {
  if (!layoutHistory.length) return;
  // 先把當前狀態保存到重做棧
  const current = getCurrentLayout();
  layoutRedoHistory.push(JSON.stringify(current));
  if (layoutRedoHistory.length > 50) {
    layoutRedoHistory.shift();
  }

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

function redoLastLayoutChange() {
  if (!layoutRedoHistory.length) return;

  // 先把當前狀態放回撤銷棧
  const current = getCurrentLayout();
  layoutHistory.push(JSON.stringify(current));
  if (layoutHistory.length > 50) {
    layoutHistory.shift();
  }

  const json = layoutRedoHistory.pop();
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
  updateDoorsAndWindows,
  isClosedRoomCell,
  setWallVisibilityMode,
  getWallVisibilityMode,
  updateWallsForCameraView,
  exportLayout,
  importLayout,
  saveLayoutSnapshot,
  undoLastLayoutChange,
  redoLastLayoutChange
};
