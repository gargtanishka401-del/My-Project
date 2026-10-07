/**
 * ElevenLabs Text-to-Speech Web Application - Node.js Server
 * Secure proxy server for ElevenLabs API to prevent exposing API keys in frontend code.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

// Attempt loading dotenv if installed, otherwise read .env manually
try {
  require('dotenv').config();
} catch (e) {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...v] = trimmed.split('=');
        if (!process.env[k.trim()]) {
          process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    });
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const getApiKey = (req) => {
  return process.env.ELEVENLABS_API_KEY || req.headers['xi-api-key'] || '';
};

// Check server status & API key configuration
app.get('/api/status', (req, res) => {
  const apiKey = getApiKey(req);
  res.json({
    configured: Boolean(apiKey && apiKey.length > 5),
    keyPreview: apiKey && apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : null,
    message: apiKey ? 'API key is configured on server' : 'No API key configured in .env'
  });
});

// Proxy get voices from ElevenLabs
app.get('/api/voices', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return res.status(401).json({
      error: true,
      message: 'ElevenLabs API Key is missing. Please add ELEVENLABS_API_KEY to your .env file or settings.'
    });
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey,
        'User-Agent': 'ElevenLabs-Web-Studio/1.0'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

// Proxy get models from ElevenLabs
app.get('/api/models', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return res.status(401).json({ error: true, message: 'ElevenLabs API Key is missing.' });
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/models', {
      headers: {
        'xi-api-key': apiKey,
        'User-Agent': 'ElevenLabs-Web-Studio/1.0'
      }
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

// Proxy TTS generation
app.post('/api/tts', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return res.status(401).json({
      error: true,
      message: 'ElevenLabs API Key is missing. Configure it in .env or the Settings dialog.'
    });
  }

  const { text, voice_id = '21m00Tcm4TlvDq8ikWAM', model_id = 'eleven_multilingual_v2', voice_settings } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: true, message: 'Text is required to generate speech.' });
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id,
        voice_settings: voice_settings || {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson.detail?.message || errJson.message || `ElevenLabs returned HTTP ${response.status}`;
      return res.status(response.status).json({ error: true, message: msg });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

// Save API key to .env
app.post('/api/config', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.trim()) {
    return res.status(400).json({ error: true, message: 'API key cannot be empty.' });
  }

  const envPath = path.join(__dirname, '.env');
  fs.writeFileSync(envPath, `# ElevenLabs Configuration\nELEVENLABS_API_KEY=${apiKey.trim()}\n`, 'utf8');
  process.env.ELEVENLABS_API_KEY = apiKey.trim();
  res.json({ success: true, message: 'API key saved successfully to .env' });
});

app.listen(PORT, () => {
  console.log(`🎙️  ElevenLabs Studio running at http://localhost:${PORT}`);
});
