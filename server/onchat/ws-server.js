require("dotenv/config");
const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.ONCHAT_WS_PORT || 3101);
const HOST = process.env.ONCHAT_WS_HOST || '127.0.0.1';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET est obligatoire pour OnChat WebSocket.');
}

const sslConfig = process.env.DB_SSL_CA
    ? {
        ssl: {
            ca: process.env.DB_SSL_CA,
            rejectUnauthorized: true,
        },
    }
    : {};

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
        ? Number(process.env.DB_PORT)
        : 5432,
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ...sslConfig,
});

const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, {
            'Content-Type': 'application/json',
        });

        res.end(JSON.stringify({
            success: true,
            service: 'onchat-websocket',
            status: 'online',
        }));

        return;
    }

    res.writeHead(404);
    res.end();
});

const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 256 * 1024,
});

const users = new Map();

function parseCookies(header) {
    const cookies = {};

    if (!header) {
        return cookies;
    }

    for (const part of header.split(';')) {
        const index = part.indexOf('=');

        if (index === -1) {
            continue;
        }

        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();

        try { cookies[key] = decodeURIComponent(value); } catch { /* Invalid cookie is ignored. */ }
    }

    return cookies;
}

const usedConnectTickets = new Map();
function authenticate(request) {
    const cookies = parseCookies(
        request.headers.cookie
    );

    const authorization = request.headers.authorization;
    const connectTicket = new URL(request.url, 'http://localhost').searchParams.get('ticket');
    const token = connectTicket || (authorization && authorization.startsWith('Bearer ')
        ? authorization.slice(7).trim()
        : cookies['cashpay-token']);

    if (!token) {
        return null;
    }

    try {
        const payload = jwt.verify(
            token,
            JWT_SECRET,
            connectTicket ? { audience: 'onchat-ws', algorithms: ['HS256'] } : undefined
        );

        if (
            !payload ||
            typeof payload !== 'object' ||
            !Number.isSafeInteger(Number(payload.id)) || Number(payload.id) <= 0
        ) {
            return null;
        }

        if (connectTicket) {
            const now=Date.now();for(const [id,expires] of usedConnectTickets)if(expires<now)usedConnectTickets.delete(id);
            if(payload.scope!=='onchat-ws-connect'||!payload.jti||usedConnectTickets.has(payload.jti))return null;
            if(usedConnectTickets.size>10000)return null;
            usedConnectTickets.set(payload.jti,now+60000);
        }
        return {
            id: Number(payload.id),
            walletId: payload.id_wallet || null,
            role: payload.role || null,
        };
    } catch {
        return null;
    }
}

function addConnection(userId, socket) {
    let connections = users.get(userId);

    if (!connections) {
        connections = new Set();
        users.set(userId, connections);
    }

    connections.add(socket);
}

function removeConnection(userId, socket) {
    const connections = users.get(userId);

    if (!connections) {
        return;
    }

    connections.delete(socket);

    if (connections.size === 0) {
        users.delete(userId);
    }
}

function send(socket, event, data = {}) {
    if (
        socket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    socket.send(
        JSON.stringify({
            event,
            data,
            timestamp: new Date().toISOString(),
        })
    );
}

function sendToUser(userId, event, data = {}) {
    const connections = users.get(Number(userId));

    if (!connections) {
        return;
    }

    for (const socket of connections) {
        send(socket, event, data);
    }
}

function broadcastUsers(event, data, excludedUserId = null) {
    for (const [userId, connections] of users) {
        if (
            excludedUserId !== null &&
            Number(userId) === Number(excludedUserId)
        ) {
            continue;
        }

        for (const socket of connections) {
            send(socket, event, data);
        }
    }
}

async function verifyConversationParticipant(
    conversationId,
    userId
) {
    const { rows } = await pool.query(
        `
        SELECT 1
        FROM conversations c
        INNER JOIN conversation_participants cp
            ON cp.conversation_id = c.id
        WHERE c.id = $1
          AND c.is_group = false
          AND cp.user_id = $2
        LIMIT 1
        `,
        [conversationId, userId]
    );

    return rows.length > 0;
}

async function getConversationOtherUser(
    conversationId,
    userId
) {
    const { rows } = await pool.query(
        `
        SELECT cp.user_id
        FROM conversations c
        INNER JOIN conversation_participants cp
            ON cp.conversation_id = c.id
        WHERE c.id = $1
          AND c.is_group = false
          AND cp.user_id <> $2
        ORDER BY cp.user_id
        LIMIT 1
        `,
        [conversationId, userId]
    );

    return rows.length
        ? Number(rows[0].user_id)
        : null;
}


// ---------------------------------------------------------------------------
// Salles de réunion (visioconférence multi-participants, façon Zoom).
// Ajout : n'affecte pas la signalisation 1-à-1 existante (call.*).
// La salle est identifiée par meetings.meeting_provider_id (code de réunion).
// ---------------------------------------------------------------------------
const MEET_MAX_PEERS = Number(process.env.ONCHAT_MEET_MAX_PEERS || 8);
const meetRooms = new Map(); // code -> Map<userId, Set<socket>>

function normalizeMeetCode(value) {
    const code = typeof value === 'string' ? value.trim() : '';
    return /^[A-Za-z0-9_-]{4,64}$/.test(code) ? code : '';
}

async function meetUserName(userId) {
    try {
        const { rows } = await pool.query('SELECT full_name FROM users WHERE id = $1 LIMIT 1', [userId]);
        return rows[0] && rows[0].full_name ? String(rows[0].full_name) : `Participant ${userId}`;
    } catch (e) {
        return `Participant ${userId}`;
    }
}

function meetPeerIds(code) {
    const room = meetRooms.get(code);
    return room ? Array.from(room.keys()) : [];
}

function sendToMeetUser(code, userId, event, data) {
    const room = meetRooms.get(code);
    const sockets = room && room.get(Number(userId));
    if (!sockets) return false;
    for (const s of sockets) send(s, event, data);
    return true;
}

function leaveMeetRoom(code, user, socket) {
    const room = meetRooms.get(code);
    if (!room) return;
    const sockets = room.get(user.id);
    if (!sockets) return;
    sockets.delete(socket);
    if (sockets.size > 0) return;
    room.delete(user.id);
    const disconnectedAt=new Date();
    pool.query('UPDATE meeting_participants SET left_at=NOW() WHERE meeting_id=(SELECT id FROM meetings WHERE meeting_provider_id=$1) AND user_id=$2 AND joined_at <= $3',[code,user.id,disconnectedAt]).catch(error=>console.error('[Meeting disconnect]',error.code));
    for (const peerId of room.keys()) {
        sendToMeetUser(code, peerId, 'meet.peer_left', { meetCode: code, userId: user.id });
    }
    if (room.size === 0) meetRooms.delete(code);
}

function leaveAllMeetRooms(user, socket) {
    for (const code of Array.from(meetRooms.keys())) {
        leaveMeetRoom(code, user, socket);
    }
}

async function broadcastMeetingState(code) {
    const { rows } = await pool.query(`SELECT m.status,
        (SELECT COUNT(*) FROM meeting_participants mp WHERE mp.meeting_id = m.id AND mp.left_at IS NULL) AS participants
        FROM meetings m WHERE m.meeting_provider_id = $1 LIMIT 1`, [code]);
    if (!rows[0]) return;
    const state = { meetCode: code, status: rows[0].status, participants: Number(rows[0].participants) };
    const room = meetRooms.get(code);
    for (const connections of users.values()) for (const socket of connections) {
        if (socket.meetingWatches?.has(code) || Array.from(room?.values() || []).some(sockets => sockets.has(socket))) send(socket, 'meet.updated', state);
    }
    if (!room) return;
    if (state.status !== 'active') {
        for (const sockets of room.values()) for (const socket of sockets) send(socket, 'meet.ended', { meetCode: code });
        meetRooms.delete(code);
        return;
    }
    const { rows: permissions } = await pool.query(`SELECT mp.user_id, mp.can_speak, mp.is_host FROM meeting_participants mp
        JOIN meetings m ON m.id = mp.meeting_id WHERE m.meeting_provider_id = $1 AND mp.left_at IS NULL`, [code]);
    for (const peerId of room.keys()) for (const permission of permissions) sendToMeetUser(code, peerId, 'meet.permissions', {
        meetCode: code, userId: Number(permission.user_id), canSpeak: Boolean(permission.can_speak || permission.is_host),
    });
}

async function handleMeetEvent(socket, user, event, data) {
    const code = normalizeMeetCode(data.meetCode);
    if (!code) {
        send(socket, 'error', { code: 'INVALID_MEET_CODE', message: 'Code de réunion invalide.' });
        return;
    }

    if (event === 'meet.watch') {
        if (!socket.meetingWatches) socket.meetingWatches = new Set();
        if (socket.meetingWatches.size >= 30 && !socket.meetingWatches.has(code)) return;
        socket.meetingWatches.add(code);
        await broadcastMeetingState(code);
        return;
    }
    if (event === 'meet.unwatch') { socket.meetingWatches?.delete(code); return; }
    if (event === 'meet.join') {
        const { rows } = await pool.query(
            `SELECT 1 FROM meetings m
             WHERE m.meeting_provider_id = $1 AND m.status = 'active'
               AND (m.host_user_id = $2 OR EXISTS (
                 SELECT 1 FROM meeting_participants mp
                 WHERE mp.meeting_id = m.id AND mp.user_id = $2 AND mp.left_at IS NULL
               )) LIMIT 1`,
            [code, user.id]
        );
        if (rows.length === 0) {
            send(socket, 'error', { code: 'MEET_NOT_FOUND', message: 'Réunion inaccessible. Rejoignez-la via l’API avant la connexion temps réel.' });
            return;
        }
        let room = meetRooms.get(code);
        if (!room) {
            room = new Map();
            meetRooms.set(code, room);
        }
        if (!room.has(user.id) && room.size >= MEET_MAX_PEERS) {
            send(socket, 'error', { code: 'MEET_FULL', message: 'La réunion est complète.' });
            return;
        }
        const existing = Array.from(room.keys()).filter((id) => id !== user.id);
        let sockets = room.get(user.id);
        const isNewPeer = !sockets;
        if (!sockets) {
            sockets = new Set();
            room.set(user.id, sockets);
        }
        sockets.add(socket);
        // Le nouvel arrivant reçoit la liste ; c'est lui qui envoie les offres.
        const names = {};
        for (const id of existing) names[id] = await meetUserName(id);
        send(socket, 'meet.peers', { meetCode: code, selfId: user.id, peers: existing, names });
        if (isNewPeer) {
            const myName = await meetUserName(user.id);
            for (const peerId of existing) {
                sendToMeetUser(code, peerId, 'meet.peer_joined', { meetCode: code, userId: user.id, name: myName });
            }
        }
        await broadcastMeetingState(code);
        return;
    }

    const room = meetRooms.get(code);
    const inRoom = room && room.get(user.id) && room.get(user.id).has(socket);
    if (!inRoom) {
        send(socket, 'error', { code: 'MEET_NOT_JOINED', message: "Vous n'êtes pas dans cette réunion." });
        return;
    }

    if (event === 'meet.leave') {
        leaveMeetRoom(code, user, socket);
        return;
    }

    if (event === 'meet.signal') {
        const to = Number(data.to);
        if (!Number.isFinite(to) || to === user.id || !room.has(to)) return;
        sendToMeetUser(code, to, 'meet.signal', {
            meetCode: code,
            from: user.id,
            payload: data.payload,
            name: typeof data.name === 'string' ? data.name.slice(0, 80) : undefined,
        });
    }
}

async function handleEvent(socket, user, message) {
    const event = message?.event;
    const data = message?.data || message || {};

    if (!event) {
        return;
    }

    if (event === 'ping') {
        send(socket, 'pong');
        return;
    }

    if (['meet.join', 'meet.leave', 'meet.signal', 'meet.watch', 'meet.unwatch'].includes(event)) {
        await handleMeetEvent(socket, user, event, data);
        return;
    }

    if (event === 'chat.typing') {
        const conversationId =
            typeof data.conversationId === 'string'
                ? data.conversationId.trim()
                : '';

        if (!conversationId) {
            return;
        }

        const allowed =
            await verifyConversationParticipant(
                conversationId,
                user.id
            );

        if (!allowed) {
            send(socket, 'error', {
                code: 'FORBIDDEN',
                message: 'Conversation inaccessible.',
            });
            return;
        }

        const otherUserId =
            await getConversationOtherUser(
                conversationId,
                user.id
            );

        if (!otherUserId) {
            return;
        }

        sendToUser(
            otherUserId,
            'chat.typing',
            {
                conversationId,
                userId: user.id,
                typing: Boolean(data.typing),
            }
        );

        return;
    }

    if (event === 'chat.read') {
        const conversationId =
            typeof data.conversationId === 'string'
                ? data.conversationId.trim()
                : '';

        if (!conversationId) {
            return;
        }

        const allowed =
            await verifyConversationParticipant(
                conversationId,
                user.id
            );

        if (!allowed) {
            send(socket, 'error', {
                code: 'FORBIDDEN',
                message: 'Conversation inaccessible.',
            });
            return;
        }

        await pool.query(
            `
            UPDATE messages
            SET
                is_read = true,
                status = 'read'
            WHERE conversation_id = $1
              AND sender_id <> $2
            `,
            [conversationId, user.id]
        );

        const otherUserId =
            await getConversationOtherUser(
                conversationId,
                user.id
            );

        if (otherUserId) {
            sendToUser(
                otherUserId,
                'chat.message.read',
                {
                    conversationId,
                    userId: user.id,
                }
            );
        }

        send(
            socket,
            'chat.message.read',
            {
                conversationId,
                userId: user.id,
            }
        );

        return;
    }

    if (
        event === 'call.offer' ||
        event === 'call.answer' ||
        event === 'call.ice_candidate' ||
        event === 'call.accepted' ||
        event === 'call.rejected' ||
        event === 'call.ended'
    ) {
        const conversationId =
            typeof data.conversationId === 'string'
                ? data.conversationId.trim()
                : '';

        if (!conversationId) {
            return;
        }

        const allowed =
            await verifyConversationParticipant(
                conversationId,
                user.id
            );

        if (!allowed) {
            send(socket, 'error', {
                code: 'FORBIDDEN',
                message: 'Conversation inaccessible.',
            });
            return;
        }

        const otherUserId =
            await getConversationOtherUser(
                conversationId,
                user.id
            );

        if (!otherUserId) {
            return;
        }

        sendToUser(
            otherUserId,
            event,
            {
                ...data,
                conversationId,
                senderId: user.id,
            }
        );

        return;
    }

    send(socket, 'error', {
        code: 'UNKNOWN_EVENT',
        message: `Événement WebSocket inconnu: ${event}`,
    });
}

// A dedicated PostgreSQL LISTEN connection bridges HTTP writes to this process.
// Notifications contain only an ID; recipients and content are loaded from committed rows.
let messageListener = null;
let listenerRetry = null;
let shuttingDown = false;
async function listenForMessages() {
    let client;
    let released = false;
    const release = () => {
        if (client && !released) { released = true; client.release(true); }
    };
    try {
        client = await pool.connect();
        messageListener = client;
        const retry = () => {
            if (messageListener !== client) return;
            messageListener = null;
            release();
            if (!shuttingDown) listenerRetry = setTimeout(listenForMessages, 3000);
        };
        client.on('error', retry);
        client.on('notification', async (notification) => {
            if (notification.channel === 'onchat_calls') {
                try {
                    const payload=JSON.parse(notification.payload);
                    const result=await pool.query(`SELECT cl.*,u.full_name,u.id_wallet,u.profile_photo FROM call_logs cl JOIN users u ON u.id=COALESCE($2::int,cl.caller_id) WHERE cl.id=$1`,[payload.callId,payload.actorId || null]);
                    const call=result.rows[0];if(!call)return;
                    const recipients=payload.targetId ? [Number(payload.targetId)] : [Number(call.caller_id),Number(call.receiver_id),...(await pool.query('SELECT user_id FROM onchat_call_invitees WHERE call_id=$1',[call.id])).rows.map(row=>Number(row.user_id))];
                    for(const id of new Set(recipients)) sendToUser(id,payload.event,{callId:call.id,callerName:call.full_name,callerWalletId:call.id_wallet,callerAvatar:call.profile_photo,isVideo:call.is_video,meetCode:call.meeting_code});
                } catch(error) {console.error('[Direct call notification]',error.message);}
                return;
            }
            if (notification.channel === 'inter_claim_activity') {
                try { const data = JSON.parse(notification.payload); sendToUser(Number(data.userId), 'inter.claim.updated', { claimId: data.claimId }); }
                catch (error) { console.error('[Inter activity]', error.message); }
                return;
            }
            if (notification.channel === 'onchat_group_messages') {
                try {
                    const { id } = JSON.parse(notification.payload);
                    const { rows } = await pool.query(`SELECT gm.*, member.user_id AS recipient_id FROM group_messages gm
                        JOIN group_members member ON member.group_id = gm.group_id AND member.status = 'active' WHERE gm.id = $1`, [id]);
                    for (const row of rows) sendToUser(row.recipient_id, 'chat.message.created', {
                        conversationId: `g_${row.group_id}`,
                        message: { id: String(row.id), senderId: row.sender_id, senderName: row.sender_name, content: row.content, type: row.type,
                            metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
                            status: 'sent', timestamp: new Date(row.created_at).toISOString() },
                    });
                } catch (error) { console.error('[ONCHAT GROUP NOTIFICATION]', error.message); }
                return;
            }
            if (notification.channel === 'onchat_meetings') {
                try { const code = normalizeMeetCode(JSON.parse(notification.payload).meetCode); if (code) await broadcastMeetingState(code); }
                catch (error) { console.error('[ONCHAT WS MEETING]', error.message); }
                return;
            }
            if (notification.channel !== 'onchat_messages') return;
            try {
                const { id } = JSON.parse(notification.payload);
                if (typeof id !== 'string') return;
                const { rows } = await pool.query(`
                    SELECT m.*, cp.user_id AS recipient_id, sender.full_name AS sender_name
                    FROM messages m
                    LEFT JOIN users sender ON sender.id = m.sender_id
                    JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
                    WHERE m.id = $1`, [id]);
                for (const row of rows) {
                    sendToUser(row.recipient_id, 'chat.message.created', {
                        conversationId: row.conversation_id,
                        message: {
                            id: String(row.id), conversationId: row.conversation_id,
                            senderId: row.sender_id, senderName: row.sender_name, content: row.content, type: row.type,
                            metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
                            status: row.status, isRead: row.is_read, imageId: row.image_id,
                            timestamp: new Date(row.created_at).toISOString(),
                        },
                    });
                }
            } catch (error) { console.error('[ONCHAT WS NOTIFICATION]', error.message); }
        });
        await client.query('LISTEN onchat_calls');
        await client.query('LISTEN inter_claim_activity');
        await client.query('LISTEN onchat_messages');
        await client.query('LISTEN onchat_meetings');
        await client.query('LISTEN onchat_group_messages');
    } catch (error) {
        if (messageListener === client) messageListener = null;
        release();
        console.error('[ONCHAT WS LISTEN]', error.message);
        if (!shuttingDown) listenerRetry = setTimeout(listenForMessages, 3000);
    }
}
listenForMessages();

wss.on('connection', (socket, request, user) => {
    addConnection(user.id, socket);

    send(socket, 'connected', {
        userId: user.id,
        walletId: user.walletId,
    });

    broadcastUsers(
        'presence.online',
        {
            userId: user.id,
        },
        user.id
    );

    socket.on('message', async (raw) => {
        try {
            const message = JSON.parse(
                raw.toString()
            );

            await handleEvent(
                socket,
                user,
                message
            );
        } catch (error) {
            console.error(
                '[ONCHAT WS MESSAGE]',
                error
            );

            send(socket, 'error', {
                code: 'INVALID_MESSAGE',
                message: 'Message WebSocket invalide.',
            });
        }
    });

    socket.on('close', () => {
        leaveAllMeetRooms(user, socket);
        removeConnection(
            user.id,
            socket
        );

        if (!users.has(user.id)) {
            broadcastUsers(
                'presence.offline',
                {
                    userId: user.id,
                },
                user.id
            );
        }
    });

    socket.on('error', (error) => {
        console.error(
            '[ONCHAT WS SOCKET]',
            error
        );
    });
});

server.on('upgrade', async (request, socket, head) => {
    if (new URL(request.url, 'http://localhost').pathname !== '/ws') {
        socket.write(
            'HTTP/1.1 404 Not Found\r\n\r\n'
        );
        socket.destroy();
        return;
    }

    const user = authenticate(request);

    if (!user) {
        socket.write(
            'HTTP/1.1 401 Unauthorized\r\n' +
            'Connection: close\r\n' +
            '\r\n'
        );
        socket.destroy();
        return;
    }

    try {
        const current=await pool.query("SELECT id,id_wallet,role FROM users WHERE id=$1 AND LOWER(status)='active'",[user.id]);
        if(!current.rows[0]) { socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');socket.destroy();return; }
        user.role=current.rows[0].role;user.walletId=current.rows[0].id_wallet;
    } catch(error) {socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');socket.destroy();return;}
    if(socket.destroyed)return;
    wss.handleUpgrade(
        request,
        socket,
        head,
        (webSocket) => {
            wss.emit(
                'connection',
                webSocket,
                request,
                user
            );
        }
    );
});

server.listen(
    PORT,
    HOST,
    () => {
        console.log(
            `[ONCHAT WS] listening on ${HOST}:${PORT}`
        );
    }
);

process.on('SIGTERM', async () => {
    console.log(
        '[ONCHAT WS] shutting down'
    );

    shuttingDown = true;
    clearTimeout(listenerRetry);
    if (messageListener) { messageListener.release(true); messageListener = null; }
    wss.close();
    server.close();

    await pool.end();

    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log(
        '[ONCHAT WS] shutting down'
    );

    shuttingDown = true;
    clearTimeout(listenerRetry);
    if (messageListener) { messageListener.release(true); messageListener = null; }
    wss.close();
    server.close();

    await pool.end();

    process.exit(0);
});
