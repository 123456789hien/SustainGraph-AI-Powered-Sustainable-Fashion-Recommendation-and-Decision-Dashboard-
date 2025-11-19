import React from 'react';

function MaterialClusters({ clusters }) {
  return (
    <div className="card">
      <h2>Material Clusters</h2>
      {clusters.map((cluster, index) => (
        <div key={index}>
          <h3>Cluster {cluster.cluster}</h3>
          <p>Material: {cluster.material}</p>
          <p>Sustainability Score: {cluster.meanScore}</p>
        </div>
      ))}
    </div>
  );
}

export default MaterialClusters;
