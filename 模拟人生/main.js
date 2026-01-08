import {
  THREE,
  scene,
  camera,
  renderer,
  controls,
  clock,
  ground,
  grid,
  raycaster,
  mouse,
  snap
} from "./core/core.js";
import {
  floors,
  walls,
  furnitures,
  destroyAnimations,
  createFloor as layoutCreateFloor,
  createWall as layoutCreateWall,
  createFurniture as layoutCreateFurniture,
  isCellWalkable,
  hasWallBetweenCells,
  canMoveCharacterTo,
  findPath,
  scheduleDestroy,
  setObjectOpacity,
  removeObjectFromScene,
  updateWallsForCameraView,
  updateDoorsAndWindows,
  exportLayout,
  importLayout,
  saveLayoutSnapshot,
  undoLastLayoutChange
} from "./layout/layout.js";
import {
  ensureCharacter,
  resetLiveState,
  handleLiveKeyDown,
  handleLiveKeyUp,
  handleLiveMouseDown,
  updateLive
} from "./modes/live-mode.js";
import {
  getBuildMode,
  setBuildMode as setBuildModeState,
  getCurrentFurnitureType,
  setCurrentFurnitureType as setCurrentFurnitureTypeState,
  getSelectedFurniture,
  setSelectedFurniture,
  getFurnitureRoot,
  clearWallPreview,
  updateWallPreview,
  handleBuildMouseDown,
  handleBuildMouseMove,
  handleBuildMouseUp,
  resetBuildInteraction
} from "./modes/build-mode.js";
import { initUI, getGameMode } from "./ui/ui.js";

/* ================= 初始化 UI ================= */

initUI();

/* ================= 交互路由（滑鼠/鍵盤） ================= */

window.addEventListener("mousedown", e => {
  if (e.target !== renderer.domElement) {
    return;
  }
  if (getGameMode() === "live") {
    handleLiveMouseDown(e);
    return;
  }
  if (getGameMode() === "build") {
    handleBuildMouseDown(e);
  }
});

window.addEventListener("keyup", e => {
  if (getGameMode() === "live") {
    handleLiveKeyUp(e);
  }
});

window.addEventListener("contextmenu", e => e.preventDefault());

window.addEventListener("mousemove", e => {
  if (getGameMode() === "build") {
    handleBuildMouseMove(e);
  }
});

window.addEventListener("mouseup", e => {
  if (getGameMode() === "build") {
    handleBuildMouseUp(e);
  }
});

/* ================= 渲染 ================= */
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (getGameMode() === "live") {
    updateLive(delta);
  }

  // 銷毀動畫：縮小 + 淡出，結束後從場景移除
  if (destroyAnimations.length) {
    for (let i = destroyAnimations.length - 1; i >= 0; i--) {
      const item = destroyAnimations[i];
      const obj = item.object;
      item.elapsed += delta;
      const t = Math.min(1, item.elapsed / item.duration);
      const scale = Math.max(0.01, 1 - t);
      if (obj && obj.scale) {
        obj.scale.setScalar(scale);
      }
      const opacity = 1 - t;
      setObjectOpacity(obj, opacity);

      if (item.elapsed >= item.duration) {
        removeObjectFromScene(obj);
        destroyAnimations.splice(i, 1);
      }
    }
  }

  // 牆體透視模式：根據當前相機位置動態隱藏/顯示牆
  updateWallsForCameraView(camera);

  // 門窗開關動畫
  updateDoorsAndWindows(delta);

  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
