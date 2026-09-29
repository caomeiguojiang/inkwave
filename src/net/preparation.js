// Host-owned loading policy. No rendering, transport, or wall-clock timers here.
export class Preparation {
  constructor(owners, host, now, { graceMs = 30000, timeoutMs = 120000 } = {}) {
    this.owners = new Set(owners);
    this.host = host;
    this.ready = new Set();
    this.started = now;
    this.graceMs = graceMs;
    this.timeoutMs = timeoutMs;
    this.quorumAt = null;
  }
  mark(id) { if (this.owners.has(id)) this.ready.add(id); }
  decide(now, connected, canStart = () => true) {
    const ready = [...this.ready].filter(id => connected.has(id));
    const excluded = [...this.owners].filter(id => !ready.includes(id));
    const hostReady = ready.includes(this.host);
    const quorum = hostReady && ready.length > this.owners.size / 2;
    if (quorum && this.quorumAt === null) this.quorumAt = now;
    if (!quorum) this.quorumAt = null;
    const complete = [...this.owners].every(id => !connected.has(id) || this.ready.has(id));
    const expired = now - this.started >= this.timeoutMs;
    const grace = quorum && now - this.quorumAt >= this.graceMs;
    if (hostReady && canStart(ready) && (complete || (quorum && (grace || expired))))
      return { action: 'start', excluded, ready };
    return { action: expired ? 'abort' : 'wait', excluded, ready };
  }
}
