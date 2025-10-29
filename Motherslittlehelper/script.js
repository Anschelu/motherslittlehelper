import { getDetections } from "./assets/video_process.js";

let weight = 350;         
let rotation = 0;
let size = 60;
let letters = []; 
let wave2Interval = null;    
const video = (window.video = document.getElementById("webcam_canvas"));
const canvas = (window.canvas = document.getElementById("out_canvas"));

const constraints = {
  audio: false,
  video: { width: 1280, height: 720 },
};



function getRawAxis(det, axis) {
  if (!det) return 0;
  if (det.center && typeof det.center[axis] === 'number') return det.center[axis];
  if (typeof det[axis] === 'number') return det[axis];
  if (Array.isArray(det.corners) && det.corners.length) {
    return det.corners.map(c => c[axis]).reduce((a,b)=>Math.min(a,b), Infinity);
  }
  return 0;
}

function mapRange(value, inMin, inMax, outMin, outMax, invert=false) {
  let t = (value - inMin)/(inMax - inMin);
  if (invert) t = 1 - t;
  return outMin + t*(outMax - outMin);
}

//success
function handleSuccess(stream) {
  window.stream = stream;
  video.srcObject = stream;
}

//potential error
function handleError(error) {
  console.log(
    "navigator.MediaDevices.getUserMedia error: ",
    error.message,
    error.name
  );
}
//webcam
navigator.mediaDevices
  .getUserMedia(constraints)
  .then(handleSuccess)
  .catch(handleError);

function angle2DFromCorners(det) {
  if (!det?.corners || det.corners.length < 2) return 0;
  const dx = det.corners[1].x - det.corners[0].x;
  const dy = det.corners[1].y - det.corners[0].y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function wrapTextNodes(node) {
  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 0) {
      const text = child.textContent;
      const fragment = document.createDocumentFragment();

      Array.from(text).forEach(char => {
        const span = document.createElement('span');
        span.className = 'letter';
        span.textContent = char;
        fragment.appendChild(span);
      });

      node.replaceChild(fragment, child);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      wrapTextNodes(child);
    }
  });
}


function wrapLetters() {
  if (window.lettersWrapped) return;
  document.querySelectorAll('.content').forEach(el => wrapTextNodes(el));
  letters = Array.from(document.querySelectorAll('.letter'));
  window.lettersWrapped = true;
}

//tag0
function triggerTilt(detection0) {
  const x = getRawAxis(detection0, 'x');
  const y = getRawAxis(detection0, 'y');
  const nx = x / (video.videoWidth || 1280);
  const ny = y / (video.videoHeight || 720);
  
  const tagAngle = angle2DFromCorners(detection0);

  const gridBox = document.getElementById('layout-grid').getBoundingClientRect();

  letters.forEach((letter) => {
    const rect = letter.getBoundingClientRect();
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.top + rect.bottom) / 2;
    const dx = nx * gridBox.width + gridBox.left - cx;
    const dy = ny * gridBox.height + gridBox.top - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 250) {
      animateLetterTilt(letter, tagAngle, dist);
    }
  });
}

function animateLetterTilt(el, tagAngle, dist) {
  if (el.dataset.animating === "1") return;
  el.dataset.animating = "1";
  
  const rota = tagAngle;
  const weight = mapRange(dist, 0, 300, 700, 300, false);
  const size = mapRange(dist, 0, 250, 100, 0, false); 
  el.style.setProperty('--tilt-rota', rota);
  el.style.setProperty('--tilt-weight', weight);
  el.style.setProperty('--tilt-size', size);
  
  el.classList.add("animate-tilt");

  setTimeout(() => {
    el.classList.remove("animate-tilt");
    el.dataset.animating = "0";
  }, 800);
}


//tag01
function updateLetterPositions(detection) {
if (!detection) return; 
  const x = getRawAxis(detection, 'x');
  const y = getRawAxis(detection, 'y');
  const nx = x / (video.videoWidth || 1280);
  const ny = y / (video.videoHeight || 720);

  const gridBox = document.getElementById('layout-grid').getBoundingClientRect();

  letters.forEach(letter => {
    const rect = letter.getBoundingClientRect();
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.top + rect.bottom) / 2;
    const dx = nx * gridBox.width + gridBox.left - cx;
    const dy = ny * gridBox.height + gridBox.top - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 100) animateLetter(letter);
  });
}

function animateLetter(el) {
  if (el.dataset.animating === "1") return;
  el.dataset.animating = "1";
  el.classList.add("animate-letter");

  setTimeout(() => {
    el.classList.remove("animate-letter");
    el.dataset.animating = "0";
  }, 800);
}


//tag2
function triggerWave2(detection2) {
  const x = getRawAxis(detection2, 'x');
  const y = getRawAxis(detection2, 'y');
  const nx = x / (video.videoWidth || 1280);
  const ny = y / (video.videoHeight || 720);
  const tagAngle = angle2DFromCorners(detection2) * (Math.PI / 180);

  const gridBox = document.getElementById('layout-grid').getBoundingClientRect();
  const tagX = nx * gridBox.width + gridBox.left;
  const tagY = ny * gridBox.height + gridBox.top;

  const dirX = Math.cos(tagAngle);
  const dirY = Math.sin(tagAngle);

  letters.forEach(letter => {
    const rect = letter.getBoundingClientRect();
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.top + rect.bottom) / 2;

    const dx = cx - tagX;
    const dy = cy - tagY;

    const dist = Math.sqrt(dx * dx + dy * dy);

    const proj = dx * dirX + dy * dirY; 
    const delay = mapRange(proj, -400, 400, 800, 0, true) + dist * 2;

    setTimeout(() => animateLetterWeight(letter), Math.max(0, delay));
  });
}

function animateLetterWeight(el) {

  if (el.dataset.animating === "1") return;
  el.dataset.animating = "1";
  el.classList.add("animate-letter-weight");

  setTimeout(() => {
    el.classList.remove("animate-letter-weight");
    el.dataset.animating = "0";
  }, 800);
}


//tag03
let isBlack = false;
let colorInterval = null;
let breatheInterval = null;

function toggleColor() {
  const swapColor = document.getElementById('layout-grid');

  if (isBlack) {
    swapColor.style.backgroundColor = "white";
    swapColor.style.color = "black";
  } else {
    swapColor.style.backgroundColor = "black";
    swapColor.style.color = "white";
  }
  isBlack = !isBlack;
}

let audioStarted = false;
const bgMusic = document.getElementById('bgMusic');


//loop function
function loop() {
  requestAnimationFrame(loop);

  const detections = getDetections();
   const ids = detections.map((d) => d.id);

  wrapLetters();

  const detection0 = detections.find(d => d.id === 0);
  const detection1 = detections.find(d => d.id === 1);
  const detection2 = detections.find(d => d.id === 2);
  const detection3 = detections.find(d => d.id === 3);

if (detection0) {
  triggerTilt(detection0);
}
  updateLetterPositions(detection1);

if (detection2 && !wave2Interval) {
  triggerWave2(detection2);
  wave2Interval = setInterval(() => triggerWave2(detection2), 800); 
}

if (!detection2 && wave2Interval) {
  clearInterval(wave2Interval);
  wave2Interval = null;
}

if (detection3 && !colorInterval) {
    colorInterval = setInterval(toggleColor, 800);
    
    if (!audioStarted && bgMusic) {
      bgMusic.play().catch(err => console.log('Audio play failed:', err));
      audioStarted = true;
    }
  }

  if (!detection3 && colorInterval) {
    clearInterval(colorInterval);
    colorInterval = null;
  }
}

loop();


