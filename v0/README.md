# SustainGraph — AI-Powered Sustainable Fashion Analytics & Recommendation

_**Link page:**_ https://123456789hien.github.io/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/v0/

**SustainGraph** is a browser-based web application designed to analyze, compare, and recommend sustainable fashion brands based on environmental, social, and governance (ESG) criteria. The tool allows users to explore sustainability metrics, cluster materials by environmental impact, and receive smart recommendations that balance sustainability and cost.

---

## 📂 Project Structure

- `index.html`  
  The main HTML file that defines the user interface. It includes sections for:
  - File upload / sample data load  
  - Filters (country, material, year, certifications, trend)  
  - KPI cards (average sustainability score, carbon footprint, water usage, price)  
  - Material clustering scatter plots  
  - Recommendations table  
  - Exploratory Data Analysis (EDA) charts  

- `style.css`  
  Styles for the user interface, including:
  - Layout, fonts, and colors  
  - KPI cards and legend styling  
  - Scatter plots and bar charts  
  - Recommendations table styling  

- `app.js`  
  Core application logic, responsible for:
  - Parsing CSV data (`parseCSVText`)  
  - Preprocessing data: normalizing numerical values, encoding categorical variables, handling missing data  
  - Calculating **Sustainability Index Score (SIS)** for each brand  
  - Clustering materials using KMeans and generating cluster coordinates  
  - Computing recommendation scores based on SIS, price, and user priority  

- `script.js`  
  Handles user interactions and DOM rendering:
  - File upload and sample data loading  
  - Event handling for filter changes and priority slider  
  - Data processing pipeline: filter → SIS calculation → clustering → recommendations → KPI & charts update  
  - Rendering KPI cards, scatter plots, bar charts, and recommendation tables  
  - Generating EDA charts (Price vs SIS, top countries by brand count)  

- `Kaggle_sust_dataset.csv` (download from Kaggle "Sustainable Fashion: Eco-Friendly Trends": https://www.kaggle.com/datasets/waqi786/sustainable-fashion-eco-friendly-trends?utm_source=chatgpt.com
---

## ⚙️ Features

### 1. Data Upload & Auto-Load
- Upload your own CSV file containing fashion brand data.  
- Auto-load sample CSV for testing (`Kaggle_sust_dataset.csv`) or from GitHub URL.  

### 2. Data Preprocessing
- Normalizes numerical features (Carbon Footprint, Water Usage, Waste Production).  
- Converts categorical variables (Yes/No, A/B/C/D ratings) to numerical values.  
- Handles multiple column naming variations for materials (`Material_Type`, `material`, `Material`).  
- Missing or invalid data is handled gracefully (default or average values).

### 3. Filtering
- Filter brands by:
  - Country  
  - Material type  
  - Year of production  
  - Certifications  
  - Market trend  
- Brand filter is disabled due to high cardinality.

### 4. KPI Dashboard
Displays key sustainability metrics for the currently filtered data:
- Average Sustainability Index Score (SIS)  
- Average Carbon Footprint (MT)  
- Average Water Usage (Liters)  
- Average Price (USD)  

### 5. Material Clustering & Visualization
- Uses KMeans to cluster materials based on environmental impact (Carbon, Water, Waste).  
- Scatter plot visualization (CO₂ vs Water) colored by cluster.  
- Cluster legend indicates Low / Medium / High environmental impact.  

### 6. Smart Recommendations
- Top 10 recommended brands based on **Sustainability Index Score (SIS)** and **price**.  
- User-adjustable priority slider to balance sustainability vs affordability.  
- Each recommendation includes detailed metrics: SIS, Carbon Footprint, Water Usage, Price, Rating, Eco-friendliness, Recycling programs, Trend, Certifications.

### 7. Exploratory Data Analysis (EDA)
- Scatter plot: Price vs SIS, colored by top 6 materials (+ Others).  
- Bar chart: Top 10 countries by number of sustainable brands.  
- Updates dynamically based on filters.  

---

## 🛠️ How to Use

1. Open `index.html` in any modern browser (Chrome, Firefox, Edge).  
2. Upload a CSV file or auto-load sample data.  
3. Apply optional filters for country, material, year, certification, and trend.  
4. Adjust the priority slider if you want to weigh sustainability vs price differently.  
5. Click **Run Analysis & Recommendations** to:
   - Calculate and display KPIs  
   - Generate material clusters and scatter plots  
   - Show top 10 recommended brands  
   - Render EDA charts  

---

## 🧮 Data Format Requirements

The CSV should contain the following fields (supports multiple column name variants):

- `Brand_ID`, `Brand_Name`  
- `Country`  
- `Year`  
- `Sustainability_Rating` (A/B/C/D)  
- `Material_Type` / `material` / `Material`  
- `Eco_Friendly_Manufacturing` (Yes/No)  
- `Carbon_Footprint_MT`  
- `Water_Usage_Liters`  
- `Waste_Production_KG`  
- `Recycling_Programs` (Yes/No)  
- `Product_Lines`  
- `Average_Price_USD`  
- `Market_Trend`  
- `Certifications`  

Missing or invalid values are processed with default or average values.

---

## 🔧 Dependencies

- [D3.js v7](https://d3js.org/) — for generating scatter plots and bar charts.  
- Pure front-end application; no backend required.  
- No external CSV parser required; uses custom parsing in `app.js`.  

---

## 📈 Notes & Limitations

- Brand filter disabled due to high cardinality.  
- Clustering uses fixed 3 clusters (Low/Medium/High impact).  
- Scatter plot uses normalized CO₂ vs Water; not a true PCA.  
- EDA charts reflect filtered data only.  
- Auto-load feature requires `AUTOLOAD_URL` to be updated for GitHub-hosted CSV.  

---

## 🖋️ Author

**Đỗ Thị Hiền (Sally)**  
- Master’s student / Research in Sustainable Fashion Analytics   

---

## 🔗 License

MIT License — freely use, modify, and distribute.
