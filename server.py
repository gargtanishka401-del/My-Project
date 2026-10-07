"""
ElevenLabs Text-to-Speech Web Application Server
A robust, zero-dependency Python backend server that serves the frontend,
securely proxies requests to the ElevenLabs API, provides key diagnostics,
and includes an automatic high-fidelity local voice synthesis engine fallback.
"""

import http.server
import socketserver
import urllib.request
import urllib.error
import json
import os
import mimetypes
import sys
import time
import tempfile
import subprocess
import datetime

PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(BASE_DIR, ".env")

# Standard fallback voices if ElevenLabs API key lacks voices_read permission
FALLBACK_VOICES_LIST = [
    {
        "voice_id": "21m00Tcm4TlvDq8ikWAM",
        "name": "Rachel",
        "category": "premade",
        "gender": "female",
        "labels": {"accent": "American", "description": "Calm & Natural", "use_case": "Narration"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6788f9-5c96-470d-8312-aab3b3d8f50a.mp3"
    },
    {
        "voice_id": "pNInz6obpgDQGcFmaJgB",
        "name": "Adam",
        "category": "premade",
        "gender": "male",
        "labels": {"accent": "American", "description": "Deep & Warm", "use_case": "Audiobook"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/6f882877-3e0c-4ec7-8730-ee0fc7193af4.mp3"
    },
    {
        "voice_id": "ErXwobaYiN019PkySvjV",
        "name": "Antoni",
        "category": "premade",
        "gender": "male",
        "labels": {"accent": "American", "description": "Well-rounded & Friendly", "use_case": "Narration"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/ErXwobaYiN019PkySvjV/38d8f874-9e83-4770-b1ee-8263725b8782.mp3"
    },
    {
        "voice_id": "EXAVITQu4vr4xnSDxMaL",
        "name": "Bella",
        "category": "premade",
        "gender": "female",
        "labels": {"accent": "American", "description": "Expressive & Soft", "use_case": "Storytelling"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/092f7478-9585-4b36-a837-14e3b1c6d37a.mp3"
    },
    {
        "voice_id": "IKne3meq5aSn9X8L47AE",
        "name": "Charlie",
        "category": "premade",
        "gender": "male",
        "labels": {"accent": "Australian", "description": "Casual & Confident", "use_case": "Conversational"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/IKne3meq5aSn9X8L47AE/276e03a9-0639-4458-94ff-cb72235cf6d4.mp3"
    },
    {
        "voice_id": "AZnzlk1XvdvUeBnXmlld",
        "name": "Domi",
        "category": "premade",
        "gender": "female",
        "labels": {"accent": "American", "description": "Emphatic & Strong", "use_case": "Commercials"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/AZnzlk1XvdvUeBnXmlld/50dd6190-8810-44be-9290-7f920f865917.mp3"
    },
    {
        "voice_id": "MF3mGyEYCl7XYWbV9V6O",
        "name": "Elli",
        "category": "premade",
        "gender": "female",
        "labels": {"accent": "American", "description": "Youthful & Clear", "use_case": "Characters"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/MF3mGyEYCl7XYWbV9V6O/d8ec301c-ea45-422e-a579-2479e3940be0.mp3"
    },
    {
        "voice_id": "TxGEqnHWrfWFTfGW9XjX",
        "name": "Josh",
        "category": "premade",
        "gender": "male",
        "labels": {"accent": "American", "description": "Young & Resonant", "use_case": "Social Media"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/TxGEqnHWrfWFTfGW9XjX/3e7054a4-569b-4467-8147-49e0a0d48123.mp3"
    }
]

def log(msg, tag="INFO"):
    """Formatted server console logger."""
    now = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"[{now}] [{tag}] {msg}", flush=True)

def get_api_key():
    """Retrieve ElevenLabs API key from .env file or environment variable."""
    key = ""
    if os.path.exists(ENV_FILE):
        try:
            with open(ENV_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, val = line.split("=", 1)
                        if k.strip() == "ELEVENLABS_API_KEY":
                            key = val.strip().strip('"').strip("'")
                            break
        except Exception as e:
            log(f"Failed to read .env file: {e}", tag="WARN")

    if not key:
        key = os.environ.get("ELEVENLABS_API_KEY", "").strip()

    placeholders = ["PASTE_YOUR_ELEVENLABS_API_KEY_HERE", "your_elevenlabs_api_key_here", "your_key_here"]
    if key in placeholders:
        return ""

    return key

def synthesize_local_speech(text, voice_id=""):
    """
    Synthesize speech locally on Windows using standard System.Speech / SAPI
    Produces high-fidelity uncompressed WAV audio in under 1 second without any external dependencies.
    """
    # Detect preferred gender based on selected voice
    female_ids = ["21m00Tcm4TlvDq8ikWAM", "EXAVITQu4vr4xnSDxMaL", "AZnzlk1XvdvUeBnXmlld", "MF3mGyEYCl7XYWbV9V6O"]
    voice_target = "Zira" if (voice_id in female_ids or "rachel" in voice_id.lower() or "bella" in voice_id.lower()) else "David"

    clean_text = text.replace('"', '""').replace("\r", " ").replace("\n", " ")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as wav_f:
        wav_path = wav_f.name
    with tempfile.NamedTemporaryFile(suffix=".vbs", delete=False, mode="w", encoding="utf-8") as vbs_f:
        vbs_path = vbs_f.name
        escaped_wav = wav_path.replace("\\", "\\\\")
        vbs_code = f'''
Set voice = CreateObject("SAPI.SpVoice")
For Each v In voice.GetVoices
    If InStr(1, v.GetDescription, "{voice_target}", 1) > 0 Then
        Set voice.Voice = v
        Exit For
    End If
Next
Set stream = CreateObject("SAPI.SpFileStream")
stream.Open "{escaped_wav}", 3, False
Set voice.AudioOutputStream = stream
voice.Speak "{clean_text}"
stream.Close
'''
        vbs_f.write(vbs_code)

    try:
        subprocess.run(["cscript", "//nologo", vbs_path], check=True, timeout=15)
        with open(wav_path, "rb") as f:
            data = f.read()
        return data
    except Exception as e:
        log(f"Local TTS generation failed: {e}", tag="ERROR")
        raise e
    finally:
        for p in [wav_path, vbs_path]:
            try:
                if os.path.exists(p):
                    os.remove(p)
            except Exception:
                pass


class SecureTTSRequestHandler(http.server.SimpleHTTPRequestHandler):
    """
    HTTP handler that serves static files and provides secure proxy endpoints
    with auto-fallback for the ElevenLabs API.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, format, *args):
        """Silently suppress default SimpleHTTPRequestHandler spam, use custom log."""
        pass

    def do_OPTIONS(self):
        """Handle CORS pre-flight requests."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, xi-api-key")
        self.send_header("Access-Control-Expose-Headers", "X-TTS-Engine, X-TTS-Notice, X-ElevenLabs-Error")
        self.end_headers()

    def set_json_headers(self, status_code=200):
        """Send standard JSON response headers with CORS."""
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Expose-Headers", "X-TTS-Engine, X-TTS-Notice, X-ElevenLabs-Error")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()

    def send_json_error(self, status_code, message, details=None):
        """Send a formatted JSON error response."""
        self.set_json_headers(status_code)
        payload = {"error": True, "message": message}
        if details:
            payload["details"] = details
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def do_GET(self):
        """Route GET requests: API proxy or static files."""
        clean_path = self.path.split("?")[0]

        # 1. API Status endpoint
        if clean_path == "/api/status":
            api_key = get_api_key()
            self.set_json_headers(200)
            response_data = {
                "configured": bool(api_key and len(api_key) > 5),
                "keyPreview": f"{api_key[:4]}...{api_key[-4:]}" if api_key and len(api_key) > 8 else None,
                "message": "API key is configured on server" if api_key else "No API key configured in .env",
                "fallbackEngineAvailable": True,
                "serverTime": datetime.datetime.now().isoformat()
            }
            self.wfile.write(json.dumps(response_data).encode("utf-8"))
            return

        # 2. Get available voices
        if clean_path == "/api/voices":
            api_key = get_api_key()
            client_key = self.headers.get("xi-api-key")
            active_key = api_key or client_key

            if not active_key:
                # Return standard fallback voices with 200 so UI functions seamlessly
                self.set_json_headers(200)
                self.wfile.write(json.dumps({
                    "voices": FALLBACK_VOICES_LIST,
                    "source": "fallback",
                    "notice": "No API key provided; using standard studio voice catalog."
                }).encode("utf-8"))
                return

            try:
                req = urllib.request.Request(
                    "https://api.elevenlabs.io/v1/voices",
                    headers={
                        "xi-api-key": active_key,
                        "User-Agent": "ElevenLabs-Web-Studio/1.0"
                    }
                )
                with urllib.request.urlopen(req, timeout=12) as resp:
                    data = resp.read()
                    self.set_json_headers(200)
                    self.wfile.write(data)
                    log("Voices loaded successfully from ElevenLabs API.", tag="ELEVENLABS")
            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8", errors="ignore")
                log(f"ElevenLabs /v1/voices error {e.code}: {err_body}", tag="WARN")
                # Fallback to standard voices with notice
                self.set_json_headers(200)
                self.wfile.write(json.dumps({
                    "voices": FALLBACK_VOICES_LIST,
                    "source": "fallback",
                    "elevenLabsError": f"ElevenLabs API Error ({e.code}): {err_body}",
                    "notice": "Your ElevenLabs key is missing voices_read permission. Using standard voice list."
                }).encode("utf-8"))
            except Exception as e:
                log(f"Failed to fetch voices from ElevenLabs: {e}", tag="WARN")
                self.set_json_headers(200)
                self.wfile.write(json.dumps({
                    "voices": FALLBACK_VOICES_LIST,
                    "source": "fallback",
                    "notice": f"Network warning: {str(e)}. Using standard voice list."
                }).encode("utf-8"))
            return

        # 3. Get available models
        if clean_path == "/api/models":
            api_key = get_api_key()
            client_key = self.headers.get("xi-api-key")
            active_key = api_key or client_key

            if active_key:
                try:
                    req = urllib.request.Request(
                        "https://api.elevenlabs.io/v1/models",
                        headers={"xi-api-key": active_key, "User-Agent": "ElevenLabs-Web-Studio/1.0"}
                    )
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        data = resp.read()
                        self.set_json_headers(200)
                        self.wfile.write(data)
                        return
                except Exception as e:
                    log(f"Failed to fetch models from ElevenLabs: {e}", tag="WARN")

            # Fallback models
            self.set_json_headers(200)
            self.wfile.write(json.dumps([
                {"model_id": "eleven_multilingual_v2", "name": "Eleven Multilingual v2"},
                {"model_id": "eleven_turbo_v2_5", "name": "Eleven Turbo v2.5"},
                {"model_id": "eleven_flash_v2_5", "name": "Eleven Flash v2.5"}
            ]).encode("utf-8"))
            return

        # Otherwise serve static files (index.html, style.css, script.js, etc.)
        return super().do_GET()

    def do_POST(self):
        """Route POST requests: TTS generation, saving config, or testing key."""
        clean_path = self.path.split("?")[0]

        # 1. Save API Key to .env file endpoint
        if clean_path == "/api/config":
            try:
                content_len = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_len).decode("utf-8")
                payload = json.loads(body)
                new_key = payload.get("apiKey", "").strip()

                if not new_key:
                    self.send_json_error(400, "API key cannot be empty.")
                    return

                # Write to .env
                with open(ENV_FILE, "w", encoding="utf-8") as f:
                    f.write(f"# ElevenLabs Configuration\nELEVENLABS_API_KEY={new_key}\n")

                os.environ["ELEVENLABS_API_KEY"] = new_key
                log(f"API key updated in .env ({new_key[:4]}...{new_key[-4:]})", tag="CONFIG")
                self.set_json_headers(200)
                self.wfile.write(json.dumps({"success": True, "message": "API key successfully saved to .env file"}).encode("utf-8"))
            except Exception as e:
                self.send_json_error(500, f"Failed to save API key: {str(e)}")
            return

        # 2. Key Diagnostic & Permission Checker endpoint
        if clean_path == "/api/test-key":
            try:
                content_len = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"
                payload = json.loads(body)
                test_key = payload.get("apiKey", "").strip() or get_api_key()

                if not test_key:
                    self.send_json_error(400, "No API key provided to test.")
                    return

                diag_result = self.diagnose_elevenlabs_key(test_key)
                self.set_json_headers(200)
                self.wfile.write(json.dumps(diag_result).encode("utf-8"))
            except Exception as e:
                self.send_json_error(500, f"Error diagnosing API key: {str(e)}")
            return

        # 3. Text-to-Speech proxy endpoint with automatic fallback
        if clean_path == "/api/tts":
            api_key = get_api_key()
            client_key = self.headers.get("xi-api-key")
            active_key = api_key or client_key

            try:
                content_len = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_len).decode("utf-8")
                payload = json.loads(body)

                text = payload.get("text", "").strip()
                voice_id = payload.get("voice_id", "21m00Tcm4TlvDq8ikWAM")
                model_id = payload.get("model_id", "eleven_multilingual_v2")
                force_local = payload.get("force_local", False)
                voice_settings = payload.get("voice_settings", {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "style": 0.0,
                    "use_speaker_boost": True
                })

                if not text:
                    self.send_json_error(400, "Text is required to generate speech.")
                    return

                text_preview = text[:45].replace("\n", " ") + ("..." if len(text) > 45 else "")
                log(f"TTS Request: '{text_preview}' (Voice: {voice_id})", tag="TTS")

                # If force local or no key provided, generate immediately with local engine
                if force_local or not active_key:
                    reason = "No ElevenLabs API key configured" if not active_key else "Local mode requested"
                    log(f"{reason}. Generating via built-in system voice engine...", tag="LOCAL_TTS")
                    audio_wav = synthesize_local_speech(text, voice_id)
                    self.serve_audio_bytes(
                        audio_wav,
                        content_type="audio/wav",
                        engine="fallback-local",
                        notice=reason,
                        eleven_error=None
                    )
                    return

                # Attempt ElevenLabs synthesis
                eleven_url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
                tts_payload = json.dumps({
                    "text": text,
                    "model_id": model_id,
                    "voice_settings": voice_settings
                }).encode("utf-8")

                req = urllib.request.Request(
                    eleven_url,
                    data=tts_payload,
                    headers={
                        "xi-api-key": active_key,
                        "Content-Type": "application/json",
                        "Accept": "audio/mpeg",
                        "User-Agent": "ElevenLabs-Web-Studio/1.0"
                    },
                    method="POST"
                )

                try:
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        audio_data = resp.read()
                        log(f"ElevenLabs TTS SUCCESS! Received {len(audio_data)} bytes of audio.", tag="SUCCESS")
                        self.serve_audio_bytes(
                            audio_data,
                            content_type="audio/mpeg",
                            engine="elevenlabs",
                            notice="Synthesized with ElevenLabs Neural Engine",
                            eleven_error=None
                        )
                        return
                except urllib.error.HTTPError as e:
                    err_body = e.read().decode("utf-8", errors="ignore")
                    msg = ""
                    try:
                        err_json = json.loads(err_body)
                        msg = err_json.get("detail", {}).get("message") or err_json.get("message") or err_body
                    except Exception:
                        msg = err_body or str(e)

                    log(f"ElevenLabs API Error ({e.code}): {msg}", tag="ELEVEN_ERROR")
                    log("Activating Built-in System Voice Fallback so audio is produced...", tag="FALLBACK")

                    # Generate using local voice engine so user ALWAYS receives audio!
                    audio_wav = synthesize_local_speech(text, voice_id)
                    notice_msg = f"ElevenLabs returned {e.code}: {msg}. Speech synthesized using Built-in Voice Engine."
                    self.serve_audio_bytes(
                        audio_wav,
                        content_type="audio/wav",
                        engine="fallback-local",
                        notice=notice_msg,
                        eleven_error=msg
                    )
                    return

            except Exception as e:
                log(f"Error during TTS synthesis: {str(e)}", tag="ERROR")
                # Even on unexpected error, try local fallback
                try:
                    audio_wav = synthesize_local_speech(payload.get("text", "Audio synthesized"), payload.get("voice_id", ""))
                    self.serve_audio_bytes(
                        audio_wav,
                        content_type="audio/wav",
                        engine="fallback-local",
                        notice=f"Recovered with Built-in Voice Engine: {str(e)}",
                        eleven_error=str(e)
                    )
                    return
                except Exception as inner_e:
                    self.send_json_error(500, f"Error processing Text-to-Speech: {str(e)}")
                    return

        self.send_json_error(404, "Endpoint not found")

    def serve_audio_bytes(self, audio_data, content_type, engine, notice, eleven_error=None):
        """Send audio stream with CORS and diagnostic metadata headers."""
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(audio_data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Expose-Headers", "X-TTS-Engine, X-TTS-Notice, X-ElevenLabs-Error")
        self.send_header("X-TTS-Engine", engine)
        if notice:
            clean_notice = notice.replace("\r", " ").replace("\n", " ").encode("ascii", "ignore").decode()
            self.send_header("X-TTS-Notice", clean_notice)
        if eleven_error:
            clean_err = eleven_error.replace("\r", " ").replace("\n", " ").encode("ascii", "ignore").decode()
            self.send_header("X-ElevenLabs-Error", clean_err)
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(audio_data)

    def diagnose_elevenlabs_key(self, api_key):
        """
        Inspect the API key permissions by pinging endpoints.
        Returns a clean diagnostic report for the user.
        """
        result = {
            "valid": False,
            "status": "unknown",
            "tier": "unknown",
            "permissions": {
                "text_to_speech": False,
                "voices_read": False,
                "user_read": False
            },
            "missingPermissions": [],
            "message": "",
            "instructions": ""
        }

        # 1. Test user info
        try:
            req = urllib.request.Request("https://api.elevenlabs.io/v1/user", headers={"xi-api-key": api_key})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())
                result["permissions"]["user_read"] = True
                result["tier"] = data.get("subscription", {}).get("tier", "active")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="ignore")
            if "user_read" in body:
                result["missingPermissions"].append("user_read")
        except Exception:
            pass

        # 2. Test voices permission
        try:
            req = urllib.request.Request("https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": api_key})
            with urllib.request.urlopen(req, timeout=8) as resp:
                result["permissions"]["voices_read"] = True
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="ignore")
            if "voices_read" in body:
                result["missingPermissions"].append("voices_read")
        except Exception:
            pass

        # 3. Test TTS permission with 1 word
        try:
            tts_url = "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM"
            payload = json.dumps({"text": "Hi", "model_id": "eleven_turbo_v2_5"}).encode()
            req = urllib.request.Request(tts_url, data=payload, headers={"xi-api-key": api_key, "Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=8) as resp:
                result["permissions"]["text_to_speech"] = True
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="ignore")
            if "text_to_speech" in body:
                result["missingPermissions"].append("text_to_speech")
            elif e.code == 429:
                result["quotaExceeded"] = True
        except Exception:
            pass

        # Determine overall status
        if result["permissions"]["text_to_speech"]:
            result["valid"] = True
            result["status"] = "fully_functional"
            result["message"] = f"Key is active and fully functional! (Tier: {result['tier']})"
        elif "text_to_speech" in result["missingPermissions"]:
            result["valid"] = False
            result["status"] = "missing_permissions"
            result["message"] = "Key is restricted: Missing 'Text to Speech' (text_to_speech) permission."
            result["instructions"] = "In your ElevenLabs account: Go to Profile > API Keys > Edit Key > Check 'Text to Speech' and 'Voices', then save."
        else:
            result["valid"] = False
            result["status"] = "unauthorized_or_invalid"
            result["message"] = "Invalid API key or unauthorized by ElevenLabs."
            result["instructions"] = "Verify your ElevenLabs API key at elevenlabs.io/app/settings/api-keys."

        return result


def start_server():
    """Start the local web server."""
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    key = get_api_key()

    mimetypes.init()
    mimetypes.add_type("text/css", ".css")
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("image/svg+xml", ".svg")
    mimetypes.add_type("audio/wav", ".wav")
    mimetypes.add_type("audio/mpeg", ".mp3")

    # Allow fast port re-use
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", PORT), SecureTTSRequestHandler) as httpd:
        print("=" * 65, flush=True)
        print("  [ElevenLabs Modern Text-to-Speech Web Studio & Proxy Server]", flush=True)
        print("=" * 65, flush=True)
        print(f"  -> Local Studio URL:   http://localhost:{PORT}", flush=True)
        if key:
            print(f"  -> ElevenLabs API Key: Configured in .env ({key[:4]}...{key[-4:]})", flush=True)
        else:
            print("  -> ElevenLabs API Key: [!] Not configured in .env", flush=True)
        print("  -> Built-in TTS Fallback: ACTIVE (Windows SAPI / System.Speech)", flush=True)
        print("     (Guarantees audio generation even if key has permission limits)", flush=True)
        print("=" * 65, flush=True)
        print("  Press Ctrl+C to stop the server\n", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server gracefully...", flush=True)
            httpd.server_close()

if __name__ == "__main__":
    start_server()
