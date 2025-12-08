/* script.js
   Wires DOM to logic in app.js.
   - Upload / auto-load CSV
   - Filters
   - Run pipeline (Entropy SIS, clustering, EDA, Elbow, Pareto, recommender)
   - Render all D3 charts + insight boxes
*/

/* ========== DOM HOOKS ========== */

// Upload + status
const fileInput = document.getElementById("fileUpload");
const btnSample = document.getElementById("load-sample");
const btnAuto = document.getElementById("auto-upload");
const btnRun = document.getElementById("run-pipeline");
const statusEl = document.getElementById("load-status");

// Filters
const countryFilter = document.getElementById("country-filter");
const materialFilter = document.getElementById("material-filter");
const yearFilter = document.getElementById("year-filter");
const certFilter = document.getElementById("cert-filter");
const trendFilter = document.getElementById("trend-filter");
const prioritySelect = document.getElementById("priority");

// KPI + PCA + recommendations
const kpiRow = document.getElementById("kpi-row");
const pcaDiv = document.getElementById("pca-plot");
const clusterLegend = document.getElementById("material-clusters");
const recoList = document.getElementById("recommendations-list");

// EDA charts
const edaMaterialDiv = document.getElementById("eda-material");
const edaCountryDiv = document.getElementById("eda-country");
const edaTrendDiv = document.getElementById("eda-trend");
const edaYearDiv = document.getElementById("eda-year");

// EDA insight blocks
const edaMaterialInsightDiv = document.getElementById("eda-material-insight");
const edaCountryInsightDiv = document.getElementById("eda-country-insight");
const edaTrendInsightDiv = document.getElementById("eda-trend-insight");
const edaYearInsightDiv = document.getElementById("eda-year-insight");

// Elbow charts (nếu có trong HTML)
const elbowMaterialDiv = document.getElementById("elbow-material-plot");
const elbowMaterialInsightDiv = document.getElementById("elbow-material-insight");
const elbowBrandDiv = document.getElementById("elbow-brand-plot");
const elbowBrandInsightDiv = document.getElementById("elbow-brand-insight");

// Pareto charts (nếu có trong HTML)
const paretoMaterialDiv = document.getElementById("pareto-material-plot");
const paretoMaterialInsightDiv = document.getElementById("pareto-material-insight");
const paretoBrandDiv = document.getElementById("pareto-brand-plot");
const paretoBrandInsightDiv = document.getElementById("pareto-brand-insight");

/* ========== GLOBAL STATE ========== */

let RAW_ROWS = [];
let PROCESSED_ROWS = [];
let STATS = null;
let MATERIAL_AGG = [];
let PCA_POINTS = [];

// Elbow + Pareto state
let MATERIAL_ELBOW = [];
let BRAND_ELBOW = [];
let MATERIAL_PARETO = [];
let BRAND_PARETO = [];

// Auto-load URL (đã fix 400 bằng refs/heads/main)
const AUTOLOAD_URL =
  "https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/av2/Kaggle_sust_dataset.csv";

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
  MATERIAL_ELBOW = [];
  BRAND_ELBOW = [];
  MATERIAL_PARETO = [];
  BRAND_PARETO = [];

  statusEl.innerText = message + ` — rows: ${rows.length}`;
  populateFilters(rows);
  clearResults();
}

/* ========== FILTERS ========== */

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter((x) => x))).sort();
}

function fillSelect(sel, values) {
  if (!sel) return;
  sel.innerHTML = '<option value="__all">All</option>';
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

function populateFilters(rows) {
  if (!rows || !rows.length) return;

  const countries = uniqueSorted(rows.map((r) => (r.Country || "").trim()));
  const mats = uniqueSorted(rows.map((r) => (r.Material_Type || "").trim()));
  const years = uniqueSorted(
    rows
      .map((r) => parseInt((r.Year || r.year || "").toString().trim(), 10))
      .filter((v) => !isNaN(v))
  );
  const certs = uniqueSorted(rows.map((r) => (r.Certifications || "").trim()));
  const trends = uniqueSorted(rows.map((r) => (r.Market_Trend || "").trim()));

  fillSelect(countryFilter, countries);
  fillSelect(materialFilter, mats);
  fillSelect(yearFilter, years.map(String));
  fillSelect(certFilter, certs);
  fillSelect(trendFilter, trends);
}

/* ========== RUN PIPELINE BUTTON ========== */

btnRun.addEventListener("click", () => {
  if (!RAW_ROWS.length) {
    alert("Please upload or auto-load the dataset first.");
    return;
  }
  btnRun.disabled = true;
  btnRun.textContent = "Processing...";

  try {
    // 1) Filter raw rows
    const filtered = RAW_ROWS.filter((r) => {
      const mat = (r.Material_Type || "").trim();
      const country = (r.Country || "").trim();
      const yearVal = (r.Year || r.year || "").toString().trim();
      const year = parseInt(yearVal, 10);
      const cert = (r.Certifications || "").trim();
      const trend = (r.Market_Trend || "").trim();

      if (countryFilter && countryFilter.value !== "__all" && country !== countryFilter.value)
        return false;
      if (materialFilter && materialFilter.value !== "__all" && mat !== materialFilter.value)
        return false;
      if (yearFilter && yearFilter.value !== "__all" && year !== +yearFilter.value)
        return false;
      if (certFilter && certFilter.value !== "__all" && cert !== certFilter.value)
        return false;
      if (trendFilter && trendFilter.value !== "__all" && trend !== trendFilter.value)
        return false;
      return true;
    });

    if (!filtered.length) {
      alert("No rows match current filters.");
      return;
    }

    // 2) SIS + aggregation (Entropy at group level)
    const { rowsWithSIS, stats, materialAgg } = normalizeAndComputeSIS(filtered);
    PROCESSED_ROWS = rowsWithSIS;
    STATS = stats;
    MATERIAL_AGG = materialAgg;

    // 3) Clustering + PCA for materials
    clusterAndPrepareMaterials();

    // 4) Elbow (materials + brands)
    MATERIAL_ELBOW = computeElbowForMaterials(MATERIAL_AGG, 1, 6);
    BRAND_ELBOW = computeElbowForBrands(PROCESSED_ROWS, 1, 8, 800);

    // 5) Pareto frontier (materials + brands)
    MATERIAL_PARETO = computeMaterialPareto(MATERIAL_AGG);
    BRAND_PARETO = computeBrandPareto(PROCESSED_ROWS);

    // 6) Render UI
    renderKPIs();
    renderPcaScatter();
    renderClusterLegend();
    renderCoreAnalytics();     // 4 charts + insights
    renderElbowCharts();       // if containers exist
    renderParetoCharts();      // if containers exist
    buildAndRenderRecommendations();

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
  const mean = STATS.mean || {};
  const w = STATS.entropyWeights || { wEnv: 0.5, wPolicy: 0.5 };

  const avgSIS = mean.SIS || 0;
  const avgEnv = mean.envScore || 0;
  const avgPol = mean.policyScore || 0;

  const avgCO2 = mean.Carbon_Footprint_MT || 0;
  const avgWater = mean.Water_Usage_Liters || 0;
  const avgWaste = mean.Waste_Production_KG || 0;
  const avgPrice = mean.Average_Price_USD || 0;

  kpiRow.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-title">Avg Sustainability Index (SIS)</div>
      <div class="kpi-value">${avgSIS.toFixed(2)}</div>
      <div class="kpi-sub">Global composite score</div>
    </div>

    <div class="kpi-card">
      <div class="kpi-title">Environmental Component</div>
      <div class="kpi-value">${avgEnv.toFixed(2)}</div>
      <div class="kpi-sub">Entropy weight w<sub>env</sub> ≈ ${w.wEnv.toFixed(2)}</div>
    </div>

    <div class="kpi-card">
      <div class="kpi-title">Policy Component</div>
      <div class="kpi-value">${avgPol.toFixed(2)}</div>
      <div class="kpi-sub">Entropy weight w<sub>policy</sub> ≈ ${w.wPolicy.toFixed(2)}</div>
    </div>

    <div class="kpi-card">
      <div class="kpi-title">Avg Carbon Footprint</div>
      <div class="kpi-value">${avgCO2.toFixed(1)}<span class="kpi-sub"> MT</span></div>
      <div class="kpi-sub">Brand-level average</div>
    </div>

    <div class="kpi-card">
      <div class="kpi-title">Avg Water Usage</div>
      <div class="kpi-value">${avgWater.toFixed(0)}<span class="kpi-sub"> L</span></div>
      <div class="kpi-sub">Production water intensity</div>
    </div>

    <div class="kpi-card">
      <div class="kpi-title">Avg Waste Production</div>
      <div class="kpi-value">${avgWaste.toFixed(1)}<span class="kpi-sub"> kg</span></div>
      <div class="kpi-sub">Solid waste per brand</div>
    </div>

    <div class="kpi-card">
      <div class="kpi-title">Avg Price</div>
      <div class="kpi-value">$${avgPrice.toFixed(2)}</div>
      <div class="kpi-sub">Across filtered brands</div>
    </div>
  `;
}

/* ========== MATERIAL CLUSTERING + PCA ========== */

function clusterAndPrepareMaterials() {
  const agg = MATERIAL_AGG || [];
  if (!agg.length) {
    PCA_POINTS = [];
    return;
  }

  // feature matrix: [Carbon, Water, Waste]
  const X = agg.map((m) => [m.meanCarbon, m.meanWater, m.meanWaste]);
  const { assignments } = runKMeans(X, 3, 40);

  const withCluster = agg.map((m, i) => ({
    ...m,
    cluster: assignments[i] || 0,
  }));
  MATERIAL_AGG = withCluster;

  PCA_POINTS = computePcaLikeCoords(withCluster);
}

function renderPcaScatter() {
  if (!pcaDiv) return;
  pcaDiv.innerHTML = "";

  if (!PCA_POINTS.length || !MATERIAL_AGG.length) return;

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
    .range(["#22c55e", "#a3e635", "#f97316"]);

  // Axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding})`)
    .call(d3.axisBottom(xScale).ticks(4));
  svg
    .append("g")
    .attr("transform", `translate(${padding},0)`)
    .call(d3.axisLeft(yScale).ticks(4));

  // Title / hint
  svg
    .append("text")
    .attr("x", padding)
    .attr("y", padding - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Normalized CO₂ (x) vs combined Water+Waste (y) per material type");

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
        `${d.Material_Type}\nSIS: ${d.meanSIS.toFixed(2)}\nBrands: ${d.count}`
    );
}

function renderClusterLegend() {
  if (!clusterLegend) return;
  clusterLegend.innerHTML = "";

  const clusters = [
    { id: 0, label: "Low-impact cluster" },
    { id: 1, label: "Medium-impact cluster" },
    { id: 2, label: "High-impact cluster" },
  ];
  const colors = ["#22c55e", "#a3e635", "#f97316"];

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

/* ========== CORE ANALYTICS (4 CHARTS + INSIGHTS) ========== */

function renderCoreAnalytics() {
  // clear previous
  if (edaMaterialDiv) edaMaterialDiv.innerHTML = "";
  if (edaCountryDiv) edaCountryDiv.innerHTML = "";
  if (edaTrendDiv) edaTrendDiv.innerHTML = "";
  if (edaYearDiv) edaYearDiv.innerHTML = "";

  if (edaMaterialInsightDiv) edaMaterialInsightDiv.innerHTML = "";
  if (edaCountryInsightDiv) edaCountryInsightDiv.innerHTML = "";
  if (edaTrendInsightDiv) edaTrendInsightDiv.innerHTML = "";
  if (edaYearInsightDiv) edaYearInsightDiv.innerHTML = "";

  if (!PROCESSED_ROWS.length) return;

  renderEdaMaterialChart();
  renderEdaCountryChart();
  renderEdaTrendChart();
  renderEdaYearChart();
}

/* 1) MATERIAL TYPE: Price (bar) + SIS (line) */

function renderEdaMaterialChart() {
  if (!edaMaterialDiv) return;
  const agg = MATERIAL_AGG || [];
  if (!agg.length) {
    if (edaMaterialInsightDiv)
      edaMaterialInsightDiv.textContent = "No material-level data for current filters.";
    return;
  }

  const data = agg
    .filter((m) => isFinite(m.meanPrice) && isFinite(m.meanSIS))
    .sort((a, b) => b.meanSIS - a.meanSIS);

  if (!data.length) {
    if (edaMaterialInsightDiv)
      edaMaterialInsightDiv.textContent = "No material-level data for current filters.";
    return;
  }

  const width = edaMaterialDiv.clientWidth || 600;
  const height = edaMaterialDiv.clientHeight || 220;
  const paddingLeft = 50;
  const paddingRight = 50;
  const paddingTop = 30;
  const paddingBottom = 40;

  const svg = d3
    .select(edaMaterialDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => d.Material_Type))
    .range([paddingLeft, width - paddingRight])
    .padding(0.2);

  const maxPrice = d3.max(data, (d) => d.meanPrice) || 1;
  const yPriceScale = d3
    .scaleLinear()
    .domain([0, maxPrice])
    .range([height - paddingBottom, paddingTop]);

  const minSIS = d3.min(data, (d) => d.meanSIS) ?? 0;
  const maxSIS = d3.max(data, (d) => d.meanSIS) || 1;
  const ySisScale = d3
    .scaleLinear()
    .domain([Math.max(0, minSIS - 0.05), Math.min(1, maxSIS + 0.05)])
    .range([height - paddingBottom, paddingTop]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - paddingBottom})`)
    .call(d3.axisBottom(xScale).tickSizeOuter(0));

  svg
    .append("g")
    .attr("transform", `translate(${paddingLeft},0)`)
    .call(d3.axisLeft(yPriceScale).ticks(4))
    .append("text")
    .attr("x", 0)
    .attr("y", paddingTop - 15)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Avg Price (USD)");

  svg
    .append("g")
    .attr("transform", `translate(${width - paddingRight},0)`)
    .call(d3.axisRight(ySisScale).ticks(4))
    .append("text")
    .attr("x", 0)
    .attr("y", paddingTop - 15)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .attr("text-anchor", "end")
    .text("Avg SIS (0–1)");

  // price bars
  svg
    .selectAll(".bar-material")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar-material")
    .attr("x", (d) => xScale(d.Material_Type))
    .attr("y", (d) => yPriceScale(d.meanPrice))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => yPriceScale(0) - yPriceScale(d.meanPrice))
    .attr("fill", "#bbf7d0")
    .attr("stroke", "#22c55e")
    .attr("stroke-width", 1)
    .append("title")
    .text(
      (d) =>
        `${d.Material_Type}\nAvg Price: $${d.meanPrice.toFixed(
          2
        )}\nAvg SIS: ${d.meanSIS.toFixed(2)}\nCount: ${d.count}`
    );

  // SIS line
  const line = d3
    .line()
    .x((d) => xScale(d.Material_Type) + xScale.bandwidth() / 2)
    .y((d) => ySisScale(d.meanSIS));

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#15803d")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg
    .selectAll(".dot-material")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "dot-material")
    .attr("cx", (d) => xScale(d.Material_Type) + xScale.bandwidth() / 2)
    .attr("cy", (d) => ySisScale(d.meanSIS))
    .attr("r", 3)
    .attr("fill", "#15803d");

  svg
    .append("text")
    .attr("x", paddingLeft)
    .attr("y", paddingTop - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Soft green bars: Avg Price, dark green line: Avg SIS per material type");

  const topSIS = [...data].sort((a, b) => b.meanSIS - a.meanSIS)[0];
  const cheapest = [...data].sort((a, b) => a.meanPrice - b.meanPrice)[0];

  if (edaMaterialInsightDiv) {
    edaMaterialInsightDiv.innerHTML = `
      <p><strong>Highest SIS material:</strong><br>
         ${topSIS.Material_Type} (SIS ≈ ${topSIS.meanSIS.toFixed(2)}).</p>
      <p><strong>Most budget-friendly material:</strong><br>
         ${cheapest.Material_Type} (Avg price ≈ $${cheapest.meanPrice.toFixed(
      2
    )}).</p>
      <p>This view helps you select fabrics that balance sustainability and price before drilling into brands.</p>
    `;
  }
}

/* 2) COUNTRY: Price (bar) + SIS (line) */

function renderEdaCountryChart() {
  if (!edaCountryDiv) return;

  const agg = computeCountryAgg(PROCESSED_ROWS).filter(
    (d) => isFinite(d.meanPrice) && isFinite(d.meanSIS)
  );
  if (!agg.length) {
    if (edaCountryInsightDiv)
      edaCountryInsightDiv.textContent = "No country-level data for current filters.";
    return;
  }

  const data = agg.sort((a, b) => b.meanPrice - a.meanPrice).slice(0, 8);

  const width = edaCountryDiv.clientWidth || 600;
  const height = edaCountryDiv.clientHeight || 220;
  const paddingLeft = 50;
  const paddingRight = 50;
  const paddingTop = 30;
  const paddingBottom = 40;

  const svg = d3
    .select(edaCountryDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => d.Country))
    .range([paddingLeft, width - paddingRight])
    .padding(0.2);

  const maxPrice = d3.max(data, (d) => d.meanPrice) || 1;
  const yPriceScale = d3
    .scaleLinear()
    .domain([0, maxPrice])
    .range([height - paddingBottom, paddingTop]);

  const minSIS = d3.min(data, (d) => d.meanSIS) ?? 0;
  const maxSIS = d3.max(data, (d) => d.meanSIS) || 1;
  const ySisScale = d3
    .scaleLinear()
    .domain([Math.max(0, minSIS - 0.05), Math.min(1, maxSIS + 0.05)])
    .range([height - paddingBottom, paddingTop]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - paddingBottom})`)
    .call(d3.axisBottom(xScale).tickSizeOuter(0));

  svg
    .append("g")
    .attr("transform", `translate(${paddingLeft},0)`)
    .call(d3.axisLeft(yPriceScale).ticks(4))
    .append("text")
    .attr("x", 0)
    .attr("y", paddingTop - 15)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Avg Price (USD)");

  svg
    .append("g")
    .attr("transform", `translate(${width - paddingRight},0)`)
    .call(d3.axisRight(ySisScale).ticks(4))
    .append("text")
    .attr("x", 0)
    .attr("y", paddingTop - 15)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .attr("text-anchor", "end")
    .text("Avg SIS (0–1)");

  svg
    .selectAll(".bar-country")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar-country")
    .attr("x", (d) => xScale(d.Country))
    .attr("y", (d) => yPriceScale(d.meanPrice))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => yPriceScale(0) - yPriceScale(d.meanPrice))
    .attr("fill", "#bbf7d0")
    .attr("stroke", "#22c55e")
    .attr("stroke-width", 1)
    .append("title")
    .text(
      (d) =>
        `${d.Country}\nAvg Price: $${d.meanPrice.toFixed(
          2
        )}\nAvg SIS: ${d.meanSIS.toFixed(2)}\nCount: ${d.count}`
    );

  const line = d3
    .line()
    .x((d) => xScale(d.Country) + xScale.bandwidth() / 2)
    .y((d) => ySisScale(d.meanSIS));

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#15803d")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg
    .selectAll(".dot-country")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "dot-country")
    .attr("cx", (d) => xScale(d.Country) + xScale.bandwidth() / 2)
    .attr("cy", (d) => ySisScale(d.meanSIS))
    .attr("r", 3)
    .attr("fill", "#15803d");

  svg
    .append("text")
    .attr("x", paddingLeft)
    .attr("y", paddingTop - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Soft green bars: Avg Price, dark green line: Avg SIS per country");

  const highestPrice = [...data].sort((a, b) => b.meanPrice - a.meanPrice)[0];
  const bestSIS = [...data].sort((a, b) => b.meanSIS - a.meanSIS)[0];

  if (edaCountryInsightDiv) {
    edaCountryInsightDiv.innerHTML = `
      <p><strong>Highest-priced market:</strong><br>
         ${highestPrice.Country} (Avg price ≈ $${highestPrice.meanPrice.toFixed(
      2
    )}).</p>
      <p><strong>Best SIS performance:</strong><br>
         ${bestSIS.Country} (SIS ≈ ${bestSIS.meanSIS.toFixed(
      2
    )}, n = ${bestSIS.count}).</p>
      <p>Use this view to contrast premium markets with those that deliver better sustainability performance.</p>
    `;
  }
}

/* 3) TREND: Count (bar) + SIS (line) */

function renderEdaTrendChart() {
  if (!edaTrendDiv) return;

  const agg = computeTrendAgg(PROCESSED_ROWS);
  if (!agg.length) {
    if (edaTrendInsightDiv)
      edaTrendInsightDiv.textContent = "No trend-level data for current filters.";
    return;
  }

  const data = agg.sort((a, b) => b.count - a.count);

  const width = edaTrendDiv.clientWidth || 600;
  const height = edaTrendDiv.clientHeight || 220;
  const paddingLeft = 50;
  const paddingRight = 50;
  const paddingTop = 30;
  const paddingBottom = 40;

  const svg = d3
    .select(edaTrendDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => d.Trend))
    .range([paddingLeft, width - paddingRight])
    .padding(0.2);

  const maxCount = d3.max(data, (d) => d.count) || 1;
  const yCountScale = d3
    .scaleLinear()
    .domain([0, maxCount])
    .range([height - paddingBottom, paddingTop]);

  const minSIS = d3.min(data, (d) => d.meanSIS) ?? 0;
  const maxSIS = d3.max(data, (d) => d.meanSIS) || 1;
  const ySisScale = d3
    .scaleLinear()
    .domain([Math.max(0, minSIS - 0.05), Math.min(1, maxSIS + 0.05)])
    .range([height - paddingBottom, paddingTop]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - paddingBottom})`)
    .call(d3.axisBottom(xScale).tickSizeOuter(0));

  svg
    .append("g")
    .attr("transform", `translate(${paddingLeft},0)`)
    .call(d3.axisLeft(yCountScale).ticks(4))
    .append("text")
    .attr("x", 0)
    .attr("y", paddingTop - 15)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Number of records");

  svg
    .append("g")
    .attr("transform", `translate(${width - paddingRight},0)`)
    .call(d3.axisRight(ySisScale).ticks(4))
    .append("text")
    .attr("x", 0)
    .attr("y", paddingTop - 15)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .attr("text-anchor", "end")
    .text("Avg SIS (0–1)");

  svg
    .selectAll(".bar-trend")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar-trend")
    .attr("x", (d) => xScale(d.Trend))
    .attr("y", (d) => yCountScale(d.count))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => yCountScale(0) - yCountScale(d.count))
    .attr("fill", "#bbf7d0")
    .attr("stroke", "#22c55e")
    .attr("stroke-width", 1)
    .append("title")
    .text(
      (d) =>
        `${d.Trend}\nCount: ${d.count}\nAvg SIS: ${d.meanSIS.toFixed(
          2
        )}\nAvg Price: $${isFinite(d.meanPrice) ? d.meanPrice.toFixed(2) : "N/A"}`
    );

  const line = d3
    .line()
    .x((d) => xScale(d.Trend) + xScale.bandwidth() / 2)
    .y((d) => ySisScale(d.meanSIS));

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#15803d")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg
    .selectAll(".dot-trend")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "dot-trend")
    .attr("cx", (d) => xScale(d.Trend) + xScale.bandwidth() / 2)
    .attr("cy", (d) => ySisScale(d.meanSIS))
    .attr("r", 3)
    .attr("fill", "#15803d");

  svg
    .append("text")
    .attr("x", paddingLeft)
    .attr("y", paddingTop - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Soft green bars: volume, dark green line: Avg SIS per trend");

  const dominant = data[0];
  const bestSIS = [...data].sort((a, b) => b.meanSIS - a.meanSIS)[0];

  if (edaTrendInsightDiv) {
    edaTrendInsightDiv.innerHTML = `
      <p><strong>Dominant trend by volume:</strong><br>
         ${dominant.Trend} (n = ${dominant.count}).</p>
      <p><strong>Most sustainable trend:</strong><br>
         ${bestSIS.Trend} (SIS ≈ ${bestSIS.meanSIS.toFixed(2)}).</p>
      <p>This helps you align commercial decisions with trends that are both popular and environmentally robust.</p>
    `;
  }
}

/* 4) YEAR: Price (bar) + SIS (line) */

function renderEdaYearChart() {
  if (!edaYearDiv) return;

  const agg = computeYearAgg(PROCESSED_ROWS);
  if (!agg.length) {
    if (edaYearInsightDiv)
      edaYearInsightDiv.textContent = "No year information available for current filters.";
    return;
  }

  const data = agg;

  const width = edaYearDiv.clientWidth || 600;
  const height = edaYearDiv.clientHeight || 220;
  const paddingLeft = 50;
  const paddingRight = 50;
  const paddingTop = 30;
  const paddingBottom = 40;

  const svg = d3
    .select(edaYearDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => d.Year))
    .range([paddingLeft, width - paddingRight])
    .padding(0.2);

  const maxPrice = d3.max(data, (d) => d.meanPrice) || 1;
  const yPriceScale = d3
    .scaleLinear()
    .domain([0, maxPrice])
    .range([height - paddingBottom, paddingTop]);

  const minSIS = d3.min(data, (d) => d.meanSIS) ?? 0;
  const maxSIS = d3.max(data, (d) => d.meanSIS) || 1;
  const ySisScale = d3
    .scaleLinear()
    .domain([Math.max(0, minSIS - 0.05), Math.min(1, maxSIS + 0.05)])
    .range([height - paddingBottom, paddingTop]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - paddingBottom})`)
    .call(d3.axisBottom(xScale).tickSizeOuter(0));

  svg
    .append("g")
    .attr("transform", `translate(${paddingLeft},0)`)
    .call(d3.axisLeft(yPriceScale).ticks(4))
    .append("text")
    .attr("x", 0)
    .attr("y", paddingTop - 15)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Avg Price (USD)");

  svg
    .append("g")
    .attr("transform", `translate(${width - paddingRight},0)`)
    .call(d3.axisRight(ySisScale).ticks(4))
    .append("text")
    .attr("x", 0)
    .attr("y", paddingTop - 15)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .attr("text-anchor", "end")
    .text("Avg SIS (0–1)");

  svg
    .selectAll(".bar-year")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar-year")
    .attr("x", (d) => xScale(d.Year))
    .attr("y", (d) => yPriceScale(d.meanPrice))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => yPriceScale(0) - yPriceScale(d.meanPrice))
    .attr("fill", "#bbf7d0")
    .attr("stroke", "#22c55e")
    .attr("stroke-width", 1)
    .append("title")
    .text(
      (d) =>
        `Year: ${d.Year}\nAvg Price: $${d.meanPrice.toFixed(
          2
        )}\nAvg SIS: ${d.meanSIS.toFixed(2)}\nCount: ${d.count}`
    );

  const line = d3
    .line()
    .x((d) => xScale(d.Year) + xScale.bandwidth() / 2)
    .y((d) => ySisScale(d.meanSIS));

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#15803d")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg
    .selectAll(".dot-year")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "dot-year")
    .attr("cx", (d) => xScale(d.Year) + xScale.bandwidth() / 2)
    .attr("cy", (d) => ySisScale(d.meanSIS))
    .attr("r", 3)
    .attr("fill", "#15803d");

  svg
    .append("text")
    .attr("x", paddingLeft)
    .attr("y", paddingTop - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Soft green bars: Avg Price, dark green line: Avg SIS per year");

  const earliest = data[0];
  const latest = data[data.length - 1];
  const bestSIS = [...data].sort((a, b) => b.meanSIS - a.meanSIS)[0];

  if (edaYearInsightDiv) {
    edaYearInsightDiv.innerHTML = `
      <p><strong>Coverage:</strong><br>
         ${earliest.Year} → ${latest.Year} (based on current filters).</p>
      <p><strong>Peak SIS year:</strong><br>
         ${bestSIS.Year} (SIS ≈ ${bestSIS.meanSIS.toFixed(
      2
    )}, n = ${bestSIS.count}).</p>
      <p>This timeline helps you understand how sustainability and pricing evolved over time in the selected slice.</p>
    `;
  }
}

/* ========== ELBOW CHARTS (MATERIALS + BRANDS) ========== */

function findElbowK(curve) {
  if (!curve || curve.length < 2) return curve && curve.length ? curve[0].k : null;
  let bestIdx = 1;
  let bestDrop = curve[0].sse - curve[1].sse;
  for (let i = 2; i < curve.length; i++) {
    const drop = curve[i - 1].sse - curve[i].sse;
    if (drop > bestDrop) {
      bestDrop = drop;
      bestIdx = i;
    }
  }
  return curve[bestIdx].k;
}

function renderElbowCharts() {
  renderElbowMaterials();
  renderElbowBrands();
}

function renderElbowMaterials() {
  if (!elbowMaterialDiv) return;
  elbowMaterialDiv.innerHTML = "";
  if (elbowMaterialInsightDiv) elbowMaterialInsightDiv.innerHTML = "";

  const curve = MATERIAL_ELBOW || [];
  if (!curve.length) {
    if (elbowMaterialInsightDiv)
      elbowMaterialInsightDiv.textContent = "Elbow curve for materials is not available for current filters.";
    return;
  }

  const width = elbowMaterialDiv.clientWidth || 600;
  const height = elbowMaterialDiv.clientHeight || 220;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;

  const svg = d3
    .select(elbowMaterialDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const xScale = d3
    .scaleLinear()
    .domain([
      d3.min(curve, (d) => d.k) - 0.2,
      d3.max(curve, (d) => d.k) + 0.2,
    ])
    .range([paddingLeft, width - paddingRight]);

  const maxSSE = d3.max(curve, (d) => d.sse) || 1;
  const yScale = d3
    .scaleLinear()
    .domain([0, maxSSE])
    .range([height - paddingBottom, paddingTop]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - paddingBottom})`)
    .call(d3.axisBottom(xScale).ticks(curve.length));

  svg
    .append("g")
    .attr("transform", `translate(${paddingLeft},0)`)
    .call(d3.axisLeft(yScale).ticks(4));

  const line = d3
    .line()
    .x((d) => xScale(d.k))
    .y((d) => yScale(d.sse));

  svg
    .append("path")
    .datum(curve)
    .attr("fill", "none")
    .attr("stroke", "#15803d")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg
    .selectAll(".dot-elbow-mat")
    .data(curve)
    .enter()
    .append("circle")
    .attr("class", "dot-elbow-mat")
    .attr("cx", (d) => xScale(d.k))
    .attr("cy", (d) => yScale(d.sse))
    .attr("r", 3)
    .attr("fill", "#22c55e")
    .append("title")
    .text((d) => `k = ${d.k}\nSSE = ${d.sse.toFixed(2)}`);

  const elbowK = findElbowK(curve);
  if (elbowK !== null) {
    const elbowPoint = curve.find((c) => c.k === elbowK);
    if (elbowPoint) {
      svg
        .append("circle")
        .attr("cx", xScale(elbowPoint.k))
        .attr("cy", yScale(elbowPoint.sse))
        .attr("r", 5)
        .attr("fill", "none")
        .attr("stroke", "#f97316")
        .attr("stroke-width", 2);
    }
  }

  svg
    .append("text")
    .attr("x", paddingLeft)
    .attr("y", paddingTop - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Elbow curve: materials clustered by CO₂, water, and waste");

  if (elbowMaterialInsightDiv) {
    elbowMaterialInsightDiv.innerHTML = `
      <p><strong>Suggested number of material clusters:</strong><br>
         k ≈ ${elbowK !== null ? elbowK : "N/A"}.</p>
      <p>The elbow point indicates where adding more clusters yields diminishing returns in explaining variance.</p>
    `;
  }
}

function renderElbowBrands() {
  if (!elbowBrandDiv) return;
  elbowBrandDiv.innerHTML = "";
  if (elbowBrandInsightDiv) elbowBrandInsightDiv.innerHTML = "";

  const curve = BRAND_ELBOW || [];
  if (!curve.length) {
    if (elbowBrandInsightDiv)
      elbowBrandInsightDiv.textContent = "Elbow curve for brands is not available for current filters.";
    return;
  }

  const width = elbowBrandDiv.clientWidth || 600;
  const height = elbowBrandDiv.clientHeight || 220;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;

  const svg = d3
    .select(elbowBrandDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const xScale = d3
    .scaleLinear()
    .domain([
      d3.min(curve, (d) => d.k) - 0.2,
      d3.max(curve, (d) => d.k) + 0.2,
    ])
    .range([paddingLeft, width - paddingRight]);

  const maxSSE = d3.max(curve, (d) => d.sse) || 1;
  const yScale = d3
    .scaleLinear()
    .domain([0, maxSSE])
    .range([height - paddingBottom, paddingTop]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - paddingBottom})`)
    .call(d3.axisBottom(xScale).ticks(curve.length));

  svg
    .append("g")
    .attr("transform", `translate(${paddingLeft},0)`)
    .call(d3.axisLeft(yScale).ticks(4));

  const line = d3
    .line()
    .x((d) => xScale(d.k))
    .y((d) => yScale(d.sse));

  svg
    .append("path")
    .datum(curve)
    .attr("fill", "none")
    .attr("stroke", "#15803d")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg
    .selectAll(".dot-elbow-brand")
    .data(curve)
    .enter()
    .append("circle")
    .attr("class", "dot-elbow-brand")
    .attr("cx", (d) => xScale(d.k))
    .attr("cy", (d) => yScale(d.sse))
    .attr("r", 3)
    .attr("fill", "#22c55e")
    .append("title")
    .text((d) => `k = ${d.k}\nSSE = ${d.sse.toFixed(2)}`);

  const elbowK = findElbowK(curve);
  if (elbowK !== null) {
    const elbowPoint = curve.find((c) => c.k === elbowK);
    if (elbowPoint) {
      svg
        .append("circle")
        .attr("cx", xScale(elbowPoint.k))
        .attr("cy", yScale(elbowPoint.sse))
        .attr("r", 5)
        .attr("fill", "none")
        .attr("stroke", "#f97316")
        .attr("stroke-width", 2);
    }
  }

  svg
    .append("text")
    .attr("x", paddingLeft)
    .attr("y", paddingTop - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Elbow curve: brands clustered by footprint, price, and SIS");

  if (elbowBrandInsightDiv) {
    elbowBrandInsightDiv.innerHTML = `
      <p><strong>Suggested number of brand clusters:</strong><br>
         k ≈ ${elbowK !== null ? elbowK : "N/A"}.</p>
      <p>This provides an objective basis for segmenting brands into sustainability-driven clusters.</p>
    `;
  }
}

/* ========== PARETO FRONTIER CHARTS ========== */

function renderParetoCharts() {
  renderParetoMaterials();
  renderParetoBrands();
}

function renderParetoMaterials() {
  if (!paretoMaterialDiv) return;
  paretoMaterialDiv.innerHTML = "";
  if (paretoMaterialInsightDiv) paretoMaterialInsightDiv.innerHTML = "";

  const frontier = MATERIAL_PARETO || [];
  const all = MATERIAL_AGG || [];
  if (!frontier.length || !all.length) {
    if (paretoMaterialInsightDiv)
      paretoMaterialInsightDiv.textContent = "No Pareto frontier for materials is available for current filters.";
    return;
  }

  const width = paretoMaterialDiv.clientWidth || 600;
  const height = paretoMaterialDiv.clientHeight || 220;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;

  const svg = d3
    .select(paretoMaterialDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const maxPrice = d3.max(all, (d) => d.meanPrice) || 1;
  const minPrice = d3.min(all, (d) => d.meanPrice) || 0;
  const maxSIS = d3.max(all, (d) => d.meanSIS) || 1;
  const minSIS = d3.min(all, (d) => d.meanSIS) || 0;

  const xScale = d3
    .scaleLinear()
    .domain([minPrice * 0.95, maxPrice * 1.05])
    .range([paddingLeft, width - paddingRight]);

  const yScale = d3
    .scaleLinear()
    .domain([Math.max(0, minSIS - 0.05), Math.min(1, maxSIS + 0.05)])
    .range([height - paddingBottom, paddingTop]);

  // all points
  svg
    .selectAll(".dot-all-material")
    .data(all)
    .enter()
    .append("circle")
    .attr("class", "dot-all-material")
    .attr("cx", (d) => xScale(d.meanPrice))
    .attr("cy", (d) => yScale(d.meanSIS))
    .attr("r", 3)
    .attr("fill", "#bbf7d0")
    .attr("opacity", 0.6)
    .append("title")
    .text(
      (d) =>
        `${d.Material_Type}\nAvg Price: $${d.meanPrice.toFixed(
          2
        )}\nAvg SIS: ${d.meanSIS.toFixed(2)}`
    );

  // frontier points
  svg
    .selectAll(".dot-front-material")
    .data(frontier)
    .enter()
    .append("circle")
    .attr("class", "dot-front-material")
    .attr("cx", (d) => xScale(d.meanPrice))
    .attr("cy", (d) => yScale(d.meanSIS))
    .attr("r", 4)
    .attr("fill", "#15803d")
    .attr("stroke", "#14532d")
    .attr("stroke-width", 1.5)
    .append("title")
    .text(
      (d) =>
        `[Pareto] ${d.Material_Type}\nAvg Price: $${d.meanPrice.toFixed(
          2
        )}\nAvg SIS: ${d.meanSIS.toFixed(2)}`
    );

  // connect frontier in price order
  const frontSorted = frontier.slice().sort((a, b) => a.meanPrice - b.meanPrice);
  const line = d3
    .line()
    .x((d) => xScale(d.meanPrice))
    .y((d) => yScale(d.meanSIS));

  svg
    .append("path")
    .datum(frontSorted)
    .attr("fill", "none")
    .attr("stroke", "#16a34a")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "4 2")
    .attr("d", line);

  // axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height - paddingBottom})`)
    .call(d3.axisBottom(xScale).ticks(4));
  svg
    .append("g")
    .attr("transform", `translate(${paddingLeft},0)`)
    .call(d3.axisLeft(yScale).ticks(4));

  svg
    .append("text")
    .attr("x", paddingLeft)
    .attr("y", paddingTop - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Material Pareto frontier: higher SIS with minimal price increase");

  const bestSIS = [...frontier].sort((a, b) => b.meanSIS - a.meanSIS)[0];
  const cheapestOnFront = [...frontier].sort(
    (a, b) => a.meanPrice - b.meanPrice
  )[0];

  if (paretoMaterialInsightDiv) {
    paretoMaterialInsightDiv.innerHTML = `
      <p><strong>Best material on Pareto frontier:</strong><br>
         ${bestSIS.Material_Type} — SIS ≈ ${bestSIS.meanSIS.toFixed(
      2
    )}, Avg price ≈ $${bestSIS.meanPrice.toFixed(2)}.</p>
      <p><strong>Most affordable Pareto material:</strong><br>
         ${cheapestOnFront.Material_Type} — SIS ≈ ${cheapestOnFront.meanSIS.toFixed(
      2
    )}, Avg price ≈ $${cheapestOnFront.meanPrice.toFixed(2)}.</p>
      <p>These fabrics give you the best sustainability–price trade-off without being dominated by other options.</p>
    `;
  }
}

function renderParetoBrands() {
  if (!paretoBrandDiv) return;
  paretoBrandDiv.innerHTML = "";
  if (paretoBrandInsightDiv) paretoBrandInsightDiv.innerHTML = "";

  const frontier = BRAND_PARETO || [];
  const all = PROCESSED_ROWS || [];
  if (!frontier.length || !all.length) {
    if (paretoBrandInsightDiv)
      paretoBrandInsightDiv.textContent = "No Pareto frontier for brands is available for current filters.";
    return;
  }

  const width = paretoBrandDiv.clientWidth || 600;
  const height = paretoBrandDiv.clientHeight || 220;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;

  const maxPrice = d3.max(all, (d) => d.Average_Price_USD) || 1;
  const minPrice = d3.min(all, (d) => d.Average_Price_USD) || 0;
  const maxSIS = d3.max(all, (d) => d.SIS) || 1;
  const minSIS = d3.min(all, (d) => d.SIS) || 0;

  const xScale = d3
    .scaleLinear()
    .domain([minPrice * 0.95, maxPrice * 1.05])
    .range([paddingLeft, width - paddingRight]);

  const yScale = d3
    .scaleLinear()
    .domain([Math.max(0, minSIS - 0.05), Math.min(1, maxSIS + 0.05)])
    .range([height - paddingBottom, paddingTop]);

  // all brands
  svgAll = d3
    .select(paretoBrandDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  svgAll
    .selectAll(".dot-all-brand")
    .data(all)
    .enter()
    .append("circle")
    .attr("class", "dot-all-brand")
    .attr("cx", (d) => xScale(d.Average_Price_USD))
    .attr("cy", (d) => yScale(d.SIS))
    .attr("r", 2.5)
    .attr("fill", "#bbf7d0")
    .attr("opacity", 0.6)
    .append("title")
    .text(
      (d) =>
        `${d.Brand_Name || d.Brand_ID}\nMaterial: ${
          d.Material_Type
        }\nPrice: $${(d.Average_Price_USD || 0).toFixed(
          2
        )}\nSIS: ${d.SIS.toFixed(2)}`
    );

  // frontier brands
  svgAll
    .selectAll(".dot-front-brand")
    .data(frontier)
    .enter()
    .append("circle")
    .attr("class", "dot-front-brand")
    .attr("cx", (d) => xScale(d.Average_Price_USD))
    .attr("cy", (d) => yScale(d.SIS))
    .attr("r", 3.5)
    .attr("fill", "#15803d")
    .attr("stroke", "#14532d")
    .attr("stroke-width", 1.5)
    .append("title")
    .text(
      (d) =>
        `[Pareto] ${d.Brand_Name || d.Brand_ID}\nMaterial: ${
          d.Material_Type
        }\nPrice: $${(d.Average_Price_USD || 0).toFixed(
          2
        )}\nSIS: ${d.SIS.toFixed(2)}`
    );

  const frontSorted = frontier
    .slice()
    .sort((a, b) => a.Average_Price_USD - b.Average_Price_USD);

  const line = d3
    .line()
    .x((d) => xScale(d.Average_Price_USD))
    .y((d) => yScale(d.SIS));

  svgAll
    .append("path")
    .datum(frontSorted)
    .attr("fill", "none")
    .attr("stroke", "#16a34a")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "4 2")
    .attr("d", line);

  // axes
  svgAll
    .append("g")
    .attr("transform", `translate(0,${height - paddingBottom})`)
    .call(d3.axisBottom(xScale).ticks(4));
  svgAll
    .append("g")
    .attr("transform", `translate(${paddingLeft},0)`)
    .call(d3.axisLeft(yScale).ticks(4));

  svgAll
    .append("text")
    .attr("x", paddingLeft)
    .attr("y", paddingTop - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Brand Pareto frontier: best SIS–price trade-off in the filtered segment");

  const bestSIS = [...frontier].sort((a, b) => b.SIS - a.SIS)[0];
  const cheapestOnFront = [...frontier].sort(
    (a, b) => a.Average_Price_USD - b.Average_Price_USD
  )[0];

  if (paretoBrandInsightDiv) {
    paretoBrandInsightDiv.innerHTML = `
      <p><strong>Top Pareto brand:</strong><br>
         ${bestSIS.Brand_Name || bestSIS.Brand_ID} — SIS ≈ ${bestSIS.SIS.toFixed(
      2
    )}, Price ≈ $${bestSIS.Average_Price_USD.toFixed(2)}.</p>
      <p><strong>Most affordable Pareto brand:</strong><br>
         ${cheapestOnFront.Brand_Name || cheapestOnFront.Brand_ID} — SIS ≈ ${cheapestOnFront.SIS.toFixed(
      2
    )}, Price ≈ $${cheapestOnFront.Average_Price_USD.toFixed(2)}.</p>
      <p>These are the brands your dashboard would recommend as “no-regret” options: you cannot improve price without sacrificing SIS.</p>
    `;
  }
}

/* ========== RECOMMENDATIONS ========== */

function buildAndRenderRecommendations() {
  const w = parseFloat(prioritySelect ? prioritySelect.value : "0.5") || 0.5;
  const recs = buildRecommendations(PROCESSED_ROWS, w, 10);
  renderRecommendations(recs);
}

function renderRecommendations(items) {
  if (!recoList) return;
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
            ${item.Material_Type || "Unknown material"} • ${item.Country || "Unknown country"}
          </div>
        </div>
        <div class="reco-metrics">
          <span><strong>SIS</strong> ${item.SIS.toFixed(2)}</span>
          <span><strong>CO₂</strong> ${(item.Carbon_Footprint_MT || 0).toFixed(1)} MT</span>
          <span><strong>Water</strong> ${(item.Water_Usage_Liters || 0).toFixed(0)} L</span>
          <span><strong>Waste</strong> ${(item.Waste_Production_KG || 0).toFixed(1)} kg</span>
          <span><strong>Price</strong> $${item.Average_Price_USD ? item.Average_Price_USD.toFixed(2) : "N/A"}</span>
        </div>
      </div>
      <div class="reco-pill-row">
        ${item.Sustainability_Rating ? `<span class="reco-pill">Rating: ${item.Sustainability_Rating}</span>` : ""}
        <span class="reco-pill">Env–Policy mix: ${item.envScore !== undefined && item.policyScore !== undefined
          ? `${item.envScore.toFixed(2)} / ${item.policyScore.toFixed(2)}`
          : "N/A"
        }</span>
        ${item.Eco_Friendly_Manufacturing ? `<span class="reco-pill">Eco-friendly: ${item.Eco_Friendly_Manufacturing}</span>` : ""}
        ${item.Recycling_Programs ? `<span class="reco-pill">Recycling: ${item.Recycling_Programs}</span>` : ""}
        ${item.Market_Trend ? `<span class="reco-pill">Trend: ${item.Market_Trend}</span>` : ""}
        ${item.Certifications ? `<span class="reco-pill">Cert: ${item.Certifications}</span>` : ""}
      </div>
    `;
    recoList.appendChild(div);
  });
}

/* ========== CLEAR UI WHEN LOAD NEW DATA ========== */

function clearResults() {
  if (kpiRow) kpiRow.innerHTML = "";
  if (pcaDiv) pcaDiv.innerHTML = "";
  if (clusterLegend) clusterLegend.innerHTML = "";
  if (recoList) recoList.innerHTML = "";

  if (edaMaterialDiv) edaMaterialDiv.innerHTML = "";
  if (edaCountryDiv) edaCountryDiv.innerHTML = "";
  if (edaTrendDiv) edaTrendDiv.innerHTML = "";
  if (edaYearDiv) edaYearDiv.innerHTML = "";

  if (edaMaterialInsightDiv) edaMaterialInsightDiv.innerHTML = "";
  if (edaCountryInsightDiv) edaCountryInsightDiv.innerHTML = "";
  if (edaTrendInsightDiv) edaTrendInsightDiv.innerHTML = "";
  if (edaYearInsightDiv) edaYearInsightDiv.innerHTML = "";

  if (elbowMaterialDiv) elbowMaterialDiv.innerHTML = "";
  if (elbowMaterialInsightDiv) elbowMaterialInsightDiv.innerHTML = "";
  if (elbowBrandDiv) elbowBrandDiv.innerHTML = "";
  if (elbowBrandInsightDiv) elbowBrandInsightDiv.innerHTML = "";

  if (paretoMaterialDiv) paretoMaterialDiv.innerHTML = "";
  if (paretoMaterialInsightDiv) paretoMaterialInsightDiv.innerHTML = "";
  if (paretoBrandDiv) paretoBrandDiv.innerHTML = "";
  if (paretoBrandInsightDiv) paretoBrandInsightDiv.innerHTML = "";
}
