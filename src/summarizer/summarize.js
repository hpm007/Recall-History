import React from 'react';
// import OpenAI from "openai";

const PROXY_ENDPOINT = "https://recall-proxy.hpm218007.workers.dev";

export async function getApiKey() {
  return new Promise((res) => {
    chrome.storage.local.get(['OPENAI_API_KEY'], (result) => {
      res(result.OPENAI_API_KEY || null);
    });
  });
}

function extractTextFromResponse(data) {
  if (typeof data.output_text === "string") {
    return data.output_text.trim();
  }

  if (Array.isArray(data.output)) {
    return data.output
      .flatMap(o => Array.isArray(o.content) ? o.content : [])
      .filter(c => c.type === "output_text")
      .map(c => c.text)
      .join("\n")
      .trim();
  }

  return "";
}

export async function summarizeWithLLM(text, opts = {}) {
  /* const apiKey = await getApiKey();
  if (!apiKey) throw new Error("Missing OpenAI API key"); */

  // keep prompt short and deterministic: you can customize the system/user messages
  // const system = opts.system || "You are a concise summarizer. Return a brief summary highlighting main points.";
  // const userPrompt = opts.prompt || `Summarize the following article in 2-4 concise sentences:\n\n${text}`;

  let data = await callProxy({
    type: "summary",
    text
  });
  console.log(`raw summary: ${data}`);
  return extractTextFromResponse(data);
}

// Create embedding for semantic search
export async function createEmbedding(text, opts = {}) {
  let data = await callProxy({
    type: "embedding",
    text
  });

  return data.data?.[0]?.embedding ?? null;
}
  
async function callProxy(payload) {
  const resp = await fetch(PROXY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Proxy request failed: ${txt}`);
  }

  return resp.json();
}
