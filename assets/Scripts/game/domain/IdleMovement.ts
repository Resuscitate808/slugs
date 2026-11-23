import { Random, Zombie } from './Model';

export interface IdleProfile {
    mode: number;
    speed: number;
    walkMin: number;
    walkMax: number;
    restMin: number;
    restMax: number;
    jumpMin: number;
    jumpMax: number;
    jumpDuration: number;
    jumpsMin: number;
    jumpsMax: number;
    jumpPause: number;
    jumpHeight: number;
}
export interface IdleMotion {
    profile: IdleProfile;
    phase: 'move' | 'rest' | 'gap';
    remaining: number;
    duration: number;
    jumps: number;
    distance: number;
    height: number;
    side?: number;
}
export function attachIdleMovement(z: Zombie, profile: IdleProfile, random: Random): void {
    z.idleMotion = { profile: { ...profile }, phase: 'move', remaining: 0, duration: 0, jumps: 0, distance: 0, height: 0 };
}
function sample(random: Random, a: number, b: number): number { return random.range(Math.min(a, b), Math.max(a, b)); }
function beginMove(z: Zombie, random: Random, series: boolean): void {
    const m = z.idleMotion!, p = m.profile;
    m.phase = 'move';
    if (p.mode === 2) {
        if (series) {
            m.side = random.chance(0.5) ? 1 : -1;
            m.jumps = Math.floor(random.range(Math.min(p.jumpsMin, p.jumpsMax), Math.max(p.jumpsMin, p.jumpsMax) + 1));
        }
        m.distance = sample(random, p.jumpMin, p.jumpMax);
        m.duration = p.jumpDuration;
    } else m.duration = p.mode === 3 ? Infinity : sample(random, p.walkMin, p.walkMax);
    m.remaining = m.duration;
}
export function updateIdleMovement(z: Zombie, random: Random, dt: number, advance: (distance: number) => boolean): void {
    if (z.state !== 'walking' && !(z.state === 'idle' && z.idleMotion?.profile.mode === 2)) return;
    const state = z.state;
    const m = z.idleMotion!, p = m.profile;
    if (m.duration === 0) beginMove(z, random, true);
    while (dt > 1e-9) {
        const step = Math.min(dt, m.remaining);
        if (m.phase === 'move') {
            const moving = advance((p.mode === 2 ? m.distance / m.duration : p.speed) * step);
            m.height = moving && p.mode === 2 ? Math.sin(Math.PI * Math.min(1, (m.duration - m.remaining + step) / m.duration)) * p.jumpHeight : 0;
        }
        m.remaining -= step;
        dt -= step;
        if (z.state !== state) { m.height = 0; return; }
        if (m.remaining > 1e-9) continue;
        m.height = 0;
        if (m.phase === 'move') {
            m.phase = p.mode === 2 && --m.jumps > 0 ? 'gap' : 'rest';
            m.remaining = m.phase === 'gap' ? p.jumpPause : sample(random, p.restMin, p.restMax);
        } else beginMove(z, random, m.phase === 'rest');
    }
}
