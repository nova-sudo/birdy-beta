// utils/cacheHelper.js - REPLACE YOUR EXISTING cacheHelper.js WITH THIS

/**
 * Safe cache helper with validation and error handling
 */

const CACHE_VERSION = '1.0';
const CACHE_PREFIX = 'birdy_cache_';

/**
 * Validate cache data structure
 */
function validateCacheData(key, data) {
  if (data === null || data === undefined) {
    return false;
  }

  // Validate specific cache structures
  switch (key) {
    case 'marketing-data':
      return (
        typeof data === 'object' &&
        Array.isArray(data.campaigns) &&
        Array.isArray(data.adSets) &&
        Array.isArray(data.ads) &&
        Array.isArray(data.leads)
      );
    
    case 'clientGroups':
      return Array.isArray(data);
    
    default:
      // For unknown keys, just check if it's a valid object
      return typeof data === 'object';
  }
}

/**
 * Save data to localStorage with error handling
 */
export function saveToCache(key, data, ttl = 300000) { // 5 minutes default
  try {
    if (!key || data === undefined) {
      console.warn('saveToCache: Invalid key or data', { key, data });
      return false;
    }

    const cacheKey = `${CACHE_PREFIX}${key}`;
    const cacheData = {
      version: CACHE_VERSION,
      data: data,
      timestamp: Date.now(),
      ttl: ttl,
      expiresAt: Date.now() + ttl
    };

    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    console.log(`💾 Cached: ${key}`, {
      size: JSON.stringify(data).length,
      expiresIn: `${ttl / 1000}s`
    });
    
    return true;
  } catch (error) {
    console.error('saveToCache error:', error, { key });
    
    // If quota exceeded, try to clear old cache
    if (error.name === 'QuotaExceededError') {
      console.warn('Cache quota exceeded, clearing old cache...');
      clearOldCache();
      
      // Try again
      try {
        const cacheKey = `${CACHE_PREFIX}${key}`;
        const cacheData = {
          version: CACHE_VERSION,
          data: data,
          timestamp: Date.now(),
          ttl: ttl,
          expiresAt: Date.now() + ttl
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        return true;
      } catch (retryError) {
        console.error('Failed to cache after clearing:', retryError);
        return false;
      }
    }
    
    return false;
  }
}

/**
 * Get data from localStorage with validation
 */
export function getFromCache(key) {
  try {
    if (!key) {
      console.warn('getFromCache: No key provided');
      return null;
    }

    const cacheKey = `${CACHE_PREFIX}${key}`;
    const cached = localStorage.getItem(cacheKey);

    if (!cached) {
      console.log(`📭 Cache miss: ${key}`);
      return null;
    }

    const cacheData = JSON.parse(cached);

    // Validate cache structure
    if (!cacheData || typeof cacheData !== 'object') {
      console.warn(`⚠️ Invalid cache structure: ${key}`);
      clearCache(key);
      return null;
    }

    // Check version
    if (cacheData.version !== CACHE_VERSION) {
      console.warn(`⚠️ Cache version mismatch: ${key}`);
      clearCache(key);
      return null;
    }

    // Check expiration
    const now = Date.now();
    if (cacheData.expiresAt && now > cacheData.expiresAt) {
      console.log(`⏰ Cache expired: ${key} (age: ${((now - cacheData.timestamp) / 1000).toFixed(0)}s)`);
      clearCache(key);
      return null;
    }

    // Validate data structure
    if (!validateCacheData(key, cacheData.data)) {
      console.warn(`⚠️ Invalid cache data structure: ${key}`);
      clearCache(key);
      return null;
    }

    const age = ((now - cacheData.timestamp) / 1000).toFixed(0);
    console.log(`✅ Cache hit: ${key} (age: ${age}s)`);
    
    return cacheData.data;
  } catch (error) {
    console.error('getFromCache error:', error, { key });
    
    // Clear corrupted cache
    try {
      clearCache(key);
    } catch (clearError) {
      console.error('Failed to clear corrupted cache:', clearError);
    }
    
    return null;
  }
}

/**
 * Clear specific cache key
 */
export function clearCache(key) {
  try {
    if (!key) {
      console.warn('clearCache: No key provided');
      return false;
    }

    const cacheKey = `${CACHE_PREFIX}${key}`;
    localStorage.removeItem(cacheKey);
    console.log(`🗑️ Cleared cache: ${key}`);
    return true;
  } catch (error) {
    console.error('clearCache error:', error, { key });
    return false;
  }
}

/**
 * Clear all cache
 */
export function clearAllCache() {
  try {
    const keys = Object.keys(localStorage);
    let cleared = 0;

    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
        cleared++;
      }
    });

    console.log(`🗑️ Cleared all cache (${cleared} items)`);
    return true;
  } catch (error) {
    console.error('clearAllCache error:', error);
    return false;
  }
}

/**
 * Clear old/expired cache entries
 */
function clearOldCache() {
  try {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    let cleared = 0;

    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        try {
          const cached = localStorage.getItem(key);
          const cacheData = JSON.parse(cached);

          // Remove if expired or invalid
          if (!cacheData || 
              !cacheData.expiresAt || 
              now > cacheData.expiresAt ||
              cacheData.version !== CACHE_VERSION) {
            localStorage.removeItem(key);
            cleared++;
          }
        } catch (error) {
          // Remove corrupted cache
          localStorage.removeItem(key);
          cleared++;
        }
      }
    });

    console.log(`🧹 Cleared ${cleared} old/invalid cache entries`);
    return cleared;
  } catch (error) {
    console.error('clearOldCache error:', error);
    return 0;
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  try {
    const keys = Object.keys(localStorage);
    const stats = {
      total: 0,
      valid: 0,
      expired: 0,
      invalid: 0,
      size: 0,
      entries: []
    };

    const now = Date.now();

    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        stats.total++;
        
        try {
          const cached = localStorage.getItem(key);
          stats.size += cached.length;
          
          const cacheData = JSON.parse(cached);
          const age = ((now - cacheData.timestamp) / 1000).toFixed(0);
          const ttl = ((cacheData.expiresAt - now) / 1000).toFixed(0);
          
          if (cacheData.expiresAt && now > cacheData.expiresAt) {
            stats.expired++;
          } else if (cacheData.version !== CACHE_VERSION) {
            stats.invalid++;
          } else {
            stats.valid++;
          }
          
          stats.entries.push({
            key: key.replace(CACHE_PREFIX, ''),
            age: `${age}s`,
            ttl: ttl > 0 ? `${ttl}s` : 'expired',
            size: `${(cached.length / 1024).toFixed(2)}KB`
          });
        } catch (error) {
          stats.invalid++;
        }
      }
    });

    stats.size = `${(stats.size / 1024).toFixed(2)}KB`;
    
    return stats;
  } catch (error) {
    console.error('getCacheStats error:', error);
    return null;
  }
}

/**
 * Check if cache is available (localStorage supported and not full)
 */
export function isCacheAvailable() {
  try {
    const testKey = `${CACHE_PREFIX}test`;
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    console.warn('Cache not available:', error.name);
    return false;
  }
}

// Auto-clear old cache on module load
if (isCacheAvailable()) {
  clearOldCache();
}

// Export for debugging
if (typeof window !== 'undefined') {
  window.__cacheDebug = {
    stats: getCacheStats,
    clearAll: clearAllCache,
    clear: clearCache,
    get: getFromCache,
    save: saveToCache
  };
}