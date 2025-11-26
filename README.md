# SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-

_**Link page:**_ https://123456789hien.github.io/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/

---

### Interactive Sustainability Analytics • SIS Scoring • Material Impact • EDA • Eco-Recommendation Engine

*A fully client-side ML dashboard built with HTML, CSS, JavaScript, TensorFlow.js and D3.js.*

---

## **1. Overview**

SustainGraph is an end-to-end **AI-driven Sustainable Fashion Decision Dashboard** that analyzes the environmental and economic performance of fashion brands, materials and products.
The system runs **100% on the client-side** using vanilla JavaScript, D3.js and TensorFlow.js — no backend, no Python, no server.

The dashboard provides:

* Full **Sustainability Index Score (SIS)** computation
* **Carbon, Water & Waste** footprint normalization
* Year, country, trend and material **EDA visualizations**
* Material-level **PCA-style environmental mapping**
* **K-Means clustering** for impact grouping
* Hybrid **Recommendation Engine (SIS × Price)**
* Fully interactive **filters**, instant recalculation
* Upload or auto-load CSV datasets

It is a complete research and decision-support system for:

* Sustainable fashion companies
* Eco-policy researchers
* Brands analyzing supply chain impacts
* Students exploring sustainability and data analytics

---

## **2. Key Features**

### **✔ Upload & Auto-Load Dataset**

* Upload any CSV file
* Or use **Auto Upload** (GitHub-hosted dataset)
* Runs offline once loaded
* Custom CSV parser, no PapaParse required

---

### **✔ Data Preprocessing & Normalization**

SustainGraph cleans and normalizes:

* Carbon_Footprint_MT
* Water_Usage_Liters
* Waste_Production_KG
* Sustainability_Rating (A–E)
* Eco_Friendly_Manufacturing (Yes/No)
* Recycling_Programs
* Price normalization (min-max)

---

### **✔ Sustainability Index Score (SIS)**

The core metric:

```
envScore = average(1 - co2_norm, 1 - water_norm, 1 - waste_norm)
policyScore = average(ratingScore, ecoFriendlyScore, recyclingScore)
SIS = 0.7 * envScore + 0.3 * policyScore
```

Reflects **true environmental and policy impact**.

---

### **✔ Interactive Filters**

Filters that dynamically update every visualization:

* Country
* Material Type
* Year
* Certification
* Market Trend

---

### **✔ KPI Dashboard**

Automatically generated after processing:

* Average SIS
* Average Carbon Footprint
* Average Water Usage
* Average Waste Production
* Average Price

---

### **✔ PCA-Style Material Impact Map**

A 2D visualization capturing:

* CO₂ footprint
* Combined Water + Waste footprint
* Material popularity (bubble size)
* Cluster group (Low / Medium / High impact)

---

### **✔ Recommendation Engine**

A hybrid scoring function:

```
finalScore = priorityWeight * SIS + (1 - priorityWeight) * (1 - normalized_price)
```

Where:

* High priority = sustainability first
* Low priority = price-sensitive

Outputs Top 10 results with:

* CO₂, Water, Waste, SIS
* Price
* Eco-friendly tags
* Material × Country badges

---

### **✔ EDA (Exploratory Data Analysis)**

All graphs dynamically reflect filters:

#### **Material Analysis**

* SIS vs Price vs Material
* Material impact bubbles

#### **Country Analysis**

* Mean price bar chart
* SIS overlaid line
* Top eco countries

#### **Trend Analysis**

* Count of products per Market Trend
* SIS + Price annotations

#### **Year Analysis**

* Yearly SIS trend line
* Yearly Price trend line

Includes **side recommendations** for each chart.

---

### **✔ Fully Client-Side ML**

Using:

* Custom normalization
* Custom KMeans
* PCA-style dimensionality reduction
* TensorFlow.js (optional lightweight math)

---

## **3. Dataset Columns**
_**Link dataset**_: https://www.kaggle.com/datasets/waqi786/sustainable-fashion-eco-friendly-trends

Your CSV should include:

| Column                     | Required     | Description                 |
| -------------------------- | ------------ | --------------------------- |
| Brand_Name                 | Optional     | Brand-level grouping        |
| Country                    | Optional     | Enables country EDA         |
| Year                       | Optional     | Enables year trend analysis |
| Sustainability_Rating      | Optional     | A–E rating                  |
| Material_Type              | **Required** | Core clustering & EDA       |
| Eco_Friendly_Manufacturing | Optional     | Yes/No                      |
| Carbon_Footprint_MT        | Required     | Environmental impact        |
| Water_Usage_Liters         | Required     | Water footprint             |
| Waste_Production_KG        | Required     | Waste footprint             |
| Recycling_Programs         | Optional     | Yes/No                      |
| Average_Price_USD          | Required     | Price dimension             |
| Market_Trend               | Optional     | Trend-based EDA             |
| Certifications             | Optional     | ESG / eco labels            |

---

## **4. Project Structure**

```
/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard/
│── index.html                 # Main layout + UI components
│── style.css                  # Premium green UI theme, shadows, gradients
│── script.js                  # UI events, DOM wiring, EDA rendering
│── app.js                     # SIS computation, ML logic, clustering, PCA
│── Kaggle_sust_dataset.csv    # Sample dataset (optional)
│── README.md                  # Documentation
```

---

## **5. How to Run**

### **Option A — GitHub Pages (Recommended)**

1. Upload the entire folder
2. Go to
   *Settings → Pages → Branch = main → Root*
3. Open the generated link
4. Dashboard runs instantly

---

### **Option B — Local Browser**

Just open:

```
index.html
```

No installation needed.

---

## **6. Technology Stack**

| Purpose           | Technology                           |
| ----------------- | ------------------------------------ |
| Data parsing      | Custom CSV parser                    |
| ML logic          | JavaScript + TensorFlow.js           |
| Clustering        | Custom KMeans                        |
| PCA-style mapping | Custom 2D projection                 |
| Visualizations    | D3.js                                |
| UI                | Responsive CSS + gradients + shadows |

---

## **7. Use Cases**

### **For Companies**

* Analyze environmental performance
* Material sustainability ranking
* Eco-based supplier decisions

### **For Researchers**

* Study material impact
* Compare environmental footprints
* Explore sustainability vs pricing

### **For Consumers**

* Understand eco-friendly materials
* Compare brands transparently
* Balance price vs sustainability

---

## **8. Performance**

* Tested on datasets up to **20,000 rows**
* Instant EDA computation
* Clustering & PCA run in milliseconds
* Zero backend latency

---

## **9. Future Improvements**

* Full PCA (SVD) via TensorFlow.js
* SHAP-like interpretability for SIS
* Supplier vs brand comparison mode
* Time-series forecasting
* Neural embedding similarity for materials

---

## **10. Contribution**

Pull requests are welcome.
Feel free to suggest new visualizations or analytics features.

---

# **Thank you for using SustainGraph**

Empowering sustainable fashion through transparency, data and AI.
