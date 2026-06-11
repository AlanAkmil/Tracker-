// detector.js — TensorFlow COCO-SSD object detection
window.Detector = (() => {
  let model = null;
  let running = false;
  let video = null;
  let overlay = null;
  let ctx = null;
  let confidenceThreshold = 0.6;
  let detectionCount = 0;
  let frameCount = 0;
  let lastFpsTime = 0;
  let fps = 0;
  let detections = [];
  let heatmapData = {}; // grid cells
  let heatmapEnabled = false;
  let heatmapCanvas = null;
  let heatmapCtx = null;
  let animId = null;
  let onDetectionCb = null;
  let sessionDetections = 0;
  let detectionHistory = []; // [{time, class, conf, bbox}]

  async function load() {
    document.getElementById('tb-model-status').textContent = 'LOADING...';
    document.getElementById('t-model').textContent = 'LOADING';
    try {
      model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      document.getElementById('tb-model-status').textContent = 'COCO-SSD READY';
      document.getElementById('t-model').textContent = 'COCO-SSD';
      return true;
    } catch(e) {
      document.getElementById('tb-model-status').textContent = 'MODEL ERROR';
      document.getElementById('t-model').textContent = 'ERROR';
      return false;
    }
  }

  function setVideo(v) { video = v; }
  function setOverlay(c) {
    overlay = c;
    ctx = c.getContext('2d');
  }
  function setConfidence(v) { confidenceThreshold = v; }
  function setHeatmap(enabled) {
    heatmapEnabled = enabled;
    if (!heatmapCanvas && enabled) {
      heatmapCanvas = document.createElement('canvas');
      heatmapCanvas.id = 'heatmap-canvas';
      heatmapCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:8;opacity:0.5;';
      document.getElementById('cam-container').appendChild(heatmapCanvas);
    }
    if (heatmapCanvas) heatmapCanvas.style.display = enabled ? 'block' : 'none';
  }
  function setOnDetection(cb) { onDetectionCb = cb; }
  function getHistory() { return detectionHistory; }
  function getSessionCount() { return sessionDetections; }

  async function detect() {
    if (!model || !video || video.readyState < 2) {
      animId = requestAnimationFrame(detect);
      return;
    }

    // Resize overlay to match video
    const vw = video.videoWidth || video.clientWidth;
    const vh = video.videoHeight || video.clientHeight;
    if (overlay.width !== vw || overlay.height !== vh) {
      overlay.width = vw; overlay.height = vh;
    }

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const predictions = await model.detect(video, 10, confidenceThreshold);
    detections = predictions;

    // FPS
    frameCount++;
    const now = Date.now();
    if (now - lastFpsTime >= 1000) {
      fps = frameCount;
      frameCount = 0;
      lastFpsTime = now;
      document.getElementById('sb-fps').textContent = fps;
      document.getElementById('cs-fps').textContent = fps;
    }

    detectionCount = predictions.length;
    sessionDetections += predictions.filter(p => p.score >= confidenceThreshold).length;
    document.getElementById('sb-det').textContent = detectionCount;
    document.getElementById('cs-det-count').textContent = 'DETECTIONS: ' + detectionCount;
    document.getElementById('t-points').textContent = detectionCount;
    document.getElementById('t-active').textContent = predictions.length;

    // Draw detections
    predictions.forEach(pred => {
      if (pred.score < confidenceThreshold) return;
      const [x, y, w, h] = pred.bbox;
      const conf = Math.round(pred.score * 100);
      const label = pred.class.toUpperCase();

      // Box
      const color = getClassColor(pred.class);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;

      // Corner accents
      const cs = 10;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      // TL
      ctx.beginPath(); ctx.moveTo(x, y+cs); ctx.lineTo(x, y); ctx.lineTo(x+cs, y); ctx.stroke();
      // TR
      ctx.beginPath(); ctx.moveTo(x+w-cs, y); ctx.lineTo(x+w, y); ctx.lineTo(x+w, y+cs); ctx.stroke();
      // BL
      ctx.beginPath(); ctx.moveTo(x, y+h-cs); ctx.lineTo(x, y+h); ctx.lineTo(x+cs, y+h); ctx.stroke();
      // BR
      ctx.beginPath(); ctx.moveTo(x+w-cs, y+h); ctx.lineTo(x+w, y+h); ctx.lineTo(x+w, y+h-cs); ctx.stroke();

      // Label background
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x, y - 18, w, 18);

      // Label text
      ctx.fillStyle = color;
      ctx.font = 'bold 10px "Share Tech Mono", monospace';
      ctx.fillText(`${label} ${conf}%`, x + 4, y - 5);

      // Heatmap update
      if (heatmapEnabled) {
        const gx = Math.floor((x + w/2) / 20);
        const gy = Math.floor((y + h/2) / 20);
        const key = gx + '_' + gy;
        heatmapData[key] = (heatmapData[key] || 0) + 1;
      }

      // Log to history
      if (detectionHistory.length === 0 ||
          detectionHistory[detectionHistory.length-1].class !== pred.class ||
          now - detectionHistory[detectionHistory.length-1].timestamp > 2000) {
        const entry = {
          timestamp: now,
          class: pred.class,
          conf,
          bbox: pred.bbox,
          time: new Date().toLocaleTimeString()
        };
        detectionHistory.push(entry);
        if (detectionHistory.length > 200) detectionHistory.shift();
        addLogEntry(entry);
        addHistoryEntry(entry);
        if (onDetectionCb) onDetectionCb(entry);
      }
    });

    // Draw heatmap
    if (heatmapEnabled && heatmapCanvas) {
      drawHeatmap();
    }

    animId = requestAnimationFrame(detect);
  }

  function drawHeatmap() {
    if (!heatmapCanvas) return;
    heatmapCanvas.width = overlay.width;
    heatmapCanvas.height = overlay.height;
    const htx = heatmapCanvas.getContext('2d');
    htx.clearRect(0, 0, heatmapCanvas.width, heatmapCanvas.height);
    const maxVal = Math.max(...Object.values(heatmapData), 1);
    for (const key in heatmapData) {
      const [gx, gy] = key.split('_').map(Number);
      const val = heatmapData[key] / maxVal;
      const r = Math.round(255 * val);
      const g = Math.round(255 * (1 - val));
      htx.fillStyle = `rgba(${r},${g},0,${val * 0.6})`;
      htx.fillRect(gx * 20, gy * 20, 20, 20);
    }
  }

  function clearHeatmap() { heatmapData = {}; }

  function getClassColor(cls) {
    const colors = {
      person: '#00ff41',
      car: '#00cfff',
      truck: '#00aaff',
      bus: '#0088ff',
      motorcycle: '#ff8800',
      bicycle: '#ffcc00',
      dog: '#ff44ff',
      cat: '#ff44ff',
      bird: '#ff8888',
      default: '#ffffff'
    };
    return colors[cls] || colors.default;
  }

  function addLogEntry(entry) {
    const log = document.getElementById('object-log');
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="log-time">${entry.time}</span> <span class="log-class">${entry.class.toUpperCase()}</span> <span class="log-conf">${entry.conf}%</span>`;
    log.insertBefore(div, log.firstChild);
    if (log.children.length > 30) log.removeChild(log.lastChild);
  }

  function addHistoryEntry(entry) {
    const hist = document.getElementById('det-history');
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="log-time">${entry.time}</span> <span class="log-class">${entry.class.toUpperCase()}</span>`;
    hist.insertBefore(div, hist.firstChild);
    if (hist.children.length > 20) hist.removeChild(hist.lastChild);
  }

  function start() {
    if (!running) { running = true; detect(); }
  }

  function stop() {
    running = false;
    if (animId) cancelAnimationFrame(animId);
  }

  function getDetections() { return detections; }
  function getFPS() { return fps; }

  return {
    load, start, stop, setVideo, setOverlay,
    setConfidence, setHeatmap, setOnDetection,
    getDetections, getFPS, getHistory, getSessionCount,
    clearHeatmap
  };
})();
