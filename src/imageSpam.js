const MAX_POSTS_PER_USER = 25;

const mediaFingerprints = (message) => {
  const attachments = [...(message.attachments?.values() ?? [])];
  for (const snapshot of message.messageSnapshots?.values() ?? []) {
    attachments.push(...(snapshot.attachments?.values() ?? []));
  }

  return new Set(
    attachments
      .filter((attachment) => attachment.width && attachment.height)
      .map((attachment) => `${attachment.size}:${attachment.width}x${attachment.height}`),
  );
};

const countShared = (a, b) => {
  let shared = 0;
  for (const fingerprint of a) if (b.has(fingerprint)) shared++;
  return shared;
};

export const createImageSpamDetector = ({ minImages, minChannels, windowMs }) => {
  const posts = new Map();

  const sweep = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, history] of posts) {
      const fresh = history.filter((post) => post.timestamp >= cutoff);
      if (fresh.length) posts.set(key, fresh);
      else posts.delete(key);
    }
  }, windowMs);
  sweep.unref?.();

  const check = (message) => {
    const fingerprints = mediaFingerprints(message);
    if (fingerprints.size < minImages) return null;

    const key = `${message.guildId}:${message.author.id}`;
    const now = message.createdTimestamp;
    const history = (posts.get(key) ?? []).filter((post) => now - post.timestamp < windowMs);
    const channels = new Set([message.channelId]);

    for (const post of history) {
      if (post.channelId !== message.channelId && countShared(fingerprints, post.fingerprints) >= minImages) {
        channels.add(post.channelId);
      }
    }

    history.push({ id: message.id, channelId: message.channelId, timestamp: now, fingerprints });
    posts.set(key, history.slice(-MAX_POSTS_PER_USER));

    return channels.size >= minChannels ? { images: fingerprints.size, channelIds: [...channels] } : null;
  };

  const forget = (messageId) => {
    for (const [key, history] of posts) {
      const kept = history.filter((post) => post.id !== messageId);
      if (kept.length === history.length) continue;
      if (kept.length) posts.set(key, kept);
      else posts.delete(key);
      return;
    }
  };

  return { check, forget };
};
