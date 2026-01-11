// Simple in-memory rate limiter for edge functions
// Uses a sliding window approach

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// In-memory store (resets on function cold start)
const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

// Default config: 10 requests per minute per user
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,   // 1 minute
  maxRequests: 10,
};

export function checkRateLimit(
  userId: string,
  functionName: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetIn: number } {
  const key = `${functionName}:${userId}`;
  const now = Date.now();
  
  const entry = rateLimitStore.get(key);
  
  if (!entry || (now - entry.windowStart) >= config.windowMs) {
    // New window or expired window
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { 
      allowed: true, 
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs 
    };
  }
  
  // Within current window
  if (entry.count >= config.maxRequests) {
    const resetIn = config.windowMs - (now - entry.windowStart);
    return { 
      allowed: false, 
      remaining: 0,
      resetIn 
    };
  }
  
  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return { 
    allowed: true, 
    remaining: config.maxRequests - entry.count,
    resetIn: config.windowMs - (now - entry.windowStart)
  };
}

// Clean up old entries periodically (called at start of each request)
export function cleanupRateLimits(maxAgeMs: number = 5 * 60 * 1000): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > maxAgeMs) {
      rateLimitStore.delete(key);
    }
  }
}

// Create rate limit response
export function rateLimitResponse(
  resetIn: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ 
      error: "Rate limit exceeded. Please try again later.",
      retryAfter: Math.ceil(resetIn / 1000)
    }),
    { 
      status: 429, 
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(resetIn / 1000))
      } 
    }
  );
}
