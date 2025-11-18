const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Save data to localStorage with timestamp
 */
export const saveToCache = (key, data) => {
  try {
    const cacheData = {
      data: data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
    console.log(`[Cache] Saved to ${key}`);
  } catch (error) {
    console.error(`[Cache] Error saving to ${key}:`, error);
  }
};

/**
 * Get data from localStorage if not expired (within 1 hour)
 */
export const getFromCache = (key) => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    if (age > CACHE_DURATION) {
      console.log(`[Cache] ${key} expired (${Math.round(age / 1000 / 60)} minutes old)`);
      localStorage.removeItem(key);
      return null;
    }

    console.log(`[Cache] Retrieved from ${key} (${Math.round(age / 1000 / 60)} minutes old)`);
    return data;
  } catch (error) {
    console.error(`[Cache] Error reading from ${key}:`, error);
    return null;
  }
};

/**
 * Clear specific cache key
 */
export const clearCache = (key) => {
  try {
    localStorage.removeItem(key);
    console.log(`[Cache] Cleared ${key}`);
  } catch (error) {
    console.error(`[Cache] Error clearing ${key}:`, error);
  }
};

/**
 * Clear all cache keys matching a pattern
 */
export const clearCachePattern = (pattern) => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        localStorage.removeItem(key);
      }
    });
    console.log(`[Cache] Cleared all keys matching: ${pattern}`);
  } catch (error) {
    console.error(`[Cache] Error clearing pattern ${pattern}:`, error);
  }
};

/**
 * Get cache age in minutes
 */
export const getCacheAge = (key) => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    return Math.round(age / 1000 / 60);
  } catch (error) {
    return null;
  }
};