import React, { useEffect } from 'react';
import * as d3 from 'd3';

function GraphVisualization({ graph }) {
  useEffect(() => {
    const svg = d3.select('#graph-canvas');
    svg.selectAll('*').remove();

    const width = 900;
    const height = 420;
    const simulation = d3.forceSimulation(graph.nodes)
      .force('link', d3.forceLink(graph.links).id(d => d.id).distance(70))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .on('tick', ticked);

    const link = svg.append('g').selectAll('line')
      .data(graph.links)
      .enter().append('line')
      .attr('stroke', '#bbb');

    const node = svg.append('g').selectAll('circle')
      .data(graph.nodes)
      .enter().append('circle')
      .attr('r', 8)
      .attr('fill', d => (d.type === 'Brand' ? '#1f77b4' : d.type === 'Category' ? '#2ca02c' : '#ff7f0e'))
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    function ticked() {
      link.attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

      node.attr('cx', d => d.x)
          .attr('cy', d => d.y);
    }

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  }, [graph]);

  return (
    <div className="card">
      <h2>Fashion Sustainability Graph</h2>
      <svg id="graph-canvas" width="900" height="420"></svg>
    </div>
  );
}

export default GraphVisualization;
