import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from './config.js';
import { createImageSpamDetector } from './imageSpam.js';
import { log } from './logger.js';
import { handleScam, isExempt, verifySetup, verifyTrapChannel } from './moderation.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  allowedMentions: { parse: [] },
});

const imageSpam = createImageSpamDetector(config.imageSpam);

const detect = (message) =>
  message.channelId === config.trapChannelId ? 'posted in the trap channel' : imageSpam.check(message);

const inspect = async (message) => {
  if (!message.inGuild() || message.author.bot || message.system || message.webhookId) return;

  const reason = detect(message);
  if (!reason) return;

  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (isExempt(member)) return;

  await handleScam(message, reason);
};

client.once(Events.ClientReady, async (ready) => {
  log.info(`Logged in as ${ready.user.tag}, watching ${ready.guilds.cache.size} server(s)`);
  for (const guild of ready.guilds.cache.values()) await verifySetup(guild).catch((error) => log.error('Setup check failed', error));
  await verifyTrapChannel(ready).catch((error) => log.error('Trap channel check failed', error));
});

client.on(Events.GuildCreate, (guild) => verifySetup(guild).catch((error) => log.error('Setup check failed', error)));
client.on(Events.MessageCreate, (message) =>
  inspect(message).catch((error) => log.error('Unhandled error while inspecting message', error)),
);
client.on(Events.Error, (error) => log.error('Client error', error));

const shutdown = async (signal) => {
  log.info(`Received ${signal}, shutting down`);
  await client.destroy();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (error) => log.error('Unhandled rejection', error));

await client.login(config.token);
