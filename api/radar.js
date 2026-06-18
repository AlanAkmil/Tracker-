// radar.js — Radar sweep + GPS
window.Radar = (() => {
  let canvas, ctx, angle = 0, animId = null;
  let targets = []; // [{x, y, label, age}]
  let gpsData = null;
  let watchId = null;

  const W = 200, H = 200, CX = 100, CY = 100, R = 90;

  function init() {
    canvas = document.getElementById('radar-canvas');
    ctx = canvas.getContext('2d');
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // BG
    ctx.fillStyle = 'rgba(0,10,0,0.9)';
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI*2); ctx.fill();

    // Grid rings
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(CX, CY, R * i/3, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(0,255,65,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Cross
    ctx.strokeStyle = 'rgba(0,255,65,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(CX - R, CY); ctx.lineTo(CX + R, CY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(CX, CY - R); ctx.lineTo(CX, CY + R); ctx.stroke();

    // Sweep trail
    const trailSteps = 20;
    for (let i = 0; i < trailSteps; i++) {
      const a = angle - (i * Math.PI / 90);
      const alpha = (1 - i/trailSteps) * 0.35;
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.arc(CX, CY, R, a, a + Math.PI/90);
      ctx.closePath();
      ctx.fillStyle = `rgba(0,255,65,${alpha})`;
      ctx.fill();
    }

    // Sweep line
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.lineTo(CX + R * Math.cos(angle), CY + R * Math.sin(angle));
    ctx.strokeStyle = 'rgba(0,255,65,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Targets
    targets = targets.filter(t => t.age < 80);
    targets.forEach(t => {
      const alpha = 1 - t.age/80;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,68,68,${alpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,68,68,${alpha * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(t.x, t.y, 6, 0, Math.PI*2); ctx.stroke();
      // label
      ctx.fillStyle = `rgba(0,255,65,${alpha})`;
      ctx.font = '7px Share Tech Mono';
      ctx.fillText(t.label, t.x + 6, t.y - 3);
      t.age++;
    });

    // Border
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(0,255,65,0.4)'; ctx.lineWidth = 2; ctx.stroke();

    // Center dot
    ctx.beginPath(); ctx.arc(CX, CY, 3, 0, Math.PI*2);
    ctx.fillStyle = '#00ff41'; ctx.fill();

    angle += 0.04;
    animId = requestAnimationFrame(draw);
  }

  function addTarget(label) {
    // Add blip at random position within radar
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * (R - 15) + 5;
    targets.push({
      x: CX + r * Math.cos(a),
      y: CY + r * Math.sin(a),
      label: label.substring(0, 6).toUpperCase(),
      age: 0
    });
    if (targets.length > 12) targets.shift();
  }

  function startGPS() {
    if (!navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(pos => {
      gpsData = pos.coords;
      const lat = pos.coords.latitude.toFixed(5);
      const lon = pos.coords.longitude.toFixed(5);
      const acc = Math.round(pos.coords.accuracy);

      document.getElementById('t-lat').textContent = lat;
      document.getElementById('t-lon').textContent = lon;
      document.getElementById('r-lat').textContent = lat;
      document.getElementById('r-lon').textContent = lon;
      document.getElementById('r-acc').textContent = acc + 'm';
      document.getElementById('sb-gps').textContent = lat + ', ' + lon;

      // heading
      if (pos.coords.heading != null) {
        document.getElementById('t-heading').textContent = Math.round(pos.coords.heading) + '°';
      }
    }, err => {
      document.getElementById('sb-gps').textContent = 'DENIED';
    }, { enableHighAccuracy: true, maximumAge: 2000 });
  }

  function stopGPS() {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  function getGPS() { return gpsData; }

  return { init, addTarget, startGPS, stopGPS, getGPS };
})();