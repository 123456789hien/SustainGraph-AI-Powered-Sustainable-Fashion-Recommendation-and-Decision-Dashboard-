/* Keep existing script intact, and only fix and add necessary changes for Material_Type filter */
const fileInput = document.getElementById("fileUpload");
const btnSample = document.getElementById("load-sample");
const btnAuto = document.getElementById("auto-upload");
const btnRun = document.getElementById("run-pipeline");
const statusEl = document.getElementById("load-status");

const brandFilter = document.getElementById("brand-filter");
const materialFilter = document.getElementById("material-filter");
const countryFilter = document.getElementById("country-filter");
const yearFilter = document.getElementById("year-filter");
const certFilter = document.getElementById("cert-filter");
const trendFilter = document.getElementById("trend-filter");
const prioritySelect = document.getElementById("priority");

const kpiRow = document.getElementById("kpi-row");
const pcaDiv = document.getElementById("pca-plot");
const recoList = document.getElementById("recommendations-list");

materialFilter.addEventListener("change", () => {
  // Handle material filter change
  const selectedMaterial = materialFilter.value;
  filterDataByMaterial(selectedMaterial);
});

function filterDataByMaterial(selectedMaterial) {
  const filtered = PROCESSED_ROWS.filter(
    (row) => row.Material_Type === selectedMaterial
  );
  renderTopRecommendations(filtered);
  renderEDA(filtered);
  clearSimilarAndHistory();
}

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

btnAuto.addEventListener("click", async () => {
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
