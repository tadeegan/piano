import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

const anthropicKey = defineSecret("ANTHROPIC_API_KEY");

const app = express();
app.use(cors());
app.use(express.json());

const systemPrompt = `You are a musical AI assistant connected to a web piano. Respond a music chord or sequence. If asked to explain something, use text steps to explain what you're about to play, then notes steps to play it. Keep text brief and musical.

MIDI reference: C4=60, D4=62, E4=64, F4=65, G4=67, A4=69, B4=71, C5=72. Sharps/flats: C#4=61, Eb4=63, F#4=66, Ab4=68, Bb4=70.
Velocity dynamics: pp=30, p=50, mp=70, mf=85, f=100, ff=120.
Use startTime offsets within each notes step for rhythm and chords (simultaneous notes share the same startTime).`;

const noteSchema = {
  type: "object",
  required: ["midi", "velocity", "duration", "startTime"],
  additionalProperties: false,
  properties: {
    midi: { type: "integer", description: "MIDI note number (21-108)" },
    velocity: { type: "integer", description: "Note velocity (1-127)" },
    duration: { type: "integer", description: "Duration in ms (50-5000)" },
    startTime: { type: "integer", description: "Start time offset in ms from step start" },
  },
};

const responseSchema = {
  type: "json_schema",
  schema: {
    type: "object",
    required: ["steps"],
    additionalProperties: false,
    properties: {
      steps: {
        type: "array",
        description: "Sequence of text and notes steps to play back in order",
        items: {
          anyOf: [
            {
              type: "object",
              required: ["type", "text"],
              additionalProperties: false,
              properties: {
                type: { type: "string", enum: ["text"] },
                text: { type: "string", description: "Message to speak/display" },
              },
            },
            {
              type: "object",
              required: ["type", "notes"],
              additionalProperties: false,
              properties: {
                type: { type: "string", enum: ["notes"] },
                notes: { type: "array", items: noteSchema },
              },
            },
          ],
        },
      },
    },
  },
};

const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function describeNotes(noteSequence) {
  return noteSequence.map((n) => {
    const name = noteNames[n.midi % 12];
    const octave = Math.floor((n.midi - 12) / 12);
    return `${name}${octave}(midi:${n.midi}, vel:${n.velocity}, dur:${n.duration}ms, t:${n.startTime}ms)`;
  }).join(", ");
}

app.post("/api/chat", async (req, res) => {
  const { message, noteSequence, history } = req.body;

  // Build current user message
  let userContent = "";
  if (noteSequence && noteSequence.length > 0) {
    userContent += `The user just played these notes on the piano: ${describeNotes(noteSequence)}.\n\n`;
  }
  userContent += message;

  // Build messages array from history + current message
  const messages = [];
  if (history) {
    for (const msg of history) {
      if (msg.role === "user") {
        let content = "";
        if (msg.notes?.length > 0) {
          content += `The user just played these notes on the piano: ${describeNotes(msg.notes)}.\n\n`;
        }
        content += msg.text;
        messages.push({ role: "user", content });
      } else if (msg.role === "assistant") {
        messages.push({ role: "assistant", content: JSON.stringify({ steps: msg.steps }) });
      }
    }
  }
  messages.push({ role: "user", content: userContent });

  try {
    console.log("\n--- Chat Request ---");
    console.log("User message:", message);
    console.log("History length:", history?.length || 0);

    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      output_config: { format: responseSchema },
    });

    const raw = response.content[0].text;
    console.log("Raw response:", raw);

    const { steps } = JSON.parse(raw);

    console.log("Steps:", steps.length);
    console.log("--- End Request ---\n");

    res.json({ steps });
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({ error: error.message });
  }
});

export const api = onRequest({ secrets: [anthropicKey], timeoutSeconds: 120 }, app);
