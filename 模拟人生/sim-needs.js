// 需求與心情與性格狀態與邏輯，供 live-mode 使用

const NEED_KEYS = ["social", "sleep", "hunger", "bladder", "fun", "hygiene"];

let needs = {
  social: 100,
  sleep: 100,
  hunger: 100,
  bladder: 100,
  fun: 100,
  hygiene: 100
};

let needsTickEnabled = true;
let moodAuto = "开心";
let moodOverride = null;

// 簡單性格與喜好系統
// traits: ["愛玩","宅","愛社交","內向","貪吃","愛乾淨","工作狂","愛睡覺","邋遢"]
let personality = {
  traits: ["愛玩"],
  // 不同需求在主觀上的重要性權重
  needBias: {
    social: 1.0,
    sleep: 1.0,
    hunger: 1.0,
    bladder: 1.0,
    fun: 1.0,
    hygiene: 1.0
  },
  // 對具體互動的偏好分數：正數喜歡，負數討厭
  interactionPreference: {
    tv_watch: 0,
    sleep: 0,
    eat_food: 0,
    wash_sink: 0,
    use_toilet: 0,
    social: 0
  },
  moodSensitivity: 1.0, // 心情影響行為的強度
  refusalTendency: 0.0 // 額外拒絕傾向（負數代表更願意配合）
};

// 每秒基礎衰減速度（大約幾分鐘才會從 100 掉到 0）
const NEED_DECAY_PER_SEC = {
  social: 0.18,
  sleep: 0.14,
  hunger: 0.2,
  bladder: 0.22,
  fun: 0.18,
  hygiene: 0.16
};

// 在對應互動中額外回復速度
const NEED_RECOVERY_PER_SEC = {
  sleep: 1.2,
  hunger: 1.2,
  bladder: 1.4,
  fun: 1.0,
  hygiene: 1.0
};

// 需求面板 DOM
let needsPanelElement = null;
let needsPanelBodyElement = null;
let needsPanelCollapsed = false;
let moodTextElement = null;
const needBarElements = {};
const needValueElements = {};

function clampNeedValue(v) {
  return Math.max(0, Math.min(100, v));
}

function applyNeedDelta(name, delta) {
  if (!needs || !Object.prototype.hasOwnProperty.call(needs, name)) return;
  const current = typeof needs[name] === "number" ? needs[name] : 0;
  needs[name] = clampNeedValue(current + delta);
}

function updateMoodFromNeeds() {
  const info = getLowestNeedInfo();
  const minNeed = info && typeof info.value === "number" ? info.value : 0;
  let label = "开心";
  if (minNeed >= 80) label = "非常开心";
  else if (minNeed >= 60) label = "开心";
  else if (minNeed >= 40) label = "一般";
  else if (minNeed >= 20) label = "不舒服";
  else label = "崩溃中";
  moodAuto = label;
}

function getCurrentMoodLabel() {
  return moodOverride || moodAuto;
}

function getLowestNeedInfo() {
  if (!needs || !NEED_KEYS || !NEED_KEYS.length) return null;

  let minNeed = 100;
  let minKey = null;
  NEED_KEYS.forEach(key => {
    const raw = typeof needs[key] === "number" ? needs[key] : 0;
    const v = clampNeedValue(raw);
    if (v < minNeed) {
      minNeed = v;
      minKey = key;
    }
  });

  if (!minKey) return null;
  return { key: minKey, value: minNeed };
}

// 根據當前最低需求值，計算一個行為用的心情倍率（影響移動速度/走路幅度）
function getMoodSpeedMultiplier() {
  const info = getLowestNeedInfo();
  const minNeed = info && typeof info.value === "number" ? info.value : 100;

  // 和文字心情對應：非常開心 / 開心 / 一般 / 不舒服 / 崩潰中
  if (minNeed >= 80) return 1.25; // 非常開心：走路更快、更有活力
  if (minNeed >= 60) return 1.0; // 開心：正常速度
  if (minNeed >= 40) return 0.85; // 一般：略微放慢
  if (minNeed >= 20) return 0.7; // 不舒服：明顯變慢
  return 0.55; // 崩潰中：很慢
}

function initNeedsUI() {
  if (needsPanelElement) return;
  const panel = document.getElementById("needsPanel");
  if (!panel) return;

  needsPanelElement = panel;
  needsPanelBodyElement = document.getElementById("needsPanelBody");
  moodTextElement = document.getElementById("moodText");

  const header = document.getElementById("needsPanelHeader");
  if (header && needsPanelBodyElement) {
    header.addEventListener("click", () => {
      needsPanelCollapsed = !needsPanelCollapsed;
      needsPanelElement.classList.toggle("collapsed", needsPanelCollapsed);
    });
  }

  NEED_KEYS.forEach(key => {
    const barId = `need-${key}-bar`;
    const valueId = `need-${key}-value`;
    needBarElements[key] = document.getElementById(barId);
    needValueElements[key] = document.getElementById(valueId);
  });

  updateNeedsUI();
}

function updateNeedsUI() {
  if (!needsPanelElement) {
    initNeedsUI();
    if (!needsPanelElement) return;
  }

  if (moodTextElement) {
    moodTextElement.textContent = getCurrentMoodLabel();
  }

  NEED_KEYS.forEach(key => {
    const raw = typeof needs[key] === "number" ? needs[key] : 0;
    const v = clampNeedValue(raw);
    const bar = needBarElements[key];
    const label = needValueElements[key];
    if (bar) {
      bar.style.width = `${v}%`;
      if (v >= 60) bar.style.background = "#4caf50";
      else if (v >= 30) bar.style.background = "#ffc107";
      else bar.style.background = "#f44336";
    }
    if (label) {
      label.textContent = `${Math.round(v)}`;
    }
  });
}

function tickNeeds(delta, interactionState, sleepingWithLightOn) {
  if (!needsTickEnabled) return;

  // 基礎衰減
  NEED_KEYS.forEach(key => {
    const rate = NEED_DECAY_PER_SEC[key] || 0;
    if (rate > 0) {
      applyNeedDelta(key, -rate * delta);
    }
  });

  // 互動中的回復
  if (interactionState === "sleep" || interactionState === "sleep_enter") {
    let sleepRate = NEED_RECOVERY_PER_SEC.sleep || 0;
    if (sleepingWithLightOn) {
      sleepRate *= 0.5;
    }
    applyNeedDelta("sleep", sleepRate * delta);
  }
  if (interactionState === "eat_food") {
    applyNeedDelta("hunger", (NEED_RECOVERY_PER_SEC.hunger || 0) * delta);
  }
  if (
    interactionState === "tv_watch" ||
    interactionState === "sofa_sit" ||
    interactionState === "pillow_fight"
  ) {
    applyNeedDelta("fun", (NEED_RECOVERY_PER_SEC.fun || 0) * delta);
  }
  if (interactionState === "sink_wash") {
    applyNeedDelta("hygiene", (NEED_RECOVERY_PER_SEC.hygiene || 0) * delta);
  }
  if (interactionState === "toilet_use") {
    applyNeedDelta("bladder", (NEED_RECOVERY_PER_SEC.bladder || 0) * delta);
  }

  updateMoodFromNeeds();
  updateNeedsUI();
}

function getNeedsSnapshot() {
  const result = {};
  NEED_KEYS.forEach(key => {
    result[key] = typeof needs[key] === "number" ? clampNeedValue(needs[key]) : 0;
  });
  return result;
}

function setNeedValue(name, value) {
  if (!Object.prototype.hasOwnProperty.call(needs, name)) return;
  const v = Number(value);
  if (!Number.isFinite(v)) return;
  needs[name] = clampNeedValue(v);
  updateMoodFromNeeds();
  updateNeedsUI();
}

function addNeedValue(name, delta) {
  if (!Object.prototype.hasOwnProperty.call(needs, name)) return;
  const d = Number(delta);
  if (!Number.isFinite(d)) return;
  applyNeedDelta(name, d);
  updateMoodFromNeeds();
  updateNeedsUI();
}

function setAllNeeds(values) {
  if (!values) return;
  NEED_KEYS.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      const v = Number(values[key]);
      if (Number.isFinite(v)) {
        needs[key] = clampNeedValue(v);
      }
    }
  });
  updateMoodFromNeeds();
  updateNeedsUI();
}

function setMoodOverride(label) {
  if (label == null) {
    moodOverride = null;
  } else {
    moodOverride = String(label);
  }
  updateNeedsUI();
}

function clearMoodOverride() {
  moodOverride = null;
  updateNeedsUI();
}

function getPersonalityNeedPriority(key, rawNeedValue) {
  const v = clampNeedValue(typeof rawNeedValue === "number" ? rawNeedValue : 0);
  const bias =
    personality &&
    personality.needBias &&
    typeof personality.needBias[key] === "number"
      ? personality.needBias[key]
      : 1.0;
  // 需求越低越急迫，乘上性格偏好權重
  return (100 - v) * bias;
}

function getInteractionPreferenceScore(actionId) {
  if (!personality || !personality.interactionPreference) return 0;
  const v = personality.interactionPreference[actionId];
  return typeof v === "number" ? v : 0;
}

function getPersonalityAdjustedRefuseChance(baseChance, actionId) {
  let chance = baseChance;
  const pref = getInteractionPreferenceScore(actionId);
  const refusal =
    personality && typeof personality.refusalTendency === "number"
      ? personality.refusalTendency
      : 0;

  // 喜歡的行為：降低拒絕機率；討厭的行為：提高拒絕機率
  if (pref > 0) {
    chance *= 1 - Math.min(0.6, pref * 0.15);
  } else if (pref < 0) {
    chance = 1 - (1 - chance) * (1 - Math.min(0.6, -pref * 0.15));
  }

  // 全局性格傾向
  chance += refusal * 0.15;

  return Math.max(0, Math.min(1, chance));
}

function setNeedsTickEnabled(enabled) {
  needsTickEnabled = !!enabled;
}

if (typeof window !== "undefined") {
  window.simNeeds = {
    get: getNeedsSnapshot,
    set: setNeedValue,
    add: addNeedValue,
    setAll: setAllNeeds,
    setMood: setMoodOverride,
    clearMood: clearMoodOverride,
    pause: () => setNeedsTickEnabled(false),
    resume: () => setNeedsTickEnabled(true),
    enableTick: setNeedsTickEnabled,
    // 性格相關：可在控制台調整
    getPersonality: () => personality,
    setPersonalityTraits: traits => {
      if (Array.isArray(traits)) personality.traits = traits.map(String);
    },
    setPersonalityNeedBias: bias => {
      if (!bias || typeof bias !== "object") return;
      Object.keys(personality.needBias).forEach(key => {
        if (Object.prototype.hasOwnProperty.call(bias, key)) {
          const v = Number(bias[key]);
          if (Number.isFinite(v)) personality.needBias[key] = v;
        }
      });
    },
    setPersonalityInteractionPreference: prefs => {
      if (!prefs || typeof prefs !== "object") return;
      Object.keys(personality.interactionPreference).forEach(key => {
        if (Object.prototype.hasOwnProperty.call(prefs, key)) {
          const v = Number(prefs[key]);
          if (Number.isFinite(v)) personality.interactionPreference[key] = v;
        }
      });
    },
    setPersonalityRefusalTendency: value => {
      const v = Number(value);
      if (Number.isFinite(v)) personality.refusalTendency = v;
    }
  };
}

export {
  NEED_KEYS,
  getCurrentMoodLabel,
  getMoodSpeedMultiplier,
  getPersonalityNeedPriority,
  getInteractionPreferenceScore,
  getPersonalityAdjustedRefuseChance,
  tickNeeds,
  getNeedsSnapshot,
  setNeedValue,
  addNeedValue,
  setAllNeeds,
  setMoodOverride,
  clearMoodOverride,
  setNeedsTickEnabled
};
