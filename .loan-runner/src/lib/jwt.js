"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.generateZoomJwt = generateZoomJwt;
require("dotenv/config");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const secret = process.env.JWT_SECRET;
const devPortalSecret = process.env.DEV_PORTAL_JWT_SECRET;
const fxPortalSecret = process.env.FX_PORTAL_JWT_SECRET;
function generateToken(user, portal = 'main') {
    let tokenSecret;
    let payload;
    switch (portal) {
        case 'dev':
            tokenSecret = devPortalSecret;
            payload = { id: user.id, role: user.role };
            break;
        case 'fx':
            tokenSecret = fxPortalSecret;
            payload = { id: user.id, username: user.username, role: 'FxManager' };
            break;
        default: // main
            tokenSecret = secret;
            payload = { id: user.id, id_wallet: user.id_wallet, role: user.role };
    }
    if (!tokenSecret) {
        throw new Error(`FATAL ERROR: JWT_SECRET for ${portal} is not defined in environment variables.`);
    }
    return jsonwebtoken_1.default.sign(payload, tokenSecret, {
        expiresIn: '7d',
    });
}
function verifyToken(token, portal = 'main') {
    let tokenSecret;
    switch (portal) {
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
        const decoded = jsonwebtoken_1.default.verify(token, tokenSecret);
        if (typeof decoded === 'object' && 'id' in decoded) {
            return decoded;
        }
        return null;
    }
    catch (error) {
        console.error(`Invalid token for ${portal} portal:`, error);
        return null;
    }
}
function generateZoomJwt(sdkKey, sdkSecret) {
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
    const signature = crypto_1.default.createHmac('sha256', sdkSecret).update(`${sHeader}.${sPayload}`).digest('base64url');
    return `${sHeader}.${sPayload}.${signature}`;
}
