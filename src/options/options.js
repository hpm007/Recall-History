import { PRELOADED_DOMAINS } from "./config_options";

const input = document.getElementById("domainInput");
const addBtn = document.getElementById("addBtn");
const listEl = document.getElementById("list");

let domains = [];

addBtn.onclick = () => addDomain();

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addDomain();
});

document.getElementById("resetBtn").onclick = async () => {
  domains = PRELOADED_DOMAINS.map(normalize);
  await chrome.storage.local.set({ excluded_domains: domains });
  render();
};

function normalize(d) {
  return d
    .replace(/^[*@]*/, "")          // remove accidental wildcards
    .replace(/^https?:\/\//, "")
    .split(/[/?#]/)[0]
    .toLowerCase()
    .trim();
}


function addDomain() {
  const raw = normalize(input.value);
  if (!raw) return;

  // prevent duplicates
  if (domains.includes(raw)) {
    console.log("duplicate ignored:", raw);
    input.value = "";
    return;
  }

  domains.push(raw);
  chrome.storage.local.set({ excluded_domains: domains }, render);

  input.value = "";
}

function removeDomain(i) {
  domains.splice(i, 1);
  chrome.storage.local.set({ excluded_domains: domains }, render);
}

function render() {
  listEl.innerHTML = "";

  domains.forEach((d, i) => {
    const div = document.createElement("div");
    div.className = "row";

    div.innerHTML = `
      <span>${d}</span>
      <button class="del">Delete</button>
    `;

    div.querySelector(".del").onclick = () => removeDomain(i);
    listEl.appendChild(div);
  });
}

async function load(){
  const r = await chrome.storage.local.get("excluded_domains");

  if (!Array.isArray(r.excluded_domains)){
    domains = PRELOADED_DOMAINS.map(normalize);
    await chrome.storage.local.set({excluded_domains: domains});
    console.log("📦 Seeded exclusions from preloaded list");
  }
  else {
    domains = r.excluded_domains.map(normalize);
  }
  render();
}

load();