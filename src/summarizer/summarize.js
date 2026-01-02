import React from 'react';
// import OpenAI from "openai";

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const OPENAI_EMBED_ENDPOINT = "https://api.openai.com/v1/embeddings";

export async function getApiKey() {
  return new Promise((res) => {
    chrome.storage.local.get(['OPENAI_API_KEY'], (result) => {
      res(result.OPENAI_API_KEY || null);
    });
  });
}

export async function summarizeWithLLM(text, opts = {}) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("Missing OpenAI API key; set openai_api_key in chrome.storage.local");

  // keep prompt short and deterministic: you can customize the system/user messages
  const system = opts.system || "You are a concise summarizer. Return a brief summary highlighting main points.";
  const userPrompt = opts.prompt || `Summarize the following article in 2-4 concise sentences:\n\n${text}`;

  const body = {
    model: opts.model || "gpt-5-nano", // adjust model name as you provision
    reasoning: {effort: "low"},
    instructions: system,
    input: userPrompt,
    max_output_tokens: opts.max_tokens || 500
    // temperature -> not supported with gpt-5-nano
  };

  const resp = await fetch(OPENAI_RESPONSES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error("LLM summary failed: " + txt);
  }

  const data = await resp.json();
  // adapt depending on model response shape; this is responses API style
  const content = data.output.filter(c => c.type === "message").flatMap(c => c.content).filter(e => e.type === "output_text").map(c => c.text).join("\n").trim() || data.output_text;
  return (content || "").trim();
}

// Create embedding for semantic search
export async function createEmbedding(text, opts = {}) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("Missing OpenAI API key; set openai_api_key in chrome.storage.local");

  const body = {
    model: opts.model || "text-embedding-3-small",
    input: text,
    encoding_format: "float"
  };

  const resp = await fetch(OPENAI_EMBED_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error("Embedding request failed: " + txt);
  }

  const data = await resp.json();
  return data.data?.[0]?.embedding ?? null;
}

/* export async function summarizeText(text) {
  const shortText = text; // truncate for API limit
  const response = await client.responses.create({
    model: "gpt-5",
    instructions: "Provide a concise summary in no more than 60 words of the following text.",
    input: shortText}
  );
  
  return response.choices[0].message.content;
} */
