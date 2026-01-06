import { renderer } from "./core.js";
import {
  exportLayout,
  importLayout,
  undoLastLayoutChange,
  redoLastLayoutChange,
  setWallVisibilityMode,
  getWallVisibilityMode
} from "./layout.js";
import {
  getBuildMode,
  setBuildMode as setBuildModeState,
  getCurrentFurnitureType,
  setCurrentFurnitureType as setCurrentFurnitureTypeState,
  getSelectedFurniture,
  resetBuildInteraction
} from "./build-mode.js";
import {
  ensureCharacter,
  resetLiveState,
  handleLiveKeyDown
} from "./live-mode.js";

/* ================= 模式與 UI 狀態 ================= */

let gameMode = "build"; // build | live

function getGameMode() {
  return gameMode;
}

/* ================= DOM 引用 ================= */

const modeButtons = Array.from(document.querySelectorAll(".mode-button"));
const saveBtn = document.getElementById("saveLayout");
const loadBtn = document.getElementById("loadLayout");
const furnitureTypeButtons = Array.from(
  document.querySelectorAll(".furniture-type-button")
);
const rotateFurnitureBtn = document.getElementById("rotateFurnitureBtn");
const gameModeButtons = Array.from(document.querySelectorAll(".game-mode-button"));
const undoBtn = document.getElementById("undoLayout");
const redoBtn = document.getElementById("redoLayout");
const wallVisibilityButtons = Array.from(
  document.querySelectorAll(".wall-visibility-button")
);
const needAdjustButtons = Array.from(
  document.querySelectorAll(".need-adjust")
);
const needBars = Array.from(document.querySelectorAll(".need-bar"));
const needsPauseBtn = document.getElementById("needsPauseBtn");
const needsResumeBtn = document.getElementById("needsResumeBtn");
const needsFullBtn = document.getElementById("needsFullBtn");
const moodInput = document.getElementById("moodInput");
const moodApplyBtn = document.getElementById("moodApplyBtn");
const moodAutoBtn = document.getElementById("moodAutoBtn");

/* ================= UI 行為 ================= */

function updateCursor() {
  if (gameMode === "live" || gameMode === "view") {
    renderer.domElement.style.cursor = "default";
    return;
  }
  if (getBuildMode() === "destroy") {
    renderer.domElement.style.cursor = "crosshair";
  } else {
    renderer.domElement.style.cursor = "default";
  }
}

function setGameMode(mode) {
  gameMode = mode;

  gameModeButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.gameMode === gameMode);
  });

  // 每次切換模式時，都重置建造交互與生活模式狀態
  resetBuildInteraction();
  resetLiveState();

  if (gameMode === "live") {
    ensureCharacter();
  }
  updateCursor();
}

function setBuildMode(mode) {
  setBuildModeState(mode);
  const current = getBuildMode();
  modeButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === current);
  });
  updateCursor();
}

function setCurrentFurnitureType(type) {
  setCurrentFurnitureTypeState(type);
  const current = getCurrentFurnitureType();
  furnitureTypeButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === current);
  });
}

function setWallVisibility(mode) {
  setWallVisibilityMode(mode);
  const current = getWallVisibilityMode();
  wallVisibilityButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.wallMode === current);
  });
}

function rotateSelectedFurniture() {
  const selected = getSelectedFurniture();
  if (!selected) return;
  selected.rotation.y =
    (selected.rotation.y + Math.PI / 2) % (Math.PI * 2);
  if (!selected.userData) {
    selected.userData = {};
  }
  if (!selected.userData.grid) {
    selected.userData.grid = {
      x: Math.floor(selected.position.x),
      z: Math.floor(selected.position.z)
    };
  }
  selected.userData.rotationY = selected.rotation.y;
}

function initButtons() {
  setBuildMode(getBuildMode());
  setCurrentFurnitureType(getCurrentFurnitureType());
  if (wallVisibilityButtons.length) {
    setWallVisibility(getWallVisibilityMode());
  }

  if (gameModeButtons.length) {
    setGameMode(gameMode);
    gameModeButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        setGameMode(btn.dataset.gameMode);
      });
    });

    // 點擊進度條直接設置數值（0-100）
    needBars.forEach(bar => {
      bar.addEventListener("click", e => {
        const name = bar.dataset.need;
        if (!name) return;

        const rect = bar.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, x / rect.width));
        const value = Math.round(ratio * 100);

        if (typeof simNeeds.set === "function") {
          simNeeds.set(name, value);
        }
      });
    });
  }

  modeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      setGameMode("build");
      setBuildMode(btn.dataset.mode);
    });
  });

  furnitureTypeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      setCurrentFurnitureType(btn.dataset.type);
    });
  });

  wallVisibilityButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      setWallVisibility(btn.dataset.wallMode);
    });
  });

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      exportLayout();
    });
  }

  if (loadBtn) {
    loadBtn.addEventListener("click", () => {
      importLayout();
    });
  }

  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      undoLastLayoutChange();
    });
  }

  if (redoBtn) {
    redoBtn.addEventListener("click", () => {
      redoLastLayoutChange();
    });
  }

  if (rotateFurnitureBtn) {
    rotateFurnitureBtn.addEventListener("click", () => {
      rotateSelectedFurniture();
    });
  }

  // 需求與心情控制面板（使用 live-mode 中掛到 window 的 simNeeds API）
  const simNeeds = window.simNeeds;
  if (simNeeds) {
    needAdjustButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.need;
        const delta = parseFloat(btn.dataset.delta || "0");
        if (!name || !Number.isFinite(delta) || delta === 0) return;
        simNeeds.add(name, delta);
      });
    });

    if (needsPauseBtn) {
      needsPauseBtn.addEventListener("click", () => {
        simNeeds.pause();
      });
    }
    if (needsResumeBtn) {
      needsResumeBtn.addEventListener("click", () => {
        simNeeds.resume();
      });
    }
    if (needsFullBtn) {
      needsFullBtn.addEventListener("click", () => {
        simNeeds.setAll({
          social: 100,
          sleep: 100,
          hunger: 100,
          bladder: 100,
          fun: 100,
          hygiene: 100
        });
      });
    }

    if (moodApplyBtn && moodInput) {
      moodApplyBtn.addEventListener("click", () => {
        const v = moodInput.value.trim();
        if (v) {
          simNeeds.setMood(v);
        }
      });
    }
    if (moodAutoBtn) {
      moodAutoBtn.addEventListener("click", () => {
        simNeeds.clearMood();
      });
    }
  }
}

function initKeyboardShortcuts() {
  window.addEventListener("keydown", e => {
    // 全局：切換視角模式快捷鍵 V
    if (
      (e.code === "KeyV" || e.key === "v" || e.key === "V") &&
      !e.ctrlKey &&
      !e.metaKey
    ) {
      e.preventDefault();
      setGameMode("view");
      return;
    }

    if (gameMode === "build") {
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        undoLastLayoutChange();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redoLastLayoutChange();
        return;
      }

      if (e.key === "1") {
        setBuildMode("floor");
        console.log("切换为：地板模式");
      }
      if (e.key === "2") {
        setBuildMode("wall");
        console.log("切换为：墙体模式");
      }
      if (e.key === "3") {
        setBuildMode("furniture");
        console.log("切换为：家具模式");
      }
      // 單獨按 R 旋轉家具，避免 Ctrl+R 等快捷鍵干擾
      if (
        (e.code === "KeyR" || e.key === "r" || e.key === "R") &&
        !e.ctrlKey &&
        !e.metaKey &&
        getBuildMode() === "furniture" &&
        getSelectedFurniture()
      ) {
        e.preventDefault();
        rotateSelectedFurniture();
      }
    }

    if (gameMode === "live") {
      handleLiveKeyDown(e);
    }
  });
}

function initUI() {
  initButtons();
  initKeyboardShortcuts();
}

export { initUI, getGameMode, setGameMode };
