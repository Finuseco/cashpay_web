
// public/sw.js

self.addEventListener('push', function (event) {
    const data = event.data.json();
    console.log('Push received:', data);

    const title = data.title || 'CashPay';
    const options = {
        body: data.body,
        icon: data.icon || '/logos/favicon.png',
        badge: '/logos/favicon.png',
        data: {
            url: data.data.url
        }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});


self.addEventListener('notificationclick', function (event) {
    console.log('[Service Worker] Notification click Received.');

    event.notification.close();

    const urlToOpen = event.notification.data.url || '/';

    event.waitUntil(
        clients.matchAll({
            type: "window"
        }).then(function (clientList) {
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
