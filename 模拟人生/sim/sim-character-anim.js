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
  updateNeedsAndMood
) {
  const body = character.userData && character.userData.body;
  const head = character.userData && character.userData.head;
  const leftArm = character.userData && character.userData.leftArm;
  const rightArm = character.userData && character.userData.rightArm;
  const leftLeg = character.userData && character.userData.leftLeg;
  const rightLeg = character.userData && character.userData.rightLeg;

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

    if (interactionTimer > 3) {
      interactionState = null;
      interactionTimer = 0;
      resetCharacterPose();
    }
    updateNeedsAndMood(delta);
    return { interactionState, interactionTimer, sleepTarget, walkPhase };
  }

  if (movedThisFrame) {
    walkPhase += delta * 10 * moodFactor;
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
  const counterSwing = Math.cos(walkPhase) * 0.4 * moodFactor;

  if (leftArm && rightArm) {
    leftArm.rotation.x = swing;
    rightArm.rotation.x = -swing;
  }

  if (leftLeg && rightLeg) {
    leftLeg.rotation.x = -counterSwing * 0.6;
    rightLeg.rotation.x = counterSwing * 0.6;
  }

  updateNeedsAndMood(delta);

  return { interactionState, interactionTimer, sleepTarget, walkPhase };
}

export { updateCharacterAnimation };
