type Listener = () => void;
const listeners = new Set<Listener>();

export function emitCollectionsChanged() {
  for (const fn of listeners) {
    fn();
  }
}

export function onCollectionsChanged(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
