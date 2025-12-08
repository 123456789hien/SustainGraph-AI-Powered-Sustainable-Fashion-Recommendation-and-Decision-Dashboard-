/* script.js
   Wires DOM to logic in app.js.
   No imports. Needs app.js loaded before this file.
*/

/* ========== DOM BINDINGS ========== */

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
const edaYearDiv = document.getElementById("eda-year");

// EDA insight blocks
const edaMaterialInsightDiv = document.getElementById("eda-material-insight");
const edaCountryInsightDiv = document.getElementById("eda-country-insight");
const edaTrendInsightDiv = document.getElementById("eda-trend-insight");
const edaYearInsightDiv = document.getElementById("eda-year-insight");

/* ========== STATE ========== */

let RAW_ROWS = [];
let PROCESSED_ROWS = [];
let STATS = null;
let MATERIAL_AGG = [];
let PCA_POINTS = [];
let ELBOW_INFO = null; // lưu kết quả Elbow (k tối ưuav4/Kaggle_sust_dataset.csv";

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
  ELBOW_INFO = null;

  statusEl.innerText = message + ` — rows: ${rows.length}`;
  populateFilters(rows);
  clearResults();
}

/* ========== FILTERS ========== */

function populateFilters(rows) {
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

    const { rowsWithSIS, stats, materialAgg } = normalizeAndComputeSIS(
      filtered
    );

    PROCESSED_ROWS = rowsWithSIS;
    STATS = stats;
    MATERIAL_AGG = materialAgg;

    renderKPIs();
    clusterAndRenderMaterials(); // K-Means + Elbow + PCA
    buildAndRenderRecommendations(); // Pareto + ưu tiên người dùng
    renderEdaCharts(); // EDA theo filters hiện tại
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

/* ========== MATERIAL CLUSTER + PCA PLOT (Elbow + K-Means) ========== */

function clusterAndRenderMaterials() {
  const agg = MATERIAL_AGG;
  if (!agg.length) {
    pcaDiv.innerHTML = "";
    clusterLegend.innerHTML = "";
    ELBOW_INFO = null;
    return;
  }

  // Feature matrix cho K-Means: [CO2, Water, Waste]
  const featureMatrix = agg.map((m) => [
    m.meanCarbon,
    m.meanWater,
    m.meanWaste,
  ]);

  // 1) Elbow Method để chọn k tối ưu cho material clusters
  const elbow = chooseKByElbow(featureMatrix, 6, 40);
  ELBOW_INFO = elbow; // lưu để debug / nghiên cứu
  const bestK = elbow.bestK || 3;

  // 2) Chạy K-Means với k tối ưu
  const { assignments } = runKMeans(featureMatrix, bestK, 40);

  const withCluster = agg.map((m, i) => ({
    ...m,
    cluster: assignments[i] || 0,
  }));

  MATERIAL_AGG = withCluster;

  // 3) PCA-style projection cho CO2 vs (Water+Waste)
  PCA_POINTS = computePcaLikeCoords(withCluster);

  // 4) Vẽ scatter plot + legend như cũ
  renderPcaScatter(bestK);
  renderClusterLegend(bestK);
  renderElbowCharts();
}

function renderPcaScatter(kUsed) {
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
    .domain(d3.range(kUsed))
    .range(["#22c55e", "#a3e635", "#f97316", "#16a34a", "#84cc16", "#fbbf24"]);

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
    .text(
      "Normalized CO₂ (x) and combined Water+Waste (y) per material (K-Means clusters with Elbow)"
    );

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
        )}\nBrands: ${d.count}\nCluster: ${d.cluster}`
    );
}

function renderClusterLegend(kUsed) {
  clusterLegend.innerHTML = "";
  const labels = [
    "Low-impact cluster",
    "Medium-impact cluster",
    "High-impact cluster",
    "Additional cluster 4",
    "Additional cluster 5",
    "Additional cluster 6",
  ];
  const colors = ["#22c55e", "#a3e635", "#f97316", "#16a34a", "#84cc16", "#fbbf24"];

  for (let i = 0; i < kUsed; i++) {
    const pill = document.createElement("div");
    pill.className = "cluster-pill";
    pill.innerHTML = `
      <span class="cluster-dot" style="background:${colors[i]}"></span>
      <span>${labels[i] || `Cluster ${i + 1}`}</span>
    `;
    clusterLegend.appendChild(pill);
  }
}


/* ========== ELBOW METHOD CHARTS ========== */

function renderElbowCharts() {
  // Render Elbow chart cho Materials
  if (ELBOW_INFO && ELBOW_INFO.inertias && ELBOW_INFO.inertias.length > 0) {
    renderElbowMaterial(ELBOW_INFO);
  }
  
  // Render Elbow chart cho Brands (tính toán riêng)
  if (PROCESSED_ROWS.length > 0) {
    renderElbowBrand();
  }
}

function renderElbowMaterial(elbowInfo) {
  const container = document.getElementById("elbow-material");
  if (!container) return;
  
  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  
  const data = elbowInfo.inertias;
  const bestK = elbowInfo.bestK;
  
  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  
  const xScale = d3.scaleLinear()
    .domain([1, d3.max(data, d => d.k)])
    .range([padding.left, width - padding.right]);
  
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.inertia) * 1.1])
    .range([height - padding.bottom, padding.top]);
  
  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScale).ticks(data.length).tickFormat(d3.format("d")))
    .selectAll("text")
    .style("font-size", "11px");
  
  svg.append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text")
    .style("font-size", "11px");
  
  // Title
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "#1b7a55")
    .attr("font-size", "13px")
    .attr("font-weight", "600")
    .text("Material Clusters — Elbow Curve");
  
  // X-axis label
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .attr("fill", "#65796a")
    .attr("font-size", "11px")
    .text("Number of Clusters (k)");
  
  // Y-axis label
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "#65796a")
    .attr("font-size", "11px")
    .text("Inertia");
  
  // Line
  const line = d3.line()
    .x(d => xScale(d.k))
    .y(d => yScale(d.inertia))
    .curve(d3.curveMonotoneX);
  
  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#22c55e")
    .attr("stroke-width", 2.5)
    .attr("d", line);
  
  // Points
  svg.selectAll("circle.elbow-point")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "elbow-point")
    .attr("cx", d => xScale(d.k))
    .attr("cy", d => yScale(d.inertia))
    .attr("r", d => d.k === bestK ? 6 : 4)
    .attr("fill", d => d.k === bestK ? "#f97316" : "#22c55e")
    .attr("stroke", d => d.k === bestK ? "#fff" : "none")
    .attr("stroke-width", 2)
    .append("title")
    .text(d => `k=${d.k}\nInertia=${d.inertia.toFixed(2)}${d.k === bestK ? " (optimal)" : ""}`);
  
  // Best K annotation
  const bestPoint = data.find(d => d.k === bestK);
  if (bestPoint) {
    svg.append("text")
      .attr("x", xScale(bestPoint.k))
      .attr("y", yScale(bestPoint.inertia) - 12)
      .attr("text-anchor", "middle")
      .attr("fill", "#f97316")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .text(`Optimal k=${bestK}`);
  }
}

function renderElbowBrand() {
  const container = document.getElementById("elbow-brand");
  if (!container) return;
  
  // Tính toán elbow cho brands (dựa trên SIS, Price, Carbon)
  const brandFeatures = PROCESSED_ROWS.map(r => [
    r.SIS || 0,
    r.Average_Price_USD || 0,
    r.Carbon_Footprint_MT || 0
  ]);
  
  if (brandFeatures.length < 2) {
    container.innerHTML = "<p style='padding:10px;color:#65796a;font-size:12px;'>Not enough data for brand clustering</p>";
    return;
  }
  
  const elbowBrand = chooseKByElbow(brandFeatures, 6, 30);
  
  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  
  const data = elbowBrand.inertias;
  const bestK = elbowBrand.bestK;
  
  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  
  const xScale = d3.scaleLinear()
    .domain([1, d3.max(data, d => d.k)])
    .range([padding.left, width - padding.right]);
  
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.inertia) * 1.1])
    .range([height - padding.bottom, padding.top]);
  
  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScale).ticks(data.length).tickFormat(d3.format("d")))
    .selectAll("text")
    .style("font-size", "11px");
  
  svg.append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text")
    .style("font-size", "11px");
  
  // Title
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "#1b7a55")
    .attr("font-size", "13px")
    .attr("font-weight", "600")
    .text("Brand Clusters — Elbow Curve");
  
  // X-axis label
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .attr("fill", "#65796a")
    .attr("font-size", "11px")
    .text("Number of Clusters (k)");
  
  // Y-axis label
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "#65796a")
    .attr("font-size", "11px")
    .text("Inertia");
  
  // Line
  const line = d3.line()
    .x(d => xScale(d.k))
    .y(d => yScale(d.inertia))
    .curve(d3.curveMonotoneX);
  
  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#a3e635")
    .attr("stroke-width", 2.5)
    .attr("d", line);
  
  // Points
  svg.selectAll("circle.elbow-point")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "elbow-point")
    .attr("cx", d => xScale(d.k))
    .attr("cy", d => yScale(d.inertia))
    .attr("r", d => d.k === bestK ? 6 : 4)
    .attr("fill", d => d.k === bestK ? "#f97316" : "#a3e635")
    .attr("stroke", d => d.k === bestK ? "#fff" : "none")
    .attr("stroke-width", 2)
    .append("title")
    .text(d => `k=${d.k}\nInertia=${d.inertia.toFixed(2)}${d.k === bestK ? " (optimal)" : ""}`);
  
  // Best K annotation
  const bestPoint = data.find(d => d.k === bestK);
  if (bestPoint) {
    svg.append("text")
      .attr("x", xScale(bestPoint.k))
      .attr("y", yScale(bestPoint.inertia) - 12)
      .attr("text-anchor", "middle")
      .attr("fill", "#f97316")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .text(`Optimal k=${bestK}`);
  }
}

/* ========== PARETO FRONTIER CHARTS ========== */

function renderParetoCharts() {
  renderParetoMaterial();
  renderParetoBrand();
}

function renderParetoMaterial() {
  const container = document.getElementById("pareto-material");
  if (!container) return;
  
  const agg = MATERIAL_AGG;
  if (!agg || agg.length === 0) {
    container.innerHTML = "<p style='padding:10px;color:#65796a;font-size:12px;'>No material data available</p>";
    return;
  }
  
  // Chuẩn bị data: price vs SIS
  const data = agg.map(m => ({
    name: m.Material_Type,
    price: m.meanPrice || 0,
    sis: m.meanSIS || 0,
    count: m.count
  })).filter(d => d.price > 0 && d.sis > 0);
  
  if (data.length === 0) {
    container.innerHTML = "<p style='padding:10px;color:#65796a;font-size:12px;'>Not enough data for Pareto analysis</p>";
    return;
  }
  
  // Tính Pareto frontier
  const sorted = [...data].sort((a, b) => a.price - b.price);
  const paretoPoints = [];
  let maxSIS = -Infinity;
  
  sorted.forEach(point => {
    if (point.sis >= maxSIS) {
      maxSIS = point.sis;
      paretoPoints.push(point);
    }
  });
  
  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  
  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  
  const xScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.price) * 1.1])
    .range([padding.left, width - padding.right]);
  
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.sis) * 1.1])
    .range([height - padding.bottom, padding.top]);
  
  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScale).ticks(5))
    .selectAll("text")
    .style("font-size", "11px");
  
  svg.append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text")
    .style("font-size", "11px");
  
  // Title
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "#1b7a55")
    .attr("font-size", "13px")
    .attr("font-weight", "600")
    .text("Materials — Pareto Frontier (Price vs SIS)");
  
  // X-axis label
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .attr("fill", "#65796a")
    .attr("font-size", "11px")
    .text("Average Price (USD)");
  
  // Y-axis label
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "#65796a")
    .attr("font-size", "11px")
    .text("Sustainability Index (SIS)");
  
  // Pareto frontier line
  if (paretoPoints.length > 1) {
    const line = d3.line()
      .x(d => xScale(d.price))
      .y(d => yScale(d.sis))
      .curve(d3.curveStepAfter);
    
    svg.append("path")
      .datum(paretoPoints)
      .attr("fill", "none")
      .attr("stroke", "#f97316")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,3")
      .attr("d", line);
  }
  
  // All points
  svg.selectAll("circle.all-point")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "all-point")
    .attr("cx", d => xScale(d.price))
    .attr("cy", d => yScale(d.sis))
    .attr("r", 4)
    .attr("fill", "#d1d5db")
    .attr("opacity", 0.5);
  
  // Pareto points (highlighted)
  svg.selectAll("circle.pareto-point")
    .data(paretoPoints)
    .enter()
    .append("circle")
    .attr("class", "pareto-point")
    .attr("cx", d => xScale(d.price))
    .attr("cy", d => yScale(d.sis))
    .attr("r", 5)
    .attr("fill", "#f97316")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .append("title")
    .text(d => `${d.name}\nPrice: $${d.price.toFixed(2)}\nSIS: ${d.sis.toFixed(2)}\nBrands: ${d.count}`);
  
  // Legend
  const legend = svg.append("g")
    .attr("transform", `translate(${width - 140}, ${padding.top + 10})`);
  
  legend.append("circle")
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", 4)
    .attr("fill", "#f97316");
  
  legend.append("text")
    .attr("x", 10)
    .attr("y", 4)
    .attr("font-size", "10px")
    .attr("fill", "#65796a")
    .text("Pareto-optimal");
  
  legend.append("circle")
    .attr("cx", 0)
    .attr("cy", 15)
    .attr("r", 4)
    .attr("fill", "#d1d5db")
    .attr("opacity", 0.5);
  
  legend.append("text")
    .attr("x", 10)
    .attr("y", 19)
    .attr("font-size", "10px")
    .attr("fill", "#65796a")
    .text("Other materials");
}

function renderParetoBrand() {
  const container = document.getElementById("pareto-brand");
  if (!container) return;
  
  if (!PROCESSED_ROWS || PROCESSED_ROWS.length === 0) {
    container.innerHTML = "<p style='padding:10px;color:#65796a;font-size:12px;'>No brand data available</p>";
    return;
  }
  
  // Chuẩn bị data: price vs SIS cho brands
  const data = PROCESSED_ROWS.map(r => ({
    name: r.Brand_Name || r.Brand_ID || "Unknown",
    price: r.Average_Price_USD || 0,
    sis: r.SIS || 0,
    material: r.Material_Type
  })).filter(d => d.price > 0 && d.sis > 0);
  
  if (data.length === 0) {
    container.innerHTML = "<p style='padding:10px;color:#65796a;font-size:12px;'>Not enough data for Pareto analysis</p>";
    return;
  }
  
  // Tính Pareto frontier
  const sorted = [...data].sort((a, b) => a.price - b.price);
  const paretoPoints = [];
  let maxSIS = -Infinity;
  
  sorted.forEach(point => {
    if (point.sis >= maxSIS) {
      maxSIS = point.sis;
      paretoPoints.push(point);
    }
  });
  
  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  
  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  
  const xScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.price) * 1.1])
    .range([padding.left, width - padding.right]);
  
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.sis) * 1.1])
    .range([height - padding.bottom, padding.top]);
  
  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScale).ticks(5))
    .selectAll("text")
    .style("font-size", "11px");
  
  svg.append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text")
    .style("font-size", "11px");
  
  // Title
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "#1b7a55")
    .attr("font-size", "13px")
    .attr("font-weight", "600")
    .text("Brands — Pareto Frontier (Price vs SIS)");
  
  // X-axis label
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .attr("fill", "#65796a")
    .attr("font-size", "11px")
    .text("Average Price (USD)");
  
  // Y-axis label
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "#65796a")
    .attr("font-size", "11px")
    .text("Sustainability Index (SIS)");
  
  // Pareto frontier line
  if (paretoPoints.length > 1) {
    const line = d3.line()
      .x(d => xScale(d.price))
      .y(d => yScale(d.sis))
      .curve(d3.curveStepAfter);
    
    svg.append("path")
      .datum(paretoPoints)
      .attr("fill", "none")
      .attr("stroke", "#16a34a")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,3")
      .attr("d", line);
  }
  
  // All points (sample to avoid overcrowding)
  const sampleData = data.length > 100 ? data.filter((_, i) => i % Math.ceil(data.length / 100) === 0) : data;
  
  svg.selectAll("circle.all-point")
    .data(sampleData)
    .enter()
    .append("circle")
    .attr("class", "all-point")
    .attr("cx", d => xScale(d.price))
    .attr("cy", d => yScale(d.sis))
    .attr("r", 3)
    .attr("fill", "#d1d5db")
    .attr("opacity", 0.4);
  
  // Pareto points (highlighted)
  svg.selectAll("circle.pareto-point")
    .data(paretoPoints)
    .enter()
    .append("circle")
    .attr("class", "pareto-point")
    .attr("cx", d => xScale(d.price))
    .attr("cy", d => yScale(d.sis))
    .attr("r", 5)
    .attr("fill", "#16a34a")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .append("title")
    .text(d => `${d.name}\nPrice: $${d.price.toFixed(2)}\nSIS: ${d.sis.toFixed(2)}\nMaterial: ${d.material || "N/A"}`);
  
  // Legend
  const legend = svg.append("g")
    .attr("transform", `translate(${width - 140}, ${padding.top + 10})`);
  
  legend.append("circle")
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", 4)
    .attr("fill", "#16a34a");
  
  legend.append("text")
    .attr("x", 10)
    .attr("y", 4)
    .attr("font-size", "10px")
    .attr("fill", "#65796a")
    .text("Pareto-optimal");
  
  legend.append("circle")
    .attr("cx", 0)
    .attr("cy", 15)
    .attr("r", 4)
    .attr("fill", "#d1d5db")
    .attr("opacity", 0.4);
  
  legend.append("text")
    .attr("x", 10)
    .attr("y", 19)
    .attr("font-size", "10px")
    .attr("fill", "#65796a")
    .text("Other brands");
}


/* ========== EDA RENDER (theo filters hiện tại) ========== */

function renderEdaCharts() {
  edaMaterialDiv.innerHTML = "";
  edaCountryDiv.innerHTML = "";
  edaTrendDiv.innerHTML = "";
  edaYearDiv.innerHTML = "";

  edaMaterialInsightDiv.innerHTML = "";
  edaCountryInsightDiv.innerHTML = "";
  edaTrendInsightDiv.innerHTML = "";
  edaYearInsightDiv.innerHTML = "";

  if (!PROCESSED_ROWS.length) return;

  renderEdaMaterialChart();
  renderEdaCountryChart();
  renderEdaTrendChart();
  renderEdaYearChart();
}

/* 1) Material_Type — Price (bar, trục trái) & SIS (line, trục phải) */

function renderEdaMaterialChart() {
  const agg = MATERIAL_AGG;
  if (!agg.length) return;

  const data = agg
    .filter((m) => isFinite(m.meanPrice) && isFinite(m.meanSIS))
    .sort((a, b) => b.meanSIS - a.meanSIS);

  if (!data.length) {
    edaMaterialInsightDiv.textContent =
      "No material-level data for current filters.";
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

  // Bars for price (premium green)
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
        )}\nAvg SIS: ${d.meanSIS.toFixed(2)}`
    );

  // SIS line (dark green)
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
    .text(
      "Soft green bars: Avg Price, dark green line: Avg SIS per material type"
    );

  const topSIS = [...data].sort((a, b) => b.meanSIS - a.meanSIS)[0];
  const cheapest = [...data].sort((a, b) => a.meanPrice - b.meanPrice)[0];

  edaMaterialInsightDiv.innerHTML = `
    <p><strong>Highest SIS material:</strong><br>
       ${topSIS.Material_Type} (SIS ≈ ${topSIS.meanSIS.toFixed(2)}).</p>
    <p><strong>Most budget-friendly:</strong><br>
       ${cheapest.Material_Type} (Avg price ≈ $${cheapest.meanPrice.toFixed(
    2
  )}).</p>
    <p>Use this view to pick fabrics that balance price and sustainability before drilling into brands.</p>
  `;
}

/* 2) Top countries — Price (bar, trục trái) & SIS (line, trục phải) */

function renderEdaCountryChart() {
  const agg = computeCountryAgg(PROCESSED_ROWS).filter(
    (d) => isFinite(d.meanPrice) && isFinite(d.meanSIS)
  );
  if (!agg.length) {
    edaCountryInsightDiv.textContent =
      "No country-level data for current filters.";
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

  edaCountryInsightDiv.innerHTML = `
    <p><strong>Highest-priced market:</strong><br>
       ${highestPrice.Country} (Avg price ≈ $${highestPrice.meanPrice.toFixed(
    2
  )}).</p>
    <p><strong>Best SIS performance:</strong><br>
       ${bestSIS.Country} (SIS ≈ ${bestSIS.meanSIS.toFixed(
    2
  )}, n = ${bestSIS.count}).</p>
    <p>Use this to compare premium vs sustainable sourcing regions when expanding collections.</p>
  `;
}

/* 3) Trend — Count (bar, trục trái) & SIS (line, trục phải) */

function renderEdaTrendChart() {
  const agg = computeTrendAgg(PROCESSED_ROWS);
  if (!agg.length) {
    edaTrendInsightDiv.textContent =
      "No trend-level data for current filters.";
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
    .text("Soft green bars: volume by trend, dark green line: Avg SIS");

  const dominant = data[0];
  const bestSIS = [...data].sort((a, b) => b.meanSIS - a.meanSIS)[0];

  edaTrendInsightDiv.innerHTML = `
    <p><strong>Dominant trend by volume:</strong><br>
       ${dominant.Trend} (n = ${dominant.count}).</p>
    <p><strong>Most sustainable trend:</strong><br>
       ${bestSIS.Trend} (SIS ≈ ${bestSIS.meanSIS.toFixed(2)}).</p>
    <p>Use this to align marketing narratives with trends that are both popular and sustainable.</p>
  `;
}

/* 4) Year — Price (bar, trục trái) & SIS (line, trục phải) */

function renderEdaYearChart() {
  const agg = computeYearAgg(PROCESSED_ROWS);
  if (!agg.length) {
    edaYearInsightDiv.textContent =
      "No year information available for current filters.";
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

  edaYearInsightDiv.innerHTML = `
    <p><strong>Coverage:</strong><br>
       ${earliest.Year} → ${latest.Year} (based on current filters).</p>
    <p><strong>Peak SIS year:</strong><br>
       ${bestSIS.Year} (SIS ≈ ${bestSIS.meanSIS.toFixed(
    2
  )}, n = ${bestSIS.count}).</p>
    <p>Track how your sustainability and pricing strategy evolves across years in the filtered segment.</p>
  `;
}

/* ========== RECOMMENDATIONS RENDER (Pareto + trọng số ưu tiên) ========== */

function buildAndRenderRecommendations() {
  const w = parseFloat(prioritySelect.value || "0.5");
  const recs = buildRecommendations(PROCESSED_ROWS, w, 10);
  renderRecommendations(recs);
  renderParetoCharts();
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

    const paretoTag = item.isPareto
      ? '<span class="reco-pill">Pareto-optimal (SIS vs Price)</span>'
      : "";

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
        ${paretoTag}
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
  edaYearDiv.innerHTML = "";

  edaMaterialInsightDiv.innerHTML = "";
  edaCountryInsightDiv.innerHTML = "";
  edaTrendInsightDiv.innerHTML = "";
  edaYearInsightDiv.innerHTML = "";
}
