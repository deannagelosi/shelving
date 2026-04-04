/**
 * EventEmitter enables publish-subscribe communication between modules.
 * emit events to signal changes, and listen for events to react to them.
 */

class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(eventName, listener) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(listener);
    }

    emit(eventName, data) {
        if (this.events[eventName]) {
            for (const listener of this.events[eventName]) {
                listener(data);
            }
        }
    }
}

// only export the class when in a Node.js environment (e.g., during Jest tests)
// ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventEmitter;
} 