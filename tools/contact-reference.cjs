const boundsCache = new WeakMap();
function bounds(p) {
    let b = boundsCache.get(p);
    if (!b) {
        b = { minX: Math.min(...p.map(v => v.x)), maxX: Math.max(...p.map(v => v.x)),
            minZ: Math.min(...p.map(v => v.z)), maxZ: Math.max(...p.map(v => v.z)) };
        boundsCache.set(p, b);
    }
    return b;
}
module.exports = function shapeEntry(a, from, to, b, at) {
    let first;
    const dx = to.x - from.x, dz = to.z - from.z;
    if (!a.polygons.length || !b.polygons.length) return undefined;
    const total = shape => {
        const bs = shape.polygons.map(bounds);
        return { minX: Math.min(...bs.map(v => v.minX)), maxX: Math.max(...bs.map(v => v.maxX)),
            minZ: Math.min(...bs.map(v => v.minZ)), maxZ: Math.max(...bs.map(v => v.maxZ)) };
    };
    const ab = total(a), bb = total(b);
    if (ab.maxX + from.x + Math.max(0, dx) < bb.minX + at.x || ab.minX + from.x + Math.min(0, dx) > bb.maxX + at.x
        || ab.maxZ + from.z + Math.max(0, dz) < bb.minZ + at.z || ab.minZ + from.z + Math.min(0, dz) > bb.maxZ + at.z) return undefined;
    for (const pa of a.polygons) for (const pb of b.polygons) {
        const aaBounds = bounds(pa), bbBounds = bounds(pb);
        if (aaBounds.maxX + from.x + Math.max(0, dx) < bbBounds.minX + at.x
            || aaBounds.minX + from.x + Math.min(0, dx) > bbBounds.maxX + at.x
            || aaBounds.maxZ + from.z + Math.max(0, dz) < bbBounds.minZ + at.z
            || aaBounds.minZ + from.z + Math.min(0, dz) > bbBounds.maxZ + at.z) continue;
        let enter = 0, leave = 1, separated = false;
        for (const polygon of [pa, pb]) for (let i = 0; i < polygon.length; i++) {
            const p = polygon[i], q = polygon[(i + 1) % polygon.length];
            const nx = -(q.z - p.z), nz = q.x - p.x;
            const aa = pa.map(v => (v.x + from.x) * nx + (v.z + from.z) * nz);
            const bb = pb.map(v => (v.x + at.x) * nx + (v.z + at.z) * nz);
            const amin = Math.min(...aa), amax = Math.max(...aa), bmin = Math.min(...bb), bmax = Math.max(...bb);
            const speed = dx * nx + dz * nz;
            if (Math.abs(speed) < 1e-12) {
                if (amax <= bmin || bmax <= amin) { separated = true; break; }
            } else {
                const t1 = (bmin - amax) / speed, t2 = (bmax - amin) / speed;
                enter = Math.max(enter, Math.min(t1, t2)); leave = Math.min(leave, Math.max(t1, t2));
                if (enter > leave) { separated = true; break; }
            }
        }
        if (!separated && leave >= enter && leave >= 0 && enter <= 1 && (first === undefined || enter < first)) first = enter;
        if (first === 0) return 0;
    }
    return first;
};
