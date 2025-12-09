/*
   script.js - Final Version
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
// const prioritySelect = document.getElementById("priority"); // Removed as per user request
const btnRun = document.getElementById("run-pipeline");

const kpiRow = document.getElementById("kpi-row");
const clusterLegend = document.getElementById("cluster-legend");
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
  parseCsv(file);
});

loadSampleBtn.addEventListener("click", () => {
  loadStatus.textContent = "Loading sample data...";
  fetch("https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/hi1/Kaggle_sust_dataset.csv")
    .then((res) => res.text())
    .then((csv) => {
      const file = new File([csv], "sample.csv", { type: "text/csv" });
      parseCsv(file);
    });
});

autoUploadBtn.addEventListener("click", () => {
  loadStatus.textContent = "Loading sample data...";
  fetch("https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/hi1/Kaggle_sust_dataset.csv")
    .then((res) => res.text())
    .then((csv) => {
      const file = new File([csv], "sample.csv", { type: "text/csv" });
      parseCsv(file, true);
    });
});

function parseCsv(file, autoRun = false) {
  loadStatus.textContent = `Loading ${file.name}...`;
  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (results) => {
      RAW_ROWS = results.data;
      loadStatus.textContent = `Loaded ${RAW_ROWS.length} rows from ${file.name}. Ready to run analysis.`;
      populateFilters(RAW_ROWS);
      if (autoRun) {
        btnRun.click();
      }
    },
    error: (err) => {
      loadStatus.textContent = `Error: ${err.message}`;
    },
  });
}

/* ========== FILTER POPULATION ========== */

function populateFilters(rows) {
  const countries = [...new Set(rows.map((r) => r.Country))].filter(Boolean);
  const materials = [...new Set(rows.map((r) => r.Material_Type))].filter(Boolean);
  const years = [...new Set(rows.map((r) => r.Year))].filter(Boolean);
  const certs = [...new Set(rows.map((r) => r.Certifications))].filter(Boolean);
  const trends = [...new Set(rows.map((r) => r.Market_Trend))].filter(Boolean);

  const populate = (select, items) => {
    select.innerHTML = '<option value="">All</option>';
    items.sort().forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      select.appendChild(opt);
    });
  };

  populate(countryFilter, countries);
  populate(materialFilter, materials);
  populate(yearFilter, years);
  populate(certFilter, certs);
  populate(trendFilter, trends);
}

/* ========== MAIN ANALYSIS PIPELINE ========== */

btnRun.addEventListener("click", () => {
  const filtered = applyFilters();
  if (!filtered.length) {
    alert("No data matches the current filters.");
    return;
  }

  // 1) Process data with Entropy, SIS, etc.
  // processData is now a global function defined in app.js
  const { rowsWithSIS, stats, materialAgg, elbowInfo, entropyWeights } = processData(filtered);
  PROCESSED_ROWS = rowsWithSIS;
  STATS = stats;
  MATERIAL_AGG = materialAgg;
  ELBOW_INFO = elbowInfo;
  ENTROPY_WEIGHTS = entropyWeights;

  // 2) Render all UI components
  renderKPIs();
  clusterAndRenderMaterials(); // This now handles K-Means and the new Section 5
  buildAndRenderRecommendations();
  renderEdaCharts();
});

function applyFilters() {
  return RAW_ROWS.filter((r) => {
    return (
      (!countryFilter.value || r.Country === countryFilter.value) &&
      (!materialFilter.value || r.Material_Type === materialFilter.value) &&
      (!yearFilter.value || r.Year == yearFilter.value) &&
      (!certFilter.value || r.Certifications === certFilter.value) &&
      (!trendFilter.value || r.Market_Trend === trendFilter.value)
    );
  });
}

/* ========== KPI & ENTROPY RENDER (Section 3) ========== */

function renderKPIs() {
  if (!STATS || !ENTROPY_WEIGHTS) return;
  const envDiversity = (1 - ENTROPY_WEIGHTS.envEntropy).toFixed(4);
  const policyDiversity = (1 - ENTROPY_WEIGHTS.policyEntropy).toFixed(4);
  
  kpiRow.innerHTML = `
    <div class="kpi-item">
      <div class="kpi-value">${STATS.avgSIS.toFixed(3)}</div>
      <div class="kpi-label">Avg Sustainability Index (SIS)</div>
      <div class="kpi-sublabel">Entropy-weighted score</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-value">${STATS.avgCarbon.toFixed(1)} MT</div>
      <div class="kpi-label">Avg Carbon Footprint</div>
      <div class="kpi-sublabel">Brand-level aggregated</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-value">${STATS.avgWater.toFixed(0)} L</div>
      <div class="kpi-label">Avg Water Usage</div>
      <div class="kpi-sublabel">Production water intensity</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-value">${STATS.avgWaste.toFixed(1)} kg</div>
      <div class="kpi-label">Avg Waste Production</div>
      <div class="kpi-sublabel">Solid waste per production</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-value">$${STATS.avgPrice.toFixed(2)}</div>
      <div class="kpi-label">Avg Price</div>
      <div class="kpi-sublabel">Average price in USD</div>
    </div>
    <div class="kpi-item info-card" style="grid-column: span 2;">
        <div class="kpi-label">📊 Entropy Weight Method Results</div>
        <div class="info-card-body">
            <div><strong>Environmental Weight:</strong> <span>${ENTROPY_WEIGHTS.env.toFixed(4)}</span> (Entropy: ${ENTROPY_WEIGHTS.envEntropy.toFixed(4)})</div>
            <div><strong>Policy Weight:</strong> <span>${ENTROPY_WEIGHTS.policy.toFixed(4)}</span> (Entropy: ${ENTROPY_WEIGHTS.policyEntropy.toFixed(4)})</div>
        </div>
        <div class="info-card-footer">
            Objective weights derived from data variance. Higher diversity (1 - Entropy) = higher weight.
        </div>
    </div>
  `;
}

/* ========== K-MEANS CLUSTERING (Section 5) ========== */

function clusterAndRenderMaterials() {
  if (!MATERIAL_AGG || !ELBOW_INFO) return;
  const bestK = ELBOW_INFO.bestK;

  // The clustering logic is now handled inside processData in app.js
  // We just need to render the results here.

  // 2) Render the combined validation section
  renderClusteringValidation(bestK);
}

function renderClusteringValidation(kUsed) {
  renderElbowChart(kUsed);
  renderElbowInsight(kUsed);
  renderClusterScatter(kUsed);
  renderClusterLegend(kUsed);
  renderClusterScatterInsight(kUsed);
}

function renderElbowInsight(kUsed) {
  const insightDiv = document.getElementById("elbow-insight");
  if (!insightDiv) return;
  insightDiv.innerHTML = `
    <p><strong>Elbow Method Validation:</strong> The optimal number of clusters is <strong>k=${kUsed}</strong>, determined by analyzing the rate of change in inertia (WCSS). This validates the clustering approach and ensures the chosen k is data-driven, not arbitrary.</p>
    <p><strong>Interpretation:</strong> The elbow point indicates the best trade-off between minimizing within-cluster variance and minimizing the number of clusters.</p>
  `;
}

function renderClusterScatterInsight(kUsed) {
  const insightDiv = document.getElementById("cluster-scatter-insight");
  if (!insightDiv) return;
  
  if (MATERIAL_AGG.length === 0) {
      insightDiv.innerHTML = `<p>Không có dữ liệu để phân tích cụm.</p>`;
      return;
  }
  
  // 1. Calculate cluster statistics (count, mean SIS)
  const clusterStats = MATERIAL_AGG.reduce((acc, m) => {
    const cluster = m.cluster;
    acc[cluster] = acc[cluster] || { count: 0, sumSIS: 0, materials: [] };
    acc[cluster].count += 1;
    acc[cluster].sumSIS += m.meanSIS;
    acc[cluster].materials.push(m.Material_Type);
    return acc;
  }, {});

  const meanSISByCluster = Object.entries(clusterStats).map(([cluster, data]) => ({
      cluster: parseInt(cluster),
      meanSIS: data.sumSIS / data.count,
      count: data.count,
      materials: data.materials
  })).sort((a, b) => b.meanSIS - a.meanSIS); // Sort by SIS descending

  // 2. Assign descriptive names based on SIS ranking
  const clusterNames = {};
  if (meanSISByCluster.length > 0) {
      clusterNames[meanSISByCluster[0].cluster] = "High-Impact (Most Sustainable)";
  }
  if (meanSISByCluster.length > 1) {
      clusterNames[meanSISByCluster[meanSISByCluster.length - 1].cluster] = "Low-Impact (Least Sustainable)";
  }
  if (meanSISByCluster.length > 2) {
      for (let i = 1; i < meanSISByCluster.length - 1; i++) {
          clusterNames[meanSISByCluster[i].cluster] = `Medium-Impact ${i}`;
      }
  }
  
  const bestCluster = meanSISByCluster[0];
  const worstCluster = meanSISByCluster[meanSISByCluster.length - 1];
  
  const largestCluster = meanSISByCluster.sort((a, b) => b.count - a.count)[0];
  
  const bestClusterName = clusterNames[bestCluster.cluster] || `Cluster ${bestCluster.cluster}`;
  const worstClusterName = clusterNames[worstCluster.cluster] || `Cluster ${worstCluster.cluster}`;

  insightDiv.innerHTML = `
    <p><strong>Clustering Visualization:</strong> Materials are grouped into <strong>${kUsed} clusters</strong> (validated by Elbow Method). The plot visualizes the trade-off between Environmental Score (X) and Policy Score (Y).</p>
    <p><strong>Insight:</strong> 
        The **${bestClusterName}** (Cluster ${bestCluster.cluster}) has the highest average SIS (${bestCluster.meanSIS.toFixed(3)}), indicating the most sustainable materials.
        The **${worstClusterName}** (Cluster ${worstCluster.cluster}) has the lowest average SIS (${worstCluster.meanSIS.toFixed(3)}).
        The largest cluster is **Cluster ${largestCluster.cluster}** with ${largestCluster.count} materials.
    </p>
    <p><strong>Recommendation:</strong> Focus on materials in the **${bestClusterName}** for the most sustainable sourcing options.</p>
  `;
}

function renderElbowChart(kUsed) {
  const container = document.getElementById("elbow-chart");
  if (!container || !ELBOW_INFO) return;
  container.innerHTML = "";

  const data = ELBOW_INFO.elbowData;
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };

  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleLinear().domain([1, data.length]).range([padding.left, width - padding.right]);
  const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.inertia) * 1.1]).range([height - padding.bottom, padding.top]);

  // Axes
  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale).ticks(data.length));
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScale).ticks(5));

  // Labels
  svg.append("text").attr("x", width / 2).attr("y", height - 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Number of Clusters (k)");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Inertia (WCSS)");

  // Line
  const line = d3.line().x(d => xScale(d.k)).y(d => yScale(d.inertia));
  svg.append("path").datum(data).attr("fill", "none").attr("stroke", "var(--accent)").attr("stroke-width", 2).attr("d", line);

  // Points
  const tooltip = createTooltip("elbow-tooltip");
  svg.selectAll("circle").data(data).enter().append("circle")
    .attr("cx", d => xScale(d.k))
    .attr("cy", d => yScale(d.inertia))
    .attr("r", d => (d.k === kUsed ? 8 : 5))
    .attr("fill", d => (d.k === kUsed ? "var(--cluster-high)" : "var(--accent)"))
    .attr("stroke", d => (d.k === kUsed ? "#fff" : "none"))
    .attr("stroke-width", d => (d.k === kUsed ? 2 : 0))
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", d => (d.k === kUsed ? 10 : 7));
      tooltip.html(`<strong>k = ${d.k}</strong><br>Inertia: ${d.inertia.toFixed(2)}`).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function (event, d) {
      d3.select(this).attr("r", d => (d.k === kUsed ? 8 : 5));
      tooltip.style("visibility", "hidden");
    });
}

function renderClusterScatter(kUsed) {
  const container = document.getElementById("cluster-scatter");
  if (!container || !MATERIAL_AGG) return;
  container.innerHTML = "";

  const data = MATERIAL_AGG;
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };

  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleLinear().domain([0, 1]).range([padding.left, width - padding.right]);
  const yScale = d3.scaleLinear().domain([0, 1]).range([height - padding.bottom, padding.top]);

  // Axes
  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale));
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScale));

  // Labels
  svg.append("text").attr("x", width / 2).attr("y", height - 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Environmental Score (Normalized)");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Policy Score (Normalized)");

  // Color Scale
  const colorScale = d3.scaleOrdinal(d3.schemeSet2).domain([...Array(kUsed).keys()]);

  // Tooltip
  const tooltip = createTooltip("scatter-tooltip");

  // Points
  svg.selectAll("circle").data(data).enter().append("circle")
    .attr("cx", d => xScale(d.envScoreNorm))
    .attr("cy", d => yScale(d.policyScoreNorm))
    .attr("r", d => 8 + Math.min(8, d.count / 5)) // Increased base size
    .attr("fill", d => colorScale(d.cluster))
    .attr("stroke", "#fff") // Added white stroke for better visibility
    .attr("stroke-width", 2)
    .attr("opacity", 0.9)
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1).attr("r", 12 + Math.min(8, d.count / 5));
      tooltip.html(`
        <div class="tooltip-header">${d.Material_Type}</div>
        <div class="tooltip-body">
          <div><strong>Cluster:</strong> ${d.cluster}</div>
          <div><strong>Env Score:</strong> ${d.envScoreNorm.toFixed(3)}</div>
          <div><strong>Policy Score:</strong> ${d.policyScoreNorm.toFixed(3)}</div>
          <div><strong>Brands:</strong> ${d.count}</div>
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function (event, d) {
      d3.select(this).attr("opacity", 0.9).attr("r", 8 + Math.min(8, d.count / 5));
      tooltip.style("visibility", "hidden");
    });
}

function renderClusterLegend(kUsed) {
  clusterLegend.innerHTML = "";
  const colorScale = d3.scaleOrdinal(d3.schemeSet2).domain([...Array(kUsed).keys()]);
  
  // 1. Calculate cluster statistics (mean SIS)
  const clusterStats = MATERIAL_AGG.reduce((acc, m) => {
    const cluster = m.cluster;
    acc[cluster] = acc[cluster] || { count: 0, sumSIS: 0 };
    acc[cluster].count += 1;
    acc[cluster].sumSIS += m.meanSIS;
    return acc;
  }, {});

  const meanSISByCluster = Object.entries(clusterStats).map(([cluster, data]) => ({
      cluster: parseInt(cluster),
      meanSIS: data.sumSIS / data.count,
  })).sort((a, b) => b.meanSIS - a.meanSIS); // Sort by SIS descending

  // 2. Assign descriptive names based on SIS ranking
  const clusterNames = {};
  if (meanSISByCluster.length > 0) {
      clusterNames[meanSISByCluster[0].cluster] = "High-Impact (Most Sustainable)";
  }
  if (meanSISByCluster.length > 1) {
      clusterNames[meanSISByCluster[meanSISByCluster.length - 1].cluster] = "Low-Impact (Least Sustainable)";
  }
  if (meanSISByCluster.length > 2) {
      for (let i = 1; i < meanSISByCluster.length - 1; i++) {
          clusterNames[meanSISByCluster[i].cluster] = `Medium-Impact ${i}`;
      }
  }
  
  for (let i = 0; i < kUsed; i++) {
    const name = clusterNames[i] || `Cluster ${i}`;
    const div = document.createElement("div");
    div.className = "cluster-pill";
    div.innerHTML = `<span class="cluster-dot" style="background-color:${colorScale(i)};"></span> ${name}`;
    clusterLegend.appendChild(div);
  }
}

/* ========== PARETO FRONTIER (Section 6) ========== */

function renderParetoCharts() {
  const materialPareto = renderParetoMaterial();
  const brandPareto = renderParetoBrand();
  renderParetoInsight(materialPareto, brandPareto);
}

function renderParetoInsight(materialPareto, brandPareto) {
  if (!paretoInsightDiv) return;
  paretoInsightDiv.innerHTML = `
    <p><strong>Multi-Objective Optimization:</strong> The Pareto Frontier visualizes the optimal trade-off between <strong>Sustainability (SIS)</strong> and <strong>Price</strong>. Items on the frontier are "Pareto-optimal," meaning you cannot improve one metric without worsening the other.</p>
    <p><strong>Insight:</strong> We found <strong>${materialPareto.length} optimal materials</strong> and <strong>${brandPareto.length} optimal brands</strong>. These represent the most efficient choices in the dataset.</p>
    <p><strong>Recommendation:</strong> Always prefer items on the Pareto Frontier. They offer the best possible SIS for a given price (or the lowest price for a given SIS).</p>
  `;
}

function renderParetoMaterial() {
  const container = document.getElementById("pareto-material");
  if (!container || !MATERIAL_AGG) return [];

  const data = MATERIAL_AGG.map(m => ({ name: m.Material_Type, price: m.meanPrice, sis: m.meanSIS, count: m.count })).filter(d => d.price > 0 && d.sis > 0);
  if (data.length === 0) {
    container.innerHTML = "<p class='plot-nodata'>Not enough data for Pareto analysis</p>";
    return [];
  }

  // Simple Pareto calculation (assuming lower price is better, higher SIS is better)
  const paretoFlags = computeParetoFlags(data.map(d => ({ SIS: d.sis, Average_Price_USD: d.price })));
  const paretoPoints = data.filter((_, i) => paretoFlags[i]);

  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleLinear().domain([0, d3.max(data, d => d.price) * 1.1]).range([padding.left, width - padding.right]);
  const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.sis) * 1.1]).range([height - padding.bottom, padding.top]);

  // Axes & Labels
  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScale).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("text").attr("x", width / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--accent-dark)").attr("font-size", "13px").attr("font-weight", "600").text("Materials — Pareto Frontier (Price vs SIS)");
  svg.append("text").attr("x", width / 2).attr("y", height - 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Average Price (USD)");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Sustainability Index (SIS)");

  // Pareto frontier line (Connect the Pareto points)
  if (paretoPoints.length > 1) {
    const sortedPareto = [...paretoPoints].sort((a, b) => a.price - b.price);
    const line = d3.line().x(d => xScale(d.price)).y(d => yScale(d.sis)).curve(d3.curveStepAfter);
    svg.append("path").datum(sortedPareto).attr("fill", "none").attr("stroke", "var(--cluster-high)").attr("stroke-width", 2).attr("stroke-dasharray", "5,3").attr("d", line);
  }

  const tooltip = createTooltip("pareto-material-tooltip");

  // All points
  svg.selectAll("circle.all-point").data(data).enter().append("circle").attr("class", "all-point")
    .attr("cx", d => xScale(d.price)).attr("cy", d => yScale(d.sis)).attr("r", 6).attr("fill", "#d1d5db").attr("opacity", 0.6).attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1).attr("r", 8);
      const isPareto = paretoPoints.some(p => p.name === d.name);
      tooltip.html(`
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.sis.toFixed(3)}</div>
          <div><strong>Brands:</strong> ${d.count}</div>
        </div>
        <div class="tooltip-footer" style="color:var(--text-muted);">${isPareto ? '✓ Pareto-optimal' : 'Not on frontier'}</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.6).attr("r", 6);
      tooltip.style("visibility", "hidden");
    });

  // Pareto points (highlighted)
  svg.selectAll("circle.pareto-point").data(paretoPoints).enter().append("circle").attr("class", "pareto-point")
    .attr("cx", d => xScale(d.price)).attr("cy", d => yScale(d.sis)).attr("r", 7).attr("fill", "var(--cluster-high)").attr("stroke", "#fff").attr("stroke-width", 2.5).attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 9);
      tooltip.html(`
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.sis.toFixed(3)}</div>
          <div><strong>Brands:</strong> ${d.count}</div>
        </div>
        <div class="tooltip-footer tooltip-pareto">✓ Pareto-optimal</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("r", 7);
      tooltip.style("visibility", "hidden");
    });

  return paretoPoints;
}

function renderParetoBrand() {
  const container = document.getElementById("pareto-brand");
  if (!container || !PROCESSED_ROWS) return [];

  const data = PROCESSED_ROWS.map(r => ({ name: r.Brand_Name || r.Brand_ID, price: r.Average_Price_USD, sis: r.SIS, material: r.Material_Type })).filter(d => d.price > 0 && d.sis > 0);
  if (data.length === 0) {
    container.innerHTML = "<p class='plot-nodata'>Not enough data for Pareto analysis</p>";
    return [];
  }

  // Simple Pareto calculation (assuming lower price is better, higher SIS is better)
  const paretoFlags = computeParetoFlags(data.map(d => ({ SIS: d.sis, Average_Price_USD: d.price })));
  const paretoPoints = data.filter((_, i) => paretoFlags[i]);

  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleLinear().domain([0, d3.max(data, d => d.price) * 1.1]).range([padding.left, width - padding.right]);
  const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.sis) * 1.1]).range([height - padding.bottom, padding.top]);

  // Axes & Labels
  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScale).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("text").attr("x", width / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--accent-dark)").attr("font-size", "13px").attr("font-weight", "600").text("Brands — Pareto Frontier (Price vs SIS)");
  svg.append("text").attr("x", width / 2).attr("y", height - 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Average Price (USD)");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Sustainability Index (SIS)");

  // Pareto frontier line
  if (paretoPoints.length > 1) {
    const sortedPareto = [...paretoPoints].sort((a, b) => a.price - b.price);
    const line = d3.line().x(d => xScale(d.price)).y(d => yScale(d.sis)).curve(d3.curveStepAfter);
    svg.append("path").datum(sortedPareto).attr("fill", "none").attr("stroke", "var(--cluster-low)").attr("stroke-width", 2).attr("stroke-dasharray", "5,3").attr("d", line);
  }

  const tooltip = createTooltip("pareto-brand-tooltip");

  // All points (sample to avoid overcrowding)
  const sampleData = data.length > 100 ? data.filter((_, i) => i % Math.ceil(data.length / 100) === 0) : data;
  svg.selectAll("circle.all-point").data(sampleData).enter().append("circle").attr("class", "all-point")
    .attr("cx", d => xScale(d.price)).attr("cy", d => yScale(d.sis)).attr("r", 4).attr("fill", "#d1d5db").attr("opacity", 0.5).attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1).attr("r", 6);
      const isPareto = paretoPoints.some(p => p.name === d.name);
      tooltip.html(`
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.sis.toFixed(3)}</div>
          <div><strong>Material:</strong> ${d.material || "N/A"}</div>
        </div>
        <div class="tooltip-footer" style="color:var(--text-muted);">${isPareto ? '✓ Pareto-optimal' : 'Not on frontier'}</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.5).attr("r", 4);
      tooltip.style("visibility", "hidden");
    });

  // Pareto points (highlighted)
  svg.selectAll("circle.pareto-point").data(paretoPoints).enter().append("circle").attr("class", "pareto-point")
    .attr("cx", d => xScale(d.price)).attr("cy", d => yScale(d.sis)).attr("r", 7).attr("fill", "var(--cluster-low)").attr("stroke", "#fff").attr("stroke-width", 2.5).attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 9);
      tooltip.html(`
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.sis.toFixed(3)}</div>
          <div><strong>Material:</strong> ${d.material || "N/A"}</div>
        </div>
        <div class="tooltip-footer tooltip-pareto">✓ Pareto-optimal</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("r", 7);
      tooltip.style("visibility", "hidden");
    });

  return paretoPoints;
}

/* ========== RECOMMENDATIONS RENDER (Section 7) ========== */

function buildAndRenderRecommendations() {
  // Recommendations are now purely Pareto-based, no user priority weight
  const recs = buildRecommendations(PROCESSED_ROWS, 8);
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
    const band = item.SIS >= 0.75 ? "reco-high" : item.SIS >= 0.55 ? "reco-mid" : "reco-low";
    const paretoTag = item.isPareto ? '<span class="reco-pill reco-pill-pareto">✓ Pareto-optimal</span>' : '<span class="reco-pill reco-pill-dominated">Dominated</span>';

    const div = document.createElement("div");
    div.className = `reco-item ${band}`;
    div.innerHTML = `
      <div class="reco-rank-badge">🔥 Top ${idx + 1}</div>
      <div class="reco-header">
        <div>
          <div class="reco-brand">${item.Brand_Name || item.Brand_ID}</div>
          <div class="reco-tagline">${item.Material_Type || "Unknown material"} • ${item.Country || "Unknown country"}</div>
        </div>
        <div class="reco-score">SIS: ${item.SIS.toFixed(3)}</div>
      </div>
      <div class="reco-metrics">
        <span>💰 $${item.Average_Price_USD.toFixed(2)}</span>
        <span>🌱 CO₂: ${item.Carbon_Footprint_MT.toFixed(1)} MT</span>
        <span>💧 Water: ${item.Water_Usage_Liters.toFixed(0)} L</span>
        <span>🗑 Waste: ${item.Waste_Production_KG.toFixed(1)} kg</span>
      </div>
      <div class="reco-pill-row">
        ${paretoTag}
        <span class="reco-pill">Cert: ${item.Certifications || "N/A"}</span>
        <span class="reco-pill">Recycling: ${item.Recycling_Programs || "N/A"}</span>
      </div>
    `;
    recoList.appendChild(div);
  });
}

/* ========== EDA CHARTS (Section 4) - IMPROVED TOOLTIPS & COLORS ========== */

function renderEdaCharts() {
  renderEdaMaterial();
  renderEdaCountry();
  renderEdaTrend();
  renderEdaYear();
}

function computeCountryAgg(rows) {
  const map = new Map();
  rows.forEach(r => {
    const c = r.Country || "Unknown";
    if (!map.has(c)) map.set(c, { Country: c, sumPrice: 0, sumSIS: 0, count: 0 });
    const m = map.get(c);
    m.sumPrice += r.Average_Price_USD || 0;
    m.sumSIS += r.SIS || 0;
    m.count += 1;
  });
  return Array.from(map.values()).map(m => ({ ...m, meanPrice: m.sumPrice / m.count, meanSIS: m.sumSIS / m.count }));
}

function computeTrendAgg(rows) {
  const map = new Map();
  rows.forEach(r => {
    const t = r.Market_Trend || "Unknown";
    if (!map.has(t)) map.set(t, { Trend: t, sumSIS: 0, count: 0 });
    const m = map.get(t);
    m.sumSIS += r.SIS || 0;
    m.count += 1;
  });
  return Array.from(map.values()).map(m => ({ ...m, meanSIS: m.sumSIS / m.count }));
}

function computeYearAgg(rows) {
  const map = new Map();
  rows.forEach(r => {
    const t = r.Market_Trend || "Unknown";    if (!map.has(y)) map.set(y, { Year: y, sumPrice: 0, sumSIS: 0, count: 0 });
    const m = map.get(y);
    m.sumPrice += r.Average_Price_USD || 0;
    m.sumSIS += r.SIS || 0;
    m.count += 1;
  });
  return Array.from(map.values()).map(m => ({ ...m, meanPrice: m.sumPrice / m.count, meanSIS: m.sumSIS / m.count }));
}

function renderEdaMaterial() {
  const container = document.getElementById("eda-material");
  const insightDiv = document.getElementById("eda-material-insight");
  if (!container || !MATERIAL_AGG) return;

  const agg = MATERIAL_AGG.sort((a, b) => b.count - a.count).slice(0, 10);
  if (agg.length === 0) {
    container.innerHTML = "<p class='plot-nodata'>No data</p>";
    insightDiv.innerHTML = "<p>Không có dữ liệu vật liệu để phân tích.</p>";
    return;
  }

  // Find the most expensive and most sustainable material
  const mostExpensive = agg.reduce((max, item) => (item.meanPrice > max.meanPrice ? item : max), agg[0]);
  const mostSustainable = agg.reduce((max, item) => (item.meanSIS > max.meanSIS ? item : max), agg[0]);

  insightDiv.innerHTML = `
    <p><strong>Top 10 Materials:</strong> ${agg.map(m => m.Material_Type).join(', ')}.</p>
    <p><strong>Insight:</strong> <strong>${mostSustainable.Material_Type}</strong> has the highest average SIS (${mostSustainable.meanSIS.toFixed(3)}). <strong>${mostExpensive.Material_Type}</strong> is the most expensive ($${mostExpensive.meanPrice.toFixed(2)}).</p>
    <p><strong>Recommendation:</strong> Consider the trade-off between SIS and Price for your material sourcing strategy.</p>
  `;

  // D3 Bar Chart
  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 10, right: 10, bottom: 50, left: 50 };

  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleBand().domain(agg.map(d => d.Material_Type)).range([padding.left, width - padding.right]).padding(0.1);
  const yScalePrice = d3.scaleLinear().domain([0, d3.max(agg, d => d.meanPrice) * 1.1]).range([height - padding.bottom, padding.top]);
  const yScaleSIS = d3.scaleLinear().domain([0, 1]).range([height - padding.bottom, padding.top]);

  // Axes
  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale)).selectAll("text").attr("transform", "rotate(-45)").style("text-anchor", "end").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScalePrice).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${width - padding.right},0)`).call(d3.axisRight(yScaleSIS).ticks(5)).selectAll("text").style("font-size", "10px");

  // Labels
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Average Price (USD)");
  svg.append("text").attr("transform", "rotate(90)").attr("x", height / 2).attr("y", -width + 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Average SIS");

  // Bars (Price)
  svg.selectAll(".bar-price").data(agg).enter().append("rect").attr("class", "bar-price")
    .attr("x", d => xScale(d.Material_Type))
    .attr("y", d => yScalePrice(d.meanPrice))
    .attr("width", xScale.bandwidth() / 2)
    .attr("height", d => height - padding.bottom - yScalePrice(d.meanPrice))
    .attr("fill", "var(--green-bar-soft)");

  // Line (SIS)
  const lineSIS = d3.line().x(d => xScale(d.Material_Type) + xScale.bandwidth() * 0.75).y(d => yScaleSIS(d.meanSIS));
  svg.append("path").datum(agg).attr("fill", "none").attr("stroke", "var(--green-line)").attr("stroke-width", 2).attr("d", lineSIS);

  // Points (SIS)
  const tooltip = createTooltip("eda-material-tooltip");
  svg.selectAll(".dot-sis").data(agg).enter().append("circle").attr("class", "dot-sis")
    .attr("cx", d => xScale(d.Material_Type) + xScale.bandwidth() * 0.75)
    .attr("cy", d => yScaleSIS(d.meanSIS))
    .attr("r", 4)
    .attr("fill", "var(--green-line)")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 6);
      tooltip.html(`
        <div class="tooltip-header">${d.Material_Type}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.meanPrice.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
          <div><strong>Count:</strong> ${d.count}</div>
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("r", 4);
      tooltip.style("visibility", "hidden");
    });
}

function renderEdaCountry() {
  const container = document.getElementById("eda-country");
  const insightDiv = document.getElementById("eda-country-insight");
  if (!container || !PROCESSED_ROWS) return;

  const agg = computeCountryAgg(PROCESSED_ROWS).sort((a, b) => b.count - a.count).slice(0, 10);
  if (agg.length === 0) {
    container.innerHTML = "<p class='plot-nodata'>No data</p>";
    insightDiv.innerHTML = "<p>Không có dữ liệu quốc gia để phân tích.</p>";
    return;
  }

  const mostSustainable = agg.reduce((max, item) => (item.meanSIS > max.meanSIS ? item : max), agg[0]);
  const mostExpensive = agg.reduce((max, item) => (item.meanPrice > max.meanPrice ? item : max), agg[0]);

  insightDiv.innerHTML = `
    <p><strong>Top 10 Countries:</strong> ${agg.map(c => c.Country).join(', ')}.</p>
    <p><strong>Insight:</strong> <strong>${mostSustainable.Country}</strong> has the highest average SIS (${mostSustainable.meanSIS.toFixed(3)}). <strong>${mostExpensive.Country}</strong> is the most expensive ($${mostExpensive.meanPrice.toFixed(2)}).</p>
    <p><strong>Recommendation:</strong> Consider sourcing from countries with high SIS scores for better sustainability.</p>
  `;

  // D3 Bar Chart (Similar to Material EDA)
  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 10, right: 10, bottom: 50, left: 50 };

  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleBand().domain(agg.map(d => d.Country)).range([padding.left, width - padding.right]).padding(0.1);
  const yScalePrice = d3.scaleLinear().domain([0, d3.max(agg, d => d.meanPrice) * 1.1]).range([height - padding.bottom, padding.top]);
  const yScaleSIS = d3.scaleLinear().domain([0, 1]).range([height - padding.bottom, padding.top]);

  // Axes
  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale)).selectAll("text").attr("transform", "rotate(-45)").style("text-anchor", "end").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScalePrice).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${width - padding.right},0)`).call(d3.axisRight(yScaleSIS).ticks(5)).selectAll("text").style("font-size", "10px");

  // Labels
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Average Price (USD)");
  svg.append("text").attr("transform", "rotate(90)").attr("x", height / 2).attr("y", -width + 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Average SIS");

  // Bars (Price)
  svg.selectAll(".bar-price").data(agg).enter().append("rect").attr("class", "bar-price")
    .attr("x", d => xScale(d.Country))
    .attr("y", d => yScalePrice(d.meanPrice))
    .attr("width", xScale.bandwidth() / 2)
    .attr("height", d => height - padding.bottom - yScalePrice(d.meanPrice))
    .attr("fill", "var(--green-bar-soft)");

  // Line (SIS)
  const lineSIS = d3.line().x(d => xScale(d.Country) + xScale.bandwidth() * 0.75).y(d => yScaleSIS(d.meanSIS));
  svg.append("path").datum(agg).attr("fill", "none").attr("stroke", "var(--green-line)").attr("stroke-width", 2).attr("d", lineSIS);

  // Points (SIS)
  const tooltip = createTooltip("eda-country-tooltip");
  svg.selectAll(".dot-sis").data(agg).enter().append("circle").attr("class", "dot-sis")
    .attr("cx", d => xScale(d.Country) + xScale.bandwidth() * 0.75)
    .attr("cy", d => yScaleSIS(d.meanSIS))
    .attr("r", 4)
    .attr("fill", "var(--green-line)")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 6);
      tooltip.html(`
        <div class="tooltip-header">${d.Country}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.meanPrice.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
          <div><strong>Count:</strong> ${d.count}</div>
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("r", 4);
      tooltip.style("visibility", "hidden");
    });
}

function computeTrendAgg(rows) {
  const map = new Map();
  rows.forEach(r => {
    const t = r.Market_Trend || "Unknown";
    if (!map.has(t)) map.set(t, { Trend: t, sumSIS: 0, count: 0 });
    const m = map.get(t);
    m.sumSIS += r.SIS || 0;
    m.count += 1;
  });
  return Array.from(map.values()).map(m => ({ ...m, meanSIS: m.sumSIS / m.count }));
}

function renderEdaYear() {
  const container = document.getElementById("eda-year");
  const insightDiv = document.getElementById("eda-year-insight");
  if (!container || !PROCESSED_ROWS) return;

  const agg = computeYearAgg(PROCESSED_ROWS).sort((a, b) => a.Year - b.Year);
  if (agg.length === 0) {
    container.innerHTML = "<p class='plot-nodata'>No data</p>";
    insightDiv.innerHTML = "<p>Không có dữ liệu năm để phân tích.</p>";
    return;
  }

  const latestYear = agg[agg.length - 1];
  const earliestYear = agg[0];

  insightDiv.innerHTML = `
    <p><strong>Time Trend:</strong> Data spans from ${earliestYear.Year} to ${latestYear.Year}.</p>
    <p><strong>Insight:</strong> In ${latestYear.Year}, the average SIS was ${latestYear.meanSIS.toFixed(3)} and the average price was $${latestYear.meanPrice.toFixed(2)}.</p>
    <p><strong>Recommendation:</strong> Monitor the trend to see if sustainability is improving over time (SIS increasing) or if prices are changing.</p>
  `;

  // D3 Line Chart (Price vs SIS over Year)
  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 10, right: 10, bottom: 40, left: 50 };

  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scalePoint().domain(agg.map(d => d.Year)).range([padding.left, width - padding.right]).padding(0.5);
  const yScalePrice = d3.scaleLinear().domain([0, d3.max(agg, d => d.meanPrice) * 1.1]).range([height - padding.bottom, padding.top]);
  const yScaleSIS = d3.scaleLinear().domain([0, 1]).range([height - padding.bottom, padding.top]);

  // Axes
  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale)).selectAll("text").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScalePrice).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${width - padding.right},0)`).call(d3.axisRight(yScaleSIS).ticks(5)).selectAll("text").style("font-size", "10px");

  // Labels
  svg.append("text").attr("x", width / 2).attr("y", height - 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Year");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Average Price (USD)");
  svg.append("text").attr("transform", "rotate(90)").attr("x", height / 2).attr("y", -width + 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Average SIS");

  // Line (Price)
  const linePrice = d3.line().x(d => xScale(d.Year)).y(d => yScalePrice(d.meanPrice));
  svg.append("path").datum(agg).attr("fill", "none").attr("stroke", "var(--green-bar-soft)").attr("stroke-width", 2).attr("d", linePrice);

  // Line (SIS)
  const lineSIS = d3.line().x(d => xScale(d.Year)).y(d => yScaleSIS(d.meanSIS));
  svg.append("path").datum(agg).attr("fill", "none").attr("stroke", "var(--green-line)").attr("stroke-width", 2).attr("d", lineSIS);

  // Points (SIS)
  const tooltip = createTooltip("eda-year-tooltip");
  svg.selectAll(".dot-sis").data(agg).enter().append("circle").attr("class", "dot-sis")
    .attr("cx", d => xScale(d.Year))
    .attr("cy", d => yScaleSIS(d.meanSIS))
    .attr("r", 4)
    .attr("fill", "var(--green-line)")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 6);
      tooltip.html(`
        <div class="tooltip-header">Year: ${d.Year}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.meanPrice.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
          <div><strong>Count:</strong> ${d.count}</div>
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("r", 4);
      tooltip.style("visibility", "hidden");
    });
}
