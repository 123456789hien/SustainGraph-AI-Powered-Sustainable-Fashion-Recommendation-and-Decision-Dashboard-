import React from 'react';

function RecommenderResults({ items }) {
  return (
    <div className="card">
      <h2>Recommended Products</h2>
      {items.length > 0 ? (
        <ul>
          {items.map((item, index) => (
            <li key={index}>
              <strong>{item.Brand}</strong> - {item.Category} - {item.Material_Type}
              <div>SIS: {item.SIS.toFixed(2)}</div>
              <div>CO₂: {item.Carbon_Footprint.toFixed(2)} MT</div>
              <div>Water Usage: {item.Water_Usage.toFixed(0)} L</div>
            </li>
          ))}
        </ul>
      ) : (
        <p>No recommendations available</p>
      )}
    </div>
  );
}

export default RecommenderResults;
