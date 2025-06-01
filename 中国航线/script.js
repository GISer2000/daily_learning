const urls = {
  map: "china.geojson",
  ninelines: "nine_lines.geojson",
  airports: "airports.csv",
  flights: "flights.csv",
};

const svg  = d3.select("svg");
const width  = parseInt(svg.attr("width"));
const height = parseInt(svg.attr("height"));
const hypotenuse = Math.sqrt(width * width + height * height);

// must be hard-coded to match our topojson projection
// source: https://github.com/topojson/us-atlas
const projection = d3.geoMercator()
  .center([104, 35]) // 中国中心点经纬度
  .scale(700)
  .translate([width / 2, height / 2])
  .precision(0.1);

// const projection = d3.geoAlbers().scale(1280).translate([480, 300]);

const scales = {
  // used to scale airport bubbles
  airports: d3.scaleSqrt()
    .range([4, 18]),

  // used to scale number of segments per line
  segments: d3.scaleLinear()
    .domain([0, hypotenuse])
    .range([1, 10])
};

// have these already created for easier drawing
const g = {
  basemap:  svg.select("g#basemap"),
  nineLines: svg.select("g#ninelines"),
  flights:  svg.select("g#flights"),
  airports: svg.select("g#airports"),
  voronoi:  svg.select("g#voronoi")
};

console.assert(g.basemap.size()  === 1);
console.assert(g.nineLines.size() === 1);
console.assert(g.flights.size()  === 1);
console.assert(g.airports.size() === 1);
console.assert(g.voronoi.size()  === 1);

const tooltip = d3.select("text#tooltip");
console.assert(tooltip.size() === 1);

// load and draw base map
d3.json(urls.map).then(drawMap);
d3.json(urls.ninelines).then(drawMap1);

drawNorthArrow();
drawScaleBar();


// load the airport and flight data together
const promises = [
  d3.csv(urls.airports, typeAirport),
  d3.csv(urls.flights,  typeFlight)
];

Promise.all(promises).then(processData);

// process airport and flight data
function processData(values) {
  console.assert(values.length === 2);

  let airports = values[0];
  let flights  = values[1];

  console.log("airports: " + airports.length);
  console.log("flights: " + flights.length);

  // convert airports array (pre filter) into map for fast lookup
  let iata = new Map(airports.map(node => [node.iata, node]));

  // calculate incoming and outgoing degree based on flights
  // flights are given by airport iata code (not index)
  flights.forEach(function(link) {
    link.source = iata.get(link.origin);
    link.target = iata.get(link.destination);

    link.source.outgoing += link.count;
    link.target.incoming += link.count;
  });

  // remove airports out of bounds
  let old = airports.length;
  airports = airports.filter(airport => airport.x >= 0 && airport.y >= 0);
  console.log(" removed: " + (old - airports.length) + " airports out of bounds");

  // remove airports with NA state
  old = airports.length;
  // airports = airports.filter(airport => airport.state !== "NA");
  console.log(" removed: " + (old - airports.length) + " airports with NA state");

  // remove airports without any flights
  old = airports.length;
  airports = airports.filter(airport => airport.outgoing > 0 && airport.incoming > 0);
  console.log(" removed: " + (old - airports.length) + " airports without flights");

  // sort airports by outgoing degree
  airports.sort((a, b) => d3.descending(a.outgoing, b.outgoing));

  // keep only the top airports
  old = airports.length;
  airports = airports.slice(0, 70);
  console.log(" removed: " + (old - airports.length) + " airports with low outgoing degree");

  // done filtering airports can draw
  drawAirports(airports);
  drawPolygons(airports);

  // reset map to only include airports post-filter
  iata = new Map(airports.map(node => [node.iata, node]));

  // filter out flights that are not between airports we have leftover
  old = flights.length;
  flights = flights.filter(link => iata.has(link.source.iata) && iata.has(link.target.iata));
  console.log(" removed: " + (old - flights.length) + " flights");

  // done filtering flights can draw
  drawFlights(airports, flights);

  drawLegend();

  console.log({airports: airports});
  console.log({flights: flights});
}


function drawMap(mapData) {

  const path = d3.geoPath().projection(projection);

  const validFeatures = mapData.features.filter(f => {
    try {
      // 如果 path(f) 结果为 null，说明它无法正确投影，跳过
      return path(f) !== null;
    } catch (e) {
      return false;
    }
    });

  g.basemap.selectAll("path")
    .data(validFeatures)
    .enter()
    .append("path")
    .attr("d", path)
    .style("fill", "#dddddd")
    .style("stroke", "white")
    .style("stroke-width", "1px");
}

function drawMap1(mapData) {

  const path = d3.geoPath().projection(projection);

  const validFeatures = mapData.features.filter(f => {
    try {
      // 如果 path(f) 结果为 null，说明它无法正确投影，跳过
      return path(f) !== null;
    } catch (e) {
      return false;
    }
    });

  g.nineLines.selectAll("path")
    .data(validFeatures)
    .enter()
    .append("path")
    .attr("d", path)
    .style("stroke", "grey")
    .style("stroke-width", "2px");
}


function drawAirports(airports) {
  // adjust scale
  const extent = d3.extent(airports, d => d.outgoing);
  scales.airports.domain(extent);

  // draw airport bubbles
  g.airports.selectAll("circle.airport")
    .data(airports, d => d.iata)
    .enter()
    .append("circle")
    .attr("r",  d => scales.airports(d.outgoing))
    .attr("cx", d => d.x) // calculated on load
    .attr("cy", d => d.y) // calculated on load
    .attr("class", "airport")
    .each(function(d) {
      // adds the circle object to our airport
      // makes it fast to select airports on hover
      d.bubble = this;
    });
}

function drawPolygons(airports) {
  // convert array of airports into geojson format
  const geojson = airports.map(function(airport) {
    return {
      type: "Feature",
      properties: airport,
      geometry: {
        type: "Point",
        coordinates: [airport.longitude, airport.latitude]
      }
    };
  });

  // calculate voronoi polygons
  const polygons = d3.geoVoronoi().polygons(geojson);
  console.log(polygons);

  g.voronoi.selectAll("path")
    .data(polygons.features)
    .enter()
    .append("path")
    .attr("d", d3.geoPath(projection))
    .attr("class", "voronoi")
    .on("mouseover", function(d) {
      let airport = d.properties.site.properties;

      d3.select(airport.bubble)
        .classed("highlight", true);

      d3.selectAll(airport.flights)
        .classed("highlight", true)
        .raise();

      // make tooltip take up space but keep it invisible
      tooltip.style("display", null);
      tooltip.style("visibility", "hidden");

      // set default tooltip positioning
      tooltip.attr("text-anchor", "middle");
      tooltip.attr("dy", -scales.airports(airport.outgoing) - 4);
      tooltip.attr("x", airport.x);
      tooltip.attr("y", airport.y);

      // set the tooltip text
      tooltip.text(airport.name + ", " + airport.city + ", " + airport.state);

      // double check if the anchor needs to be changed
      let bbox = tooltip.node().getBBox();

      if (bbox.x <= 0) {
        tooltip.attr("text-anchor", "start");
      }
      else if (bbox.x + bbox.width >= width) {
        tooltip.attr("text-anchor", "end");
      }

      tooltip.style("visibility", "visible");
    })
    .on("mouseout", function(d) {
      let airport = d.properties.site.properties;

      d3.select(airport.bubble)
        .classed("highlight", false);

      d3.selectAll(airport.flights)
        .classed("highlight", false);

      d3.select("text#tooltip").style("visibility", "hidden");
    })
    .on("dblclick", function(d) {
      // toggle voronoi outline
      let toggle = d3.select(this).classed("highlight");
      d3.select(this).classed("highlight", !toggle);
    });
}

function drawFlights(airports, flights) {
  // break each flight between airports into multiple segments
  let bundle = generateSegments(airports, flights);

  // https://github.com/d3/d3-shape#curveBundle
  let line = d3.line()
    .curve(d3.curveBundle)
    .x(airport => airport.x)
    .y(airport => airport.y);

  let links = g.flights.selectAll("path.flight")
    .data(bundle.paths)
    .enter()
    .append("path")
    .attr("d", line)
    .attr("class", "flight")
    .each(function(d) {
      // adds the path object to our source airport
      // makes it fast to select outgoing paths
      d[0].flights.push(this);
    });

  // https://github.com/d3/d3-force
  let layout = d3.forceSimulation()
    // settle at a layout faster
    .alphaDecay(0.1)
    // nearby nodes attract each other
    .force("charge", d3.forceManyBody()
      .strength(10)
      .distanceMax(scales.airports.range()[1] * 2)
    )
    // edges want to be as short as possible
    // prevents too much stretching
    .force("link", d3.forceLink()
      .strength(0.7)
      .distance(0)
    )
    .on("tick", function(d) {
      links.attr("d", line);
    })
    .on("end", function(d) {
      console.log("layout complete");
    });

  layout.nodes(bundle.nodes).force("link").links(bundle.links);
}

// Turns a single edge into several segments that can
// be used for simple edge bundling.
function generateSegments(nodes, links) {
  // generate separate graph for edge bundling
  // nodes: all nodes including control nodes
  // links: all individual segments (source to target)
  // paths: all segments combined into single path for drawing
  let bundle = {nodes: [], links: [], paths: []};

  // make existing nodes fixed
  bundle.nodes = nodes.map(function(d, i) {
    d.fx = d.x;
    d.fy = d.y;
    return d;
  });

  links.forEach(function(d, i) {
    // calculate the distance between the source and target
    let length = distance(d.source, d.target);

    // calculate total number of inner nodes for this link
    let total = Math.round(scales.segments(length));

    // create scales from source to target
    let xscale = d3.scaleLinear()
      .domain([0, total + 1]) // source, inner nodes, target
      .range([d.source.x, d.target.x]);

    let yscale = d3.scaleLinear()
      .domain([0, total + 1])
      .range([d.source.y, d.target.y]);

    // initialize source node
    let source = d.source;
    let target = null;

    // add all points to local path
    let local = [source];

    for (let j = 1; j <= total; j++) {
      // calculate target node
      target = {
        x: xscale(j),
        y: yscale(j)
      };

      local.push(target);
      bundle.nodes.push(target);

      bundle.links.push({
        source: source,
        target: target
      });

      source = target;
    }

    local.push(d.target);

    // add last link to target node
    bundle.links.push({
      source: target,
      target: d.target
    });

    bundle.paths.push(local);
  });

  return bundle;
}

// determines which states belong to the continental united states
// https://gist.github.com/mbostock/4090846#file-us-state-names-tsv
function isContinental(state) {
  const id = parseInt(state.id);
  return id < 60 && id !== 2 && id !== 15;
}

// see airports.csv
// convert gps coordinates to number and init degree
function typeAirport(airport) {
  airport.longitude = parseFloat(airport.longitude);
  airport.latitude  = parseFloat(airport.latitude);

  // use projection hard-coded to match topojson data
  const coords = projection([airport.longitude, airport.latitude]);
  airport.x = coords[0];
  airport.y = coords[1];

  airport.outgoing = 0;  // eventually tracks number of outgoing flights
  airport.incoming = 0;  // eventually tracks number of incoming flights

  airport.flights = [];  // eventually tracks outgoing flights

  return airport;
}

// see flights.csv
// convert count to number
function typeFlight(flight) {
  flight.count = parseInt(flight.count);
  return flight;
}

// calculates the distance between two nodes
// sqrt( (x2 - x1)^2 + (y2 - y1)^2 )
function distance(source, target) {
  const dx2 = Math.pow(target.x - source.x, 2);
  const dy2 = Math.pow(target.y - source.y, 2);

  return Math.sqrt(dx2 + dy2);
}

// 地图三要素
function drawNorthArrow() {
  const northArrowGroup = svg.append("g")
    .attr("class", "north-arrow")
    .attr("transform", `translate(${width - 50}, 50)`); // 控制位置：右上角

  const arrowHeight = 30;         // 总高度
  const arrowBaseWidth = 20;      // 底部宽度
  const baseDip = 10;              // 底边中点向上的“折角”高度

  // 顶点
  const top = { x: 0, y: 0 };
  // 左右底角
  const left = { x: -arrowBaseWidth / 2, y: arrowHeight };
  const right = { x: arrowBaseWidth / 2, y: arrowHeight };
  // 底边中点向上折的位置
  const bottomMid = { x: 0, y: arrowHeight - baseDip };

  // 完整轮廓（三个点 + 凹底）
  const outerPoints = [top, right, bottomMid, left];

  // 白色底 + 黑色边框
  northArrowGroup.append("path")
    .attr("d", d3.line()
      .x(d => d.x)
      .y(d => d.y)
      .curve(d3.curveLinearClosed)(outerPoints))
    .attr("fill", "white")
    .attr("stroke", "black")
    .attr("stroke-width", 1.5);

  // 右半边黑色填充（右边 + 中间底点 + 顶点）
  const rightHalf = [top, right, bottomMid];

  northArrowGroup.append("path")
    .attr("d", d3.line()
      .x(d => d.x)
      .y(d => d.y)
      .curve(d3.curveLinearClosed)(rightHalf))
    .attr("fill", "black");

  // N 字母
  northArrowGroup.append("text")
    .attr("x", 0)
    .attr("y", -12)  // N与图形的位置
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .text("N")
    .attr("font-family", "sans-serif")
    .attr("font-size", "16px")
    // .attr("font-weight", "bold")
    .attr("fill", "black");
}

function drawScaleBar() {
  const scaleBarGroup = svg.append("g")
    .attr("class", "scale-bar")
    .attr("transform", `translate(${width - 130}, ${height - 40})`); // 调整比例尺位置

  // --- 自定义比例尺的刻度值（单位：公里） ---
  const scaleValuesKm = [0, 500, 1000]; // 所需的比例尺刻度，单位为公里

  // 获取地图中心纬度处每像素对应的米数（用于距离换算）
  const centerLat = projection.center()[1];
  const scaleFactor = projection.scale();
  const metersPerPixel = (2 * Math.PI * 6378137) / (scaleFactor * (2 * Math.PI * Math.cos(centerLat * Math.PI / 180)));
  const kmPerPixel = metersPerPixel / 1000;

  // 将每个刻度值转换为对应的像素位置
  const pixelPositions = scaleValuesKm.map(km => km / kmPerPixel);

  // 以最大刻度为基准，确定比例尺总长度（单位：像素）
  const totalPixelLength = pixelPositions[pixelPositions.length - 1];

  // --- 绘制比例尺段 ---
  // 每两个刻度值之间绘制一段矩形（如 0-500、500-1000）
  for (let i = 0; i < scaleValuesKm.length - 1; i++) {
    const startPixel = pixelPositions[i];
    const endPixel = pixelPositions[i + 1];
    const segmentWidth = endPixel - startPixel;

    scaleBarGroup.append("rect")
      .attr("x", startPixel)
      .attr("y", 0)
      .attr("width", segmentWidth)
      .attr("height", 8) // 比例尺条的高度
      .attr("fill", i % 2 === 0 ? "black" : "white") // 交替填充黑白色块
      .attr("stroke", "black")
      .attr("stroke-width", 1);
  }

  // --- 添加比例尺刻度标签 ---
  scaleValuesKm.forEach((value, i) => {
    scaleBarGroup.append("text")
      .attr("x", pixelPositions[i])
      .attr("y", 25) // 文字位于比例尺下方
      .attr("text-anchor", "middle")
      .text(i === scaleValuesKm.length - 1 ? `${value} km` : `${value}`) // 仅最后一个刻度标注“km”
      .attr("font-family", "sans-serif")
      .attr("font-size", "15px");
  });
}

function drawLegend() {
  const svg = d3.select("svg");
  const svgHeight = parseFloat(svg.attr("height")); // 获取SVG高度

  const legend = svg.append("g")
    .attr("class", "legend");

  // --- 机场图例 ---
  const airportColor = "#888888"; // 与CSS中.airport填充色匹配
  const airportLabel = "机场 (出港航班数量)";

  // 从比例尺的定义域中获取实际的最小和最大出港航班值
  const minOutgoing = scales.airports.domain()[0];
  const maxOutgoing = scales.airports.domain()[1];
  const midOutgoing = (minOutgoing + maxOutgoing) / 2; // 计算中间值

  // 定义机场图例项
  const legendAirportData = [
    { value: minOutgoing, label: `少量出港 (${Math.round(minOutgoing)} 班次)` },
    { value: midOutgoing, label: `中等出港 (${Math.round(midOutgoing)} 班次)` },
    { value: maxOutgoing, label: `大量出港 (${Math.round(maxOutgoing)} 班次)` }
  ];

  let currentYOffset = 10;
  const horizontalTextOffset = 45; // 文本相对圆圈右侧的固定偏移量

  // 机场图例标题
  legend.append("text")
    .attr("x", 0)
    .attr("y", currentYOffset)
    .text(airportLabel)
    .attr("font-size", "15px")
    .attr("font-weight", "bold")
    .attr("fill", "#000000");
  currentYOffset += 5; // 标题与下方内容的间距

  // 查找最大半径，用于确定垂直间距和圆圈中心对齐点
  const maxRadius = d3.max(legendAirportData, d => scales.airports(d.value));

  // 绘制机场大小图例项
  legendAirportData.forEach(item => {
    const radius = scales.airports(item.value);
    const group = legend.append("g")
      .attr("transform", `translate(0, ${currentYOffset + maxRadius})`); // 向下移动maxRadius以便圆圈垂直居中

    group.append("circle")
      .attr("r", radius)
      .attr("fill", airportColor)
      .attr("cx", maxRadius) // 相对于其组元素的圆心X坐标（与maxRadius对齐）
      .attr("cy", 0); // 圆心Y坐标

    group.append("text")
      .attr("x", maxRadius + horizontalTextOffset) // 文本位于圆圈右侧
      .attr("y", 0) // 垂直居中对齐文本
      .text(item.label)
      .attr("font-size", "14px")
      .attr("fill", "#000000")
      .attr("dominant-baseline", "middle"); // 垂直居中文本

    currentYOffset += (maxRadius * 2) + 5; // 纵向偏移，增加两倍最大半径和间距
  });

  currentYOffset += 15; // 机场图例和下一部分之间额外间距

  // --- 航线图例 ---
  const flightColor = "#444444"; // 与CSS中.flight的描边色匹配
  const flightLabel = "航线 (航班路径)";

  // 航线图例标题
  legend.append("text")
    .attr("x", 0)
    .attr("y", currentYOffset)
    .text(flightLabel)
    .attr("font-size", "15px")
    .attr("font-weight", "bold")
    .attr("fill", "#000000");
  currentYOffset += 20;

  // 绘制航线示例
  const flightLineGroup = legend.append("g")
    .attr("transform", `translate(0, ${currentYOffset})`);
  flightLineGroup.append("line")
    .attr("x1", 0)
    .attr("x2", 30) // 线段长度
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", flightColor)
    .attr("stroke-width", 2); // 与航线描边宽度匹配
  flightLineGroup.append("text")
    .attr("x", 40) // 文本位于线段右侧
    .attr("y", 0) // 垂直居中对齐文本
    .text("航班路径")
    .attr("font-size", "14px")
    .attr("fill", "#000000")
    .attr("dominant-baseline", "middle");

  // 计算图例总高度（必须在DOM中元素添加后调用getBBox）
  const legendBBox = legend.node().getBBox();
  const legendHeight = legendBBox.height;

  // 设置图例整体位置，将图例定位在左下角，留有一定内边距（如20像素）
  const padding = 20;
  legend.attr("transform", `translate(${padding}, ${svgHeight - legendHeight - padding})`);
}