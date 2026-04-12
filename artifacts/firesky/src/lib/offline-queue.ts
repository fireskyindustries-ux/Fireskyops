const QUEUE_KEY = "firesky_offline_inspection_queue";

export interface QueuedInspection {
  id: string;
  queuedAt: string;
  payload: Record<string, unknown>;
}

export function getQueue(): QueuedInspection[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function enqueue(payload: Record<string, unknown>): string {
  const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const item: QueuedInspection = { id, queuedAt: new Date().toISOString(), payload };
  const queue = getQueue();
  queue.push(item);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return id;
}

export function dequeue(id: string) {
  const queue = getQueue().filter((i) => i.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}
