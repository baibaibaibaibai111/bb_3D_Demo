import { applyLayout } from "./layout-history.js";

// 矩形房间帮助函数
function createRectFloors(width, depth, originX = 0, originZ = 0) {
  const floors = [];
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      floors.push({ x: originX + x, z: originZ + z });
    }
  }
  return floors;
}

function createRectWalls(width, depth, originX = 0, originZ = 0, options = {}) {
  const walls = [];
  const doorGaps = options.doorGaps || [];

  const hasGap = (x, z, dir) =>
    doorGaps.some(g => g.x === x && g.z === z && g.dir === dir);

  // 上下两条长墙（沿 X 方向）
  for (let x = 0; x < width; x++) {
    const wx = originX + x;
    const northZ = originZ; // 北边
    const southZ = originZ + depth; // 南边（注意是 depth，而不是 depth-1）

    if (!hasGap(wx, northZ, "x")) {
      walls.push({ x: wx, z: northZ, dir: "x" });
    }
    if (!hasGap(wx, southZ, "x")) {
      walls.push({ x: wx, z: southZ, dir: "x" });
    }
  }

  // 左右两条长墙（沿 Z 方向）
  for (let z = 0; z < depth; z++) {
    const wz = originZ + z;
    const westX = originX; // 西边
    const eastX = originX + width; // 东边

    if (!hasGap(westX, wz, "z")) {
      walls.push({ x: westX, z: wz, dir: "z" });
    }
    if (!hasGap(eastX, wz, "z")) {
      walls.push({ x: eastX, z: wz, dir: "z" });
    }
  }

  return walls;
}

function createStudioLayout() {
  const width = 6;
  const depth = 6;
  const originX = 0;
  const originZ = 0;

  const floors = createRectFloors(width, depth, originX, originZ);
  // 南边留一个门洞（x=2 的一段）
  const walls = createRectWalls(width, depth, originX, originZ, {
    doorGaps: [{ x: originX + 2, z: originZ + depth, dir: "x" }]
  });

  const furnitures = [
    // 卧室区
    { x: originX + 1, z: originZ + 1, type: "bed", rotationY: 0 },
    // 客厅：沙發 + 電視 + 吉他
    { x: originX + 3, z: originZ + 1, type: "sofa", rotationY: 0 },
    { x: originX + 3, z: originZ + 0, type: "tv", rotationY: 0 },
    { x: originX + 4, z: originZ + 1, type: "guitar", rotationY: 0 },
    // 工作區：電腦桌
    { x: originX + 1, z: originZ + 3, type: "computerDesk", rotationY: 0 },
    // 簡單餐區：桌子
    { x: originX + 2, z: originZ + 4, type: "table", rotationY: 0 },
    // 廚房角：冰箱
    { x: originX + 0, z: originZ + 4, type: "fridge", rotationY: Math.PI / 2 },
    // 衛浴角：馬桶 + 洗手池 + 淋浴
    { x: originX + 5, z: originZ + 4, type: "toilet", rotationY: Math.PI },
    { x: originX + 5, z: originZ + 5, type: "sink", rotationY: Math.PI },
    { x: originX + 4, z: originZ + 5, type: "shower", rotationY: Math.PI }
  ];

  return { floors, walls, furnitures };
}

function createFamilyHouseLayout() {
  const width = 8;
  const depth = 6;
  const originX = 0;
  const originZ = 0;

  const floors = createRectFloors(width, depth, originX, originZ);
  // 南邊中間留門洞
  const doorX = originX + Math.floor(width / 2);
  const walls = createRectWalls(width, depth, originX, originZ, {
    doorGaps: [{ x: doorX, z: originZ + depth, dir: "x" }]
  });

  const furnitures = [
    // 主卧
    { x: originX + 1, z: originZ + 1, type: "bed", rotationY: 0 },
    // 次卧（兒童房）
    { x: originX + 6, z: originZ + 1, type: "bed", rotationY: 0 },
    // 客廳：沙發 + 電視
    { x: originX + 3, z: originZ + 3, type: "sofa", rotationY: 0 },
    { x: originX + 3, z: originZ + 2, type: "tv", rotationY: 0 },
    // 餐桌
    { x: originX + 1, z: originZ + 4, type: "table", rotationY: 0 },
    // 廚房角：冰箱 + 食物盤
    { x: originX + 0, z: originZ + 4, type: "fridge", rotationY: Math.PI / 2 },
    { x: originX + 0, z: originZ + 5, type: "food", rotationY: 0 },
    // 書房 / 工作區：電腦桌
    { x: originX + 6, z: originZ + 3, type: "computerDesk", rotationY: Math.PI },
    // 衛浴：浴缸 + 洗手池 + 馬桶
    { x: originX + 7, z: originZ + 4, type: "bathtub", rotationY: Math.PI / 2 },
    { x: originX + 6, z: originZ + 5, type: "sink", rotationY: Math.PI },
    { x: originX + 7, z: originZ + 5, type: "toilet", rotationY: Math.PI }
  ];

  return { floors, walls, furnitures };
}

function createWorkshopLayout() {
  const width = 7;
  const depth = 5;
  const originX = 0;
  const originZ = 0;

  const floors = createRectFloors(width, depth, originX, originZ);
  // 南邊左側留門洞
  const walls = createRectWalls(width, depth, originX, originZ, {
    doorGaps: [{ x: originX + 1, z: originZ + depth, dir: "x" }]
  });

  const furnitures = [
    // 休息區：沙發 + 電視
    { x: originX + 1, z: originZ + 1, type: "sofa", rotationY: 0 },
    { x: originX + 1, z: originZ + 0, type: "tv", rotationY: 0 },
    // 樂隊排練角：多把吉他
    { x: originX + 4, z: originZ + 1, type: "guitar", rotationY: 0 },
    { x: originX + 5, z: originZ + 1, type: "guitar", rotationY: 0 },
    // 工作臺：電腦桌 + 桌子
    { x: originX + 2, z: originZ + 3, type: "computerDesk", rotationY: 0 },
    { x: originX + 3, z: originZ + 3, type: "table", rotationY: 0 },
    // 小廚區：冰箱
    { x: originX + 0, z: originZ + 3, type: "fridge", rotationY: Math.PI / 2 },
    // 簡易衛浴：洗手池 + 淋浴
    { x: originX + 6, z: originZ + 3, type: "sink", rotationY: Math.PI },
    { x: originX + 6, z: originZ + 4, type: "shower", rotationY: Math.PI }
  ];

  return { floors, walls, furnitures };
}

const PRESET_LAYOUTS = {
  studio: createStudioLayout(),
  family: createFamilyHouseLayout(),
  workshop: createWorkshopLayout()
};

function applyPresetLayout(key) {
  const data = PRESET_LAYOUTS[key];
  if (!data) return;
  applyLayout(data);
}

export { PRESET_LAYOUTS, applyPresetLayout };
