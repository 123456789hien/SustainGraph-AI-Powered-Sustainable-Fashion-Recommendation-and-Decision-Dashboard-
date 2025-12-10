# SustainGraph: AI-Powered Sustainable Fashion Recommendation and Decision Dashboard

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Production Ready](https://img.shields.io/badge/Status-Production%20Ready-brightgreen.svg)]()
[![Version: 2.1](https://img.shields.io/badge/Version-2.1-blue.svg)]()

## 🌟 Project Overview

**SustainGraph** is a sophisticated, AI-powered dashboard designed to assist fashion brands and supply chain managers in making data-driven decisions for sustainable sourcing and product development. It integrates advanced analytical techniques, including **Entropy Weighting**, **K-Means Clustering**, and **Multi-Objective Pareto Optimization**, to provide clear, actionable insights into the trade-offs between sustainability (SIS) and cost (Price).

The dashboard is built using pure HTML, CSS, and JavaScript, leveraging the power of **D3.js** for interactive and professional data visualization.

## ✨ Key Features

*   **Entropy Weighting Method:** Objectively determines the importance of environmental and policy attributes based on data variance (entropy), ensuring a data-driven approach to sustainability scoring.
*   **K-Means Clustering:** Groups materials based on their environmental and policy scores, validated using the **Elbow Method** for optimal cluster count.
*   **Multi-Objective Pareto Optimization:** Identifies **Pareto-Optimal** brands that offer the best possible trade-off between high Sustainability Index (SIS) and low Price.
*   **Professional Exploratory Data Analysis (EDA):** Provides dual-axis visualizations for Material, Country, Market Trend, and Year, complete with detailed tooltips and actionable insight boxes.
*   **Sustainability Attribute Prediction:** An optional Machine Learning (ML) extension to predict a product's Sustainability Rating based on its environmental attributes (Carbon, Water, Waste, Recycling).
*   **Interactive Design:** Clean, modern, and responsive design with a consistent color palette.

## 🚀 Getting Started

To run the SustainGraph dashboard locally or deploy it on a platform like GitHub Pages, follow these simple steps:

1.  **Clone the Repository:** Download or clone the repository containing the four core files (`index.html`, `style.css`, `app.js`, `script.js`).
2.  **Open `index.html`:** Launch the dashboard by opening `index.html` in any modern web browser (Chrome, Firefox, Edge).
3.  **Load Data:**
    *   Click **"Auto Upload"** to load the sample dataset automatically.
    *   *Alternatively*, click **"Upload CSV"** to load your own data (must conform to the required schema).
4.  **Run Analysis:** Click the **"🚀 Run Analysis"** button to process the data, perform clustering, calculate scores, and render all visualizations.

## 📊 Dashboard Sections Overview

### 4. Exploratory Data Insights (EDA)

This section provides a deep dive into the filtered dataset, utilizing a visually striking dual-axis design:

| Chart | Left Axis (Bars) | Right Axis (Dots/Line) | Insight Box | Design Highlight |
| :--- | :--- | :--- | :--- | :--- |
| **Material** | Average Price (USD) | Average SIS | Top 10 Materials, Price/SIS Trade-off | Green Bars + Dark Green Dots |
| **Country** | Average Price (USD) | Average SIS | Top 10 Countries, Sourcing Strategy | Dual-Axis, Interactive Tooltips |
| **Market Trend** | Count (Frequency) | Average SIS | Trend Analysis, SIS by Trend | Clear Actionable Recommendations |
| **Year** | Average Price (USD) | Average SIS | Time Trend Analysis | Price (Solid Line), SIS (Dashed Line) |

### 5. Material Clustering (k=Optimal)

Materials are clustered based on their normalized Environmental and Policy scores.

*   **Elbow Method Validation:** Shows the optimal number of clusters (`k`) used for the analysis.
*   **Cluster Scatter Plot:** Visualizes material clusters, with size representing brand count.
*   **Cluster Interpretation:** Provides a table of statistics (mean, variance, CV) for each cluster, highlighting that **cluster separation is primarily driven by policy scores**.

### 8. Multi-Objective Brand Recommendations

This section presents the results of the Pareto Optimization, offering three distinct strategic views:

| Tab | Sorting Logic | Primary Goal | Pill Tag |
| :--- | :--- | :--- | :--- |
| **Max Sustainability** | Highest SIS Score | Maximize Environmental Impact | Highest SIS |
| **Best Value** | Lowest Price | Minimize Cost | Lowest Price |
| **Balanced Trade-off** | Highest Pareto Score | Optimal Balance of SIS and Price | Balanced Trade-off |

**Note:** Pareto-optimal solutions are not ranked globally; they are sorted within each category based on the specific strategic goal.

### 9. Sustainability Attribute Prediction (Optional ML Extension)

Allows users to input environmental attributes to predict the resulting Sustainability Rating. The prediction model is robust, featuring:

*   **Input Validation:** Ensures all four input fields (Carbon, Water, Waste, Recycling) are valid.
*   **Accurate Output:** Predicted rating is displayed with 4 decimal places.
*   **Error Handling:** Clear messages for invalid inputs or prediction failures.

## 💻 Technical Details

### Pareto Score Calculation

The balanced trade-off is calculated using a weighted average of normalized SIS and the inverse of normalized Price:

```javascript
// Normalization
const sisNorm = (sis - minSIS) / (maxSIS - minSIS);
const priceNorm = (price - minPrice) / (maxPrice - minPrice);

// Pareto Score (50/50 weighting for balance)
const paretoScore = 0.5 * sisNorm + 0.5 * (1 - priceNorm);
```

### Prediction Robustness Fix

The prediction result handling ensures the output is a valid number before formatting:

```javascript
if (rating !== null && rating !== undefined && typeof rating === 'number' && !isNaN(rating)) {
  predictionResult.innerHTML = `Predicted Rating: ${rating.toFixed(4)}`;
} else {
  predictionResult.innerHTML = `Error: Prediction returned invalid value. Please check your inputs and try again.`;
}
```

## 📜 License

This project is licensed under the **MIT License**. See the LICENSE file for details.

## 👨‍💻 Version History

*   **v2.1 (Final)**: Fixed all remaining syntax errors (`tooltip` redeclaration, D3.js chaining), implemented all user-requested design changes (EDA layout, tooltips, recommendation sorting), and ensured full production readiness.
*   **v2.0**: Major feature integration, including Pareto Optimization and Entropy Weighting.
*   **v1.0**: Initial core dashboard structure and data loading.

---
**Status**: ✅ **PRODUCTION READY** | **Platform**: GitHub Pages | **Version**: 2.1 (Final)
