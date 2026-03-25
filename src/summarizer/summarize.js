import React from 'react';
const API_BASE = "https://dev-api.recallhistory.net";

async function getOrCreateUserId() {
  const result = await chrome.storage.local.get("user_id");
  if (result.user_id) return result.user_id;

  const newId = crypto.randomUUID();
  await chrome.storage.local.set({ user_id: newId });
  console.log("🆕 Created user_id:", newId);
  return newId;
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
  // keep prompt short and deterministic: you can customize the system/user messages
  // const system = opts.system || "You are a concise summarizer. Return a brief summary highlighting main points.";
  // const userPrompt = opts.prompt || `Summarize the following article in 2-4 concise sentences:\n\n${text}`;

  let data = await callProxy({
    type: "summary",
    text
  });
  // console.log(`raw summary: ${data}`);
  if (data?.error === "limit reached"){
    notifyLimitReached(data);
    return;
  }
  else {
    return extractTextFromResponse(data);
  }
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
  const userId = await getOrCreateUserId();
  // const api_base = await chrome.storage.local.get("api_base");
  // const API_BASE = api_base || "https://api.recallhistory.net";
  const resp = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId
    },
    body: JSON.stringify(payload)
  });

  if (resp.status === 402) {
      const data = await resp.json();
      return {
        error: "limit reached", usage: data.usage, limit: data.limit
      };
    };

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Proxy request failed: ${txt}`);
  }
  return resp.json();
}

function notifyLimitReached(limit_data){
  chrome.storage.local.set({
    limit_state: {
      reached: true,
      usage: limit_data.usage,
      limit: limit_data.limit
    } 
  });

  chrome.runtime.sendMessage({
    type: "LIMIT_REACHED",
    usage: limit_data.usage,
    limit: limit_data.limit
  });
}