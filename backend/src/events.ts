import type { Response } from "express";

interface SseClient {
  id: string;
  res: Response;
}

class EventStreamManager {
  private clients: SseClient[] = [];

  /**
   * Registers a client connection for Server-Sent Events.
   */
  registerClient(id: string, res: Response): void {
    this.clients.push({ id, res });
  }

  /**
   * Unregisters a client on disconnect.
   */
  unregisterClient(id: string): void {
    this.clients = this.clients.filter((client) => client.id !== id);
  }

  /**
   * Broadcasts a JSON event payload to all active SSE subscribers.
   */
  broadcast(eventType: string, data: Record<string, any>): void {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    this.clients.forEach((client) => {
      try {
        client.res.write(payload);
      } catch (err) {
        console.error(`Failed to send event to client ${client.id}:`, err);
      }
    });
  }
}

export const eventStream = new EventStreamManager();
