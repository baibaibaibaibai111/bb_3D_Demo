function getWomanRig(character) {
  if (!character || !character.userData) return null;
  return character.userData.womanRig || null;
}

function resetWomanRigPose(rig) {
  if (!rig) return;
  const keys = [
    "hips",
    "spine",
    "head",
    "leftUpperArm",
    "rightUpperArm",
    "leftLowerArm",
    "rightLowerArm",
    "leftUpperLeg",
    "rightUpperLeg",
    "leftLowerLeg",
    "rightLowerLeg"
  ];
  keys.forEach(key => {
    const bone = rig[key];
    const base = rig[key + "BaseRot"];
    if (bone && base) {
      bone.rotation.copy(base);
    }
  });
}

function applyWomanWalkPose(rig, walkPhase, moodFactor, isRunning) {
  if (!rig) return;
  resetWomanRigPose(rig);
  const amp = (isRunning ? 0.9 : 0.5) * moodFactor;
  const phase = walkPhase;

  // 走路 vs 跑步：跑步時手腿擺動與膝蓋彎曲更大
  const armSwingAmp = amp * (isRunning ? 0.9 : 0.5);
  const legSwingAmp = amp * (isRunning ? 0.9 : 0.5);

  // 手臂左右相反、與腿相位相反的前後擺動
  const armSwing = Math.sin(phase) * armSwingAmp;
  const legSwing = Math.sin(phase + Math.PI) * legSwingAmp; // 腿的相位和手臂相反

  if (rig.leftUpperArm) rig.leftUpperArm.rotation.z += armSwing;
  if (rig.rightUpperArm) rig.rightUpperArm.rotation.z -= armSwing;

  if (rig.leftUpperLeg) rig.leftUpperLeg.rotation.z += legSwing;
  if (rig.rightUpperLeg) rig.rightUpperLeg.rotation.z -= legSwing;

  // 輕微的骨盆 / 脊柱扭動，讓上半身不那麼僵硬
  const torsoTwist = Math.cos(phase * 2) * 0.05 * amp;
  if (rig.hips) rig.hips.rotation.y += torsoTwist;
  if (rig.spine) rig.spine.rotation.y -= torsoTwist;

  // 讓上半身在行走 / 跑步時略微前傾：跑步前傾更多一些
  const forwardLean = isRunning ? 0.16 : 0.12;
  if (rig.spine) rig.spine.rotation.z += forwardLean;
  if (rig.hips) rig.hips.rotation.z += forwardLean * 0.3;

  // 跑步時手肘明顯彎曲，走路時只略微彎曲
  const elbowBend = isRunning ? 1.0 : 0.15;
  if (rig.leftLowerArm) rig.leftLowerArm.rotation.z += elbowBend;
  if (rig.rightLowerArm) rig.rightLowerArm.rotation.z -= elbowBend;

  // 膝蓋交替彎曲：左右腿在不同相位彎曲
  // 步伐縮小後，膝蓋彎曲幅度也略微收斂
  const kneeAmp = isRunning ? 0.8 : 0.5;
  const leftKneeBend = Math.max(0, Math.sin(phase + Math.PI / 2)) * kneeAmp;
  const rightKneeBend = Math.max(0, Math.sin(phase - Math.PI / 2)) * kneeAmp;
  if (rig.leftLowerLeg) rig.leftLowerLeg.rotation.z -= leftKneeBend;
  if (rig.rightLowerLeg) rig.rightLowerLeg.rotation.z -= rightKneeBend;

  // 較溫和的左右平衡：只用輕微旋轉，不改 position.x，避免正面視角明顯左右搖晃
  const sway = Math.sin(walkPhase * 2) * 0.02 * amp;
  if (rig.hips) {
    rig.hips.rotation.y += sway * 0.3;
  }
  if (rig.spine) {
    rig.spine.rotation.y -= sway * 0.3;
  }

  // 肩部反向擺動：幅度壓得更小，只作細微平衡
  const shoulderSway = Math.sin(walkPhase * 2 + Math.PI) * 0.01 * amp;
  if (rig.spine) rig.spine.rotation.y -= shoulderSway;
}

function applyWomanIdlePose(rig, t) {
  if (!rig) return;
  resetWomanRigPose(rig);
  const sway = Math.sin(t * 1.5) * 0.05;
  if (rig.spine) rig.spine.rotation.z += sway * 0.3;
  if (rig.head) rig.head.rotation.z -= sway * 0.3;
}

function applyWomanSitPose(rig, legBend) {
  if (!rig) return;
  resetWomanRigPose(rig);
  const bend = legBend || 0;
  if (rig.leftUpperLeg) rig.leftUpperLeg.rotation.x += bend;
  if (rig.rightUpperLeg) rig.rightUpperLeg.rotation.x += bend;
  if (rig.leftLowerLeg) rig.leftLowerLeg.rotation.x += -bend * 0.7;
  if (rig.rightLowerLeg) rig.rightLowerLeg.rotation.x += -bend * 0.7;
}

function applyWomanSleepPose(rig, breathe) {
  if (!rig) return;
  resetWomanRigPose(rig);
  const b = breathe || 0;
  if (rig.spine) rig.spine.rotation.x += b * 1.5;
  if (rig.head) rig.head.rotation.x += b;
}

function applyWomanPillowFightPose(rig, bounce, armSwing, legSwing) {
  if (!rig) return;
  resetWomanRigPose(rig);
  const a = armSwing || 0;
  const l = legSwing || 0;
  if (rig.leftUpperArm) rig.leftUpperArm.rotation.x += a;
  if (rig.rightUpperArm) rig.rightUpperArm.rotation.x += -a;
  if (rig.leftUpperLeg) rig.leftUpperLeg.rotation.x += -l * 0.5;
  if (rig.rightUpperLeg) rig.rightUpperLeg.rotation.x += l * 0.5;
}

function applyWomanRidePose(rig, ridePhase, moodFactor) {
  if (!rig) return;
  resetWomanRigPose(rig);

  const phase = ridePhase || 0;
  // 弯腰程度由 forwardLean 控制，前後趴在豹子背上
  const forwardLeanBase = 0;
  const forwardLean = forwardLeanBase + 0.1 * moodFactor;

  // 由於這個模型的骨骼局部軸本身有一點傾斜，
  // 單純繞 Z 軸前後彎會帶出一點左右歪。
  // 這裡根據 forwardLean 自動加上一小段 X 軸旋轉來「拉正」，
  // 你只需要調整 forwardLeanBase，不用再手動算抵消角度。
  const spineSideFromForward = -0.6 * forwardLean;
  const hipsSideFromForward = -0.4 * forwardLean;
  const headSideFromForward = -0.2 * forwardLean;

  if (rig.spine) {
    //胸、上背
    rig.spine.rotation.z += forwardLean * 1.0;      // 前後趴
    rig.spine.rotation.x += spineSideFromForward;   // 自動校正左右歪
  }
  if (rig.hips) {
    //骨盆、腰、屁股
    rig.hips.rotation.z += forwardLean * 0.6;
    rig.hips.rotation.x += hipsSideFromForward;
  }
  if (rig.head) {
    // 頭也略微前傾，配合整體趴伏姿勢
    rig.head.rotation.z += forwardLean * 0.25;
    rig.head.rotation.x += headSideFromForward;
  }

  const armForward = 0.8;
  if (rig.leftUpperArm) rig.leftUpperArm.rotation.z -= armForward;
  if (rig.rightUpperArm) rig.rightUpperArm.rotation.z -= armForward;

  const elbowBend = 1.0;
  if (rig.leftLowerArm) rig.leftLowerArm.rotation.z -= elbowBend;
  if (rig.rightLowerArm) rig.rightLowerArm.rotation.z -= elbowBend;

  const thighForward = 0.35;
  const thighSpread = 0.4; // 大腿左右張開角度，數值越小越內收，越大越外展
  if (rig.leftUpperLeg) {
    rig.leftUpperLeg.rotation.z += thighForward;
    // 大腿沿 X 軸張開：左腿往左側
    rig.leftUpperLeg.rotation.x -= thighSpread;
  }
  if (rig.rightUpperLeg) {
    rig.rightUpperLeg.rotation.z += thighForward;
    // 大腿沿 X 軸張開：右腿往右側
    rig.rightUpperLeg.rotation.x += thighSpread;
  }

  const kneeBend = 1.1;
  if (rig.leftLowerLeg) {
    rig.leftLowerLeg.rotation.z -= kneeBend;
    // 小腿往身體內側旋轉，貼近豹子腹部
    rig.leftLowerLeg.rotation.x += 0.001;
  }
  if (rig.rightLowerLeg) {
    rig.rightLowerLeg.rotation.z -= kneeBend;
    rig.rightLowerLeg.rotation.x -= 0.001;
  }
}

function updateCharacterAnimation(
  character,
  delta,
  moodFactor,
  movedThisFrame,
  interactionState,
  interactionTimer,
  sleepTarget,
  walkPhase,
  getBedHeadYaw,
  getSleepHeadWorldPosition,
  enterSleepPose,
  resetCharacterPose,
  updateNeedsAndMood,
  isRunning,
  isRidingPet
) {
  const body = character.userData && character.userData.body;
  const head = character.userData && character.userData.head;
  const leftArm = character.userData && character.userData.leftArm;
  const rightArm = character.userData && character.userData.rightArm;
  const leftLeg = character.userData && character.userData.leftLeg;
  const rightLeg = character.userData && character.userData.rightLeg;
  const womanRig = getWomanRig(character);

  if (interactionState === "sleep_enter") {
    interactionTimer += delta;
    const enterDuration = 1.2;
    const t = Math.min(1, interactionTimer / enterDuration);

    if (sleepTarget && sleepTarget.furniture) {
      const furn = sleepTarget.furniture;
      const furnRot = sleepTarget.furnRot;
      const yawSit = furnRot;
      const yawLie = getBedHeadYaw(furn) + Math.PI;

      const centerX = furn.position.x;
      const centerZ = furn.position.z;
      const headPos = getSleepHeadWorldPosition(furn);
      const dirX = Math.sin(furnRot);
      const dirZ = Math.cos(furnRot);
      const edgeOffset = 0.9;
      const edgeX = centerX + dirX * edgeOffset;
      const edgeZ = centerZ + dirZ * edgeOffset;

      const seatY = 0.35;
      const lieY = 0.45;

      const split = 0.4;
      if (t < split) {
        const k = t / split;

        character.position.x = edgeX;
        character.position.z = edgeZ;
        character.position.y = seatY * k;
        character.rotation.set(0, yawSit, 0);

        const legBend = -Math.PI * 0.7 * k;
        if (leftLeg) leftLeg.rotation.x = legBend;
        if (rightLeg) rightLeg.rotation.x = legBend;
        if (leftArm) leftArm.rotation.x = 0;
        if (rightArm) rightArm.rotation.x = 0;
      } else {
        const u = (t - split) / (1 - split);

        character.position.x = edgeX + (headPos.x - edgeX) * u;
        character.position.z = edgeZ + (headPos.z - edgeZ) * u;
        character.position.y = seatY + (headPos.y - seatY) * u;

        const pitch = (Math.PI / 2) * u;
        const yaw = yawSit + (yawLie - yawSit) * u;
        character.rotation.set(pitch, yaw, 0);

        if (body) body.rotation.set(0, 0, 0);
        if (head) head.rotation.set(0, 0, 0);

        const legBend = -Math.PI * 0.7 * (1 - u);
        if (leftLeg) leftLeg.rotation.x = legBend;
        if (rightLeg) rightLeg.rotation.x = legBend;
        if (leftArm) leftArm.rotation.x = 0;
        if (rightArm) rightArm.rotation.x = 0;
      }
    }

    if (t >= 1) {
      if (sleepTarget && sleepTarget.furniture) {
        enterSleepPose(sleepTarget.furniture, sleepTarget.furnRot);
      }
      sleepTarget = null;
    }
    updateNeedsAndMood(delta);
    return { interactionState, interactionTimer, sleepTarget, walkPhase };
  }

  if (interactionState === "sleep") {
    interactionTimer += delta;
    const breathe = Math.sin(interactionTimer * 1.5) * 0.02;
    const baseBodyY = character.userData && character.userData.baseBodyY;
    const baseHeadY = character.userData && character.userData.baseHeadY;
    if (body && typeof baseBodyY === "number") {
      body.position.y = baseBodyY + breathe;
    }
    if (head && typeof baseHeadY === "number") {
      head.position.y = baseHeadY + breathe * 0.6;
    }
    if (leftArm) leftArm.rotation.x = 0;
    if (rightArm) rightArm.rotation.x = 0;
    if (leftLeg) leftLeg.rotation.x = 0;
    if (rightLeg) rightLeg.rotation.x = 0;
    if (womanRig) applyWomanSleepPose(womanRig, breathe);
    updateNeedsAndMood(delta);
    return { interactionState, interactionTimer, sleepTarget, walkPhase };
  }

  if (interactionState === "sit_edge") {
    interactionTimer += delta;
    const idle = Math.sin(interactionTimer * 2) * 0.02;
    const baseBodyY = character.userData && character.userData.baseBodyY;
    const baseHeadY = character.userData && character.userData.baseHeadY;
    if (body && typeof baseBodyY === "number") {
      body.position.y = baseBodyY + idle;
    }
    if (head && typeof baseHeadY === "number") {
      head.position.y = baseHeadY + idle * 0.5;
    }
    if (leftArm) leftArm.rotation.x = 0;
    if (rightArm) rightArm.rotation.x = 0;
    if (leftLeg) leftLeg.rotation.x = -Math.PI * 0.7 * 0.5;
    if (rightLeg) rightLeg.rotation.x = -Math.PI * 0.7 * 0.5;
    if (womanRig) applyWomanSitPose(womanRig, -Math.PI * 0.7 * 0.5);
    updateNeedsAndMood(delta);
    return { interactionState, interactionTimer, sleepTarget, walkPhase };
  }

  if (interactionState === "sofa_sit") {
    interactionTimer += delta;
    const idle = Math.sin(interactionTimer * 2) * 0.02;
    const baseBodyY = character.userData && character.userData.baseBodyY;
    const baseHeadY = character.userData && character.userData.baseHeadY;
    if (body && typeof baseBodyY === "number") {
      body.position.y = baseBodyY + idle;
    }
    if (head && typeof baseHeadY === "number") {
      head.position.y = baseHeadY + idle * 0.5;
    }
    if (leftArm) leftArm.rotation.x = 0;
    if (rightArm) rightArm.rotation.x = 0;
    if (leftLeg) leftLeg.rotation.x = -Math.PI * 0.7 * 0.5;
    if (rightLeg) rightLeg.rotation.x = -Math.PI * 0.7 * 0.5;
    if (womanRig) applyWomanSitPose(womanRig, -Math.PI * 0.7 * 0.5);
    updateNeedsAndMood(delta);
    return { interactionState, interactionTimer, sleepTarget, walkPhase };
  }

  if (interactionState === "pillow_fight") {
    interactionTimer += delta;
    const bounce = Math.abs(Math.sin(interactionTimer * 6)) * 0.04;
    const armSwing = Math.sin(interactionTimer * 10) * 1.0;
    const legSwing = Math.cos(interactionTimer * 8) * 0.4;
    const baseBodyY = character.userData && character.userData.baseBodyY;
    const baseHeadY = character.userData && character.userData.baseHeadY;
    if (body && typeof baseBodyY === "number") {
      body.position.y = baseBodyY + bounce;
    }
    if (head && typeof baseHeadY === "number") {
      head.position.y = baseHeadY + bounce * 0.6;
    }
    if (leftArm) leftArm.rotation.x = armSwing;
    if (rightArm) rightArm.rotation.x = -armSwing;
    if (leftLeg) leftLeg.rotation.x = -legSwing * 0.5;
    if (rightLeg) rightLeg.rotation.x = legSwing * 0.5;
    if (womanRig) applyWomanPillowFightPose(womanRig, bounce, armSwing, legSwing);

    if (interactionTimer > 3) {
      interactionState = null;
      interactionTimer = 0;
      resetCharacterPose();
    }
    updateNeedsAndMood(delta);
    return { interactionState, interactionTimer, sleepTarget, walkPhase };
  }

  if (movedThisFrame) {
    // 調整走路 / 跑步 / 騎乘動畫頻率：跑步和騎乘稍快於走路
    const baseFreq = isRunning || isRidingPet ? 11 : 7;
    walkPhase += delta * baseFreq * moodFactor;
  } else {
    walkPhase = Math.max(0, walkPhase - delta * 10);
  }

  const walkAmount = Math.sin(walkPhase) * 0.05;
  if (body) {
    body.position.y = 0.5 + walkAmount * moodFactor;
  }
  if (head) {
    head.position.y = 1.1 + walkAmount * 0.6 * moodFactor;
  }

  const swing = Math.sin(walkPhase) * 0.4 * moodFactor;
  const legSwing = -swing * 0.6;

  // 舊方塊小人的走路備援動畫（僅在沒有 womanRig 時使用）
  if (!womanRig && leftArm && rightArm) {
    leftArm.rotation.x = swing;
    rightArm.rotation.x = -swing;
  }

  if (!womanRig && leftLeg && rightLeg) {
    leftLeg.rotation.x = legSwing;
    rightLeg.rotation.x = -legSwing;
  }

  if (womanRig) {
    if (isRidingPet) {
      applyWomanRidePose(womanRig, walkPhase, moodFactor);
    } else if (movedThisFrame || Math.abs(walkPhase) > 0.001) {
      applyWomanWalkPose(womanRig, walkPhase, moodFactor, isRunning);
    } else {
      applyWomanIdlePose(womanRig, interactionTimer || 0);
    }
  }

  updateNeedsAndMood(delta);

  return { interactionState, interactionTimer, sleepTarget, walkPhase };
}

export { updateCharacterAnimation };
