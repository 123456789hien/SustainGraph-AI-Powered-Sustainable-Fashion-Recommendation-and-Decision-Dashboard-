/* script.js
   Wires DOM to logic in app.js.
   No imports. Needs app.js loaded before this file.
*/

const fileInput = document.getElementById("fileUpload");
const btnSample = document.getElementById("load-sample");
const btnAuto = document.getElementById("auto-upload");
const btnRun = document.getElementById("run-pipeline");
const statusEl = document.getElementById("load-status");

// filters (KHÔNG CÒN BRAND)
const countryFilter = document.getElementById("country-filter");
const materialFilter = document.getElementById("material-filter");
const yearFilter = document.getElementById("year-filter");
const certFilter = document.getElementById("cert-filter");
const trendFilter = document.getElementById("trend-filter");
const prioritySelect = document.getElementById("priority");

// main UI blocks
const kpiRow = document.getElementById("kpi-row");
const pcaDiv = document.getElementById("pca-plot");
const clusterLegend = document.getElementById("material-clusters");
const recoList = document.getElementById("recommendations-list");

// EDA containers
const edaMaterialDiv = document.getElementById("eda-material");
const edaCountryDiv = document.getElementById("eda-country");
const edaTrendDiv = document.getElementById("eda-trend");

// state
let RAW_ROWS = [];
let PROCESSED_ROWS = [];
let STATS = null;
let MATERIAL_AGG = [];
let PCA_POINTS = [];

// IMPORTANT: Auto-load URL — SỬA 400: thêm /main/
const AUTOLOAD_URL =
  "https://raw.githubusercontent.com/123456789hien/f3/main/Kaggle_sust_dataset.csv";

/* ========== LOAD HANDLERS (GIỮ FLOW CŨ) ========== */

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

/* ========== FILTERS ========== */

function populateFilters(rows) {
  const countries = uniqueSorted(
    rows.map((r) => (r.Country || "").trim())
  );
  const mats = uniqueSorted(
    rows.map((r) => (r.Material_Type || "").trim())
  );
  const years = uniqueSorted(
    rows
      .map((r) => parseInt((r.Year || r.year || "").toString().trim(), 10))
      .filter((v) => !isNaN(v))
  );
  const certs = uniqueSorted(
    rows.map((r) => (r.Certifications || "").trim())
  );
  const trends = uniqueSorted(
    rows.map((r) => (r.Market_Trend || "").trim())
  );

  fillSelect(countryFilter, countries);
  fillSelect(materialFilter, mats);
  fillSelect(yearFilter, years.map(String));
  fillSelect(certFilter, certs);
  fillSelect(trendFilter, trends);
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter((x) => x))).sort();
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
      const mat = (r.Material_Type || "").trim();
      const country = (r.Country || "").trim();
      const yearVal = (r.Year || r.year || "").toString().trim();
      const year = parseInt(yearVal, 10);
      const cert = (r.Certifications || "").trim();
      const trend = (r.Market_Trend || "").trim();

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

    renderKPIs();
    clusterAndRenderMaterials();
    buildAndRenderRecommendations();
    renderEdaCharts();
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
      <div class="kpi-title">Avg Waste Production</div>
      <div class="kpi-value">${(mean.Waste_Production_KG || 0).toFixed(
        1
      )}<span class="kpi-sub"> kg</span></div>
      <div class="kpi-sub">Solid waste per production</div>
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
    .text("Normalized CO₂ (x) and combined Water+Waste (y) per material");

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

/* ========== EDA RENDER (theo filters hiện tại) ========== */

function renderEdaCharts() {
  edaMaterialDiv.innerHTML = "";
  edaCountryDiv.innerHTML = "";
  edaTrendDiv.innerHTML = "";

  if (!PROCESSED_ROWS.length) return;

  renderEdaMaterialChart();
  renderEdaCountryChart();
  renderEdaTrendChart();
}

/* 1) Material_Type — Price (bar, trục trái) & SIS (line, trục phải) */

function renderEdaMaterialChart() {
  const agg = MATERIAL_AGG;
  if (!agg.length) return;

  const data = agg
    .filter((m) => isFinite(m.meanPrice) && isFinite(m.meanSIS))
    .sort((a, b) => b.meanSIS - a.meanSIS);

  if (!data.length) return;

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

  // Axis
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

  // Bars for price
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
    .attr("fill", "#0ea5e9")
    .append("title")
    .text(
      (d) =>
        `${d.Material_Type}\nAvg Price: $${d.meanPrice.toFixed(
          2
        )}\nAvg SIS: ${d.meanSIS.toFixed(2)}`
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
    .attr("stroke", "#16a34a")
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
    .attr("fill", "#16a34a");

  svg
    .append("text")
    .attr("x", paddingLeft)
    .attr("y", paddingTop - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Blue bars: Avg Price, Green line: Avg SIS per material type");
}

/* 2) Top countries — Price (bar, trục trái) & SIS (line, trục phải) */

function renderEdaCountryChart() {
  const agg = computeCountryAgg(PROCESSED_ROWS).filter(
    (d) => isFinite(d.meanPrice) && isFinite(d.meanSIS)
  );
  if (!agg.length) return;

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

  // Axis
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

  // Bars
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
    .attr("fill", "#0ea5e9")
    .append("title")
    .text(
      (d) =>
        `${d.Country}\nAvg Price: $${d.meanPrice.toFixed(
          2
        )}\nAvg SIS: ${d.meanSIS.toFixed(2)}\nCount: ${d.count}`
    );

  // SIS line
  const line = d3
    .line()
    .x((d) => xScale(d.Country) + xScale.bandwidth() / 2)
    .y((d) => ySisScale(d.meanSIS));

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
    .attr("class", "dot-country")
    .attr("cx", (d) => xScale(d.Country) + xScale.bandwidth() / 2)
    .attr("cy", (d) => ySisScale(d.meanSIS))
    .attr("r", 3)
    .attr("fill", "#16a34a");

  svg
    .append("text")
    .attr("x", paddingLeft)
    .attr("y", paddingTop - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Blue bars: Avg Price, Green line: Avg SIS per country");
}

/* 3) Trend — Count (bar, trục trái) & SIS (line, trục phải) */

function renderEdaTrendChart() {
  const agg = computeTrendAgg(PROCESSED_ROWS);
  if (!agg.length) return;

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

  // Axis
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
    .text("Count of records");

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

  // Bars
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
    .attr("fill", "#a3e635")
    .append("title")
    .text(
      (d) =>
        `${d.Trend}\nCount: ${d.count}\nAvg SIS: ${d.meanSIS.toFixed(
          2
        )}\nAvg Price: $${isFinite(d.meanPrice) ? d.meanPrice.toFixed(2) : "N/A"}`
    );

  // SIS line
  const line = d3
    .line()
    .x((d) => xScale(d.Trend) + xScale.bandwidth() / 2)
    .y((d) => ySisScale(d.meanSIS));

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#16a34a")
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
    .attr("fill", "#16a34a");

  svg
    .append("text")
    .attr("x", paddingLeft)
    .attr("y", paddingTop - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Green line: Avg SIS per market trend, bars: count");
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
          <span><strong>Waste</strong> ${(item.Waste_Production_KG || 0).toFixed(
            1
          )} kg</span>
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

/* ========== UTIL ========== */

function clearResults() {
  kpiRow.innerHTML = "";
  pcaDiv.innerHTML = "";
  clusterLegend.innerHTML = "";
  recoList.innerHTML = "";
  edaMaterialDiv.innerHTML = "";
  edaCountryDiv.innerHTML = "";
  edaTrendDiv.innerHTML = "";
}
