// Service Worker для push-уведомлений

// Устанавливаем Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Service Worker установлен');
    self.skipWaiting();
});

// Активируем Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker активирован');
    event.waitUntil(self.clients.claim());
});

// Обработка push-уведомлений
self.addEventListener('push', (event) => {
    console.log('[SW] Получено push-уведомление');
    
    const data = event.data ? event.data.json() : {};
    
    const options = {
        body: data.body || 'У вас новое уведомление',
        icon: '/logo.svg',
        badge: '/logo.svg',
        vibrate: [200, 100, 200],
        tag: data.tag || 'most-bridge-notification',
        data: {
            url: data.url || '/'
        },
        actions: [
            { action: 'open', title: 'Открыть' },
            { action: 'close', title: 'Закрыть' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Мост', options)
    );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Клик по уведомлению');
    
    event.notification.close();

    if (event.action === 'open' || !event.action) {
        const urlToOpen = event.notification.data.url || '/';
        
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then((windowClients) => {
                    // Проверяем, есть ли уже открытая вкладка
                    for (let client of windowClients) {
                        if (client.url === urlToOpen && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    // Открываем новую вкладку
                    if (clients.openWindow) {
                        return clients.openWindow(urlToOpen);
                    }
                })
        );
    }
});