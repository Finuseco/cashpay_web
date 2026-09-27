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

        cookies[key] = decodeURIComponent(value);
    }

    return cookies;
}

function authenticate(request) {
    const cookies = parseCookies(
        request.headers.cookie
    );

    const token = cookies['cashpay-token'];

    if (!token) {
        return null;
    }

    try {
        const payload = jwt.verify(
            token,
            JWT_SECRET
        );

        if (
            !payload ||
            typeof payload !== 'object' ||
            !payload.id
        ) {
            return null;
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

async function handleEvent(socket, user, message) {
    const event = message?.event;
    const data = message?.data || {};

    if (!event) {
        return;
    }

    if (event === 'ping') {
        send(socket, 'pong');
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

server.on('upgrade', (request, socket, head) => {
    if (request.url !== '/ws') {
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

    wss.close();
    server.close();

    await pool.end();

    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log(
        '[ONCHAT WS] shutting down'
    );

    wss.close();
    server.close();

    await pool.end();

    process.exit(0);
});
