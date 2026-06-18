// boot.js — Panopticore boot sequence
const BOOT_MESSAGES = [
  { text: 'INITIALIZING PANOPTICORE v2.1...', delay: 0, type: 'ok' },
  { text: 'LOADING MINDS SIGHT MODULE...', delay: 150, type: 'ok' },
  { text: 'CHECKING SENSOR ARRAY...', delay: 300, type: 'ok' },
  { text: 'TENSORFLOW.JS: DETECTED', delay: 450, type: 'ok' },
  { text: 'LOADING COCO-SSD MODEL (YOLO-CLASS)...', delay: 600, type: 'ok' },
  { text: 'RADAR SUBSYSTEM: ONLINE', delay: 750, type: 'ok' },
  { text: 'GPS MODULE: STANDBY', delay: 900, type: 'ok' },
  { text: 'MOTION ARRAY: CONFIGURED', delay: 1050, type: 'ok' },
  { text: 'RECORDING ENGINE: READY', delay: 1200, type: 'ok' },
  { text: 'REPORT GENERATOR: READY', delay: 1350, type: 'ok' },
  { text: 'CAMERA ACCESS: PENDING USER PERMISSION', delay: 1500, type: 'err' },
  { text: 'ALL SYSTEMS NOMINAL', delay: 1650, type: 'ok' },
  { text: 'BOOT COMPLETE — LAUNCHING HUD...', delay: 1800, type: 'ok' },
];

function runBoot() {
  const log = document.getElementById('boot-log');
  const fill = document.getElementById('boot-fill');
  const total = BOOT_MESSAGES.length;

  BOOT_MESSAGES.forEach((msg, i) => {
    setTimeout(() => {
      const line = document.createElement('div');
      line.textContent = '> ' + msg.text;
      line.className = msg.type === 'ok' ? 'boot-ok' : 'boot-err';
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
      fill.style.width = ((i + 1) / total * 100) + '%';

      if (i === total - 1) {
        setTimeout(() => {
          document.getElementById('boot-screen').style.opacity = '0';
          document.getElementById('boot-screen').style.transition = 'opacity 0.5s';
          setTimeout(() => {
            document.getElementById('boot-screen').classList.add('hidden');
            document.getElementById('hud').classList.remove('hidden');
            window.panoptiStartup && window.panoptiStartup();
          }, 500);
        }, 400);
      }
    }, msg.delay);
  });
}

document.addEventListener('DOMContentLoaded', runBoot);