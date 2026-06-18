// tracker.js — Motion tracking, auto-lock, mini feeds
window.Tracker = (() => {
  let video = null;
  let motionCanvas = null, motionCtx = null;
  let zoomCanvas = null, zoomCtx = null;
  let edgeCanvas = null, edgeCtx = null;
  let prevFrame = null;
  let motionSensitivity = 30;
  let autolockEnabled = false;
  let lockedTarget = null; // {x, y, w, h, label}
  let motionPoints = 0;
  let animId = null;
  let running = false;
  let motionActive = false;
  let tempCanvas = null, tempCtx = null;

  function init(vid) {
    video = vid;
    motionCanvas = document.getElementById('mini-canvas-motion');
    motionCtx = motionCanvas.getContext('2d');
    zoomCanvas = document.getElementById('mini-canvas-zoom');
    zoomCtx = zoomCanvas.getContext('2d');
    edgeCanvas = document.getElementById('mini-canvas-edge');
    edgeCtx = edgeCanvas.getContext('2d');

    tempCanvas = document.createElement('canvas');
    tempCtx = tempCanvas.getContext('2d');
  }

  function setMotionSensitivity(v) { motionSensitivity = v; }
  function setAutolock(enabled) {
    autolockEnabled = enabled;
    if (!enabled) {
      lockedTarget = null;
      document.getElementById('lock-indicator').classList.add('hidden');
      document.getElementById('t-autolock').textContent = 'OFF';
      document.getElementById('sb-targets').textContent = '0';
    } else {
      document.getElementById('t-autolock').textContent = 'ON';
    }
  }

  function updateLock(detections) {
    if (!autolockEnabled || detections.length === 0) {
      if (autolockEnabled && detections.length === 0) {
        document.getElementById('lock-indicator').classList.add('hidden');
      }
      return;
    }

    // Pick highest confidence detection
    const best = detections.reduce((a, b) => a.score > b.score ? a : b);
    lockedTarget = { x: best.bbox[0], y: best.bbox[1], w: best.bbox[2], h: best.bbox[3], label: best.class };
    document.getElementById('sb-targets').textContent = detections.length;

    // Map bbox to screen coordinates
    const camContainer = document.getElementById('cam-container');
    const overlay = document.getElementById('cam-overlay');
    const scaleX = camContainer.clientWidth / (overlay.width || 640);
    const scaleY = camContainer.clientHeight / (overlay.height || 480);

    const lx = best.bbox[0] * scaleX;
    const ly = best.bbox[1] * scaleY;
    const lw = best.bbox[2] * scaleX;
    const lh = best.bbox[3] * scaleY;

    const lockInd = document.getElementById('lock-indicator');
    const lockBox = document.getElementById('lock-box');
    const lockLabel = document.getElementById('lock-label');

    lockInd.classList.remove('hidden');
    lockBox.style.cssText = `left:${lx}px;top:${ly}px;width:${lw}px;height:${lh}px;position:absolute;`;
    lockLabel.style.cssText = `left:${lx}px;top:${ly - 18}px;position:absolute;`;
    lockLabel.textContent = `LOCKED // ${best.class.toUpperCase()} ${Math.round(best.score*100)}%`;

    // Update zoom mini feed
    updateZoomFeed(best.bbox);
  }

  function updateZoomFeed(bbox) {
    if (!video || video.readyState < 2) return;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    zoomCanvas.width = zoomCanvas.clientWidth || 120;
    zoomCanvas.height = zoomCanvas.clientHeight || 80;

    // Expand bbox slightly
    const pad = 20;
    const sx = Math.max(0, bbox[0] - pad);
    const sy = Math.max(0, bbox[1] - pad);
    const sw = Math.min(vw - sx, bbox[2] + pad*2);
    const sh = Math.min(vh - sy, bbox[3] + pad*2);

    zoomCtx.drawImage(video, sx, sy, sw, sh, 0, 0, zoomCanvas.width, zoomCanvas.height);

    // Scanline on zoom
    for (let y = 0; y < zoomCanvas.height; y += 3) {
      zoomCtx.fillStyle = 'rgba(0,0,0,0.12)';
      zoomCtx.fillRect(0, y, zoomCanvas.width, 1);
    }

    // Green tint
    zoomCtx.fillStyle = 'rgba(0,255,65,0.05)';
    zoomCtx.fillRect(0, 0, zoomCanvas.width, zoomCanvas.height);

    // Reticle
    const cx = zoomCanvas.width/2, cy = zoomCanvas.height/2;
    zoomCtx.strokeStyle = 'rgba(255,68,68,0.8)';
    zoomCtx.lineWidth = 1;
    zoomCtx.beginPath(); zoomCtx.moveTo(cx-10,cy); zoomCtx.lineTo(cx+10,cy); zoomCtx.stroke();
    zoomCtx.beginPath(); zoomCtx.moveTo(cx,cy-10); zoomCtx.lineTo(cx,cy+10); zoomCtx.stroke();
  }

  function updateMotionFeed() {
    if (!video || video.readyState < 2) return;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const mw = motionCanvas.clientWidth || 120;
    const mh = motionCanvas.clientHeight || 80;
    motionCanvas.width = mw; motionCanvas.height = mh;
    tempCanvas.width = mw; tempCanvas.height = mh;

    tempCtx.drawImage(video, 0, 0, mw, mh);
    const current = tempCtx.getImageData(0, 0, mw, mh);

    if (prevFrame) {
      const diff = motionCtx.createImageData(mw, mh);
      let motionPixels = 0;

      for (let i = 0; i < current.data.length; i += 4) {
        const dr = Math.abs(current.data[i] - prevFrame.data[i]);
        const dg = Math.abs(current.data[i+1] - prevFrame.data[i+1]);
        const db = Math.abs(current.data[i+2] - prevFrame.data[i+2]);
        const delta = (dr + dg + db) / 3;

        if (delta > motionSensitivity) {
          diff.data[i] = 0;
          diff.data[i+1] = Math.min(255, delta * 3);
          diff.data[i+2] = 0;
          diff.data[i+3] = 220;
          motionPixels++;
        } else {
          diff.data[i] = 0; diff.data[i+1] = 10; diff.data[i+2] = 0;
          diff.data[i+3] = 200;
        }
      }

      motionCtx.putImageData(diff, 0, 0);
      motionPoints = motionPixels;
      motionActive = motionPixels > 50;
      document.getElementById('t-points').textContent = motionPixels;
      document.getElementById('t-motion').textContent = motionActive ? 'ACTIVE' : 'IDLE';
    }
    prevFrame = current;
  }

  function updateEdgeFeed() {
    if (!video || video.readyState < 2) return;
    const mw = edgeCanvas.clientWidth || 120;
    const mh = edgeCanvas.clientHeight || 80;
    edgeCanvas.width = mw; edgeCanvas.height = mh;
    const tc = document.createElement('canvas');
    tc.width = mw; tc.height = mh;
    const tx = tc.getContext('2d');
    tx.drawImage(video, 0, 0, mw, mh);
    const imageData = tx.getImageData(0, 0, mw, mh);
    const edge = edgeCtx.createImageData(mw, mh);

    // Simple Sobel
    for (let y = 1; y < mh-1; y++) {
      for (let x = 1; x < mw-1; x++) {
        const idx = (y*mw + x) * 4;
        const getGray = (xx, yy) => {
          const i = (yy*mw+xx)*4;
          return (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        };
        const gx = -getGray(x-1,y-1) + getGray(x+1,y-1) - 2*getGray(x-1,y) + 2*getGray(x+1,y) - getGray(x-1,y+1) + getGray(x+1,y+1);
        const gy = -getGray(x-1,y-1) - 2*getGray(x,y-1) - getGray(x+1,y-1) + getGray(x-1,y+1) + 2*getGray(x,y+1) + getGray(x+1,y+1);
        const mag = Math.min(255, Math.sqrt(gx*gx + gy*gy));
        const v = mag > 40 ? mag : 0;
        edge.data[idx] = 0;
        edge.data[idx+1] = v;
        edge.data[idx+2] = 0;
        edge.data[idx+3] = v > 0 ? 255 : 180;
      }
    }
    edgeCtx.putImageData(edge, 0, 0);
  }

  let frameSkip = 0;
  function tick(detections) {
    frameSkip++;
    updateMotionFeed();
    if (frameSkip % 3 === 0) updateEdgeFeed(); // edge is expensive, skip frames
    updateLock(detections);
  }

  function isMotionActive() { return motionActive; }
  function getMotionPoints() { return motionPoints; }

  return { init, tick, setMotionSensitivity, setAutolock, isMotionActive, getMotionPoints };
})();