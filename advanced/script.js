/*
   script.js - Enhanced Version with Beautiful EDA Layout
   UI rendering and visualization for SustainGraph
*/

/* ========== GLOBAL STATE ========== */

let RAW_ROWS = [];
let PROCESSED_ROWS = [];
let STATS = null;
let MATERIAL_AGG = [];
let ELBOW_INFO = null;
let ENTROPY_WEIGHTS = null;
let DATA_QUALITY = null;

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
const btnRun = document.getElementById("run-pipeline");

const kpiRow = document.getElementById("kpi-row");
const clusterLegend = document.getElementById("cluster-legend");
const paretoInsightDiv = document.getElementById("pareto-insight");
const dataQualityDiv = document.getElementById("data-quality-validation");

/* ========== TOOLTIP HELPER ========== */

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
  fetch("https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/advanced/Kaggle_sust_dataset.csv")
    .then((res) => res.text())
    .then((csv) => {
      const file = new File([csv], "sample.csv", { type: "text/csv" });
      parseCsv(file);
    });
});

autoUploadBtn.addEventListener("click", () => {
  loadStatus.textContent = "Loading sample data...";
  fetch("https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/advanced/Kaggle_sust_dataset.csv")
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

  const { rowsWithSIS, stats, materialAgg, elbowInfo, entropyWeights, dataQuality } = processData(filtered);
  PROCESSED_ROWS = rowsWithSIS;
  STATS = stats;
  MATERIAL_AGG = materialAgg;
  ELBOW_INFO = elbowInfo;
  ENTROPY_WEIGHTS = entropyWeights;
  DATA_QUALITY = dataQuality;

  renderKPIs();
  renderDataQualityValidation();
  clusterAndRenderMaterials();
  buildAndRenderRecommendations();
  renderEdaCharts();
  renderParetoCharts();
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

/* ========== KPI RENDER ========== */

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
    <div class="kpi-item">
      <div class="kpi-value">${STATS.brandCount}</div>
      <div class="kpi-label">Brands Analyzed</div>
      <div class="kpi-sublabel">In current filtered dataset</div>
    </div>
    <div class="kpi-item info-card">
        <div class="kpi-label">Entropy Weight Analysis</div>
        <div class="info-card-body">
            <div><strong>Environmental Weight:</strong> <span>${ENTROPY_WEIGHTS.env.toFixed(4)}</span> (Diversity: ${envDiversity})</div>
            <div><strong>Policy Weight:</strong> <span>${ENTROPY_WEIGHTS.policy.toFixed(4)}</span> (Diversity: ${policyDiversity})</div>
        </div>
        <div class="info-card-footer">
            Objective weights derived from data variance. Higher diversity (1 - Entropy) = higher weight.
        </div>
    </div>
  `;
}

/* ========== DATA QUALITY VALIDATION ========== */

function renderDataQualityValidation() {
  if (!DATA_QUALITY || !ENTROPY_WEIGHTS) return;

  const { carbon, water, waste } = DATA_QUALITY;

  dataQualityDiv.innerHTML = `
    <h3 style="margin-top: 0;">Statistical Validation of Environmental Indicators</h3>
    
    <table class="validation-table">
      <thead>
        <tr>
          <th>Indicator</th>
          <th>Variance</th>
          <th>CV (Coefficient of Variation)</th>
          <th>Interpretation</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Carbon Footprint (MT)</strong></td>
          <td>${carbon.variance.toFixed(4)}</td>
          <td>${carbon.cv.toFixed(4)}</td>
          <td>${carbon.cv < 0.3 ? 'Low variance (uniform distribution)' : 'High variance'}</td>
        </tr>
        <tr>
          <td><strong>Water Usage (Liters)</strong></td>
          <td>${water.variance.toFixed(2)}</td>
          <td>${water.cv.toFixed(4)}</td>
          <td>${water.cv < 0.3 ? 'Low variance (uniform distribution)' : 'High variance'}</td>
        </tr>
        <tr>
          <td><strong>Waste Production (KG)</strong></td>
          <td>${waste.variance.toFixed(4)}</td>
          <td>${waste.cv.toFixed(4)}</td>
          <td>${waste.cv < 0.3 ? 'Low variance (uniform distribution)' : 'High variance'}</td>
        </tr>
      </tbody>
    </table>

    <div class="validation-insight">
      <strong>Academic Defense of Entropy Weight Method:</strong><br>
      The dataset exhibits low variance in environmental footprints (Carbon, Water, Waste), 
      indicating a simulated uniform distribution. This is a <strong>dataset characteristic</strong>, not a methodological error.<br><br>
      
      <strong>Consequence:</strong> Environmental indicators have high entropy (low information content) → low weight (${ENTROPY_WEIGHTS.env.toFixed(4)}).<br>
      Policy indicators (Sustainability Rating, Recycling) have higher variance → higher weight (${ENTROPY_WEIGHTS.policy.toFixed(4)}).<br><br>
      
      <strong>Scientific Justification:</strong> The Entropy Weight Method correctly identifies that policy metrics are more discriminative 
      in this dataset. This is a data-driven finding, emphasizing that entropy reveals objective weighting.
    </div>
    
    <div class="validation-warning">
      ⚠️ <strong>Generalization Warning:</strong> Results are specific to this dataset. In real-world data with higher environmental variance, 
      environmental weights would increase accordingly.
    </div>
  `;
}

/* ========== K-MEANS CLUSTERING ========== */

function clusterAndRenderMaterials() {
  if (!MATERIAL_AGG || !ELBOW_INFO) return;
  const bestK = ELBOW_INFO.bestK;
  renderClusteringValidation(bestK);
}

function renderClusteringValidation(kUsed) {
  renderElbowChart(kUsed);
  renderElbowInsight(kUsed);
  renderClusterScatter(kUsed);
  renderClusterLegend(kUsed);
  renderClusterScatterInsight(kUsed);
  renderClusterInterpretationTable(kUsed);
}

function renderElbowInsight(kUsed) {
  const insightDiv = document.getElementById("elbow-insight");
  if (!insightDiv) return;
  insightDiv.innerHTML = `
    <p><strong>Elbow Method Validation:</strong> The optimal number of clusters is <strong>k=${kUsed}</strong>, determined by analyzing the rate of change in inertia (WCSS). This validates the clustering approach and ensures the chosen k is data-driven, not arbitrary.</p>
    <p><strong>Interpretation:</strong> The elbow point indicates the best trade-off between minimizing within-cluster variance and minimizing the number of clusters. For k=${kUsed}, the clustering effectively separates materials based on their sustainability profiles.</p>
  `;
}

function renderClusterScatterInsight(kUsed) {
  const insightDiv = document.getElementById("cluster-scatter-insight");
  if (!insightDiv) return;
  
  if (MATERIAL_AGG.length === 0) {
      insightDiv.innerHTML = `<p>No data available for cluster analysis.</p>`;
      return;
  }
  
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
  })).sort((a, b) => b.meanSIS - a.meanSIS);

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
    <p><strong>Key Finding:</strong> 
        The <strong>${bestClusterName}</strong> (Cluster ${bestCluster.cluster}) has the highest average SIS (${bestCluster.meanSIS.toFixed(3)}), indicating the most sustainable materials.
        The <strong>${worstClusterName}</strong> (Cluster ${worstCluster.cluster}) has the lowest average SIS (${worstCluster.meanSIS.toFixed(3)}).
        The largest cluster is <strong>Cluster ${largestCluster.cluster}</strong> with ${largestCluster.count} materials.
    </p>
    <p><strong>Interpretation Note:</strong> Cluster separation is primarily driven by policy scores (Sustainability Rating, Recycling Programs) 
        rather than environmental metrics, because environmental variance is low in this dataset (see Data Quality Validation).
    </p>
    <p><strong>Recommendation:</strong> Focus on materials in the <strong>${bestClusterName}</strong> for the most sustainable sourcing options.</p>
  `;
}

function renderClusterInterpretationTable(kUsed) {
  const tableDiv = document.getElementById("cluster-interpretation-table");
  if (!tableDiv || !MATERIAL_AGG) return;

  const clusterStats = MATERIAL_AGG.reduce((acc, m) => {
    const cluster = m.cluster;
    if (!acc[cluster]) {
      acc[cluster] = {
        count: 0,
        sumSIS: 0,
        sumEnv: 0,
        sumPolicy: 0,
        sumCarbon: 0,
        sumWater: 0,
        sumWaste: 0,
        sumRating: 0,
        sumRecycling: 0,
        materials: []
      };
    }
    acc[cluster].count += 1;
    acc[cluster].sumSIS += m.meanSIS;
    acc[cluster].sumEnv += m.meanEnvNorm;
    acc[cluster].sumPolicy += m.meanPolicyNorm;
    acc[cluster].sumCarbon += m.meanCarbon || 0;
    acc[cluster].sumWater += m.meanWater || 0;
    acc[cluster].sumWaste += m.meanWaste || 0;
    acc[cluster].sumRating += m.meanRating || 0;
    acc[cluster].sumRecycling += m.meanRecycling || 0;
    acc[cluster].materials.push(m.Material_Type);
    return acc;
  }, {});

  const clusterData = Object.entries(clusterStats).map(([cluster, data]) => ({
    cluster: parseInt(cluster),
    count: data.count,
    meanSIS: data.sumSIS / data.count,
    meanEnv: data.sumEnv / data.count,
    meanPolicy: data.sumPolicy / data.count,
    meanCarbon: data.sumCarbon / data.count,
    meanWater: data.sumWater / data.count,
    meanWaste: data.sumWaste / data.count,
    meanRating: data.sumRating / data.count,
    meanRecycling: data.sumRecycling / data.count,
    materials: data.materials.slice(0, 3).join(', ') + (data.materials.length > 3 ? '...' : '')
  })).sort((a, b) => b.meanSIS - a.meanSIS);

  const clusterNames = {};
  if (clusterData.length > 0) {
      clusterNames[clusterData[0].cluster] = "High-Impact";
  }
  if (clusterData.length > 1) {
      clusterNames[clusterData[clusterData.length - 1].cluster] = "Low-Impact";
  }
  if (clusterData.length > 2) {
      for (let i = 1; i < clusterData.length - 1; i++) {
          clusterNames[clusterData[i].cluster] = `Medium-Impact ${i}`;
      }
  }

  let tableHTML = `
    <table class="cluster-interpretation-table">
      <thead>
        <tr>
          <th>Cluster</th>
          <th>Count</th>
          <th>Avg SIS</th>
          <th>Env Score</th>
          <th>Policy Score</th>
          <th>Carbon (MT)</th>
          <th>Water (L)</th>
          <th>Waste (KG)</th>
          <th>Rating</th>
          <th>Recycling</th>
        </tr>
      </thead>
      <tbody>
  `;

  clusterData.forEach(c => {
    const clusterName = clusterNames[c.cluster] || `Cluster ${c.cluster}`;
    tableHTML += `
      <tr>
        <td><strong>${clusterName}</strong> (${c.cluster})</td>
        <td>${c.count}</td>
        <td>${c.meanSIS.toFixed(3)}</td>
        <td>${c.meanEnv.toFixed(3)}</td>
        <td>${c.meanPolicy.toFixed(3)}</td>
        <td>${c.meanCarbon.toFixed(2)}</td>
        <td>${c.meanWater.toFixed(0)}</td>
        <td>${c.meanWaste.toFixed(2)}</td>
        <td>${c.meanRating.toFixed(2)}</td>
        <td>${c.meanRecycling.toFixed(2)}</td>
      </tr>
    `;
  });

  tableHTML += `
      </tbody>
    </table>
    
    <div class="cluster-interpretation-notes">
      <h4>Cluster Interpretation (3 Key Bullets):</h4>
      <ul>
        <li><strong>High-Impact Clusters:</strong> Materials with highest policy scores (Sustainability Rating, Recycling Programs). Recommended for sustainable sourcing.</li>
        <li><strong>Medium-Impact Clusters:</strong> Balanced sustainability profiles. Suitable for cost-conscious sustainable choices.</li>
        <li><strong>Low-Impact Clusters:</strong> Lower policy compliance. Requires improvement in sustainability practices.</li>
      </ul>
      <p><strong>Note:</strong> Cluster separation is primarily driven by policy scores, as environmental metrics show low variance in this dataset.</p>
    </div>
  `;

  tableDiv.innerHTML = tableHTML;
}

function renderElbowChart(kUsed) {
  const container = document.getElementById("elbow-chart");
  if (!container || !ELBOW_INFO) return;
  container.innerHTML = "";

  const data = ELBOW_INFO.elbowData;
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 20, bottom: 40, left: 60 };

  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleLinear().domain([1, data.length]).range([padding.left, width - padding.right]);
  const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.inertia) * 1.1]).range([height - padding.bottom, padding.top]);

  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale).ticks(data.length).tickFormat(d3.format("d"))).selectAll("text").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScale).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("text").attr("x", width / 2).attr("y", height - 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Number of Clusters (k)");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Inertia (WCSS)");

  const line = d3.line().x(d => xScale(d.k)).y(d => yScale(d.inertia));
  svg.append("path").datum(data).attr("fill", "none").attr("stroke", "var(--accent)").attr("stroke-width", 2).attr("d", line);

  const tooltip = createTooltip("elbow-tooltip");

  svg.selectAll("circle").data(data).enter().append("circle")
    .attr("cx", d => xScale(d.k))
    .attr("cy", d => yScale(d.inertia))
    .attr("r", d => d.k === kUsed ? 8 : 5)
    .attr("fill", d => d.k === kUsed ? "var(--cluster-high)" : "var(--accent)")
    .attr("stroke", "#fff")
    .attr("stroke-width", d => d.k === kUsed ? 3 : 1.5)
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", d.k === kUsed ? 10 : 7);
      tooltip.html(`
        <div class="tooltip-header">k = ${d.k}</div>
        <div class="tooltip-body">
          <div><strong>Inertia:</strong> ${d.inertia.toFixed(2)}</div>
          ${d.k === kUsed ? '<div class="tooltip-footer tooltip-pareto">✓ Optimal k</div>' : ''}
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function (event, d) {
      d3.select(this).attr("r", d.k === kUsed ? 8 : 5);
      tooltip.style("visibility", "hidden");
    });
}

function renderClusterScatter(kUsed) {
  const container = document.getElementById("cluster-scatter");
  if (!container || !MATERIAL_AGG) return;
  container.innerHTML = "";

  const data = MATERIAL_AGG.filter(m => m.cluster !== undefined && m.cluster !== null);
  if (data.length === 0) {
    container.innerHTML = "<p class='plot-nodata'>No cluster data available</p>";
    return;
  }

  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };

  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleLinear().domain([0, 1]).range([padding.left, width - padding.right]);
  const yScale = d3.scaleLinear().domain([0, 1]).range([height - padding.bottom, padding.top]);

  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale));
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScale));

  svg.append("text").attr("x", width / 2).attr("y", height - 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Environmental Score (Normalized)");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Policy Score (Normalized)");

  const colorScale = d3.scaleOrdinal(d3.schemeSet2).domain([...Array(kUsed).keys()]);

  const tooltip = createTooltip("scatter-tooltip");

  svg.selectAll("circle").data(data).enter().append("circle")
    .attr("cx", d => xScale(d.envScoreNorm || 0.5))
    .attr("cy", d => yScale(d.policyScoreNorm || 0.5))
    .attr("r", d => 8 + Math.min(8, d.count / 5))
    .attr("fill", d => colorScale(d.cluster))
    .attr("stroke", "#fff")    .attr("stroke-width", 2)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("r", 7);
      tooltip.html(`
        <div class="tooltip-header">${d.trend}</div>
        <div class="tooltip-body">
          <div><strong>Count:</strong> ${d.count}</div>
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function() {
      d3.select(this).attr("r", 5);
      tooltip.style("visibility", "hidden");
    })
    .attr("opacity", 0.9)
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1).attr("r", 12 + Math.min(8, d.count / 5));
      tooltip.html(`
        <div class="tooltip-header">${d.Material_Type}</div>
        <div class="tooltip-body">
          <div><strong>Cluster:</strong> ${d.cluster}</div>
          <div><strong>Env Score:</strong> ${(d.envScoreNorm || 0).toFixed(3)}</div>
          <div><strong>Policy Score:</strong> ${(d.policyScoreNorm || 0).toFixed(3)}</div>
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
  
  const clusterStats = MATERIAL_AGG.reduce((acc, m) => {
    const cluster = m.cluster;
    if (cluster === undefined || cluster === null) return acc;
    acc[cluster] = acc[cluster] || { count: 0, sumSIS: 0 };
    acc[cluster].count += 1;
    acc[cluster].sumSIS += m.meanSIS;
    return acc;
  }, {});

  const meanSISByCluster = Object.entries(clusterStats).map(([cluster, data]) => ({
      cluster: parseInt(cluster),
      meanSIS: data.sumSIS / data.count,
  })).sort((a, b) => b.meanSIS - a.meanSIS);

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

/* ========== PARETO FRONTIER ========== */

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
    <p><strong>Recommendation Strategy:</strong> Instead of ranking Pareto items by SIS (which defeats MOO purpose), we categorize them into:
      <ul style="margin: 8px 0; padding-left: 20px;">
        <li><strong>Max Sustainability:</strong> Highest SIS in Pareto set</li>
        <li><strong>Best Value:</strong> Lowest price in Pareto set</li>
        <li><strong>Balanced Trade-off:</strong> Optimal balance between SIS and price</li>
      </ul>
    </p>
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

  const paretoFlags = window.computeParetoFlags ? window.computeParetoFlags(data.map(d => ({ SIS: d.sis, Average_Price_USD: d.price }))) : [];
  const paretoPoints = data.filter((_, i) => paretoFlags[i]);

  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleLinear().domain([0, d3.max(data, d => d.price) * 1.1]).range([padding.left, width - padding.right]);
  const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.sis) * 1.1]).range([height - padding.bottom, padding.top]);

  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScale).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("text").attr("x", width / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--accent-dark)").attr("font-size", "13px").attr("font-weight", "600").text("Materials — Pareto Frontier (Price vs SIS)");
  svg.append("text").attr("x", width / 2).attr("y", height - 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Average Price (USD)");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Sustainability Index (SIS)");

  if (paretoPoints.length > 1) {
    const sortedPareto = [...paretoPoints].sort((a, b) => a.price - b.price);
    const line = d3.line().x(d => xScale(d.price)).y(d => yScale(d.sis)).curve(d3.curveStepAfter);
    svg.append("path").datum(sortedPareto).attr("fill", "none").attr("stroke", "var(--cluster-high)").attr("stroke-width", 2).attr("stroke-dasharray", "5,3").attr("d", line);
  }

  const tooltip = createTooltip("pareto-material-tooltip");

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

  svg.selectAll("circle.pareto-point").data(paretoPoints).enter().append("circle").attr("class", "pareto-point")
    .attr("cx", d => xScale(d.price)).attr("cy", d => yScale(d.sis)).attr("r", 7).attr("fill", "var(--cluster-high)").attr("stroke", "#fff").attr("stroke-width", 2.5).attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 9);
      tooltip.html(`
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.sis.toFixed(3)}</div>
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

  const brandMap = new Map();
  PROCESSED_ROWS.forEach(r => {
    const brand = r.Brand_Name || r.Brand_ID || "Unknown";
    if (!brandMap.has(brand)) {
      brandMap.set(brand, { name: brand, sumPrice: 0, sumSIS: 0, count: 0 });
    }
    const b = brandMap.get(brand);
    b.sumPrice += r.Average_Price_USD || 0;
    b.sumSIS += r.SIS || 0;
    b.count += 1;
  });

  const data = Array.from(brandMap.values()).map(b => ({
    name: b.name,
    price: b.sumPrice / b.count,
    sis: b.sumSIS / b.count,
    count: b.count
  })).filter(d => d.price > 0 && d.sis > 0);

  if (data.length === 0) {
    container.innerHTML = "<p class='plot-nodata'>Not enough data for Pareto analysis</p>";
    return [];
  }

  const paretoFlags = window.computeParetoFlags ? window.computeParetoFlags(data.map(d => ({ SIS: d.sis, Average_Price_USD: d.price }))) : [];
  const paretoPoints = data.filter((_, i) => paretoFlags[i]).map((d, idx) => ({
    ...d,
    paretoScore: (d.sis / Math.max(...data.map(x => x.sis))) * 0.5 + (1 - d.price / Math.max(...data.map(x => x.price))) * 0.5
  }));

  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleLinear().domain([0, d3.max(data, d => d.price) * 1.1]).range([padding.left, width - padding.right]);
  const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.sis) * 1.1]).range([height - padding.bottom, padding.top]);

  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScale).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("text").attr("x", width / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--accent-dark)").attr("font-size", "13px").attr("font-weight", "600").text("Brands — Pareto Frontier (Price vs SIS)");
  svg.append("text").attr("x", width / 2).attr("y", height - 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Average Price (USD)");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Sustainability Index (SIS)");

  if (paretoPoints.length > 1) {
    const sortedPareto = [...paretoPoints].sort((a, b) => a.price - b.price);
    const line = d3.line().x(d => xScale(d.price)).y(d => yScale(d.sis)).curve(d3.curveStepAfter);
    svg.append("path").datum(sortedPareto).attr("fill", "none").attr("stroke", "var(--cluster-high)").attr("stroke-width", 2).attr("stroke-dasharray", "5,3").attr("d", line);
  }

  const tooltip = createTooltip("pareto-brand-tooltip");

  svg.selectAll("circle.all-point").data(data).enter().append("circle").attr("class", "all-point")
    .attr("cx", d => xScale(d.price)).attr("cy", d => yScale(d.sis)).attr("r", 5).attr("fill", "#d1d5db").attr("opacity", 0.5).attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1).attr("r", 7);
      const isPareto = paretoPoints.some(p => p.name === d.name);
      tooltip.html(`
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.sis.toFixed(3)}</div>
        </div>
        <div class="tooltip-footer" style="color:var(--text-muted);">${isPareto ? '✓ Pareto-optimal' : 'Not on frontier'}</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.5).attr("r", 5);
      tooltip.style("visibility", "hidden");
    });

  svg.selectAll("circle.pareto-point").data(paretoPoints).enter().append("circle").attr("class", "pareto-point")
    .attr("cx", d => xScale(d.price)).attr("cy", d => yScale(d.sis)).attr("r", 6).attr("fill", "var(--cluster-high)").attr("stroke", "#fff").attr("stroke-width", 2).attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 8);
      tooltip.html(`
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.sis.toFixed(3)}</div>
        </div>
        <div class="tooltip-footer tooltip-pareto">✓ Pareto-optimal</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("r", 6);
      tooltip.style("visibility", "hidden");
    });

  return paretoPoints;
}

/* ========== RECOMMENDATIONS - SORTED BY PARETO SCORE ========== */

function buildAndRenderRecommendations() {
  if (!PROCESSED_ROWS || !window.buildRecommendations) return;

  const { maxSustainability, bestValue, balanced } = window.buildRecommendations(PROCESSED_ROWS, 5);

  // Revert to original logical order: Max Sustainability, Best Value, Balanced Trade-off
  // Each category is sorted by its primary metric (SIS, Price, or Balance Score) in app.js
  renderRecommendationTab('max-sustainability', maxSustainability);
  renderRecommendationTab('best-value', bestValue);
  renderRecommendationTab('balanced', balanced);

  setupRecommendationTabs();
}

function renderRecommendationTab(tabId, items) {
  const container = document.querySelector(`#reco-${tabId} .reco-list`);
  if (!container) return;

  container.innerHTML = "";

  if (items.length === 0) {
    container.innerHTML = "<p style='color: var(--text-muted); font-size: 13px;'>No Pareto-optimal brands found in this category.</p>";
    return;
  }

  items.forEach((item, idx) => {
    const brand = item.Brand_Name || item.Brand_ID || "Unknown";
    const sis = item.SIS || 0;
    const price = item.Average_Price_USD || 0;
    const material = item.Material_Type || "N/A";
    const cert = item.Certifications || "None";
    const recycling = item.Recycling_Programs || "No";

    const sisClass = sis > 0.7 ? "reco-high" : sis > 0.5 ? "reco-mid" : "reco-low";

    const div = document.createElement("div");
    div.className = `reco-item ${sisClass}`;
    div.innerHTML = `
      <div class="reco-header">
        <div>
          <div class="reco-brand">${brand}</div>
          <div class="reco-tagline">${material}</div>
        </div>
      </div>
      <div class="reco-metrics">
        <span>📊 SIS ${sis.toFixed(3)}</span>
        <span>💵 $${price.toFixed(2)}</span>
        <span>♻️ ${recycling}</span>
        <span>🏅 ${cert}</span>
      </div>
      <div class="reco-pill-row">
        <span class="reco-pill reco-pill-pareto">Pareto-Optimal</span>
        ${tabId === 'max-sustainability' ? '<span class="reco-pill">Top SIS in Pareto Set</span>' : ''}
        ${tabId === 'best-value' ? '<span class="reco-pill">Lowest Price in Pareto Set</span>' : ''}
        ${tabId === 'balanced' ? '<span class="reco-pill">Closest to Ideal Trade-off</span>' : ''}
      </div>
      <div class="reco-note">Note: Pareto-optimal solutions are not ranked. Sorted by category logic (e.g., Max SIS for Max Sustainability). Balance score is based on Distance-to-Ideal metric.</div>
    `;
    container.appendChild(div);
  });
}

function setupRecommendationTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.reco-tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`reco-${targetTab}`).classList.add('active');
    });
  });
}

/* ========== EDA CHARTS - BEAUTIFUL LAYOUT MATCHING IMAGE ========== */

function renderEdaCharts() {
  renderEdaMaterial();
  renderEdaCountry();
  renderEdaTrend();
  renderEdaYear();
}

function renderEdaMaterial() {
  const tooltip = createTooltip("material-tooltip");
  const container = document.getElementById("eda-material");
  const insightDiv = document.getElementById("eda-material-insight");
  if (!container || !MATERIAL_AGG) return;

  container.innerHTML = "";
  const data = MATERIAL_AGG.sort((a, b) => b.meanSIS - a.meanSIS).slice(0, 10);

  const width = container.clientWidth || 500;
  const height = container.clientHeight || 250;
  const padding = { top: 30, right: 60, bottom: 50, left: 100 };

  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const yScale = d3.scaleBand().domain(data.map(d => d.Material_Type)).range([padding.top, height - padding.bottom]).padding(0.25);
  const xScalePrice = d3.scaleLinear().domain([0, d3.max(data, d => d.meanPrice) * 1.1]).range([padding.left, width - padding.right]);
  const xScaleSIS = d3.scaleLinear().domain([0, 1]).range([padding.left, width - padding.right]);

  // Bars for Price (light green)
  svg.selectAll("rect").data(data).enter().append("rect")
    .attr("x", padding.left)
    .attr("y", d => yScale(d.Material_Type))
    .attr("width", d => xScalePrice(d.meanPrice) - padding.left)
    .attr("height", yScale.bandwidth())
    .attr("fill", "#7dd3c0")
    .attr("opacity", 0.85)
    .attr("rx", 2)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("opacity", 1);
      tooltip.html(`
        <div class="tooltip-header">${d.country}</div>
        <div class="tooltip-body">
          <div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div>
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function() {
      d3.select(this).attr("opacity", 0.85);
      tooltip.style("visibility", "hidden");
    });

  // Line connecting SIS dots (dark green)
  const lineGen = d3.line()
    .x(d => xScaleSIS(d.meanSIS))
    .y(d => yScale(d.Material_Type) + yScale.bandwidth() / 2);
  
  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#059669")
    .attr("stroke-width", 2)
    .attr("d", lineGen)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("r", 7);
      tooltip.html(`
        <div class="tooltip-header">Year: ${d.year}</div>
        <div class="tooltip-body">
          <div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div>
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function() {
      d3.select(this).attr("r", 4);
      tooltip.style("visibility", "hidden");
    });

  // Dots for SIS (dark green)
  svg.selectAll("circle").data(data).enter().append("circle")
    .attr("cx", d => xScaleSIS(d.meanSIS))
    .attr("cy", d => yScale(d.Material_Type) + yScale.bandwidth() / 2)
    .attr("r", 5)
    .attr("fill", "#059669")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("r", 7);
      tooltip.html(`
        <div class="tooltip-header">${d.country}</div>
        <div class="tooltip-body">
          <div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div>
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function() {
      d3.select(this).attr("r", 5);
      tooltip.style("visibility", "hidden");
    });

  // Left Y-axis (materials)
  svg.append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale))
    .selectAll("text")
    .style("font-size", "11px")
    .style("font-weight", "500");

  // Bottom X-axis (Price)
  svg.append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScalePrice).ticks(5))
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "#7dd3c0");

  // Right Y-axis (SIS)
  svg.append("g")
    .attr("transform", `translate(${width - padding.right},0)`)
    .call(d3.axisRight(xScaleSIS).ticks(5))
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "#059669");

  // Axis labels
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("fill", "#7dd3c0")
    .attr("font-weight", "600")
    .text("Average Price (USD)");

  svg.append("text")
    .attr("x", width - 10)
    .attr("y", 20)
    .attr("text-anchor", "end")
    .attr("font-size", "11px")
    .attr("fill", "#059669")
    .attr("font-weight", "600")
    .text("SIS →");

  // Insight box
  if (insightDiv && data.length > 0) {
    const best = data[0];
    const mostExpensive = data.reduce((max, d) => d.meanPrice > max.meanPrice ? d : max, data[0]);
    const top10List = data.map(d => d.Material_Type).join(', ');
    
    insightDiv.innerHTML = `
      <div class="eda-insight-box">
        <div class="insight-header">Top 10 Materials:</div>
        <div class="insight-list">${top10List}</div>
        <div class="insight-text">
          <strong>Insight:</strong> <strong>${best.Material_Type}</strong> has the highest average SIS (${best.meanSIS.toFixed(3)}). 
          <strong>${mostExpensive.Material_Type}</strong> is the most expensive ($${mostExpensive.meanPrice.toFixed(2)}).
        </div>
        <div class="insight-recommendation">
          <strong>Recommendation:</strong> Consider the trade-off between SIS and Price for your material sourcing strategy.
        </div>
      </div>
    `;
  }
}

function renderEdaCountry() {
  const tooltip = createTooltip("country-tooltip");
  const container = document.getElementById("eda-country");
  const insightDiv = document.getElementById("eda-country-insight");
  if (!container || !PROCESSED_ROWS) return;

  const countryMap = new Map();
  PROCESSED_ROWS.forEach(r => {
    const country = r.Country || "Unknown";
    if (!countryMap.has(country)) {
      countryMap.set(country, { country, sumSIS: 0, sumPrice: 0, count: 0 });
    }
    const c = countryMap.get(country);
    c.sumSIS += r.SIS || 0;
    c.sumPrice += r.Average_Price_USD || 0;
    c.count += 1;
  });

  const data = Array.from(countryMap.values()).map(c => ({
    country: c.country,
    meanSIS: c.sumSIS / c.count,
    meanPrice: c.sumPrice / c.count,
    count: c.count
  })).sort((a, b) => b.meanSIS - a.meanSIS).slice(0, 10);

  container.innerHTML = "";
  const width = container.clientWidth || 500;
  const height = container.clientHeight || 250;
  const padding = { top: 30, right: 60, bottom: 50, left: 100 };

  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const yScale = d3.scaleBand().domain(data.map(d => d.country)).range([padding.top, height - padding.bottom]).padding(0.25);
  const xScalePrice = d3.scaleLinear().domain([0, d3.max(data, d => d.meanPrice) * 1.1]).range([padding.left, width - padding.right]);
  const xScaleSIS = d3.scaleLinear().domain([0, 1]).range([padding.left, width - padding.right]);

  // Bars for Price (light green)
  svg.selectAll("rect").data(data).enter().append("rect")
    .attr("x", padding.left)
    .attr("y", d => yScale(d.country))
    .attr("width", d => xScalePrice(d.meanPrice) - padding.left)
    .attr("height", yScale.bandwidth())
    .attr("fill", "#7dd3c0")
    .attr("opacity", 0.85)
    .attr("rx", 2)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("opacity", 1);
      tooltip.html(`
        <div class="tooltip-header">${d.Material_Type}</div>
        <div class="tooltip-body">
          <div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div>
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function() {
      d3.select(this).attr("opacity", 0.85);
      tooltip.style("visibility", "hidden");
    });

  // Line connecting SIS dots (dark green)
  const lineGen = d3.line()
    .x(d => xScaleSIS(d.meanSIS))
    .y(d => yScale(d.country) + yScale.bandwidth() / 2);
  
  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#059669")
    .attr("stroke-width", 2)
    .attr("d", lineGen);

  // Dots for SIS (dark green)
  svg.selectAll("circle").data(data).enter().append("circle")
    .attr("cx", d => xScaleSIS(d.meanSIS))
    .attr("cy", d => yScale(d.country) + yScale.bandwidth() / 2)
    .attr("r", 5)
    .attr("fill", "#059669")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("r", 7);
      tooltip.html(`
        <div class="tooltip-header">${d.country}</div>
        <div class="tooltip-body">
          <div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div>
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function() {
      d3.select(this).attr("r", 5);
      tooltip.style("visibility", "hidden");
    });
  svg.append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale))
    .selectAll("text")
    .style("font-size", "11px")
    .style("font-weight", "500");

  // Bottom X-axis (Price)
  svg.append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScalePrice).ticks(5))
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "#7dd3c0");

  // Right Y-axis (SIS)
  svg.append("g")
    .attr("transform", `translate(${width - padding.right},0)`)
    .call(d3.axisRight(xScaleSIS).ticks(5))
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "#059669");

  // Axis labels
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("fill", "#7dd3c0")
    .attr("font-weight", "600")
    .text("Average Price (USD)");

  svg.append("text")
    .attr("x", width - 10)
    .attr("y", 20)
    .attr("text-anchor", "end")
    .attr("font-size", "11px")
    .attr("fill", "#059669")
    .attr("font-weight", "600")
    .text("SIS →");

  // Insight box
  if (insightDiv && data.length > 0) {
    const best = data[0];
    const mostExpensive = data.reduce((max, d) => d.meanPrice > max.meanPrice ? d : max, data[0]);
    const top10List = data.map(d => d.country).join(', ');
    
    insightDiv.innerHTML = `
      <div class="eda-insight-box">
        <div class="insight-header">Top 10 Countries:</div>
        <div class="insight-list">${top10List}</div>
        <div class="insight-text">
          <strong>Insight:</strong> <strong>${best.country}</strong> has the highest average SIS (${best.meanSIS.toFixed(3)}). 
          <strong>${mostExpensive.country}</strong> is the most expensive ($${mostExpensive.meanPrice.toFixed(2)}).
        </div>
        <div class="insight-recommendation">
          <strong>Recommendation:</strong> Consider sourcing from countries with high SIS scores for better sustainability.
        </div>
      </div>
    `;
  }
}

function renderEdaTrend() {
  const tooltip = createTooltip("trend-tooltip");
  const container = document.getElementById("eda-trend");
  const insightDiv = document.getElementById("eda-trend-insight");
  if (!container || !PROCESSED_ROWS) return;

  const trendMap = new Map();
  PROCESSED_ROWS.forEach(r => {
    const trend = r.Market_Trend || "Unknown";
    if (!trendMap.has(trend)) {
      trendMap.set(trend, { trend, sumSIS: 0, count: 0 });
    }
    const t = trendMap.get(trend);
    t.sumSIS += r.SIS || 0;
    t.count += 1;
  });

  const data = Array.from(trendMap.values()).map(t => ({
    trend: t.trend,
    meanSIS: t.sumSIS / t.count,
    count: t.count
  })).sort((a, b) => b.count - a.count);

  container.innerHTML = "";
  const width = container.clientWidth || 500;
  const height = container.clientHeight || 250;
  const padding = { top: 30, right: 60, bottom: 50, left: 100 };

  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const yScale = d3.scaleBand().domain(data.map(d => d.trend)).range([padding.top, height - padding.bottom]).padding(0.25);
  const xScaleCount = d3.scaleLinear().domain([0, d3.max(data, d => d.count) * 1.1]).range([padding.left, width - padding.right]);
  const xScaleSIS = d3.scaleLinear().domain([0, 1]).range([padding.left, width - padding.right]);

  // Bars for Count (light green)
  svg.selectAll("rect").data(data).enter().append("rect")
    .attr("x", padding.left)
    .attr("y", d => yScale(d.trend))
    .attr("width", d => xScaleCount(d.count) - padding.left)
    .attr("height", yScale.bandwidth())
    .attr("fill", "#7dd3c0")
    .attr("opacity", 0.85)
    .attr("rx", 2)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("opacity", 1);
      tooltip.html(`
        <div class="tooltip-header">${d.trend}</div>
        <div class="tooltip-body">
          <div><strong>Count:</strong> ${d.count}</div>
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function() {
      d3.select(this).attr("r", 4);
      tooltip.style("visibility", "hidden");
    });

  // Line connecting SIS dots (dark green)
  const lineGen = d3.line()
    .x(d => xScaleSIS(d.meanSIS))
    .y(d => yScale(d.trend) + yScale.bandwidth() / 2);
  
  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#059669")
    .attr("stroke-width", 2)
    .attr("d", lineGen);

  // Dots for SIS (dark green)
  svg.selectAll("circle").data(data).enter().append("circle")
    .attr("cx", d => xScaleSIS(d.meanSIS))
    .attr("cy", d => yScale(d.trend) + yScale.bandwidth() / 2)
    .attr("r", 5)
    .attr("fill", "#059669")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("r", 7);
      tooltip.html(`
        <div class="tooltip-header">Year: ${d.year}</div>
        <div class="tooltip-body">
          <div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div>
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function() {
      d3.select(this).attr("r", 4);
      tooltip.style("visibility", "hidden");
    });

  // Left Y-axis
  svg.append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScale))
    .selectAll("text")
    .style("font-size", "11px")
    .style("font-weight", "500");

  // Bottom X-axis (Count)
  svg.append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScaleCount).ticks(5))
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "#7dd3c0");

  // Right Y-axis (SIS)
  svg.append("g")
    .attr("transform", `translate(${width - padding.right},0)`)
    .call(d3.axisRight(xScaleSIS).ticks(5))
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "#059669");

  // Axis labels
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("fill", "#7dd3c0")
    .attr("font-weight", "600")
    .text("Count (Left Axis)");

  svg.append("text")
    .attr("x", width - 10)
    .attr("y", 20)
    .attr("text-anchor", "end")
    .attr("font-size", "11px")
    .attr("fill", "#059669")
    .attr("font-weight", "600")
    .text("SIS →");

  // Insight box
  if (insightDiv && data.length > 0) {
    const mostFrequent = data[0];
    const highestSIS = data.reduce((max, d) => d.meanSIS > max.meanSIS ? d : max, data[0]);
    const trendList = data.map(d => d.trend).join(', ');
    
    insightDiv.innerHTML = `
      <div class="eda-insight-box">
        <div class="insight-header">Market Trend Analysis:</div>
        <div class="insight-list">Trends analyzed: ${trendList}</div>
        <div class="insight-text">
          <strong>Insight:</strong> Trend <strong>${mostFrequent.trend}</strong> is the most frequent (${mostFrequent.count} items). 
          Trend <strong>${highestSIS.trend}</strong> has the highest average SIS (${highestSIS.meanSIS.toFixed(3)}).
        </div>
        <div class="insight-recommendation">
          <strong>Recommendation:</strong> Align product development with high-SIS trends for market advantage.
        </div>
      </div>
    `;
  }
}

function renderEdaYear() {
  const tooltip = createTooltip("year-tooltip");
  const container = document.getElementById("eda-year");
  const insightDiv = document.getElementById("eda-year-insight");
  if (!container || !PROCESSED_ROWS) return;

  const yearMap = new Map();
  PROCESSED_ROWS.forEach(r => {
    const year = r.Year || 0;
    if (year === 0) return;
    if (!yearMap.has(year)) {
      yearMap.set(year, { year, sumSIS: 0, sumPrice: 0, count: 0 });
    }
    const y = yearMap.get(year);
    y.sumSIS += r.SIS || 0;
    y.sumPrice += r.Average_Price_USD || 0;
    y.count += 1;
  });

  const data = Array.from(yearMap.values()).map(y => ({
    year: y.year,
    meanSIS: y.sumSIS / y.count,
    meanPrice: y.sumPrice / y.count,
    count: y.count
  })).sort((a, b) => a.year - b.year);

  container.innerHTML = "";
  const width = container.clientWidth || 500;
  const height = container.clientHeight || 250;
  const padding = { top: 30, right: 60, bottom: 50, left: 60 };

  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleLinear().domain(d3.extent(data, d => d.year)).range([padding.left, width - padding.right]);
  const yScalePrice = d3.scaleLinear().domain([0, d3.max(data, d => d.meanPrice) * 1.1]).range([height - padding.bottom, padding.top]);
  const yScaleSIS = d3.scaleLinear().domain([0, 1]).range([height - padding.bottom, padding.top]);

  // Line for Price (light green)
  const linePrice = d3.line().x(d => xScale(d.year)).y(d => yScalePrice(d.meanPrice));
  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#7dd3c0")
    .attr("stroke-width", 2.5)
    .attr("d", linePrice);

  // Dots for Price
  svg.selectAll("circle.price").data(data).enter().append("circle")
    .attr("class", "price")
    .attr("cx", d => xScale(d.year))
    .attr("cy", d => yScalePrice(d.meanPrice))
    .attr("r", 4)
    .attr("fill", "#7dd3c0")
    .attr("stroke", "#fff")    .attr("stroke-width", 2)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("r", 7);
      tooltip.html(`
        <div class="tooltip-header">${d.country}</div>
        <div class="tooltip-body">
          <div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div>
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function() {
      d3.select(this).attr("opacity", 0.85);
      tooltip.style("visibility", "hidden");
    });

  // Line for SIS (dark green dashed)
  const lineSIS = d3.line().x(d => xScale(d.year)).y(d => yScaleSIS(d.meanSIS));
  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#059669")
    .attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "5,3")
    .attr("d", lineSIS);

  // Dots for SIS
  svg.selectAll("circle.sis").data(data).enter().append("circle")
    .attr("class", "sis")
    .attr("cx", d => xScale(d.year))
    .attr("cy", d => yScaleSIS(d.meanSIS))
    .attr("r", 4)
    .attr("fill", "#059669")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("r", 7);
      tooltip.html(`
        <div class="tooltip-header">${d.trend}</div>
        <div class="tooltip-body">
          <div><strong>Count:</strong> ${d.count}</div>
          <div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div>
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function() {
      d3.select(this).attr("r", 5);
      tooltip.style("visibility", "hidden");
    });

  // Bottom X-axis
  svg.append("g")
    .attr("transform", `translate(0,${height - padding.bottom})`)
    .call(d3.axisBottom(xScale).ticks(data.length).tickFormat(d3.format("d")))
    .selectAll("text")
    .style("font-size", "10px");

  // Left Y-axis (Price)
  svg.append("g")
    .attr("transform", `translate(${padding.left},0)`)
    .call(d3.axisLeft(yScalePrice).ticks(5))
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "#7dd3c0");

  // Right Y-axis (SIS)
  svg.append("g")
    .attr("transform", `translate(${width - padding.right},0)`)
    .call(d3.axisRight(yScaleSIS).ticks(5))
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "#059669");

  // Legend
  const legendY = 20;
  svg.append("line")
    .attr("x1", width - 180)
    .attr("y1", legendY)
    .attr("x2", width - 150)
    .attr("y2", legendY)
    .attr("stroke", "#7dd3c0")
    .attr("stroke-width", 2.5);
  svg.append("text")
    .attr("x", width - 145)
    .attr("y", legendY + 4)
    .attr("font-size", "11px")
    .attr("fill", "#7dd3c0")
    .attr("font-weight", "600")
    .text("Price");
  
  svg.append("line")
    .attr("x1", width - 180)
    .attr("y1", legendY + 20)
    .attr("x2", width - 150)
    .attr("y2", legendY + 20)
    .attr("stroke", "#059669")
    .attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "5,3");
  svg.append("text")
    .attr("x", width - 145)
    .attr("y", legendY + 24)
    .attr("font-size", "11px")
    .attr("fill", "#059669")
    .attr("font-weight", "600")
    .text("SIS");

  // Insight box
  if (insightDiv && data.length > 0) {
    const latest = data[data.length - 1];
    const earliest = data[0];
    const timeRange = `${earliest.year} to ${latest.year}`;
    
    insightDiv.innerHTML = `
      <div class="eda-insight-box">
        <div class="insight-header">Time Trend:</div>
        <div class="insight-list">Data spans from ${timeRange}.</div>
        <div class="insight-text">
          <strong>Insight:</strong> In ${latest.year}, the average SIS was ${latest.meanSIS.toFixed(3)} and the average price was $${latest.meanPrice.toFixed(2)}.
        </div>
        <div class="insight-recommendation">
          <strong>Recommendation:</strong> Monitor the trend to see if sustainability (SIS increasing) or if prices are changing.
        </div>
      </div>
    `;
  }
}

/* ========== MLP PREDICTION - FIXED ========== */

const trainModelBtn = document.getElementById("train-model-btn");
const predictionForm = document.getElementById("prediction-form");
const predictionStatus = document.getElementById("prediction-status");
const predictBtn = document.getElementById("predict-btn");
const predictionResult = document.getElementById("prediction-result");

if (trainModelBtn) {
  trainModelBtn.addEventListener("click", async () => {
    if (!PROCESSED_ROWS || PROCESSED_ROWS.length === 0) {
      alert("Please load and process data first!");
      return;
    }

    predictionStatus.textContent = "Training model... This may take a moment.";
    trainModelBtn.disabled = true;

    try {
      await window.trainMLPPredictor(PROCESSED_ROWS);
      predictionStatus.textContent = "✓ Model trained successfully! You can now predict sustainability ratings.";
      predictionForm.style.display = "block";
    } catch (error) {
      predictionStatus.textContent = `✗ Training failed: ${error.message}`;
      trainModelBtn.disabled = false;
    }
  });
}

if (predictBtn) {
  predictBtn.addEventListener("click", () => {
    const carbon = parseFloat(document.getElementById("pred-carbon").value);
    const water = parseFloat(document.getElementById("pred-water").value);
    const waste = parseFloat(document.getElementById("pred-waste").value);
    const recycling = parseFloat(document.getElementById("pred-recycling").value);

    if (isNaN(carbon) || isNaN(water) || isNaN(waste) || isNaN(recycling)) {
      alert("Please fill in all fields with valid numbers!");
      return;
    }

    if (!window.predictSustainabilityRating) {
      alert("Model not trained yet. Please train the model first!");
      return;
    }

    try {
      const rating = window.predictSustainabilityRating(carbon, water, waste, recycling);

      // FIX: Ensure rating is a number before calling toFixed
      if (rating !== null && rating !== undefined && typeof rating === 'number' && !isNaN(rating)) {
        predictionResult.innerHTML = `
          <div class="prediction-success">
            <strong>✓ Predicted Sustainability Rating:</strong> ${rating.toFixed(4)}
            <div class="prediction-details">
              Based on: Carbon ${carbon} MT, Water ${water} L, Waste ${waste} KG, Recycling ${recycling}
            </div>
          </div>
        `;
        predictionResult.style.display = "block";
      } else {
        predictionResult.innerHTML = `<strong>Error:</strong> Prediction returned invalid value. Please check your inputs and try again.`;
        predictionResult.style.display = "block";
      }
    } catch (error) {
      predictionResult.innerHTML = `<strong>Error:</strong> ${error.message}`;
      predictionResult.style.display = "block";
    }
  });
}
