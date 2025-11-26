/* script.js
   Wires DOM to logic in app.js.
   No imports. Needs app.js loaded before this file.
*/

const fileInput = document.getElementById("fileUpload");
const btnSample = document.getElementById("load-sample");
const btnAuto = document.getElementById("auto-upload");
const btnRun = document.getElementById("run-pipeline");
const btnTrainSIS = document.getElementById("train-sis-ml");
const btnForecast = document.getElementById("run-forecast");
const statusEl = document.getElementById("load-status");

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

// EDA DOM
const edaMatDiv = document.getElementById("eda-materials");
const edaMatNote = document.getElementById("eda-materials-note");
const edaCountryDiv = document.getElementById("eda-countries");
const edaCountryNote = document.getElementById("eda-countries-note");
const edaTrendDiv = document.getElementById("eda-trends");
const edaTrendNote = document.getElementById("eda-trends-note");
const edaYearDiv = document.getElementById("eda-years");
const edaYearNote = document.getElementById("eda-years-note");

const forecastDiv = document.getElementById("forecast-plot");
const forecastNote = document.getElementById("forecast-note");

const sisMlMetrics = document.getElementById("sis-ml-metrics");

// state
let RAW_ROWS = [];
let PROCESSED_ROWS = [];
let STATS = null;
let MATERIAL_AGG = [];
let PCA_POINTS = [];
let COUNTRY_AGG = [];
let TREND_AGG = [];
let YEAR_AGG = [];

let SIS_MODEL = null;
let SIS_MODEL_STATS = null;

// IMPORTANT: Auto-load URL — chỉnh đúng repo của bạn
const AUTOLOAD_URL =
  "https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/g2/Kaggle_sust_dataset.csv";

/* ========== LOAD HANDLERS (GIỮ NGUYÊN LOGIC UPLOAD/AUTO-UPLOAD) ========== */

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
  COUNTRY_AGG = [];
  TREND_AGG = [];
  YEAR_AGG = [];
  SIS_MODEL = null;
  SIS_MODEL_STATS = null;
  sisMlMetrics.innerHTML = "";
  statusEl.innerText = message + ` — rows: ${rows.length}`;
  populateFilters(rows);
  clearResults();
}

/* ========== FILTERS ========== */

function populateFilters(rows) {
  const countries = uniqueSorted(rows.map((r) => r.Country));
  const mats = uniqueSorted(rows.map((r) => r.Material_Type));
  const years = uniqueSorted(
    rows
      .map((r) => parseInt(r.Year || r.year || "", 10))
      .filter((v) => !isNaN(v))
  );
  const certs = uniqueSorted(rows.map((r) => r.Certifications));
  const trends = uniqueSorted(rows.map((r) => r.Market_Trend));

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
      const mat = r.Material_Type;
      const country = r.Country;
      const year = parseInt(r.Year || r.year || "", 10);
      const cert = r.Certifications;
      const trend = r.Market_Trend;

      if (countryFilter.value !== "__all" && country !== countryFilter.value)
        return false;
      if (materialFilter.value !== "__all" && mat !== materialFilter.value)
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

    COUNTRY_AGG = computeCountryAgg(PROCESSED_ROWS);
    TREND_AGG = computeTrendAgg(PROCESSED_ROWS);
    YEAR_AGG = computeYearAgg(PROCESSED_ROWS);
    PCA_POINTS = computePcaLikeCoords(MATERIAL_AGG);

    renderKPIs();
    clusterAndRenderMaterials();
    renderEDA(); // draw all EDA charts
    buildAndRenderRecommendations();
    forecastNote.innerText = "Use LSTM button to forecast SIS by year.";
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
      <div class="kpi-sub">Brand-level environmental intensity</div>
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

/* ========== MATERIAL CLUSTER + PCA SCATTER ========== */

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
    .text("Normalized carbon vs avg(water, waste) per material");

  svg
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", (d) => xScale(d.x))
    .attr("cy", (d) => yScale(d.y))
    .attr("r", (d) => 6 + Math.min(8, d.count / 5))
    .attr("fill", (d) => colorScale(d.cluster))
    .attr("opacity", 0.9)
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

/* ========== EDA CHARTS ========== */

function renderEDA() {
  renderEDAMaterials();
  renderEDACountries();
  renderEDATrends();
  renderEDAYears();
}

function renderEDAMaterials() {
  edaMatDiv.innerHTML = "";
  if (!MATERIAL_AGG.length) {
    edaMatNote.innerText = "No material statistics for current filters.";
    return;
  }
  const data = MATERIAL_AGG.slice().sort((a, b) => b.meanSIS - a.meanSIS);

  const width = edaMatDiv.clientWidth || 320;
  const height = edaMatDiv.clientHeight || 180;
  const svg = d3
    .select(edaMatDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const margin = { top: 12, right: 40, bottom: 40, left: 40 };
  const x = d3
    .scaleBand()
    .domain(data.map((d) => d.Material_Type))
    .range([margin.left, width - margin.right])
    .padding(0.2);
  const yLeft = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.meanPrice) || 1])
    .nice()
    .range([height - margin.bottom, margin.top]);
  const yRight = d3
    .scaleLinear()
    .domain([0, 1])
    .range([height - margin.bottom, margin.top]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("font-size", 10)
    .attr("transform", "rotate(-25)")
    .style("text-anchor", "end");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yLeft).ticks(4));

  svg
    .append("g")
    .attr("transform", `translate(${width - margin.right},0)`)
    .call(d3.axisRight(yRight).ticks(4));

  // Price bars
  svg
    .selectAll(".bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d.Material_Type))
    .attr("width", x.bandwidth())
    .attr("y", (d) => yLeft(d.meanPrice))
    .attr("height", (d) => yLeft(0) - yLeft(d.meanPrice))
    .attr("fill", "#bbf7d0");

  // SIS line
  const line = d3
    .line()
    .x((d) => x(d.Material_Type) + x.bandwidth() / 2)
    .y((d) => yRight(d.meanSIS));

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#16a34a")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg
    .selectAll(".dot")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", (d) => x(d.Material_Type) + x.bandwidth() / 2)
    .attr("cy", (d) => yRight(d.meanSIS))
    .attr("r", 3)
    .attr("fill", "#16a34a");

  edaMatNote.innerText =
    "Bars show avg price per material, green line shows avg SIS. Look for materials with high SIS and moderate price.";
}

function renderEDACountries() {
  edaCountryDiv.innerHTML = "";
  if (!COUNTRY_AGG.length) {
    edaCountryNote.innerText = "No country-level statistics for current filters.";
    return;
  }
  const data = COUNTRY_AGG.slice()
    .sort((a, b) => b.meanPrice - a.meanPrice)
    .slice(0, 8);

  const width = edaCountryDiv.clientWidth || 320;
  const height = edaCountryDiv.clientHeight || 180;
  const svg = d3
    .select(edaCountryDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const margin = { top: 12, right: 40, bottom: 40, left: 40 };
  const x = d3
    .scaleBand()
    .domain(data.map((d) => d.Country))
    .range([margin.left, width - margin.right])
    .padding(0.2);
  const yLeft = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.meanPrice) || 1])
    .nice()
    .range([height - margin.bottom, margin.top]);
  const yRight = d3
    .scaleLinear()
    .domain([0, 1])
    .range([height - margin.bottom, margin.top]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("font-size", 10)
    .attr("transform", "rotate(-25)")
    .style("text-anchor", "end");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yLeft).ticks(4));

  svg
    .append("g")
    .attr("transform", `translate(${width - margin.right},0)`)
    .call(d3.axisRight(yRight).ticks(4));

  // Price bars
  svg
    .selectAll(".bar-country")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d.Country))
    .attr("width", x.bandwidth())
    .attr("y", (d) => yLeft(d.meanPrice))
    .attr("height", (d) => yLeft(0) - yLeft(d.meanPrice))
    .attr("fill", "#bbf7d0");

  // SIS line
  const line = d3
    .line()
    .x((d) => x(d.Country) + x.bandwidth() / 2)
    .y((d) => yRight(d.meanSIS));

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#16a34a")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg
    .selectAll(".dot-country")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", (d) => x(d.Country) + x.bandwidth() / 2)
    .attr("cy", (d) => yRight(d.meanSIS))
    .attr("r", 3)
    .attr("fill", "#16a34a");

  edaCountryNote.innerText =
    "Countries with high price but only medium SIS may indicate premium but less sustainable markets.";
}

function renderEDATrends() {
  edaTrendDiv.innerHTML = "";
  if (!TREND_AGG.length) {
    edaTrendNote.innerText = "No market trend statistics for current filters.";
    return;
  }
  const data = TREND_AGG.slice();

  const width = edaTrendDiv.clientWidth || 320;
  const height = edaTrendDiv.clientHeight || 180;
  const svg = d3
    .select(edaTrendDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const margin = { top: 12, right: 40, bottom: 40, left: 40 };
  const x = d3
    .scaleBand()
    .domain(data.map((d) => d.Trend))
    .range([margin.left, width - margin.right])
    .padding(0.3);
  const yLeft = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.count) || 1])
    .nice()
    .range([height - margin.bottom, margin.top]);
  const yRight = d3
    .scaleLinear()
    .domain([0, 1])
    .range([height - margin.bottom, margin.top]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("font-size", 10)
    .attr("transform", "rotate(-20)")
    .style("text-anchor", "end");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yLeft).ticks(4));

  svg
    .append("g")
    .attr("transform", `translate(${width - margin.right},0)`)
    .call(d3.axisRight(yRight).ticks(4));

  // volume bars
  svg
    .selectAll(".bar-trend")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d.Trend))
    .attr("width", x.bandwidth())
    .attr("y", (d) => yLeft(d.count))
    .attr("height", (d) => yLeft(0) - yLeft(d.count))
    .attr("fill", "#bbf7d0");

  // SIS line
  const line = d3
    .line()
    .x((d) => x(d.Trend) + x.bandwidth() / 2)
    .y((d) => yRight(d.meanSIS));

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#16a34a")
    .attr("stroke-width", 2)
    .attr("d", line);

  edaTrendNote.innerText =
    "Trends with high volume and high SIS are strategic; high volume but low SIS may need sustainability interventions.";
}

function renderEDAYears() {
  edaYearDiv.innerHTML = "";
  if (!YEAR_AGG.length) {
    edaYearNote.innerText = "No yearly information for current filters.";
    return;
  }
  const data = YEAR_AGG;

  const width = edaYearDiv.clientWidth || 320;
  const height = edaYearDiv.clientHeight || 180;
  const svg = d3
    .select(edaYearDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const margin = { top: 12, right: 40, bottom: 30, left: 40 };
  const x = d3
    .scaleBand()
    .domain(data.map((d) => d.Year))
    .range([margin.left, width - margin.right])
    .padding(0.3);
  const yLeft = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.meanPrice) || 1])
    .nice()
    .range([height - margin.bottom, margin.top]);
  const yRight = d3
    .scaleLinear()
    .domain([0, 1])
    .range([height - margin.bottom, margin.top]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat((d) => d));

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yLeft).ticks(4));

  svg
    .append("g")
    .attr("transform", `translate(${width - margin.right},0)`)
    .call(d3.axisRight(yRight).ticks(4));

  // Price line
  const linePrice = d3
    .line()
    .x((d) => x(d.Year) + x.bandwidth() / 2)
    .y((d) => yLeft(d.meanPrice));

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#84cc16")
    .attr("stroke-width", 2)
    .attr("d", linePrice);

  // SIS line
  const lineSIS = d3
    .line()
    .x((d) => x(d.Year) + x.bandwidth() / 2)
    .y((d) => yRight(d.meanSIS));

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#16a34a")
    .attr("stroke-width", 2)
    .style("stroke-dasharray", "4,3")
    .attr("d", lineSIS);

  edaYearNote.innerText =
    "Solid green-yellow line shows price evolution, dashed dark green line shows SIS. Divergence highlights decoupling of price and sustainability over time.";
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

/* ========== SIS ML REGRESSION (TFJS) ========== */

btnTrainSIS.addEventListener("click", async () => {
  if (!PROCESSED_ROWS.length) {
    alert("Run the main analysis pipeline first.");
    return;
  }
  const { xs, ys } = buildSISRegressionXY(PROCESSED_ROWS);
  if (xs.length < 50) {
    alert("Not enough records to train a meaningful regression model.");
    return;
  }

  const xsTensor = tf.tensor2d(xs);
  const ysTensor = tf.tensor2d(ys, [ys.length, 1]);

  const model = tf.sequential();
  model.add(
    tf.layers.dense({ units: 32, activation: "relu", inputShape: [xs[0].length] })
  );
  model.add(tf.layers.dense({ units: 16, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1 }));

  model.compile({ optimizer: "adam", loss: "meanSquaredError" });

  sisMlMetrics.innerHTML = "Training SIS regression model...";
  await model.fit(xsTensor, ysTensor, {
    epochs: 40,
    batchSize: 32,
    verbose: 0,
  });

  const preds = model.predict(xsTensor);
  const predsArr = await preds.array();
  const ysArr = ys;

  let mse = 0;
  let mae = 0;
  let ssTot = 0;
  let ssRes = 0;
  const meanY =
    ysArr.reduce((s, v) => s + v, 0) / (ysArr.length || 1);

  for (let i = 0; i < ysArr.length; i++) {
    const y = ysArr[i];
    const p = predsArr[i][0];
    const err = y - p;
    mse += err * err;
    mae += Math.abs(err);
    ssRes += err * err;
    const diff = y - meanY;
    ssTot += diff * diff;
  }
  mse /= ysArr.length;
  mae /= ysArr.length;
  const r2 = 1 - ssRes / (ssTot || 1e-6);

  xsTensor.dispose();
  ysTensor.dispose();
  preds.dispose();

  SIS_MODEL = model;
  SIS_MODEL_STATS = { mse, mae, r2, n: ysArr.length };

  sisMlMetrics.innerHTML = `
    <div><strong>Trained on:</strong> ${ysArr.length} records</div>
    <div><strong>MSE:</strong> ${mse.toFixed(4)}</div>
    <div><strong>MAE:</strong> ${mae.toFixed(4)}</div>
    <div><strong>R²:</strong> ${r2.toFixed(3)}</div>
    <div>Model approximates SIS from carbon, water, waste, policy scores and price for scenario analysis.</div>
  `;
});

/* ========== LSTM FORECAST (TFJS) ========== */

btnForecast.addEventListener("click", async () => {
  if (!YEAR_AGG.length) {
    alert("Run the main analysis pipeline first.");
    return;
  }
  const windowSize = 3;
  const { xs, ys, years } = buildLSTMWindowsFromYearAgg(YEAR_AGG, windowSize);
  if (!xs.length || xs.length < 3) {
    forecastNote.innerText =
      "Not enough yearly points to train an LSTM (need at least 4–5 years).";
    return;
  }

  const xsTensor = tf.tensor3d(xs); // [samples, timesteps, 1]
  const ysTensor = tf.tensor2d(ys, [ys.length, 1]);

  const model = tf.sequential();
  model.add(
    tf.layers.lstm({ units: 16, inputShape: [windowSize, 1], returnSequences: false })
  );
  model.add(tf.layers.dense({ units: 1 }));

  model.compile({ optimizer: "adam", loss: "meanSquaredError" });
  forecastNote.innerText = "Training LSTM on yearly SIS series...";

  await model.fit(xsTensor, ysTensor, {
    epochs: 80,
    batchSize: 8,
    verbose: 0,
  });

  // roll-out forecast next 3 years
  const lastWindow = xs[xs.length - 1].map((v) => v[0]); // [windowSize]
  const historyYears = years;
  const lastYear = historyYears[historyYears.length - 1];

  const forecastPoints = [];
  let currentWindow = lastWindow.slice();
  for (let i = 1; i <= 3; i++) {
    const input = tf.tensor3d(
      [currentWindow.map((v) => [v])],
      [1, windowSize, 1]
    );
    const pred = model.predict(input);
    const predVal = (await pred.array())[0][0];
    forecastPoints.push({
      Year: lastYear + i,
      meanSIS: predVal,
    });
    input.dispose();
    pred.dispose();
    currentWindow.shift();
    currentWindow.push(predVal);
  }

  xsTensor.dispose();
  ysTensor.dispose();
  model.dispose();

  renderForecastChart(YEAR_AGG, forecastPoints);
});

function renderForecastChart(historyAgg, forecastAgg) {
  forecastDiv.innerHTML = "";
  const width = forecastDiv.clientWidth || 400;
  const height = forecastDiv.clientHeight || 260;

  const svg = d3
    .select(forecastDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const allYears = historyAgg.map((d) => d.Year).concat(forecastAgg.map((d) => d.Year));
  const allSIS = historyAgg.map((d) => d.meanSIS).concat(forecastAgg.map((d) => d.meanSIS));

  const margin = { top: 16, right: 20, bottom: 30, left: 40 };
  const x = d3
    .scaleLinear()
    .domain([d3.min(allYears), d3.max(allYears)])
    .range([margin.left, width - margin.right]);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(allSIS) || 1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat((v) => v));

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(4));

  // history line
  const histLine = d3
    .line()
    .x((d) => x(d.Year))
    .y((d) => y(d.meanSIS));

  svg
    .append("path")
    .datum(historyAgg)
    .attr("fill", "none")
    .attr("stroke", "#16a34a")
    .attr("stroke-width", 2)
    .attr("d", histLine);

  // forecast line
  const fcLine = d3
    .line()
    .x((d) => x(d.Year))
    .y((d) => y(d.meanSIS));

  svg
    .append("path")
    .datum(forecastAgg)
    .attr("fill", "none")
    .attr("stroke", "#22c55e")
    .style("stroke-dasharray", "4,3")
    .attr("stroke-width", 2)
    .attr("d", fcLine);

  forecastNote.innerText =
    "Solid line: historical SIS. Dashed green line: LSTM forecast for the next 3 years under current filters (illustrative, not a production forecast).";
}

/* ========== UTIL ========== */

function clearResults() {
  kpiRow.innerHTML = "";
  pcaDiv.innerHTML = "";
  clusterLegend.innerHTML = "";
  recoList.innerHTML = "";
  edaMatDiv.innerHTML = "";
  edaMatNote.innerHTML = "";
  edaCountryDiv.innerHTML = "";
  edaCountryNote.innerHTML = "";
  edaTrendDiv.innerHTML = "";
  edaTrendNote.innerHTML = "";
  edaYearDiv.innerHTML = "";
  edaYearNote.innerHTML = "";
  forecastDiv.innerHTML = "";
  forecastNote.innerHTML = "";
}
