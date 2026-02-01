/**
 * Offline Queue Manager
 * Stores pending events when offline and syncs when back online
 */

interface QueuedEvent {
  id: string;
  type: 'voice' | 'vision';
  data: {
    audioUrl?: string;
    imageUrl?: string;
    userId: string;
    userName: string;
    locationGLN: string | null;
  };
  timestamp: number;
  retryCount: number;
}

const QUEUE_KEY = 'zalo_offline_queue';
const MAX_RETRIES = 3;

export class OfflineQueue {
  private static instance: OfflineQueue;
  private queue: QueuedEvent[] = [];
  private isSyncing = false;

  private constructor() {
    this.loadQueue();
  }

  static getInstance(): OfflineQueue {
    if (!OfflineQueue.instance) {
      OfflineQueue.instance = new OfflineQueue();
    }
    return OfflineQueue.instance;
  }

  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[v0] Failed to load offline queue:', error);
      this.queue = [];
    }
  }

  private saveQueue(): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[v0] Failed to save offline queue:', error);
    }
  }

  addToQueue(type: 'voice' | 'vision', data: QueuedEvent['data']): string {
    const event: QueuedEvent = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(event);
    this.saveQueue();
    
    console.log('[v0] Event added to offline queue:', event.id);
    return event.id;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  async syncQueue(accessToken: string, supabaseUrl: string): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    if (this.isSyncing || this.queue.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    this.isSyncing = true;
    const results = { success: 0, failed: 0, errors: [] as string[] };

    const itemsToProcess = [...this.queue];
    
    for (const event of itemsToProcess) {
      try {
        const endpoint = event.type === 'voice' 
          ? `${supabaseUrl}/functions/v1/process-voice-input`
          : `${supabaseUrl}/functions/v1/process-vision-input`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(event.data),
        });

        const result = await response.json();

        if (result.success) {
          // Remove from queue on success
          this.queue = this.queue.filter(e => e.id !== event.id);
          results.success++;
          console.log('[v0] Synced event:', event.id);
        } else {
          // Increment retry count
          event.retryCount++;
          if (event.retryCount >= MAX_RETRIES) {
            // Remove after max retries
            this.queue = this.queue.filter(e => e.id !== event.id);
            results.failed++;
            results.errors.push(`Event ${event.id} failed after ${MAX_RETRIES} retries`);
          }
        }
      } catch (error) {
        console.error('[v0] Failed to sync event:', event.id, error);
        event.retryCount++;
        if (event.retryCount >= MAX_RETRIES) {
          this.queue = this.queue.filter(e => e.id !== event.id);
          results.failed++;
          results.errors.push(`Event ${event.id}: ${error.message}`);
        }
      }
    }

    this.saveQueue();
    this.isSyncing = false;

    return results;
  }

  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
  }
}
