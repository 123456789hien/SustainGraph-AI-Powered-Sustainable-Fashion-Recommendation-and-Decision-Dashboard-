/* script.js
   Wires DOM to logic in app.js.
   No imports. Needs app.js loaded before this file.
*/

const fileInput = document.getElementById("fileUpload");
const btnSample = document.getElementById("load-sample");
const btnAuto = document.getElementById("auto-upload");
const btnRun = document.getElementById("run-pipeline");
const statusEl = document.getElementById("load-status");

const brandFilter = document.getElementById("brand-filter");
const materialFilter = document.getElementById("material-filter");
const countryFilter = document.getElementById("country-filter");
const yearFilter = document.getElementById("year-filter");
const certFilter = document.getElementById("cert-filter");
const trendFilter = document.getElementById("trend-filter");
const prioritySelect = document.getElementById("priority");

const kpiRow = document.getElementById("kpi-row");
const pcaDiv = document.getElementById("pca-plot");
const clusterLegend = document.getElementById("material-clusters");
const recoList = document.getElementById("recommendations-list");

// state
let RAW_ROWS = [];
let PROCESSED_ROWS = [];
let STATS = null;
let MATERIAL_AGG = [];
let PCA_POINTS = [];

// IMPORTANT: Auto-load URL — hãy chỉnh lại cho đúng repo của bạn
const AUTOLOAD_URL =
  "https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/v15/public/Kaggle_sust_dataset.csv";

/* ========== LOAD HANDLERS ========== */

fileInput.addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const rows = await parseCSVFile(f);
    onDataLoaded(rows, `Loaded from file: ${f.name}`);
  } catch (err) {
    console.error(err);
    statusEl.innerText = "❌ Error reading file";
  }
});

btnSample.addEventListener("click", async () => {
  try {
    const resp = await fetch("Kaggle_sust_dataset.csv");
    if (!resp.ok) throw new Error("Cannot fetch Kaggle_sust_dataset.csv");
    const txt = await resp.text();
    const rows = parseCSVText(txt);
    onDataLoaded(rows, "✅ Loaded local Kaggle_sust_dataset.csv");
  } catch (err) {
    console.error(err);
    statusEl.innerText =
      "❌ Could not load Kaggle_sust_dataset.csv (place it next to index.html)";
  }
});

btnAuto.addEventListener("click", async () => {
  try {
    const resp = await fetch(AUTOLOAD_URL);
    if (!resp.ok) throw new Error("Auto-load URL not reachable");
    const txt = await resp.text();
    const rows = parseCSVText(txt);
    onDataLoaded(rows, "✅ Auto-loaded dataset from GitHub");
  } catch (err) {
    console.error(err);
    statusEl.innerText = "❌ Auto-load failed (check AUTOLOAD_URL in script.js)";
  }
});

function onDataLoaded(rows, message) {
  RAW_ROWS = rows;
  PROCESSED_ROWS = [];
  STATS = null;
  MATERIAL_AGG = [];
  PCA_POINTS = [];
  statusEl.innerText = message + ` — rows: ${rows.length}`;
  populateFilters(rows);
  clearResults();
}

/* ========== FILTERING AND HANDLING DATA ========== */

function populateFilters(rows) {
  const materials = uniqueSorted(rows.map((r) => r.Material_Type));  // Filter by Material_Type
  const countries = uniqueSorted(rows.map((r) => r.Country));
  const years = uniqueSorted(
    rows
      .map((r) => parseInt(r.Year || r.year || "", 10))
      .filter((v) => !isNaN(v))
  );
  const certs = uniqueSorted(rows.map((r) => r.Certifications));
  const trends = uniqueSorted(rows.map((r) => r.Market_Trend));

  fillSelect(materialFilter, materials);
  fillSelect(countryFilter, countries);
  fillSelect(yearFilter, years.map(String));
  fillSelect(certFilter, certs);
  fillSelect(trendFilter, trends);
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

function fillSelect(sel, values) {
  sel.innerHTML = '<option value="__all">All</option>';
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

/* ========== PIPELINE AND PROCESSING ========== */

function runPipeline() {
  if (!RAW_ROWS.length) {
    alert("Please upload or auto-load the dataset first.");
    return;
  }
  btnRun.disabled = true;
  btnRun.textContent = "Processing...";

  try {
    const filtered = RAW_ROWS.filter((r) => {
      const material = r.Material_Type;
      const country = r.Country;
      const year = parseInt(r.Year || r.year || "", 10);
      const cert = r.Certifications;
      const trend = r.Market_Trend;

      if (materialFilter.value !== "__all" && material !== materialFilter.value)
        return false;
      if (countryFilter.value !== "__all" && country !== countryFilter.value)
        return false;
      if (yearFilter.value !== "__all" && year !== +yearFilter.value)
        return false;
      if (certFilter.value !== "__all" && cert !== certFilter.value)
        return false;
      if (trendFilter.value !== "__all" && trend !== trendFilter.value)
        return false;
      return true;
    });

    if (!filtered.length) {
      alert("No rows match current filters.");
      return;
    }

    const { rowsWithSIS, stats, materialAgg } =
      normalizeAndComputeSIS(filtered);
    PROCESSED_ROWS = rowsWithSIS;
    STATS = stats;
    MATERIAL_AGG = materialAgg;

    renderKPIs();
    renderEdaCharts(filtered);
    buildAndRenderRecommendations();
  } catch (err) {
    console.error(err);
    alert("Pipeline error (see console).");
  } finally {
    btnRun.disabled = false;
    btnRun.textContent = "🚀 Run Analysis & Recommendations";
  }
}

btnRun.addEventListener("click", runPipeline);
