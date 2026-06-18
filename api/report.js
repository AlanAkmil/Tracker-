// report.js — Generate surveillance report
window.Reporter = (() => {

  function generate(sessionData) {
    const {
      startTime, endTime, totalFrames, detectionHistory,
      gpsStart, gpsEnd, sessionCount, motionPeaks
    } = sessionData;

    const duration = endTime && startTime
      ? Math.round((endTime - startTime) / 1000)
      : 0;
    const mins = Math.floor(duration / 60), secs = duration % 60;

    // Count unique classes
    const classCounts = {};
    detectionHistory.forEach(d => {
      classCounts[d.class] = (classCounts[d.class] || 0) + 1;
    });

    // Unique track estimate
    const uniqueTracks = new Set(detectionHistory.map(d =>
      d.class + '_' + Math.round(d.bbox[0]/50) + '_' + Math.round(d.bbox[1]/50)
    )).size;

    // Build report HTML
    let html = `
<div class="r-row"><span class="r-section">// PANOPTICORE SURVEILLANCE REPORT</span></div>
<div class="r-row">REPORT STATUS: <span class="r-val">GENERATED</span></div>
<div class="r-row">TIMESTAMP: <span class="r-val">${new Date().toISOString()}</span></div>
<div class="r-row">SESSION DURATION: <span class="r-val">${mins}m ${secs}s</span></div>
<div class="r-row">TOTAL FRAMES SAMPLED: <span class="r-val">${totalFrames}</span></div>
<div class="r-row">MOTION ACTIVE SAMPLES: <span class="r-val">${motionPeaks}</span></div>
<div class="r-row">TOTAL DETECTIONS: <span class="r-val">${sessionCount}</span></div>
<div class="r-row">UNIQUE OBJECT TRACKS: <span class="r-val">${uniqueTracks}</span></div>
<div class="r-row">PEAK GPS START: <span class="r-val">${gpsStart ? gpsStart.latitude.toFixed(5)+', '+gpsStart.longitude.toFixed(5) : 'N/A'}</span></div>
<div class="r-row">GPS END: <span class="r-val">${gpsEnd ? gpsEnd.latitude.toFixed(5)+', '+gpsEnd.longitude.toFixed(5) : 'N/A'}</span></div>

<div class="r-section">// UNIQUE OBJECT BREAKDOWN</div>`;

    Object.entries(classCounts).sort((a,b) => b[1]-a[1]).forEach(([cls, count]) => {
      html += `<div class="r-row">${cls.toUpperCase().padEnd(20, '.')}<span class="r-val">${count}</span></div>`;
    });

    html += `<div class="r-section">// DETECTION LOG (LAST 20)</div>`;
    const recent = detectionHistory.slice(-20).reverse();
    recent.forEach((d, i) => {
      html += `<div class="r-row">${d.time} &nbsp; <span class="r-val">${d.class.toUpperCase()}</span> &nbsp; ${d.conf}% confidence</div>`;
    });

    if (detectionHistory.length === 0) {
      html += `<div class="r-row" style="color:#ff4444">NO DETECTIONS RECORDED IN THIS SESSION</div>`;
    }

    html += `<div class="r-section">// END OF REPORT</div>`;

    return { html, data: { classCounts, uniqueTracks, duration, sessionCount, detectionHistory, gpsStart, gpsEnd } };
  }

  function downloadTxt(data) {
    const { classCounts, uniqueTracks, duration, sessionCount, detectionHistory } = data;
    let txt = `PANOPTICORE // SURVEILLANCE REPORT\n`;
    txt += `Generated: ${new Date().toISOString()}\n`;
    txt += `Duration: ${Math.floor(duration/60)}m ${duration%60}s\n`;
    txt += `Total Detections: ${sessionCount}\n`;
    txt += `Unique Tracks: ${uniqueTracks}\n\n`;
    txt += `OBJECT BREAKDOWN:\n`;
    Object.entries(classCounts).sort((a,b)=>b[1]-a[1]).forEach(([cls,cnt]) => {
      txt += `  ${cls}: ${cnt}\n`;
    });
    txt += `\nDETECTION LOG:\n`;
    detectionHistory.slice(-50).forEach(d => {
      txt += `  [${d.time}] ${d.class} ${d.conf}%\n`;
    });

    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `panopticore-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadJson(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `panopticore-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { generate, downloadTxt, downloadJson };
})();