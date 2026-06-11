// main.js — Panopticore orchestrator
window.panoptiStartup = async function() {
  const video = document.getElementById('cam-video');
  const overlay = document.getElementById('cam-overlay');

  // State
  let camStream = null;
  let sessionStart = null;
  let totalFrames = 0;
  let motionPeaks = 0;
  let gpsStart = null;
  let gpsRunning = false;
  let heatmapOn = false;
  let autolockOn = false;
  let detectorRunning = false;
  let loopId = null;
  let elapsedInterval = null;
  let lastReportData = null;

  // Init subsystems
  Radar.init();
  Detector.setOverlay(overlay);
  Detector.setVideo(video);

  // Clock
  setInterval(() => {
    const now = new Date();
    document.getElementById('sb-time').textContent =
      String(now.getHours()).padStart(2,'0') + ':' +
      String(now.getMinutes()).padStart(2,'0') + ':' +
      String(now.getSeconds()).padStart(2,'0');
  }, 1000);

  // Load model
  Detector.load().then(() => {
    document.getElementById('t-model').textContent = 'COCO-SSD READY';
  });

  // Radar blip on detection
  Detector.setOnDetection(entry => {
    Radar.addTarget(entry.class);
  });

  // ========== CAMERA ==========
  async function startCamera() {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      video.srcObject = camStream;
      await video.play();

      document.getElementById('cam-offline').classList.add('hidden');
      document.getElementById('sb-cam').textContent = 'LIVE';
      document.getElementById('cs-mode').textContent = 'LIVE';
      document.getElementById('btn-start-cam').textContent = 'STOP CAM';
      document.getElementById('btn-start-cam').classList.add('active');

      Recorder.setStream(camStream);
      Tracker.init(video);
      Recorder.startGIF(video);

      sessionStart = Date.now();
      document.getElementById('t-session').textContent = new Date().toLocaleTimeString();

      detectorRunning = true;
      Detector.start();

      // Main ticker loop
      loopId = setInterval(() => {
        totalFrames++;
        const dets = Detector.getDetections();
        Tracker.tick(dets);
        if (Tracker.isMotionActive()) motionPeaks++;
        document.getElementById('t-elapsed').textContent = Recorder.getElapsed();

        // Update motion indicator
        const motionVal = Tracker.isMotionActive();
        document.getElementById('t-motion').textContent = motionVal ? 'ACTIVE' : 'IDLE';
        if (motionVal) {
          document.getElementById('t-motion').style.color = '#ff4444';
        } else {
          document.getElementById('t-motion').style.color = '';
        }
      }, 200);

    } catch(e) {
      document.getElementById('sb-cam').textContent = 'DENIED';
      document.getElementById('cam-offline').innerHTML = '■ CAMERA ACCESS DENIED<br><small>Check browser permissions</small>';
      alert('Camera access denied: ' + e.message);
    }
  }

  function stopCamera() {
    if (camStream) {
      camStream.getTracks().forEach(t => t.stop());
      camStream = null;
    }
    video.srcObject = null;
    detectorRunning = false;
    Detector.stop();
    if (loopId) clearInterval(loopId);
    document.getElementById('cam-offline').classList.remove('hidden');
    document.getElementById('sb-cam').textContent = 'OFFLINE';
    document.getElementById('cs-mode').textContent = 'STANDBY';
    document.getElementById('btn-start-cam').textContent = 'START CAM';
    document.getElementById('btn-start-cam').classList.remove('active');
  }

  // ========== BUTTONS ==========
  document.getElementById('btn-start-cam').addEventListener('click', () => {
    if (!camStream) startCamera();
    else stopCamera();
  });

  document.getElementById('btn-autolock').addEventListener('click', () => {
    autolockOn = !autolockOn;
    Tracker.setAutolock(autolockOn);
    const btn = document.getElementById('btn-autolock');
    btn.classList.toggle('active', autolockOn);
    btn.textContent = autolockOn ? 'LOCK ON' : 'AUTO LOCK';
  });

  document.getElementById('btn-record').addEventListener('click', () => {
    if (!Recorder.isRecording()) {
      if (!camStream) { alert('Start camera first'); return; }
      Recorder.startRecording();
    } else {
      Recorder.stopRecording();
    }
  });

  document.getElementById('btn-save-gif').addEventListener('click', () => {
    Recorder.stopAndSaveGIF();
  });

  document.getElementById('btn-clear-scan').addEventListener('click', () => {
    Detector.clearHeatmap();
    document.getElementById('object-log').innerHTML = '';
    document.getElementById('det-history').innerHTML = '';
    totalFrames = 0; motionPeaks = 0;
  });

  document.getElementById('btn-gps').addEventListener('click', () => {
    if (!gpsRunning) {
      Radar.startGPS();
      gpsRunning = true;
      gpsStart = Radar.getGPS();
      document.getElementById('btn-gps').textContent = 'GPS OFF';
      document.getElementById('btn-gps').classList.add('active');
    } else {
      Radar.stopGPS();
      gpsRunning = false;
      document.getElementById('btn-gps').textContent = 'GPS ON';
      document.getElementById('btn-gps').classList.remove('active');
    }
  });

  document.getElementById('btn-heatmap').addEventListener('click', () => {
    heatmapOn = !heatmapOn;
    Detector.setHeatmap(heatmapOn);
    document.getElementById('btn-heatmap').classList.toggle('active', heatmapOn);
    document.getElementById('btn-heatmap').textContent = heatmapOn ? 'HEAT ON' : 'HEATMAP';
  });

  document.getElementById('btn-report').addEventListener('click', generateReport);
  document.getElementById('tb-report-tb').addEventListener('click', generateReport);
  document.getElementById('report-close').addEventListener('click', () => {
    document.getElementById('report-modal').classList.add('hidden');
  });

  document.getElementById('btn-dl-report').addEventListener('click', () => {
    if (lastReportData) Reporter.downloadTxt(lastReportData);
  });
  document.getElementById('btn-dl-json').addEventListener('click', () => {
    if (lastReportData) Reporter.downloadJson(lastReportData);
  });

  function generateReport() {
    const sessionData = {
      startTime: sessionStart,
      endTime: Date.now(),
      totalFrames,
      detectionHistory: Detector.getHistory(),
      gpsStart: gpsStart || Radar.getGPS(),
      gpsEnd: Radar.getGPS(),
      sessionCount: Detector.getSessionCount(),
      motionPeaks
    };
    const result = Reporter.generate(sessionData);
    lastReportData = result.data;
    document.getElementById('report-body').innerHTML = result.html;
    document.getElementById('report-modal').classList.remove('hidden');
  }

  // ========== TOOLBAR TOGGLES ==========
  document.getElementById('tb-tracking').addEventListener('click', function() {
    this.classList.toggle('active');
  });
  document.getElementById('tb-yolo').addEventListener('click', function() {
    this.classList.toggle('active');
    detectorRunning = this.classList.contains('active');
    if (detectorRunning && camStream) Detector.start();
    else Detector.stop();
  });
  document.getElementById('tb-heatmap-tb').addEventListener('click', () => {
    document.getElementById('btn-heatmap').click();
  });
  document.getElementById('tb-radar').addEventListener('click', function() {
    this.classList.toggle('active');
    document.getElementById('radar-canvas').style.display = this.classList.contains('active') ? 'none' : 'block';
  });
  document.getElementById('tb-gps-tb').addEventListener('click', () => {
    document.getElementById('btn-gps').click();
  });
  document.getElementById('tb-rec-tb').addEventListener('click', () => {
    document.getElementById('btn-record').click();
  });
  document.getElementById('tb-motion').addEventListener('click', function() {
    this.classList.toggle('active');
  });

  // ========== SLIDERS ==========
  document.getElementById('sl-conf').addEventListener('input', function() {
    const v = this.value / 100;
    document.getElementById('lbl-conf').textContent = this.value + '%';
    Detector.setConfidence(v);
    document.getElementById('t-thresh').textContent = this.value;
  });

  document.getElementById('sl-motion').addEventListener('input', function() {
    document.getElementById('lbl-motion').textContent = this.value;
    Tracker.setMotionSensitivity(parseInt(this.value));
  });

  document.getElementById('sl-zoom').addEventListener('input', function() {
    const v = (this.value / 10).toFixed(1);
    document.getElementById('lbl-zoom').textContent = v + 'x';
  });

  // ========== CLICK-TO-LOCK ==========
  document.getElementById('cam-container').addEventListener('click', function(e) {
    if (!autolockOn) return;
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Reticle to clicked pos
    document.querySelector('.reticle-h').style.transform = `translate(${x - rect.width/2}px, ${y - rect.height/2}px) translateX(-50%)`;
    document.querySelector('.reticle-v').style.transform = `translate(${x - rect.width/2}px, ${y - rect.height/2}px) translateY(-50%)`;
  });

  // ========== DEVICE ORIENTATION (pitch/roll) ==========
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', e => {
      if (e.beta != null) document.getElementById('t-pitch').textContent = e.beta.toFixed(1) + '°';
      if (e.gamma != null) document.getElementById('t-roll').textContent = e.gamma.toFixed(1) + '°';
      if (e.alpha != null) document.getElementById('t-heading').textContent = Math.round(e.alpha) + '°';
    });
  }

  console.log('[PANOPTICORE] All systems online');
};
