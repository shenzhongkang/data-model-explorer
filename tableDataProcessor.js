var nodeMinSize = 25;
var nodeMaxSize = 4 * nodeMinSize;
var prefilterRoundRobinAndTextIndexes = false;

var edgeTypes  = {
    edgeTypeExtension: {
        group: 'edge-ext',
        //label: '<EXT>',
        color: {
            inherit: true
        },
        physics: true,
        hidden: false
    },
    edgeTypePrefix: {
        group: 'edge-prefix',
        //label: '<PREFIX>',
        color: {
            inherit: false,
            color: '#F8F8F8'
        },
        arrows: {
            to: {
                enabled: false
            }
        },
        physics: true,
        hidden: true
    },
    edgeTypeReference: {
        group: 'edge-ref',
        //label: '<REF>',
        color: {
            inherit: false,
            color: '#DDD'
        },
        physics: false,
        hidden: false
    },
    edgeTypeManyToMany: {
        group: 'edge-m2m',
        //label: '<M2M>',
        color: {
            inherit: false,
            color: '#BEEF18'
        },
        physics: true,
        hidden: false
    },
    edgeTypeUpdateSet: {
        group: 'edge-updateset',
        //label: '<US>',
        color: {
            inherit: false,
            color: '#EFF'
        },
        physics: true,
        hidden: false
    }
}

function resolveSuperClass(rawTables, tableIndex) {
    // create the index of table names
    var tables = {};
    
    if (typeof tableIndex == 'object') {
        tables = tableIndex;
    } else {
        for (var i = 0; i < rawTables.length; i++) {
            tables[rawTables[i].name] = rawTables[i];
        }
    }

    for (var i = 0; i < rawTables.length; i++) {
        // if super_class is not part of the tables, look for it's sys_id
        if (typeof tables[rawTables[i].super_class] == 'undefined') {
            var found = -1;

            for (var j = 0; found == -1 && j < rawTables.length; j++) {
                found = (rawTables[i].super_class == rawTables[j].sys_id) ? j : found;
            }

            if (found != -1) {
                rawTables[i].super_class = rawTables[found].name;
            }
        }
    }
}

function processServiceNowTables(rawTables, rawRefRel, rawPositions) {
    // raw converted information
    var rawNodes      = [];
    var rawEdges      = [];
    var rawGroups     = [];

    // highlevel entry points
    var tables = {};
    var initialGroupTables = {};
    var groupMemberCount = {};

    var edgeStatistics = {};

    function processServiceNowTablesNow() {
        // initialize nodes and edges
        rawNodes  = [];
        rawEdges  = [];
        rawGroups = ['none'];

        function resolveSuperClassNow() {
            resolveSuperClass(rawTables);
        }

        function getTables() {
            for (var i = 0; i < rawTables.length; i++) {
                var excludeReg = /([a-z_]+[0-9]+|ts_[a-z_]+|.*\$.*)/ig;
                if (prefilterRoundRobinAndTextIndexes && excludeReg.test(rawTables[i].name)) {
                    continue;
                }

                var nodeId = 'node-'+ rawNodes.length;

                var nodeGroup = 'none';
                if (rawTables[i].name.indexOf('m2m') >= 0 || rawTables[i].name.indexOf('mtom') >= 0) {
                    nodeGroup = 'm2m';
                }

                // if we have a compared node here, mark base as grey
                var compare = typeof rawTables[i].compare == 'string' ? rawTables[i].compare : '';
                if (compare == 'base' || compare == 'base-required') {
                    nodeGroup = compare;
                }

                tables[rawTables[i].name] = {
                    id:      nodeId,
                    label:   rawTables[i].label +'\n('+ rawTables[i].name +')',
                    title:   rawTables[i].label +'\n('+ rawTables[i].name +')',
                    data:    rawTables[i],
                    level:   0,
                    group:   nodeGroup,
                    physics: true
                };

                rawNodes.push(tables[rawTables[i].name]);
            }
        }

        function reconstructLevelsAndGroups() {
            for (var i = 0; i < rawNodes.length; i++) {
                var root = rawNodes[i];

                // determine level by counting the steps needed to go to the root
                var steps = 1;
                var group = root.group;

                try {
                    while (root.data.super_class != '') {
                        root = tables[root.data.super_class];
                        steps++;
                    }

                    // if root doesn't have a group yet, make the root the group itself
                    if (steps > 1 && root.group == 'none') {
                        group = root.data.name;
                        
                        rawGroups.push(group);
                        initialGroupTables[group] = root.data.name;
                        groupMemberCount[group] = 0;
                        
                        root.group = group;
                    } else {
                        group = root.group;
                    }
                } catch(err) {}

                // set determined values
                rawNodes[i].level = steps;

                // only inherit group, if a group wasn't set already
                if (rawNodes[i].group == 'none') {
                    rawNodes[i].group = group;
                }
            }
        }

        function reconstructExtensionEdges() {
            for (var i = 0; i < rawNodes.length; i++) {
                try {
                    if (rawNodes[i].data.super_class && rawNodes[i].data.super_class != '' && rawNodes[i].data.super_class != 'sys_metadata') {
                        var newEdge   = Object.assign({}, edgeTypes.edgeTypeExtension);
                        newEdge.id    = 'edge-'+ rawEdges.length;
                        newEdge.from  = tables[rawNodes[i].data.super_class].id;
                        newEdge.to    = rawNodes[i].id;
                        newEdge.title = '"'+ rawNodes[i].data.name +'" extends "'+ tables[rawNodes[i].data.super_class].data.name +'"';
                        rawEdges.push(newEdge);
                    }
                } catch(err) {
                    console.log('Unable to reconstruct Extension-Relation for'+ JSON.stringify(rawNodes[i]));
                }
            }
        }

        function reconstructUpdateSetEdges() {
            for (var i = 0; i < rawNodes.length; i++) {
                if (rawNodes[i].data.super_class && rawNodes[i].data.super_class == 'sys_metadata') {
                    var newEdge   = Object.assign({}, edgeTypes.edgeTypeUpdateSet);
                    newEdge.id    = 'edge-'+ rawEdges.length;
                    newEdge.from  = tables[rawNodes[i].data.super_class].id;
                    newEdge.to    = rawNodes[i].id;
                    newEdge.title = '"'+ rawNodes[i].data.name +'" is captured by "'+ tables[rawNodes[i].data.super_class].data.name +'"';
                    rawEdges.push(newEdge);
                }
            }
        }

        function reconstructBasicPrefixGroups() {
            // sort them by the length of the table name (shortest names at first)
            rawNodes.sort(function(a, b) {
                return a.data.name.length - b.data.name.length;
            });

            for (var i = 0; i < rawNodes.length; i++) {
                // get all "parts" of a table name (prefixes separated by an underscore)
                if (rawNodes[i].group != 'none') {
                    continue;
                }

                var nameParts = rawNodes[i].data.name.split('_');
                var firstPart = nameParts[0];
                // handle user tables including the u_ prefix (instead of having a "u" group)
                if (firstPart == 'u' && nameParts.length > 1) {
                    firstPart += '_'+ nameParts[1]
                }
                
                // find tables with the same prefix
                // if there is an occurence, set the prefix as group for the compared items
                for (var j = 0; j < rawNodes.length; j++) { 
                    if (rawNodes[j].group == 'none' && i != j && (rawNodes[j].data.name.indexOf(firstPart +'_') == 0 || rawNodes[j].data.name.indexOf('_'+ firstPart +'_') >= 0 || rawNodes[j].data.name.lastIndexOf('_'+ firstPart) >= 0 && rawNodes[j].data.name.lastIndexOf('_'+ firstPart) == rawNodes[j].data.name.length - ('_'+ firstPart).length)) {
                        if (rawNodes[i].group == 'none') {
                            rawNodes[i].group = firstPart;
                            rawGroups.push(rawNodes[i].group);
                            initialGroupTables[rawNodes[i].group] = rawNodes[i].data.name;
                            groupMemberCount[rawNodes[i].group] = 0;
                        }

                        rawNodes[j].group = rawNodes[i].group;
                        rawNodes[j].level = 0;
                    }
                }  
            }

            // sort them by id
            rawNodes.sort(function(a, b) {
                var aId = +(a.id.replace('node-', ''));
                var bId = +(b.id.replace('node-', ''));
                return aId - bId;
            });
        }

        function reconstructPrefixGroups() {
            // sort them by the length of the table name (longest names at first)
            rawNodes.sort(function(a, b) {
                return b.data.name.length - a.data.name.length;
            });

            for (var i = 0; i < rawNodes.length; i++) {
                if (rawNodes[i].group != 'none') {
                    continue;
                }

                // get all "parts" of a table name (prefixes separated by an underscore)
                var nodeParts = [];
                var sepPos = rawNodes[i].data.name.indexOf('_');
                while (sepPos >= 0) {
                    nodeParts.push(rawNodes[i].data.name.substr(0, sepPos));
                    sepPos = rawNodes[i].data.name.indexOf('_', sepPos +1);
                }
                nodeParts.push(rawNodes[i].data.name);

                for (var j = 0; j < rawNodes.length; j++) {  
                    if (rawNodes[j].group != 'none') {
                        continue;
                    }

                    var found = false;
                    for (var k = nodeParts.length -1; !found && k > 0; k--) {
                        if (i != j && rawNodes[j].data && rawNodes[j].data.name && rawNodes[j].data.name.indexOf(nodeParts[k]) == 0) {
                            rawNodes[j].group = rawNodes[i].group;
                            rawNodes[j].level = 0;
                            found = true;
                        }
                    }
                } 
            }

            // sort them by id
            rawNodes.sort(function(a, b) {
                var aId = +(a.id.replace('node-', ''));
                var bId = +(b.id.replace('node-', ''));
                return aId - bId;
            });
        }

        function reconstructMissingGroupEdges() {
            for (var i = 0; i < rawNodes.length; i++) {
                try {
                    var fromId = tables[initialGroupTables[rawNodes[i].group]].id;
                    var toId   = rawNodes[i].id;

                    if (!hasNonReferenceEdge(rawNodes[i].id) && rawNodes[i].group != 'none' && haveNoEdges(fromId, toId)) {
                        var newEdge   = Object.assign({}, edgeTypes.edgeTypePrefix);
                        newEdge.id    = 'edge-'+ rawEdges.length;
                        newEdge.from  = fromId;
                        newEdge.to    = toId;
                        newEdge.title = '"'+ rawNodes[i].data.name +'" belongs to "'+ tables[initialGroupTables[rawNodes[i].group]].data.name +'"';
                        rawEdges.push(newEdge);

                        // mark all single tables with level=0
                        rawNodes[i].level = 0;
                    }
                } catch(err) {}
            }
        }

        function haveNoEdges(id1, id2) {
            for (var i = 0; i < rawEdges.length; i++) {
                if ((rawEdges[i].from == id1 && rawEdges[i].to   == id2) ||
                    (rawEdges[i].to   == id1 && rawEdges[i].from == id2)) {
                    return true;
                }
            }

            return false;
        }

        function hasNonReferenceEdge(nodeId) {
            for (var i = 0; i < rawEdges.length; i++) {
                if (rawEdges[i].group != edgeTypes.edgeTypeReference.group && (rawEdges[i].from == nodeId || rawEdges[i].to == nodeId)) {
                    return true;
                }
            }

            return false;
        }

        function hasEdge(nodeId) {
            for (var i = 0; i < rawEdges.length; i++) {
                if (rawEdges[i].from == nodeId || rawEdges[i].to == nodeId) {
                    return true;
                }
            }

            return false;
        }

        function isParentInheritedRefRel(from, to, via) {
            // check if the same from-to-relation exists on parent as well using the exact same reference field (via)
            var found = false;

            while (!found && from.data.super_class != '') {
                from = tables[from.data.super_class];
                //console.log('checking '+ from.data.name);

                for (var i = 0; !found && i < rawRefRel.length; i++) {
                    found = (rawRefRel[i].from == from.data.name && rawRefRel[i].to == to.data.name && rawRefRel[i].via == via);
                }
            }

            return found;
        }

        function reconstructReferenceEdges() {
            for (var i = 0; i < rawRefRel.length; i++) {
                if (typeof rawRefRel[i].consoldiated == 'boolean' && rawRefRel[i].consoldiated == true) {
                    continue;
                }

                var from = tables[rawRefRel[i].from];
                var to   = tables[rawRefRel[i].to];
                var via  = [rawRefRel[i].via];

                rawRefRel[i].consoldiated = true;

                try {
                    if (!isParentInheritedRefRel(from, to, via)) {
                        for (var j = i +1; j < rawRefRel.length; j++) {
                            if (typeof rawRefRel[j].consoldiated == 'boolean' && rawRefRel[j].consoldiated == true) {
                                continue;
                            }
    
                            if (rawRefRel[i].to == rawRefRel[j].to && rawRefRel[i].from == rawRefRel[j].from) {
                                rawRefRel[j].consoldiated = true;
                                via.push(rawRefRel[j].via);
                            }
                        }

                        // unify via fields
                        var vias = {};
                        for (var i = 0; i < via.length; i++) {
                            if (typeof vias[via[i]] == 'undefined') {
                                vias[via[i]] = true;
                            }
                        }
                        via = [];
                        for (v in vias) {
                            via.push(v);
                        }

                        var newEdge  = null;
                        if (from.data.name.indexOf('mtom') >= 0 || from.data.name.indexOf('m2m') >= 0 ||
                            to.data.name.indexOf('mtom') >= 0 || to.data.name.indexOf('m2m') >= 0) {
                            newEdge  = Object.assign({}, edgeTypes.edgeTypeManyToMany);
                        } else {
                            newEdge  = Object.assign({}, edgeTypes.edgeTypeReference);
                        }
                        newEdge.id    = 'edge-'+ rawEdges.length;
                        newEdge.from  = from.id;
                        newEdge.to    = to.id;
                        newEdge.title = '"'+ from.data.name +'" references "'+ to.data.name +'" via field'+ (via.length > 1 ? 's' : '') +' "'+ via.join('", "') +'"';
                        rawEdges.push(newEdge);
                    } else {
                        //console.log('Skipping Reference from '+ from.data.name +' to '+ to.data.name +' as it is present on parent as well.');
                    }
                } catch(err) {
                    console.log('Unable to reconstruct Relation '+ JSON.stringify(rawRefRel[i]));
                }
            }

            for (var i = 0; i < rawRefRel.length; i++) {
                rawRefRel[i].consoldiated = undefined;
                delete rawRefRel[i].consoldiated;
            }
        }

        function consolidateEdges() {
            var toBeDeleted = [];

            for (var i = 0; i < rawEdges.length; i++) {
                if (typeof rawEdges[i].seen == 'boolean') {
                    continue;
                }

                rawEdges[i].seen = true;

                try {
                    // consolidate reference edges from and to the same table
                    for (var j = i +1; j < rawEdges.length; j++) {
                        if (typeof rawEdges[j].seen == 'boolean') {
                            continue;
                        }

                        if (rawEdges[i].to == rawEdges[j].to && rawEdges[i].from == rawEdges[j].from && rawEdges[i].group == rawEdges[j].group) {
                            toBeDeleted.push(j);
                            rawEdges[j].seen = true;
                            rawEdges[j].consoldiate = true;
                        }
                    }
                } catch(err) {}
            }

            console.log('#'+ toBeDeleted.length +': '+ toBeDeleted.join(', '));
            console.log(seenEdges.length +' / '+ rawEdges.length);
        }

        function countMembers(group) {
            if (isNaN(groupMemberCount[group])) {
                var c = 0;
                for (var i = 0; i < rawNodes.length; i++) {
                    c += rawNodes[i].group == group ? 1 : 0;
                }

                groupMemberCount[group] = c;
            }

            return groupMemberCount[group];
        }

        function rebuildRawGroups() {
            // rebuild raw groups
            rawGroups = [];

            for (group in groupMemberCount) {
                rawGroups.push({
                    name: group,
                    baseTable: initialGroupTables[group],
                    memberCount: countMembers(group)
                });
            }

            rawGroups.sort(function(a, b) {
                return +b.memberCount - +a.memberCount;
            });
        }

        function rebuildGroupMemberCount() {
            for (var i = 0; i < rawNodes.length; i++) {
                groupMemberCount[rawNodes[i].group]++;
            }
        }

        function clearMemberlessGroups() {
            for (group in groupMemberCount) {
                if (groupMemberCount[group] <= 1) {
                    delete groupMemberCount[group];
                    delete initialGroupTables[group];

                    for (var i = 0; i < rawNodes.length; i++) {
                        if (rawNodes[i].group == group) {
                            rawNodes[i].group = 'none';
                        }
                    }
                }
            }

            rebuildRawGroups();

            // reset none-group counter
            groupMemberCount['none'] = 0;
            for (var i = 0; i < rawNodes.length; i++) {
                groupMemberCount['none'] += rawNodes[i].group == 'none' ? 1 : 0;
            }
        }

        function removeDashFromGroups() {
            for (group in groupMemberCount) {
                if (group.lastIndexOf('_') == group.length -1) {
                    var newGroupName = group.substr(0, group.length -1);

                    groupMemberCount[newGroupName]   = groupMemberCount[group];
                    initialGroupTables[newGroupName] = initialGroupTables[group];

                    delete groupMemberCount[group];
                    delete initialGroupTables[group];

                    for (var i = 0; i < rawNodes.length; i++) {
                        if (rawNodes[i].group == group) {
                            rawNodes[i].group = newGroupName;
                        }
                    }
                }
            }

            rebuildRawGroups();
        }

        function getEdgesTopTables() {
            edgeStatistics = {};

            for (edgeType in edgeTypes) {
                var topTables = {};
                edgeStatistics[edgeType] = [];

                try {
                    for (var i = 0; i < rawEdges.length; i++) {
                        if (rawEdges[i].group != edgeTypes[edgeType].group) {
                            continue;
                        }

                        var node = null;
                        for (var j = 0; node == null && j < rawNodes.length; j++) {
                            if (edgeType != 'edgeTypeReference') {
                                node = rawEdges[i].from == rawNodes[j].id ? rawNodes[j] : node;
                            } else {
                                node = rawEdges[i].to   == rawNodes[j].id ? rawNodes[j] : node;
                            }
                        }

                        if (node != null && typeof topTables[node.data.name] != 'number') {
                            topTables[node.data.name] = 0;
                        }

                        topTables[node.data.name]++;
                    }

                    for (table in topTables) {
                        if (topTables[table] > 1) {
                            edgeStatistics[edgeType].push({table: table, count: topTables[table]});
                        }
                    }

                    edgeStatistics[edgeType].sort(function (a, b) {
                        return +b.count - +a.count;
                    });
                } catch(err) {}
            }
        }

        function reconstructNodePositions() {
            if (typeof rawPositions != 'object') {
                return;
            }

            for (tableName in rawPositions) {
                var pos = rawPositions[tableName];

                try {
                tables[tableName].x     = pos.x;
                tables[tableName].y     = pos.y;
                tables[tableName].fixed = true;
                } catch(err) {}
            }
        }

        function pumpSizes() {
            var nodeEdgeCount = {};

            // make sure that all remaining nodes and edges are shown, nodes gain size corresponding to the number of edges connected
            for (var i = 0; i < rawEdges.length; i++) {
                var edge = rawEdges[i];


                if (edge.hidden == true || edge.color == 'transparent' || edge.group == edgeTypes.edgeTypeUpdateSet.group) continue;

                if (typeof nodeEdgeCount[edge.to  ] != 'number') nodeEdgeCount[edge.to  ] = 0;
                if (typeof nodeEdgeCount[edge.from] != 'number') nodeEdgeCount[edge.from] = 0;

                nodeEdgeCount[edge.to  ]++;
                nodeEdgeCount[edge.from]++;
            };

            var nodesCountMin = null;
            var nodesCountMax = null;

            for (var i = 0; i < rawNodes.length; i++) {
                var nodeId = rawNodes[i].id;

                if (nodesCountMin == null) nodesCountMin = nodeEdgeCount[nodeId];
                if (nodesCountMax == null) nodesCountMax = nodeEdgeCount[nodeId];

                if (nodeEdgeCount[nodeId] < nodesCountMin) nodesCountMin = nodeEdgeCount[nodeId];
                if (nodeEdgeCount[nodeId] > nodesCountMax) nodesCountMax = nodeEdgeCount[nodeId];
            }

            for (var i = 0; i < rawNodes.length; i++) {
                var nodeId = rawNodes[i].id;

                var sizePercent = (nodeEdgeCount[nodeId] - nodesCountMin) / (nodesCountMax - nodesCountMin);
                rawNodes[i].size = nodeEdgeCount[nodeId] ? Math.min(Math.round(sizePercent * nodeMaxSize) + nodeMinSize, nodeMaxSize) : nodeMinSize;
                rawNodes[i].edgesCount = nodeEdgeCount[nodeId];
            }
        }

        showStatusMessage('Starting processing');

        showStatusMessage('Resolving parent table names');
        measureTime(resolveSuperClassNow, 'resolveSuperClass');

        showStatusMessage('Converting Tables to Nodes');
        measureTime(getTables, 'getTables');

        showStatusMessage('Reconstruct Update Set Edges');
        measureTime(reconstructUpdateSetEdges, 'reconstructUpdateSetEdges');

        showStatusMessage('Reconstruct Reference Edges');
        measureTime(reconstructReferenceEdges, 'reconstructReferenceEdges');

        showStatusMessage('Reconstruct Basic Prefix Groups');
        measureTime(reconstructBasicPrefixGroups, 'reconstructBasicPrefixGroups');

        showStatusMessage('Reconstruct Levels and Extension Groups');
        measureTime(reconstructLevelsAndGroups, 'reconstructLevelsAndGroups');

        showStatusMessage('Reconstruct Prefix Groups');
        measureTime(reconstructPrefixGroups, 'reconstructPrefixGroups');

        showStatusMessage('Reconstruct Extension Edges');
        measureTime(reconstructExtensionEdges, 'reconstructExtensionEdges');

        showStatusMessage('Reconstruct Missing Group Edges (Prefix Edges)');
        measureTime(reconstructMissingGroupEdges, 'reconstructMissingGroupEdges');

        showStatusMessage('Rebuild Group Member Count');
        measureTime(rebuildGroupMemberCount, 'rebuildGroupMemberCounts');

        showStatusMessage('Clear Memberless Groups');
        measureTime(clearMemberlessGroups, 'clearMemberlessGroups');

        showStatusMessage('Remove Suffixed Dash from Groups');
        measureTime(removeDashFromGroups, 'removeDashFromGroups');

        measureTime(rebuildRawGroups, 'rebuildRawGroups');

        showStatusMessage('Doing Edge Statistics');
        measureTime(getEdgesTopTables, 'getEdgesTopTables');

        showStatusMessage('Pumping up sizes');
        measureTime(pumpSizes, 'pumpSizes');

        if (typeof rawPositions == 'object' && rawPositions != null) {
            showStatusMessage('Reconstruct Node Positions');
            measureTime(reconstructNodePositions, 'reconstructNodePositions');
        }
        
        showStatusMessage('Processing complete');
    }

    measureTime(processServiceNowTablesNow, 'processServiceNowTables');
    return {
        nodes: rawNodes,
        edges: rawEdges,
        statistics: {
            groups: rawGroups,
            edges: edgeStatistics
        },
        tables: tables
    }
}