var carveThreshold = 350;
var carveHierarchie = false;

// carveThreshold = 1000; carveHierarchie = true;

function selectParentPath(node) {
    if (carved) {
        resetNetwork();
    }

    $('*').addClass('wait');
    node = networkData.nodes.get(node);

    var toBeSelectedNodes = [node.id];
    var toBeSelectedEdges = [];

    // determine nodes of the extension tree
    try {
        while (node.data.super_class != '') {
            node = networkData.tables[node.data.super_class];
            toBeSelectedNodes.push(node.id);
        }
    } catch (err) {}

    // determine corresponding edges
    for (var i = 0; i < toBeSelectedNodes.length - 1; i++) {
        networkData.edges.forEach(function (edge) {
            if (((edge.to == toBeSelectedNodes[i] && edge.from == toBeSelectedNodes[i + 1]) ||
                    (edge.to == toBeSelectedNodes[i + 1] && edge.from == toBeSelectedNodes[i])) &&
                (edge.group == edgeTypes.edgeTypeExtension.group ||
                    edge.group == edgeTypes.edgeTypeUpdateSet.group ||
                    edge.group == edgeTypes.edgeTypePrefix.group)) {
                toBeSelectedEdges.push(edge.id);
            }
        });
    };

    filterNodes(toBeSelectedNodes, toBeSelectedEdges);

    focused = true;
    $('#unfocusButton').removeClass('d-none');
    $('*').removeClass('wait');
}

function getParentPath(nodeId) {
    var node = networkData.nodes.get(nodeId);

    var parentNodes = [node.id];

    // determine nodes of the extension tree
    try {
        while (node.data.super_class != '') {
            node = networkData.tables[node.data.super_class];
            parentNodes.push(node.id);
        }
    } catch (err) {}

    return parentNodes;
}

function findTables(containsStr) {
    var result = [];

    networkData.nodes.forEach(function (node) {
        if ((node.data.name.indexOf(containsStr) >= 0 || node.data.label.indexOf(containsStr) >= 0) && !!!node.hidden) {
            result.push(node);
        }
    });

    result.sort(function (a, b) {
        if (a.size != b.size) {
            return b.size - a.size;
        } else {
            if (a.edgesCount != b.edgesCount) {
                return b.edgesCount - a.edgesCount;
            } else {
                if (a.data.name < b.data.name) {
                    return -1;
                }
                if (a.data.name > b.data.name) {
                    return 1;
                }

                return 0;
            }
        }
    });

    return result;
}

function filterReferenceContext(node) {
    if (carved) {
        resetNetwork();
    }

    $('*').addClass('wait');
    node = networkData.nodes.get(node);

    var toBeSelectedNodes = [node.id];
    var toBeSelectedEdges = [];

    // determine corresponding edges
    networkData.edges.forEach(function (edge) {
        if ((edge.to == node.id || edge.from == node.id) && edge.group == edgeTypes.edgeTypeReference.group) {
            toBeSelectedEdges.push(edge.id);
            toBeSelectedNodes.push(edge.to == node.id ? edge.from : edge.to);
        }
    });

    filterNodes(toBeSelectedNodes, toBeSelectedEdges);

    focused = true;
    $('#unfocusButton').removeClass('d-none');
    $('*').removeClass('wait');
}

function filterExtensionTree(nodeId) {
    if (carved) {
        resetNetwork();
    }

    $('*').addClass('wait');
    node = networkData.nodes.get(nodeId);

    var toBeSelectedNodes = [nodeId];
    var toBeSelectedEdges = [];


    // determine nodes of the extension tree (upstream / parent path)
    try {
        while (node.data.super_class != '') {
            node = networkData.tables[node.data.super_class];
            toBeSelectedNodes.push(node.id);
        }
    } catch (err) {}

    // determine corresponding edges extension path edges
    for (var i = 0; i < toBeSelectedNodes.length - 1; i++) {
        networkData.edges.forEach(function (edge) {
            if (((edge.to == toBeSelectedNodes[i] && edge.from == toBeSelectedNodes[i + 1]) ||
                    (edge.to == toBeSelectedNodes[i + 1] && edge.from == toBeSelectedNodes[i])) &&
                (edge.group == edgeTypes.edgeTypeExtension.group ||
                    edge.group == edgeTypes.edgeTypeUpdateSet.group ||
                    edge.group == edgeTypes.edgeTypePrefix.group)) {
                toBeSelectedEdges.push(edge.id);
            }
        });
    };

    // determine extension tree edges and nodes (downstream)
    networkData.edges.forEach(function (edge) {
        if (edge.from == nodeId && edge.group == edgeTypes.edgeTypeExtension.group) {
            toBeSelectedEdges.push(edge.id);
            toBeSelectedNodes.push(edge.to);
        }
    });

    filterNodes(toBeSelectedNodes, toBeSelectedEdges);

    focused = true;
    $('#unfocusButton').removeClass('d-none');
    $('*').removeClass('wait');
}

function filterDirectConnections(node) {
    if (carved) {
        resetNetwork();
    }

    $('*').addClass('wait');
    node = networkData.nodes.get(node);

    var toBeSelectedNodes = [node.id];
    var toBeSelectedEdges = [];

    // determine corresponding edges
    networkData.edges.forEach(function (edge) {
        if (edge.to == node.id || edge.from == node.id) {
            toBeSelectedEdges.push(edge.id);
            toBeSelectedNodes.push(edge.to == node.id ? edge.from : edge.to);
        }
    });

    filterNodes(toBeSelectedNodes, toBeSelectedEdges);

    focused = true;
    $('#unfocusButton').removeClass('d-none');
    $('*').removeClass('wait');
}

function forceRerendering() {
    nodesUpdated = [];
    
    networkData.nodes.forEach(function (node) {
        node.hidden = false;
        try {
            node.x = undefined;
            node.y = undefined;
        } catch (err) {}
        node.fixed = false;
        nodesUpdated.push(node);
    });

    networkData.nodes.update(nodesUpdated);

    var options = Object.assign({}, basicOptions);
    options.physics.stabilization.iterations = Math.max(getStabilizationIterations() * 2, 500);

    showStatusMessage('Determining node positions in ' + options.physics.stabilization.iterations + ' iterations (this may take some time)...');
    network.setOptions(options);
    network.setData(networkData);
}

function carveOutNodes(arrayOfNodeIDs, arrayOfEdgeIDs) {
    if (carved) {
        resetNetwork();
    }

    if (arrayOfNodeIDs.length > carveThreshold  || arrayOfNodeIDs.length == networkData.nodes.length) {
        filterNodes(arrayOfNodeIDs);
    } else {
        // empty network data
        network.setData({});

        showStatusMessage('Carving ' + arrayOfNodeIDs.length + ' nodes.');

        carved = true;

        var carvedOutNodes = [];
        var carvedOutEdges = [];

        networkData.nodes.forEach(function (node) {
            if (arrayOfNodeIDs.indexOf(node.id) < 0) {
                carvedOutNodes.push(node.id);
            }
        });

        // remove all edges leading to removed nodes
        networkData.edges.forEach(function (edge) {
            if (carvedOutNodes.indexOf(edge.to) >= 0 || carvedOutNodes.indexOf(edge.to) >= 0) {
                carvedOutEdges.push(edge.id);
            }
        });

        // if specific edges are provided, remove all non-beloning edges
        if (arrayOfEdgeIDs) {
            networkData.edges.forEach(function (edge) {
                if (arrayOfEdgeIDs.indexOf(edge.id) < 0) {
                    carvedOutEdges.push(edge.id);
                }
            });
        }

        networkData.nodes.remove(carvedOutNodes);
        networkData.edges.remove(carvedOutEdges);

        var nodesUpdated = [];
        var edgesUpdated = [];
        var nodeEdgeCount = {};

        // make sure that all remaining nodes and edges are shown, nodes gain size corresponding to the number of edges connected
        networkData.edges.forEach(function (edge) {
            edge.hidden = false;
            edgesUpdated.push(edge);
        });

        networkData.nodes.forEach(function (node) {
            node.hidden = false;
            try {
                node.x = undefined;
                node.y = undefined;
            } catch (err) {}
            node.fixed = false;
            nodesUpdated.push(node);
        });

        networkData.nodes.update(nodesUpdated);
        networkData.edges.update(edgesUpdated);

        // copy options from template and set differing settings, only showing hierarchy, when threshold of #nodes is not met yet
        var hierarchicalLayout = {
            layout: {
                hierarchical: {
                    enabled: true,
                    sortMethod: 'directed',
                    levelSeparation: 250,
                    nodeSpacing: 250
                }
            }
        };

        var options = Object.assign({}, basicOptions, (carveHierarchie && arrayOfNodeIDs.length <= carveThreshold) ? hierarchicalLayout : {});
        options.physics.stabilization.iterations = Math.max(getStabilizationIterations() * 2, 500);

        showStatusMessage('Determining node positions in ' + options.physics.stabilization.iterations + ' iterations (this may take some time)...');
        network.setOptions(options);
        network.setData(networkData);
    }
}

function filterNodes(arrayOfNodeIDs, arrayOfEdgeIDs) {
    $('*').addClass('wait');

    if (carved) {
        resetNetwork();
    }

    if (arrayOfNodeIDs.length <= carveThreshold && arrayOfNodeIDs.length < networkData.nodes.length) {
        carveOutNodes(arrayOfNodeIDs, arrayOfEdgeIDs);
    } else {
        showStatusMessage('Filtering ' + arrayOfNodeIDs.length + ' nodes.');

        var nodesUpdated = [];
        var edgesUpdated = [];

        networkData.nodes.forEach(function (node) {
            node.hidden = arrayOfNodeIDs.length > 0 && arrayOfNodeIDs.indexOf(node.id) < 0;
            nodesUpdated.push(node);
        });
        networkData.nodes.update(nodesUpdated);

        // if edges are provided, filter them as well
        if (arrayOfEdgeIDs) {
            networkData.edges.forEach(function (edge) {
                edge.hidden = arrayOfEdgeIDs.length > 0 && arrayOfEdgeIDs.indexOf(edge.id) < 0;
                edgesUpdated.push(edge);
            });
            networkData.edges.update(edgesUpdated);
        }
    }

    $('*').removeClass('wait');
}

function filterGroup(group) {
    $('*').addClass('wait');

    if (carved) {
        resetNetwork();
        focused = false;
        $('#unfocusButton').addClass('d-none');
    }
    var nodesBelonging = [];

    networkData.nodes.forEach(function (node) {
        if (node.group == group || typeof group == 'undefined' || group == '' || group == null) {
            nodesBelonging.push(node.id);
        }
    });

    filterNodes(nodesBelonging);
    currentFilterGroup = group;
    network.fit();

    $('*').removeClass('wait');
}

function filterGroups() {
    var groups = $('#groupSelection').val();

    if (groups.indexOf('') >= 0) {
        filterGroup();
        $('#groupSelection').val('');
    } else {
        $('*').addClass('wait');

        if (carved) {
            resetNetwork();
            focused = false;
            $('#unfocusButton').addClass('d-none');
        }
        var nodesBelonging = [];

        for (var i = 0; i < groups.length; i++) {
            var group = groups[i];
            networkData.nodes.forEach(function (node) {
                if (node.group == group || typeof group == 'undefined' || group == '' || group == null) {
                    nodesBelonging.push(node.id);
                }
            });
        }

        filterNodes(nodesBelonging);
        currentFilterGroup = group;
        network.fit();

        $('*').removeClass('wait');
    }
}

function toggleEdge(type) {
    var stabilizationStartTime = new Date().getTime();
    if (typeof type == 'object') {
        console.log('Toggeling edges of type ' + type.group);
    }

    var edgesUpdated = [];
    networkData.edges.forEach(function (edge) {
        var updated = false;

        if (edge.group == type.group) {
            edge.hidden = !!!edge.hidden;
            edgesUpdated.push(edge);
        }

        if (typeof type == 'undefined' && edge.hidden == true) {
            edge.hidden = false;
            edgesUpdated.push(edge);
        }
    });

    if (edgesUpdated.length > 0) {
        networkData.edges.update(edgesUpdated);
    }

    console.log('Toggeling done in ' + (Math.round((new Date().getTime() - stabilizationStartTime) / 100) / 10) + 'sec');
}

function countIncomingEdges(nodeId, edgeTypes) {
    if (typeof edgeTypes == 'string') {
        edgeTypes = [edgeTypes];
    }

    var count = 0;

    networkData.edges.forEach(function (edge) {
        if (edge.to == nodeId) {
            var valid = !(edgeTypes instanceof Array);

            for (var i = 0; !valid && i < edgeTypes.length; i++) {
                valid = edge.group == edgesTypes[i];
            }

            if (valid) {
                count++;
            }
        }
    });

    return count;
}

function countOutgoingEdges(nodeId, edgeTypes) {
    if (typeof edgeTypes == 'string') {
        edgeTypes = [edgeTypes];
    }

    var count = 0;

    networkData.edges.forEach(function (edge) {
        if (edge.from == nodeId) {
            var valid = !(edgeTypes instanceof Array);

            for (var i = 0; !valid && i < edgeTypes.length; i++) {
                valid = edge.group == edgesTypes[i];
            }

            if (valid) {
                count++;
            }
        }
    });

    return count;
}