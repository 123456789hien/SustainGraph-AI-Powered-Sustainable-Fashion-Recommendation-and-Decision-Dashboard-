import React, { useEffect } from 'react';
import * as d3 from 'd3';

function PCAPlot({ data, coords }) {
  useEffect(() => {
    const svg = d3.select('#pca-plot');
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = 600 - margin.left - margin.right;
    const height = 320 - margin.top - margin.bottom;

    const x = d3.scaleLinear().domain([Math.min(...coords.x), Math.max(...coords.x)]).range([0, width]);
    const y = d3.scaleLinear().domain([Math.min(...coords.y), Math.max(...coords.y)]).range([height, 0]);

    const chart = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    chart.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', (d, i) => x(coords.x[i]))
      .attr('cy', (d, i) => y(coords.y[i]))
      .attr('r', 5)
      .attr('fill', '#1c7f4d')
      .attr('opacity', 0.8);

    chart.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));

    chart.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y));
  }, [coords, data]);

  return (
    <div className="card">
      <h2>PCA Plot</h2>
      <svg id="pca-plot" width="600" height="320"></svg>
    </div>
  );
}

export default PCAPlot;
