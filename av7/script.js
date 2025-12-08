/* script.js - Scientific Version (Refactored for UI/UX)
   UI rendering and visualization for SustainGraph
   Implements scientific methodology display with enhanced UI/UX
*/

/* ========== GLOBAL STATE ========== */

let RAW_ROWS = [];
let PROCESSED_ROWS = [];
let STATS = null;
let MATERIAL_AGG = [];
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
const clusterLegend = document.getElementById("cluster-legend");
const clusterInsightDiv = document.getElementById("cluster-insight");
const recoList = document.getElementById("recommendations-list");

const paretoInsightDiv = document.getElementById("pareto-insight");

/* ========== TOOLTIP HELPER (Unified Professional Style) ========== */

function createTooltip(className) {
  return d3
    .select("body")
    .append("div")
    .attr("class", `tooltip-custom ${className}`)
    .style("visibility", "hidden");
}

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
    "https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/av7/Kaggle_sust_dataset.csv";

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
    clusterAndRenderMaterials(); // This now handles K-Means and the new Section 5
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
  // Remove existing entropy card if present
  const existingCard = document.querySelector(".entropy-info-card");
  if (existingCard) existingCard.remove();

  if (kpiCard.nextElementSibling) {
    kpiCard.parentElement.insertBefore(infoDiv, kpiCard.nextElementSibling);
  } else {
    kpiCard.parentElement.appendChild(infoDiv);
  }
}

/* ========== MATERIAL CLUSTER VALIDATION + SCATTER PLOT (New Section 5) ========== */

function clusterAndRenderMaterials() {
  const agg = MATERIAL_AGG;
  if (!agg.length) {
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

  // 3) Render the combined validation section
  renderClusteringValidation(bestK);
}

function renderClusteringValidation(kUsed) {
  renderElbowChart();
  renderClusterScatter(kUsed);
  renderClusterLegend(kUsed);
  renderClusterInsight(kUsed);
}

function renderClusterInsight(kUsed) {
  if (!clusterInsightDiv) return;
  const clusterCounts = MATERIAL_AGG.reduce((acc, m) => {
    acc[m.cluster] = (acc[m.cluster] || 0) + 1;
    return acc;
  }, {});

  const largestCluster = Object.entries(clusterCounts).sort(
    ([, a], [, b]) => b - a
  )[0];

  clusterInsightDiv.innerHTML = `
    <p><strong>K-Means Clustering (Validated):</strong> Materials were grouped into <strong>${kUsed} clusters</strong> using the Elbow Method to find the optimal k. This is data-driven, not arbitrary.</p>
    <p><strong>Insight:</strong> Cluster ${largestCluster[0]} is the largest with ${largestCluster[1]} materials. The scatter plot visualizes the trade-off between Environmental Score (X) and Policy Score (Y).</p>
    <p><strong>Recommendation:</strong> Materials in the **Low-Impact Cluster** (typically top-left) offer the best balance of high environmental and policy scores.</p>
  `;
}

function renderClusterScatter(kUsed) {
  const container = document.getElementById("cluster-scatter");
  if (!container) return;
  container.innerHTML = "";

  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;

  const data = MATERIAL_AGG.map((m) => ({
    name: m.Material_Type,
    x: m.meanEnvNorm, // Normalized Environmental Score
    y: m.meanPolicyNorm, // Normalized Policy Score
    cluster: m.cluster,
    meanSIS: m.meanSIS,
    count: m.count,
  }));

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const padding = { top: 30, right: 20, bottom: 40, left: 50 };

  const xScale = d3
    .scaleLinear()
    .domain([0, 1])
    .range([padding.left, width - padding.right]);
  const yScale = d3
    .scaleLinear()
    .domain([0, 1])
    .range([height - padding.bottom, padding.top]);

  const colorScale = d3
    .scaleOrdinal()
    .domain(d3.range(kUsed))
    .range(["var(--cluster-low)", "var(--cluster-mid)", "var(--cluster-high)", "#16a34a", "#84cc16", "#fbbf24"]);

  // Axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScale).ticks(4))
    .selectAll("text")
    .style("font-size", "10px");

  svg
    .append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale).ticks(4))
    .selectAll("text")
    .style("font-size", "10px");

  // Title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--accent-dark)")
    .attr("font-size", "13px")
    .attr("font-weight", "600")
    .text("Material Clusters (Env Score vs Policy Score)");

  // X-axis label
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--text-muted)")
    .attr("font-size", "11px")
    .text("Environmental Score (Normalized)");

  // Y-axis label
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--text-muted)")
    .attr("font-size", "11px")
    .text("Policy Score (Normalized)");

  // Tooltip
  const tooltip = createTooltip("cluster-tooltip");

  // Points
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
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Cluster:</strong> <span class="tooltip-cluster-${d.cluster}">${d.cluster}</span></div>
          <div><strong>Env Score:</strong> ${d.x.toFixed(3)}</div>
          <div><strong>Policy Score:</strong> ${d.y.toFixed(3)}</div>
          <div><strong>SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
          <div><strong>Brands:</strong> ${d.count}</div>
        </div>
        <div class="tooltip-footer">High Env Score = Low Impact</div>
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
    "Low-Impact (High Env & Policy)",
    "Medium-Impact",
    "High-Impact (Low Env & Policy)",
    "Additional cluster 4",
    "Additional cluster 5",
    "Additional cluster 6",
  ];
  const colors = [
    "var(--cluster-low)",
    "var(--cluster-mid)",
    "var(--cluster-high)",
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

function renderElbowChart() {
  const container = document.getElementById("elbow-chart");
  if (!container || !ELBOW_INFO) return;

  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;

  const data = ELBOW_INFO.inertias;
  const bestK = ELBOW_INFO.bestK;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const padding = { top: 30, right: 20, bottom: 40, left: 50 };

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
    .style("font-size", "10px");

  svg
    .append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text")
    .style("font-size", "10px");

  // Title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--accent-dark)")
    .attr("font-size", "13px")
    .attr("font-weight", "600")
    .text("Elbow Method — Inertia vs k");

  // X-axis label
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--text-muted)")
    .attr("font-size", "11px")
    .text("Number of Clusters (k)");

  // Y-axis label
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--text-muted)")
    .attr("font-size", "11px")
    .text("Inertia (WCSS)");

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
    .attr("stroke", "var(--accent)")
    .attr("stroke-width", 2.5)
    .attr("d", line);

  // Tooltip
  const tooltip = createTooltip("elbow-tooltip");

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
    .attr("fill", (d) => (d.k === bestK ? "var(--cluster-high)" : "var(--accent)"))
    .attr("stroke", "#fff")
    .attr("stroke-width", 2.5)
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 9);
      tooltip
        .html(
          `
        <div class="tooltip-header">k = ${d.k}</div>
        <div class="tooltip-body">
          <div><strong>Inertia (WCSS):</strong> ${d.inertia.toFixed(2)}</div>
        </div>
        <div class="tooltip-footer" style="color:${d.k === bestK ? 'var(--cluster-high)' : 'var(--text-muted)'}">
          ${d.k === bestK ? '✓ Optimal Elbow Point' : 'Not optimal'}
        </div>
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
      d3.select(this).attr("r", (d) => (d.k === bestK ? 7 : 5));
      tooltip.style("visibility", "hidden");
    });
}

/* ========== PARETO FRONTIER CHARTS (Section 6) ========== */

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
      "<p style='padding:10px;color:var(--text-muted);font-size:12px;'>No material data available</p>";
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
      "<p style='padding:10px;color:var(--text-muted);font-size:12px;'>Not enough data for Pareto analysis</p>";
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
    .style("font-size", "10px");

  svg
    .append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text")
    .style("font-size", "10px");

  // Title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--accent-dark)")
    .attr("font-size", "13px")
    .attr("font-weight", "600")
    .text("Materials — Pareto Frontier (Price vs SIS)");

  // X-axis label
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--text-muted)")
    .attr("font-size", "11px")
    .text("Average Price (USD)");

  // Y-axis label
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--text-muted)")
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
      .attr("stroke", "var(--cluster-high)") // Use high impact color for frontier
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,3")
      .attr("d", line);
  }

  // Tooltip
  const tooltip = createTooltip("pareto-material-tooltip");

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
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.sis.toFixed(3)}</div>
          <div><strong>Brands:</strong> ${d.count}</div>
        </div>
        <div class="tooltip-footer" style="color:var(--text-muted);">Not on frontier</div>
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
    .attr("fill", "var(--cluster-high)")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2.5)
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 9);
      tooltip
        .html(
          `
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.sis.toFixed(3)}</div>
          <div><strong>Brands:</strong> ${d.count}</div>
        </div>
        <div class="tooltip-footer tooltip-pareto">✓ Pareto-optimal</div>
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

  return paretoPoints;
}

function renderParetoBrand() {
  const container = document.getElementById("pareto-brand");
  if (!container) return [];

  if (!PROCESSED_ROWS || PROCESSED_ROWS.length === 0) {
    container.innerHTML =
      "<p style='padding:10px;color:var(--text-muted);font-size:12px;'>No brand data available</p>";
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
      "<p style='padding:10px;color:var(--text-muted);font-size:12px;'>Not enough data for Pareto analysis</p>";
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
    .style("font-size", "10px");

  svg
    .append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll("text")
    .style("font-size", "10px");

  // Title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--accent-dark)")
    .attr("font-size", "13px")
    .attr("font-weight", "600")
    .text("Brands — Pareto Frontier (Price vs SIS)");

  // X-axis label
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--text-muted)")
    .attr("font-size", "11px")
    .text("Average Price (USD)");

  // Y-axis label
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--text-muted)")
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
      .attr("stroke", "var(--cluster-low)") // Use low impact color for frontier
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,3")
      .attr("d", line);
  }

  // Tooltip
  const tooltip = createTooltip("pareto-brand-tooltip");

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
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.sis.toFixed(3)}</div>
          <div><strong>Material:</strong> ${d.material || "N/A"}</div>
        </div>
        <div class="tooltip-footer" style="color:var(--text-muted);">Not on frontier</div>
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
    .attr("fill", "var(--cluster-low)")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2.5)
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 9);
      tooltip
        .html(
          `
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.sis.toFixed(3)}</div>
          <div><strong>Material:</strong> ${d.material || "N/A"}</div>
        </div>
        <div class="tooltip-footer tooltip-pareto">✓ Pareto-optimal</div>
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

  return paretoPoints;
}

/* ========== RECOMMENDATIONS RENDER (Section 7) ========== */

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

/* ========== EDA CHARTS (Section 4) - IMPROVED TOOLTIPS ========== */

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

  // Tooltip
  const tooltip = createTooltip("eda-material-tooltip");

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
    .attr("opacity", 0.7)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1);
      tooltip
        .html(
          `
        <div class="tooltip-header">${d.Material_Type}</div>
        <div class="tooltip-body">
          <div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div>
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
          <div><strong>Brands:</strong> ${d.count}</div>
        </div>
        <div class="tooltip-footer" style="color:#3b82f6;">Price (Blue Bar)</div>
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
      d3.select(this).attr("opacity", 0.7);
      tooltip.style("visibility", "hidden");
    });

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
    .attr("fill", "var(--accent)")
    .attr("opacity", 0.7)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1);
      tooltip
        .html(
          `
        <div class="tooltip-header">${d.Material_Type}</div>
        <div class="tooltip-body">
          <div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div>
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
          <div><strong>Brands:</strong> ${d.count}</div>
        </div>
        <div class="tooltip-footer" style="color:var(--accent);">SIS (Green Bar)</div>
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
      d3.select(this).attr("opacity", 0.7);
      tooltip.style("visibility", "hidden");
    });

  // Insight
  if (insightDiv) {
    const topSIS = [...agg].sort((a, b) => b.meanSIS - a.meanSIS)[0];
    const lowestSIS = [...agg].sort((a, b) => a.meanSIS - b.meanSIS)[0];
    insightDiv.innerHTML = `
      <p><strong>Insight:</strong> Compares average price (blue) and average SIS (green) for each material.</p>
      <p><strong>Highest SIS:</strong> <strong>${topSIS.Material_Type}</strong> has the highest avg SIS (${topSIS.meanSIS.toFixed(3)}).</p>
      <p><strong>Lowest SIS:</strong> <strong>${lowestSIS.Material_Type}</strong> has the lowest avg SIS (${lowestSIS.meanSIS.toFixed(3)}).</p>
    `;
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

  // Tooltip
  const tooltip = createTooltip("eda-country-tooltip");

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
    .attr("opacity", 0.7)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1);
      tooltip
        .html(
          `
        <div class="tooltip-header">${d.Country}</div>
        <div class="tooltip-body">
          <div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div>
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
          <div><strong>Brands:</strong> ${d.count}</div>
        </div>
        <div class="tooltip-footer" style="color:#3b82f6;">Price (Blue Bar)</div>
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
      d3.select(this).attr("opacity", 0.7);
      tooltip.style("visibility", "hidden");
    });

  svg
    .selectAll("rect.sis-bar")
    .data(agg)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.Country) + xScale.bandwidth() / 2)
    .attr("y", (d) => yScale(d.meanSIS * 100))
    .attr("width", xScale.bandwidth() / 2)
    .attr("height", (d) => height - padding.bottom - yScale(d.meanSIS * 100))
    .attr("fill", "var(--accent)")
    .attr("opacity", 0.7)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1);
      tooltip
        .html(
          `
        <div class="tooltip-header">${d.Country}</div>
        <div class="tooltip-body">
          <div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div>
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
          <div><strong>Brands:</strong> ${d.count}</div>
        </div>
        <div class="tooltip-footer" style="color:var(--accent);">SIS (Green Bar)</div>
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
      d3.select(this).attr("opacity", 0.7);
      tooltip.style("visibility", "hidden");
    });

  // Insight
  if (insightDiv) {
    const topSIS = [...agg].sort((a, b) => b.meanSIS - a.meanSIS)[0];
    const topPrice = [...agg].sort((a, b) => b.meanPrice - a.meanPrice)[0];
    insightDiv.innerHTML = `
      <p><strong>Insight:</strong> Compares average price (blue) and average SIS (green) by country.</p>
      <p><strong>Highest SIS:</strong> <strong>${topSIS.Country}</strong> leads with avg SIS of ${topSIS.meanSIS.toFixed(3)}.</p>
      <p><strong>Highest Price:</strong> Brands from <strong>${topPrice.Country}</strong> have the highest average price ($${topPrice.meanPrice.toFixed(2)}).</p>
    `;
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

  const yScaleCount = d3
    .scaleLinear()
    .domain([0, d3.max(agg, (d) => d.count)])
    .range([height - padding.bottom, padding.top]);

  const yScaleSIS = d3
    .scaleLinear()
    .domain([0, d3.max(agg, (d) => d.meanSIS)])
    .range([height - padding.bottom, padding.top]);

  const xScale = d3
    .scaleBand()
    .domain(agg.map((d) => d.Trend))
    .range([padding.left, width - padding.right])
    .padding(0.3);

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
    .call(d3.axisLeft(yScaleCount).ticks(5))
    .selectAll("text")
    .style("font-size", "10px");

  // Tooltip
  const tooltip = createTooltip("eda-trend-tooltip");

  // Bars (Count)
  svg
    .selectAll("rect")
    .data(agg)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.Trend))
    .attr("y", (d) => yScaleCount(d.count))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - padding.bottom - yScaleCount(d.count))
    .attr("fill", "#a3e635")
    .attr("opacity", 0.8)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1);
      tooltip
        .html(
          `
        <div class="tooltip-header">${d.Trend}</div>
        <div class="tooltip-body">
          <div><strong>Brand Count:</strong> ${d.count}</div>
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
        </div>
        <div class="tooltip-footer" style="color:#a3e635;">Brand Count (Bar)</div>
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
      d3.select(this).attr("opacity", 0.8);
      tooltip.style("visibility", "hidden");
    });

  // Line (Mean SIS)
  const line = d3
    .line()
    .x((d) => xScale(d.Trend) + xScale.bandwidth() / 2)
    .y((d) => yScaleSIS(d.meanSIS));

  svg
    .append("path")
    .datum(agg)
    .attr("fill", "none")
    .attr("stroke", "var(--cluster-high)")
    .attr("stroke-width", 2)
    .attr("d", line);

  // Insight
  if (insightDiv) {
    const topCount = [...agg].sort((a, b) => b.count - a.count)[0];
    const topSIS = [...agg].sort((a, b) => b.meanSIS - a.meanSIS)[0];
    insightDiv.innerHTML = `
      <p><strong>Insight:</strong> Compares brand count (bar) and average SIS (red line) by market trend.</p>
      <p><strong>Most Common:</strong> <strong>${topCount.Trend}</strong> is the most common trend (${topCount.count} brands).</p>
      <p><strong>Highest SIS:</strong> The <strong>${topSIS.Trend}</strong> trend has the highest average SIS (${topSIS.meanSIS.toFixed(3)}).</p>
    `;
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

  // Tooltip
  const tooltip = createTooltip("eda-year-tooltip");

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
    .attr("stroke", "var(--accent)")
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
    .attr("fill", "var(--accent)")
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 6);
      tooltip
        .html(
          `
        <div class="tooltip-header">Year ${d.Year}</div>
        <div class="tooltip-body">
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
          <div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div>
          <div><strong>Brands:</strong> ${d.count}</div>
        </div>
        <div class="tooltip-footer" style="color:var(--accent);">SIS Trend (Line)</div>
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
      d3.select(this).attr("r", 4);
      tooltip.style("visibility", "hidden");
    });

  // Insight
  if (insightDiv) {
    const latest = agg[agg.length - 1];
    const oldest = agg[0];
    const trend = latest.meanSIS > oldest.meanSIS ? "increasing" : "decreasing";
    insightDiv.innerHTML = `
      <p><strong>Insight:</strong> Tracks the average SIS over the years.</p>
      <p><strong>Trend:</strong> The average SIS is generally <strong>${trend}</strong> from ${oldest.Year} (${oldest.meanSIS.toFixed(3)}) to ${latest.Year} (${latest.meanSIS.toFixed(3)}).</p>
      <p><strong>Conclusion:</strong> Sustainability efforts in the industry appear to be ${trend}.</p>
    `;
  }
}
