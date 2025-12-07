import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post("/correct", async (req, res) => {
  try {
    const { text, mode } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    // Prompt: instruct LLM to always give Corrected, Explanation, Reason
    const prompt =
      mode === "deep"
        ? `Analyze the sentence: "${text}".
Provide up to 5 corrected versions if needed.
For each, return in EXACT format:
Corrected: <sentence>
Explanation: <what was wrong>
Reason: <why this is correct>
If the sentence is already correct, set:
Corrected: ${text}
Explanation:
Reason: The sentence is already correct.`
        : `Analyze the sentence: "${text}".
Return EXACTLY in format:
Corrected: <sentence>
Explanation: <what was wrong>
Reason: <why this is correct>
If the sentence is already correct, set:
Corrected: ${text}
Explanation:
Reason: The sentence is already correct.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
    });

    const reply = completion.choices[0].message.content.trim();

    // Parse multiple suggestions (deep mode)
    if (mode === "deep") {
      const lines = reply.split("\n").filter(Boolean);
      const suggestions = [];

      for (let i = 0; i < lines.length; i += 3) {
        const corrected =
          lines[i]?.replace(/^Corrected:\s*/, "").trim() || text;
        const explanation =
          lines[i + 1]?.replace(/^Explanation:\s*/, "").trim() || "";
        const reason = lines[i + 2]?.replace(/^Reason:\s*/, "").trim() || "";

        suggestions.push({ label: corrected, explanation, reason });
      }

      return res.json({ text, suggestions: suggestions.slice(0, 5) });
    }

    // Basic mode: single suggestion
    const correctedMatch = reply.match(/Corrected:\s*(.*?)\s*$/m);
    const explanationMatch = reply.match(/Explanation:\s*(.*?)\s*$/m);
    const reasonMatch = reply.match(/Reason:\s*(.*?)\s*$/m);

    const corrected = correctedMatch?.[1]?.trim() || text;
    const explanation = explanationMatch?.[1]?.trim() || "";
    const reason = reasonMatch?.[1]?.trim() || "";

    res.json({ text: corrected, explanation, reason });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Grammar correction API running on http://localhost:${PORT}`);
});

