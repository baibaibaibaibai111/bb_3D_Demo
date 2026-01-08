import { THREE, scene } from "../core/core.js";
import {
  floors,
  walls,
  furnitures,
  destroyAnimations,
  createFloor,
  scheduleDestroy,
  setObjectOpacity,
  removeObjectFromScene,
  updateDoorsAndWindows
} from "./layout-world.js";
import {
  hasFloorAt,
  isDoorOpenOnWall,
  hasBlockingWallBetweenCells,
  isCellWalkable,
  hasWallBetweenCells,
  isClosedRoomCell,
  canMoveCharacterTo,
  findPath
} from "./layout-pathfinding.js";
import { setWallVisibilityMode, getWallVisibilityMode, updateWallsForCameraView } from "./layout-visibility.js";
import {
  getCurrentLayout,
  applyLayout,
  saveLayoutSnapshot,
  undoLastLayoutChange,
  redoLastLayoutChange,
  exportLayout,
  importLayout,
  layoutHistory,
  layoutRedoHistory,
  isRestoringLayout
} from "./layout-history.js";

/* ================= 世界數據與佈局 ================= */

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
  else if (type === "computerDesk") mainColor = 0x607d8b;
  else if (type === "fridge") mainColor = 0xe0f7fa;
  else if (type === "guitar") mainColor = 0xffb74d;
  else if (type === "shower") mainColor = 0x80deea;
  else if (type === "bathtub") mainColor = 0xb3e5fc;

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
  } else if (type === "computerDesk") {
    const topGeo = new THREE.BoxGeometry(1.0, 0.08, 0.6);
    const legGeo = new THREE.BoxGeometry(0.1, 0.7, 0.1);
    const screenGeo = new THREE.BoxGeometry(0.4, 0.25, 0.05);
    const topMat = new THREE.MeshStandardMaterial({ color: mainColor });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x455a64 });
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x2196f3, emissive: 0x2196f3, emissiveIntensity: 0.6 });

    const top = new THREE.Mesh(topGeo, topMat);
    top.position.set(0, 0.75, 0);
    top.castShadow = true;
    top.receiveShadow = true;

    const legOffsets = [
      [-0.45, 0.35, -0.25],
      [0.45, 0.35, -0.25],
      [-0.45, 0.35, 0.25],
      [0.45, 0.35, 0.25]
    ];

    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 0.95, -0.18);
    screen.castShadow = true;
    screen.receiveShadow = true;

    group.add(top);
    legOffsets.forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      leg.receiveShadow = true;
      group.add(leg);
    });

    group.add(screen);
    highlightTarget = top;
  } else if (type === "fridge") {
    const bodyGeo = new THREE.BoxGeometry(0.7, 1.6, 0.6);
    const handleGeo = new THREE.BoxGeometry(0.04, 0.6, 0.04);
    const bodyMat = new THREE.MeshStandardMaterial({ color: mainColor });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5 });

    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.8, 0);
    body.castShadow = true;
    body.receiveShadow = true;

    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(0.32, 0.9, 0.28);
    handle.castShadow = true;
    handle.receiveShadow = true;

    group.add(body);
    group.add(handle);
    highlightTarget = body;
  } else if (type === "guitar") {
    const bodyGeo = new THREE.BoxGeometry(0.35, 0.55, 0.1);
    const neckGeo = new THREE.BoxGeometry(0.12, 0.65, 0.1);
    const bodyMat = new THREE.MeshStandardMaterial({ color: mainColor });
    const neckMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });

    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.5, 0);
    body.castShadow = true;
    body.receiveShadow = true;

    const neck = new THREE.Mesh(neckGeo, neckMat);
    neck.position.set(0, 1.0, 0);
    neck.castShadow = true;
    neck.receiveShadow = true;

    group.add(body);
    group.add(neck);
    highlightTarget = body;
  } else if (type === "shower") {
    const baseGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.05, 16);
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8);
    const headGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae });
    const headMat = new THREE.MeshStandardMaterial({ color: mainColor });

    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(0, 0.025, 0);
    base.castShadow = true;
    base.receiveShadow = true;

    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(-0.25, 0.95, -0.25);
    pole.castShadow = true;
    pole.receiveShadow = true;

    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(-0.25, 1.8, -0.25);
    head.castShadow = true;
    head.receiveShadow = true;

    group.add(base);
    group.add(pole);
    group.add(head);
    highlightTarget = base;
  } else if (type === "bathtub") {
    const outerGeo = new THREE.BoxGeometry(1.4, 0.6, 0.7);
    const innerGeo = new THREE.BoxGeometry(1.2, 0.4, 0.5);
    const outerMat = new THREE.MeshStandardMaterial({ color: mainColor });
    const innerMat = new THREE.MeshStandardMaterial({ color: 0xe0f7fa });

    const outer = new THREE.Mesh(outerGeo, outerMat);
    outer.position.set(0, 0.3, 0);
    outer.castShadow = true;
    outer.receiveShadow = true;

    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.set(0, 0.35, 0);
    inner.castShadow = false;
    inner.receiveShadow = false;

    group.add(outer);
    group.add(inner);
    highlightTarget = outer;
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

let wallVisibilityMode = "normal"; // 保留僅為了向 layout-visibility.js 提供初始值，實際控制在該模組內

// updateWallsForCameraView 已移至 layout-visibility.js

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
