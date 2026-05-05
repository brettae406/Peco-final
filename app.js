/* ============================================================
   Peco Lens — Full Application Engine
   ============================================================ */

/* -----------------------------
   CONFIG
----------------------------- */
const GEMINI_API_KEY = "AIzaSyB5rVxiyWUC65w-K_1Jaxfi3XOoij8qgbw";

/* -----------------------------
   GLOBAL STATE
----------------------------- */
let currentLayerIndex = 0;
let currentCardIndex = 0;
let touchStartX = 0;
let touchStartY = 0;
let users = JSON.parse(localStorage.getItem("users")) || {
  "brett": { passcode: "1214", role: "admin", perms: "all" }
};
let activeUser = null;

let profiles = JSON.parse(localStorage.getItem("profiles")) || [];
let historyLog = JSON.parse(localStorage.getItem("history")) || [];
let messages = JSON.parse(localStorage.getItem("messages")) || {};
let pmMatrix = [];
let maintenanceList = [];

/* -----------------------------
   ELEMENTS
----------------------------- */
const loginLayer = document.getElementById("loginLayer");
const appShell = document.getElementById("appShell");
const layerTrack = document.getElementById("layerTrack");

/* ============================================================
   LOGIN SYSTEM
============================================================ */
function login() {
  const u = document.getElementById("loginUsername").value.trim();
  const p = document.getElementById("loginPasscode").value.trim();
  const err = document.getElementById("loginError");

  if (!users[u] || users[u].passcode !== p) {
    err.textContent = "Invalid username or passcode.";
    err.classList.remove("hidden");
    return;
  }

  activeUser = u;
  loginLayer.classList.add("hidden");
  appShell.classList.remove("hidden");
}

/* ============================================================
   LAYER + CARD NAVIGATION
============================================================ */
function openLayer(key) {
  const layers = [...document.querySelectorAll(".layer")];
  const index = layers.findIndex(l => l.dataset.layerKey === key);
  if (index >= 0) {
    currentLayerIndex = index;
    updateLayerPosition();
  }
}

function updateLayerPosition() {
  const h = window.innerHeight;
  layerTrack.style.transform = `translateY(${-currentLayerIndex * h}px)`;
}

function updateCardPosition(track, index) {
  track.style.transform = `translateX(${-index * 100}%)`;
}

/* Touch handling */
document.addEventListener("touchstart", e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
});

document.addEventListener("touchend", e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  const layers = [...document.querySelectorAll(".layer")];
  const currentLayer = layers[currentLayerIndex];
  const track = currentLayer.querySelector(".card-track");
  const cards = [...currentLayer.querySelectorAll(".card")];

  if (absX > absY) {
    if (dx < -40 && currentCardIndex < cards.length - 1) currentCardIndex++;
    if (dx > 40 && currentCardIndex > 0) currentCardIndex--;
    updateCardPosition(track, currentCardIndex);
  } else {
    if (dy < -40 && currentLayerIndex < layers.length - 1) currentLayerIndex++;
    if (dy > 40 && currentLayerIndex > 0) currentLayerIndex--;
    updateLayerPosition();
  }
});

/* ============================================================
   HIGH CONTRAST MODE
============================================================ */
function toggleHighContrast() {
  document.body.classList.toggle("high-contrast");
}

/* ============================================================
   CAMERA + LENS AI
============================================================ */
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    document.getElementById("cameraFeed").srcObject = stream;
  } catch (e) {
    console.error("Camera error:", e);
  }
}
startCamera();

async function captureAndAnalyze() {
  const video = document.getElementById("cameraFeed");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);

  const dataURL = canvas.toDataURL("image/jpeg");
  const analysisBox = document.getElementById("lensAnalysis");
  analysisBox.textContent = "Analyzing…";

  const result = await geminiVision(dataURL);
  analysisBox.textContent = result;
  addHistory("Lens Analysis", result);
}

/* Gemini Vision API */
async function geminiVision(imageData) {
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=" + GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: "Analyze this machine component for faults, wear, alignment, and safety." },
                { inline_data: { mime_type: "image/jpeg", data: imageData.split(",")[1] } }
              ]
            }
          ]
        })
      }
    );

    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
  } catch (e) {
    return "Vision error.";
  }
}

/* ============================================================
   DIAGNOSTICS AI
============================================================ */
async function runDiagnostics() {
  const input = document.getElementById("diagnosticsInput").value.trim();
  const out = document.getElementById("diagnosticsOutput");

  if (!input) return;

  out.textContent = "Analyzing…";

  const result = await geminiText(
    "You are an industrial diagnostics AI. Provide root-cause analysis and corrective actions.\n\nSymptoms:\n" + input
  );

  out.textContent = result;
  addHistory("Diagnostics", result);
}

/* Gemini Text API */
async function geminiText(prompt) {
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
  } catch (e) {
    return "AI error.";
  }
}

/* ============================================================
   PROFILES
============================================================ */
function saveProfile() {
  const name = document.getElementById("profileName").value.trim();
  const loc = document.getElementById("profileLocation").value.trim();
  const notes = document.getElementById("profileNotes").value.trim();

  if (!name) return;

  profiles.push({ name, loc, notes });
  localStorage.setItem("profiles", JSON.stringify(profiles));
  loadProfiles();
}

function clearProfiles() {
  profiles = [];
  localStorage.setItem("profiles", "[]");
  loadProfiles();
}

function loadProfiles() {
  const box = document.getElementById("profilesList");
  box.innerHTML = profiles.map(p =>
    `<div class="profile-item"><strong>${p.name}</strong><br>${p.loc}<br>${p.notes}</div>`
  ).join("");
}
loadProfiles();

/* ============================================================
   HISTORY
============================================================ */
function addHistory(type, text) {
  historyLog.push({ type, text, time: new Date().toLocaleString() });
  localStorage.setItem("history", JSON.stringify(historyLog));
  loadHistory();
}

function clearHistory() {
  historyLog = [];
  localStorage.setItem("history", "[]");
  loadHistory();
}

function loadHistory() {
  const box = document.getElementById("historyList");
  box.innerHTML = historyLog.map(h =>
    `<div class="history-item"><strong>${h.type}</strong><br>${h.text}<br><span>${h.time}</span></div>`
  ).join("");
}
loadHistory();

/* ============================================================
   MESSAGING
============================================================ */
function sendUserMessage() {
  const msg = document.getElementById("chatInput").value.trim();
  if (!msg || !activeUser) return;

  if (!messages[activeUser]) messages[activeUser] = [];
  messages[activeUser].push({ from: activeUser, text: msg, time: Date.now() });

  localStorage.setItem("messages", JSON.stringify(messages));
  loadChat();
}

function loadChat() {
  const box = document.getElementById("chatLog");
  const msgs = messages[activeUser] || [];
  box.innerHTML = msgs.map(m =>
    `<div class="chat-msg"><strong>${m.from}:</strong> ${m.text}</div>`
  ).join("");
}
loadChat();

/* ============================================================
   PM ENGINE
============================================================ */
async function loadPMMatrix() {
  const res = await fetch("matrix.json");
  pmMatrix = await res.json();
  renderPM();
}
loadPMMatrix();

function renderPM() {
  const sys = document.getElementById("pmFilterSystem").value.trim();
  const mach = document.getElementById("pmFilterMachine").value.trim();
  const freq = document.getElementById("pmFilterFrequency").value.trim();

  const list = document.getElementById("pmList");

  const filtered = pmMatrix.filter(row =>
    (!sys || row.System.includes(sys)) &&
    (!mach || row.Machine.includes(mach)) &&
    (!freq || row.Frequency.includes(freq))
  );

  list.innerHTML = filtered.map(r =>
    `<div class="pm-item">
       <strong>${r.PMTask}</strong><br>
       ${r.System} — ${r.Machine}<br>
       Freq: ${r.Frequency}
     </div>`
  ).join("");
}

/* ============================================================
   MATRIX LOG (ADMIN)
============================================================ */
async function loadMatrixLog() {
  const res = await fetch("matrix.json");
  pmMatrix = await res.json();
  renderMatrixLog();
}
loadMatrixLog();

function renderMatrixLog() {
  const body = document.getElementById("matrixLogBody");
  body.innerHTML = pmMatrix.map(r =>
    `<tr>
       <td>${r.ID}</td>
       <td>${r.System}</td>
       <td>${r.Machine}</td>
       <td>${r.Lane}</td>
       <td>${r.Cutter}</td>
       <td>${r.SubAsm}</td>
       <td>${r.Component}</td>
       <td>${r.PMTask}</td>
       <td>${r.Frequency}</td>
       <td>${r.Severity}</td>
       <td>${r.Notes}</td>
     </tr>`
  ).join("");
}

/* ============================================================
   MAINTENANCE
============================================================ */
async function loadMaintenance() {
  const res = await fetch("matrix.json");
  const data = await res.json();
  maintenanceList = data.filter(r => r.Frequency === "Daily");

  const box = document.getElementById("maintenanceList");
  box.innerHTML = maintenanceList.map(m =>
    `<div class="maint-item"><strong>${m.PMTask}</strong><br>${m.Notes}</div>`
  ).join("");
}
loadMaintenance();

/* ============================================================
   TRAINING MODULES
============================================================ */
function loadTrainingModules() {
  const grasselli = document.getElementById("trainingModulesGrasselli");
  grasselli.innerHTML = `
    <button onclick="showTraining('grasselli','Blade Alignment')">Blade Alignment</button>
    <button onclick="showTraining('grasselli','Belt Tracking')">Belt Tracking</button>
    <button onclick="showTraining('grasselli','Fault Codes')">Fault Codes</button>
  `;
}
loadTrainingModules();

async function showTraining(system, module) {
  const box = document.getElementById("trainingContentGrasselli");
  box.textContent = "Loading…";

  const result = await geminiText(
    `Create a technician training module for ${system} — topic: ${module}. Include steps, warnings, and diagrams in text form.`
  );

  box.textContent = result;
}

/* ============================================================
   END OF FILE
============================================================ */
