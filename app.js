// ---- Supabase connection ----
// These two values connect the site to your Supabase database.
const SUPABASE_URL = "https://tpqaewvlbwjdbfxrdxgh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwcWFld3ZsYndqZGJmeHJkeGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMDI2OTksImV4cCI6MjEwMDU3ODY5OX0.ffDCwhVi00M5cMYkE-O1jcWaS65RCPftUIYVuflm9TM";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Planned zones ----
// This list includes every zone we've planned, even ones with no content yet.
// Once a matching row exists in the "zones" table, it automatically becomes
// clickable here instead of showing "coming soon" - no code change needed.
const PLANNED_ZONES = [
  { id: "matter", name: "matter", icon: "flask", desc: "what stuff is made of" },
  { id: "forces-motion", name: "forces and motion", icon: "arrows-move", desc: "why things push, pull, and stay put" },
  { id: "energy", name: "energy", icon: "bolt", desc: "energy never disappears, it just changes costumes" },
  { id: "electricity-magnetism", name: "electricity and magnetism", icon: "magnet", desc: "invisible forces you can actually feel" },
  { id: "sound", name: "sound", icon: "wave-square", desc: "vibrations you can hear" },
  { id: "light", name: "light", icon: "sun", desc: "how you actually see anything at all" },
  { id: "kitchen-skills", name: "kitchen skills", icon: "chef-hat", desc: "poke around the kitchen, figure out how it actually works" },
];

// Turns any full URL in a block of text into a clickable link that opens in a new tab
function linkify(text) {
  return text.replace(
    /(https?:\/\/[^\s)]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: var(--accent);">$1</a>'
  );
}

const app = document.getElementById("app");

// ---- Simple hash-based router ----
// The part of the URL after # tells us which page to show.
// Examples: #/  #/zone/matter  #/spark/why-things-float
window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);

document.querySelector(".site-header").addEventListener("click", () => {
  window.location.hash = "#/";
});

function route() {
  const hash = window.location.hash || "#/";
  const parts = hash.replace("#/", "").split("/").filter(Boolean);

  if (parts.length === 0) {
    renderHome();
  } else if (parts[0] === "zone" && parts[1]) {
    renderZone(parts[1]);
  } else if (parts[0] === "spark" && parts[1]) {
    renderSpark(parts[1]);
  } else {
    renderHome();
  }
}

// ---- Home page ----
async function renderHome() {
  app.innerHTML = `<p class="loading-text">loading zones...</p>`;

  const { data: zones, error } = await supabaseClient.from("zones").select("id, tagline");

  if (error) {
    app.innerHTML = `<p class="error-text">couldn't load zones: ${error.message}</p>`;
    return;
  }

  const liveZonesById = {};
  (zones || []).forEach((z) => { liveZonesById[z.id] = z; });

  const zoneTilesHtml = PLANNED_ZONES.map((zone) => {
    const liveZone = liveZonesById[zone.id];
    const isLive = Boolean(liveZone);
    const desc = isLive ? liveZone.tagline : zone.desc;
    return `
      <div class="zone-tile ${isLive ? "" : "empty"}" ${isLive ? `onclick="window.location.hash='#/zone/${zone.id}'"` : ""}>
        <i class="ti ti-${zone.icon}"></i>
        <p class="zone-title">${zone.name}</p>
        <p class="zone-desc">${desc}</p>
      </div>
    `;
  }).join("");

  app.innerHTML = `
    <h2>poke at something. see what happens.</h2>
    <p class="subtitle">pick a zone, filter by mood, or just get surprised</p>

    <p class="section-label">zones</p>
    <div class="zone-grid">${zoneTilesHtml}</div>

    <p class="section-label">filter</p>
    <div class="filter-row">
      <select id="filter-time">
        <option value="">any time</option>
        <option value="under 5 min">under 5 min</option>
        <option value="5-15 min">5-15 min</option>
        <option value="15-30 min">15-30 min</option>
        <option value="30+ min">30+ min</option>
        <option value="check back later">check back later</option>
      </select>
      <select id="filter-mess">
        <option value="">any mess</option>
        <option value="no mess">no mess</option>
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
      </select>
      <select id="filter-materials">
        <option value="">any materials</option>
        <option value="kitchen only">kitchen only</option>
        <option value="basic household">basic household</option>
        <option value="needs specific supplies">needs specific supplies</option>
        <option value="outdoor space helpful">outdoor space helpful</option>
      </select>
      <select id="filter-adult">
        <option value="">adult help</option>
        <option value="none needed">none needed</option>
        <option value="nearby recommended">nearby recommended</option>
        <option value="required">required</option>
      </select>
    </div>

    <div id="filter-results"></div>

    <button class="btn-primary" id="surprise-btn">
      <i class="ti ti-arrows-shuffle"></i> surprise me
    </button>
  `;

  document.getElementById("surprise-btn").addEventListener("click", surpriseMe);

  ["filter-time", "filter-mess", "filter-materials", "filter-adult"].forEach((id) => {
    document.getElementById(id).addEventListener("change", runFilter);
  });
}

// ---- Filter logic ----
async function runFilter() {
  const time = document.getElementById("filter-time").value;
  const mess = document.getElementById("filter-mess").value;
  const materials = document.getElementById("filter-materials").value;
  const adult = document.getElementById("filter-adult").value;
  const resultsEl = document.getElementById("filter-results");

  if (!time && !mess && !materials && !adult) {
    resultsEl.innerHTML = "";
    return;
  }

  resultsEl.innerHTML = `<p class="loading-text">searching...</p>`;

  let query = supabaseClient.from("experiments").select("spark_id, title");
  if (time) query = query.eq("time_tag", time);
  if (mess) query = query.eq("mess_tag", mess);
  if (materials) query = query.eq("materials_tag", materials);
  if (adult) query = query.eq("adult_tag", adult);

  const { data: matches, error } = await query;

  if (error) {
    resultsEl.innerHTML = `<p class="error-text">search failed: ${error.message}</p>`;
    return;
  }

  if (!matches || matches.length === 0) {
    resultsEl.innerHTML = `<p class="subtitle">nothing matches those filters yet - try loosening one.</p>`;
    return;
  }

  const sparkIds = [...new Set(matches.map((m) => m.spark_id))];
  const { data: sparks } = await supabaseClient
    .from("sparks")
    .select("id, title, vibe_tagline")
    .in("id", sparkIds);

  resultsEl.innerHTML = `
    <p class="section-label">matches</p>
    <div class="spark-list" style="margin-bottom: 24px;">
      ${(sparks || [])
        .map(
          (s) => `
        <div class="spark-card" onclick="window.location.hash='#/spark/${s.id}'">
          <p class="spark-title">${s.title}</p>
          <p class="spark-vibe">${s.vibe_tagline || ""}</p>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

async function surpriseMe() {
  const { data: sparks, error } = await supabaseClient.from("sparks").select("id");
  if (error || !sparks || sparks.length === 0) return;
  const randomSpark = sparks[Math.floor(Math.random() * sparks.length)];
  window.location.hash = `#/spark/${randomSpark.id}`;
}

// ---- Zone page ----
async function renderZone(zoneId) {
  app.innerHTML = `<p class="loading-text">loading zone...</p>`;

  const { data: zone, error: zoneError } = await supabaseClient
    .from("zones")
    .select("*")
    .eq("id", zoneId)
    .single();

  const { data: sparks, error: sparksError } = await supabaseClient
    .from("sparks")
    .select("*")
    .eq("zone_id", zoneId);

  if (zoneError || sparksError) {
    app.innerHTML = `<p class="error-text">couldn't load this zone.</p>`;
    return;
  }

  const starterKitHtml = zone.starter_kit
    ? `
    <div class="detail-section" style="border-top: none; padding-top: 0;">
      <p class="detail-label">grab these first</p>
      <p class="detail-text">${zone.starter_kit}</p>
    </div>
  `
    : "";

  app.innerHTML = `
    <button class="back-link" onclick="window.location.hash='#/'">
      <i class="ti ti-arrow-left"></i> curio lab
    </button>

    <i class="ti ti-${zone.icon}" style="font-size:24px; color: var(--accent);"></i>
    <h2>${zone.name}</h2>
    <p class="subtitle">${zone.tagline || ""}</p>

    ${starterKitHtml}

    <div class="spark-list">
      ${(sparks || [])
        .map(
          (s) => `
        <div class="spark-card" onclick="window.location.hash='#/spark/${s.id}'">
          <p class="spark-title">${s.title}</p>
          <p class="spark-vibe">${s.vibe_tagline || ""}</p>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

// ---- Spark detail page ----
async function renderSpark(sparkId) {
  app.innerHTML = `<p class="loading-text">loading...</p>`;

  const { data: spark, error: sparkError } = await supabaseClient
    .from("sparks")
    .select("*")
    .eq("id", sparkId)
    .single();

  const { data: experiments, error: expError } = await supabaseClient
    .from("experiments")
    .select("*")
    .eq("spark_id", sparkId);

  if (sparkError || expError || !spark) {
    app.innerHTML = `<p class="error-text">couldn't load this spark.</p>`;
    return;
  }

  const defaultExp = (experiments || []).find((e) => e.is_default) || experiments[0];
  const altExps = (experiments || []).filter((e) => e !== defaultExp);

  const tagsHtml = defaultExp
    ? `
    <div class="tag-row">
      ${defaultExp.time_tag ? `<span class="tag-pill"><i class="ti ti-clock"></i> ${defaultExp.time_tag}</span>` : ""}
      ${defaultExp.materials_tag ? `<span class="tag-pill">${defaultExp.materials_tag}</span>` : ""}
      ${defaultExp.mess_tag ? `<span class="tag-pill">${defaultExp.mess_tag}</span>` : ""}
      ${defaultExp.adult_tag ? `<span class="tag-pill">${defaultExp.adult_tag}</span>` : ""}
    </div>
  `
    : "";

  const stepsHtml = defaultExp
    ? `
    <div class="detail-section">
      <p class="detail-label">try this — ${defaultExp.title}</p>
      ${defaultExp.supplies ? `<p class="detail-text" style="margin-bottom: 10px;"><strong>you'll need:</strong> ${defaultExp.supplies}</p>` : ""}
      <ol class="steps-list">
        ${defaultExp.steps
          .split(/\d\)\s*/)
          .filter(Boolean)
          .map((step) => `<li>${step.trim().replace(/\.$/, "")}</li>`)
          .join("")}
      </ol>
    </div>
  `
    : "";

  const altHtml =
    altExps.length > 0
      ? `
    <button class="alt-toggle" onclick="document.getElementById('alt-panel').classList.toggle('open')">
      <i class="ti ti-refresh"></i> try a different way
    </button>
    <div class="alt-panel" id="alt-panel">
      ${altExps
        .map(
          (alt) => `
        <div class="alt-item">
          <p class="alt-title">${alt.title}</p>
          <p class="alt-steps">${alt.steps}</p>
          ${alt.supplies ? `<p class="alt-steps" style="margin-top: -2px;"><strong>you'll need:</strong> ${alt.supplies}</p>` : ""}
          ${alt.time_tag ? `<span class="alt-tag">${alt.time_tag}</span>` : ""}
          ${alt.mess_tag ? `<span class="alt-tag">${alt.mess_tag}</span>` : ""}
        </div>
      `
        )
        .join("")}
    </div>
  `
      : "";

  app.innerHTML = `
    <button class="back-link" onclick="window.location.hash='#/zone/${spark.zone_id}'">
      <i class="ti ti-arrow-left"></i> ${spark.zone_id.replace("-", " ")}
    </button>

    <h2>${spark.title}</h2>
    <p class="subtitle">${spark.vibe_tagline || ""}</p>

    ${tagsHtml}

    <button class="print-btn" onclick="window.print()">
      <i class="ti ti-printer"></i> print this
    </button>

    <div class="detail-section">
      <p class="detail-label">the gist</p>
      <p class="detail-text">${spark.gist}</p>
    </div>

    ${stepsHtml}
    ${altHtml}

    <div class="detail-section">
      <p class="detail-label">thirsty for more?</p>
      <p class="detail-text">${spark.nerd_out}</p>
    </div>

    ${
      spark.rabbit_hole
        ? `
    <div class="detail-section">
      <p class="detail-label">down the rabbit hole</p>
      <p class="detail-text">${linkify(spark.rabbit_hole)}</p>
    </div>
    `
        : ""
    }
  `;
}
