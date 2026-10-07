exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: true, message: "Method not allowed" })
    };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: true,
        message: "ELEVENLABS_API_KEY is not configured in Netlify."
      })
    };
  }

  try {
    const {
      text,
      voice_id = "21m00Tcm4TlvDq8ikWAM",
      model_id = "eleven_multilingual_v2",
      voice_settings
    } = JSON.parse(event.body || "{}");

    if (!text || !text.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: true,
          message: "Text is required to generate speech."
        })
      };
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },
        body: JSON.stringify({
          text,
          model_id,
          voice_settings: voice_settings || {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: true,
          message: errorText || `ElevenLabs returned ${response.status}`
        })
      };
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "X-TTS-Engine": "elevenlabs"
      },
      isBase64Encoded: true,
      body: audioBuffer.toString("base64")
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: true,
        message: error.message
      })
    };
  }
};
