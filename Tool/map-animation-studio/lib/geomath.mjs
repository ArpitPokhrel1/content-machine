// Minimal geo helpers (no turf dependency) for great-circle arcs and
// progressive line "draw-on" slicing. Kept dependency-free on purpose: fewer
// supply-chain surfaces for a tool that will also ship as a packaged exe.

const R = 6371000;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

export function haversineMeters([lon1, lat1], [lon2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Great-circle interpolation (slerp) between two [lon,lat] points, fraction f in [0,1].
function slerp([lon1, lat1], [lon2, lat2], f) {
  const phi1 = toRad(lat1);
  const lambda1 = toRad(lon1);
  const phi2 = toRad(lat2);
  const lambda2 = toRad(lon2);
  const d =
    2 *
    Math.asin(
      Math.sqrt(Math.sin((phi2 - phi1) / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin((lambda2 - lambda1) / 2) ** 2)
    );
  if (d === 0) return [lon1, lat1];
  const a = Math.sin((1 - f) * d) / Math.sin(d);
  const b = Math.sin(f * d) / Math.sin(d);
  const x = a * Math.cos(phi1) * Math.cos(lambda1) + b * Math.cos(phi2) * Math.cos(lambda2);
  const y = a * Math.cos(phi1) * Math.sin(lambda1) + b * Math.cos(phi2) * Math.sin(lambda2);
  const z = a * Math.sin(phi1) + b * Math.sin(phi2);
  const phi = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lambda = Math.atan2(y, x);
  return [toDeg(lambda), toDeg(phi)];
}

// Builds a smooth great-circle arc between two points, lifted slightly for a
// "flight path" look (used by flow/migration/route layers).
export function greatCircleArc(from, to, { segments = 64, liftDeg = 0 } = {}) {
  const coords = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    let [lon, lat] = slerp(from, to, f);
    if (liftDeg) {
      const bulge = Math.sin(f * Math.PI) * liftDeg;
      lat += bulge;
    }
    coords.push([lon, lat]);
  }
  return coords;
}

// Slices a LineString's coordinate array to the first `fraction` of its
// total length, interpolating the cut point. Used for progressive "draw-on"
// animation of routes/arcs/border timelapses.
export function sliceLineByFraction(coords, fraction) {
  if (fraction <= 0) return [coords[0]];
  if (fraction >= 1) return coords;
  const segLengths = [];
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const len = haversineMeters(coords[i], coords[i + 1]);
    segLengths.push(len);
    total += len;
  }
  const target = total * fraction;
  let acc = 0;
  const sliced = [coords[0]];
  for (let i = 0; i < segLengths.length; i++) {
    if (acc + segLengths[i] >= target) {
      const remain = target - acc;
      const segFrac = segLengths[i] === 0 ? 0 : remain / segLengths[i];
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];
      sliced.push([lon1 + (lon2 - lon1) * segFrac, lat1 + (lat2 - lat1) * segFrac]);
      return sliced;
    }
    acc += segLengths[i];
    sliced.push(coords[i + 1]);
  }
  return coords;
}

export function bboxOfGeometry(geometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (coords) => {
    if (typeof coords[0] === "number") {
      const [x, y] = coords;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    } else {
      coords.forEach(visit);
    }
  };
  visit(geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

export function centroidOfBbox([minX, minY, maxX, maxY]) {
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

// Rough "fit zoom" heuristic for a bbox at a given viewport aspect — good
// enough for establishing shots; not a substitute for MapLibre's own
// cameraForBounds when precision matters (the runtime re-fits on load too).
export function zoomForBbox([minX, minY, maxX, maxY], viewportWidth = 1920) {
  const lonSpan = Math.max(Math.abs(maxX - minX), 0.01);
  const zoom = Math.log2((360 * (viewportWidth / 512)) / lonSpan);
  return Math.max(0, Math.min(18, zoom));
}

export const EASING = {
  linear: (t) => t,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  easeOutCubic: (t) => 1 - (1 - t) ** 3,
  easeInCubic: (t) => t * t * t
};

const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + toRad(Math.max(-85, Math.min(85, lat))) / 2));
const invMercY = (y) => toDeg(2 * Math.atan(Math.exp(y)) - Math.PI / 2);

// Camera that fits a lon/lat bbox inside a viewport (Mercator, MapLibre's 512px
// tiles), honouring both axes and a padding fraction. Unlike zoomForBbox this
// accounts for viewport height and Mercator latitude stretch, so tall regions
// and 9:16 output don't get clipped. `minSpanDeg` stops tiny regions (a single
// district/municipality) from zooming in until they lose all geographic context.
export function fitBbox([minX, minY, maxX, maxY], { width = 1920, height = 1080, padding = 0.12, minSpanDeg = 0 } = {}) {
  let cx = (minX + maxX) / 2;
  let lonSpan = maxX - minX;
  let y0 = mercY(minY);
  let y1 = mercY(maxY);
  if (lonSpan < minSpanDeg) lonSpan = minSpanDeg;
  const minYSpan = toRad(minSpanDeg);
  if (y1 - y0 < minYSpan) {
    const mid = (y0 + y1) / 2;
    y0 = mid - minYSpan / 2;
    y1 = mid + minYSpan / 2;
  }
  const usableW = width * (1 - 2 * padding);
  const usableH = height * (1 - 2 * padding);
  const zx = Math.log2((usableW / 512) * (360 / lonSpan));
  const zy = Math.log2((usableH / 512) * ((2 * Math.PI) / (y1 - y0)));
  return { center: [cx, invMercY((y0 + y1) / 2)], zoom: Math.max(0, Math.min(18, Math.min(zx, zy))) };
}

const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return a / 2;
};
const pointInRing = ([x, y], ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const pointInPolygon = (pt, poly) => pointInRing(pt, poly[0]) && !poly.slice(1).some((hole) => pointInRing(pt, hole));

// A point that is guaranteed to sit *inside* the feature, for placing a name
// label. A plain centroid or bbox-centre can fall outside a crescent- or
// L-shaped region (or in a hole), which would put the label over a neighbour.
export function labelPoint(geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const poly = polys.reduce((best, p) => (Math.abs(ringArea(p[0])) > Math.abs(ringArea(best[0])) ? p : best), polys[0]);
  const ring = poly[0];
  const area = ringArea(ring);
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
  }
  const centroid = area === 0 ? ring[0] : [cx / (6 * area), cy / (6 * area)];
  if (pointInPolygon(centroid, poly)) return centroid;
  // Scanline fallback: widest interior span along the centroid's latitude.
  const xs = [];
  for (const r of poly) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > centroid[1] !== yj > centroid[1]) xs.push(((xj - xi) * (centroid[1] - yi)) / (yj - yi) + xi);
    }
  }
  xs.sort((a, b) => a - b);
  let best = null;
  for (let i = 0; i + 1 < xs.length; i += 2) if (!best || xs[i + 1] - xs[i] > best[1] - best[0]) best = [xs[i], xs[i + 1]];
  return best ? [(best[0] + best[1]) / 2, centroid[1]] : centroid;
}
