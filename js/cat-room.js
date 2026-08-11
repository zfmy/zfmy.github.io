(() => {
  const room = document.querySelector('#room');
  const cat = document.querySelector('#cat');
  const catMotion = document.querySelector('#catMotion');
  const catWrap = document.querySelector('#catWrap');
  const wand = document.querySelector('#wand');
  const whisper = document.querySelector('#whisper');
  const status = document.querySelector('#catStatus');
  const motion = window.gsap || null;
  const hasGsap = Boolean(motion);

  if (hasGsap) room.classList.add('gsap-ready');

  const furs = ['orange', 'white', 'black', 'gray', 'calico', 'tabby'];
  const scenes = ['room', 'nook', 'garden', 'moon'];
  const worldStorageKey = 'mofu-world-v1';
  const furNames = { orange: 'orange cat', white: 'white cat', black: 'black cat', gray: 'gray cat', calico: 'calico cat', tabby: 'tabby cat' };
  const timeNames = { morning: 'Morning', day: 'Daytime', dusk: 'Dusk', night: 'Night', 'deep-night': 'Late night' };
  const skyStops = [
    { hour: 0, top: '#26324f', bottom: '#59647f' },
    { hour: 4, top: '#33415e', bottom: '#887a81' },
    { hour: 5, top: '#a66f70', bottom: '#e7ad83' },
    { hour: 7, top: '#8fb8bd', bottom: '#f4cf92' },
    { hour: 12, top: '#84bfd1', bottom: '#e8dda1' },
    { hour: 16, top: '#98c3c1', bottom: '#f2d29a' },
    { hour: 18.5, top: '#d98269', bottom: '#edb47a' },
    { hour: 20, top: '#4c526d', bottom: '#8b6b78' },
    { hour: 22, top: '#283a58', bottom: '#5d637b' },
    { hour: 24, top: '#26324f', bottom: '#59647f' }
  ];
  const actionClasses = ['is-pouncing', 'is-jumping', 'is-swiping', 'is-happy', 'is-turning', 'is-crouching', 'is-stretching', 'is-loafing', 'is-idle-stretch', 'is-idle-alert', 'is-idle-sniff', 'is-idle-yawn'];
  const poseSelectors = { front: '#cat-front', run: '#cat-run', crouch: '#cat-crouch', jump: '#cat-jump' };
  const actionPose = {
    'is-pouncing': 'crouch',
    'is-jumping': 'jump',
    'is-swiping': 'crouch',
    'is-happy': 'front',
    'is-turning': 'run',
    'is-crouching': 'crouch',
    'is-stretching': 'crouch',
    'is-loafing': 'front',
    'is-idle-stretch': 'crouch',
    'is-idle-alert': 'front',
    'is-idle-sniff': 'crouch',
    'is-idle-yawn': 'front'
  };
  const actionYaw = { 'is-pouncing': -3, 'is-jumping': 4, 'is-swiping': -3, 'is-happy': 3, 'is-turning': 6, 'is-crouching': -2, 'is-stretching': -2, 'is-loafing': 2, 'is-idle-stretch': -2, 'is-idle-alert': 3, 'is-idle-sniff': -2, 'is-idle-yawn': 2 };

  const catPosition = { x: innerWidth / 2, y: innerHeight * .57 };
  const catTarget = { x: innerWidth / 2, y: innerHeight * .57 };
  const catVelocity = { x: 0, y: 0 };
  const wandTarget = { x: innerWidth * .68, y: innerHeight * .34 };
  const lastPointer = { x: wandTarget.x, y: wandTarget.y, time: performance.now() };
  const recordedCatTarget = { x: catPosition.x, y: catPosition.y };
  const targetTrail = [];
  const followDelay = 280;
  let lastCatCenter = { x: innerWidth / 2, y: innerHeight * .57 };
  let isNear = false;
  let currentPose = null;
  let currentDirection = 1;
  let movementYaw = 0;
  let stopTimer = 0;
  let actionTimer = 0;
  let idleTimer = 0;
  let blinkTimer = 0;
  let leapTimer = 0;
  let playCount = 0;
  let lastLeapAt = performance.now();
  let lastFollowStep = 0;
  let hasRecordedTarget = false;
  let actionTimeline = null;
  let catMoveTween = null;
  let runTimeline = null;
  const idleTimelines = [];

  function getTimeOfDay(hour) {
    if (hour >= 5 && hour < 10) return 'morning';
    if (hour >= 10 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'dusk';
    if (hour >= 20 || hour < 0) return 'night';
    return 'deep-night';
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function mixHex(from, to, amount) {
    const read = (hex, index) => Number.parseInt(hex.slice(index, index + 2), 16);
    const channel = (start, end) => Math.round(start + (end - start) * amount).toString(16).padStart(2, '0');
    return `#${channel(read(from, 1), read(to, 1))}${channel(read(from, 3), read(to, 3))}${channel(read(from, 5), read(to, 5))}`;
  }

  function getSkyPalette(hour) {
    const upperIndex = skyStops.findIndex((stop) => stop.hour >= hour);
    const upper = skyStops[Math.max(1, upperIndex)];
    const lower = skyStops[Math.max(0, upperIndex - 1)];
    const amount = clamp((hour - lower.hour) / Math.max(.01, upper.hour - lower.hour), 0, 1);
    return { top: mixHex(lower.top, upper.top, amount), bottom: mixHex(lower.bottom, upper.bottom, amount) };
  }

  function updateEnvironment(date = new Date()) {
    const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
    const time = getTimeOfDay(hour);
    const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const dayProgress = clamp((hour - 5) / 15, 0, 1);
    const nightProgress = clamp((hour >= 20 ? hour - 20 : hour + 4) / 9, 0, 1);
    const isDaylight = hour >= 5 && hour < 20;
    const arcProgress = isDaylight ? dayProgress : nightProgress;
    const celestialX = 8 + arcProgress * 84;
    const celestialY = 72 - Math.sin(arcProgress * Math.PI) * 58;
    const sunOpacity = isDaylight ? clamp(Math.sin(dayProgress * Math.PI) * 2.2, 0, 1) : 0;
    const moonOpacity = isDaylight ? 0 : clamp(Math.sin(nightProgress * Math.PI) * 1.8 + .18, 0, 1);
    const palette = getSkyPalette(hour);

    room.dataset.time = time;
    room.dataset.localTime = clock;
    room.style.setProperty('--sky-top', palette.top);
    room.style.setProperty('--sky-bottom', palette.bottom);
    room.style.setProperty('--sun-x', `${celestialX}%`);
    room.style.setProperty('--sun-y', `${celestialY}%`);
    room.style.setProperty('--sun-opacity', sunOpacity.toFixed(3));
    room.style.setProperty('--moon-x', `${celestialX}%`);
    room.style.setProperty('--moon-y', `${celestialY}%`);
    room.style.setProperty('--moon-opacity', moonOpacity.toFixed(3));
    room.style.setProperty('--star-opacity', (moonOpacity * .85).toFixed(3));

    const fur = room.dataset.fur;
    const scene = room.dataset.scene;
    if (fur && scene && !room.classList.contains('has-wand') && !actionClasses.some((name) => room.classList.contains(name))) {
      whisper.textContent = time === 'deep-night' ? 'Shh... it is getting sleepy' : 'Move the wand to chase · Click to play';
      status.textContent = `${timeNames[time]} ${clock}: a ${furNames[fur]} is resting in the ${scene === 'garden' ? 'blossom garden' : scene === 'nook' ? 'window nook' : scene === 'moon' ? 'moonlit room' : 'warm room'} and watching you`;
    }
  }

  function readCatCenter() {
    const rect = catWrap.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function setCatPosition(x, y, syncCenter = true) {
    catPosition.x = x;
    catPosition.y = y;
    if (hasGsap) {
      motion.set(catWrap, { left: x, top: y });
    } else {
      room.style.setProperty('--cat-x', `${x}px`);
      room.style.setProperty('--cat-y', `${y}px`);
    }
    if (syncCenter) lastCatCenter = { x, y };
  }

  function setCatYaw(yaw, duration = .22) {
    if (hasGsap) {
      motion.to(catWrap, { '--cat-yaw': `${yaw}deg`, duration, ease: 'power2.out', overwrite: 'auto' });
    } else {
      catWrap.style.setProperty('--cat-yaw', `${yaw}deg`);
    }
  }

  function getCatDirection() {
    return currentDirection;
  }

  function setDirection(direction) {
    if (direction === currentDirection) return;
    currentDirection = direction;
    if (hasGsap) {
      motion.to(cat, { '--cat-direction': direction, duration: .16, ease: 'power2.inOut', overwrite: 'auto' });
    } else {
      cat.style.setProperty('--cat-direction', direction);
    }
    movementYaw = direction * -2;
    if (!actionClasses.some((name) => room.classList.contains(name))) setCatYaw(movementYaw, .18);
  }

  function setPose(pose, duration = .2) {
    if (!poseSelectors[pose]) pose = 'front';
    const changed = pose !== currentPose;
    currentPose = pose;
    room.dataset.pose = pose;
    Object.entries(poseSelectors).forEach(([name, selector]) => {
      room.classList.toggle(`pose-${name}`, name === pose);
      document.querySelector(selector)?.setAttribute('aria-hidden', String(name !== pose));
    });
    if (!changed) return;
    if (hasGsap) {
      const allPoses = Object.values(poseSelectors).join(', ');
      motion.killTweensOf(allPoses);
      Object.entries(poseSelectors).forEach(([name, selector]) => {
        motion.set(selector, { autoAlpha: name === pose ? 1 : 0 });
      });
      if (duration > 0) {
        motion.fromTo(poseSelectors[pose],
          { scaleX: .985, scaleY: .965, y: 3 },
          { scaleX: 1, scaleY: 1, y: 0, duration: Math.min(duration, .18), ease: 'power2.out', overwrite: 'auto', clearProps: 'scaleX,scaleY,y' });
      }
    }
  }

  function getStoredWorld() {
    try {
      const stored = JSON.parse(localStorage.getItem(worldStorageKey));
      if (stored && furs.includes(stored.fur) && scenes.includes(stored.scene)) return stored;
    } catch (error) {
      // Storage can be unavailable in private or restricted browsing modes.
    }
    return null;
  }

  function storeWorld(world) {
    try {
      localStorage.setItem(worldStorageKey, JSON.stringify(world));
    } catch (error) {
      // The page still works with a fresh random world when storage is blocked.
    }
  }

  function chooseWorld() {
    const storedWorld = getStoredWorld();
    const world = storedWorld || {
      fur: furs[Math.floor(Math.random() * furs.length)],
      scene: scenes[Math.floor(Math.random() * scenes.length)]
    };
    storeWorld(world);
    const { fur, scene } = world;
    room.dataset.fur = fur;
    room.dataset.scene = scene;
    room.style.setProperty('--scene-index', scenes.indexOf(scene));
    updateEnvironment();
    const startY = innerWidth < 760 ? innerHeight * .68 : innerHeight * .57;
    setCatPosition(innerWidth * .5, startY);
    setPose('front', 0);
    catTarget.x = catPosition.x;
    catTarget.y = catPosition.y;
    recordedCatTarget.x = catPosition.x;
    recordedCatTarget.y = catPosition.y;
  }

  function updateCuriosity() {
    const rect = catWrap.getBoundingClientRect();
    const catX = rect.left + rect.width / 2;
    const catY = rect.top + rect.height * .45;
    const distance = Math.hypot(wandTarget.x - catX, (wandTarget.y - catY) * .55);
    const near = distance < Math.max(170, rect.width * .47);
    if (near !== isNear) {
      isNear = near;
      room.classList.toggle('cat-curious', near);
      status.textContent = near ? 'The cat reaches out to catch the wand' : "The cat's eyes are following the wand";
    }
  }

  function updateMovingState() {
    const center = readCatCenter();
    const dx = center.x - lastCatCenter.x;
    const dy = center.y - lastCatCenter.y;
    const speed = Math.hypot(dx, dy);
    const actionActive = actionClasses.some((name) => room.classList.contains(name));
    if (!actionActive && Math.abs(dx) > .35) setDirection(dx < 0 ? -1 : 1);
    catPosition.x = center.x;
    catPosition.y = center.y;
    lastCatCenter = center;
    const chasing = room.classList.contains('has-wand') || hasRecordedTarget;
    const remainingToTarget = Math.hypot(recordedCatTarget.x - center.x, recordedCatTarget.y - center.y);
    const moving = chasing && (speed > .18 || remainingToTarget > 9 || targetTrail.length > 0);
    room.classList.toggle('is-running', moving);
    room.classList.toggle('is-dashing', moving && speed > 8);
    room.classList.toggle('is-creeping', chasing && !moving && Math.hypot(catTarget.x - center.x, catTarget.y - center.y) < 95);
    if (runTimeline && !actionActive) {
      if (moving) runTimeline.timeScale(clamp(.48 + speed / 8, .48, 1.08)).resume();
      else runTimeline.pause(0);
    }
    if (!actionActive) setPose(moving ? 'run' : 'front', .16);
    updateCuriosity();
  }

  function moveCatTo(x, y) {
    catTarget.x = x;
    catTarget.y = y;
    if (!hasGsap) return;
    const center = readCatCenter();
    const distance = Math.hypot(x - center.x, y - center.y);
    catMoveTween = motion.to(catWrap, {
      left: x,
      top: y,
      duration: clamp(.88 + distance / 1500, .88, 1.32),
      ease: 'power1.out',
      overwrite: 'auto',
      onUpdate: updateMovingState,
      onComplete: () => {
        if (!motion.isTweening(catWrap)) {
          room.classList.remove('is-running', 'is-dashing');
          updateMovingState();
        }
      }
    });
  }

  function recordCatTarget(x, y, time) {
    targetTrail.push({ x, y, time });
    if (targetTrail.length > 60) targetTrail.splice(0, targetTrail.length - 60);
    hasRecordedTarget = true;
  }

  function followRecordedTargets(now) {
    let delayedTarget = null;
    while (targetTrail.length && targetTrail[0].time <= now - followDelay) delayedTarget = targetTrail.shift();
    if (delayedTarget) {
      recordedCatTarget.x = delayedTarget.x;
      recordedCatTarget.y = delayedTarget.y;
    }

    const actionActive = actionClasses.some((name) => room.classList.contains(name));
    if (hasRecordedTarget && !actionActive && now - lastFollowStep >= 84) {
      const dx = recordedCatTarget.x - catTarget.x;
      const dy = recordedCatTarget.y - catTarget.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 1.2) {
        const blend = clamp(.15 + distance / 2400, .15, .26);
        moveCatTo(catTarget.x + dx * blend, catTarget.y + dy * blend);
      } else if (!targetTrail.length) {
        const center = readCatCenter();
        const remaining = Math.hypot(recordedCatTarget.x - center.x, recordedCatTarget.y - center.y);
        if (remaining > 2.5) moveCatTo(recordedCatTarget.x, recordedCatTarget.y);
        else hasRecordedTarget = false;
      }
      lastFollowStep = now;
    }
    window.requestAnimationFrame(followRecordedTargets);
  }

  function trackCatEyes(x, y) {
    const rect = catWrap.getBoundingClientRect();
    const catX = rect.left + rect.width / 2;
    const catY = rect.top + rect.height * .45;
    const eyeX = clamp((x - catX) / 28, -9, 9);
    const eyeY = clamp((y - catY) / 34, -7, 7);
    const headTilt = clamp((x - catX) / 48, -7, 7);
    cat.style.setProperty('--eye-x', `${eyeX}px`);
    cat.style.setProperty('--eye-y', `${eyeY}px`);
    cat.style.setProperty('--head-tilt', `${headTilt}deg`);
    if (hasGsap) {
      motion.to('#cat-pupil-left, #cat-pupil-right, #cat-run-pupil, #cat-crouch-pupil, #cat-jump-pupil', { x: eyeX, y: eyeY, duration: .18, ease: 'power2.out', overwrite: 'auto' });
      if (!actionClasses.some((name) => room.classList.contains(name))) {
        const activeHead = currentPose === 'front' ? '#cat-head' : `#cat-${currentPose}-head`;
        motion.to(activeHead, { rotation: headTilt * (currentPose === 'front' ? .62 : .32), duration: .24, ease: 'power2.out', overwrite: 'auto' });
      }
    }
  }

  function setupIdleMotion() {
    if (!hasGsap) return;
    motion.set('#cat-body', { transformOrigin: '260px 450px' });
    motion.set('#cat-run-body', { transformOrigin: '270px 355px' });
    motion.set('#cat-crouch-body', { transformOrigin: '255px 405px' });
    motion.set('#cat-jump-body', { transformOrigin: '282px 318px' });
    motion.set('#cat-head', { transformOrigin: '260px 250px' });
    motion.set('#cat-run-head', { transformOrigin: '408px 322px' });
    motion.set('#cat-crouch-head', { transformOrigin: '365px 365px' });
    motion.set('#cat-jump-head', { transformOrigin: '378px 278px' });
    motion.set('#cat-tail', { transformOrigin: '340px 424px' });
    motion.set('#cat-run-tail', { transformOrigin: '164px 314px' });
    motion.set('#cat-crouch-tail', { transformOrigin: '158px 352px' });
    motion.set('#cat-jump-tail', { transformOrigin: '206px 395px' });
    motion.set('#cat-ear-left, #cat-ear-right, #cat-run-ear-back, #cat-run-ear-front, #cat-crouch-ear-back, #cat-crouch-ear-front, #cat-jump-ear-back, #cat-jump-ear-front', { transformOrigin: 'center bottom' });
    motion.set('#cat-run-leg-back, #cat-run-leg-rear', { transformOrigin: 'center top' });
    motion.set('#cat-run-leg-front, #cat-run-paw', { transformOrigin: 'left center' });

    idleTimelines.push(motion.timeline({ repeat: -1, yoyo: true }).to('#cat-body, #cat-run-body, #cat-crouch-body, #cat-jump-body', { scaleX: 1.008, scaleY: 1.015, duration: 2.25, ease: 'sine.inOut' }));
    idleTimelines.push(motion.timeline({ repeat: -1, yoyo: true }).to('#cat-head, #cat-run-head, #cat-crouch-head, #cat-jump-head', { y: -2, rotation: 1.2, duration: 3.2, ease: 'sine.inOut' }));
    idleTimelines.push(motion.to('#cat-tail, #cat-run-tail, #cat-crouch-tail, #cat-jump-tail', { rotation: 5, duration: 2.5, ease: 'sine.inOut', repeat: -1, yoyo: true }));
    idleTimelines.push(motion.timeline({ repeat: -1, repeatDelay: 2.4, yoyo: true }).to('#cat-ear-left, #cat-run-ear-back, #cat-crouch-ear-back, #cat-jump-ear-back', { rotation: -5, duration: .18, ease: 'sine.out' }).to('#cat-ear-right, #cat-run-ear-front, #cat-crouch-ear-front, #cat-jump-ear-front', { rotation: 4, duration: .2, ease: 'sine.out' }));
    runTimeline = motion.timeline({ repeat: -1, yoyo: true, paused: true, defaults: { duration: .17, ease: 'sine.inOut' } })
      .to('#cat-run-leg-back', { rotation: -13, x: -4, y: -5 }, 0)
      .to('#cat-run-leg-rear', { rotation: 11, x: 5, y: 3 }, 0)
      .to('#cat-run-leg-front, #cat-run-paw', { rotation: -8, x: 8, y: -4 }, 0)
      .to('#cat-run-body', { y: -4, rotation: -.8 }, 0)
      .to('#cat-run-head', { y: -3, rotation: 1.2 }, 0);
    motion.timeline({ repeat: -1, yoyo: true }).to('#wand-feather', { rotation: 9, y: 2, duration: .85, ease: 'sine.inOut' }).to('#wand-thread', { rotation: -11, duration: .85, ease: 'sine.inOut' }, 0);
    motion.set(wand, { x: wandTarget.x - 14, y: wandTarget.y - 14, rotation: -18 });
  }

  function pauseIdleMotion() {
    idleTimelines.forEach((timeline) => timeline.pause());
    if (runTimeline) runTimeline.pause();
  }

  function resumeIdleMotion() {
    idleTimelines.forEach((timeline) => timeline.resume());
    if (runTimeline && room.classList.contains('is-running')) runTimeline.resume();
  }

  function scheduleBlink() {
    window.clearTimeout(blinkTimer);
    if (hasGsap) {
      blinkTimer = motion.delayedCall(1.8 + Math.random() * 3.6, () => {
        motion.timeline()
          .to('#cat-eye-left, #cat-eye-right, #cat-run-eye, #cat-crouch-eye, #cat-jump-eye', { scaleY: .12, duration: .07, transformOrigin: 'center' })
          .to('#cat-eye-left, #cat-eye-right, #cat-run-eye, #cat-crouch-eye, #cat-jump-eye', { scaleY: 1, duration: .1 })
          .call(scheduleBlink);
      });
      return;
    }
    blinkTimer = window.setTimeout(() => {
      room.classList.add('is-blinking');
      window.setTimeout(() => room.classList.remove('is-blinking'), 130);
      scheduleBlink();
    }, 1800 + Math.random() * 3600);
  }

  function resetActionTargets() {
    if (!hasGsap) return;
    motion.set('#catMotion, #cat-ground-shadow, #cat-body, #cat-head, #cat-tail, #cat-run-body, #cat-run-head, #cat-run-tail, #cat-crouch-body, #cat-crouch-head, #cat-crouch-tail, #cat-jump-body, #cat-jump-head, #cat-jump-tail, #cat-run-leg-back, #cat-run-leg-rear, #cat-run-leg-front, #cat-jump-leg-back, #cat-jump-leg-rear, #cat-jump-leg-front, #cat-jump-paw-two', { clearProps: 'x,y,rotation,scale,scaleX,scaleY,opacity,visibility' });
    motion.set('#cat-paw-curious, #cat-run-paw-curious, #cat-crouch-paw-curious', { clearProps: 'x,y,rotation,scale,scaleX,scaleY', autoAlpha: 0 });
  }

  function buildActionTimeline(action) {
    if (!hasGsap) return null;
    const timeline = motion.timeline({ defaults: { ease: 'power2.out' } });
    const direction = getCatDirection();
    if (action === 'is-pouncing') {
      timeline.to(catMotion, { y: 10, scaleX: .96, scaleY: .93, duration: .18, ease: 'power2.in' })
        .to('#cat-crouch-paw-curious', { autoAlpha: 1, x: 5, y: -13, rotation: -9, duration: .18 }, .06)
        .to(catMotion, { x: 34 * direction, y: -32, scaleX: 1.04, scaleY: 1.02, rotation: -4 * direction, duration: .3, ease: 'power3.out' })
        .to('#cat-crouch-paw-curious', { x: 14, y: -22, rotation: -16, duration: .22 }, .2)
        .to(catMotion, { x: 0, y: 3, scaleX: 1, scaleY: .95, rotation: 2 * direction, duration: .25, ease: 'power2.in' })
        .to(catMotion, { y: 0, scaleY: 1, rotation: 0, duration: .25, ease: 'back.out(1.5)' })
        .to('#cat-crouch-paw-curious', { autoAlpha: 0, x: 0, y: 0, rotation: 0, duration: .16 }, '<');
    } else if (action === 'is-jumping') {
      timeline.to(catMotion, { y: 8, scaleX: .95, scaleY: .9, duration: .16, ease: 'power2.in' })
        .to(catMotion, { x: 28 * direction, y: -124, scaleX: 1.04, scaleY: 1.02, rotation: -3 * direction, duration: .38, ease: 'power3.out' })
        .to('#cat-jump-tail', { rotation: -9, duration: .32, ease: 'sine.out' }, .16)
        .to('#cat-jump-leg-back, #cat-jump-leg-rear', { rotation: 9, x: -4, duration: .28 }, .18)
        .to('#cat-jump-leg-front, #cat-jump-paw-two', { rotation: -7, x: 8, duration: .25 }, .17)
        .to('#cat-ground-shadow', { scaleX: .4, scaleY: .72, opacity: .06, duration: .32 }, .16)
        .to(catMotion, { x: 6 * direction, y: -22, rotation: 2 * direction, duration: .3, ease: 'power2.in' })
        .to(catMotion, { x: 0, y: 3, scaleX: 1.03, scaleY: .9, rotation: 0, duration: .12 })
        .to(catMotion, { y: 0, scaleX: 1, scaleY: 1, duration: .24, ease: 'back.out(1.7)' })
        .to('#cat-ground-shadow', { clearProps: 'scaleX,scaleY,opacity', duration: .16 }, '<');
    } else if (action === 'is-swiping') {
      timeline.to('#cat-crouch-paw-curious', { autoAlpha: 1, x: 5, y: -20, rotation: -16, duration: .23, ease: 'back.out(1.7)' })
        .to('#cat-crouch-head', { rotation: -4, x: 3, duration: .2 }, .05)
        .to('#cat-crouch-paw-curious', { x: 18, y: -8, rotation: 5, duration: .22, ease: 'power2.inOut' })
        .to('#cat-crouch-paw-curious', { autoAlpha: 0, x: 0, y: 0, rotation: 7, duration: .24 });
    } else if (action === 'is-happy') {
      timeline.to(catMotion, { y: -22, scaleX: 1.03, scaleY: .97, rotation: -2, duration: .28, ease: 'power3.out' })
        .to('#cat-tail', { rotation: 16, duration: .22, ease: 'sine.inOut', yoyo: true, repeat: 2 }, .08)
        .to('#cat-head', { y: -5, rotation: 4, duration: .24, ease: 'sine.out' }, .08)
        .to(catMotion, { y: 2, scaleX: 1, scaleY: .96, rotation: 2, duration: .2 })
        .to(catMotion, { y: 0, scaleY: 1, rotation: 0, duration: .28, ease: 'back.out(1.5)' });
    } else if (action === 'is-turning') {
      timeline.to(catWrap, { '--cat-yaw': `${6 * direction}deg`, duration: .3, ease: 'power2.inOut' })
        .to(catMotion, { x: 22 * direction, y: -5, rotation: -2 * direction, duration: .3, ease: 'sine.inOut' }, .08)
        .to('#cat-run-head', { rotation: -4 * direction, duration: .25, ease: 'sine.inOut' }, .12)
        .to('#cat-run-tail', { rotation: 9, duration: .28, ease: 'sine.inOut', yoyo: true, repeat: 1 }, .1)
        .to(catMotion, { x: 0, y: 0, rotation: 0, duration: .34, ease: 'sine.inOut' });
    } else if (action === 'is-crouching') {
      timeline.to(catMotion, { y: 11, scaleX: 1.025, scaleY: .92, rotation: -2 * direction, duration: .34, ease: 'power2.inOut' })
        .to('#cat-crouch-head', { y: 6, rotation: -3 * direction, duration: .3 }, .04)
        .to('#cat-crouch-tail', { rotation: -8, duration: .28, ease: 'sine.inOut' }, .08)
        .to(catMotion, { y: 2, scaleX: 1, scaleY: .98, rotation: 0, duration: .34, ease: 'sine.inOut' });
    } else if (action === 'is-idle-stretch' || action === 'is-stretching') {
      timeline.to(catMotion, { x: 12 * direction, y: 8, scaleX: 1.07, scaleY: .91, rotation: -2 * direction, duration: .48, ease: 'sine.inOut' })
        .to('#cat-crouch-head', { x: 11, y: 7, rotation: -5, duration: .42 }, .04)
        .to('#cat-crouch-tail', { rotation: 11, duration: .45, ease: 'sine.inOut' }, 0)
        .to(catMotion, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, duration: .48, ease: 'sine.inOut' });
    } else if (action === 'is-idle-alert') {
      timeline.to('#cat-head', { y: -5, rotation: -5, duration: .28, ease: 'power2.out' })
        .to('#cat-ear-left, #cat-ear-right', { rotation: -5, duration: .18, yoyo: true, repeat: 1 }, .06)
        .to('#cat-head', { y: -2, rotation: 5, duration: .34, ease: 'sine.inOut' })
        .to('#cat-head', { y: 0, rotation: 0, duration: .24 });
    } else if (action === 'is-idle-sniff') {
      timeline.to('#cat-crouch-head', { x: 7, y: 4, rotation: 4, duration: .25 })
        .to('#cat-crouch-head', { x: 1, y: 1, rotation: -2, duration: .28 })
        .to('#cat-crouch-head', { x: 0, y: 0, rotation: 0, duration: .24 });
    } else if (action === 'is-idle-yawn') {
      timeline.to('#cat-head', { y: 3, scale: 1.035, duration: .35, ease: 'sine.inOut' })
        .to('#cat-head', { y: -2, scale: .98, duration: .3 })
        .to('#cat-head', { y: 0, scale: 1, duration: .25 });
    } else if (action === 'is-loafing') {
      timeline.to(catMotion, { y: 8, scaleX: .95, scaleY: .87, duration: .45, ease: 'sine.inOut' })
        .to('#cat-body', { scaleX: 1.05, scaleY: .82, duration: .45 }, 0)
        .to(catMotion, { y: 0, scaleX: 1, scaleY: 1, duration: .4, ease: 'sine.inOut' });
    }
    return timeline;
  }

  function finishAction(action) {
    if (room.classList.contains(action)) room.classList.remove(action);
    if (actionTimeline) {
      actionTimeline.kill();
      actionTimeline = null;
    }
    if (hasGsap) {
      resetActionTargets();
      motion.to(catMotion, { clearProps: 'x,y,rotation,scale,scaleX,scaleY', duration: .2, ease: 'power2.out' });
      motion.to(catWrap, { '--cat-yaw': `${movementYaw}deg`, duration: .2, ease: 'power2.out', overwrite: 'auto' });
      resumeIdleMotion();
      setPose(room.classList.contains('is-running') ? 'run' : 'front', .2);
    } else {
      setPose(room.classList.contains('is-running') ? 'run' : 'front');
    }
  }

  function setAction(action, duration = 1.2) {
    actionClasses.forEach((name) => room.classList.remove(name));
    room.classList.add(action);
    window.clearTimeout(actionTimer);
    setPose(actionPose[action] || 'front', hasGsap ? .16 : 0);
    if (hasGsap) {
      if (actionTimeline) actionTimeline.kill();
      resetActionTargets();
      pauseIdleMotion();
      setCatYaw((actionYaw[action] || 0) * getCatDirection(), .2);
      actionTimeline = buildActionTimeline(action);
    }
    actionTimer = window.setTimeout(() => finishAction(action), duration * 1000);
  }

  function scheduleIdleAction() {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      if (!room.classList.contains('has-wand') && !actionClasses.some((name) => room.classList.contains(name))) {
        const actions = ['is-idle-stretch', 'is-idle-alert', 'is-idle-sniff', 'is-idle-yawn', 'is-turning', 'is-stretching', 'is-crouching', 'is-loafing'];
        const action = actions[Math.floor(Math.random() * actions.length)];
        setAction(action, ['is-idle-stretch', 'is-stretching'].includes(action) ? 1.45 : 1.2);
      }
      scheduleIdleAction();
    }, 2200 + Math.random() * 2800);
  }

  function moveWand(event) {
    const { clientX: x, clientY: y } = event;
    const now = performance.now();
    const elapsed = Math.max(16, now - lastPointer.time);
    const pointerVelocityX = (x - lastPointer.x) / elapsed * 1000;
    const pointerVelocityY = (y - lastPointer.y) / elapsed * 1000;
    const pointerSpeed = Math.hypot(pointerVelocityX, pointerVelocityY);
    const pointerDistance = Math.hypot(x - lastPointer.x, y - lastPointer.y);
    lastPointer.x = x;
    lastPointer.y = y;
    lastPointer.time = now;
    wandTarget.x = x;
    wandTarget.y = y;
    const wandAngle = Math.atan2(y - innerHeight / 2, x - innerWidth / 2) * 180 / Math.PI / 12 - 12 + clamp(pointerVelocityX * .012, -11, 11);
    const wandSway = Math.sin(now * .018) * Math.min(14, 3 + pointerSpeed * .012);
    wand.style.setProperty('--wand-speed', `${Math.min(1, pointerSpeed / 1400)}`);
    wand.style.setProperty('--wand-sway', `${wandSway}deg`);
    if (hasGsap) {
      motion.to(wand, { x: x - 14, y: y - 14, rotation: wandAngle, duration: .42, ease: 'power3.out', overwrite: 'auto' });
    } else {
      wand.style.transform = `translate3d(${x - 14}px, ${y - 14}px, 0) rotate(${wandAngle}deg)`;
    }

    const rect = catWrap.getBoundingClientRect();
    const padding = Math.max(76, rect.width * .58);
    const floorBand = innerWidth < 760
      ? { min: innerHeight * .63, max: innerHeight * .75 }
      : { min: innerHeight * .53, max: innerHeight * .62 };
    const targetX = clamp(x, padding, innerWidth - padding);
    const targetY = clamp(floorBand.min + (y / innerHeight) * (floorBand.max - floorBand.min), floorBand.min, floorBand.max);
    trackCatEyes(x, y);
    room.classList.add('has-wand');
    window.clearTimeout(stopTimer);
    stopTimer = window.setTimeout(() => {
      room.classList.remove('has-wand');
      if (!actionClasses.some((name) => room.classList.contains(name))) setPose('front', .28);
    }, 2300);
    recordCatTarget(targetX, targetY, now);
    if (pointerSpeed > 520 && !room.classList.contains('is-pouncing')) status.textContent = 'The wand darts away — chase it!';
    if (isNear && pointerDistance > Math.max(82, innerWidth * .035) && pointerSpeed > 620 && now - lastLeapAt > 2400 && !actionClasses.some((name) => room.classList.contains(name))) {
      lastLeapAt = now;
      window.clearTimeout(leapTimer);
      leapTimer = window.setTimeout(() => {
        if (room.classList.contains('has-wand') && isNear && !actionClasses.some((name) => room.classList.contains(name))) {
          setAction('is-jumping', 1.25);
          status.textContent = 'The cat springs into the air after the feather';
          whisper.textContent = 'Up, up, up!';
        }
      }, 360);
    }
  }

  function play(event) {
    if (event.type === 'keydown' && event.key !== ' ' && event.key !== 'Enter') return;
    if (event.type !== 'keydown') {
      const center = readCatCenter();
      const featherX = event.clientX + 22;
      if (Math.abs(featherX - center.x) > 4) setDirection(featherX < center.x ? -1 : 1);
    }
    playCount += 1;
    const playActions = ['is-pouncing', 'is-jumping', 'is-swiping', 'is-happy', 'is-turning', 'is-crouching'];
    const action = playActions[(playCount - 1) % playActions.length];
    setAction(action, 1.3);
    room.classList.add('has-wand');
    window.clearTimeout(stopTimer);
    stopTimer = window.setTimeout(() => room.classList.remove('has-wand'), 900);
    catTarget.x = wandTarget.x;
    catTarget.y = clamp(catTarget.y, innerHeight * .53, innerHeight * .75);
    if (action === 'is-jumping') {
      status.textContent = 'The cat leaps up and twists after the feather';
      whisper.textContent = 'Up, up, up!';
    } else if (action === 'is-swiping') {
      status.textContent = 'The cat swats at the feather with both paws';
      whisper.textContent = 'Gotcha!';
    } else if (action === 'is-happy') {
      status.textContent = 'The cat wiggles with delight';
      whisper.textContent = 'That was fun!';
    } else if (action === 'is-turning') {
      status.textContent = 'The cat turns sideways to keep the feather in sight';
      whisper.textContent = 'Where did it go?';
    } else if (action === 'is-crouching') {
      status.textContent = 'The cat crouches low, ready to spring';
      whisper.textContent = 'Ready...';
    } else {
      status.textContent = 'The cat pounced and blinked happily';
      whisper.textContent = 'Meow! Again?';
    }
    window.setTimeout(() => {
      whisper.textContent = room.dataset.time === 'deep-night' ? 'Shh... it is getting sleepy' : 'Move the wand to chase · Click to play';
    }, 1400);
  }

  function fallbackAnimate() {
    const dx = catTarget.x - catPosition.x;
    const dy = catTarget.y - catPosition.y;
    const distance = Math.hypot(dx, dy);
    const chasing = room.classList.contains('has-wand') || hasRecordedTarget;
    if (chasing && distance > 2) {
      const desiredSpeed = clamp(3.2 + distance * .038, 3.2, 12.5);
      catVelocity.x += ((dx / distance) * desiredSpeed - catVelocity.x) * .13;
      catVelocity.y += ((dy / distance) * desiredSpeed - catVelocity.y) * .13;
    } else {
      catVelocity.x *= .82;
      catVelocity.y *= .82;
    }
    if (Math.hypot(catVelocity.x, catVelocity.y) > .08) setCatPosition(catPosition.x + catVelocity.x, catPosition.y + catVelocity.y, false);
    updateMovingState();
    window.requestAnimationFrame(fallbackAnimate);
  }

  chooseWorld();
  setupIdleMotion();
  scheduleBlink();
  scheduleIdleAction();
  window.requestAnimationFrame(followRecordedTargets);
  if (!hasGsap) fallbackAnimate();
  window.addEventListener('pointermove', moveWand, { passive: true });
  window.addEventListener('pointerdown', play);
  window.addEventListener('keydown', play);
  window.setInterval(updateEnvironment, 30000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateEnvironment();
  });
  window.addEventListener('resize', () => {
    const rect = catWrap.getBoundingClientRect();
    const padding = Math.max(76, rect.width * .58);
    const nextX = clamp(catPosition.x, padding, innerWidth - padding);
    const nextY = clamp(catPosition.y, innerHeight * .53, innerHeight * .75);
    if (hasGsap) motion.to(catWrap, { left: nextX, top: nextY, duration: .35, ease: 'power2.out', overwrite: 'auto' });
    else setCatPosition(nextX, nextY);
    if (hasGsap) motion.to(wand, { x: clamp(wandTarget.x, 0, innerWidth) - 14, y: clamp(wandTarget.y, 0, innerHeight) - 14, duration: .25, ease: 'power2.out', overwrite: 'auto' });
  });
})();
