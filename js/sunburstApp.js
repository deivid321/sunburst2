angular
    .module('sunburstApp', [])
    .controller('sunburstController', function ($scope, $http) {
        $scope.status = "Loading data";
        $scope.dataIsLoaded = false;
        var p1 = $http({
            url: "data/MemoryJson.json",
            method: 'GET',
        });

        var p2 = $http({
            url: "data/MemoryJson2.json",
            method: 'GET',
        });

        p1.then(function (response) {
            $scope.status1 = response.statusText;
            $scope.paths1 = angular.fromJson(response.data.histograms[0].path);
            $scope.totals1 = angular.fromJson(response.data.histograms[0].total);
            $scope.paths1C = $scope.paths1.slice();
            $scope.totals1C = $scope.totals1.slice();

            p2.then(function (response2) {
                $scope.status2 = response2.statusText;
                $scope.paths2 = angular.fromJson(response2.data.histograms[0].path);
                $scope.totals2 = angular.fromJson(response2.data.histograms[0].total);
                $scope.status = "Calculating data";
                calc();
                $scope.csv1 = [];
                angular.forEach($scope.paths1, function (item, i) {
                    if ($scope.totals1[i] > 0) {
                        var arr = [item.replace(/\//g, ':') + ", ", $scope.totals1[i]];
                        $scope.csv1.push(arr);
                    }
                    i++;
                });

               // calc2();
                $scope.csv2 = [];
                angular.forEach($scope.paths2, function (item, i) {
                    if ($scope.totals2[i] > 0) {
                        var arr = [item.replace(/\//g, ':') + ", ", $scope.totals2[i]];
                        $scope.csv2.push(arr);
                    }
                    i++;
                });
                $scope.dataIsLoaded = true;
                $scope.status = "Visualizing data";
            });

        });

        // A - B
        function calc() {
            $scope.n = 0;
            $scope.paths1N = [];
            $scope.totals1N = [];
            $scope.paths2N = [];
            $scope.totals2N = [];
            $scope.paths1C.forEach(doStuff);
        }

        //B - A
        function calc2() {
            $scope.paths2.forEach(doStuff);
        }

        function doStuff(item, i, arr) {
            var indexB = $scope.paths2.indexOf(item);
            if (indexB < 0) {
                // $scope.paths2.push(item);
                // $scope.totals2.push(0);
            } else {
                var a= $scope.totals1C[i];
                var b= $scope.totals2[indexB];
                var diff = a - b;
                if (diff == 0) {
                    $scope.n++;
                }
                if (diff > 0) {
                    $scope.totals1N.push(diff);
                    $scope.paths1N.push(item);

                }
                if (diff < 0) {
                    $scope.totals2 = Math.abs(diff);
                    $scope.paths1.splice(indexB, 1);
                    $scope.totals1.splice(indexB, 1);
                }
            }
        }

        function doStuff2(item, i, arr) {
            var indexA = $scope.paths1.indexOf(item);
            if (indexA < 0) {
                // $scope.paths.push(item);
                // $scope.totals.push(0);
            } else {
                $scope.totals2[i] -= $scope.totals1C[indexA];
            }
        }
    })
    .directive('sunburstDirective', sunburst);

function sunburst($http) {
    return {
        templateUrl: 'js/chart.html',
        link: link
    };
}

function link($scope, element, attrs) {
    showSunburst($scope.csv1, "1", 1);
    showSunburst($scope.csv2, "2", 2);
}
function showSunburst(csv, id, part) {
    // Breadcrumb dimensions: width, height, spacing, width of tip/tail.
    var b = {
        w: 155,
        h: 50,
        s: 10,
        t: 10
    };

    // Dimensions of legend item: width, height, spacing, radius of rounded rect.
    var li = {
        w: 180,
        h: 30,
        s: 3,
        r: 3
    };

    // Dimensions of sunburst frame
    var width = window.innerWidth / 2 - li.w - 40;
    var height = window.innerHeight / 2;
    var radius = Math.min(width, height) / 2;

    // Mapping of step names to colors is set in build Hierarchy
    var colors = [];

    // Total size of all segments; we set this later, after loading the data.
    var totalSize = 0;

    var vis = d3.select("#chart"+id).append("svg:svg")
        .attr("class", "chart")
        .attr("width", width)
        .attr("x", 0)
        .attr("height", height)
        .append("svg:g")
        .attr("id", "container"+id)
        .attr("transform", "translate(" + window.innerWidth / 2 / 2 + "," + window.innerHeight / 2 / 2.5 + ")");

    var partition = d3.layout.partition()
        .size([2 * Math.PI, radius * radius])
        .value(function (d) {
            return d.size;
        });

    var arc = d3.svg.arc()
        .startAngle(function (d) {
            return d.x;
        })
        .endAngle(function (d) {
            return d.x + d.dx;
        })
        .innerRadius(function (d) {
            return Math.sqrt(d.y);
        })
        .outerRadius(function (d) {
            return Math.sqrt(d.y + d.dy);
        });

    // Use d3.text and d3.csv.parseRows so that we do not need to have a header
    // row, and can receive the csv as an array of arrays.
    //d3.text("labas.csv", function(text) {
    //var csv = d3.csv.parseRows($scope.data);

    //Takes list of 2 columns array
    var json = buildHierarchy(csv);
    createVisualization(json);
    // });

    // Main function to draw and set up the visualization, once we have the data.
    function createVisualization(json) {

        // Basic setup of page elements.
        initializeBreadcrumbTrail();
        drawLegend();
        d3.select("#togglelegend").on("click", toggleLegend);

        // Bounding circle underneath the sunburst, to make it easier to detect
        // when the mouse leaves the parent g.
        vis.append("svg:circle")
            .attr("r", radius)
            .style("opacity", 0);

        // For efficiency, filter nodes to keep only those large enough to see.
        var nodes = partition.nodes(json)
            .filter(function (d) {
                return (d.dx > 0.005); // 0.005 radians = 0.29 degrees
            });

        var path = vis.data([json]).selectAll("path")
            .data(nodes)
            .enter().append("svg:path")
            .attr("id", "path"+id)
            .attr("class", ".chart path")
            .attr("display", function (d) {
                return d.depth ? null : "none";
            })
            .attr("d", arc)
            .attr("fill-rule", "evenodd")
            .style("fill", function (d) {
                return colors[d.name];
            })
            .style("opacity", 1)
            .on("mouseover", mouseover);

        // Add the mouseleave handler to the bounding circle.
        d3.select("#container"+id).on("mouseleave", mouseleave);

        // Get total size of the tree = value of root node from partition.
        totalSize = path.node().__data__.value;
    };

    // Fade all but the current sequence, and show it in the breadcrumb trail.
    function mouseover(d) {

        var percentage = (100 * d.value / totalSize).toPrecision(3);
        var percentageString = percentage + "%";
        if (percentage < 0.05) {
            percentageString = "< 0.05%";
        }

        d3.select("#percentage"+id)
            .text(percentageString);

        d3.select("#explanation"+id)
            .style("left", ((window.innerWidth - 140) / 2).toString() + "px")
            .style("top", ((window.innerHeight - 80) / 2).toString() + "px")
            .style("visibility", "");

        var sequenceArray = getAncestors(d);
        var sequenceArray2 = getAncestors2(d);
        updateBreadcrumbs(sequenceArray, percentageString);

        // Fade all the segments.
        d3.selectAll(".chart path")
            .style("opacity", 0.3);


        var arr = d3.selectAll(".chart path")
            .filter(function (node) {
                return (sequenceArray.indexOf(node) >= 0);
            });
        var visi = getAncestors2(d);
        var aa = arr;
        // Then highlight only those that are an ancestor of the current segment.
        d3.selectAll(".char path")
            .filter(function (node) {
                return (sequenceArray.indexOf(node) >= 0);
            })
            .style("opacity", 1);
/*
        d3.selectAll("#path2")
            .filter(function (node) {
                return (sequenceArray2.indexOf(node) >= 0);
            })
            .style("opacity", 1);
*/
/*
        var vis2 = d3.select("#chart"+2);
        vis2.selectAll("#path2")
            .filter(function (node) {
                return (sequenceArray.indexOf(node) >= 0);
            })
            .style("opacity", 1)
*/
    }

    // Restore everything to full opacity when moving off the visualization.
    function mouseleave(d) {

        // Hide the breadcrumb trail
        d3.select("#trail")
            .style("visibility", "hidden");

        // Deactivate all segments during transition.
        d3.selectAll(".chart path").on("mouseover", null);

        // Transition each segment to full opacity and then reactivate it.
        d3.selectAll(".chart path")
            .transition()
            .duration(500)
            .style("opacity", 1)
            .each("end", function () {
                d3.select(this).on("mouseover", mouseover);
            });

        d3.select("#explanation"+id)
            .style("visibility", "hidden");
    }

    // Given a node in a partition layout, return an array of all of its ancestor
    // nodes, highest first, but excluding the root.
    function getAncestors(node) {
        var path = [];
        var current = node;
        while (current.parent) {
            path.unshift(current);
            current = current.parent;
        }
        return path;
    }
    function findByName() {
        return true;
       // return el === node.name;
    }
    function getAncestors2(node) {
        var all = d3.selectAll("#path2");
        var list = all[0];
        var object = list.filter(function ( obj ) {
            return obj.__data__.name === node.name;
        })[0].__data__;
        var path = [];
        var current = object;
        while (current.parent) {
            path.unshift(current);
            current = current.parent;
        }
        return path;
    }

    function initializeBreadcrumbTrail() {
        // Add the svg area.
        var trail = d3.select("#sequence").append("svg:svg")
            .attr("width", width)
            .attr("height", 50)
            .attr("id", "trail");
        // Add the label at the end, for the percentage.
        trail.append("svg:text")
            .attr("id", "endlabel")
            .style("fill", "#000");
    }

    // Generate a string that describes the points of a breadcrumb polygon.
    function breadcrumbPoints(d, i) {
        var points = [];
        points.push("0,0");
        points.push(b.w + ",0");
        points.push(b.w + b.t + "," + (b.h / 2));
        points.push(b.w + "," + b.h);
        points.push("0," + b.h);
        if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
            points.push(b.t + "," + (b.h / 2));
        }
        return points.join(" ");
    }

    // Update the breadcrumb trail to show the current sequence and percentage.
    function updateBreadcrumbs(nodeArray, percentageString) {

        // Data join; key function combines name and depth (= position in sequence).
        var g = d3.select("#trail")
            .selectAll("g")
            .data(nodeArray, function (d) {
                return d.name + d.depth;
            });

        // Add breadcrumb and label for entering nodes.
        var entering = g.enter().append("svg:g");

        entering.append("svg:polygon")
            .attr("points", breadcrumbPoints)
            .style("fill", function (d) {
                return colors[d.name];
            });

        entering.append("svg:text")
            .attr("x", (b.w + b.t) / 2)
            .attr("y", b.h / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .text(function (d) {
                return d.name;
            });

        // Set position for entering and updating nodes.
        g.attr("transform", function (d, i) {
            return "translate(" + i * (b.w + b.s) + ", 0)";
        });

        // Remove exiting nodes.
        g.exit().remove();

        // Now move and update the percentage at the end.
        d3.select("#trail").select("#endlabel")
            .attr("x", (nodeArray.length + 0.5) * (b.w + b.s))
            .attr("y", b.h / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .text(percentageString);

        // Make the breadcrumb trail visible, if it's hidden.
        d3.select("#trail")
            .style("visibility", "");

    }

    function drawLegend() {

        var legend = d3.select("#legend"+id).append("svg:svg")
            .attr("width", li.w)
            .attr("height", d3.keys(colors).length * (li.h + li.s));

        var g = legend.selectAll("g")
            .data(d3.entries(colors))
            .enter().append("svg:g")
            .attr("transform", function (d, i) {
                return "translate(0," + i * (li.h + li.s) + ")";
            });

        g.append("svg:rect")
            .attr("rx", li.r)
            .attr("ry", li.r)
            .attr("width", li.w)
            .attr("height", li.h)
            .style("fill", function (d) {
                return d.value;
            });

        g.append("svg:text")
            .attr("x", li.w / 2)
            .attr("y", li.h / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .text(function (d) {
                return d.key;
            });
    }

    function toggleLegend() {
        var legend = d3.select("#legend"+id);
        if (legend.style("visibility") == "hidden") {
            legend.style("visibility", "");
        } else {
            legend.style("visibility", "hidden");
        }
    }

    // Take a 2-column CSV and transform it into a hierarchical structure suitable
    // for a partition layout. The first column is a sequence of step names, from
    // root to leaf, separated by hyphens. The second column is a count of how
    // often that sequence occurred.
    function buildHierarchy(csv) {
        var root = {"name": "root", "children": []};
        for (var i = 0; i < csv.length; i++) {
            var sequence = csv[i][0];
            var size = +csv[i][1];
            if (isNaN(size)) { // e.g. if this is a header row
                continue;
            }
            var parts = sequence.split(":");
            var currentNode = root;
            for (var j = 0; j < parts.length; j++) {
                var children = currentNode["children"];
                var nodeName = parts[j];
                colors[nodeName] = intToRGB(hashCode(nodeName));
                var childNode;
                if (j + 1 < parts.length) {
                    // Not yet at the end of the sequence; move down the tree.
                    var foundChild = false;
                    for (var k = 0; k < children.length; k++) {
                        if (children[k]["name"] == nodeName) {
                            childNode = children[k];
                            foundChild = true;
                            break;
                        }
                    }
                    // If we don't already have a child node for this branch, create it.
                    if (!foundChild) {
                        childNode = {"name": nodeName, "children": []};
                        children.push(childNode);
                    }
                    currentNode = childNode;
                } else {
                    // Reached the end of the sequence; create a leaf node.
                    childNode = {"name": nodeName, "size": size};
                    children.push(childNode);
                }
            }
        }
        return root;
    };

    function hashCode(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return hash;
    }

    function intToRGB(i) {
        var c = (i & 0x00FFFFFF)
            .toString(16)
            .toUpperCase();
        return "00000".substring(0, 6 - c.length) + c;
    }
}

