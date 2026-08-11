(() => {
  const room = document.querySelector('#room');
  const cat = document.querySelector('#cat');
  const wand = document.querySelector('#wand');
  const whisper = document.querySelector('#whisper');
  const status = document.querySelector('#catStatus');
  const catWrap = document.querySelector('#catWrap');

  const furs = ['orange', 'white', 'black', 'gray', 'calico', 'tabby'];
  const scenes = ['room', 'nook', 'garden', 'moon'];
  const furNames = { orange: 'orange cat', white: 'white cat', black: 'black cat', gray: 'gray cat', calico: 'calico cat', tabby: 'tabby cat' };
  const timeNames = { morning: 'Morning', day: 'Daytime', dusk: 'Dusk', night: 'Night', 'deep-night': 'Late night' };
  let isNear = false;
  let lastMove = 0;

  function getTimeOfDay(hour) {
    if (hour >= 5 && hour < 10) return 'morning';
    if (hour >= 10 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'dusk';
    if (hour >= 20 || hour < 0) return 'night';
    return 'deep-night';
  }

  function chooseWorld() {
    const time = getTimeOfDay(new Date().getHours());
    const fur = furs[Math.floor(Math.random() * furs.length)];
    const scene = scenes[Math.floor(Math.random() * scenes.length)];
    room.dataset.time = time;
    room.dataset.fur = fur;
    room.dataset.scene = scene;
    room.style.setProperty('--scene-index', scenes.indexOf(scene));
    whisper.textContent = time === 'deep-night' ? 'Shh... it is getting sleepy' : 'Gently wave the cat wand and stay awhile';
    status.textContent = `${timeNames[time]}: a ${furNames[fur]} is resting in the ${scene === 'garden' ? 'blossom garden' : scene === 'nook' ? 'window nook' : scene === 'moon' ? 'moonlit room' : 'warm room'} and watching you`;
  }

  function moveWand(event) {
    const { clientX: x, clientY: y } = event;
    const now = performance.now();
    if (now - lastMove < 16) return;
    lastMove = now;
    const angle = Math.atan2(y - innerHeight / 2, x - innerWidth / 2) * 180 / Math.PI;
    wand.style.transform = `translate3d(${x - 18}px, ${y - 18}px, 0) rotate(${angle / 12 - 12}deg)`;

    const rect = catWrap.getBoundingClientRect();
    const catX = rect.left + rect.width / 2;
    const catY = rect.top + rect.height * .45;
    const distance = Math.hypot(x - catX, y - catY);
    const near = distance < Math.max(190, rect.width * .47);
    if (near !== isNear) {
      isNear = near;
      room.classList.toggle('cat-curious', near);
      status.textContent = near ? 'The cat reaches out to catch the wand' : "The cat's eyes are following the wand";
    }

    const dx = Math.max(-9, Math.min(9, (x - catX) / 28));
    const dy = Math.max(-7, Math.min(7, (y - catY) / 34));
    cat.style.setProperty('--eye-x', `${dx}px`);
    cat.style.setProperty('--eye-y', `${dy}px`);
    cat.style.setProperty('--head-tilt', `${Math.max(-4, Math.min(4, dx / 2))}deg`);
  }

  function play(event) {
    if (event.type === 'keydown' && event.key !== ' ' && event.key !== 'Enter') return;
    room.classList.remove('is-pouncing');
    void room.offsetWidth;
    room.classList.add('is-pouncing');
    status.textContent = 'The cat pounced and blinked happily';
    whisper.textContent = 'Meow! Again?';
    window.setTimeout(() => {
      room.classList.remove('is-pouncing');
      whisper.textContent = room.dataset.time === 'deep-night' ? 'Shh... it is getting sleepy' : 'Gently wave the cat wand and stay awhile';
    }, 800);
  }

  chooseWorld();
  window.addEventListener('pointermove', moveWand, { passive: true });
  window.addEventListener('pointerdown', play);
  window.addEventListener('keydown', play);
  window.setInterval(() => {
    const next = getTimeOfDay(new Date().getHours());
    if (next !== room.dataset.time) room.dataset.time = next;
  }, 60000);
})();
