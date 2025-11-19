import React, { useState, useMemo } from 'react';
import FileUploader from './components/FileUploader';
import Filters from './components/Filters';
import KPIBar from './components/KPIBar';
import PCAPlot from './components/PCAPlot';
import MaterialClusters from './components/MaterialClusters';
import RecommenderResults from './components/RecommenderResults';
import GraphVisualization from './components/GraphVisualization';

import { normalizeAndComputeSIS } from './logic/computeSIS';
import { aggregateByMaterial } from './logic/preprocess';
import { runKMeans } from './logic/kmeans';
import { runPCA2 } from './logic/pca';
import { runMLPIfNeeded } from './logic/mlpModel';
import { buildGraphJson } from './logic/graphBuilder';
import { recommend } from './logic/recommender';

function App() {
  const [rawRows, setRawRows] = useState([]);
  const [processedRows, setProcessedRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [materialAgg, setMaterialAgg] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [pcaCoords, setPcaCoords] = useState({ x: [], y: [] });
  const [graphJson, setGraphJson] = useState({ nodes: [], links: [] });
  const [recommendations, setRecommendations] = useState([]);
  const [priority, setPriority] = useState(0.5);
  const [filters, setFilters] = useState({
    brand: '__all',
    category: '__all',
    material: '__all'
  });
  const [isRunning, setIsRunning] = useState(false);

  const brands = useMemo(() => {
    return Array.from(new Set(rawRows.map(r => r.Brand).filter(Boolean))).sort();
  }, [rawRows]);

  const categories = useMemo(() => {
    return Array.from(new Set(rawRows.map(r => r.Category).filter(Boolean))).sort();
  }, [rawRows]);

  const materials = useMemo(() => {
    return Array.from(new Set(rawRows.map(r => r.Material_Type).filter(Boolean))).sort();
  }, [rawRows]);

  const handleDataLoaded = rows => {
    setRawRows(rows);
    setProcessedRows([]);
    setStats(null);
    setMaterialAgg([]);
    setClusters([]);
    setPcaCoords({ x: [], y: [] });
    setGraphJson({ nodes: [], links: [] });
    setRecommendations([]);
  };

  const handleRun = async () => {
    if (!rawRows.length) {
      alert('Please upload dataset first');
      return;
    }
    setIsRunning(true);
    try {
      const filtered = rawRows.filter(r => {
        if (filters.brand !== '__all' && r.Brand !== filters.brand) return false;
        if (filters.category !== '__all' && r.Category !== filters.category) return false;
        if (filters.material !== '__all' && r.Material_Type !== filters.material) return false;
        return true;
      });

      if (!filtered.length) {
        alert('No rows match current filters');
        setIsRunning(false);
        return;
      }

      const { rowsWithSIS, stats: s } = normalizeAndComputeSIS(filtered);
      setProcessedRows(rowsWithSIS);
      setStats(s);

      const agg = aggregateByMaterial(rowsWithSIS);
      const featureMatrix = agg.map(a => [
        a.meanCarbon,
        a.meanWater,
        a.meanWaste,
        a.meanScore
      ]);

      const { assignments } = runKMeans(featureMatrix, 3, { maxIter: 40 });
      const clustered = agg.map((a, i) => ({ ...a, cluster: assignments[i] || 0 }));
      setMaterialAgg(clustered);
      setClusters(clustered);

      const pca = runPCA2(featureMatrix);
      setPcaCoords(pca);

      await runMLPIfNeeded(rowsWithSIS);

      const graph = buildGraphJson(rowsWithSIS);
      setGraphJson(graph);

      const recs = recommend(rowsWithSIS, priority, 12);
      setRecommendations(recs);
    } catch (err) {
      console.error(err);
      alert('Pipeline error, check console');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <div>
          <h1>SustainGraph</h1>
          <p>AI-powered sustainable fashion recommendation dashboard. All in your browser.</p>
        </div>
      </header>

      <main className="app-main">
        <section className="panel panel-left">
          <FileUploader onDataLoaded={handleDataLoaded} />
          <Filters
            brands={brands}
            categories={categories}
            materials={materials}
            filters={filters}
            setFilters={setFilters}
            priority={priority}
            setPriority={setPriority}
            onRun={handleRun}
            isRunning={isRunning}
          />
          <KPIBar rows={processedRows} stats={stats} />
        </section>

        <section className="panel panel-right">
          <div className="grid-visual">
            <PCAPlot data={clusters} coords={pcaCoords} />
            <MaterialClusters clusters={clusters} />
          </div>
          <div className="grid-visual">
            <RecommenderResults items={recommendations} />
            <GraphVisualization graph={graphJson} />
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <span>
          Dataset: Sustainable Fashion & Eco-Friendly Trends (Kaggle). Built with React, D3 and TensorFlow.js.
        </span>
      </footer>
    </div>
  );
}

export default App;
