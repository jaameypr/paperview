type Listener = (event: string, data: unknown) => void;

interface Channel {
  listeners: Set<Listener>;
}

const channels = new Map<string, Channel>();

function getOrCreateChannel(channelId: string): Channel {
  let channel = channels.get(channelId);
  if (!channel) {
    channel = { listeners: new Set() };
    channels.set(channelId, channel);
  }
  return channel;
}

/** Subscribe to a channel. Returns an unsubscribe function. */
export function subscribe(channelId: string, listener: Listener): () => void {
  const channel = getOrCreateChannel(channelId);
  channel.listeners.add(listener);

  return () => {
    channel.listeners.delete(listener);
    if (channel.listeners.size === 0) {
      channels.delete(channelId);
    }
  };
}

/** Emit an event to all listeners on a channel */
export function emit(channelId: string, event: string, data: unknown): void {
  const channel = channels.get(channelId);
  if (!channel) return;
  for (const listener of channel.listeners) {
    try {
      listener(event, data);
    } catch {
      // Ignore listener errors
    }
  }
}

/** Build a channel ID for a share version */
export function shareVersionChannel(shareId: string, versionId: string): string {
  return `share:${shareId}:version:${versionId}`;
}

/** Build a channel ID for a share (all versions) */
export function shareChannel(shareId: string): string {
  return `share:${shareId}`;
}
