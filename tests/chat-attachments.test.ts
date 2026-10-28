import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachmentLimit, CHAT_MIME_EXTENSIONS, ownedAttachmentPath, parseChatDataUri } from '../src/lib/chat-attachments';

test('attachment ownership rejects other accounts, external hosts and traversal', () => {
    const file = '/api/uploads/onchat/7/12345678-1234-1234-1234-123456789abc.pdf';
    assert.equal(ownedAttachmentPath(file, 7), file);
    assert.equal(ownedAttachmentPath(file, 8), null);
    assert.equal(ownedAttachmentPath('https://evil.example' + file, 7), null);
    assert.equal(ownedAttachmentPath(file + '?x=1', 7), null);
    assert.equal(ownedAttachmentPath('/api/uploads/onchat/7/../8/file.pdf', 7), null);
});
test('allowlist covers supported conversations without executable documents', () => {
    for (const mime of ['image/jpeg', 'audio/mp4', 'video/mp4', 'application/pdf']) assert.ok(CHAT_MIME_EXTENSIONS[mime]);
    for (const mime of ['text/html', 'image/svg+xml', 'application/javascript']) assert.equal(CHAT_MIME_EXTENSIONS[mime], undefined);
    assert.equal(attachmentLimit('video/mp4'), 200 * 1024 * 1024);
    assert.equal(attachmentLimit('image/png'), 25 * 1024 * 1024);
});
test('legacy data URI accepts supported audio and rejects malformed or executable data', () => {
    assert.equal(parseChatDataUri('data:audio/mp4;base64,YWJj').extension, '.m4a');
    assert.throws(() => parseChatDataUri('data:text/html;base64,YWJj'));
    assert.throws(() => parseChatDataUri('data:image/png;base64,'));
    assert.throws(() => parseChatDataUri('data:image/png;base64,!!!'));
});
