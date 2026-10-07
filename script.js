/**
 * ==============================================================================
 * EchoLabs Voice Studio - ElevenLabs Text-to-Speech Frontend Engine
 * ==============================================================================
 * Handles:
 * 1. ElevenLabs API communication via secure backend proxy
 * 2. Dynamic voice loading and metadata parsing
 * 3. Audio generation, streaming playback, and Web Audio API visualizer
 * 4. User interface state management, text metrics, and history preservation
 */

// Preset fallback voices (official ElevenLabs default voices)
// Used when the server API key is not yet configured or during initial load
const FALLBACK_VOICES = [
  {
    voice_id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    category: "premade",
    labels: { accent: "American", description: "Calm & Natural", use_case: "Narration" },
    preview_url: "https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6788f9-5c96-470d-8312-aab3b3d8f50a.mp3"
  },
  {
    voice_id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam",
    category: "premade",
    labels: { accent: "American", description: "Deep & Warm", use_case: "Audiobook" },
    preview_url: "https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/6f882877-3e0c-4ec7-8730-ee0fc7193af4.mp3"
  },
  {
    voice_id: "ErXwobaYiN019PkySvjV",
    name: "Antoni",
    category: "premade",
    labels: { accent: "American", description: "Well-rounded & Friendly", use_case: "Narration" },
    preview_url: "https://storage.googleapis.com/eleven-public-prod/premade/voices/ErXwobaYiN019PkySvjV/38d8f874-9e83-4770-b1ee-8263725b8782.mp3"
  },
  {
    voice_id: "EXAVITQu4vr4xnSDxMaL",
    name: "Bella",
    category: "premade",
    labels: { accent: "American", description: "Expressive & Soft", use_case: "Storytelling" },
    preview_url: "https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/092f7478-9585-4b36-a837-14e3b1c6d37a.mp3"
  },
  {
    voice_id: "IKne3meq5aSn9X8L47AE",
    name: "Charlie",
    category: "premade",
    labels: { accent: "Australian", description: "Casual & Confident", use_case: "Conversational" },
    preview_url: "https://storage.googleapis.com/eleven-public-prod/premade/voices/IKne3meq5aSn9X8L47AE/276e03a9-0639-4458-94ff-cb72235cf6d4.mp3"
  },
  {
    voice_id: "AZnzlk1XvdvUeBnXmlld",
    name: "Domi",
    category: "premade",
    labels: { accent: "American", description: "Emphatic & Strong", use_case: "Commercials" },
    preview_url: "https://storage.googleapis.com/eleven-public-prod/premade/voices/AZnzlk1XvdvUeBnXmlld/50dd6190-8810-44be-9290-7f920f865917.mp3"
  },
  {
    voice_id: "MF3mGyEYCl7XYWbV9V6O",
    name: "Elli",
    category: "premade",
    labels: { accent: "American", description: "Youthful & Clear", use_case: "Characters" },
    preview_url: "https://storage.googleapis.com/eleven-public-prod/premade/voices/MF3mGyEYCl7XYWbV9V6O/d8ec301c-ea45-422e-a579-2479e3940be0.mp3"
  },
  {
    voice_id: "TxGEqnHWrfWFTfGW9XjX",
    name: "Josh",
    category: "premade",
    labels: { accent: "American", description: "Young & Resonant", use_case: "Social Media" },
    preview_url: "https://storage.googleapis.com/eleven-public-prod/premade/voices/TxGEqnHWrfWFTfGW9XjX/3e7054a4-569b-4467-8147-49e0a0d48123.mp3"
  }
];

// Sample Texts for Quick Prompt Buttons
const SAMPLE_TEXTS = {
  audiobook: "The ancient library stretched into the twilight, towering shelves filled with leather-bound codices whispering secrets of centuries past. Elena ran her fingers over the weathered parchment, sensing that tonight, she would finally unearth the map to the lost observatory.",
  announcement: "Good evening. Welcome to the global technology briefing. Today, researchers unveiled a breakthrough architecture in neural audio synthesis, delivering unprecedented emotional fidelity and real-time responsiveness.",
  conversational: "Hey there! I was just reviewing the new design draft you sent over. The typography and color palette look incredible! Whenever you're free, let's sync up for five minutes to finalize the launch schedule.",
  quote: "The future does not belong to those who wait for certainty. It belongs to the daring minds who imagine what could be, and relentlessly build it into reality."
};

/**
 * Global Studio Application State
 */
const AppState = {
  isConfigured: false,
  apiKey: sessionStorage.getItem("elevenlabs_temp_key") || "",
  voices: [...FALLBACK_VOICES],
  currentVoiceId: "21m00Tcm4TlvDq8ikWAM",
  currentModelId: "eleven_multilingual_v2",
  isGenerating: false,
  isPlaying: false,
  currentAudioBlob: null,
  currentAudioUrl: null,
  audioDuration: 0,
  voicePreviewAudio: null,
  history: JSON.parse(localStorage.getItem("elevenlabs_history") || "[]")
};

// Web Audio API Visualizer Context & Nodes
let audioCtx = null;
let analyserNode = null;
let audioSourceNode = null;
let animationFrameId = null;

/* ==============================================================================
   DOM Elements Cache
   ============================================================================== */
const DOM = {
  // Navigation & Status
  apiStatusBadge: document.getElementById("apiStatusBadge"),
  settingsBtn: document.getElementById("settingsBtn"),
  keyAlertBanner: document.getElementById("keyAlertBanner"),
  openSettingsFromBanner: document.getElementById("openSettingsFromBanner"),

  // Text Area & Statistics
  ttsTextInput: document.getElementById("ttsTextInput"),
  charCount: document.getElementById("charCount"),
  wordCount: document.getElementById("wordCount"),
  estimatedDuration: document.getElementById("estimatedDuration"),
  pasteBtn: document.getElementById("pasteBtn"),
  clearTextBtn: document.getElementById("clearTextBtn"),
  sampleChips: document.querySelectorAll(".sample-chip"),

  // Voice & Model Selectors
  voiceSelect: document.getElementById("voiceSelect"),
  voiceBadge: document.getElementById("voiceBadge"),
  previewVoiceBtn: document.getElementById("previewVoiceBtn"),
  previewIcon: document.getElementById("previewIcon"),
  voiceCategory: document.getElementById("voiceCategory"),
  voiceLabels: document.getElementById("voiceLabels"),
  modelSelect: document.getElementById("modelSelect"),
  modelBadge: document.getElementById("modelBadge"),
  modelDescription: document.getElementById("modelDescription"),
  engineSelect: document.getElementById("engineSelect"),
  engineBadge: document.getElementById("engineBadge"),
  engineDescription: document.getElementById("engineDescription"),
  refreshVoicesBtn: document.getElementById("refreshVoicesBtn"),

  // Advanced Sliders
  stabilitySlider: document.getElementById("stabilitySlider"),
  stabilityValue: document.getElementById("stabilityValue"),
  similaritySlider: document.getElementById("similaritySlider"),
  similarityValue: document.getElementById("similarityValue"),
  styleSlider: document.getElementById("styleSlider"),
  styleValue: document.getElementById("styleValue"),
  speakerBoostToggle: document.getElementById("speakerBoostToggle"),
  resetVoiceSettingsBtn: document.getElementById("resetVoiceSettingsBtn"),

  // Action Buttons & Progress Bar
  playBtn: document.getElementById("playBtn"),
  playBtnText: document.getElementById("playBtnText"),
  playBtnIcon: document.getElementById("playBtnIcon"),
  stopBtn: document.getElementById("stopBtn"),
  processingIndicator: document.getElementById("processingIndicator"),
  processingStatusText: document.getElementById("processingStatusText"),

  // Player & Visualizer
  visualizerCanvas: document.getElementById("visualizerCanvas"),
  visualizerOverlay: document.getElementById("visualizerOverlay"),
  engineNoticeBanner: document.getElementById("engineNoticeBanner"),
  engineNoticeText: document.getElementById("engineNoticeText"),
  fixKeyBtn: document.getElementById("fixKeyBtn"),
  audioElement: document.getElementById("audioElement"),
  activeVoicePill: document.getElementById("activeVoicePill"),
  currentTime: document.getElementById("currentTime"),
  totalDuration: document.getElementById("totalDuration"),
  seekSlider: document.getElementById("seekSlider"),
  seekProgressFill: document.getElementById("seekProgressFill"),
  audioPlayPauseBtn: document.getElementById("audioPlayPauseBtn"),
  audioPlayPauseIcon: document.getElementById("audioPlayPauseIcon"),
  skipBackBtn: document.getElementById("skipBackBtn"),
  skipForwardBtn: document.getElementById("skipForwardBtn"),
  playbackRateSelect: document.getElementById("playbackRateSelect"),
  volumeSlider: document.getElementById("volumeSlider"),
  muteBtn: document.getElementById("muteBtn"),
  volumeIcon: document.getElementById("volumeIcon"),
  downloadBtn: document.getElementById("downloadBtn"),

  // History & Toasts
  historyList: document.getElementById("historyList"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  toastContainer: document.getElementById("toastContainer"),

  // Modal Dialog
  settingsModal: document.getElementById("settingsModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  toggleKeyVisibility: document.getElementById("toggleKeyVisibility"),
  modalStatusDot: document.getElementById("modalStatusDot"),
  modalStatusText: document.getElementById("modalStatusText"),
  modalKeyPreview: document.getElementById("modalKeyPreview"),
  diagnosticResults: document.getElementById("diagnosticResults"),
  diagStatusBadge: document.getElementById("diagStatusBadge"),
  diagTitle: document.getElementById("diagTitle"),
  diagDetails: document.getElementById("diagDetails"),
  testKeyBtn: document.getElementById("testKeyBtn"),
  testKeySpinner: document.getElementById("testKeySpinner"),
  saveKeyBtn: document.getElementById("saveKeyBtn")
};

/* ==============================================================================
   Application Initialization
   ============================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initializeUI();
  attachEventListeners();
  checkBackendStatus();
  renderHistory();
});

function initializeUI() {
  populateVoicesDropdown(AppState.voices);
  updateTextMetrics();
  initVisualizerCanvas();
}

/* ==============================================================================
   ElevenLabs API Backend Proxy Integration
   ============================================================================== */

/**
 * Checks if the backend server has an active ElevenLabs API key in .env
 */
async function checkBackendStatus() {
  updateStatusBadge("checking", "Checking API...");

  try {
    const res = await fetch("/api/status");
    const raw = await res.text();
    let data = {};
    try { data = JSON.parse(raw); } catch {}

    if (!res.ok) throw new Error(data.message || `Backend server unreachable (${res.status})`);

    if (data.configured || AppState.apiKey) {
      AppState.isConfigured = true;
      updateStatusBadge("connected", "ElevenLabs Ready");
      DOM.keyAlertBanner.classList.add("hidden");
      
      // Load actual dynamic voices from ElevenLabs account
      await fetchDynamicVoices();
    } else {
      AppState.isConfigured = false;
      updateStatusBadge("warning", "API Key Required");
      DOM.keyAlertBanner.classList.remove("hidden");
    }
  } catch (err) {
    console.warn("Server status check note:", err.message);
    if (AppState.apiKey) {
      AppState.isConfigured = true;
      updateStatusBadge("connected", "Client Key Active");
      await fetchDynamicVoices();
    } else {
      updateStatusBadge("warning", "Offline / No Key");
      DOM.keyAlertBanner.classList.remove("hidden");
    }
  }
}

/**
 * Dynamically fetches all voices belonging to the account via /api/voices
 */
async function fetchDynamicVoices() {
  try {
    const headers = {};
    if (AppState.apiKey) {
      headers["xi-api-key"] = AppState.apiKey;
    }

    const res = await fetch("/api/voices", { headers });
    const raw = await res.text();
    let data = {};
    try { data = JSON.parse(raw); } catch {}

    if (!res.ok) {
      throw new Error(data.message || `Failed to load voices (${res.status})`);
    }

    if (data.voices && Array.isArray(data.voices) && data.voices.length > 0) {
      AppState.voices = data.voices;
      populateVoicesDropdown(data.voices);
      if (data.source !== "fallback") {
        showToast(`Loaded ${data.voices.length} voices from ElevenLabs`, "success");
      }
    }
  } catch (err) {
    console.warn("Using fallback voices:", err.message);
    // Keep using FALLBACK_VOICES
    populateVoicesDropdown(FALLBACK_VOICES);
  }
}

/**
 * Converts text into lifelike speech using ElevenLabs Text-to-Speech API
 * with instant, high-fidelity local fallback if key permissions are limited.
 */
async function generateSpeech() {
  const text = DOM.ttsTextInput.value.trim();
  
  if (!text) {
    showToast("Please enter or paste text to synthesize.", "warning");
    DOM.ttsTextInput.focus();
    return;
  }

  // Set generating UI state
  setGeneratingState(true);
  updateProcessingStatus("Preparing speech engine...");

  const voiceId = DOM.voiceSelect.value || AppState.currentVoiceId;
  const modelId = DOM.modelSelect.value || AppState.currentModelId;
  const engineMode = DOM.engineSelect ? DOM.engineSelect.value : "auto";
  const forceLocal = engineMode === "local";

  // Gather voice tuning parameters
  const voiceSettings = {
    stability: parseFloat(DOM.stabilitySlider.value),
    similarity_boost: parseFloat(DOM.similaritySlider.value),
    style: parseFloat(DOM.styleSlider.value),
    use_speaker_boost: DOM.speakerBoostToggle.checked
  };

  const payload = {
    text: text,
    voice_id: voiceId,
    model_id: modelId,
    voice_settings: voiceSettings,
    force_local: forceLocal
  };

  try {
    const statusLabel = forceLocal ? "Generating using Built-in Voice Engine..." : "Synthesizing audio...";
    updateProcessingStatus(statusLabel);
    
    const headers = {
      "Content-Type": "application/json"
    };
    if (AppState.apiKey) {
      headers["xi-api-key"] = AppState.apiKey;
    }

    const startTime = performance.now();
    const response = await fetch("/api/tts", {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorMsg = `Server error (${response.status})`;
      try {
        const errText = await response.text();
        try {
          const errorJson = JSON.parse(errText);
          errorMsg = errorJson.message || errorJson.detail?.message || errorMsg;
        } catch {
          if (errText && errText.trim()) {
            errorMsg = errText.trim();
          }
        }
      } catch (readErr) {
        console.warn("Could not read error response:", readErr);
      }
      throw new Error(errorMsg);
    }

    // Inspect server metadata headers
    const engine = response.headers.get("X-TTS-Engine") || "elevenlabs";
    const notice = response.headers.get("X-TTS-Notice") || "";
    const elevenError = response.headers.get("X-ElevenLabs-Error") || "";

    updateProcessingStatus("Loading audio into studio player...");
    const audioBlob = await response.blob();
    const durationSec = ((performance.now() - startTime) / 1000).toFixed(1);

    // Revoke old URL if present
    if (AppState.currentAudioUrl) {
      URL.revokeObjectURL(AppState.currentAudioUrl);
    }

    AppState.currentAudioBlob = audioBlob;
    AppState.currentAudioUrl = URL.createObjectURL(audioBlob);

    // Load into HTML5 Audio Player
    DOM.audioElement.src = AppState.currentAudioUrl;
    DOM.audioElement.load();

    // Enable player controls
    enablePlayerControls(true);

    const activeVoice = AppState.voices.find(v => v.voice_id === voiceId);
    const voiceName = activeVoice ? activeVoice.name : "Voice";

    if (engine === "fallback-local") {
      DOM.activeVoicePill.textContent = `${voiceName} • Local Voice Engine`;
      DOM.activeVoicePill.className = "badge-tag badge-fallback";

      if (DOM.engineNoticeBanner) {
        DOM.engineNoticeBanner.classList.remove("hidden");
        if (DOM.engineNoticeText) {
          DOM.engineNoticeText.textContent = notice || "Speech produced using Built-in Voice Engine. (ElevenLabs key is restricted).";
        }
      }

      showToast("Audio produced via Built-in Engine (ElevenLabs key missing permission)", "warning");
    } else {
      DOM.activeVoicePill.textContent = `${voiceName} • ElevenLabs AI (${getModelLabel(modelId)})`;
      DOM.activeVoicePill.className = "badge-tag badge-elevenlabs";

      if (DOM.engineNoticeBanner) {
        DOM.engineNoticeBanner.classList.add("hidden");
      }

      showToast(`Synthesized with ElevenLabs in ${durationSec}s!`, "success");
    }

    // Add to history
    addToHistory({
      text: text,
      voiceName: voiceName,
      voiceId: voiceId,
      modelId: modelId,
      engine: engine,
      blob: audioBlob,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    // Automatically trigger playback
    try {
      await playAudio();
    } catch (playErr) {
      console.log("Autoplay note:", playErr);
    }

  } catch (err) {
    console.error("TTS generation error:", err);
    showToast(err.message, "error");
  } finally {
    setGeneratingState(false);
  }
}

/* ==============================================================================
   Audio Playback & Control System
   ============================================================================== */

async function playAudio() {
  if (!DOM.audioElement.src) return;

  // Initialize Web Audio Context for visualizer if not created
  initAudioContext();

  try {
    await DOM.audioElement.play();
    AppState.isPlaying = true;
    updatePlayPauseButtonIcon(true);
    DOM.stopBtn.disabled = false;
    DOM.visualizerOverlay.classList.add("hidden");
    startVisualizerLoop();
  } catch (err) {
    console.warn("Playback issue:", err);
  }
}

function pauseAudio() {
  DOM.audioElement.pause();
  AppState.isPlaying = false;
  updatePlayPauseButtonIcon(false);
}

function stopAudio() {
  DOM.audioElement.pause();
  DOM.audioElement.currentTime = 0;
  AppState.isPlaying = false;
  updatePlayPauseButtonIcon(false);
  DOM.stopBtn.disabled = true;
  DOM.seekSlider.value = 0;
  DOM.seekProgressFill.style.width = "0%";
  DOM.currentTime.textContent = "0:00";
}

function togglePlayPause() {
  if (DOM.audioElement.paused) {
    playAudio();
  } else {
    pauseAudio();
  }
}

function updatePlayPauseButtonIcon(isPlaying) {
  if (isPlaying) {
    DOM.audioPlayPauseIcon.innerHTML = `
      <rect x="6" y="4" width="4" height="16" rx="1"/>
      <rect x="14" y="4" width="4" height="16" rx="1"/>
    `;
  } else {
    DOM.audioPlayPauseIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3" />`;
  }
}

function enablePlayerControls(enabled) {
  DOM.audioPlayPauseBtn.disabled = !enabled;
  DOM.skipBackBtn.disabled = !enabled;
  DOM.skipForwardBtn.disabled = !enabled;
  DOM.seekSlider.disabled = !enabled;
  DOM.playbackRateSelect.disabled = !enabled;
  DOM.downloadBtn.disabled = !enabled;
  DOM.stopBtn.disabled = !enabled;
}

/* ==============================================================================
   Web Audio API Waveform Visualizer
   ============================================================================== */

function initAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 128;
      analyserNode.smoothingTimeConstant = 0.8;

      try {
        audioSourceNode = audioCtx.createMediaElementSource(DOM.audioElement);
        audioSourceNode.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);
      } catch (e) {
        console.warn("MediaElementSource note:", e.message);
      }
    }
  }

  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function initVisualizerCanvas() {
  const canvas = DOM.visualizerCanvas;
  const ctx = canvas.getContext("2d");
  drawIdleVisualizer(ctx, canvas.width, canvas.height);
}

function drawIdleVisualizer(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  const bars = 48;
  const barWidth = width / bars;
  
  for (let i = 0; i < bars; i++) {
    const x = i * barWidth;
    const h = 4 + Math.sin(i * 0.3) * 3;
    const y = (height - h) / 2;
    ctx.fillStyle = "rgba(99, 102, 241, 0.2)";
    ctx.fillRect(x + 1, y, barWidth - 2, h);
  }
}

function startVisualizerLoop() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  const canvas = DOM.visualizerCanvas;
  const ctx = canvas.getContext("2d");
  const bufferLength = analyserNode ? analyserNode.frequencyBinCount : 32;
  const dataArray = new Uint8Array(bufferLength);

  function renderFrame() {
    if (!AppState.isPlaying) {
      drawIdleVisualizer(ctx, canvas.width, canvas.height);
      return;
    }

    animationFrameId = requestAnimationFrame(renderFrame);

    if (analyserNode) {
      analyserNode.getByteFrequencyData(dataArray);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barCount = 48;
    const barWidth = canvas.width / barCount;

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * bufferLength);
      const value = dataArray[dataIndex] || 0;
      const percent = value / 255;
      const barHeight = Math.max(4, percent * (canvas.height - 12));
      const x = i * barWidth;
      const y = (canvas.height - barHeight) / 2;

      // Dynamic Indigo to Cyan Gradient
      const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
      grad.addColorStop(0, "#38bdf8");
      grad.addColorStop(0.5, "#818cf8");
      grad.addColorStop(1, "#c084fc");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x + 1.5, y, barWidth - 3, barHeight, 2);
      ctx.fill();
    }
  }

  renderFrame();
}

/* ==============================================================================
   UI Population & Dropdowns
   ============================================================================== */

function populateVoicesDropdown(voices) {
  DOM.voiceSelect.innerHTML = "";

  voices.forEach(voice => {
    const opt = document.createElement("option");
    opt.value = voice.voice_id;
    
    // Extract accent and gender if present in labels
    let labelInfo = "";
    if (voice.labels) {
      const parts = [];
      if (voice.labels.accent) parts.push(voice.labels.accent);
      if (voice.labels.gender) parts.push(voice.labels.gender);
      if (voice.labels["use case"] || voice.labels.use_case) {
        parts.push(voice.labels["use case"] || voice.labels.use_case);
      }
      if (parts.length > 0) labelInfo = ` (${parts.join(", ")})`;
    }
    
    opt.textContent = `${voice.name}${labelInfo}`;
    if (voice.voice_id === AppState.currentVoiceId) {
      opt.selected = true;
    }
    DOM.voiceSelect.appendChild(opt);
  });

  updateVoiceMetadata(AppState.currentVoiceId);
}

function updateVoiceMetadata(voiceId) {
  const voice = AppState.voices.find(v => v.voice_id === voiceId);
  if (!voice) return;

  AppState.currentVoiceId = voiceId;
  DOM.voiceCategory.textContent = voice.category || "Pre-made Voice";

  if (voice.labels && Object.keys(voice.labels).length > 0) {
    const tagStrings = Object.entries(voice.labels)
      .map(([k, v]) => `${capitalize(k)}: ${v}`)
      .join(" • ");
    DOM.voiceLabels.textContent = tagStrings;
  } else {
    DOM.voiceLabels.textContent = voice.description || "High-clarity neural voice";
  }

  // Update preview sample button availability
  if (voice.preview_url) {
    DOM.previewVoiceBtn.disabled = false;
    DOM.previewVoiceBtn.title = `Listen to sample of ${voice.name}`;
  } else {
    DOM.previewVoiceBtn.disabled = true;
    DOM.previewVoiceBtn.title = "No sample audio available for this voice";
  }
}

function updateModelMetadata(modelId) {
  AppState.currentModelId = modelId;
  const descriptions = {
    eleven_multilingual_v2: "Best quality for nuanced emotion, diverse accents, and multilingual storytelling.",
    eleven_turbo_v2_5: "Optimized for high-throughput and ultra-low latency interactive applications.",
    eleven_flash_v2_5: "Fastest response times and lightweight compute for rapid voiceover needs.",
    eleven_monolingual_v1: "Classic English-only model designed for consistent American and British tones."
  };
  DOM.modelDescription.textContent = descriptions[modelId] || "ElevenLabs advanced neural speech model.";
}

function getModelLabel(modelId) {
  const labels = {
    eleven_multilingual_v2: "Multilingual v2",
    eleven_turbo_v2_5: "Turbo v2.5",
    eleven_flash_v2_5: "Flash v2.5",
    eleven_monolingual_v1: "Monolingual v1"
  };
  return labels[modelId] || modelId;
}

/* ==============================================================================
   Text Editor Helpers & Metrics
   ============================================================================== */

function updateTextMetrics() {
  const text = DOM.ttsTextInput.value;
  const len = text.length;
  DOM.charCount.textContent = `${len.toLocaleString()} / 5,000 chars`;

  // Words calculation
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  DOM.wordCount.textContent = `${words.toLocaleString()} words`;

  // Estimated Duration (~150 words per minute / 2.5 words per sec)
  const estSec = Math.round(words / 2.5);
  DOM.estimatedDuration.textContent = `~${estSec}s audio`;

  // Visual warning near limits
  if (len > 4800) {
    DOM.charCount.style.color = "#f43f5e";
  } else {
    DOM.charCount.style.color = "";
  }
}

/* ==============================================================================
   History & Download Management
   ============================================================================== */

function addToHistory(item) {
  // Store the item in AppState
  AppState.history.unshift(item);
  if (AppState.history.length > 8) {
    AppState.history.pop();
  }

  // Save lightweight metadata to localStorage (without binary blob)
  const serialized = AppState.history.map(h => ({
    text: h.text,
    voiceName: h.voiceName,
    voiceId: h.voiceId,
    modelId: h.modelId,
    timestamp: h.timestamp
  }));
  localStorage.setItem("elevenlabs_history", JSON.stringify(serialized));

  renderHistory();
}

function renderHistory() {
  DOM.historyList.innerHTML = "";

  if (AppState.history.length === 0) {
    DOM.historyList.innerHTML = `
      <div class="history-empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 14 14"/>
        </svg>
        <p>Your synthesized voice history will appear here.</p>
      </div>
    `;
    return;
  }

  AppState.history.forEach((item, idx) => {
    const el = document.createElement("div");
    el.className = "history-item";

    const excerpt = item.text.length > 60 ? item.text.substring(0, 57) + "..." : item.text;

    el.innerHTML = `
      <div class="history-info">
        <span class="history-text" title="${escapeHtml(item.text)}">${escapeHtml(excerpt)}</span>
        <span class="history-meta">${item.voiceName} • ${getModelLabel(item.modelId)} • ${item.timestamp}</span>
      </div>
      <div class="history-actions">
        <button class="btn-subtle btn-xs" data-index="${idx}" title="Restore text into editor" type="button">
          Load
        </button>
      </div>
    `;

    // Load button listener
    const loadBtn = el.querySelector("button");
    loadBtn.addEventListener("click", () => {
      DOM.ttsTextInput.value = item.text;
      if (item.voiceId) DOM.voiceSelect.value = item.voiceId;
      if (item.modelId) DOM.modelSelect.value = item.modelId;
      updateTextMetrics();
      updateVoiceMetadata(DOM.voiceSelect.value);
      showToast("Loaded text from history into editor.", "info");
    });

    DOM.historyList.appendChild(el);
  });
}

function downloadCurrentAudio() {
  if (!AppState.currentAudioBlob) {
    showToast("No generated audio available to download.", "warning");
    return;
  }

  const voice = AppState.voices.find(v => v.voice_id === DOM.voiceSelect.value);
  const voiceName = (voice ? voice.name : "voice").toLowerCase().replace(/\s+/g, "-");
  const fileName = `elevenlabs-${voiceName}-${Date.now()}.mp3`;

  const a = document.createElement("a");
  a.href = AppState.currentAudioUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  showToast(`Downloaded ${fileName}`, "success");
}

/* ==============================================================================
   Settings Modal & API Key Management
   ============================================================================== */

function openSettingsModal() {
  DOM.settingsModal.classList.remove("hidden");
  DOM.apiKeyInput.value = AppState.apiKey || "";
  refreshModalStatus();
}

function closeSettingsModal() {
  DOM.settingsModal.classList.add("hidden");
}

async function refreshModalStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    if (data.configured) {
      DOM.modalStatusDot.className = "status-indicator-dot active";
      DOM.modalStatusText.textContent = "Server configured via .env";
      DOM.modalKeyPreview.textContent = data.keyPreview || "Key hidden";
    } else if (AppState.apiKey) {
      DOM.modalStatusDot.className = "status-indicator-dot active";
      DOM.modalStatusText.textContent = "Client Session Key active";
      DOM.modalKeyPreview.textContent = `${AppState.apiKey.slice(0, 4)}...${AppState.apiKey.slice(-4)}`;
    } else {
      DOM.modalStatusDot.className = "status-indicator-dot inactive";
      DOM.modalStatusText.textContent = "No key configured";
      DOM.modalKeyPreview.textContent = "";
    }
  } catch (e) {
    DOM.modalStatusDot.className = "status-indicator-dot inactive";
    DOM.modalStatusText.textContent = "Server not responding";
  }
}

async function testApiKey() {
  const keyToTest = DOM.apiKeyInput.value.trim() || AppState.apiKey;
  if (!keyToTest) {
    showToast("Please enter an API key to test.", "warning");
    return;
  }

  DOM.testKeySpinner.classList.remove("hidden");
  DOM.testKeyBtn.disabled = true;
  if (DOM.diagnosticResults) DOM.diagnosticResults.classList.add("hidden");

  try {
    const res = await fetch("/api/test-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: keyToTest })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to test key");

    if (DOM.diagnosticResults) {
      DOM.diagnosticResults.classList.remove("hidden");
      if (data.valid) {
        DOM.diagnosticResults.className = "diagnostic-box diag-success";
        DOM.diagStatusBadge.className = "diag-status-badge success";
        DOM.diagStatusBadge.textContent = "Verified";
        DOM.diagTitle.textContent = "Key Active & Fully Functional";
        DOM.diagDetails.innerHTML = `
          <p><strong>Tier:</strong> ${escapeHtml(data.tier.toUpperCase())}</p>
          <p>Text-to-Speech and Voices permissions are verified! ElevenLabs AI voices are ready to use.</p>
        `;
        showToast("ElevenLabs Key Verified & Ready!", "success");
      } else {
        DOM.diagnosticResults.className = "diagnostic-box diag-warning";
        DOM.diagStatusBadge.className = "diag-status-badge warning";
        DOM.diagStatusBadge.textContent = data.status === "missing_permissions" ? "Restricted" : "Check Key";
        DOM.diagTitle.textContent = data.status === "missing_permissions" ? "Missing Permissions" : "Key Verification Notice";
        
        const missingList = data.missingPermissions && data.missingPermissions.length > 0
          ? `<ul>${data.missingPermissions.map(p => `<li>Missing permission: <code>${escapeHtml(p)}</code></li>`).join("")}</ul>`
          : "";

        DOM.diagDetails.innerHTML = `
          <p>${escapeHtml(data.message)}</p>
          ${missingList}
          <p><strong>How to fix:</strong> ${escapeHtml(data.instructions || "Check permissions in ElevenLabs dashboard.")}</p>
        `;
        showToast(data.message, "warning");
      }
    }
  } catch (err) {
    showToast(`Verification Failed: ${err.message}`, "error");
    if (DOM.diagnosticResults) {
      DOM.diagnosticResults.classList.remove("hidden");
      DOM.diagnosticResults.className = "diagnostic-box";
      DOM.diagStatusBadge.className = "diag-status-badge error";
      DOM.diagStatusBadge.textContent = "Error";
      DOM.diagTitle.textContent = "Verification Failed";
      DOM.diagDetails.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
    }
  } finally {
    DOM.testKeySpinner.classList.add("hidden");
    DOM.testKeyBtn.disabled = false;
  }
}

async function saveApiKey() {
  const newKey = DOM.apiKeyInput.value.trim();
  if (!newKey) {
    showToast("Please enter a valid API key.", "warning");
    return;
  }

  try {
    // Attempt to persist to server .env
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: newKey })
    });

    if (res.ok) {
      showToast("Saved API key to backend .env!", "success");
    } else {
      // If server saving failed, keep in session
      sessionStorage.setItem("elevenlabs_temp_key", newKey);
      showToast("Saved API key to current browser session.", "info");
    }
  } catch (err) {
    sessionStorage.setItem("elevenlabs_temp_key", newKey);
    showToast("Saved API key to session (server proxy offline).", "info");
  }

  AppState.apiKey = newKey;
  AppState.isConfigured = true;
  updateStatusBadge("connected", "ElevenLabs Ready");
  DOM.keyAlertBanner.classList.add("hidden");
  closeSettingsModal();
  await fetchDynamicVoices();
}

/* ==============================================================================
   Event Listeners Wire-Up
   ============================================================================== */

function attachEventListeners() {
  // Text Area Input Metrics
  DOM.ttsTextInput.addEventListener("input", updateTextMetrics);

  // Quick Samples
  DOM.sampleChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const sampleKey = chip.getAttribute("data-sample");
      if (SAMPLE_TEXTS[sampleKey]) {
        DOM.ttsTextInput.value = SAMPLE_TEXTS[sampleKey];
        updateTextMetrics();
        showToast(`Loaded ${chip.textContent.trim()} sample.`, "info");
      }
    });
  });

  // Paste from clipboard
  DOM.pasteBtn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        DOM.ttsTextInput.value = text;
        updateTextMetrics();
        showToast("Text pasted from clipboard!", "success");
      }
    } catch (err) {
      showToast("Clipboard permission denied. Please use Ctrl+V / Cmd+V.", "warning");
    }
  });

  // Clear Text
  DOM.clearTextBtn.addEventListener("click", () => {
    if (DOM.ttsTextInput.value.trim()) {
      DOM.ttsTextInput.value = "";
      updateTextMetrics();
      showToast("Text cleared.", "info");
    }
  });

  // Voice Selection Change
  DOM.voiceSelect.addEventListener("change", (e) => {
    updateVoiceMetadata(e.target.value);
  });

  // Model Selection Change
  DOM.modelSelect.addEventListener("change", (e) => {
    updateModelMetadata(e.target.value);
  });

  // Engine Selection Change
  if (DOM.engineSelect) {
    DOM.engineSelect.addEventListener("change", (e) => {
      const mode = e.target.value;
      if (DOM.engineBadge) {
        if (mode === "auto") {
          DOM.engineBadge.textContent = "Auto-Fallback";
          DOM.engineBadge.className = "label-tag highlight";
        } else if (mode === "elevenlabs") {
          DOM.engineBadge.textContent = "Cloud Only";
          DOM.engineBadge.className = "label-tag";
        } else {
          DOM.engineBadge.textContent = "Built-in SAPI";
          DOM.engineBadge.className = "label-tag";
        }
      }
    });
  }

  // Fix Key Button in Engine Notice Banner
  if (DOM.fixKeyBtn) {
    DOM.fixKeyBtn.addEventListener("click", openSettingsModal);
  }

  // Voice Sample Preview Button
  DOM.previewVoiceBtn.addEventListener("click", toggleVoiceSamplePreview);

  // Reload Voices Button
  DOM.refreshVoicesBtn.addEventListener("click", async () => {
    DOM.refreshVoicesBtn.classList.add("spinning");
    await fetchDynamicVoices();
    DOM.refreshVoicesBtn.classList.remove("spinning");
  });

  // Slider Values Synchronization
  DOM.stabilitySlider.addEventListener("input", (e) => {
    DOM.stabilityValue.textContent = `${Math.round(e.target.value * 100)}%`;
  });
  DOM.similaritySlider.addEventListener("input", (e) => {
    DOM.similarityValue.textContent = `${Math.round(e.target.value * 100)}%`;
  });
  DOM.styleSlider.addEventListener("input", (e) => {
    DOM.styleValue.textContent = `${Math.round(e.target.value * 100)}%`;
  });

  // Reset Voice Settings
  DOM.resetVoiceSettingsBtn.addEventListener("click", () => {
    DOM.stabilitySlider.value = 0.5;
    DOM.stabilityValue.textContent = "50%";
    DOM.similaritySlider.value = 0.75;
    DOM.similarityValue.textContent = "75%";
    DOM.styleSlider.value = 0.0;
    DOM.styleValue.textContent = "0%";
    DOM.speakerBoostToggle.checked = true;
    showToast("Voice tuning reset to defaults.", "info");
  });

  // Primary Action: Synthesize Speech
  DOM.playBtn.addEventListener("click", generateSpeech);

  // Stop Action
  DOM.stopBtn.addEventListener("click", stopAudio);

  // HTML5 Audio Player Events
  DOM.audioElement.addEventListener("timeupdate", onAudioTimeUpdate);
  DOM.audioElement.addEventListener("loadedmetadata", onAudioLoadedMetadata);
  DOM.audioElement.addEventListener("ended", onAudioEnded);

  // Custom Audio Controls
  DOM.audioPlayPauseBtn.addEventListener("click", togglePlayPause);
  DOM.skipBackBtn.addEventListener("click", () => {
    DOM.audioElement.currentTime = Math.max(0, DOM.audioElement.currentTime - 5);
  });
  DOM.skipForwardBtn.addEventListener("click", () => {
    DOM.audioElement.currentTime = Math.min(DOM.audioElement.duration || 0, DOM.audioElement.currentTime + 5);
  });

  // Timeline Seeker
  DOM.seekSlider.addEventListener("input", (e) => {
    const percent = parseFloat(e.target.value);
    if (DOM.audioElement.duration) {
      DOM.audioElement.currentTime = (percent / 100) * DOM.audioElement.duration;
      DOM.seekProgressFill.style.width = `${percent}%`;
    }
  });

  // Playback Speed
  DOM.playbackRateSelect.addEventListener("change", (e) => {
    DOM.audioElement.playbackRate = parseFloat(e.target.value);
  });

  // Volume Slider & Mute
  DOM.volumeSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    DOM.audioElement.volume = val;
    DOM.audioElement.muted = val === 0;
    updateVolumeIcon(val === 0 ? 0 : val);
  });

  DOM.muteBtn.addEventListener("click", () => {
    DOM.audioElement.muted = !DOM.audioElement.muted;
    if (DOM.audioElement.muted) {
      updateVolumeIcon(0);
    } else {
      updateVolumeIcon(DOM.audioElement.volume);
    }
  });

  // Download Button
  DOM.downloadBtn.addEventListener("click", downloadCurrentAudio);

  // Clear History
  DOM.clearHistoryBtn.addEventListener("click", () => {
    AppState.history = [];
    localStorage.removeItem("elevenlabs_history");
    renderHistory();
    showToast("Generation history cleared.", "info");
  });

  // Settings Modal Controls
  DOM.settingsBtn.addEventListener("click", openSettingsModal);
  DOM.openSettingsFromBanner.addEventListener("click", openSettingsModal);
  DOM.closeModalBtn.addEventListener("click", closeSettingsModal);
  DOM.settingsModal.addEventListener("click", (e) => {
    if (e.target === DOM.settingsModal) closeSettingsModal();
  });

  DOM.toggleKeyVisibility.addEventListener("click", () => {
    const isPass = DOM.apiKeyInput.type === "password";
    DOM.apiKeyInput.type = isPass ? "text" : "password";
  });

  DOM.testKeyBtn.addEventListener("click", testApiKey);
  DOM.saveKeyBtn.addEventListener("click", saveApiKey);
}

/* ==============================================================================
   Audio Event Handlers & Voice Sample Previews
   ============================================================================== */

function onAudioLoadedMetadata() {
  AppState.audioDuration = DOM.audioElement.duration || 0;
  DOM.totalDuration.textContent = formatTime(AppState.audioDuration);
}

function onAudioTimeUpdate() {
  const current = DOM.audioElement.currentTime;
  const duration = DOM.audioElement.duration || 1;
  DOM.currentTime.textContent = formatTime(current);

  const percent = (current / duration) * 100;
  DOM.seekSlider.value = percent;
  DOM.seekProgressFill.style.width = `${percent}%`;
}

function onAudioEnded() {
  AppState.isPlaying = false;
  updatePlayPauseButtonIcon(false);
  DOM.stopBtn.disabled = true;
  DOM.seekSlider.value = 0;
  DOM.seekProgressFill.style.width = "0%";
}

function toggleVoiceSamplePreview() {
  const voice = AppState.voices.find(v => v.voice_id === DOM.voiceSelect.value);
  if (!voice || !voice.preview_url) return;

  if (AppState.voicePreviewAudio && !AppState.voicePreviewAudio.paused) {
    AppState.voicePreviewAudio.pause();
    DOM.previewVoiceBtn.classList.remove("active");
    return;
  }

  // Stop main player if active
  if (AppState.isPlaying) {
    pauseAudio();
  }

  AppState.voicePreviewAudio = new Audio(voice.preview_url);
  DOM.previewVoiceBtn.classList.add("active");

  AppState.voicePreviewAudio.play().catch(e => console.log(e));
  AppState.voicePreviewAudio.onended = () => {
    DOM.previewVoiceBtn.classList.remove("active");
  };
}

function updateVolumeIcon(vol) {
  if (vol === 0) {
    DOM.volumeIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`;
  } else if (vol < 0.5) {
    DOM.volumeIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>`;
  } else {
    DOM.volumeIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>`;
  }
}

/* ==============================================================================
   State & UI Feedback Utilities
   ============================================================================== */

function setGeneratingState(isGenerating) {
  AppState.isGenerating = isGenerating;
  DOM.playBtn.disabled = isGenerating;
  
  if (isGenerating) {
    DOM.playBtnText.textContent = "Generating Speech...";
    DOM.playBtnIcon.innerHTML = `<span class="spinner-sm"></span>`;
    DOM.processingIndicator.classList.remove("hidden");
  } else {
    DOM.playBtnText.textContent = "Synthesize & Play Speech";
    DOM.playBtnIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>`;
    DOM.processingIndicator.classList.add("hidden");
  }
}

function updateProcessingStatus(text) {
  DOM.processingStatusText.textContent = text;
}

function updateStatusBadge(type, label) {
  DOM.apiStatusBadge.className = `status-badge status-${type}`;
  DOM.apiStatusBadge.querySelector(".status-label").textContent = label;
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  };

  toast.innerHTML = `
    <span>${iconMap[type] || iconMap.info}</span>
    <span>${escapeHtml(message)}</span>
  `;

  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
