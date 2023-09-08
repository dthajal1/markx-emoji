
const DEFAULT_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutes

interface InMemoryCache<T> {
  [key: string]: {
    data: T;
    expiration: number;
  };
}

// TODO: consider its limitations. might have to find an alternative? 
// TODO: convert it to a class
const inMemoryCache: InMemoryCache<any> = {};

export function storeData<T>(key: string, data: T, expirationTime?: number) {
  expirationTime = expirationTime || DEFAULT_EXPIRATION_TIME
  inMemoryCache[key] = {
    data,
    expiration: Date.now() + expirationTime,
  };

  // Schedule the removal of the entry after the expiration time
  setTimeout(() => {
    delete inMemoryCache[key];
  }, expirationTime);
}

export function retrieveData<T>(key: string): T | undefined {
  const cacheEntry = inMemoryCache[key];
  if (cacheEntry && cacheEntry.expiration > Date.now()) {
    return cacheEntry.data as T;
  }
  return undefined;
}

export function removeData(key: string) {
  delete inMemoryCache[key];
}