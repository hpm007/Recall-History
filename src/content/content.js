import { isExcludedUrl } from '../options/config_options.js';
import Readability from '../utils/readability-main/Readability.js';

function convertToStructuredText(node) {
  let text = "";
  
  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tagName = child.tagName.toLowerCase();
      
      // Process children first (recursion)
      const childText = convertToStructuredText(child).trim();
      if (!childText) return;

      // Apply formatting based on tag
      switch (tagName) {
        case "h1": case "h2": case "h3":
          text += `\n\n### ${childText}\n\n`;
          break;
        case "p":
          text += `\n\n${childText}\n`;
          break;
        case "li":
          text += `\n• ${childText}`;
          break;
        case "br":
          text += `\n`;
          break;
        default:
          // For divs, spans, sections, etc., just add the text 
          // without extra breaks to avoid "staircase" effects
          text += childText; 
      }
    }
  });
  
  return text;
}


function chunkText(text, maxLength = 4000, overlap = 200) {
  const chunks = [];
  let currentChunk = "";
  
  // Split by double newlines to keep paragraphs together
  const paragraphs = text.split(/\n\n/);
  
  for (let para of paragraphs) {
    // If a single paragraph is somehow bigger than the limit, 
    // we have to break it by sentences (crude fallback)
    if (para.length > maxLength) {
      const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
      for (let sentence of sentences) {
        if ((currentChunk.length + sentence.length) > maxLength) {
          chunks.push(currentChunk.trim());
          // Start next chunk with overlap for context
          currentChunk = currentChunk.slice(-overlap) + sentence;
        } else {
          currentChunk += " " + sentence;
        }
      }
    } 
    // Normal paragraph handling
    else if ((currentChunk.length + para.length) > maxLength) {
      chunks.push(currentChunk.trim());
      // Start next chunk with the end of the previous one
      currentChunk = currentChunk.slice(-overlap) + "\n\n" + para;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

function extractReadableContent() {
  try {
    const doc = document.cloneNode(true);
    const reader = new Readability(doc);
    const article = reader.parse();

    const currURL = window.location.href;
    if (!article) {
      console.warn("⚠️ Readability returned null");
      return null;
    }
    if (isExcludedUrl(currURL)){
      return null;
    }
    const cleanDoc = new DOMParser().parseFromString(article.content, "text/html");
    const root = cleanDoc.body;
    // const structuredText = article.textContent;
    const structuredText = convertToStructuredText(root).replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    
    const maxLength = 4000;
    const overlap = 200;
    const trimmedText = chunkText(structuredText, maxLength, overlap).join("\n\n");

    return {
      title: article.title,
      url: currURL,
      summary: trimmedText
    };
  } catch (err) {
    console.error("❌ Extraction error:", err);
    return null;
  }
}

function sendContent() {
  const data = extractReadableContent();
  if (data && data.url) {
      match_substr = data.url.match(/^(?:https?\:\/\/)(?:www\.)?(.+)\.(?:[a-z]+)(?=\/)/i);
      data.url = data.url.slice(0, 100)
      domain_name = match_substr ? match_substr[1].replace('.', ' ') : null;
      data.title = data.title ? data.title : domain_name;

      data.summary = data.summary.replace(/\s+/g, ' ').trim();
      chrome.runtime.sendMessage({ action: "save_page_data", data });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CAPTURE_PAGE") {
    const run = async () => {
      sendContent();
      sendResponse({status: "ok"});
    };
    // ensure it runs after DOM is ready
    if (document.readyState === "complete" || document.readyState === "interactive") {
      run();
    } else {
      window.addEventListener("DOMContentLoaded", run, {once: true});
    }
    // can try with chrome.tabs.onUpdated instead of window.addEvenListener
    return true;
  }
});


