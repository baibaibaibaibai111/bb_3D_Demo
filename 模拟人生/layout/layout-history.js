import { floors, walls, furnitures, destroyAnimations, createFloor } from "./layout-world.js";
import { createWall, createFurniture } from "./layout.js";
import { removeObjectFromScene } from "./layout-world.js";

/* ================= 佈局：導入導出與撤銷重做 ================= */

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
    removeObjectFromScene(f);
  });
  walls.forEach(w => {
    removeObjectFromScene(w);
  });
  furnitures.forEach(f => {
    removeObjectFromScene(f);
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
    navigator.clipboard
      .writeText(json)
      .then(() => {
        alert("布局JSON已复制到剪贴板");
      })
      .catch(() => {
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
};
