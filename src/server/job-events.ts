import { Client } from 'pg';

class JobNotifications {
  private subscribers = new Map<string, Set<() => void>>();
  private client?: Client;
  private retry?: ReturnType<typeof setTimeout>;

  subscribe(id: string, wake: () => void) {
    const group = this.subscribers.get(id) ?? new Set();
    group.add(wake);
    this.subscribers.set(id, group);
    this.connect();
    return () => {
      if (!group.delete(wake)) return;
      if (!group.size) this.subscribers.delete(id);
      if (!this.subscribers.size) {
        clearTimeout(this.retry);
        this.retry = undefined;
        const client = this.client;
        this.client = undefined;
        if (client) void client.end().catch(() => {});
      }
    };
  }

  private connect() {
    if (this.client || this.retry || !this.subscribers.size) return;
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    this.client = client;
    const disconnected = () => {
      if (this.client !== client) return;
      this.client = undefined;
      void client.end().catch(() => {});
      this.retry = setTimeout(() => {
        this.retry = undefined;
        this.connect();
      }, 1000);
    };
    client.on('error', disconnected);
    client.on('end', disconnected);
    client.on('notification', message => {
      for (const wake of this.subscribers.get(message.payload ?? '') ?? []) wake();
    });
    void client
      .connect()
      .then(async () => {
        await client.query('LISTEN ai_job_events');
        // Catch writes committed while the listener was connecting.
        for (const group of this.subscribers.values()) for (const wake of group) wake();
      })
      .catch(disconnected);
  }
}

const shared = globalThis as typeof globalThis & { jobNotifications?: JobNotifications };
export const jobNotifications = (shared.jobNotifications ??= new JobNotifications());
