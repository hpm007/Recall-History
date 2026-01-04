import { getPageByUrl, upsertPage } from "../db_store";
import { summarizeWithLLM, createEmbedding } from "../summarizer/summarize.js";
import { isExcludedUrl } from "../options/config_options.js";

// dwell time in milliseconds
const DWELL_THRESHOLD = 20000;
const dwellTimers = new Map();

// When the user updates or loads a page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active && tab.url && /^https?:/.test(tab.url) && !isExcludedUrl(tab.url)) {
    startDwellTimer(tabId, tab.url);
  }
});

// When the user switches to a different tab
chrome.tabs.onActivated.addListener((activeInfo) => {
  // clear timer on the old tab
  for (const [tabId, timer] of dwellTimers.entries()) {
    if (tabId !== activeInfo.tabId) {
      clearTimeout(timer);
      dwellTimers.delete(tabId);
    }
  }

  // start timer on the new tab if URL is valid
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab && /^https?:/.test(tab.url)) {
      startDwellTimer(tab.id, tab.url);
    }
    else {
      return;
    }
  });
});

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.action === "save_page_data") {
    handleIncomingPage(msg.data).catch(err => {console.error("❌ Error handling incoming page data:", err)});
    
    sendResponse({status: "received"});
    return true; // indicate async response possible
  }
  }
);

async function handleIncomingPage(data) {
  if (!data?.url){
    console.error("❌ Incoming page data missing URL");
    return;
  }
  const existingPage = await getPageByUrl(data.url);
  if (existingPage){
    console.log("Skipping - page already exists: ", data.url);
    return;
  }

  try{
    data.summary = await summarizeWithLLM(data.summary);
  }
  catch(err) {
    console.error("LLM summary error, failing back to truncated text: ", err);
    // fallback to short truncated version if LLM summarization fails
    data.summary = (data.summary || "").slice(0, 600);
  }
    
  console.log(data.summary);
  let embedding = [];

  try {
    embedding = await createEmbedding(data.summary);
  }
  catch(err) {
    console.error("Embedding failed with error: ", err)
  }
  const pageObj = {url: data.url, title: data.title, domain: data.domain, summary: data.summary, embedding: embedding, timestamp: Date.now()}
  await upsertPage(pageObj);  // upsert page by url in IndexedDB
}

function startDwellTimer(tabId, url) {
  // avoid duplicate timers
  if (dwellTimers.has(tabId)) {
    clearTimeout(dwellTimers.get(tabId));
  }

  const timerId = setTimeout(async () => {
    console.log(`⏱️ Dwell time met for ${url}`);
    await triggerPageCapture(tabId);
    dwellTimers.delete(tabId);
  }, DWELL_THRESHOLD);

  dwellTimers.set(tabId, timerId);
}

async function triggerPageCapture(tabId) {
  try {
    // Ensure content script is injected
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/content.js"]
    });

    // Now send message safely
    chrome.tabs.sendMessage(tabId, { type: "CAPTURE_PAGE" }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("⚠️ Message send failed:", chrome.runtime.lastError.message);
      } else {
        console.log("📩 Capture response:", response);
      }
    });
  } catch (err) {
    console.error("❌ Failed to trigger capture:", err);
  }
}









