export function createDebouncer(delay: number) {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    function cancel(key: string) {
        const timer = timers.get(key);
        if (timer !== undefined) {
            clearTimeout(timer);
            timers.delete(key);
        }
    }
    return {
        schedule(key: string, callback: () => void) {
            cancel(key);
            timers.set(key, setTimeout(() => {
                timers.delete(key);
                callback();
            }, delay));
        },
        cancel,
        dispose() {
            for (const timer of timers.values()) { clearTimeout(timer); }
            timers.clear();
        },
    };
}
