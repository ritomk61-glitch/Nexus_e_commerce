const requestCounts = new Map();

/**
 * In-memory sliding window rate limiter
 */
export function rateLimiter({
  windowMs = 60 * 1000,
  maxRequests = 100,
  message = "Too many requests. Please try again later.",
} = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;

    let timestamps = requestCounts.get(ip) || [];
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= maxRequests) {
      return res.status(429).json({
        error: message,
        retryAfterSeconds: Math.ceil((timestamps[0] + windowMs - now) / 1000),
      });
    }

    timestamps.push(now);
    requestCounts.set(ip, timestamps);

    // Periodically clean stale entries
    if (requestCounts.size > 1000) {
      for (const [key, times] of requestCounts.entries()) {
        if (times.length === 0 || times[times.length - 1] < windowStart) {
          requestCounts.delete(key);
        }
      }
    }

    next();
  };
}
