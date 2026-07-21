
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import type { User, FxPortalUser } from './types';
import crypto from 'crypto';

const secret = process.env.JWT_SECRET;
const devPortalSecret = process.env.DEV_PORTAL_JWT_SECRET;
const fxPortalSecret = process.env.FX_PORTAL_JWT_SECRET;

// A simplified user payload to keep the token size small
interface JwtPayload {
    id: number;
    id_wallet?: string;
    username?: string; // For dev/fx portals
    role: string;
}

export function generateToken(user: Pick<User, 'id' | 'id_wallet' | 'role'> | FxPortalUser, portal: 'main' | 'dev' | 'fx' = 'main'): string {
    let tokenSecret: string | undefined;
    let payload: JwtPayload;

    switch(portal) {
        case 'dev':
            tokenSecret = devPortalSecret;
            payload = { id: (user as User).id, role: (user as User).role };
            break;
        case 'fx':
             tokenSecret = fxPortalSecret;
             payload = { id: (user as FxPortalUser).id, username: (user as FxPortalUser).username, role: 'FxManager' };
             break;
        default: // main
            tokenSecret = secret;
            payload = { id: (user as User).id, id_wallet: (user as User).id_wallet, role: (user as User).role };
    }
    
    if (!tokenSecret) {
        throw new Error(`FATAL ERROR: JWT_SECRET for ${portal} is not defined in environment variables.`);
    }

    return jwt.sign(payload, tokenSecret, {
        expiresIn: '7d',
    });
}

export function verifyToken(token: string, portal: 'main' | 'dev' | 'fx' = 'main'): JwtPayload | null {
    let tokenSecret: string | undefined;
    switch(portal) {
        case 'dev':
            tokenSecret = devPortalSecret;
            break;
        case 'fx':
             tokenSecret = fxPortalSecret;
             break;
        default:
            tokenSecret = secret;
    }
    
    if (!tokenSecret) {
        // Don't throw an error here, just log and return null as it's a verification step
        console.error(`FATAL ERROR: JWT_SECRET for ${portal} is not defined.`);
        return null;
    }
    
    try {
        const decoded = jwt.verify(token, tokenSecret);
        if (typeof decoded === 'object' && 'id' in decoded) {
            return decoded as JwtPayload;
        }
        return null;
    } catch (error) {
        console.error(`Invalid token for ${portal} portal:`, error);
        return null;
    }
}

export function generateZoomJwt(sdkKey: string, sdkSecret: string): string {
    const iat = Math.floor(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60 * 2; // 2 hours

    const oHeader = { alg: 'HS256', typ: 'JWT' };
    const oPayload = {
        sdkKey: sdkKey,
        iat: iat,
        exp: exp,
        tokenExp: exp,
    };
    
    const sHeader = Buffer.from(JSON.stringify(oHeader)).toString('base64');
    const sPayload = Buffer.from(JSON.stringify(oPayload)).toString('base64');
    const signature = crypto.createHmac('sha256', sdkSecret).update(`${sHeader}.${sPayload}`).digest('base64url');

    return `${sHeader}.${sPayload}.${signature}`;
}
