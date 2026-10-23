import * as Notifications from 'expo-notifications';

import type { TokenSession } from '@/api/tokenSession';
import { t } from '@/i18n';

import { createNotificationOpener } from './open';
import { createPushRegistration } from './registration';

/** Android: token registration with the real `expo-notifications`. */
export function createPush(auth: TokenSession) {
  return createPushRegistration({
    notifications: Notifications,
    auth,
    channelName: t('push.channel'),
  });
}

/** Android: the tap on a notification, once the router is mounted (`ready()`). */
export function createOpener(navigate: (href: string) => void) {
  return createNotificationOpener({ notifications: Notifications, navigate });
}
