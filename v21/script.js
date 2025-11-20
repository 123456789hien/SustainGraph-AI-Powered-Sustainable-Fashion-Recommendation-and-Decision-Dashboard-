/* script.js
   Wires DOM to logic in app.js.
   No imports. Needs app.js loaded before this file.
*/

const fileInput = document.getElementById("fileUpload");
const btnSample = document.getElementById("load-sample");
const btnAuto = document.getElementById("auto-upload");
const btnRun = document.getElementById("run-pipeline");
const statusEl = document.getElementById("load-status");

// brandFilter removed (too many unique brands)
const countryFilter = document.getElementById("country-filter");
const materialFilter = document.getElementById("material-filter");
const yearFilter = document.getElementById("year-filter");
const certFilter = document.getElementById("cert-filter");
const trendFilter = document.getElementById("trend-filter");
const prioritySelect = document.getElementById("priority");

const kpiRow = document.getElementById("kpi-row");
const pcaDiv = document.getElementById("pca-plot");
const clusterLegend = document.getElementById("material-clusters");
const recoList = document.getElementById("recommendations-list");

// EDA targets
const edaScatter = document.getElementById("eda-scatter");
const edaCountry = document.getElementById("eda-country");

// state
let RAW_ROWS = [];
let PROCESSED_ROWS = [];
let STATS = null;
let MATERIAL_AGG = [];
let PCA_POINTS = [];

// IMPORTANT: Auto-load URL — hãy chỉnh lại cho đúng repo của bạn
const AUTOLOAD_URL =
  "https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/v21/Kaggle_sust_dataset.csv";

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

/* ========== FILTER HELPERS ========== */

// robust extractor: tries multiple possible field names
function extractMaterialField(r) {
  return (
    r.Material_Type ||
    r["Material_Type"] ||
    r.material ||
    r.Material ||
    r["Material Type"] ||
    r["material_type"] ||
    ""
  );
}

function extractBrandField(r) {
  return r.Brand_Name || r.Brand || r["Brand_Name"] || r["Brand"] || "";
}

function extractCountryField(r) {
  return r.Country || r.country || r["Country"] || "";
}

function populateFilters(rows) {
  // brand filter intentionally removed
  const countries = uniqueSorted(rows.map((r) => extractCountryField(r)));
  const mats = uniqueSorted(rows.map((r) => (extractMaterialField(r) || "").trim()));
  const years = uniqueSorted(
    rows
      .map((r) => parseInt(r.Year || r.year || r[" Year"] || "", 10))
      .filter((v) => !isNaN(v))
  );
  const certs = uniqueSorted(rows.map((r) => r.Certifications || r["Certifications"] || ""));
  const trends = uniqueSorted(rows.map((r) => r.Market_Trend || r["Market_Trend"] || ""));

  // fill selects (brand removed)
  fillSelect(countryFilter, countries);
  fillSelect(materialFilter, mats);
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

/* ========== RUN PIPELINE ========== */

btnRun.addEventListener("click", () => {
  if (!RAW_ROWS.length) {
    alert("Please upload or auto-load the dataset first.");
    return;
  }
  btnRun.disabled = true;
  btnRun.textContent = "Processing...";

  try {
    const filtered = RAW_ROWS.filter((r) => {
      // brand removed from filter logic
      const mat = extractMaterialField(r);
      const country = extractCountryField(r);
      const year = parseInt(r.Year || r.year || r[" Year"] || "", 10);
      const cert = r.Certifications || r["Certifications"] || "";
      const trend = r.Market_Trend || r["Market_Trend"] || "";

      if (countryFilter.value !== "__all" && country !== countryFilter.value)
        return false;
      if (materialFilter.value !== "__all" && (mat || "") !== materialFilter.value)
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
    clusterAndRenderMaterials();
    buildAndRenderRecommendations();
    renderEDA(); // new EDA render
  } catch (err) {
    console.error(err);
    alert("Pipeline error (see console).");
  } finally {
    btnRun.disabled = false;
    btnRun.textContent = "🚀 Run Analysis & Recommendations";
  }
});

/* ========== KPI RENDER ========== */

function renderKPIs() {
  if (!PROCESSED_ROWS.length || !STATS) {
    kpiRow.innerHTML = "";
    return;
  }
  const mean = STATS.mean;
  const avgSIS = mean.SIS || 0;

  kpiRow.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-title">Avg Sustainability Index (SIS)</div>
      <div class="kpi-value">${avgSIS.toFixed(2)}</div>
      <div class="kpi-sub">Higher is better</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Avg Carbon Footprint</div>
      <div class="kpi-value">${(mean.Carbon_Footprint_MT || 0).toFixed(
        1
      )}<span class="kpi-sub"> MT</span></div>
      <div class="kpi-sub">Brand-level aggregated</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Avg Water Usage</div>
      <div class="kpi-value">${(mean.Water_Usage_Liters || 0).toFixed(
        0
      )}<span class="kpi-sub"> L</span></div>
      <div class="kpi-sub">Production water intensity</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Avg Price</div>
      <div class="kpi-value">$${(mean.Average_Price_USD || 0).toFixed(
        2
      )}</div>
      <div class="kpi-sub">Across filtered brands</div>
    </div>
  `;
}

/* ========== MATERIAL CLUSTER + PLOT ========== */

function clusterAndRenderMaterials() {
  const agg = MATERIAL_AGG;
  if (!agg.length) {
    pcaDiv.innerHTML = "";
    clusterLegend.innerHTML = "";
    return;
  }
  const featureMatrix = agg.map((m) => [
    m.meanCarbon,
    m.meanWater,
    m.meanWaste,
  ]);
  const { assignments } = runKMeans(featureMatrix, 3, 40);
  const withCluster = agg.map((m, i) => ({
    ...m,
    cluster: assignments[i] || 0,
  }));

  MATERIAL_AGG = withCluster;
  PCA_POINTS = computePcaLikeCoords(withCluster);

  renderPcaScatter();
  renderClusterLegend();
}

function renderPcaScatter() {
  pcaDiv.innerHTML = "";
  const width = pcaDiv.clientWidth || 600;
  const height = pcaDiv.clientHeight || 320;

  const data = PCA_POINTS.map((p, i) => ({
    ...p,
    cluster: MATERIAL_AGG[i].cluster,
    meanSIS: MATERIAL_AGG[i].meanSIS,
    count: MATERIAL_AGG[i].count,
  }));

  const svg = d3
    .select(pcaDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const padding = 30;
  const xScale = d3
    .scaleLinear()
    .domain([0, 1])
    .range([padding, width - padding]);
  const yScale = d3
    .scaleLinear()
    .domain([0, 1])
    .range([height - padding, padding]);

  const colorScale = d3
    .scaleOrdinal()
    .domain([0, 1, 2])
    .range(["#22c55e", "#eab308", "#f97316"]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding})`)
    .call(d3.axisBottom(xScale).ticks(4));
  svg
    .append("g")
    .attr("transform", `translate(${padding},0)`)
    .call(d3.axisLeft(yScale).ticks(4));

  svg
    .append("text")
    .attr("x", padding)
    .attr("y", padding - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Normalized CO₂ vs Water usage per material");

  svg
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", (d) => xScale(d.x))
    .attr("cy", (d) => yScale(d.y))
    .attr("r", (d) => 6 + Math.min(8, d.count / 5))
    .attr("fill", (d) => colorScale(d.cluster))
    .attr("opacity", 0.85)
    .append("title")
    .text(
      (d) =>
        `${d.Material_Type}\nSIS: ${d.meanSIS.toFixed(
          2
        )}\nBrands: ${d.count}`
    );
}

function renderClusterLegend() {
  clusterLegend.innerHTML = "";
  const clusters = [
    { id: 0, label: "Low-impact cluster" },
    { id: 1, label: "Medium-impact cluster" },
    { id: 2, label: "High-impact cluster" },
  ];
  const colors = ["#22c55e", "#eab308", "#f97316"];

  clusters.forEach((c, i) => {
    const pill = document.createElement("div");
    pill.className = "cluster-pill";
    pill.innerHTML = `
      <span class="cluster-dot" style="background:${colors[i]}"></span>
      <span>${c.label}</span>
    `;
    clusterLegend.appendChild(pill);
  });
}

/* ========== RECOMMENDATIONS RENDER ========== */

function buildAndRenderRecommendations() {
  const w = parseFloat(prioritySelect.value || "0.5");
  const recs = buildRecommendations(PROCESSED_ROWS, w, 10);
  renderRecommendations(recs);
}

function renderRecommendations(items) {
  recoList.innerHTML = "";
  if (!items.length) {
    recoList.textContent = "No recommendations for current filters.";
    return;
  }

  items.forEach((item, idx) => {
    const band =
      item.SIS >= 0.75 ? "reco-high" : item.SIS >= 0.55 ? "reco-mid" : "reco-low";

    const div = document.createElement("div");
    div.className = `reco-item ${band}`;
    div.innerHTML = `
      <div class="reco-rank-badge">🔥 Top ${idx + 1}</div>
      <div class="reco-header">
        <div>
          <div class="reco-brand">${item.Brand_Name || item.Brand_ID}</div>
          <div class="reco-tagline">
            ${item.Material_Type || "Unknown material"} • ${
      item.Country || "Unknown country"
    }
          </div>
        </div>
        <div class="reco-metrics">
          <span><strong>SIS</strong> ${item.SIS.toFixed(2)}</span>
          <span><strong>CO₂</strong> ${(item.Carbon_Footprint_MT || 0).toFixed(
            1
          )} MT</span>
          <span><strong>Water</strong> ${(item.Water_Usage_Liters || 0).toFixed(
            0
          )} L</span>
          <span><strong>Price</strong> $${
            item.Average_Price_USD
              ? item.Average_Price_USD.toFixed(2)
              : "N/A"
          }</span>
        </div>
      </div>
      <div class="reco-pill-row">
        ${
          item.Sustainability_Rating
            ? `<span class="reco-pill">Rating: ${item.Sustainability_Rating}</span>`
            : ""
        }
        ${
          item.Eco_Friendly_Manufacturing
            ? `<span class="reco-pill">Eco-friendly: ${item.Eco_Friendly_Manufacturing}</span>`
            : ""
        }
        ${
          item.Recycling_Programs
            ? `<span class="reco-pill">Recycling: ${item.Recycling_Programs}</span>`
            : ""
        }
        ${
          item.Market_Trend
            ? `<span class="reco-pill">Trend: ${item.Market_Trend}</span>`
            : ""
        }
        ${
          item.Certifications
            ? `<span class="reco-pill">Cert: ${item.Certifications}</span>`
            : ""
        }
      </div>
    `;
    recoList.appendChild(div);
  });
}

/* ========== EDA (new) ========== */

function renderEDA() {
  renderScatterPriceSIS();
  renderCountryBar();
}

// Scatter: Price vs SIS colored by Material (top materials shown)
function renderScatterPriceSIS() {
  edaScatter.innerHTML = "";
  if (!PROCESSED_ROWS.length) {
    edaScatter.textContent = "No data for EDA.";
    return;
  }

  // prepare data - only items with numeric price & SIS
  const data = PROCESSED_ROWS.filter(
    (r) => isFinite(r.Average_Price_USD) && isFinite(r.SIS)
  );

  // get material counts from MATERIAL_AGG (already aggregated)
  const matCounts = MATERIAL_AGG
    .slice()
    .sort((a, b) => b.count - a.count)
    .map((m) => ({ material: m.Material_Type, count: m.count }));

  const topMaterials = matCounts.slice(0, 6).map((d) => d.material);

  // dimensions
  const width = edaScatter.clientWidth || 700;
  const height = edaScatter.clientHeight || 360;
  const padding = 40;

  const svg = d3
    .select(edaScatter)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const xVals = data.map((d) => d.Average_Price_USD || 0);
  const yVals = data.map((d) => d.SIS || 0);

  const xScale = d3
    .scaleLinear()
    .domain([d3.min(xVals) * 0.9 || 0, d3.max(xVals) * 1.05 || 1])
    .nice()
    .range([padding, width - padding]);

  const yScale = d3
    .scaleLinear()
    .domain([Math.max(0, d3.min(yVals) * 0.95), d3.max(yVals) * 1.05 || 1])
    .nice()
    .range([height - padding, padding]);

  const color = d3.scaleOrdinal(d3.schemeTableau10);
  const materialForPoint = (d) =>
    topMaterials.includes(d.Material_Type) ? d.Material_Type : "Other";

  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding})`)
    .call(d3.axisBottom(xScale).ticks(6));
  svg
    .append("g")
    .attr("transform", `translate(${padding},0)`)
    .call(d3.axisLeft(yScale).ticks(5));

  svg
    .append("text")
    .attr("x", padding)
    .attr("y", padding - 12)
    .attr("fill", "#4b5563")
    .attr("font-size", 12)
    .text("Price (USD) vs SIS — colored by material (top materials)");

  svg
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", (d) => xScale(d.Average_Price_USD || 0))
    .attr("cy", (d) => yScale(d.SIS || 0))
    .attr("r", 4)
    .attr("fill", (d) => color(materialForPoint(d)))
    .attr("opacity", 0.85)
    .append("title")
    .text((d) => `${d.Brand_Name || d.Brand_ID || "Brand"}\nMaterial: ${d.Material_Type}\nPrice: $${d.Average_Price_USD}\nSIS: ${d.SIS.toFixed(2)}`);
  
  // legend for materials (top materials + Other)
  const legendMaterials = topMaterials.concat(["Other"]);
  const legend = svg.append("g").attr("transform", `translate(${width - padding - 140}, ${padding})`);
  legendMaterials.forEach((m, i) => {
    const g = legend.append("g").attr("transform", `translate(0, ${i * 18})`);
    g.append("rect").attr("width", 12).attr("height", 12).attr("fill", color(m));
    g.append("text").attr("x", 18).attr("y", 10).attr("font-size", 11).text(m);
  });
}

// Bar chart: top countries count
function renderCountryBar() {
  edaCountry.innerHTML = "";
  if (!PROCESSED_ROWS.length) {
    edaCountry.textContent = "No data for country breakdown.";
    return;
  }

  const counts = {};
  PROCESSED_ROWS.forEach((r) => {
    const c = r.Country || "Unknown";
    counts[c] = (counts[c] || 0) + 1;
  });

  const arr = Object.keys(counts).map((k) => ({ country: k, count: counts[k] }));
  arr.sort((a, b) => b.count - a.count);
  const top = arr.slice(0, 10);

  const width = edaCountry.clientWidth || 700;
  const height = edaCountry.clientHeight || 220;
  const padding = 30;

  const svg = d3
    .select(edaCountry)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const xScale = d3
    .scaleBand()
    .domain(top.map((d) => d.country))
    .range([padding, width - padding])
    .padding(0.15);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(top, (d) => d.count) || 1])
    .nice()
    .range([height - padding, padding]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
    .attr("transform", "rotate(-35)")
    .style("text-anchor", "end")
    .style("font-size", 11);

  svg
    .append("g")
    .attr("transform", `translate(${padding},0)`)
    .call(d3.axisLeft(yScale).ticks(4));

  svg
    .selectAll("rect")
    .data(top)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.country))
    .attr("y", (d) => yScale(d.count))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - padding - yScale(d.count))
    .attr("fill", "#1b7a55")
    .attr("opacity", 0.9)
    .append("title")
    .text((d) => `${d.country}: ${d.count} rows`);
}

/* ========== UTIL ========== */

function clearResults() {
  kpiRow.innerHTML = "";
  pcaDiv.innerHTML = "";
  clusterLegend.innerHTML = "";
  recoList.innerHTML = "";
  edaScatter.innerHTML = "";
  edaCountry.innerHTML = "";
}
