var basicOptions = {
  groups: {
      'sys': {
          color: '#888'
      },
      'cmdb': {
          color: '#00F'
      },
      'task': {
          color: '#0F0'
      },
      'sc_': {
          color: '#F00'
      },
      'none': {
          color: '#FF0'
      },
      'm2m': {
          color: '#888',
          shape: 'diamond'
      },
      'base': {
          color: {
              border: '#EEE',
              background: '#EEE'
          }
      },
      'base-required': {
          color: {
              border: '#888',
              background: '#DDD'
          }
      }
  },
  layout: {
      improvedLayout: true
  },
  nodes: {
      shape: 'dot',
      font: {
          face: 'Tahoma'
      }
  },
  edges: {
      arrows: {
          to: {
              enabled: true,
              type: 'arrow'
          }
      },
      arrowStrikethrough: true,
      smooth: {
          type: 'discrete',
          roundness: 0.1
      }
  },
  physics: {
      barnesHut: {
          gravitationalConstant: -15000,
          springConstant: 0.002,
          springLength: 250
      },
      stabilization: {
          iterations: 1000,
          enabled: true,
          fit: true
      }
  },
  interaction: {
      navigationButtons: true,
      selectConnectedEdges: true,
      hover: true
  }
};