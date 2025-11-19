import React from 'react';

function Filters({ brands, categories, materials, filters, setFilters, priority, setPriority, onRun, isRunning }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handlePriorityChange = (e) => {
    setPriority(e.target.value);
  };

  return (
    <div className="card">
      <h2>Filters & Settings</h2>
      <label>Brand:
        <select name="brand" value={filters.brand} onChange={handleChange}>
          <option value="__all">All</option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>{brand}</option>
          ))}
        </select>
      </label>
      <label>Category:
        <select name="category" value={filters.category} onChange={handleChange}>
          <option value="__all">All</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </label>
      <label>Material:
        <select name="material" value={filters.material} onChange={handleChange}>
          <option value="__all">All</option>
          {materials.map((material) => (
            <option key={material} value={material}>{material}</option>
          ))}
        </select>
      </label>
      <label>Sustainability Priority:
        <select value={priority} onChange={handlePriorityChange}>
          <option value="0.6">High (0.6)</option>
          <option value="0.5">Balanced (0.5)</option>
          <option value="0.3">Low (0.3)</option>
        </select>
      </label>
      <button onClick={onRun} disabled={isRunning}>
        {isRunning ? 'Processing...' : 'Run Pipeline'}
      </button>
    </div>
  );
}

export default Filters;
