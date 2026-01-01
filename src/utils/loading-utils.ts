import { useState, useEffect, useCallback } from 'react';

// Enhanced GlobalLoadingManager with cross-browser synchronization
export class GlobalLoadingManager {
  private static activeOperations: string[] = [];
  private static broadcastChannel: BroadcastChannel | null = null;
  private static storageEventListenerAdded = false;
  private static timeoutMs = 30000; // Default timeout for operations: 30 seconds
  private static syncInterval: number | null = null;
  private static lastSyncTimestamp = 0;
  
  /**
   * Initialize the GlobalLoadingManager with cross-browser support
   */
  public static initialize() {
    try {
      console.log("Initializing GlobalLoadingManager with cross-browser sync");
      
      // Set up BroadcastChannel for cross-browser communication if supported
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.broadcastChannel = new BroadcastChannel('global-data-sync');
          this.broadcastChannel.onmessage = (event) => {
            try {
              const { type, key, value, source, timestamp } = event.data;
              
              // Check if the message is not outdated (synchronization conflict)
              if (timestamp && timestamp < this.lastSyncTimestamp) {
                console.log("Ignoring outdated sync message");
                return;
              }
              
              if (type === 'set' && key && value !== undefined) {
                // Update local storage without triggering another broadcast
                localStorage.setItem(key, value);
                
                // Dispatch event for components to react to data change
                window.dispatchEvent(new CustomEvent('dataSynced', {
                  detail: { key, value, source, timestamp }
                }));
              } else if (type === 'remove' && key) {
                localStorage.removeItem(key);
                
                window.dispatchEvent(new CustomEvent('dataSynced', {
                  detail: { key, value: null, source, timestamp }
                }));
              } else if (type === 'clear') {
                // Special handling for clear operation - only clear specific keys
                // This prevents clearing important browser data
                const keysToKeep = ['isAdmin', 'adminExpires']; // Keys to preserve
                const keysToRemove = [];
                
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key && !keysToKeep.includes(key)) {
                    keysToRemove.push(key);
                  }
                }
                
                // Remove keys that shouldn't be kept
                keysToRemove.forEach(key => localStorage.removeItem(key));
                
                window.dispatchEvent(new CustomEvent('dataSynced', {
                  detail: { key: 'all', value: null, source, timestamp }
                }));
              } else if (type === 'request-sync') {
                // Someone requested data - send what we have
                this.sendAllData();
              } else if (type === 'full-sync' && event.data.data) {
                // Full data sync received from another tab
                this.processSyncData(event.data.data, timestamp);
              }
            } catch (error) {
              console.error("Error processing BroadcastChannel message:", error);
            }
          };
          
          console.log("BroadcastChannel initialized successfully");
        } catch (error) {
          console.error("Error initializing BroadcastChannel:", error);
        }
      } else {
        console.log("BroadcastChannel not supported in this browser, falling back to storage events");
      }
      
      // Add a storage event listener as fallback for cross-browser/cross-tab
      if (!this.storageEventListenerAdded) {
        window.addEventListener('storage', (event) => {
          if (event.storageArea === localStorage && event.key && event.newValue) {
            window.dispatchEvent(new CustomEvent('dataSynced', {
              detail: { key: event.key, value: event.newValue, source: 'storage-event' }
            }));
          }
        });
        this.storageEventListenerAdded = true;
        console.log("Storage event listener added for cross-tab synchronization");
      }
      
      // Set up periodic sync to ensure data consistency across tabs/browsers
      if (this.syncInterval === null) {
        // Schedule periodic sync every 5 seconds
        this.syncInterval = window.setInterval(() => {
          this.requestFullSync();
        }, 5000);
        
        console.log("Periodic sync interval established");
      }
      
      // Request initial sync from other tabs after a short delay
      setTimeout(() => this.requestFullSync(), 500);
      
    } catch (error) {
      console.error("Error initializing GlobalLoadingManager:", error);
    }
  }
  
  /**
   * Process sync data received from another tab/window
   */
  private static processSyncData(data: Record<string, string>, timestamp?: number) {
    try {
      if (!data) return;
      
      // Only apply updates if the received data is newer
      if (timestamp && timestamp < this.lastSyncTimestamp) {
        console.log("Ignoring outdated full sync data");
        return;
      }
      
      // Update lastSyncTimestamp
      if (timestamp) {
        this.lastSyncTimestamp = timestamp;
      }
      
      let hasUpdates = false;
      const updates: Record<string, string> = {};
      
      // Apply updates to localStorage
      for (const [key, value] of Object.entries(data)) {
        const currentValue = localStorage.getItem(key);
        
        // Only update if value has changed
        if (currentValue !== value) {
          localStorage.setItem(key, value);
          updates[key] = value;
          hasUpdates = true;
        }
      }
      
      // Notify components about updates
      if (hasUpdates) {
        console.log("Applied sync updates for keys:", Object.keys(updates));
        window.dispatchEvent(new CustomEvent('multipleSynced', {
          detail: { updates, source: 'full-sync', timestamp }
        }));
      }
    } catch (error) {
      console.error("Error processing sync data:", error);
    }
  }
  
  /**
   * Send all current localStorage data to other tabs/browsers
   */
  private static sendAllData() {
    if (!this.broadcastChannel) return;
    
    try {
      const allData: Record<string, string> = {};
      const timestamp = Date.now();
      this.lastSyncTimestamp = timestamp;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) {
            allData[key] = value;
          }
        }
      }
      
      this.broadcastChannel.postMessage({
        type: 'full-sync',
        data: allData,
        source: 'data-sync',
        timestamp
      });
    } catch (error) {
      console.error("Error sending data sync:", error);
    }
  }
  
  /**
   * Request full data synchronization from other tabs/browsers
   */
  public static requestFullSync() {
    try {
      if (this.broadcastChannel) {
        const timestamp = Date.now();
        
        this.broadcastChannel.postMessage({
          type: 'request-sync',
          source: 'data-sync',
          timestamp
        });
        
        // Also dispatch an event to request sync from the current tab
        window.dispatchEvent(new CustomEvent('syncRequested', {
          detail: { timestamp }
        }));
      } else {
        // Fallback to localStorage-based sync
        this.syncViaLocalStorage();
      }
    } catch (error) {
      console.error("Error requesting full sync:", error);
    }
  }
  
  /**
   * Sync via localStorage when BroadcastChannel is not available
   */
  private static syncViaLocalStorage() {
    try {
      // Store a sync request marker with timestamp
      const timestamp = Date.now();
      localStorage.setItem('__sync_request__', timestamp.toString());
      
      // Remove the marker immediately to avoid confusion
      setTimeout(() => {
        localStorage.removeItem('__sync_request__');
      }, 100);
    } catch (error) {
      console.error("Error with localStorage sync:", error);
    }
  }
  
  /**
   * Set data with cross-browser synchronization
   * Value can be any type - objects will be stringified
   */
  public static setData(key: string, value: any): void {
    try {
      // Ensure value is a string for localStorage
      const valueString = typeof value === 'string' ? value : JSON.stringify(value);
      
      // Update localStorage
      localStorage.setItem(key, valueString);
      
      // Generate timestamp for sync ordering
      const timestamp = Date.now();
      this.lastSyncTimestamp = timestamp;
      
      // Broadcast to other tabs/browsers
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'set',
          key,
          value: valueString,
          source: 'data-sync',
          timestamp
        });
      }
      
      // Dispatch event for components to react
      window.dispatchEvent(new CustomEvent('dataSynced', {
        detail: { key, value: valueString, source: 'local', timestamp }
      }));
    } catch (error) {
      console.error(`Error setting data for key ${key}:`, error);
    }
  }
  
  /**
   * Get data with type safety
   */
  public static getData<T>(key: string, defaultValue: any): T {
    try {
      const value = localStorage.getItem(key);
      if (value === null) {
        // Return default value, which might need to be stringified if object
        return (typeof defaultValue === 'string') ? 
          defaultValue as unknown as T : 
          JSON.parse(JSON.stringify(defaultValue)) as T;
      }
      
      try {
        return JSON.parse(value) as T;
      } catch {
        // If not JSON, return as is if types match
        if (typeof defaultValue === typeof value) {
          return value as unknown as T;
        }
        return (typeof defaultValue === 'string') ? 
          defaultValue as unknown as T : 
          JSON.parse(JSON.stringify(defaultValue)) as T;
      }
    } catch (error) {
      console.error(`Error getting data for key ${key}:`, error);
      return (typeof defaultValue === 'string') ? 
        defaultValue as unknown as T : 
        JSON.parse(JSON.stringify(defaultValue)) as T;
    }
  }
  
  /**
   * Clear data with cross-browser synchronization
   */
  public static clearData(key: string): void {
    try {
      // Remove from localStorage
      localStorage.removeItem(key);
      
      // Generate timestamp for sync ordering
      const timestamp = Date.now();
      this.lastSyncTimestamp = timestamp;
      
      // Broadcast to other tabs/browsers
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'remove',
          key,
          source: 'data-sync',
          timestamp
        });
      }
      
      // Dispatch event for components to react
      window.dispatchEvent(new CustomEvent('dataSynced', {
        detail: { key, value: null, source: 'local', timestamp }
      }));
    } catch (error) {
      console.error(`Error clearing data for key ${key}:`, error);
    }
  }
  
  private static startOperation(operationName: string): void {
    if (!this.activeOperations.includes(operationName)) {
      this.activeOperations.push(operationName);
      
      // Set a timeout for the operation
      setTimeout(() => {
        if (this.activeOperations.includes(operationName)) {
          console.warn(`Operation ${operationName} timed out after ${this.timeoutMs}ms`);
          
          // Remove the operation from the active list
          this.activeOperations = this.activeOperations.filter(op => op !== operationName);
          
          // Dispatch a custom event to notify components about the timeout
          window.dispatchEvent(new CustomEvent('loadingTimedOut', {
            detail: { operationName, timeoutMs: this.timeoutMs }
          }));
        }
      }, this.timeoutMs);
    }
  }
  
  private static endOperation(operationName: string): void {
    this.activeOperations = this.activeOperations.filter(op => op !== operationName);
  }
  
  public static getActiveOperations(): string[] {
    return [...this.activeOperations];
  }
  
  /**
   * Cleanup resources
   */
  public static cleanup() {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    
    if (this.syncInterval !== null) {
      window.clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

/**
 * Custom hook for using synchronized data across browsers
 */
export function useSyncedData<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      return GlobalLoadingManager.getData<T>(key, defaultValue);
    } catch (error) {
      console.error(`Error in useSyncedData for key ${key}:`, error);
      return defaultValue;
    }
  });
  
  useEffect(() => {
    const handleDataChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.key === key) {
        try {
          const newValue = customEvent.detail.value;
          if (newValue !== null) {
            try {
              const parsedValue = JSON.parse(newValue);
              setValue(parsedValue as T);
            } catch {
              // If it's not valid JSON, use as is if types match
              if (typeof defaultValue === typeof newValue) {
                setValue(newValue as unknown as T);
              }
            }
          }
        } catch (error) {
          console.error(`Error handling data change for key ${key}:`, error);
        }
      }
    };
    
    const handleMultipleDataChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.updates && customEvent.detail.updates[key]) {
        try {
          const newValue = customEvent.detail.updates[key];
          if (newValue !== null) {
            try {
              const parsedValue = JSON.parse(newValue);
              setValue(parsedValue as T);
            } catch {
              // If it's not valid JSON, use as is if types match
              if (typeof defaultValue === typeof newValue) {
                setValue(newValue as unknown as T);
              }
            }
          }
        } catch (error) {
          console.error(`Error handling multiple data change for key ${key}:`, error);
        }
      }
    };
    
    const handleSyncRequest = () => {
      // When sync is requested, refresh our value from localStorage
      setValue(GlobalLoadingManager.getData<T>(key, defaultValue));
    };
    
    window.addEventListener('dataSynced', handleDataChange);
    window.addEventListener('multipleSynced', handleMultipleDataChange);
    window.addEventListener('syncRequested', handleSyncRequest);
    window.addEventListener('localStorageUpdated', handleSyncRequest);
    
    return () => {
      window.removeEventListener('dataSynced', handleDataChange);
      window.removeEventListener('multipleSynced', handleMultipleDataChange);
      window.removeEventListener('syncRequested', handleSyncRequest);
      window.removeEventListener('localStorageUpdated', handleSyncRequest);
    };
  }, [key, defaultValue]);
  
  const updateValue = useCallback((newValue: T) => {
    try {
      GlobalLoadingManager.setData(key, JSON.stringify(newValue));
      setValue(newValue);
    } catch (error) {
      console.error(`Error updating value for key ${key}:`, error);
    }
  }, [key]);
  
  return [value, updateValue];
}

/**
 * Custom hook for managing loading states with timeout support
 */
export function useLoadingState(initialState = false, timeoutMs = 15000) {
  const [isLoading, setIsLoading] = useState(initialState);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [timeoutId, setTimeoutId] = useState<number | null>(null);

  // Reset the state and timers
  const resetState = useCallback(() => {
    setIsLoading(false);
    setHasTimedOut(false);
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      setTimeoutId(null);
    }
  }, [timeoutId]);

  // Start the loading state
  const startLoading = useCallback(() => {
    setIsLoading(true);
    setHasTimedOut(false);
    
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
    
    const newTimeoutId = window.setTimeout(() => {
      if (isLoading) {
        setHasTimedOut(true);
      }
    }, timeoutMs);
    
    setTimeoutId(Number(newTimeoutId));
  }, [isLoading, timeoutId, timeoutMs]);

  // Stop the loading state
  const stopLoading = useCallback(() => {
    setIsLoading(false);
    
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      setTimeoutId(null);
    }
  }, [timeoutId]);

  // Update loading state when initialState changes
  useEffect(() => {
    if (initialState && !isLoading) {
      startLoading();
    } else if (!initialState && isLoading) {
      stopLoading();
    }
  }, [initialState, isLoading, startLoading, stopLoading]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return {
    isLoading,
    hasTimedOut,
    startLoading,
    stopLoading,
    resetState
  };
}
