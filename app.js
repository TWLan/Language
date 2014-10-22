var twlanLang = angular.module('twlanLang', []);
var clipBoardValue = '';

twlanLang.service('store', [function(){
    this.data = {};
}])

twlanLang.controller('DiffController', ['store', '$timeout', '$scope', function(store, $timeout, $scope)
{
    $scope.store = store;
    $scope.Object = Object;
    $scope.lang = {target: '', src: ''};
    $scope.section = {key: ''};

    var threshold = 0;
    var lastThreshold = 0;
    $(window).bind('mousewheel DOMMouseScroll', function(event) {
        if (!$scope.sections) return;
        //console.log(event);
        var down = !(event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0);
        if ($('#sidebar').has($(event.target)).length > 0) return;

        if (new Date().getTime() - lastThreshold > 1000)
            threshold = 0;
        threshold += Math.abs((event.originalEvent.wheelDelta || event.originalEvent.detail * 40));
        lastThreshold = new Date().getTime();
        if (threshold >= 240) threshold = 0;
        else return;
        var elem = $('#main-container');
        console.log(elem[0].scrollHeight - elem.scrollTop()); //1164
        console.log(elem.outerHeight()); //591

        if(down && elem[0].scrollHeight - elem.scrollTop() > elem.outerHeight() + 1) return threshold = 0;
        if(!down && elem.scrollTop() != 0) return threshold = 0;
        
        var _n = $scope.sections.indexOf($scope.section.key);
        if (_n == -1) return;
        var _next = _n + (down ? 1 : -1);
        if (_next < 0 || _next >= $scope.sections.length) return;
        $scope.section.key = $scope.sections[_next];
        $scope.$apply();
        $(".sidebar").scrollTop($('.sidebar').find('.active').first().position().top - $('.sidebar').children().first().offset().top);
    });

    var webWorkerHandler = function (e) 
    {
        /* worker={} usable here as data store! */
        var endRun = function() { worker.running = false; };
        if (worker.running) return endRun();
        worker.running = true;

        var $scope = e.data;
        var ret = {};

        /*
            $timeout(function() {
            var statsObj = {};
            statsObj.sections = $('#content_area').find('.panel-danger,.panel-warning').length;
            statsObj.keys = $('.item.bg-danger,.item.bg-warning').length;
            var allKeys = $('.item').length;
            if (statsObj.keys == 0) statsObj.percentage = 100;
            else statsObj.percentage = Math.max(0, Math.min(100, 100 - Math.round(statsObj.keys / allKeys  * 100)));
            statsObj.progress = statsObj.percentage + '% of ' + $scope.lang.src + ' to ' + $scope.lang.target;
            $scope.stats = statsObj;
        }, 1000);
         */
        if (!$scope.lang.target || !$scope.lang.src) return endRun();
        /* Get all sections for lang.target and lang.src */
        var srcSections = $scope.data[$scope.lang.src];
        var targetSections = $scope.data[$scope.lang.target];

        ret.sections = Object.keys(srcSections||[])
            .concat(Object.keys(targetSections||[]))
            .filter(function( item, index, inputArray ) { return inputArray.indexOf(item) == index; });


        var sectionKeysRaw = {};
        var srcMap = {};
        var stats = {
            missingSections: [],
            incompleteSections: [],
            missingKeys: [],
            missingSectionKeys: {},
            keys: 0
        };
        ret.sections.forEach(function (section) 
        {
            if (srcSections && srcSections[section])
            {
                Object.keys(srcSections[section]).forEach(function (key) {
                    if (!srcMap[srcSections[section][key]]) srcMap[srcSections[section][key]] = [];
                    srcMap[srcSections[section][key]].push({section: section, key: key});
                });
                ret.srcMap = srcMap;
            }
            sectionKeysRaw[section] = Object.keys(
                srcSections && srcSections[section] ? srcSections[section] : []
            ).concat(Object.keys(
                targetSections && targetSections[section] ? targetSections[section] : [])
            ).filter(function( item, index, inputArray ) { return inputArray.indexOf(item) == index; });

            sectionKeysRaw[section].forEach(function (_key) 
            {
                if (!targetSections || !targetSections[section]) 
                {
                    if (stats.missingSections.indexOf(section) == -1)
                        stats.missingSections.push(section);
                }
                else if (!srcSections || !srcSections[section]) return;
                if (!targetSections || !targetSections[section] || !targetSections[section][_key])
                {
                    if (stats.missingSections.indexOf(section) == -1 && stats.incompleteSections.indexOf(section) == -1)
                        stats.incompleteSections.push(section);
                    stats.missingKeys.push(section + '.' + _key);
                    if (!stats.missingSectionKeys[section]) stats.missingSectionKeys[section] = [];
                    stats.missingSectionKeys[section].push(_key);
                }
                ++stats.keys;
            });
        });
        ret.sectionKeys = sectionKeysRaw;
        stats.percentage = Math.max(0, Math.min(100, 100 - Math.ceil(stats.missingKeys.length / stats.keys * 100)));
        stats.progress = stats.percentage + '% of ' + $scope.lang.src + ' to ' + $scope.lang.target;
        ret.stats = stats;
        postMessage(ret);
        endRun();
    };

    if (!window.Blob)
    {
        document.write("Your browser does not support the HTML-5 BLOB feature, which is a requirement!");
        return;
    }
    if (!window.File || !window.FileReader || !window.FileList)
    {
        document.write("Your browser does not support HTML-5 File API, which is a requirement!");
        return;
    }

    var handleFileInput = function (type)
    {
        return function (evt) {
            var file = evt.target.files[0];
            if (file)
            {
                var fileName = file.name;
                var reader = new FileReader();
                reader.readAsText(file, "UTF-8");
                reader.onload = function (r_evt) {
                    store.data[file.name] = JSON.parse(r_evt.target.result);
                    $scope.lang[type] = file.name;
                    var allowed = [$scope.lang.target, $scope.lang.src];
                    Object.keys(store.data).forEach(function (k)
                    {
                        if (allowed.indexOf(k) == -1) delete store.data[k];
                    });
                    $scope.$apply();
                };
                reader.onerror = alert;
            }
        };
    }
    $('#lang_file_src').on('change', handleFileInput('src'));
    $('#lang_file_target').on('change', handleFileInput('target'));

    var blob = new Blob([
        "worker = {running: false}; onmessage = " + webWorkerHandler.toString()
    ], {type: 'text/javascript'});

    var blobURL = window.URL.createObjectURL(blob);

    var worker = new Worker(blobURL);
    worker.onmessage = function(e) {
        //console.log(e);
        var _scope = e.data;
        Object.keys(_scope).forEach(function (_k) {
            $scope[_k] = _scope[_k];
        });
        $scope.$apply();
    };
    

    var prepareData = function()
    {
        worker.postMessage({
            lang: $scope.lang,
            data: store.data
        });
    };

    $scope.notSelf = function (section, entry)
    {
        return function (value, index) {
            return section != value.section || entry != value.key;
        };
    };

    $scope.highlight = {s: null, e: null};
    $scope.bak = null;

    $scope.showSuggestion = function(suggestion, sectionKey, entryKey, hover)
    {
        if (hover && $scope.highlight.s != null || !hover && $scope.highlight.s == null) return;
        var targets = store.data[$scope.lang.target];
        if (!targets[suggestion.section]) return alert('Not set on target');
        if (hover)
        {
            $scope.highlight.s = sectionKey;
            $scope.highlight.e = entryKey;
            var val = targets[suggestion.section][suggestion.key];
            if (!targets[sectionKey]) targets[sectionKey] = {};
            else $scope.bak = targets[sectionKey][entryKey];
            targets[sectionKey][entryKey] = val; 
        }
        else 
        {
            targets[sectionKey][entryKey] = $scope.bak;
            $scope.highlight.s = $scope.highlight.e = $scope.bak = null;
        }
    };

    $scope.removeEntry = function(sectionKey, entryKey)
    {
        delete $scope.store.data[$scope.lang.src][sectionKey][entryKey];
        delete $scope.store.data[$scope.lang.target][sectionKey][entryKey];
    };

    $scope.addNew = function(sectionKey, entryKey)
    {
        var keyname = prompt("Enter keyname");
        if (keyname)
        $scope.store.data[$scope.lang.src][sectionKey][keyname] = "";
    }

    $scope.applySuggestion = function(suggestion, sectionKey, entryKey)
    {
        $scope.highlight.s = $scope.highlight.e = $scope.bak = null;
    };

    $scope.exportTarget = function ()
    {
        var _escape = function(value)
        {
            return value.replace(/(")/g, '\\$1');
        };
        var getValue = function(lang)
        {
            var langObj = store.data[lang];
            return JSON.stringify(langObj);
        };
        var makeDLinks = function(target, lang) 
        {
            var tmpVal = getValue(lang);
            target.empty().append($('<a>')
                .attr('download', lang)
                .attr('href', 'data:text/plain;charset=UTF-8,' + encodeURIComponent(tmpVal))
                .text('Download'));
        };
        clipBoardValue = getValue($scope.lang.target);
        if ("download" in document.createElement("a"))
        {
            makeDLinks($('#target_file'), $scope.lang.target);
            makeDLinks($('#src_file'), $scope.lang.src);
            alert("Now use a download link or press CTRL+C and post it at twlan.org! If you change something do not forget to click the export button again!");
        }
        else
        {
            alert("Now press CTRL+C and post it at twlan.org! If you change something do not forget to click the export button again!");
        }
    };

    $scope.$watch('lang', function debugMarker0() { prepareData(); }, true);
    $scope.$watch(function() { return store.data; }, function debugMarker1() { prepareData(); }, true);
}]);

/* Clipboard Stuff */
$(document).keyup (function (e) {
    if ($(e.target).is("#clipboard"))
        $("#clipboard-container").empty().hide();
});
$(document).keydown(function (e) {
    if (!clipBoardValue || !(e.ctrlKey || e.metaKey)) return;
    if ($(e.target).is("input:visible,textarea:visible")) return;
    if (window.getSelection() && window.getSelection().toString()) return;
    if (document.selection && document.selection.createRange().text) return;

    setTimeout(function() {
        $clipboardContainer = $("#clipboard-container");
        $clipboardContainer.empty().show();
        $("<textarea id='clipboard'></textarea>")
        .val(clipBoardValue)
        .appendTo($clipboardContainer)
        .focus()
        .select();
    }, 1);
});