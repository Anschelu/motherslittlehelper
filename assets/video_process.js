import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";
import * as Base64 from "./base64.js";

var detections = [];
var imgSaveRequested = 0;

// stato per smoothing
let smoothCenters = {};
let smoothAngles = {};
const alpha = 0.2; // 0.1 = più stabile, 0.3 = più reattivo

window.onload = () => {
  init();
  loadImg("saved_det");
};

async function init() {
  const Apriltag = Comlink.wrap(new Worker("./assets/apriltag.js"));

  window.apriltag = await new Apriltag(
    Comlink.proxy(() => {
      window.apriltag.set_tag_size(5, 0.5);
      window.requestAnimationFrame(process_frame);
    })
  );
}

// smoothing centro
function smoothCenterValue(id, current) {
  if (!smoothCenters[id]) {
    smoothCenters[id] = { x: current.x, y: current.y };
    return current;
  }
  smoothCenters[id].x = alpha * current.x + (1 - alpha) * smoothCenters[id].x;
  smoothCenters[id].y = alpha * current.y + (1 - alpha) * smoothCenters[id].y;
  return { ...smoothCenters[id] };
}

// smoothing angolo
function smoothAngleValue(id, currentAngle) {
  if (!smoothAngles[id] && smoothAngles[id] !== 0) {
    smoothAngles[id] = currentAngle;
    return currentAngle;
  }
  smoothAngles[id] =
    alpha * currentAngle + (1 - alpha) * smoothAngles[id];
  return smoothAngles[id];
}

async function process_frame() {
  const canvas = window.canvas;             // come nel tuo codice che funziona
  const video = window.video;              // come nel tuo codice che funziona

  // ⬇️ [AGGIUNTA] canvas a colori
  const canvasColor = document.getElementById("out_canvas_colors");
  const ctxColor = canvasColor ? canvasColor.getContext("2d") : null;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  if (canvasColor) {
    canvasColor.width = video.videoWidth;
    canvasColor.height = video.videoHeight;
  }

  const ctx = canvas.getContext("2d");

  let imageData;
  try {
    // ⬇️ [AGGIUNTA] disegno il frame a colori sul canvasColor (solo visualizzazione)
    if (ctxColor) ctxColor.drawImage(video, 0, 0, canvasColor.width, canvasColor.height);

    // flusso originale (grayscale + detect)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);


    //my Code: mirror cam not working! 
    // ctx.setTransform(-1, 0, 0, 1, canvas.width, 0);
    // ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform

    // if (ctxColor) {
    //   ctxColor.setTransform(-1, 0, 0, 1, canvasColor.width, 0);
    //   ctxColor.drawImage(video, 0, 0, canvasColor.width, canvasColor.height);
    //   ctxColor.setTransform(1, 0, 0, 1, 0, 0); // reset
    // }


    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch (err) {
    console.log("Failed to get video frame. Video not started ?");
    setTimeout(process_frame, 500);
    return;
  }

  // grayscale (identico al tuo)
  let imageDataPixels = imageData.data;
  let grayscalePixels = new Uint8Array(ctx.canvas.width * ctx.canvas.height);
  for (var i = 0, j = 0; i < imageDataPixels.length; i += 4, j++) {
    let grayscale = Math.round(
      (imageDataPixels[i] + imageDataPixels[i + 1] + imageDataPixels[i + 2]) / 3
    );
    grayscalePixels[j] = grayscale;
    imageDataPixels[i] = grayscale;
    imageDataPixels[i + 1] = grayscale;
    imageDataPixels[i + 2] = grayscale;
  }
  ctx.putImageData(imageData, 0, 0);

  // draw previous detection (➜ ora su entrambi i canvas)
  detections.forEach((det) => {
    const smoothedCenter = smoothCenterValue(det.id, det.center);

    // calcolo angolo raw
    const dx = det.corners[1].x - det.corners[0].x;
    const dy = det.corners[1].y - det.corners[0].y;
    let angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;

    // smoothing angolo
    let smoothedAngle = smoothAngleValue(det.id, angleDeg);

    // ⬇️ [AGGIUNTA] disegna overlay sia sul grigio (ctx) sia sul colore (ctxColor se esiste)
    const targets = ctxColor ? [ctx, ctxColor] : [ctx];
    targets.forEach((c) => {
      // disegna bordo
      c.beginPath();
      c.lineWidth = 5;
      c.strokeStyle = "blue";
      c.moveTo(det.corners[0].x, det.corners[0].y);
      c.lineTo(det.corners[1].x, det.corners[1].y);
      c.lineTo(det.corners[2].x, det.corners[2].y);
      c.lineTo(det.corners[3].x, det.corners[3].y);
      c.closePath();
      c.stroke();

      // scrivi ID + angolo
      c.font = "bold 18px Arial";
      c.fillStyle = "blue";
      c.textAlign = "center";
      c.fillText(`ID: ${det.id}`, smoothedCenter.x, smoothedCenter.y + 5);
      c.fillText(`${smoothedAngle.toFixed(1)}°`, smoothedCenter.x, smoothedCenter.y + 25);

      // freccia
      drawArrow(c, smoothedCenter.x, smoothedCenter.y, smoothedAngle);
    });
  });

  // detect aprilTag (identico al tuo)
  detections = await apriltag.detect(
    grayscalePixels,
    ctx.canvas.width,
    ctx.canvas.height
  );

  window.requestAnimationFrame(process_frame);
}

// funzione per disegnare freccia
function drawArrow(ctx, x, y, angleDeg) {
  const angleRad = (angleDeg * Math.PI) / 180;
  const length = 50; // lunghezza freccia

  const x2 = x + length * Math.cos(angleRad);
  const y2 = y + length * Math.sin(angleRad);

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = "red";
  ctx.lineWidth = 3;
  ctx.stroke();

  // punta della freccia
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - 10 * Math.cos(angleRad - Math.PI / 6),
    y2 - 10 * Math.sin(angleRad - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - 10 * Math.cos(angleRad + Math.PI / 6),
    y2 - 10 * Math.sin(angleRad + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fillStyle = "red";
  ctx.fill();
}

async function loadImg(targetHtmlElemId) {
  var detectData = localStorage.getItem("detectData");
  if (detectData) {
    let detectDataObj = JSON.parse(detectData);
    let savedPixels = Base64.base64ToBytes(
      LZString.decompressFromUTF16(detectDataObj.img_data)
    );
    delete detectDataObj.img_data;
  } else console.log("detectData not found");
}

export function getDetections() { return detections; }