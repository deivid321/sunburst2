angular
    .module('sunburstApp', [])
    .controller('sunburstController', function ($scope, $http) {
            $scope.dataIsLoaded = false;
            var p1 = $http({
                url: "data/MemoryJson.json",
                method: 'GET',
            });

            var p2 = $http({
                url: "data/MemoryJson3.json",
                method: 'GET',
            });

            p1.then(function (response) {
                $scope.status1 = response.statusText;
                var paths1 = angular.fromJson(response.data.histograms[0].path);
                var totals1 = angular.fromJson(response.data.histograms[0].total);

                p2.then(function (response2) {
                    $scope.status2 = response2.statusText;
                    var paths2 = angular.fromJson(response2.data.histograms[0].path);
                    var totals2 = angular.fromJson(response2.data.histograms[0].total);

                    compare(paths1, totals1, paths2, totals2);

                    var colors = {};
                    $scope.json1 = buildHierarchy(paths1, totals1, colors);
                    $scope.colors1 = colors;
                    colors = {};
                    $scope.json2 = buildHierarchy(paths2, totals2, colors);
                    $scope.colors2 = colors;

                    $scope.dataIsLoaded = true;
                });

            });

            function buildHierarchy(paths, totals, colors) {
                var root = {"name": "root", "children": []};
                for (var i = 0; i < paths.length; i++) {
                    var size = parseInt(totals[i]);
                    if (size <= 0) {
                        continue;
                    }
                    var sequence = paths[i];
                    var parts = sequence.split("\/");
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
                return "#" + "00000".substring(0, 6 - c.length) + c;
            }

            function getIndex(array, key) {
                var lo = 0,
                    hi = array.length - 1,
                    mid,
                    element;
                while (lo <= hi) {
                    mid = ((lo + hi) >> 1);
                    element = array[mid];
                    if (element < key) {
                        lo = mid + 1;
                    } else if (element > key) {
                        hi = mid - 1;
                    } else {
                        return mid;
                    }
                }
                return -1;
            }

            // A - B
            function compare(paths1, totals1, paths2, totals2) {
                for (var indA = 0; indA < paths1.length; indA++) {
                    var valA = parseInt(totals1[indA]);
                    if (valA <= 0) {
                        continue;
                    }
                    var item = paths1[indA];
                    var indB = getIndex(paths2, item);
                    if (indB >= 0) {
                        var valB = totals2[indB];
                        var diff = valA - valB;
                        if (diff == 0) {
                            totals1[indA] = -1;
                            totals2[indB] = -1;
                        }
                        if (diff > 0) {
                            totals1[indA] = diff;
                            totals2[indB] = -1;
                        }
                        if (diff < 0) {
                            totals2[indB] = Math.abs(diff);
                            totals1[indA] = -1;
                        }
                    }
                }
            }

        }
    )
    .directive('sunburstDirective', sunburst);

function sunburst($http) {
    return {
        templateUrl: 'js/chart.html',
        link: link
    };
}

function link($scope, element, attrs) {
    showSunburst($scope.json1, $scope.colors1, "1");
    showSunburst($scope.json2, $scope.colors2, "2");
}

function showSunburst(json, colors, id) {
    // Breadcrumb dimensions: width, height, spacing, width of tip/tail.
    var b = {
        w: 155,
        h: 50,
        s: 10,
        t: 10
    };

    // Dimensions of sunburst frame
    var width = (window.innerWidth - 60) / 2;
    var height = window.innerHeight / 2;
    var radius = Math.min(width, height) / 2;

    // Total size of all segments; we set this later, after loading the data.
    var totalSize = 0;

    var vis = d3.select("#chart" + id).append("svg:svg")
        .attr("class", "chart")
        .attr("id", "chart" + id)
        .attr("width", width)
        .attr("x", 0)
        .attr("height", height)
        .append("svg:g")
        .attr("id", "container" + id)
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

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

    createVisualization(json);

    // Main function to draw and set up the visualization, once we have the data.
    function createVisualization(json) {

        // Basic setup of page elements.
        if (id == 1) initializeBreadcrumbTrail();

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
            .attr("id", "path" + id)
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
        d3.select("#container" + id).on("mouseleave", mouseleave);

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

        d3.selectAll("#percentage" + id)
            .text(percentageString);

        d3.select("#size" + id)
            .text(d.value + "(B)");

        d3.selectAll("#explanation" + id)
            .style("left", (width - 100) / 2 + "px")
            .style("top", (height + 102) / 2 + "px")
            .style("visibility", "");

        var basicPath = [];
        var sequenceArray = getAncestors(d, basicPath);
        updateBreadcrumbs(basicPath, percentageString);

        // Fade all the segments.
        d3.selectAll(".chart path")
            .style("opacity", 0.3);

        // Then highlight only those that are an ancestor of the current segment.
        d3.selectAll(".chart path")
            .filter(function (node) {
                return (sequenceArray.indexOf(node) >= 0);
            })
            .style("opacity", 1);
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

        d3.selectAll(".explanation")
            .style("visibility", "hidden");
    }

    function getAncestors(node, basicPath) {
        var all = d3.selectAll(".chart path")[0];
        var ls = all.filter(function (obj) {
            var curr1 = obj.__data__;
            var nd = node;
            while (nd.name != "root") {
                if (curr1.name != nd.name) return false;
                curr1 = curr1.parent;
                nd = nd.parent;
            }
            return true;
        });
        var path = [];
        if (ls.length == 0) return null;
        var firstTime = 1;
        ls.forEach(function (el) {
            var current = el.__data__;
            while (current.parent) {
                path.unshift(current);
                if (firstTime && current.name != "root")
                    basicPath.unshift(current);
                current = current.parent;
            }
            firstTime = 0;
        });
        return path;
    }

    function initializeBreadcrumbTrail() {

        var trail = d3.select("#sequence").append("svg:svg")
            .attr("width", window.innerWidth)
            .attr("height", 50)
            .attr("id", "trail");

        // Add the label at the end, for the percentage.
        trail.append("svg:text")
            .attr("id", "endlabel")
            .style("fill", "#000");
    };

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
            .text(percentageString + " \n" + nodeArray[nodeArray.length - 1].value + "B");

        // Make the breadcrumb trail visible, if it's hidden.
        d3.select("#trail")
            .style("visibility", "");
    }

}

