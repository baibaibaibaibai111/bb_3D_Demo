import { renderer } from "../core/core.js";
import {
  exportLayout,
  importLayout,
  undoLastLayoutChange,
  redoLastLayoutChange,
  setWallVisibilityMode,
  getWallVisibilityMode
} from "../layout/layout.js";
import { applyPresetLayout } from "../layout/layout-presets.js";
import {
  getBuildMode,
  setBuildMode as setBuildModeState,
  getCurrentFurnitureType,
  setCurrentFurnitureType as setCurrentFurnitureTypeState,
  getSelectedFurniture,
  resetBuildInteraction
} from "../modes/build-mode.js";
import {
  ensureCharacter,
  resetLiveState,
  handleLiveKeyDown,
  setPetEnabled
} from "../modes/live-mode.js";

/* ================= 模式與 UI 狀態 ================= */

let gameMode = "build"; // build | live

let currentFurnitureCategory = "all";

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
const furnitureCategoryButtons = Array.from(
  document.querySelectorAll(".furniture-category-button")
);
const presetLayoutButtons = Array.from(
  document.querySelectorAll(".preset-layout-button")
);
const togglePetBtn = document.getElementById("togglePetBtn");
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
const personalityPanel = document.getElementById("personalityPanel");
const personalityTraitCheckboxes = Array.from(
  document.querySelectorAll(".personality-trait")
);
const personalityPrefSliders = Array.from(
  document.querySelectorAll(".personality-pref-slider")
);
const personalityPrefValueLabels = Array.from(
  document.querySelectorAll(".personality-pref-value")
);
const furniturePanelElement = document.getElementById("furniturePanel");

const PERSONALITY_ACTION_KEYS = [
  "tv_watch",
  "sleep",
  "eat_food",
  "wash_sink",
  "use_toilet",
  "social"
];

const TRAIT_PREF_EFFECTS = {
  "愛玩": { tv_watch: 0.4, social: 0.2 },
  "宅": { tv_watch: 0.3, sleep: 0.3, social: -0.4 },
  "愛社交": { social: 0.7 },
  "內向": { social: -0.7, tv_watch: 0.2, sleep: 0.2 },
  "貪吃": { eat_food: 0.7 },
  "愛乾淨": { wash_sink: 0.7, use_toilet: 0.3 },
  "工作狂": { tv_watch: -0.4, social: -0.4, sleep: -0.2 },
  "愛睡覺": { sleep: 0.7 },
  "邋遢": { wash_sink: -0.7, use_toilet: -0.3 }
};

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

function updateFurnitureCategoryVisibility() {
  const category = currentFurnitureCategory;
  furnitureTypeButtons.forEach(btn => {
    const btnCategory = btn.dataset.category || "uncategorized";
    const visible = category === "all" || btnCategory === category;
    btn.style.display = visible ? "" : "none";
  });
}

function setFurnitureCategory(category) {
  currentFurnitureCategory = category || "all";
  furnitureCategoryButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.category === currentFurnitureCategory);
  });
  updateFurnitureCategoryVisibility();
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

  if (furnitureCategoryButtons.length) {
    setFurnitureCategory("all");
  } else {
    updateFurnitureCategoryVisibility();
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

  presetLayoutButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset;
      if (!preset) return;
      // 切回建造模式並應用預設佈局
      setGameMode("build");
      applyPresetLayout(preset);
    });
  });

  furnitureCategoryButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const category = btn.dataset.category || "all";
      setFurnitureCategory(category);
    });
  });

  wallVisibilityButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      setWallVisibility(btn.dataset.wallMode);
    });
  });

  if (togglePetBtn && typeof setPetEnabled === "function") {
    let petOn = true;
    const refreshPetButton = () => {
      togglePetBtn.textContent = petOn ? "隐藏宠物" : "召唤宠物";
    };
    refreshPetButton();

    togglePetBtn.addEventListener("click", () => {
      petOn = !petOn;
      setPetEnabled(petOn);
      refreshPetButton();
    });
  }

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

    // 性格面板：從 simNeeds.personality 讀取並寫回
    function computeTraitBasedSliderValues(selectedTraits) {
      const result = {};
      PERSONALITY_ACTION_KEYS.forEach(action => {
        result[action] = 1;
      });
      if (Array.isArray(selectedTraits)) {
        selectedTraits.forEach(trait => {
          const effects = TRAIT_PREF_EFFECTS[trait];
          if (!effects) return;
          Object.keys(effects).forEach(action => {
            if (!Object.prototype.hasOwnProperty.call(result, action)) return;
            const delta = effects[action];
            if (typeof delta === "number" && Number.isFinite(delta)) {
              result[action] += delta;
            }
          });
        });
      }
      PERSONALITY_ACTION_KEYS.forEach(action => {
        let v = result[action];
        if (typeof v !== "number" || !Number.isFinite(v)) v = 1;
        if (v < 0) v = 0;
        if (v > 2) v = 2;
        result[action] = v;
      });
      return result;
    }

    function applySliderValuesFromObject(values) {
      if (!values) return;
      personalityPrefSliders.forEach(slider => {
        const action = slider.dataset.action;
        if (!action) return;
        let v = values[action];
        if (typeof v !== "number" || !Number.isFinite(v)) v = 1;
        if (v < 0) v = 0;
        if (v > 2) v = 2;
        slider.value = String(v);
        const label = personalityPrefValueLabels.find(
          span => span.dataset.action === action
        );
        if (label) {
          label.textContent = v.toFixed(2);
        }
      });
    }

    function applySlidersToSimNeeds() {
      if (!simNeeds.setPersonalityInteractionPreference) return;
      const prefs = {};
      personalityPrefSliders.forEach(slider => {
        const action = slider.dataset.action;
        if (!action) return;
        const sliderVal = Number(slider.value);
        if (!Number.isFinite(sliderVal)) return;
        const internal = (sliderVal - 1) * 2; // [0,2] -> [-2,2]，1 為中立
        prefs[action] = internal;
      });
      simNeeds.setPersonalityInteractionPreference(prefs);
    }

    function syncPersonalityPanel() {
      if (!personalityPanel || !simNeeds.getPersonality) return;
      const p = simNeeds.getPersonality();
      if (!p) return;

      if (Array.isArray(p.traits)) {
        const traitSet = new Set(p.traits.map(String));
        personalityTraitCheckboxes.forEach(cb => {
          cb.checked = traitSet.has(cb.value);
        });
      }

      const selectedTraits = Array.isArray(p.traits)
        ? p.traits.map(String)
        : [];

      let hasNonZeroPref = false;
      const valuesFromPersonality = {};

      if (p.interactionPreference) {
        personalityPrefSliders.forEach(slider => {
          const action = slider.dataset.action;
          if (!action) return;
          const internal = p.interactionPreference[action];
          if (typeof internal === "number" && internal !== 0) {
            let sliderVal = 1 + internal / 2;
            if (!Number.isFinite(sliderVal)) sliderVal = 1;
            if (sliderVal < 0) sliderVal = 0;
            if (sliderVal > 2) sliderVal = 2;
            valuesFromPersonality[action] = sliderVal;
            hasNonZeroPref = true;
          }
        });
      }

      let finalValues;
      if (hasNonZeroPref) {
        finalValues = {};
        PERSONALITY_ACTION_KEYS.forEach(action => {
          if (
            Object.prototype.hasOwnProperty.call(valuesFromPersonality, action)
          ) {
            finalValues[action] = valuesFromPersonality[action];
          } else {
            finalValues[action] = 1;
          }
        });
      } else {
        finalValues = computeTraitBasedSliderValues(selectedTraits);
      }

      applySliderValuesFromObject(finalValues);
    }

    if (personalityPanel) {
      personalityTraitCheckboxes.forEach(cb => {
        cb.addEventListener("change", () => {
          const selected = personalityTraitCheckboxes
            .filter(x => x.checked)
            .map(x => x.value);
          if (simNeeds.setPersonalityTraits) {
            simNeeds.setPersonalityTraits(selected);
          }
          const values = computeTraitBasedSliderValues(selected);
          applySliderValuesFromObject(values);
          applySlidersToSimNeeds();
        });
      });

      personalityPrefSliders.forEach(slider => {
        const action = slider.dataset.action;
        const label = personalityPrefValueLabels.find(
          span => span.dataset.action === action
        );
        slider.addEventListener("input", () => {
          const v = Number(slider.value);
          if (label) {
            label.textContent = Number.isFinite(v) ? v.toFixed(2) : "1.00";
          }
        });
        slider.addEventListener("change", () => {
          applySlidersToSimNeeds();
        });
      });

      // 提供給 live-mode.js 點擊小人時呼叫
      window.togglePersonalityPanelFromSimClick = () => {
        if (!personalityPanel) return;
        const willShow = !personalityPanel.classList.contains("visible");
        if (willShow) {
          syncPersonalityPanel();
          personalityPanel.classList.add("visible");
        } else {
          personalityPanel.classList.remove("visible");
        }
      };
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
