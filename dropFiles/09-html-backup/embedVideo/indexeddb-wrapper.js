/**
 * Modern IndexedDB Wrapper - Replaces Firebase functionality
 * Provides simple save/load operations with automatic key generation
 */

class IndexedDBWrapper {
    constructor() {
        this.dbConnections = new Map();
        this.availableKeys = new Set();
        this.DB_VERSION = 1;
        this.STORE_NAME = 'content';
    }

    /**
     * Opens database connection with proper error handling
     * @param {string} databaseName - Name of the database
     * @returns {Promise<IDBDatabase>} Database connection
     */
    async openDatabase(databaseName) {
        // Return existing connection if available
        if (this.dbConnections.has(databaseName)) {
            return this.dbConnections.get(databaseName);
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(databaseName, this.DB_VERSION);

            request.onerror = () => reject(new Error(`Failed to open database: ${request.error?.message}`));

            request.onsuccess = () => {
                const db = request.result;
                this.dbConnections.set(databaseName, db);
                
                // Handle database close/error events
                db.onclose = () => this.dbConnections.delete(databaseName);
                db.onerror = (event) => console.error(`Database error for ${databaseName}:`, event);
                
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create content store if it doesn't exist
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('dataType', 'dataType', { unique: false });
                }
            };
        });
    }

    /**
     * Saves data to IndexedDB (Firebase-style set function)
     * @param {string} databaseName - Database name
     * @param {string} key - Data key
     * @param {any} data - Data to save
     * @returns {Promise<void>}
     */
    async set(databaseName, key, data) {
        if (!databaseName || !key) {
            throw new Error('Database name and key are required');
        }

        try {
            const db = await this.openDatabase(databaseName);
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);

                const record = {
                    key,
                    data,
                    timestamp: Date.now(),
                    dataType: typeof data,
                    lastModified: new Date().toISOString()
                };

                const request = store.put(record);

                request.onsuccess = () => {
                    this.availableKeys.add(`${databaseName}/${key}`);
                    console.log(`✓ Saved: ${databaseName}/${key}`);
                    resolve();
                };

                request.onerror = () => reject(new Error(`Save failed: ${request.error?.message}`));
                
                transaction.onerror = () => reject(new Error(`Transaction failed: ${transaction.error?.message}`));
            });

        } catch (error) {
            throw new Error(`Failed to save ${databaseName}/${key}: ${error.message}`);
        }
    }

    /**
     * Retrieves data from IndexedDB (Firebase-style get function)
     * @param {string} databaseName - Database name
     * @param {string} key - Data key
     * @returns {Promise<Object>} Firebase-style snapshot object
     */
    async get(databaseName, key) {
        if (!databaseName || !key) {
            throw new Error('Database name and key are required');
        }

        try {
            const db = await this.openDatabase(databaseName);

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.STORE_NAME], 'readonly');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.get(key);

                request.onsuccess = () => {
                    const result = request.result;
                    
                    // Return Firebase-style snapshot object
                    resolve({
                        exists: () => !!result,
                        val: () => result ? result.data : null,
                        key: () => key,
                        ref: { key }
                    });
                };

                request.onerror = () => reject(new Error(`Get failed: ${request.error?.message}`));
                transaction.onerror = () => reject(new Error(`Transaction failed: ${transaction.error?.message}`));
            });

        } catch (error) {
            throw new Error(`Failed to load ${databaseName}/${key}: ${error.message}`);
        }
    }

    /**
     * Deletes data from IndexedDB
     * @param {string} databaseName - Database name
     * @param {string} key - Data key
     * @returns {Promise<void>}
     */
    async delete(databaseName, key) {
        if (!databaseName || key == null) {
            throw new Error('Database name and key are required');
        }

        try {
            const db = await this.openDatabase(databaseName);

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.delete(key);

                request.onsuccess = () => {
                    this.availableKeys.delete(`${databaseName}/${key}`);
                    console.log(`✓ Deleted: ${databaseName}/${key}`);
                    resolve();
                };

                request.onerror = () => reject(new Error(`Delete failed: ${request.error?.message}`));
            });

        } catch (error) {
            throw new Error(`Failed to delete ${databaseName}/${key}: ${error.message}`);
        }
    }

    /**
     * Gets all keys from a database
     * @param {string} databaseName - Database name
     * @returns {Promise<string[]>} Array of keys (just the keys, not prefixed)
     */
    async getAllKeys(databaseName) {
        try {
            const db = await this.openDatabase(databaseName);

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.STORE_NAME], 'readonly');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.getAllKeys();

                request.onsuccess = () => {
                    const keys = request.result;
                    // Add prefixed keys to our cache
                    keys.forEach(key => this.availableKeys.add(`${databaseName}/${key}`));
                    resolve(keys);
                };

                request.onerror = () => reject(new Error(`Get keys failed: ${request.error?.message}`));
            });

        } catch (error) {
            console.error(`Failed to fetch keys from ${databaseName}:`, error);
            return [];
        }
    }

    /**
     * Fetches all available keys from configured databases
     * @returns {Promise<void>}
     */
    async fetchAvailableKeys() {
        this.availableKeys.clear();

        // Get the current database name from input field or use default
        const databaseName = this.getCurrentDatabaseName();
        
        try {
            const keys = await this.getAllKeys(databaseName);
            
            console.log(`✓ Loaded ${keys.length} keys from database "${databaseName}":`, keys);
            
            if (keys.length === 0) {
                console.log(`📁 Database "${databaseName}" is empty - ready for new content!`);
            }
            
        } catch (error) {
            console.error('Error fetching available keys:', error);
        }
    }

    /**
     * Gets the current database name
     * @returns {string} Database name
     */
    getCurrentDatabaseName() {
        // Check nav database input first
        const navDatabaseInput = document.getElementById('navDatabaseInput');
        if (navDatabaseInput && navDatabaseInput.value.trim()) {
            return navDatabaseInput.value.trim();
        }

        // Check content area database input
        const databaseInput = document.getElementById('databaseInput');
        if (databaseInput && databaseInput.value.trim()) {
            return databaseInput.value.trim();
        }

        // Use the default from script.js if available
        if (window.DEFAULT_DATABASE_NAME) {
            return window.DEFAULT_DATABASE_NAME;
        }

        // Final fallback
        return 'vocabChinese';
    }

    /**
     * Generates a key based on current sidebar selection
     * @returns {string} Generated key
     */
    generateKey() {
        const activeItem = document.querySelector('.sidebar-item.active');
        
        if (activeItem) {
            // Use the same key generation logic as script.js: take first part before space
            return activeItem.textContent.split(' ')[0].trim();
        }
        
        // Fallback: try to get from page title
        const titleElement = document.querySelector('h2');
        if (titleElement) {
            return titleElement.textContent.split(' ')[0].trim();
        }
        
        return 'default_content';
    }

    /**
     * Gets all available keys as an array
     * @returns {string[]} Array of available keys
     */
    getAvailableKeysArray() {
        return Array.from(this.availableKeys).sort();
    }

    /**
     * Checks if a key exists in the current database
     * @param {string} key - Key to check
     * @returns {boolean} True if key exists
     */
    hasKey(key) {
        const databaseName = this.getCurrentDatabaseName();
        return this.availableKeys.has(`${databaseName}/${key}`);
    }

    /**
     * Clears all data from a database (use with caution!)
     * @param {string} databaseName - Database to clear
     * @returns {Promise<void>}
     */
    async clearDatabase(databaseName) {
        try {
            const db = await this.openDatabase(databaseName);

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.clear();

                request.onsuccess = () => {
                    // Remove all keys for this database from our cache
                    this.availableKeys.forEach(key => {
                        if (key.startsWith(`${databaseName}/`)) {
                            this.availableKeys.delete(key);
                        }
                    });
                    console.log(`✓ Cleared database: ${databaseName}`);
                    resolve();
                };

                request.onerror = () => reject(new Error(`Clear failed: ${request.error?.message}`));
            });

        } catch (error) {
            throw new Error(`Failed to clear ${databaseName}: ${error.message}`);
        }
    }
}

// ============================================================================
// Global Functions (Firebase API Compatibility)
// ============================================================================

// Create global instance
window.indexedDBWrapper = new IndexedDBWrapper();

/**
 * Saves current content to IndexedDB (replaces saveToFirebase)
 */
window.saveToIndexedDB = async function() {
    const databaseInput = document.getElementById('databaseInput') || 
                         document.getElementById('navDatabaseInput');
    
    if (!databaseInput) {
        console.error('Database input field not found');
        return;
    }

    // Get or set database name
    let databaseName = databaseInput.value.trim();
    if (!databaseName) {
        databaseName = window.indexedDBWrapper.getCurrentDatabaseName();
        databaseInput.value = databaseName;
    }

    const customKey = window.indexedDBWrapper.generateKey();

    // Find content to save
    const contentSources = [
        document.getElementById('contentTextArea'),
        document.querySelector('.content-notes'),
        document.querySelector('.text-content')
    ];

    let dataToSave = '';
    for (const source of contentSources) {
        if (source) {
            dataToSave = source.value || source.textContent || source.innerText || '';
            if (dataToSave.trim()) break;
        }
    }

    if (!dataToSave.trim()) {
        alert('No content to save.');
        return;
    }

    try {
        await window.indexedDBWrapper.set(databaseName, customKey, dataToSave);

        // Visual feedback
        const saveButton = document.getElementById('saveButton');
        if (saveButton) {
            const originalText = saveButton.textContent;
            const originalStyle = saveButton.style.cssText;
            
            saveButton.textContent = '✓ Saved';
            saveButton.style.backgroundColor = '#4CAF50';
            saveButton.style.color = 'white';
            
            setTimeout(() => {
                saveButton.textContent = originalText;
                saveButton.style.cssText = originalStyle;
            }, 2000);
        }

        console.log(`✓ Saved to IndexedDB: ${databaseName}/${customKey}`);

        // Refresh available keys
        await window.indexedDBWrapper.fetchAvailableKeys();

    } catch (error) {
        console.error('Save error:', error);
        alert(`Error saving to IndexedDB: ${error.message}`);
    }
};

/**
 * Loads content from IndexedDB (replaces loadFromFirebase)
 */
window.loadFromIndexedDB = async function() {
    const databaseInput = document.getElementById('databaseInput') || 
                         document.getElementById('navDatabaseInput');
    
    if (!databaseInput) {
        console.error('Database input field not found');
        return;
    }

    // Get or set database name
    let databaseName = databaseInput.value.trim();
    if (!databaseName) {
        databaseName = window.indexedDBWrapper.getCurrentDatabaseName();
        databaseInput.value = databaseName;
    }

    const customKey = window.indexedDBWrapper.generateKey();

    try {
        const snapshot = await window.indexedDBWrapper.get(databaseName, customKey);

        if (snapshot.exists()) {
            const loadedData = snapshot.val();

            // Find where to load the content
            const contentTargets = [
                document.getElementById('contentTextArea'),
                document.querySelector('.content-notes')
            ];

            for (const target of contentTargets) {
                if (target) {
                    target.value = loadedData;
                    break;
                }
            }

            // Visual feedback
            const loadButton = document.getElementById('loadButton');
            if (loadButton) {
                const originalText = loadButton.textContent;
                const originalStyle = loadButton.style.cssText;
                
                loadButton.textContent = '✓ Loaded';
                loadButton.style.backgroundColor = '#2196F3';
                loadButton.style.color = 'white';
                
                setTimeout(() => {
                    loadButton.textContent = originalText;
                    loadButton.style.cssText = originalStyle;
                }, 2000);
            }

            console.log(`✓ Loaded from IndexedDB: ${databaseName}/${customKey}`);

        } else {
            console.log(`No saved content found for "${customKey}" in database "${databaseName}"`);
            // Don't show alert for auto-load, only for manual loads
            if (loadButton && loadButton.matches(':hover, :focus')) {
                alert(`No saved content found for "${customKey}" in database "${databaseName}"`);
            }
        }

    } catch (error) {
        console.error('Load error:', error);
        alert(`Error loading from IndexedDB: ${error.message}`);
    }
};

// ============================================================================
// Firebase Compatibility Layer
// ============================================================================

/**
 * Fetches all available keys (Firebase compatibility)
 */
window.fetchAvailableKeys = async function() {
    try {
        await window.indexedDBWrapper.fetchAvailableKeys();
    } catch (error) {
        console.error('Error fetching keys:', error);
    }
};

/**
 * Auto-loads content when sidebar item changes (Firebase compatibility)
 */
window.autoLoadContent = async function(customKey, timeout = 500) {
    const databaseName = window.indexedDBWrapper.getCurrentDatabaseName();
    
    // Use provided key or generate from sidebar
    const key = customKey || window.indexedDBWrapper.generateKey();
    
    // Only auto-load if the key exists
    if (!window.indexedDBWrapper.hasKey(key)) {
        console.log(`Key "${key}" not found in database "${databaseName}"`);
        return;
    }

    // Add timeout before loading (like Firebase version)
    setTimeout(async () => {
        try {
            const snapshot = await window.indexedDBWrapper.get(databaseName, key);
            
            if (snapshot.exists()) {
                const loadedData = snapshot.val();
                
                const textarea = document.querySelector('.content-notes');
                if (textarea) {
                    textarea.value = loadedData;
                    console.log(`✓ Auto-loaded content for: ${key}`);
                }
            }
        } catch (error) {
            console.error('Auto-load error:', error);
        }
    }, timeout);
};

/**
 * Compatibility functions for existing Firebase calls
 */
window.saveToFirebase = window.saveToIndexedDB;
window.loadFromFirebase = window.loadFromIndexedDB;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the wrapper when page loads
 */
window.addEventListener('DOMContentLoaded', () => {
    console.log('🗄️ IndexedDB Wrapper initialized');
    
    // Initialize immediately since we don't need templateConfig
    setTimeout(async () => {
        await window.fetchAvailableKeys();
        console.log('✅ IndexedDB Wrapper ready - all data stored locally!');
    }, 1000);
});

// Handle page visibility changes to refresh connections
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Refresh keys when page becomes visible again
        setTimeout(() => window.fetchAvailableKeys?.(), 1000);
    }
});