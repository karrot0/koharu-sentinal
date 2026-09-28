const MAX_QUOTE = 140;

const quote = (content) => {
  const text = (content ?? '').replace(/[`\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > MAX_QUOTE ? `${text.slice(0, MAX_QUOTE - 1)}…` : text;
};

const attachmentSummary = (message) => {
  const count = message.attachments?.size ?? 0;
  if (count === 0) return 'a message';
  return count === 1 ? 'an attachment' : `${count} attachments`;
};

export const trapReason = (message) => {
  const text = quote(message.content);
  const what = text ? `typed \`${text}\`` : `posted ${attachmentSummary(message)}`;

  return {
    log: text ? `typed "${text}" in the trap channel` : `posted ${attachmentSummary(message)} in the trap channel`,
    notice: `You ${what} in <#${message.channelId}>, a channel nobody is allowed to post in.`,
  };
};

export const imageSpamReason = (match) => {
  const channels = match.channelIds.map((id) => `<#${id}>`).join(', ');

  return {
    log: `posted the same ${match.images} images in ${match.channelIds.length} channels`,
    notice: `You posted the same ${match.images} images in ${match.channelIds.length} channels (${channels}) within a few minutes, which is how scam spam is sent.`,
  };
};
