import { createClient } from 'redis';
import { getRedisUrl } from '../config.js';

/**
 * Anti-brute-force attempt limiter backed by Redis.
 *
 * The Guardian spec lists "Attempt limiting (anti-brute-force)" as a check.
 * A rider who repeatedly fails authorization (wrong assignment, bad amount,
 * tampered credentials) gets rate-limited before their requests are even
 * evaluated, stopping trial-and-error against the payment/collection flow.
 */
export interface AttemptLimiter {
  /** Returns true if the rider is currently locked out (too many attempts). */
  isLocked(did: string): Promise<boolean>;
  /** Record a failed attempt; returns true if the rider just got locked out. */
  recordFailure(did: string): Promise<boolean>;
  /** Clear attempts after a successful authorization. */
  reset(did: string): Promise<void>;
}

export interface AttemptLimiterConfig {
  /** Max failures before lockout. */
  maxFailures: number;
  /** Sliding/rolling window in seconds. */
  windowSeconds: number;
  /** Lock duration in seconds once threshold is hit. */
  lockSeconds: number;
}

const DEFAULT_CONFIG: AttemptLimiterConfig = {
  maxFailures: 5,
  windowSeconds: 60,
  lockSeconds: 300,
};

export class RedisAttemptLimiter implements AttemptLimiter {
  private client: ReturnType<typeof createClient>;
  private cfg: AttemptLimiterConfig;

  constructor(url = getRedisUrl(), cfg: Partial<AttemptLimiterConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    this.client = createClient({ url });
    this.client.on('error', () => {
      /* Redis errors must not crash the request pipeline */
    });
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) await this.client.connect();
  }

  async disconnect(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }

  private key(did: string): string {
    return `safegate:attempts:${did}`;
  }

  async isLocked(did: string): Promise<boolean> {
    if (!this.client.isOpen) return false;
    const lockKey = this.key(did) + ':lock';
    return (await this.client.exists(lockKey)) === 1;
  }

  async recordFailure(did: string): Promise<boolean> {
    if (!this.client.isOpen) return false;
    const base = this.key(did);
    const count = await this.client.incr(base);
    if (count === 1) await this.client.expire(base, this.cfg.windowSeconds);
    if (count >= this.cfg.maxFailures) {
      const lockKey = this.key(did) + ':lock';
      await this.client.set(lockKey, '1', { EX: this.cfg.lockSeconds });
      await this.client.del(base);
      return true;
    }
    return false;
  }

  async reset(did: string): Promise<void> {
    if (!this.client.isOpen) return;
    await this.client.del([this.key(did), this.key(did) + ':lock']);
  }
}

/** In-memory fallback when Redis is unavailable (tests / local dev). */
export class MemoryAttemptLimiter implements AttemptLimiter {
  private failures = new Map<string, number[]>();
  private locks = new Map<string, number>();
  private cfg: AttemptLimiterConfig;

  constructor(cfg: Partial<AttemptLimiterConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
  }

  async isLocked(did: string): Promise<boolean> {
    const until = this.locks.get(did);
    if (until === undefined) return false;
    if (Date.now() > until) {
      this.locks.delete(did);
      return false;
    }
    return true;
  }

  async recordFailure(did: string): Promise<boolean> {
    const now = Date.now();
    const list = (this.failures.get(did) ?? []).filter(
      (t) => now - t < this.cfg.windowSeconds * 1000,
    );
    list.push(now);
    this.failures.set(did, list);
    if (list.length >= this.cfg.maxFailures) {
      this.locks.set(did, now + this.cfg.lockSeconds * 1000);
      this.failures.delete(did);
      return true;
    }
    return false;
  }

  async reset(did: string): Promise<void> {
    this.failures.delete(did);
    this.locks.delete(did);
  }
}
