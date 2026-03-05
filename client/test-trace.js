import { Client } from "langsmith";
import OpenAI from "openai";
import "dotenv/config";

// Set up clients
const ls = new Client();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function run() {
  // Send a test message to OpenAI
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "hey" }],
  });

  console.log("AI replied:", response.choices[0].message.content);

  // Send a trace to LangSmith
  await ls.createRun({
    name: "Test Run",
    run_type: "chain",
    inputs: { question: "hey" },
    outputs: { answer: response.choices[0].message.content },
  });

  console.log("Trace sent to LangSmith project:", process.env.LANGSMITH_PROJECT);
}

run();