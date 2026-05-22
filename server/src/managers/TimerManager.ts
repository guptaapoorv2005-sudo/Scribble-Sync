export class TimerManager {
  private timeouts = new Map<string, NodeJS.Timeout>();
  private intervals = new Map<string, NodeJS.Timeout>();

  public setTimeout(key: string, handler: () => void, delayMs: number): void {
    this.clearTimeout(key);
    const timeout = setTimeout(handler, delayMs);
    this.timeouts.set(key, timeout);
  }

  public setInterval(key: string, handler: () => void, delayMs: number): void {
    this.clearInterval(key);
    const interval = setInterval(handler, delayMs);
    this.intervals.set(key, interval);
  }

  public clearTimeout(key: string): void {
    const existing = this.timeouts.get(key);
    if (existing) {
      clearTimeout(existing);
      this.timeouts.delete(key);
    }
  }

  public clearInterval(key: string): void {
    const existing = this.intervals.get(key);
    if (existing) {
      clearInterval(existing);
      this.intervals.delete(key);
    }
  }

  public clearAll(): void {
    this.timeouts.forEach((timeout) => clearTimeout(timeout));
    this.intervals.forEach((interval) => clearInterval(interval));
    this.timeouts.clear();
    this.intervals.clear();
  }
}
