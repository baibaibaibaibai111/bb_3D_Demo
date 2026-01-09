let interactionMenuElement = null;

function getInteractionMenuElement() {
  if (interactionMenuElement) return interactionMenuElement;
  const div = document.createElement("div");
  div.id = "interactionMenu";
  div.style.position = "fixed";
  div.style.zIndex = "1000";
  div.style.background = "rgba(0, 0, 0, 0.85)";
  div.style.color = "#fff";
  div.style.fontSize = "12px";
  div.style.borderRadius = "4px";
  div.style.padding = "4px";
  div.style.minWidth = "80px";
  div.style.display = "none";
  document.body.appendChild(div);
  interactionMenuElement = div;
  return interactionMenuElement;
}

function hideInteractionMenu() {
  if (interactionMenuElement) {
    interactionMenuElement.style.display = "none";
    interactionMenuElement.innerHTML = "";
  }
}

function showInteractionMenuForFurniture(furniture, clientX, clientY, onInteraction) {
  const type = furniture.userData && furniture.userData.type;
  const menu = getInteractionMenuElement();
  menu.innerHTML = "";
  const options = [];

  if (type === "bed") {
    options.push(
      { id: "sleep", label: "上床睡觉" },
      { id: "sit_edge", label: "坐在床边" },
      { id: "pillow_fight", label: "枕头大战（占位）" }
    );
  } else if (type === "sofa") {
    options.push({ id: "sofa_sit", label: "坐在沙发上" });
  } else if (type === "tv") {
    options.push({ id: "tv_watch", label: "看电视" });
  } else if (type === "food") {
    options.push({ id: "eat_food", label: "吃掉" });
  } else if (type === "toilet") {
    options.push({ id: "use_toilet", label: "上厕所" });
  } else if (type === "sink") {
    options.push({ id: "wash_sink", label: "洗漱" });
  } else if (type === "fridge") {
    options.push({ id: "fridge_eat", label: "从冰箱拿东西吃" });
  } else if (type === "guitar") {
    options.push({ id: "play_guitar", label: "弹吉他" });
  } else if (type === "computerDesk") {
    options.push({ id: "use_computer", label: "使用电脑" });
  } else if (type === "shower") {
    options.push({ id: "shower_wash", label: "淋浴" });
  } else if (type === "bathtub") {
    options.push({ id: "bathtub_bath", label: "泡澡" });
  } else if (type === "door") {
    const d = furniture.userData || {};
    const isOpen = !!d.doorOpenTarget;
    options.push({ id: isOpen ? "door_close" : "door_open", label: isOpen ? "关门" : "开门" });
  } else if (type === "window") {
    const d = furniture.userData || {};
    const isOpen = !!d.windowOpenTarget;
    options.push({ id: isOpen ? "window_close" : "window_open", label: isOpen ? "关窗" : "开窗" });
  } else if (type === "ceilingLight") {
    const d = furniture.userData || {};
    const isOn = d.lightOn !== false;
    options.push({ id: isOn ? "light_off" : "light_on", label: isOn ? "关灯" : "开灯" });
  }

  if (!options.length) {
    return;
  }

  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.textContent = opt.label;
    btn.style.display = "block";
    btn.style.width = "100%";
    btn.style.margin = "2px 0";
    btn.style.padding = "2px 4px";
    btn.style.fontSize = "12px";
    btn.style.cursor = "pointer";
    btn.style.border = "1px solid #555";
    btn.style.borderRadius = "3px";
    btn.style.background = "#333";
    btn.addEventListener("click", () => {
      hideInteractionMenu();
      if (opt.id === "door_open") {
        if (!furniture.userData) furniture.userData = {};
        furniture.userData.doorOpenTarget = true;
      } else if (opt.id === "door_close") {
        if (!furniture.userData) furniture.userData = {};
        furniture.userData.doorOpenTarget = false;
      } else if (opt.id === "window_open") {
        if (!furniture.userData) furniture.userData = {};
        furniture.userData.windowOpenTarget = true;
      } else if (opt.id === "window_close") {
        if (!furniture.userData) furniture.userData = {};
        furniture.userData.windowOpenTarget = false;
      } else if (opt.id === "light_on") {
        if (!furniture.userData) furniture.userData = {};
        furniture.userData.lightOn = true;
        furniture.traverse(child => {
          if (child.isLight) {
            child.visible = true;
          }
          if (child.isMesh && child.material && child.material.emissive) {
            child.material.emissiveIntensity = 0.8;
          }
        });
      } else if (opt.id === "light_off") {
        if (!furniture.userData) furniture.userData = {};
        furniture.userData.lightOn = false;
        furniture.traverse(child => {
          if (child.isLight) {
            child.visible = false;
          }
          if (child.isMesh && child.material && child.material.emissive) {
            child.material.emissiveIntensity = 0.0;
          }
        });
      } else if (typeof onInteraction === "function") {
        onInteraction(furniture, opt.id);
      }
    });
    menu.appendChild(btn);
  });

  const padding = 4;
  menu.style.left = `${clientX + padding}px`;
  menu.style.top = `${clientY + padding}px`;
  menu.style.display = "block";
}

function showInteractionMenuForPet(pet, clientX, clientY, onInteraction) {
  const menu = getInteractionMenuElement();
  menu.innerHTML = "";

  const options = [
    { id: "pet_headpat", label: "摸摸头" },
    { id: "pet_feed", label: "投喂" },
    { id: "pet_hug", label: "拥抱" },
    { id: "pet_ride", label: "骑乘" }
  ];

  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.textContent = opt.label;
    btn.style.display = "block";
    btn.style.width = "100%";
    btn.style.margin = "2px 0";
    btn.style.padding = "2px 4px";
    btn.style.fontSize = "12px";
    btn.style.cursor = "pointer";
    btn.style.border = "1px solid #555";
    btn.style.borderRadius = "3px";
    btn.style.background = "#333";
    btn.addEventListener("click", () => {
      hideInteractionMenu();
      if (typeof onInteraction === "function") {
        onInteraction(pet, opt.id);
      }
    });
    menu.appendChild(btn);
  });

  const padding = 4;
  menu.style.left = `${clientX + padding}px`;
  menu.style.top = `${clientY + padding}px`;
  menu.style.display = "block";
}

export {
  getInteractionMenuElement,
  hideInteractionMenu,
  showInteractionMenuForFurniture,
  showInteractionMenuForPet
};
