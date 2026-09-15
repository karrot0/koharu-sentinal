import { PermissionFlagsBits, SnowflakeUtil } from 'discord.js';
import { config } from './config.js';
import { log } from './logger.js';

const REQUIRED_CHANNEL_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ManageMessages,
];

const CHANNEL_CONCURRENCY = 5;
const MAX_PAGES_PER_CHANNEL = 10;

const recentlyActioned = new Set();

const mapLimit = async (items, limit, task) => {
  const queue = [...items];
  const worker = async () => {
    while (queue.length) await task(queue.shift());
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
};

export const isExempt = (member) =>
  Boolean(member?.permissions.has(PermissionFlagsBits.ManageMessages));

const assignBannedRole = async (guild, userId) => {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return false;
  if (member.roles.cache.has(config.bannedRoleId)) return true;

  await member.roles.add(config.bannedRoleId, 'MrBeast scam detected');
  return true;
};

const purgeChannel = async (channel, userId, since) => {
  if (channel.lastMessageId && SnowflakeUtil.timestampFrom(channel.lastMessageId) < since) return 0;

  let before;
  let removed = 0;

  for (let page = 0; page < MAX_PAGES_PER_CHANNEL; page++) {
    const batch = await channel.messages.fetch({ limit: 100, before, cache: false });
    if (batch.size === 0) break;

    const targets = batch.filter((m) => m.author.id === userId && m.createdTimestamp >= since);

    if (targets.size === 1) await targets.first().delete();
    else if (targets.size > 1) await channel.bulkDelete(targets, true);
    removed += targets.size;

    const oldest = batch.reduce((a, b) => (b.createdTimestamp < a.createdTimestamp ? b : a));
    if (batch.size < 100 || oldest.createdTimestamp < since) break;
    before = oldest.id;
  }

  return removed;
};

const purgeRecentMessages = async (guild, userId, since) => {
  const me = guild.members.me ?? (await guild.members.fetchMe());
  const { threads } = await guild.channels.fetchActiveThreads().catch(() => ({ threads: new Map() }));
  const channels = new Map([...guild.channels.cache, ...threads]);

  const targets = [...channels.values()].filter(
    (channel) => channel.isTextBased() && channel.permissionsFor(me)?.has(REQUIRED_CHANNEL_PERMISSIONS),
  );

  let removed = 0;
  await mapLimit(targets, CHANNEL_CONCURRENCY, async (channel) => {
    try {
      removed += await purgeChannel(channel, userId, since);
    } catch (error) {
      log.warn(`Could not purge #${channel.name} (${channel.id}): ${error.message}`);
    }
  });

  return removed;
};

export const handleScam = async (message, reason) => {
  const { guild, author } = message;
  const key = `${guild.id}:${author.id}`;

  await message.delete().catch(() => null);

  if (recentlyActioned.has(key)) return;
  recentlyActioned.add(key);
  setTimeout(() => recentlyActioned.delete(key), config.actionCooldownMs).unref();

  log.info(`Actioning ${author.tag} (${author.id}) in ${guild.name}: ${reason}`);

  try {
    const assigned = await assignBannedRole(guild, author.id);
    if (assigned) log.info(`Assigned banned role to ${author.tag}`);
    else log.warn(`${author.tag} is no longer in ${guild.name}, skipped role assignment`);
  } catch (error) {
    log.error(`Failed to assign banned role to ${author.tag}`, error);
  }

  try {
    const removed = await purgeRecentMessages(guild, author.id, Date.now() - config.purgeWindowMs);
    log.info(`Deleted ${removed} message(s) from ${author.tag} sent in the last hour`);
  } catch (error) {
    log.error(`Failed to purge messages from ${author.tag}`, error);
  }
};

export const verifySetup = async (guild) => {
  const role = guild.roles.cache.get(config.bannedRoleId);
  if (!role) {
    log.warn(`Banned role ${config.bannedRoleId} does not exist in ${guild.name}`);
    return;
  }

  const me = guild.members.me ?? (await guild.members.fetchMe());
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    log.warn(`Missing Manage Roles permission in ${guild.name}`);
  } else if (role.position >= me.roles.highest.position) {
    log.warn(`Role "${role.name}" is above the bot's highest role in ${guild.name}, move the bot role higher`);
  }

  if (!me.permissions.has(PermissionFlagsBits.ManageMessages)) {
    log.warn(`Missing Manage Messages permission in ${guild.name}`);
  }
};

export const verifyTrapChannel = async (client) => {
  const channel = await client.channels.fetch(config.trapChannelId).catch(() => null);
  if (!channel?.guild) {
    log.warn(`Trap channel ${config.trapChannelId} was not found or the bot cannot see it`);
    return;
  }

  const me = channel.guild.members.me ?? (await channel.guild.members.fetchMe());
  if (!channel.permissionsFor(me)?.has(REQUIRED_CHANNEL_PERMISSIONS)) {
    log.warn(`Missing View Channel, Read Message History or Manage Messages in trap channel #${channel.name}`);
    return;
  }

  log.info(`Trap channel active: #${channel.name} in ${channel.guild.name}`);
};
