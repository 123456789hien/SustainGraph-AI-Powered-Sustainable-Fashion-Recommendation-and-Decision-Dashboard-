const fileInput = document.getElementById('file-input');
const loadSampleBtn = document.getElementById('load-sample');
const autoUploadBtn = document.getElementById('auto-upload');
const runBtn = document.getElementById('run-pipeline');
const brandFilter = document.getElementById('brand-filter');
const categoryFilter = document.getElementById('category-filter');
const materialFilter = document.getElementById('material-filter');
const prioritySelect = document.getElementById('priority');
const kpiValues = document.getElementById('kpi-values');
const pcaPlot = document.getElementById('pca-plot');
const materialClusters = document.getElementById('material-clusters');
const recommendationsList = document.getElementById('recommendations-list');

let rawRows = [];
let processedRows = [];
let stats = {};
let materialAgg = [];
let clusters = [];
let pcaCoords = { x: [], y: [] };

// Sự kiện tải mẫu dữ liệu
loadSampleBtn.addEventListener('click', async () => {
  try {
    const response = await fetch('./public/Kaggle_sust_dataset.csv');
    const text = await response.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
    loadData(parsed);
  } catch (error) {
    console.error('Error loading sample dataset', error);
  }
});

// Sự kiện khi người dùng chọn tệp CSV
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const parsed = await parseCSVFile(file);
  loadData(parsed);
});

// Sự kiện tải dữ liệu tự động từ GitHub
autoUploadBtn.addEventListener('click', async () => {
  try {
    const response = await fetch('https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/v11/public/Kaggle_sust_dataset.csv');
    const text = await response.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
    loadData(parsed);
  } catch (error) {
    console.error('Error auto-uploading dataset', error);
  }
});

// Hàm tải dữ liệu và cập nhật các bộ lọc
const loadData = (data) => {
  rawRows = data;
  updateFilters();
};

// Hàm cập nhật các bộ lọc (brand, category, material)
const updateFilters = () => {
  const brands = Array.from(new Set(rawRows.map(r => r.Brand).filter(Boolean))).sort();
  const categories = Array.from(new Set(rawRows.map(r => r.Category).filter(Boolean))).sort();
  const materials = Array.from(new Set(rawRows.map(r => r.Material_Type).filter(Boolean))).sort();

  brandFilter.innerHTML = `<option value="__all">All</option>` + brands.map(b => `<option value="${b}">${b}</option>`).join('');
  categoryFilter.innerHTML = `<option value="__all">All</option>` + categories.map(c => `<option value="${c}">${c}</option>`).join('');
  materialFilter.innerHTML = `<option value="__all">All</option>` + materials.map(m => `<option value="${m}">${m}</option>`).join('');
};

// Sự kiện khi chạy pipeline phân tích
runBtn.addEventListener('click', async () => {
  const brand = brandFilter.value;
  const category = categoryFilter.value;
  const material = materialFilter.value;
  const priority = parseFloat(prioritySelect.value);

  const filtered = rawRows.filter(r => {
    if (brand !== '__all' && r.Brand !== brand) return false;
    if (category !== '__all' && r.Category !== category) return false;
    if (material !== '__all' && r.Material_Type !== material) return false;
    return true;
  });

  if (filtered.length === 0) {
    alert('No data available for the selected filters');
    return;
  }

  const { rowsWithSIS, newStats } = normalizeAndComputeSIS(filtered);
  processedRows = rowsWithSIS;
  stats = newStats;
  updateKPI();

  const materialMatrix = materialAgg.map(a => [
    a.meanCarbon,
    a.meanWater,
    a.meanWaste,
    a.meanScore
  ]);
  const { centroids, assignments } = runKMeans(materialMatrix, 3);
  materialAgg = materialAgg.map((a, i) => ({ ...a, cluster: assignments[i] }));

  const pca = runPCA2(materialMatrix);
  pcaCoords = pca;

  const recommendations = recommend(processedRows, priority);
  displayRecommendations(recommendations);
});

// Cập nhật KPI trên giao diện
const updateKPI = () => {
  const avgSIS = processedRows.reduce((sum, r) => sum + (r.SIS || 0), 0) / processedRows.length;
  const avgCO2 = stats.mean.Carbon_Footprint || 0;
  const avgWater = stats.mean.Water_Usage || 0;
  const avgWaste = stats.mean.Waste_Generation || 0;

  kpiValues.innerHTML = `
    <div>Average SIS: ${avgSIS.toFixed(2)}</div>
    <div>Average CO₂: ${avgCO2.toFixed(2)} MT</div>
    <div>Average Water: ${avgWater.toFixed(0)} L</div>
    <div>Average Waste: ${avgWaste.toFixed(2)} KG</div>
  `;
};

// Hiển thị các khuyến nghị
const displayRecommendations = (recommendations) => {
  recommendationsList.innerHTML = recommendations.map(item => `
    <div class="top-similarity">
      <strong>${item.Brand}</strong> - ${item.Category} - ${item.Material_Type}<br />
      SIS: ${item.SIS.toFixed(2)} | CO₂: ${item.Carbon_Footprint.toFixed(2)} MT | Water: ${item.Water_Usage.toFixed(0)} L
    </div>
  `).join('');
};
