import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
export class VideoPolicyError extends Error {}
/** Read the container's actual duration; client duration metadata is never authoritative. */
export async function verifiedVideoDuration(buffer: Buffer): Promise<number> {
    let duration: number | null = null;
    let hasVideo = false;
    function boxes(start: number, end: number, depth = 0): void {
        if (depth > 8) return;
        for (let offset = start; offset + 8 <= end;) {
            let size = buffer.readUInt32BE(offset), header = 8;
            if (size === 1) { if (offset + 16 > end) return; size = Number(buffer.readBigUInt64BE(offset + 8)); header = 16; }
            if (size === 0) size = end - offset;
            if (!Number.isSafeInteger(size) || size < header || offset + size > end) return;
            const type = buffer.toString('ascii', offset + 4, offset + 8), data = offset + header;
            if (['moov', 'trak', 'mdia'].includes(type)) boxes(data, offset + size, depth + 1);
            if (type === 'hdlr' && data + 12 <= offset + size && buffer.toString('ascii', data + 8, data + 12) === 'vide') hasVideo = true;
            if (type === 'mvhd') {
                const version = buffer[data];
                if (version === 0 && data + 20 <= offset + size) duration = buffer.readUInt32BE(data + 16) / buffer.readUInt32BE(data + 12);
                if (version === 1 && data + 32 <= offset + size) duration = Number(buffer.readBigUInt64BE(data + 24)) / buffer.readUInt32BE(data + 20);
            }
            offset += size;
        }
        return;
    }
    boxes(0, buffer.length);
    if (duration && Number.isFinite(duration) && !hasVideo) throw new VideoPolicyError("Le fichier ne contient aucune piste vidéo.");
    if (!duration || !Number.isFinite(duration)) {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onchat-duration-'));
        try {
            const file = path.join(directory, 'video'); await fs.writeFile(file, buffer);
            const { stdout } = await promisify(execFile)(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', file], { timeout: 15000, maxBuffer: 65536 });
            const metadata = JSON.parse(stdout);
            if (!metadata.streams?.some((stream: { codec_type: string }) => stream.codec_type === 'video')) throw new Error('Missing video stream');
            duration = Number(metadata.format?.duration);
        } catch { throw new VideoPolicyError('Durée illisible. Exportez en MP4 ou activez ffprobe sur le serveur pour ce format.'); }
        finally { await fs.rm(directory, { recursive: true, force: true }); }
    }
    if (!duration || !Number.isFinite(duration) || duration <= 0 || duration > 600) throw new VideoPolicyError('La vidéo doit durer entre 0 et 10 minutes maximum.');
    return duration;
}
