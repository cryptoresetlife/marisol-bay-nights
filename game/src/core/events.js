// A tiny publish/subscribe bus so systems can react to kills, crimes and mission beats without importing each other.
export function createEvents() {
  const handlers = new Map();
  return {
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(fn);
      return () => handlers.set(name, handlers.get(name).filter((h) => h !== fn));
    },
    emit(name, data) {
      for (const fn of handlers.get(name) || []) fn(data);
    },
  };
}
