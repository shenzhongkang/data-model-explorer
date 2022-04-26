var currentFilterGroup = null;
var focused = false;
var carved  = false;
var statusMessageIsPermanent = false;
var pluginHelper = false;

function showStatusMessage(msg, permanent) {
    function setMessage() {
        $('#loadingHint').removeClass('d-none');

        $('#loadingHint').html(msg);
        console.log(msg);

        if (permanent != true) {
            setTimeout(function() {
                $('#loadingHint').addClass('d-none');
            }, 5000);
        } else {
            statusMessageIsPermanent = true;
        }
    }
    if (window.requestAnimationFrame) {
        window.requestAnimationFrame(setMessage);
    } else {
        setMessage();
    }
}

function measureTime(callback, name) {
    var startTime = performance.now();
    var result = callback();
    console.log('Runtime/'+ name +': '+ (performance.now() - startTime) +'ms');

    return result;
}

function selectRelease() {
    var file = $('#releaseSelector').val();

    if (file == 'local_file') {
        openLocalFileDialog();

    } else if (file == 'load_custom') {
        openCompareDialog();

    } else if (file == 'instance') {
        // load and show the to be run script
        loadRemoteFile('getTablesAndExtensions.js?'+ new Date().getTime(), function(source) {
            $('#instanceSource').text(source);
            openInstanceFileDialog();
        });

    } else {
        loadRemoteFile(file);
        
    }
}

/*** View Details Handling ***/
function viewEntityDetails(nodeId, edgeId) {
    src = '<hr/>';

    if (nodeId) {
        var node = networkData.nodes.get(nodeId);
        var nodeData = node.data;

        src += '<strong>'+ nodeData.label +'</strong><br/>'
        src += nodeData.name +'<br/>';
    }

    if (edgeId) {
        var edge = networkData.edges.get(edgeId);
        src += edge.title;
    }

    $('#entityInfo').html(src);
}

function viewNodeDetailsModal(nodeId) {
    src = '<hr/>';

    var node = networkData.nodes.get(nodeId);
    var nodeData = node.data;

    $('#tableInfoTitle').text(nodeData.label +' ('+ nodeData.name +')');

    var nodePath = getParentPath(nodeId);
    for (var i = nodePath.length -1; i >= 0; i--) {
        var parentNode = networkData.nodes.get(nodePath[i]);
        src += '<div style="display: inline-block; margin-left: '+ (+parentNode.level * 16) +'px;">'+ parentNode.data.label +'<br/>('+ parentNode.data.name +')</div><br/>';
    }

    $('#tableInfoBody').html(src);
    $('#tableInfoDialog').modal('show');
}

function clearEntityDetails() {
    $('#entityInfo').html('');

    if (statusMessageIsPermanent) {
        $('#loadingHint').addClass('d-none');
    }
}

/*** Search Handling ***/
function searchForTables(buttonPress) {
    // hard-trim search term
    $('#searchTerm').val($('#searchTerm').val().replace(/\s*/ig, ''));

    var searchTerm = $('#searchTerm').val();

    if (searchTerm == '' || (buttonPress == true && $("#searchMenu").css('display') == 'block')) {
        hideSearchResults();
        return;
    }

    var searchPosition   = $('#searchTerm').parent().offset();
    searchPosition.top   = searchPosition.top + $('#searchTerm').parent().height();

    var searchResults    = findTables(searchTerm);

    if (searchResults.length == 0) {
        $('#searchMenu #searchMenu-noResults').show();
    } else {
        $('#searchMenu #searchMenu-noResults').hide();
    }

    if (searchResults.length >= 1) {
        var result1 = searchResults[0].data;

        $("#searchMenu #searchMenu-Result1").show();
        $("#searchMenu #searchMenu-Result1").html(result1.label +'<br/>'+ result1.name);
        $("#searchMenu #searchMenu-Result1").off('click');
        $("#searchMenu #searchMenu-Result1").on('click', function(ev) {
            $("#searchMenu").hide();
            moveToNode(searchResults[0].id);
        });
    } else {
        $("#searchMenu #searchMenu-Result1").hide();
    }

    if (searchResults.length >= 2) {
        var result1 = searchResults[1].data;

        $("#searchMenu #searchMenu-Result2").show();
        $("#searchMenu #searchMenu-Result2").html(result1.label +'<br/>'+ result1.name);
        $("#searchMenu #searchMenu-Result2").off('click');
        $("#searchMenu #searchMenu-Result2").on('click', function(ev) {
            $("#searchMenu").hide();
            moveToNode(searchResults[1].id);
        });
    } else {
        $("#searchMenu #searchMenu-Result2").hide();
    }

    if (searchResults.length >= 3) {
        var result1 = searchResults[2].data;

        $("#searchMenu #searchMenu-Result3").show();
        $("#searchMenu #searchMenu-Result3").html(result1.label +'<br/>'+ result1.name);
        $("#searchMenu #searchMenu-Result3").off('click');
        $("#searchMenu #searchMenu-Result3").on('click', function(ev) {
            $("#searchMenu").hide();
            moveToNode(searchResults[2].id);
        });
    } else {
        $("#searchMenu #searchMenu-Result3").hide();
    }

    if (searchResults.length >= 4) {
        var result1 = searchResults[2].data;

        $("#searchMenu #searchMenu-divider").show();
        $("#searchMenu #searchMenu-moreResults").show();
        $("#searchMenu #searchMenu-moreResults").html('Show all results ('+ searchResults.length +')');
        $("#searchMenu #searchMenu-moreResults").off('click');
        $("#searchMenu #searchMenu-moreResults").on('click', function(ev) {
            $("#searchMenu").hide();
            viewFullResults(searchTerm, searchResults);
        });
    } else {
        $("#searchMenu #searchMenu-divider").hide();
        $("#searchMenu #searchMenu-moreResults").hide();
    }

    $("#searchMenu").css({
        display: "block",
        top: searchPosition.top,
        left: searchPosition.left
    });
}

function hideSearchResults() {
    $("#searchMenu").hide();
}

function viewFullResults(searchTerm, searchResults) {
    src = '<div class="list-group">';

    $('#fullSearchResultTitle').text('Search for "'+ searchTerm +'" ('+ searchResults.length +' results)');

    for (var i = 0; i < searchResults.length; i++) {
        var node = searchResults[i];

        src += '<a href="javascript: void(0);" onclick="hideFullResults(); moveToNode(\''+ node.id +'\');" class="list-group-item list-group-item-action flex-column align-items-start">'
        src += '<div class="d-flex w-100 justify-content-between">';
        src += '<h5 class="mb-1">'+ node.data.label +'</h5>';
        src += '<small>'+ (node.edgesCount != 1 ? node.edgesCount +' total Connections' : 'one Connection') +' / Size '+ node.size +'</small>';
        src += '</div>'
        src += '<p class="mb-1">Technical Name: '+ node.data.name +'<br/>Group: '+ node.group +'</p>'
        src += '</a>'
    }

    src += '</div>'

    $('#fullSearchResultBody').html(src);
    $('#fullSearchResultDialog').modal('show');
}

function hideFullResults() {
    $('#fullSearchResultDialog').modal('hide');
}

/*** Remote File Handling ***/

function loadRemoteFile(url, callback, username, password) { 
    if (typeof callback != 'function') {
        showStatusMessage('Loading data...');
    }

    var xmlhttp = new XMLHttpRequest();

    xmlhttp.onreadystatechange = function() {
        if (this.readyState == 4) {
            if (this.status == 200) {
                if (typeof callback == 'function') {
                    callback(this.responseText);
                } else {
                    loadJSON(this.responseText);
                }
            } else {
                if (this.status != 200) {
                    throw "Can not read file! HTTP Status: "+ this.status +"\n\n"+ this.responseText;
                }
            }
        }
    };

    xmlhttp.open("GET", url, true);
    xmlhttp.setRequestHeader('Accept', 'application/json');

    if (typeof username == 'string' && typeof password == 'string') {;
        xmlhttp.setRequestHeader('Authorization', 'Basic ' + btoa(username +':'+ password));
        xmlhttp.withCredentials = 'true'
    }

    xmlhttp.send();
}

/*** Local File Handling ***/
function loadLocalFile(callback) {
    $('#fileSelector').off('change');
    $('#fileSelector').on('change', function() {
        var files = this.files;

        if (files.length > 0) {
            showStatusMessage('Loading data...');
    
            var file = files[0];
    
            var reader = new FileReader();
            reader.onload = function(e) { 
                try {
                    // load file content
                    if (typeof callback == 'function') {
                        callback(e.target.result);
                    }
                } catch(err) {
                    alert('Unable to load file! Error:\n'+ err);
                }
            };
            reader.readAsText(file);
        }
    });
    $('#fileSelector').click();
}

function openLocalFileDialog() {
    loadLocalFile(function(source) {
        loadJSON(source);
    });
}

/*** Instance Data Handling ***/
function loadInstanceFile(callback) {
    // load and show the to be run script
    loadRemoteFile('getTablesAndExtensions.js?'+ new Date().getTime(), function(source) {
        $('#instanceSource').text(source);
        $('#instanceImportResultsButton').off('click');
        $('#instanceImportResultsButton').on('click', function() {
            instanceImportStep2(callback);
        });
        $('#instanceImportStep1Dialog').modal('show');
    });
}

function instanceImportStep2(callback) {
    $('#instanceImportStep1Dialog').modal('hide');
    if (pluginHelper == true) {
        $('#importAsPlugin').show();
    } else {
        $('#importAsPlugin').hide();
    }

    $('#importAsNew').off('click');
    $('#importAsNew').on('click', function() {
        loadInstanceData(callback);
    });
    $('#instanceImportStep2Dialog').modal('show');
}

function loadInstanceData(callback) {
    $('#instanceImportStep2Dialog').modal('hide');

    setTimeout(function() {
        var source = $('#instanceResult').val().trim();

        if (source != '') {
            var firstJSONMarker = source.indexOf('{');
            var lasstJSONMarker = source.lastIndexOf('}');

            // extract source
            source = source.substring(firstJSONMarker, lasstJSONMarker +1);

            try {
                // load file content
                if (typeof callback == 'function') {
                    callback(source);
                }
            } catch(err) {
                alert('Unable to load instance data model! Error:\n'+ err);
            }
        }
    }, 250);
}

function openInstanceFileDialog() {
    loadInstanceFile(loadJSON);
}

/*** Compare Handling ***/
function compareJSON(baseSource, compSource) {
    var baseData = typeof baseSource == 'string' ? JSON.parse(baseSource) : baseSource;
    var compData = typeof compSource == 'string' ? JSON.parse(compSource) : compSource;

    resolveSuperClass(baseData.tables);
    resolveSuperClass(compData.tables);

    var newExportData = {
        tables: [],
        refRel: []
    };
    var newTables = {};
    var newTableNames = {};

    // take over base tables, mark as entity of the base
    for (var i = 0; i < baseData.tables.length; i++) {
        var tableName = baseData.tables[i].name;

        if (typeof newTables[tableName] != 'object') {
            newTables[tableName] = baseData.tables[i];
            newTableNames[newTables[tableName].name] = tableName;

            newTables[tableName].compare = 'base';
            newExportData.tables.push(newTables[tableName]);
        }
    }

    // take over base references, mark as entity of the base
    for (var i = 0; i < baseData.refRel.length; i++) {
        newExportData.refRel.push(baseData.refRel[i]);
    }

    // take over tables from to be compared model, that are not already taken over, mark them as 'diff'
    for (var i = 0; i < compData.tables.length; i++) {
        var tableName = compData.tables[i].name;
        if (typeof newTables[tableName] != 'object') {
            newTables[tableName] = compData.tables[i];
            newTableNames[newTables[tableName].name] = tableName;

            newTables[tableName].compare = 'diff';
            newExportData.tables.push(newTables[tableName]);
        }
    }

    // take over references pointing from or to new tables
    for (var i = 0; i < compData.refRel.length; i++) {
        for (var j = 0; j < newExportData.tables.length; j++) {

            if (compData.refRel[i].to == newExportData.tables[j].name) {
                newExportData.refRel.push(compData.refRel[i]);

                // mark other side of the relation as 'base-required' if it was in the base
                for (var k = 0; k < newExportData.tables.length; k++) {
                    if (compData.refRel[i].from == newExportData.tables[j].name && newExportData.tables[j].compare == 'base') {
                        newExportData.tables[j].compare = 'base-required'
                    }
                }
            }

            if (compData.refRel[i].from == newExportData.tables[j].name) {
                newExportData.refRel.push(compData.refRel[i]);

                // mark other side of the relation as 'base-required' if it was in the base
                for (var k = 0; k < newExportData.tables.length; k++) {
                    if (compData.refRel[i].to == newExportData.tables[j].name && newExportData.tables[j].compare == 'base') {
                        newExportData.tables[j].compare = 'base-required'
                    }
                }
            }
        }  
    }

    return JSON.stringify(newExportData, null, '    ');
}

function testCompare() {
    loadRemoteFile('DataModel_ServiceNow-istanbul.json', function(compSource) {
        var compJSON = measureTime(function() {
            return compareJSON(exportData, compSource);
        }, 'compareJSON');
        console.log(compJSON);
        //loadJSON(compJSON);
    });    
}

function openCompareDialog() {
    $('#importCustomDialog').modal('show');
}

/*** Save Function Handling ***/
function saveData(data, fileName) {
    // prepare a hidden link
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    
    // write content to the link url as a data uri and click it
    var json = JSON.stringify(data, null, '    '),
        blob = new Blob([json], {type: "octet/stream"}),
        url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    a.click();

    // after clicking, remove hidden link
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

function saveExportedData() {
    saveData(exportData, 'exportData.json');
}

/*** Plugin Handling ***/
function loadPluginData() {
    $('#instanceImportStep2Dialog').modal('hide');

    setTimeout(function() {
        var source = $('#instanceResult').val().trim();

        if (source != '') {
            var firstJSONMarker = source.indexOf('{');
            var lasstJSONMarker = source.lastIndexOf('}');

            // extract source
            source = source.substring(firstJSONMarker, lasstJSONMarker +1);

            // build diff to current
            source = buildPluginJSON(source);
            console.log(source);

            // load source
            loadJSON(source);
        }
    }, 250);
}

function buildPluginJSON(newSource) {
    var baseData = exportData;
    var newData  = JSON.parse(newSource);

    resolveSuperClass(newData.tables);

    var newExportData = {
        tables: [],
        refRel: []
    };
    var newTables = {};

    // take over only tables, that are not in the base table
    for (var i = 0; i < newData.tables.length; i++) {
        var seenInBase = false; 

        for (var j = 0; !seenInBase && j < baseData.tables.length; j++) {
            seenInBase = newData.tables[i].name == baseData.tables[j].name;
        }

        if (!seenInBase) {
            var tableName = newData.tables[i].name;
            if (typeof newTables[tableName] != 'object') {
                newTables[tableName] = newData.tables[i];
                newExportData.tables.push(newTables[tableName]);
            }
        }
    }

    var baseTablesToTakeOver = [];

    // take over references pointing from or to new tables
    for (var i = 0; i < newData.refRel.length; i++) {
        for (var j = 0; j < newExportData.tables.length; j++) {

            if (newData.refRel[i].to == newExportData.tables[j].name) {
                for (var k = 0; k < baseData.tables.length; k++) {
                    if (newData.refRel[i].from == baseData.tables[k].name) {
                        baseTablesToTakeOver.push(baseData.tables[k]);
                        break;
                    }
                }
                newExportData.refRel.push(newData.refRel[i]);
            }
            
            if (newData.refRel[i].from == newExportData.tables[j].name) {
                for (var k = 0; k < baseData.tables.length; k++) {
                    if (newData.refRel[i].to == baseData.tables[k].name) {
                        baseTablesToTakeOver.push(baseData.tables[k]);
                        break;
                    }
                }
                newExportData.refRel.push(newData.refRel[i]);
            }
        }  
    }

    // restore base tables for the references 
    for (var i = 0; i < baseTablesToTakeOver.length; i++) {
        var tableName = baseTablesToTakeOver[i].name;
        if (typeof newTables[tableName] != 'object') {
            newTables[tableName] = baseTablesToTakeOver[i];
            newExportData.tables.push(newTables[tableName]);
        }
    }

    // restore parent tables
    for (var i = 0; i < newExportData.tables.length; i++) {
        var seenInNew = false; 

        for (var j = 0; !seenInNew && j < newExportData.tables.length; j++) {
            if (i == j) {
                continue;
            }

            seenInNew = newExportData.tables[i].super_class == newExportData.tables[j].name;
        }

        if (!seenInNew) {
            for (var j = 0; j < baseData.tables.length; j++) {
                if (baseData.tables[j].name == newExportData.tables[i].super_class) {
                    var tableName = baseData.tables[j].name;
                    if (typeof newTables[tableName] != 'object') {
                        newTables[tableName] = baseData.tables[j];
                        newExportData.tables.push(newTables[tableName]);
                    }
                }
            }
        }
    }

    return JSON.stringify(newExportData, null, '    ');
}

/*** Focus Handling ***/
function moveToNode(nodeId) {
    network.focus(nodeId, {
        scale: 0.66,
        animation: {
            duration: 250
        }
    })
    viewEntityDetails(nodeId, null);
}

function unfocusNetwork() {
    filterGroup(currentFilterGroup);
    $('#unfocusButton').addClass('d-none');
}