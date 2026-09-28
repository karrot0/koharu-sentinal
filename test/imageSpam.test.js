import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createImageSpamDetector } from '../src/imageSpam.js';

const settings = { minImages: 2, minChannels: 2, windowMs: 10 * 60 * 1000 };

const image = (size, width = 1080, height = 1350) => ({ size, width, height });

const post = ({ user = 'u1', channel, images, at = Date.now() }) => ({
  guildId: 'g1',
  author: { id: user },
  channelId: channel,
  createdTimestamp: at,
  attachments: new Map(images.map((attachment, index) => [String(index), attachment])),
});

const scamSet = [image(201_311), image(188_420), image(240_002), image(199_871)];

test('flags the same four images posted in a second channel', () => {
  const detector = createImageSpamDetector(settings);
  assert.equal(detector.check(post({ channel: 'c1', images: scamSet })), null);
  assert.deepEqual(detector.check(post({ channel: 'c2', images: scamSet })), {
    images: 4,
    channelIds: ['c2', 'c1'],
  });
});

test('flags shuffled images across channels', () => {
  const detector = createImageSpamDetector(settings);
  detector.check(post({ channel: 'c1', images: scamSet }));
  assert.ok(detector.check(post({ channel: 'c2', images: [...scamSet].reverse() })));
});

test('ignores the same images reposted in the same channel', () => {
  const detector = createImageSpamDetector(settings);
  detector.check(post({ channel: 'c1', images: scamSet }));
  assert.equal(detector.check(post({ channel: 'c1', images: scamSet })), null);
});

test('ignores a single image posted in several channels', () => {
  const detector = createImageSpamDetector(settings);
  detector.check(post({ channel: 'c1', images: [scamSet[0]] }));
  assert.equal(detector.check(post({ channel: 'c2', images: [scamSet[0]] })), null);
});

test('ignores different images in different channels', () => {
  const detector = createImageSpamDetector(settings);
  detector.check(post({ channel: 'c1', images: scamSet }));
  assert.equal(detector.check(post({ channel: 'c2', images: [image(1), image(2), image(3)] })), null);
});

test('ignores the same images from different users', () => {
  const detector = createImageSpamDetector(settings);
  detector.check(post({ user: 'u1', channel: 'c1', images: scamSet }));
  assert.equal(detector.check(post({ user: 'u2', channel: 'c2', images: scamSet })), null);
});

test('ignores reposts outside the time window', () => {
  const detector = createImageSpamDetector(settings);
  const start = Date.now();
  detector.check(post({ channel: 'c1', images: scamSet, at: start }));
  assert.equal(detector.check(post({ channel: 'c2', images: scamSet, at: start + settings.windowMs + 1 })), null);
});

test('ignores non-image attachments', () => {
  const detector = createImageSpamDetector(settings);
  const files = [{ size: 10 }, { size: 20 }, { size: 30 }];
  detector.check(post({ channel: 'c1', images: files }));
  assert.equal(detector.check(post({ channel: 'c2', images: files })), null);
});
