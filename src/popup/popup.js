import { getAllPages } from "../db_store.js";
import { createEmbedding } from "../summarizer/summarize.js";

const query = document.getElementById("query");
const resultsEl = document.getElementById("results");

query.addEventListener("keydown", async (e) => {
    if (e.key === "Enter"){
        await runSearch(query.value.trim());
    }
})

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
    const storedPages = await getAllPages();
    
    const rankedPages = storedPages.filter(p => Array.isArray(p.embedding)).map(p => ({page: p, score: similarityScore(embeddedQuery, p.embedding)}))
                                    .sort((a, b) => b.score - a.score).slice(0, num_results);                                

    if (rankedPages){
      console.log("ranking returned: ", rankedPages)
    }
    const groupedPages = groupByDomain(rankedPages);     
    renderResults(groupedPages);
}

function similarityScore(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function groupByDomain(results) {
  const groups = new Map();

  for (const r of results) {
    const domain = r.page.domain || new URL(r.page.url).hostname;
    if (!groups.has(domain)) {
      groups.set(domain, []);
    }
    groups.get(domain).push(r);
  }

  return groups;
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

        renderResults(scored);
    });
}

function renderResults(groupedResults) {
  resultsEl.innerHTML = "";

  if (groupedResults.size === 0) {
    resultsEl.innerHTML = "<div>No matches found</div>";
    return;
  }

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
}

function escape(str = "") {
  return str.replace(/[&<>"']/g, s =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[s])
  );
}
