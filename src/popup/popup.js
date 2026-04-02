import { getAllPages } from "../db_store.js";
import { createEmbedding } from "../summarizer/summarize.js";

const query = document.getElementById("query");
const resultsEl = document.getElementById("results");
const API_BASE = "https://dev-api.recallhistory.net";

let currentIndex = -1;
let flatResults = [];   // [{page, score}]

init();
// document.getElementById("usageContainer").onclick = showUpgradeUI;

query.addEventListener("keydown", (e) => {
  if (!flatResults) return;

  if (e.key === "ArrowDown"){
    e.preventDefault();
    moveSelection(1);
  }
  else if (e.key === "ArrowUp"){
    e.preventDefault();
    moveSelection(-1);
  }
  else if (e.key === "Enter" && currentIndex >= 0){
    e.preventDefault();
    openSelected();
  }
})

query.addEventListener("keydown", async (e) => {
    if (e.key === "Enter"){
        await runSearch(query.value.trim());
    }
})

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "LIMIT_REACHED"){
    showUpgradeUI(msg);
  }
});

async function init(){
  const { user_id: userId } = await chrome.storage.local.get("user_id");
  // const api_base = await chrome.storage.local.get("api_base");
  // const API_BASE = api_base || "https://api.recallhistory.net";

  // await syncUserPlan();
  // applies only to 'free' users
  const resp = await fetch(`${API_BASE}/usage`, {
      method: "GET",
      headers: { 
        "Content-Type": "application/json",
        "x-user-id": userId }
  });
  const data = await resp.json();
  console.log(userId, data.usage);
  updateUsageUI(data.usage, data.limit);
  
  const { limit_state } = await chrome.storage.local.get("limit_state");
  if (limit_state?.reached || data.usage >= data.limit) {
    showUpgradeUI(limit_state);
  }
}


function moveSelection(delta) {
  const max = flatResults.length - 1;

  currentIndex =
    currentIndex < 0 ? 0 :
    Math.min(max, Math.max(0, currentIndex + delta));

  highlight();
}

function openSelected(){
  const {page} = flatResults[currentIndex];
  chrome.tabs.create({url: page.url});
}

function renderList(results){
  resultsEl.innerHTML = "";
  flatResults = results;

  results.forEach(({page, score}, i) => {
    const div = document.createElement("div");
    div.className = "result";
    div.dataset.index = i;

    div.innerHTML = `
      <div class="title">${escape(page.title)}</div>
      <div class="meta">
        ${new Date(page.timestamp).toLocaleDateString()}
        • score ${score.toFixed(2)}
      </div>
      <div class= "snippet">
        ${escape(page.summary.slice(0, 160))}...
      </div>
      <button class= "preview-btn">Preview</button>
      `;
    
    div.querySelector(".preview-btn").onclick = (e) => {
      e.stopPropagation();
      showPreview(page, score);
    }

    div.onclick = () => chrome.tabs.create({url: page.url});
    resultsEl.appendChild(div);
  })
}

async function runSearch(query){
    if (!query){
        return
    }

    resultsEl.innerHTML = "Searching...";
    let embeddedQuery;

    try {
        embeddedQuery = await createEmbedding(query);
    }
    catch (err){
        console.error("Query embedding operation failed: ", err);
        return fallbackKeywordSearch(query);
    }

    // rank stored pages
    const num_results = 5;
    const similarity_threshold = 0.4;
    const storedPages = await getAllPages();
    
    const rankedResults = storedPages.filter(p => Array.isArray(p.embedding)).map(p => ({page: p, score: similarityScore(embeddedQuery, p.embedding)}))
                                    .filter(res => res.score >= similarity_threshold).sort((a, b) => b.score - a.score).slice(0, num_results);                                
                                    
    if (rankedResults.length === 0) {
      resultsEl.innerHTML = "<div>No matches found</div>";
      return;
    }                                      
    let relResults = rankedResults;                                    
    if (rankedResults.length > 1){
      let topScore = rankedResults[0].score;
      const topResultRelCut = 0.5; 
      relResults = rankedResults.filter(r => r.score >= topScore * topResultRelCut);
    }                                    
    
    flatResults = relResults.map(r => ({page: r.page, score: r.score}));
    currentIndex = -1;
    renderList(flatResults);
}

function similarityScore(a, b) {
  if (!Array.isArray(a)) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function highlight() {
  document.querySelectorAll(".result").forEach(el => {
    el.classList.remove("selected");
  });

  if (currentIndex >= 0) {
    const el =
      document.querySelector(`.result[data-index="${currentIndex}"]`);
    el?.classList.add("selected");
  }
}

function showPreview(page, score) {
  resultsEl.innerHTML = `
    <h3>${escape(page.title)}</h3>
    <div class="meta">score ${score.toFixed(2)}</div>
    <pre class="full-summary">${escape(page.summary)}</pre>
    <button id="open-original">Open Original</button>
    <button id="back">Back</button>
  `;

  document.getElementById("open-original").onclick =
    () => chrome.tabs.create({ url: page.url });

  document.getElementById("back").onclick =
    () => renderList(flatResults);
}

async function fallbackKeywordSearch(query) {
    getAllPages().then(pages => {
        const q = query.toLowerCase();
        
        const scored = pages.map(p => {
            let score = 0;
            if (p.title.toLowerCase().includes(q)) score += 2;
            if (p.summary?.toLowerCase().includes(q)) score += 1;
            return {page: p, score}
        }).filter(o => o.score > 0).sort((a, b) => b.score - a.score);

        renderList(scored);
    });
}

/* function renderResults(groupedResults) {
  resultsEl.innerHTML = "";

  for (const [domain, group] of groupedResults.entries()){
    // domain header
    const header = document.createElement("div");
    header.className = "domain-header";
    header.textContent = domain;
    resultsEl.appendChild(header);
    // domain entity
    for (const { page, score } of group.slice()) {
      const div = document.createElement("div");
      div.className = "result";

      div.innerHTML = `
        <div class="title">${escape(page.title)}</div>
        <div class="meta">
          ${new Date(page.timestamp).toLocaleDateString()}
          • score ${score.toFixed(2)}
        </div>
        <div class="snippet">
          ${escape(page.summary.slice(0, 180))}…
        </div>
      `;

      div.onclick = () => chrome.tabs.create({ url: page.url });
      resultsEl.appendChild(div);
    }
  }
} */

function escape(str = "") {
  return str.replace(/[&<>"']/g, s =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[s])
  );
}
// Important Note: Don't use domain grouping as ranking of individual results from different domains gets distorted

function showUpgradeUI(data) {
  const el = document.getElementById("upgrade");
  el.style.display = "block";

  document.getElementById("usageText").textContent =
    `${data.usage} / ${data.limit} pages used`;

  document.getElementById("feedbackBtn").onclick = () => {
    chrome.tabs.create({url: "https://docs.google.com/forms/d/e/1FAIpQLSd5LxtB0TAjZ-pUiwVMXMaGGIkV4OO40Tl8itL33jR-VRYzTQ/viewform?usp=publish-editor"});
  };
  // document.getElementById("upgradeBtn").onclick = showPricing;
}

async function showPricing() {
  const { user_id: userId } = await chrome.storage.local.get("user_id");

  const pricing_url = `https://recallhistory.net/pricing?user_id=${userId}`;
  chrome.tabs.create({url: pricing_url})
}

function updateUsageUI(usage, limit) {
  const textEl = document.getElementById("usageText");
  const barEl = document.getElementById("usageBar");

  console.log(`limit: ${limit}`);
  if (!limit) return;
  const percent = Math.min((usage / limit) * 100, 100);
  textEl.textContent = `${usage} / ${limit} pages used`;
  barEl.style.width = percent + "%";

  if (percent > 80) {
    barEl.style.background = "#e11d48"; // red
  } else if (percent > 60) {
    barEl.style.background = "#f59e0b"; // amber
  } else {
    barEl.style.background = "black";
  }
}

async function syncUserPlan() {
  const { user_id: userId } = await chrome.storage.local.get("user_id");

  const resp = await fetch(`${API_BASE}/debug/user`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    }
  });

  const user = await resp.json();
  if (user?.plan === "pro") {
    chrome.storage.local.set({ user_plan: "pro" });
    chrome.storage.local.remove("limit_state");
  }
}