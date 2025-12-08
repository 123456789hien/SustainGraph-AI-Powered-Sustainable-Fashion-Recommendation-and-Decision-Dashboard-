/* script.js - Scientific Version
   UI rendering and visualization for SustainGraph
   Implements scientific methodology display
*/

/* ========== GLOBAL STATE ========== */

let RAW_ROWS = [];
let PROCESSED_ROWS = [];
let STATS = null;
let MATERIAL_AGG = [];
let PCA_POINTS = [];
let ELBOW_INFO = null;
let ENTROPY_WEIGHTS = null;

/* ========== DOM ELEMENTS ========== */

const fileUpload = document.getElementById("fileUpload");
const loadSampleBtn = document.getElementById("load-sample");
const autoUploadBtn = document.getElementById("auto-upload");
const loadStatus = document.getElementById("load-status");

const countryFilter = document.getElementById("country-filter");
const materialFilter = document.getElementById("material-filter");
const yearFilter = document.getElementById("year-filter");
const certFilter = document.getElementById("cert-filter");
const trendFilter = document.getElementById("trend-filter");
const prioritySelect = document.getElementById("priority");
const btnRun = document.getElementById("run-pipeline");

const kpiRow = document.getElementById("kpi-row");
const pcaDiv = document.getElementById("pca-plot");
const clusterLegend = document.getElementById("material-clusters");
const pcaInsightDiv = document.getElementById("pca-insight");
const recoList = document.getElementById("recommendations-list");

const paretoInsightDiv = document.getElementById("pareto-insight");
const materialImpactInsightDiv = document.getElementById("material-impact-insight");

/* ========== FILE UPLOAD ========== */

fileUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  parseCSVFile(file).then((rows) => {
    RAW_ROWS = rows;
    loadStatus.textContent = `✓ Loaded ${rows.length} rows from ${file.name}`;
    loadStatus.style.background = "#e6f5ec";
    loadStatus.style.color = "#1b7a55";
    populateFilters();
  });
});

loadSampleBtn.addEventListener("click", () => {
  fileUpload.click();
});

autoUploadBtn.addEventListener("click", () => {
  loadStatus.textContent = "Loading dataset from GitHub...";
  loadStatus.style.background = "#fef3c7";
  loadStatus.style.color = "#92400e";

  const url =
    "https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/av6/Kaggle_sust_dataset.csv";

  fetch(url)
    .then((res) => res.text())
    .then((txt) => {
      RAW_ROWS = parseCSVText(txt);
      loadStatus.textContent = `✓ Auto-loaded ${RAW_ROWS.length} rows from GitHub`;
      loadStatus.style.background = "#e6f5ec";
      loadStatus.style.color = "#1b7a55";
      populateFilters();
    })
    .catch((err) => {
      loadStatus.textContent = "✗ Auto-load failed. Please upload manually.";
      loadStatus.style.background = "#fee2e2";
      loadStatus.style.color = "#991b1b";
      console.error(err);
    });
});

/* ========== POPULATE FILTERS ========== */

function populateFilters() {
  const countries = new Set();
  const materials = new Set();
  const years = new Set();
  const certs = new Set();
  const trends = new Set();

  RAW_ROWS.forEach((r) => {
    if (r.Country) countries.add(r.Country.trim());
    if (r.Material_Type) materials.add(r.Material_Type.trim());
    if (r.Year || r.year) {
      const y = r.Year || r.year;
      years.add(y.toString().trim());
    }
    if (r.Certifications) certs.add(r.Certifications.trim());
    if (r.Market_Trend) trends.add(r.Market_Trend.trim());
  });

  const fillSelect = (select, items) => {
    select.innerHTML = '<option value="__all">All</option>';
    Array.from(items)
      .sort()
      .forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item;
        opt.textContent = item;
        select.appendChild(opt);
      });
  };

  fillSelect(countryFilter, countries);
  fillSelect(materialFilter, materials);
  fillSelect(yearFilter, years);
  fillSelect(certFilter, certs);
  fillSelect(trendFilter, trends);
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

    const { rowsWithSIS, stats, materialAgg, entropyWeights } =
      normalizeAndComputeSIS(filtered);

    PROCESSED_ROWS = rowsWithSIS;
    STATS = stats;
    MATERIAL_AGG = materialAgg;
    ENTROPY_WEIGHTS = entropyWeights;

    renderKPIs();
    renderEntropyWeightsInfo();
    clusterAndRenderMaterials();
    buildAndRenderRecommendations();
    renderEdaCharts();
  } catch (err) {
    console.error(err);
    alert("Pipeline error (see console).");
  } finally {
    btnRun.disabled = false;
    btnRun.textContent = "🚀 Run Analysis";
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
      <div class="kpi-value">${avgSIS.toFixed(3)}</div>
      <div class="kpi-sub">Entropy-weighted score</div>
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

/* ========== ENTROPY WEIGHTS INFO ========== */

function renderEntropyWeightsInfo() {
  if (!ENTROPY_WEIGHTS) return;

  const infoDiv = document.createElement("div");
  infoDiv.className = "entropy-info-card";
  infoDiv.innerHTML = `
    <h3>📊 Entropy Weight Method Results</h3>
    <p><strong>Scientific Weighting:</strong> Weights are calculated objectively from data variance, not manually set.</p>
    <div class="entropy-metrics">
      <div class="entropy-metric">
        <span class="metric-label">Environmental Weight:</span>
        <span class="metric-value">${ENTROPY_WEIGHTS.weights[0].toFixed(4)}</span>
      </div>
      <div class="entropy-metric">
        <span class="metric-label">Policy Weight:</span>
        <span class="metric-value">${ENTROPY_WEIGHTS.weights[1].toFixed(4)}</span>
      </div>
      <div class="entropy-metric">
        <span class="metric-label">Environmental Entropy:</span>
        <span class="metric-value">${ENTROPY_WEIGHTS.entropy[0].toFixed(4)}</span>
      </div>
      <div class="entropy-metric">
        <span class="metric-label">Policy Entropy:</span>
        <span class="metric-value">${ENTROPY_WEIGHTS.entropy[1].toFixed(4)}</span>
      </div>
    </div>
    <p class="entropy-note"><strong>Interpretation:</strong> Higher diversity (1 - entropy) = higher weight. The data determines which factor is more important.</p>
  `;

  // Insert after KPI section
  const kpiCard = kpiRow.parentElement;
  if (kpiCard.nextElementSibling) {
    kpiCard.parentElement.insertBefore(infoDiv, kpiCard.nextElementSibling);
  } else {
    kpiCard.parentElement.appendChild(infoDiv);
  }
}

/* ========== MATERIAL CLUSTER + PCA PLOT ========== */

function clusterAndRenderMaterials() {
  const agg = MATERIAL_AGG;
  if (!agg.length) {
    pcaDiv.innerHTML = "";
    clusterLegend.innerHTML = "";
    ELBOW_INFO = null;
    return;
  }

  // Feature matrix for K-Means: [CO2, Water, Waste]
  const featureMatrix = agg.map((m) => [
    m.meanCarbon,
    m.meanWater,
    m.meanWaste,
  ]);

  // 1) Elbow Method to find optimal k
  const elbow = chooseKByElbow(featureMatrix, 6, 40);
  ELBOW_INFO = elbow;
  const bestK = elbow.bestK || 3;

  console.log(`=== Elbow Method: Optimal k = ${bestK} ===`);

  // 2) Run K-Means with optimal k
  const { assignments } = runKMeans(featureMatrix, bestK, 40);

  const withCluster = agg.map((m, i) => ({
    ...m,
    cluster: assignments[i] || 0,
  }));

  MATERIAL_AGG = withCluster;

  // 3) PCA-style projection
  PCA_POINTS = computePcaLikeCoords(withCluster);

  // 4) Render
  renderPcaScatter(bestK);
  renderClusterLegend(bestK);
  renderMaterialImpactChart();
  renderElbowChart();
  renderPcaInsight(bestK);
}

function renderPcaInsight(kUsed) {
  if (!pcaInsightDiv) return;
  const clusterCounts = MATERIAL_AGG.reduce((acc, m) => {
    acc[m.cluster] = (acc[m.cluster] || 0) + 1;
    return acc;
  }, {});

  const largestCluster = Object.entries(clusterCounts).sort(
    ([, a], [, b]) => b - a
  )[0];

  pcaInsightDiv.innerHTML = `
    <p><strong>K-Means Clustering (Validated):</strong> Materials were grouped into <strong>${kUsed} clusters</strong> using the Elbow Method to find the optimal k. This is data-driven, not arbitrary.</p>
    <p><strong>Insight:</strong> Cluster ${largestCluster[0]} is the largest with ${largestCluster[1]} materials. The plot visualizes CO₂ (x-axis) vs combined Water/Waste (y-axis).</p>
    <p><strong>Recommendation:</strong> Focus on materials in <strong>low-impact clusters</strong> for the most sustainable choices.</p>
  `;
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
      "Normalized CO₂ (x) and combined Water+Waste (y) per material (K-Means with Elbow)"
    );

  // Tooltip
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "pca-tooltip")
    .style("position", "absolute")
    .style("visibility", "hidden")
    .style("background", "rgba(255, 255, 255, 0.98)")
    .style("border", "2px solid #1b7a55")
    .style("border-radius", "8px")
    .style("padding", "12px")
    .style("font-size", "13px")
    .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")
    .style("pointer-events", "none")
    .style("z-index", "1000");

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
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1).attr("r", 10 + Math.min(8, d.count / 5));
      tooltip
        .html(
          `
        <div style="font-weight:600;color:#1b7a55;margin-bottom:6px;">${
          d.Material_Type
        }</div>
        <div style="color:#4b5563;"><strong>SIS:</strong> ${d.meanSIS.toFixed(
          3
        )}</div>
        <div style="color:#4b5563;"><strong>Brands:</strong> ${d.count}</div>
        <div style="color:#4b5563;"><strong>Cluster:</strong> ${d.cluster}</div>
      `
        )
        .style("visibility", "visible");
    })
    .on("mousemove", function (event) {
      tooltip
        .style("top", event.pageY - 10 + "px")
        .style("left", event.pageX + 10 + "px");
    })
    .on("mouseout", function (event, d) {
      d3.select(this).attr("opacity", 0.85).attr("r", 6 + Math.min(8, d.count / 5));
      tooltip.style("visibility", "hidden");
    });
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
  const colors = [
    "#22c55e",
    "#a3e635",
    "#f97316",
    "#16a34a",
    "#84cc16",
    "#fbbf24",
  ];

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

/* ========== ELBOW CHART ========== */

function renderElbowChart() {
  const container = document.getElementById("elbow-chart");
  if (!container || !ELBOW_INFO) return;

  container.innerHTML = "";
  const width = container.clientWidth || 600;
  const height = container.clientHeight || 300;

  const data = ELBOW_INFO.inertias;
  const bestK = ELBOW_INFO.bestK;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const padding = { top: 40, right: 20, bottom: 50, left: 60 };

  const xScale = d3
    .scaleLinear()
    .domain([1, d3.max(data, (d) => d.k)])
    .range([padding.left, width - padding.right]);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.inertia) * 1.1])
    .range([height - padding.bottom, padding.top]);

  // Axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScale).ticks(data.length).tickFormat(d3.format("d")))
    .selectAll("text")
    .style("font-size", "11px");

  svg
    .append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text")
    .style("font-size", "11px");

  // Title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .attr("fill", "#1b7a55")
    .attr("font-size", "14px")
    .attr("font-weight", "600")
    .text("Elbow Method — Material Clustering Validation");

  // X-axis label
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .attr("fill", "#65796a")
    .attr("font-size", "11px")
    .text("Number of Clusters (k)");

  // Y-axis label
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .attr("fill", "#65796a")
    .attr("font-size", "11px")
    .text("Inertia (Within-Cluster Sum of Squares)");

  // Line
  const line = d3
    .line()
    .x((d) => xScale(d.k))
    .y((d) => yScale(d.inertia))
    .curve(d3.curveMonotoneX);

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#22c55e")
    .attr("stroke-width", 2.5)
    .attr("d", line);

  // Points
  svg
    .selectAll("circle.elbow-point")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "elbow-point")
    .attr("cx", (d) => xScale(d.k))
    .attr("cy", (d) => yScale(d.inertia))
    .attr("r", (d) => (d.k === bestK ? 7 : 5))
    .attr("fill", (d) => (d.k === bestK ? "#f97316" : "#22c55e"))
    .attr("stroke", (d) => (d.k === bestK ? "#fff" : "none"))
    .attr("stroke-width", 2.5)
    .attr("cursor", "pointer")
    .append("title")
    .text(
      (d) =>
        `k=${d.k}\nInertia=${d.inertia.toFixed(2)}${
          d.k === bestK ? " (optimal)" : ""
        }`
    );

  // Best K annotation
  const bestPoint = data.find((d) => d.k === bestK);
  if (bestPoint) {
    svg
      .append("text")
      .attr("x", xScale(bestPoint.k))
      .attr("y", yScale(bestPoint.inertia) - 15)
      .attr("text-anchor", "middle")
      .attr("fill", "#f97316")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .text(`Optimal k=${bestK}`);
  }

  // Insight
  const insightDiv = document.getElementById("elbow-insight");
  if (insightDiv) {
    insightDiv.innerHTML = `
      <p><strong>Elbow Method Validation:</strong> The optimal number of clusters is <strong>k=${bestK}</strong>, determined by analyzing the rate of change in inertia.</p>
      <p><strong>Scientific Justification:</strong> This is not arbitrary—the elbow point represents the best trade-off between model complexity and fit quality.</p>
      <p><strong>Reference:</strong> Standard validation technique in unsupervised learning (Zhao et al., 2021).</p>
    `;
  }
}

/* ========== MATERIAL ENVIRONMENTAL IMPACT CHART ========== */

function renderMaterialImpactChart() {
  const container = document.getElementById("material-impact-chart");
  const insightDiv = document.getElementById("material-impact-insight");

  if (!container || !MATERIAL_AGG || MATERIAL_AGG.length === 0) {
    if (container)
      container.innerHTML =
        "<p style='padding:10px;color:#65796a;font-size:12px;'>No material data available</p>";
    return;
  }

  container.innerHTML = "";
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 320;

  // Prepare data
  const materials = MATERIAL_AGG.map((m) => ({
    name: m.Material_Type,
    co2: m.meanCarbon || 0,
    water: m.meanWater || 0,
    waste: m.meanWaste || 0,
    sis: m.meanSIS || 0,
    count: m.count || 0,
  })).sort((a, b) => b.co2 + b.water + b.waste - (a.co2 + a.water + a.waste));

  // Top 10 materials
  const topMaterials = materials.slice(0, Math.min(10, materials.length));

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const padding = { top: 40, right: 120, bottom: 60, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Scales
  const xScale = d3
    .scaleBand()
    .domain(topMaterials.map((d) => d.name))
    .range([0, chartWidth])
    .padding(0.3);

  const maxValue = d3.max(topMaterials, (d) =>
    Math.max(d.co2, d.water, d.waste)
  );
  const yScale = d3
    .scaleLinear()
    .domain([0, maxValue * 1.1])
    .range([chartHeight, 0]);

  const g = svg
    .append("g")
    .attr("transform", `translate(${padding.left},${padding.top})`);

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end")
    .style("font-size", "10px")
    .style("fill", "#4b5563");

  g.append("g")
    .call(d3.axisLeft(yScale).ticks(6))
    .selectAll("text")
    .style("font-size", "11px")
    .style("fill", "#4b5563");

  // Title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .attr("fill", "#1b7a55")
    .attr("font-size", "14px")
    .attr("font-weight", "600")
    .text("Top Materials by Environmental Impact");

  // Y-axis label
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .attr("fill", "#65796a")
    .attr("font-size", "11px")
    .text("Normalized Impact Score");

  // Tooltip
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "material-tooltip")
    .style("position", "absolute")
    .style("visibility", "hidden")
    .style("background", "rgba(255, 255, 255, 0.98)")
    .style("border", "2px solid #1b7a55")
    .style("border-radius", "8px")
    .style("padding", "12px")
    .style("font-size", "13px")
    .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")
    .style("pointer-events", "none")
    .style("z-index", "1000");

  // Colors for metrics
  const colors = {
    co2: "#ef4444",
    water: "#3b82f6",
    waste: "#f59e0b",
  };

  const barWidth = xScale.bandwidth() / 3;

  // Draw bars for each metric
  ["co2", "water", "waste"].forEach((metric, idx) => {
    g.selectAll(`.bar-${metric}`)
      .data(topMaterials)
      .enter()
      .append("rect")
      .attr("class", `bar-${metric}`)
      .attr("x", (d) => xScale(d.name) + idx * barWidth)
      .attr("y", (d) => yScale(d[metric]))
      .attr("width", barWidth)
      .attr("height", (d) => chartHeight - yScale(d[metric]))
      .attr("fill", colors[metric])
      .attr("opacity", 0.85)
      .attr("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("opacity", 1);
        const metricName =
          metric === "co2"
            ? "CO₂ Footprint"
            : metric === "water"
            ? "Water Usage"
            : "Waste Production";
        const unit = metric === "co2" ? "MT" : metric === "water" ? "L" : "kg";
        tooltip
          .html(
            `
          <div style="font-weight:600;color:#1b7a55;margin-bottom:6px;">${
            d.name
          }</div>
          <div style="color:#4b5563;"><strong>${metricName}:</strong> ${d[
              metric
            ].toFixed(2)} ${unit}</div>
          <div style="color:#4b5563;"><strong>SIS Score:</strong> ${d.sis.toFixed(
            3
          )}</div>
          <div style="color:#4b5563;"><strong>Brands:</strong> ${d.count}</div>
        `
          )
          .style("visibility", "visible");
      })
      .on("mousemove", function (event) {
        tooltip
          .style("top", event.pageY - 10 + "px")
          .style("left", event.pageX + 10 + "px");
      })
      .on("mouseout", function () {
        d3.select(this).attr("opacity", 0.85);
        tooltip.style("visibility", "hidden");
      });
  });

  // Legend
  const legend = svg
    .append("g")
    .attr(
      "transform",
      `translate(${width - padding.right + 10}, ${padding.top})`
    );

  const legendData = [
    { label: "CO₂ Footprint (MT)", color: colors.co2 },
    { label: "Water Usage (L)", color: colors.water },
    { label: "Waste Production (kg)", color: colors.waste },
  ];

  legendData.forEach((item, i) => {
    const legendRow = legend
      .append("g")
      .attr("transform", `translate(0, ${i * 25})`);

    legendRow
      .append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", item.color)
      .attr("opacity", 0.85);

    legendRow
      .append("text")
      .attr("x", 18)
      .attr("y", 10)
      .attr("font-size", "11px")
      .attr("fill", "#4b5563")
      .text(item.label);
  });

  // Insight
  if (insightDiv) {
    const worstMaterial = topMaterials[0];
    const bestMaterial = topMaterials[topMaterials.length - 1];
    insightDiv.innerHTML = `
      <p><strong>Environmental Impact Analysis:</strong> This chart compares the top ${topMaterials.length} materials across three key environmental metrics: CO₂ emissions, water usage, and waste production.</p>
      <p><strong>Highest Impact:</strong> <strong>${worstMaterial.name}</strong> has the highest combined environmental impact (CO₂: ${worstMaterial.co2.toFixed(2)} MT, Water: ${worstMaterial.water.toFixed(2)} L, Waste: ${worstMaterial.waste.toFixed(2)} kg).</p>
      <p><strong>Recommendation:</strong> Consider materials with lower bars across all three metrics for more sustainable choices. Materials like <strong>${bestMaterial.name}</strong> show better environmental performance.</p>
    `;
  }
}

/* ========== PARETO FRONTIER CHARTS ========== */

function renderParetoCharts() {
  const materialPareto = renderParetoMaterial();
  const brandPareto = renderParetoBrand();
  renderParetoInsight(materialPareto, brandPareto);
}

function renderParetoInsight(materialPareto, brandPareto) {
  if (!paretoInsightDiv) return;

  const bestMaterial =
    materialPareto.length > 0
      ? materialPareto[materialPareto.length - 1]
      : null;
  const bestBrand =
    brandPareto.length > 0 ? brandPareto[brandPareto.length - 1] : null;

  let insight =
    "<p><strong>Multi-Objective Optimization (Pareto Frontier):</strong> Shows the <strong>efficient frontier</strong> where no choice can improve both SIS and Price simultaneously. This is a scientifically validated approach for sustainability trade-offs (Ghasemy et al., 2025).</p>";

  if (bestMaterial) {
    insight += `<p><strong>Top Material on Frontier:</strong> <strong>${
      bestMaterial.name
    }</strong> (SIS: ${bestMaterial.sis.toFixed(
      3
    )}, Price: $${bestMaterial.price.toFixed(
      2
    )}) offers the highest sustainability among materials at or below its price point.</p>`;
  }

  if (bestBrand) {
    insight += `<p><strong>Top Brand on Frontier:</strong> <strong>${
      bestBrand.name
    }</strong> (SIS: ${bestBrand.sis.toFixed(
      3
    )}, Price: $${bestBrand.price.toFixed(
      2
    )}) is Pareto-optimal, meaning no other brand offers better SIS at this price or lower price at this SIS level.</p>`;
  }

  insight +=
    "<p><strong>Note:</strong> Pareto-optimal brands may differ from <strong>Top 8 Recommendations</strong> below, which rank brands using your selected <strong>SIS Priority</strong> weight. Pareto analysis is objective (MOO), while recommendations are personalized to your preferences.</p>";

  paretoInsightDiv.innerHTML = insight;
}

function renderParetoMaterial() {
  const container = document.getElementById("pareto-material");
  if (!container) return [];

  const agg = MATERIAL_AGG;
  if (!agg || agg.length === 0) {
    container.innerHTML =
      "<p style='padding:10px;color:#65796a;font-size:12px;'>No material data available</p>";
    return [];
  }

  // Prepare data: price vs SIS
  const data = agg
    .map((m) => ({
      name: m.Material_Type,
      price: m.meanPrice || 0,
      sis: m.meanSIS || 0,
      count: m.count,
    }))
    .filter((d) => d.price > 0 && d.sis > 0);

  if (data.length === 0) {
    container.innerHTML =
      "<p style='padding:10px;color:#65796a;font-size:12px;'>Not enough data for Pareto analysis</p>";
    return [];
  }

  // Calculate Pareto frontier
  const sorted = [...data].sort((a, b) => a.price - b.price);
  const paretoPoints = [];
  let maxSIS = -Infinity;

  sorted.forEach((point) => {
    if (point.sis >= maxSIS) {
      maxSIS = point.sis;
      paretoPoints.push(point);
    }
  });

  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const padding = { top: 30, right: 20, bottom: 40, left: 50 };

  const xScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.price) * 1.1])
    .range([padding.left, width - padding.right]);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.sis) * 1.1])
    .range([height - padding.bottom, padding.top]);

  // Axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScale).ticks(5))
    .selectAll("text")
    .style("font-size", "11px");

  svg
    .append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text")
    .style("font-size", "11px");

  // Title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "#1b7a55")
    .attr("font-size", "13px")
    .attr("font-weight", "600")
    .text("Materials — Pareto Frontier (Price vs SIS)");

  // X-axis label
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .attr("fill", "#65796a")
    .attr("font-size", "11px")
    .text("Average Price (USD)");

  // Y-axis label
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "#65796a")
    .attr("font-size", "11px")
    .text("Sustainability Index (SIS)");

  // Pareto frontier line
  if (paretoPoints.length > 1) {
    const line = d3
      .line()
      .x((d) => xScale(d.price))
      .y((d) => yScale(d.sis))
      .curve(d3.curveStepAfter);

    svg
      .append("path")
      .datum(paretoPoints)
      .attr("fill", "none")
      .attr("stroke", "#f97316")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,3")
      .attr("d", line);
  }

  // Tooltip
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "pareto-material-tooltip")
    .style("position", "absolute")
    .style("visibility", "hidden")
    .style("background", "rgba(255, 255, 255, 0.98)")
    .style("border", "2px solid #1b7a55")
    .style("border-radius", "8px")
    .style("padding", "12px")
    .style("font-size", "13px")
    .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")
    .style("pointer-events", "none")
    .style("z-index", "1000")
    .style("min-width", "180px");

  // All points
  svg
    .selectAll("circle.all-point")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "all-point")
    .attr("cx", (d) => xScale(d.price))
    .attr("cy", (d) => yScale(d.sis))
    .attr("r", 6)
    .attr("fill", "#d1d5db")
    .attr("opacity", 0.6)
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1).attr("r", 8);
      tooltip
        .html(
          `
        <div style="font-weight:600;color:#6b7280;margin-bottom:6px;">${
          d.name
        }</div>
        <div style="color:#4b5563;"><strong>Price:</strong> $${d.price.toFixed(
          2
        )}</div>
        <div style="color:#4b5563;"><strong>SIS:</strong> ${d.sis.toFixed(
          3
        )}</div>
        <div style="color:#4b5563;"><strong>Brands:</strong> ${d.count}</div>
        <div style="color:#9ca3af;font-size:11px;margin-top:4px;">Not on frontier</div>
      `
        )
        .style("visibility", "visible");
    })
    .on("mousemove", function (event) {
      tooltip
        .style("top", event.pageY - 10 + "px")
        .style("left", event.pageX + 10 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.6).attr("r", 6);
      tooltip.style("visibility", "hidden");
    });

  // Pareto points (highlighted)
  svg
    .selectAll("circle.pareto-point")
    .data(paretoPoints)
    .enter()
    .append("circle")
    .attr("class", "pareto-point")
    .attr("cx", (d) => xScale(d.price))
    .attr("cy", (d) => yScale(d.sis))
    .attr("r", 7)
    .attr("fill", "#f97316")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2.5)
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 9);
      tooltip
        .html(
          `
        <div style="font-weight:600;color:#1b7a55;margin-bottom:6px;">${
          d.name
        }</div>
        <div style="color:#4b5563;"><strong>Price:</strong> $${d.price.toFixed(
          2
        )}</div>
        <div style="color:#4b5563;"><strong>SIS:</strong> ${d.sis.toFixed(
          3
        )}</div>
        <div style="color:#4b5563;"><strong>Brands:</strong> ${d.count}</div>
        <div style="color:#f97316;font-weight:600;font-size:11px;margin-top:4px;">✓ Pareto-optimal</div>
      `
        )
        .style("visibility", "visible");
    })
    .on("mousemove", function (event) {
      tooltip
        .style("top", event.pageY - 10 + "px")
        .style("left", event.pageX + 10 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("r", 7);
      tooltip.style("visibility", "hidden");
    });

  // Legend
  const legend = svg
    .append("g")
    .attr("transform", `translate(${width - 140}, ${padding.top + 10})`);

  legend.append("circle").attr("cx", 0).attr("cy", 0).attr("r", 4).attr("fill", "#f97316");

  legend
    .append("text")
    .attr("x", 10)
    .attr("y", 4)
    .attr("font-size", "10px")
    .attr("fill", "#65796a")
    .text("Pareto-optimal");

  legend
    .append("circle")
    .attr("cx", 0)
    .attr("cy", 15)
    .attr("r", 4)
    .attr("fill", "#d1d5db")
    .attr("opacity", 0.5);

  legend
    .append("text")
    .attr("x", 10)
    .attr("y", 19)
    .attr("font-size", "10px")
    .attr("fill", "#65796a")
    .text("Other materials");

  return paretoPoints;
}

function renderParetoBrand() {
  const container = document.getElementById("pareto-brand");
  if (!container) return [];

  if (!PROCESSED_ROWS || PROCESSED_ROWS.length === 0) {
    container.innerHTML =
      "<p style='padding:10px;color:#65796a;font-size:12px;'>No brand data available</p>";
    return [];
  }

  // Prepare data: price vs SIS for brands
  const data = PROCESSED_ROWS.map((r) => ({
    name: r.Brand_Name || r.Brand_ID || "Unknown",
    price: r.Average_Price_USD || 0,
    sis: r.SIS || 0,
    material: r.Material_Type,
  })).filter((d) => d.price > 0 && d.sis > 0);

  if (data.length === 0) {
    container.innerHTML =
      "<p style='padding:10px;color:#65796a;font-size:12px;'>Not enough data for Pareto analysis</p>";
    return [];
  }

  // Calculate Pareto frontier
  const sorted = [...data].sort((a, b) => a.price - b.price);
  const paretoPoints = [];
  let maxSIS = -Infinity;

  sorted.forEach((point) => {
    if (point.sis >= maxSIS) {
      maxSIS = point.sis;
      paretoPoints.push(point);
    }
  });

  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const padding = { top: 30, right: 20, bottom: 40, left: 50 };

  const xScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.price) * 1.1])
    .range([padding.left, width - padding.right]);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.sis) * 1.1])
    .range([height - padding.bottom, padding.top]);

  // Axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScale).ticks(5))
    .selectAll("text")
    .style("font-size", "11px");

  svg
    .append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text")
    .style("font-size", "11px");

  // Title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "#1b7a55")
    .attr("font-size", "13px")
    .attr("font-weight", "600")
    .text("Brands — Pareto Frontier (Price vs SIS)");

  // X-axis label
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .attr("fill", "#65796a")
    .attr("font-size", "11px")
    .text("Average Price (USD)");

  // Y-axis label
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "#65796a")
    .attr("font-size", "11px")
    .text("Sustainability Index (SIS)");

  // Pareto frontier line
  if (paretoPoints.length > 1) {
    const line = d3
      .line()
      .x((d) => xScale(d.price))
      .y((d) => yScale(d.sis))
      .curve(d3.curveStepAfter);

    svg
      .append("path")
      .datum(paretoPoints)
      .attr("fill", "none")
      .attr("stroke", "#16a34a")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,3")
      .attr("d", line);
  }

  // Tooltip
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "pareto-brand-tooltip")
    .style("position", "absolute")
    .style("visibility", "hidden")
    .style("background", "rgba(255, 255, 255, 0.98)")
    .style("border", "2px solid #1b7a55")
    .style("border-radius", "8px")
    .style("padding", "12px")
    .style("font-size", "13px")
    .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")
    .style("pointer-events", "none")
    .style("z-index", "1000")
    .style("min-width", "200px");

  // All points (sample to avoid overcrowding)
  const sampleData =
    data.length > 100
      ? data.filter((_, i) => i % Math.ceil(data.length / 100) === 0)
      : data;

  svg
    .selectAll("circle.all-point")
    .data(sampleData)
    .enter()
    .append("circle")
    .attr("class", "all-point")
    .attr("cx", (d) => xScale(d.price))
    .attr("cy", (d) => yScale(d.sis))
    .attr("r", 4)
    .attr("fill", "#d1d5db")
    .attr("opacity", 0.5)
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1).attr("r", 6);
      tooltip
        .html(
          `
        <div style="font-weight:600;color:#6b7280;margin-bottom:6px;">${
          d.name
        }</div>
        <div style="color:#4b5563;"><strong>Price:</strong> $${d.price.toFixed(
          2
        )}</div>
        <div style="color:#4b5563;"><strong>SIS:</strong> ${d.sis.toFixed(
          3
        )}</div>
        <div style="color:#4b5563;"><strong>Material:</strong> ${
          d.material || "N/A"
        }</div>
        <div style="color:#9ca3af;font-size:11px;margin-top:4px;">Not on frontier</div>
      `
        )
        .style("visibility", "visible");
    })
    .on("mousemove", function (event) {
      tooltip
        .style("top", event.pageY - 10 + "px")
        .style("left", event.pageX + 10 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.5).attr("r", 4);
      tooltip.style("visibility", "hidden");
    });

  // Pareto points (highlighted)
  svg
    .selectAll("circle.pareto-point")
    .data(paretoPoints)
    .enter()
    .append("circle")
    .attr("class", "pareto-point")
    .attr("cx", (d) => xScale(d.price))
    .attr("cy", (d) => yScale(d.sis))
    .attr("r", 7)
    .attr("fill", "#16a34a")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2.5)
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 9);
      tooltip
        .html(
          `
        <div style="font-weight:600;color:#1b7a55;margin-bottom:6px;">${
          d.name
        }</div>
        <div style="color:#4b5563;"><strong>Price:</strong> $${d.price.toFixed(
          2
        )}</div>
        <div style="color:#4b5563;"><strong>SIS:</strong> ${d.sis.toFixed(
          3
        )}</div>
        <div style="color:#4b5563;"><strong>Material:</strong> ${
          d.material || "N/A"
        }</div>
        <div style="color:#16a34a;font-weight:600;font-size:11px;margin-top:4px;">✓ Pareto-optimal</div>
      `
        )
        .style("visibility", "visible");
    })
    .on("mousemove", function (event) {
      tooltip
        .style("top", event.pageY - 10 + "px")
        .style("left", event.pageX + 10 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("r", 7);
      tooltip.style("visibility", "hidden");
    });

  // Legend
  const legend = svg
    .append("g")
    .attr("transform", `translate(${width - 140}, ${padding.top + 10})`);

  legend.append("circle").attr("cx", 0).attr("cy", 0).attr("r", 4).attr("fill", "#16a34a");

  legend
    .append("text")
    .attr("x", 10)
    .attr("y", 4)
    .attr("font-size", "10px")
    .attr("fill", "#65796a")
    .text("Pareto-optimal");

  legend
    .append("circle")
    .attr("cx", 0)
    .attr("cy", 15)
    .attr("r", 4)
    .attr("fill", "#d1d5db")
    .attr("opacity", 0.4);

  legend
    .append("text")
    .attr("x", 10)
    .attr("y", 19)
    .attr("font-size", "10px")
    .attr("fill", "#65796a")
    .text("Other brands");

  return paretoPoints;
}

/* ========== RECOMMENDATIONS RENDER ========== */

function buildAndRenderRecommendations() {
  const w = parseFloat(prioritySelect.value || "0.5");
  const recs = buildRecommendations(PROCESSED_ROWS, w, 8);
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
      ? '<span class="reco-pill reco-pill-pareto">✓ Pareto-optimal</span>'
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
        <div class="reco-score">SIS: ${item.SIS.toFixed(3)}</div>
      </div>
      <div class="reco-metrics">
        <span>💰 $${item.Average_Price_USD.toFixed(2)}</span>
        <span>🌱 CO₂: ${item.Carbon_Footprint_MT.toFixed(1)} MT</span>
        <span>💧 Water: ${item.Water_Usage_Liters.toFixed(0)} L</span>
        <span>🗑️ Waste: ${item.Waste_Production_KG.toFixed(1)} kg</span>
      </div>
      <div class="reco-pill-row">
        ${paretoTag}
        <span class="reco-pill">Cert: ${item.Certifications || "N/A"}</span>
        <span class="reco-pill">Recycling: ${
          item.Recycling_Programs || "N/A"
        }</span>
      </div>
    `;
    recoList.appendChild(div);
  });
}

/* ========== EDA CHARTS ========== */

function renderEdaCharts() {
  renderEdaMaterial();
  renderEdaCountry();
  renderEdaTrend();
  renderEdaYear();
}

function computeCountryAgg(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const c = r.Country || "Unknown";
    if (!map.has(c)) {
      map.set(c, {
        Country: c,
        sumPrice: 0,
        sumSIS: 0,
        count: 0,
      });
    }
    const m = map.get(c);
    m.sumPrice += r.Average_Price_USD || 0;
    m.sumSIS += r.SIS || 0;
    m.count += 1;
  });

  return Array.from(map.values()).map((m) => ({
    Country: m.Country,
    meanPrice: m.sumPrice / m.count,
    meanSIS: m.sumSIS / m.count,
    count: m.count,
  }));
}

function computeTrendAgg(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const t = r.Market_Trend || "Unknown";
    if (!map.has(t)) {
      map.set(t, {
        Trend: t,
        sumSIS: 0,
        count: 0,
      });
    }
    const m = map.get(t);
    m.sumSIS += r.SIS || 0;
    m.count += 1;
  });

  return Array.from(map.values()).map((m) => ({
    Trend: m.Trend,
    meanSIS: m.sumSIS / m.count,
    count: m.count,
  }));
}

function computeYearAgg(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const y = r.Year || r.year || "Unknown";
    if (!map.has(y)) {
      map.set(y, {
        Year: y,
        sumPrice: 0,
        sumSIS: 0,
        count: 0,
      });
    }
    const m = map.get(y);
    m.sumPrice += r.Average_Price_USD || 0;
    m.sumSIS += r.SIS || 0;
    m.count += 1;
  });

  return Array.from(map.values())
    .map((m) => ({
      Year: m.Year,
      meanPrice: m.sumPrice / m.count,
      meanSIS: m.sumSIS / m.count,
      count: m.count,
    }))
    .sort((a, b) => a.Year - b.Year);
}

function renderEdaMaterial() {
  const container = document.getElementById("eda-material");
  const insightDiv = document.getElementById("eda-material-insight");
  if (!container) return;

  const agg = MATERIAL_AGG;
  if (!agg.length) {
    container.innerHTML = "<p style='padding:10px;'>No data</p>";
    return;
  }

  container.innerHTML = "";
  const width = container.clientWidth || 300;
  const height = container.clientHeight || 220;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const padding = { top: 20, right: 20, bottom: 60, left: 50 };

  const xScale = d3
    .scaleBand()
    .domain(agg.map((d) => d.Material_Type))
    .range([padding.left, width - padding.right])
    .padding(0.2);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(agg, (d) => Math.max(d.meanPrice, d.meanSIS * 100))])
    .range([height - padding.bottom, padding.top]);

  // Axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end")
    .style("font-size", "9px");

  svg
    .append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text")
    .style("font-size", "10px");

  // Bars
  svg
    .selectAll("rect.price-bar")
    .data(agg)
    .enter()
    .append("rect")
    .attr("class", "price-bar")
    .attr("x", (d) => xScale(d.Material_Type))
    .attr("y", (d) => yScale(d.meanPrice))
    .attr("width", xScale.bandwidth() / 2)
    .attr("height", (d) => height - padding.bottom - yScale(d.meanPrice))
    .attr("fill", "#3b82f6")
    .attr("opacity", 0.7);

  svg
    .selectAll("rect.sis-bar")
    .data(agg)
    .enter()
    .append("rect")
    .attr("class", "sis-bar")
    .attr("x", (d) => xScale(d.Material_Type) + xScale.bandwidth() / 2)
    .attr("y", (d) => yScale(d.meanSIS * 100))
    .attr("width", xScale.bandwidth() / 2)
    .attr("height", (d) => height - padding.bottom - yScale(d.meanSIS * 100))
    .attr("fill", "#22c55e")
    .attr("opacity", 0.7);

  // Insight
  if (insightDiv) {
    const topSIS = [...agg].sort((a, b) => b.meanSIS - a.meanSIS)[0];
    insightDiv.innerHTML = `<strong>${topSIS.Material_Type}</strong> has the highest avg SIS (${topSIS.meanSIS.toFixed(3)}).`;
  }
}

function renderEdaCountry() {
  const container = document.getElementById("eda-country");
  const insightDiv = document.getElementById("eda-country-insight");
  if (!container) return;

  const agg = computeCountryAgg(PROCESSED_ROWS);
  if (!agg.length) {
    container.innerHTML = "<p style='padding:10px;'>No data</p>";
    return;
  }

  container.innerHTML = "";
  const width = container.clientWidth || 300;
  const height = container.clientHeight || 220;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const padding = { top: 20, right: 20, bottom: 60, left: 50 };

  const xScale = d3
    .scaleBand()
    .domain(agg.map((d) => d.Country))
    .range([padding.left, width - padding.right])
    .padding(0.2);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(agg, (d) => Math.max(d.meanPrice, d.meanSIS * 100))])
    .range([height - padding.bottom, padding.top]);

  // Axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end")
    .style("font-size", "9px");

  svg
    .append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text")
    .style("font-size", "10px");

  // Bars
  svg
    .selectAll("rect.price-bar")
    .data(agg)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.Country))
    .attr("y", (d) => yScale(d.meanPrice))
    .attr("width", xScale.bandwidth() / 2)
    .attr("height", (d) => height - padding.bottom - yScale(d.meanPrice))
    .attr("fill", "#3b82f6")
    .attr("opacity", 0.7);

  svg
    .selectAll("rect.sis-bar")
    .data(agg)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.Country) + xScale.bandwidth() / 2)
    .attr("y", (d) => yScale(d.meanSIS * 100))
    .attr("width", xScale.bandwidth() / 2)
    .attr("height", (d) => height - padding.bottom - yScale(d.meanSIS * 100))
    .attr("fill", "#22c55e")
    .attr("opacity", 0.7);

  // Insight
  if (insightDiv) {
    const topSIS = [...agg].sort((a, b) => b.meanSIS - a.meanSIS)[0];
    insightDiv.innerHTML = `<strong>${topSIS.Country}</strong> leads with avg SIS of ${topSIS.meanSIS.toFixed(3)}.`;
  }
}

function renderEdaTrend() {
  const container = document.getElementById("eda-trend");
  const insightDiv = document.getElementById("eda-trend-insight");
  if (!container) return;

  const agg = computeTrendAgg(PROCESSED_ROWS);
  if (!agg.length) {
    container.innerHTML = "<p style='padding:10px;'>No data</p>";
    return;
  }

  container.innerHTML = "";
  const width = container.clientWidth || 300;
  const height = container.clientHeight || 220;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const padding = { top: 20, right: 20, bottom: 60, left: 50 };

  const xScale = d3
    .scaleBand()
    .domain(agg.map((d) => d.Trend))
    .range([padding.left, width - padding.right])
    .padding(0.3);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(agg, (d) => d.count)])
    .range([height - padding.bottom, padding.top]);

  // Axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end")
    .style("font-size", "9px");

  svg
    .append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text")
    .style("font-size", "10px");

  // Bars
  svg
    .selectAll("rect")
    .data(agg)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.Trend))
    .attr("y", (d) => yScale(d.count))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - padding.bottom - yScale(d.count))
    .attr("fill", "#a3e635")
    .attr("opacity", 0.8);

  // Insight
  if (insightDiv) {
    const topCount = [...agg].sort((a, b) => b.count - a.count)[0];
    insightDiv.innerHTML = `<strong>${topCount.Trend}</strong> is the most common trend (${topCount.count} brands).`;
  }
}

function renderEdaYear() {
  const container = document.getElementById("eda-year");
  const insightDiv = document.getElementById("eda-year-insight");
  if (!container) return;

  const agg = computeYearAgg(PROCESSED_ROWS);
  if (!agg.length) {
    container.innerHTML = "<p style='padding:10px;'>No data</p>";
    return;
  }

  container.innerHTML = "";
  const width = container.clientWidth || 300;
  const height = container.clientHeight || 220;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const padding = { top: 20, right: 20, bottom: 40, left: 50 };

  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(agg, (d) => +d.Year))
    .range([padding.left, width - padding.right]);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(agg, (d) => d.meanSIS)])
    .range([height - padding.bottom, padding.top]);

  // Axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.format("d")))
    .selectAll("text")
    .style("font-size", "10px");

  svg
    .append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text")
    .style("font-size", "10px");

  // Line
  const line = d3
    .line()
    .x((d) => xScale(+d.Year))
    .y((d) => yScale(d.meanSIS))
    .curve(d3.curveMonotoneX);

  svg
    .append("path")
    .datum(agg)
    .attr("fill", "none")
    .attr("stroke", "#22c55e")
    .attr("stroke-width", 2)
    .attr("d", line);

  // Points
  svg
    .selectAll("circle")
    .data(agg)
    .enter()
    .append("circle")
    .attr("cx", (d) => xScale(+d.Year))
    .attr("cy", (d) => yScale(d.meanSIS))
    .attr("r", 4)
    .attr("fill", "#22c55e");

  // Insight
  if (insightDiv) {
    const latest = agg[agg.length - 1];
    insightDiv.innerHTML = `Latest year (${latest.Year}) shows avg SIS of ${latest.meanSIS.toFixed(3)}.`;
  }
}
