// Tab Sync Manager - Real-time synchronization across browser tabs
// Uses BroadcastChannel API with localStorage fallback for older browsers

const TabSync = {
    channel: null,
    jobId: null,
    handlers: {},
    isInitialized: false,

    // Message types
    MESSAGES: {
        ITEMS_UPDATED: 'ITEMS_UPDATED',
        FILES_UPDATED: 'FILES_UPDATED',
        PACKAGES_UPDATED: 'PACKAGES_UPDATED',
        JOB_SAVED: 'JOB_SAVED'
    },

    // Initialize sync for a specific job
    init(jobId) {
        if (this.isInitialized && this.jobId === jobId) {
            return; // Already initialized for this job
        }

        this.jobId = jobId;
        this.isInitialized = true;

        // Try BroadcastChannel first (modern browsers)
        if (typeof BroadcastChannel !== 'undefined') {
            this.channel = new BroadcastChannel(`estimator-job-${jobId}`);
            this.channel.onmessage = (event) => this.handleMessage(event.data);
            console.log('[TabSync] Initialized with BroadcastChannel for job:', jobId);
        } else {
            // Fallback to localStorage events for older browsers
            window.addEventListener('storage', (event) => {
                if (event.key === `estimator-sync-${jobId}` && event.newValue) {
                    try {
                        const data = JSON.parse(event.newValue);
                        this.handleMessage(data);
                    } catch (e) {
                        console.error('[TabSync] Error parsing storage event:', e);
                    }
                }
            });
            console.log('[TabSync] Initialized with localStorage fallback for job:', jobId);
        }
    },

    // Broadcast a message to other tabs
    broadcast(type, payload) {
        if (!this.jobId) {
            console.warn('[TabSync] Not initialized, skipping broadcast');
            return;
        }

        const message = {
            type,
            payload,
            timestamp: Date.now(),
            tabId: this.getTabId()
        };

        if (this.channel) {
            // BroadcastChannel - only sends to other tabs, not this one
            this.channel.postMessage(message);
        } else {
            // localStorage fallback - will trigger storage event in other tabs
            localStorage.setItem(`estimator-sync-${this.jobId}`, JSON.stringify(message));
            // Clear it immediately to allow future updates with same data
            setTimeout(() => localStorage.removeItem(`estimator-sync-${this.jobId}`), 100);
        }

        console.log('[TabSync] Broadcasted:', type);
    },

    // Handle incoming messages from other tabs
    handleMessage(message) {
        // Ignore messages from this tab
        if (message.tabId === this.getTabId()) {
            return;
        }

        console.log('[TabSync] Received:', message.type, 'from tab:', message.tabId);

        // Call registered handlers
        const handler = this.handlers[message.type];
        if (handler) {
            handler(message.payload);
        }
    },

    // Register a handler for a message type
    on(type, callback) {
        this.handlers[type] = callback;
    },

    // Remove a handler
    off(type) {
        delete this.handlers[type];
    },

    // Get unique tab identifier
    getTabId() {
        if (!this._tabId) {
            this._tabId = Math.random().toString(36).substring(2, 10);
        }
        return this._tabId;
    },

    // Clean up on page unload
    destroy() {
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
        this.handlers = {};
        this.isInitialized = false;
        this.jobId = null;
    },

    // Merge files from another tab (additive merge, respects deletions)
    mergeFiles(currentFiles, incomingFiles, incomingDeletedIds) {
        const fileMap = new Map();
        const deletedIds = incomingDeletedIds || [];

        // Add current files
        (currentFiles || []).forEach(file => {
            const key = `${file.name}::${file.url}`;
            if (!deletedIds.includes(key)) {
                fileMap.set(key, file);
            }
        });

        // Add incoming files (won't duplicate due to Map)
        (incomingFiles || []).forEach(file => {
            const key = `${file.name}::${file.url}`;
            if (!fileMap.has(key) && !deletedIds.includes(key)) {
                fileMap.set(key, file);
            }
        });

        return Array.from(fileMap.values());
    },

    // Merge items (smart merge - update existing, add new)
    mergeItems(currentItems, incomingItems) {
        // For items, we use a simpler approach: incoming replaces current
        // because items have complex relationships and editing conflicts
        // The last editor wins, but this keeps the UI responsive
        return incomingItems || currentItems || [];
    }
};

// Auto-cleanup on page unload
window.addEventListener('beforeunload', () => {
    TabSync.destroy();
});
