import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';
import { log } from './logger.js';
import { readState, writeState } from './state.js';

const NOTICE_KEY = 'trapNoticeMessageId';
const NOTICE_PERMISSIONS = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];

const buildEmbed = () => {
  const appeal = config.appealChannelId
    ? ` If you are banned by mistake, you can appeal in <#${config.appealChannelId}>.`
    : '';

  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('⚠️ Do not post in this channel')
    .setDescription(
      [
        'This channel exists to catch scam bots and compromised accounts.',
        '',
        `**If you send anything here you will be banned automatically.**${appeal}`,
      ].join('\n'),
    );
};

export const ensureTrapNotice = async (client) => {
  const channel = await client.channels.fetch(config.trapChannelId).catch(() => null);
  if (!channel?.isTextBased()) {
    log.warn(`Cannot post the trap channel notice, channel ${config.trapChannelId} was not found`);
    return null;
  }

  const me = channel.guild.members.me ?? (await channel.guild.members.fetchMe());
  if (!channel.permissionsFor(me)?.has(NOTICE_PERMISSIONS)) {
    log.warn(`Cannot post the trap channel notice in #${channel.name}, missing View Channel or Send Messages`);
    return null;
  }

  const state = await readState();
  const embed = buildEmbed();
  const savedId = state[NOTICE_KEY];

  if (savedId) {
    const existing = await channel.messages.fetch(savedId).catch(() => null);
    if (existing?.editable) {
      await existing.edit({ embeds: [embed] });
      log.info(`Trap channel notice is up to date (message ${existing.id})`);
      return existing.id;
    }
    log.warn(`Saved trap channel notice ${savedId} is gone, posting a new one`);
  }

  const sent = await channel.send({ embeds: [embed] });
  await writeState({ ...state, [NOTICE_KEY]: sent.id });
  log.info(`Posted the trap channel notice (message ${sent.id}), saved in ${config.stateFile}`);
  return sent.id;
};
