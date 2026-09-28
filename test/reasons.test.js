import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageSpamReason, trapReason } from '../src/reasons.js';

const message = (content, attachments = 0) => ({
  content,
  channelId: '1547667184140943390',
  attachments: new Map(Array.from({ length: attachments }, (_, i) => [String(i), {}])),
});

test('quotes what the user typed in the trap channel', () => {
  const { notice } = trapReason(message('free nitro here'));
  assert.equal(
    notice,
    'You typed `free nitro here` in <#1547667184140943390>, a channel nobody is allowed to post in.',
  );
});

test('describes attachments when there is no text', () => {
  assert.match(trapReason(message('', 4)).notice, /posted 4 attachments in <#1547667184140943390>/);
  assert.match(trapReason(message('   ', 1)).notice, /posted an attachment/);
  assert.match(trapReason(message('')).notice, /posted a message/);
});

test('shortens very long messages', () => {
  const { notice } = trapReason(message('x'.repeat(500)));
  assert.ok(notice.includes('…'));
  assert.ok(notice.length < 300);
});

test('flattens newlines and strips backticks so the quote cannot break formatting', () => {
  const { notice } = trapReason(message('one\ntwo```three'));
  assert.equal(notice.includes('\n'), false);
  assert.equal(notice.split('`').length - 1, 2);
});

test('lists the channels the images were posted in', () => {
  const { notice, log } = imageSpamReason({ images: 4, channelIds: ['111', '222'] });
  assert.match(notice, /the same 4 images in 2 channels \(<#111>, <#222>\)/);
  assert.equal(log, 'posted the same 4 images in 2 channels');
});
