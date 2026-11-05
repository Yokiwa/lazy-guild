/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { type PushPayload, handleNotificationClick, handlePush } from './sw-handlers';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// SPA: every navigation is served the cached app shell, so deep links work offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

self.addEventListener('push', (event) => {
  let payload: PushPayload | null;
  try {
    payload = (event.data?.json() as PushPayload | undefined) ?? null;
  } catch {
    payload = null;
  }
  event.waitUntil(handlePush(payload, self.registration));
});

self.addEventListener('notificationclick', (event) => {
  event.waitUntil(handleNotificationClick(event, self.clients as never, self.location.origin));
});
