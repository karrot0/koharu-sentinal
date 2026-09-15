const token = process.env.DISCORD_TOKEN?.trim();

if (!token) {
  console.error('DISCORD_TOKEN is not set. Copy .env.example to .env and add your bot token.');
  process.exit(1);
}

export const config = Object.freeze({
  token,
  bannedRoleId: process.env.BANNED_ROLE_ID?.trim(),
  trapChannelId: process.env.TRAP_CHANNEL_ID?.trim(),
  purgeWindowMs: 60 * 60 * 1000,
  actionCooldownMs: 60 * 1000,
  imageSpam: Object.freeze({
    minImages: 2,
    minChannels: 2,
    windowMs: 10 * 60 * 1000,
  }),
});
