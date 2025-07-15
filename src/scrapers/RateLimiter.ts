/**
 * RateLimiter class for controlling the rate of async operations (e.g., API calls)
 * Usage: const limiter = new RateLimiter(1); await limiter.waitForNextCall();
 */
export class RateLimiter {
  private lastCallTime = 0;
  private readonly minInterval: number;

  constructor(callsPerSecond: number = 1) {
    this.minInterval = 1000 / callsPerSecond; // Convert to milliseconds
  }

  async waitForNextCall(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    
    if (timeSinceLastCall < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastCall;
      console.log(`Rate limiter: waiting ${waitTime}ms before next API call`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCallTime = Date.now();
  }
} 