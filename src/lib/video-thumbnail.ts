import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

/** Only local uploaded files reach ffmpeg; remote protocols are explicitly disabled. */
export async function generateVideoThumbnail(input: string, output: string): Promise<boolean> {
    try {
        await promisify(execFile)(process.env.FFMPEG_PATH || 'ffmpeg', [
            '-nostdin', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', input,
            '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '3', '-y', output,
        ], { timeout: 20000, maxBuffer: 65536 });
        return (await fs.stat(output)).size > 0;
    } catch {
        await fs.rm(output, { force: true }).catch(() => {});
        console.warn('[Video thumbnail] Extraction indisponible ; vérifier ffmpeg et le format vidéo.');
        return false;
    }
}
