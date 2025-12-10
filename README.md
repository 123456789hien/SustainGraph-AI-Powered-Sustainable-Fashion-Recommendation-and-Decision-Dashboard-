\documentclass[conference]{IEEEtran}

\usepackage{graphicx}
\usepackage{amsmath}
\usepackage{booktabs}
\usepackage{multirow}
\usepackage{array}
\usepackage{caption}
\usepackage{tikz}
\usepackage{hyperref}

\begin{document}

\title{SustainGraph: An AI-Powered Entropy-Based Sustainable Fashion Analytics and Recommendation Framework}

\author{
\IEEEauthorblockN{Do Thi Hien}
\IEEEauthorblockA{
Graduate School of Business, HSE University, Moscow, Russia \\
Program: Business Analytics \& Big Data Systems \\
Email: (optional)
}
}

\maketitle

\begin{abstract}
This paper presents \textbf{SustainGraph}, an AI-powered sustainability analytics and recommendation framework for the fashion industry using the Kaggle dataset “Sustainable Fashion \& Eco-Friendly Trends” (5000 brands, 10 countries). The system integrates a full methodological pipeline combining (1) Entropy Weight Method for objective sustainability scoring, (2) K-Means clustering with Elbow-based validation, (3) Multi-Objective Optimization via Pareto Frontier analysis, and (4) an interpretable recommendation mechanism offering Best-Value and Max-Sustainability alternatives. The framework demonstrates that most variation in the dataset originates from policy-related attributes rather than environmental indicators, giving rise to a high policy weight (0.7933) and a lower environmental weight (0.2067). Clustering experiments indicate two dominant sustainability archetypes driven primarily by certification prevalence, footprint intensity, and pricing. Pareto Frontier analysis identifies three optimal materials and four optimal brands, marking the trade-off efficient frontier for corporate sourcing decisions. The results highlight how AI, supported by entropy weighting and MOO techniques, can offer actionable sustainability intelligence to both brands and consumers.
\end{abstract}

\begin{IEEEkeywords}
Sustainability Analytics, Entropy Weight Method, Pareto Frontier, Multi-Objective Optimization, Fashion Industry, K-Means Clustering, AI for Sustainability.
\end{IEEEkeywords}

\section{Introduction}
The fashion industry remains one of the highest contributors to environmental degradation due to water pollution, carbon emissions, and textile waste. Despite efforts to adopt eco-friendly processes, sustainability evaluation remains inconsistent, subjective, and often biased due to the lack of standardized scoring mechanisms. This motivates the development of \textbf{SustainGraph}, an AI-powered dashboard integrating objective statistical weighting, cluster analysis, and multi-objective optimization for sustainability decision-making.

This work builds on the Kaggle dataset ``Sustainable Fashion \& Eco-Friendly Trends'' (5000 entries) containing brand-level environmental metrics and policy attributes such as sustainability ratings, eco-friendly manufacturing, and recycling programs. We develop a scientific scoring method using the Entropy Weight Method and construct a recommendation system driven by Pareto-optimality.

\section{Related Work}
Prior literature on sustainability metrics often relies on subjective weighting or expert-driven schemes. Recent studies advocate for entropy-based objective weighting for multi-criteria environmental evaluations \cite{zhao2021entropy}. Multi-objective optimization (MOO) is widely applied for sustainability trade-offs in supply chains \cite{ghasemy2025}. Clustering methods are often used for environmental segmentation, though the selection of optimal cluster count remains a challenge \cite{larimian2013}.

However, none of these works integrate entropy weighting, validated clustering, Pareto frontier analysis, and interactive analytics into an accessible decision-support tool for fashion sustainability. SustainGraph bridges this methodological gap.

\section{Dataset Description}
We use the publicly available Kaggle dataset ``Sustainable Fashion \& Eco-Friendly Trends'' containing 5000 brands across 10 countries and 6 material types. The dataset includes:

\begin{itemize}
\item Carbon Footprint (MT)
\item Water Usage (Liters)
\item Waste Production (KG)
\item Sustainability Rating (A–D)
\item Eco-Friendly Manufacturing (Yes/No)
\item Recycling Programs (Yes/No)
\item Average Price (USD)
\item Market Trend
\item Certifications
\end{itemize}

Missing values were preprocessed through normalization and mapping transforms.

\section{Methodology}
The SustainGraph pipeline consists of six core methodological components.

\subsection{A. Entropy Weight Method (EWM)}
Environmental indicators were normalized:

\[
x' = \frac{x - x_{\min}}{x_{\max} - x_{\min}}
\]

Entropy is computed as:

\[
E_j = -k \sum_i p_{ij} \ln(p_{ij})
\]

Diversity (information utility):

\[
d_j = 1 - E_j
\]

Weights:

\[
w_j = \frac{d_j}{\sum d_j}
\]

Group-level weights were computed as:

\[
w_{\text{env}} = 0.2067, \quad w_{\text{policy}} = 0.7933
\]

\subsection{B. Sustainability Index Score (SIS)}
\[
SIS = w_{\text{env}} \cdot EnvScore + w_{\text{policy}} \cdot PolicyScore
\]

\subsection{C. K-Means Clustering (Elbow Validated)}
The optimal number of clusters was determined using the Elbow Method:

\[
WCSS_k = \sum_{clusters} \sum_{points} ||x_i - c_k||^2
\]

The optimal $k=2$.

\subsection{D. Pareto Frontier Optimization}
A brand $A$ dominates $B$ when:

\[
(SIS_A \geq SIS_B) \land (Price_A \leq Price_B)
\]

Pareto frontier identifies all non-dominated brands.

\subsection{E. Recommendation Categories}
Instead of a single ranking, we output two interpretable sets:

\begin{itemize}
\item \textbf{Max Sustainability:} highest SIS from the Pareto frontier
\item \textbf{Best Value:} lowest price within non-dominated set
\end{itemize}

\section{Results}

\subsection{A. Entropy Weight Analysis}
Table I summarizes the entropy-based indicator diversity and weights.

\begin{table}[h]
\centering
\caption{Entropy Weights for Indicator Groups}
\begin{tabular}{lccc}
\toprule
Indicator & Entropy & Diversity & Weight \\
\midrule
CO$_2$ & 0.9778 & 0.0222 & 0.3256 \\
Water & 0.9773 & 0.0227 & 0.3323 \\
Waste & 0.9766 & 0.0234 & 0.3421 \\
Rating & 0.9561 & 0.0439 & 0.2147 \\
Eco-Friendly & 0.9196 & 0.0804 & 0.3935 \\
Recycling & 0.9199 & 0.0801 & 0.3917 \\
\bottomrule
\end{tabular}
\end{table}

Environmental indicators exhibit low variance, explaining the low entropy-diversity and ultimately low environmental weight.

\subsection{B. Clustering Interpretation}
Cluster 0 (High-Impact) shows:

\begin{itemize}
\item Higher certification frequency
\item Lower carbon footprint
\item Higher SIS
\end{itemize}

Cluster 1 (Low-Impact) exhibits:

\begin{itemize}
\item Higher price dispersion
\item Lower policy scores
\end{itemize}

\subsection{C. Pareto Frontier (Materials and Brands)}
Materials with Pareto efficiency:

\begin{itemize}
\item Bamboo Fabric
\item Hemp
\item Recycled Polyester
\end{itemize}

Brands on the Pareto frontier include Italian, UK, USA, and Indian manufacturers exhibiting optimal price–SIS balance.

\section{Discussion}
The unexpectedly high policy weight ($w_{policy} = 0.7933$) derives from greater diversity in policy indicators versus nearly homogeneous environmental metrics. This reflects either true homogenization of environmental footprints or limitations in dataset resolution.

The new recommendation logic, separating “Best Value” and “Max Sustainability”, preserves multi-objective trade-off integrity.

\section{Conclusion}
SustainGraph demonstrates a rigorous, reproducible methodology combining entropy-based weighting, validated clustering, and Pareto optimization for sustainable fashion analytics. It offers interpretable and actionable insights for sourcing, consumer-facing applications, and ESG reporting.

\section*{Acknowledgment}
The author thanks faculty advisors from HSE University for methodological guidance.

\begin{thebibliography}{00}

\bibitem{zhao2021entropy}
Zhao, W., et al. (2021). Application of improved entropy weighting in environmental evaluation.

\bibitem{larimian2013}
Larimian, T., et al. (2013). Fuzzy AHP models for environmental sustainability.

\bibitem{liu2019}
Liu, Y., et al. (2019). Sustainable supplier evaluation methods.

\bibitem{ghasemy2025}
Ghasemy Yaghin, R., \& Khalajmehri, K. (2025). Multi-objective modeling in textile sustainability.

\end{thebibliography}

\end{document}
