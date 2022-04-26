var stabilizationStartTime = 0;

var processedData = null;
var networkData = null;
var network = null;

var unpositionedNodes = [];

function getStabilizationIterations() {
    // calculate optimal stabilization count
    var trueNodesCount = 0;
    unpositionedNodes = [];
    
    networkData.nodes.forEach(function (node) {
        if (typeof node.x == 'undefined' && typeof node.y == 'undefined') {
            trueNodesCount += node.physics == true ? 1 : 0;
            console.log('Missing Position for ' + node.data.name);
            node.unpositioned = true;
            unpositionedNodes.push(node);
        }
    });
    networkData.nodes.update(unpositionedNodes);

    var trueEdgesCount = 0;
    networkData.edges.forEach(function (edge) {
        var nodeTo = networkData.nodes.get(edge.to);
        var nodeFrom = networkData.nodes.get(edge.from);

        try {
            if (typeof nodeTo.x == 'undefined' && typeof nodeTo.y == 'undefined' ||
                typeof nodeFrom.x == 'undefined' && typeof nodeFrom.y == 'undefined') {

                trueEdgesCount += edge.physics == true && nodeTo.physics == true && nodeFrom.physics == true ? 1 : 0;
            }
        } catch (err) {}
    });

    var iterations = Math.max(Math.round(Math.sqrt(Math.max(trueNodesCount, 1) * Math.max(trueEdgesCount, 1))), trueNodesCount);

    return iterations > 1 ? Math.max(iterations, 1000) : iterations;
}

function loadData() {
    var initialLoad = networkData == null;

    networkData = Object.assign({}, processedData);
    networkData.nodes = new vis.DataSet(networkData.nodes);
    networkData.edges = new vis.DataSet(networkData.edges);

    stabilizationStartTime = new Date().getTime();

    // copy options from template and set differing settings
    var options = Object.assign({}, basicOptions);
    options.physics.stabilization.iterations = getStabilizationIterations();
    network.setOptions(options);

    showStatusMessage('Determining node positions in ' + options.physics.stabilization.iterations + ' iterations...');
    $('*').addClass('wait');

    setTimeout(function () {
        network.setData(networkData);
    }, initialLoad ? 250 : 0);
}

function nodePositions() {
    exportData.positions = {};

    networkData.nodes.forEach(function (node) {
        if (node.data && node.data.name && node.x && node.y) {
            exportData.positions[node.data.name] = {
                x: node.x,
                y: node.y
            };
        }
    });

    console.log(JSON.stringify(exportData.positions, null, '    '));
}

function initNetwork() {
    showStatusMessage('Initializing System...');

    var container = $('#mynetwork').get(0);
    network = new vis.Network(container);

    network.on('startStabilizing', function () {
        stabilizationStartTime = new Date().getTime();
    });

    network.on('stabilizationProgress', function (params) {
        if (params.iterations > 0) {
            var curRuntime = (new Date().getTime() - stabilizationStartTime) / 1000;

            var curPercent = (params.iterations / params.total) * 100;
            var missingPercent = 100 - curPercent;
            var timePerPercent = curRuntime / curPercent;

            var eta = Math.round(timePerPercent * missingPercent * 10) / 10;
            var ett = Math.round(timePerPercent * 1000) / 10;

            var msg = Math.round(curPercent * 10) / 10 + '% | ' + eta + 'sec left of ' + ett + 'sec total';

            showStatusMessage(msg);
        }
    });

    network.on('stabilizationIterationsDone', function () {
        $('*').removeClass('wait');

        try {
            // fix all nodes, by having them fixed and position saved
            var updatedNodes = [];
            networkData.nodes.forEach(function (node) {
                node.fixed = true;
                updatedNodes.push(node);
            });
            networkData.nodes.update(updatedNodes);

            // stop moving around like a little dynamic bitch
            network.stopSimulation();
            network.storePositions();
            network.setOptions({
                physics: {
                    stabilization: false
                }
            });
            network.fit();

            // store position data to loaded data (making it ready for being exported)
            exportData.positions = {};
            networkData.nodes.forEach(function (node) {
                if (node.data && node.data.name && node.x && node.y) {
                    exportData.positions[node.data.name] = {
                        x: node.x,
                        y: node.y
                    };
                }
            });

            // also store position data in already processed data
            for (tableName in exportData.positions) {
                for (var i = 0; i < processedData.nodes.length; i++) {
                    if (processedData.nodes[i].data.name != tableName) {
                        continue;
                    }

                    if (typeof processedData.nodes[i].x == 'undefined' && typeof processedData.nodes[i].y == 'undefined') {
                        processedData.nodes[i].x = exportData.positions[tableName].x;
                        processedData.nodes[i].y = exportData.positions[tableName].y;
                    }
                }
            }
        } catch (err) {}

        showStatusMessage('Done Rendering in ' + (Math.round((new Date().getTime() - stabilizationStartTime) / 100) / 10) + 'sec');
    });

    network.on('hoverNode', function (ev) {
        viewEntityDetails(ev.node, null);
    });

    network.on('hoverEdge', function (ev) {
        viewEntityDetails(null, ev.edge);
    });

    network.on('blurNode', clearEntityDetails);
    network.on('blurEdge', clearEntityDetails);

    network.on('click', function (ev) {
        // hide menu if currently shown
        if ($("#nodeMenu").css('display') == 'block') {
            $("#nodeMenu").hide();
        }

        if (ev.nodes.length > 0) {
            viewEntityDetails(ev.nodes[0], null);
            var node = networkData.nodes.get(ev.nodes[0]);

            $("#nodeMenu #nodeMenu-showExtensionPath").off('click');
            $("#nodeMenu #nodeMenu-showExtensionPath").on('click', function(ev) {
                $("#nodeMenu").hide();
                selectParentPath(node.id);
            });

            $("#nodeMenu #nodeMenu-showExtensionTree").off('click');
            $("#nodeMenu #nodeMenu-showExtensionTree").on('click', function(ev) {
                $("#nodeMenu").hide();
                filterExtensionTree(node.id);
            });

            $("#nodeMenu #nodeMenu-showGeneralContext").off('click');
            $("#nodeMenu #nodeMenu-showGeneralContext").on('click', function(ev) {
                $("#nodeMenu").hide();
                filterDirectConnections(node.id);
            });

            $("#nodeMenu #nodeMenu-showReferenceContext").off('click');
            $("#nodeMenu #nodeMenu-showReferenceContext").on('click', function(ev) {
                $("#nodeMenu").hide();
                filterReferenceContext(node.id);
            });

            $("#nodeMenu #nodeMenu-showDetails").off('click');
            $("#nodeMenu #nodeMenu-showDetails").on('click', function(ev) {
                $("#nodeMenu").hide();
                viewNodeDetailsModal(node.id);
            });

            $("#nodeMenu #nodeMenu-showGroup").off('click');
            $("#nodeMenu #nodeMenu-showGroup").on('click', function(ev) {
                $("#nodeMenu").hide();
                $('#groupSelection').val(node.group);
                filterGroup(node.group);
            });

            $('#nodeMenu').css({
                display: 'block',
                top: ev.pointer.DOM.y +25,
                left: ev.pointer.DOM.x +25
            });

        }
    });

    showStatusMessage('Ready to go!');
}


function resetNetwork() {
    showStatusMessage('Restoring network');

    // re-initialize network
    try {
        network.destroy();
    } catch (err) {}
    initNetwork();

    // re-load the (already processed) data
    loadData();

    carved = false;
}

function loadJSON(source) {
    showStatusMessage('Processing raw data...');
    exportData = JSON.parse(source);

    exportData.positions = typeof exportData.positions != 'undefined' ? exportData.positions : (typeof rawPositions != 'undefined' ? rawPositions : null);
    processedData = processServiceNowTables(exportData.tables, exportData.refRel, exportData.positions);

    $('#groupSelection').addClass('d-none');
    $('#groupSelection').empty();
    $('#groupSelection').append('<option value="">show all</option>');
    $('#groupSelection').append('<option disabled="disabled">&mdash;</option>');
    for (var i = 0; i < processedData.statistics.groups.length; i++) {
        var group = processedData.statistics.groups[i];

        $('#groupSelection').append('<option value="' + group.name + '">' + group.name + ' (' + group.memberCount + ')</option>');
    }
    $('#groupSelection').removeClass('d-none');

    resetNetwork();
}