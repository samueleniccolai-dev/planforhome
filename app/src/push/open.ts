const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TapResponse = {
  notification: {
    request: { identifier: string; content: { data?: Record<string, unknown> } };
  };
};

/** The part of `expo-notifications` used here. */
export type OpenerNotifications = {
  addNotificationResponseReceivedListener(listener: (r: TapResponse) => void): { remove(): void };
  getLastNotificationResponseAsync(): Promise<TapResponse | null>;
  clearLastNotificationResponseAsync(): Promise<void>;
};

type Options = { notifications: OpenerNotifications; navigate: (href: string) => void };

/** A tap on a notification opens `/tasks?task=<id>`, once the router is ready. */
export function createNotificationOpener({ notifications, navigate }: Options) {
  let isReady = false;
  const waiting: TapResponse[] = [];
  const seen = new Set<string>();

  function open(r: TapResponse) {
    const id = r.notification.request.identifier;
    if (seen.has(id)) return;
    seen.add(id);
    const taskId = r.notification.request.content.data?.taskId;
    if (typeof taskId === 'string' && UUID.test(taskId)) navigate(`/tasks?task=${taskId}`);
  }

  const subscription = notifications.addNotificationResponseReceivedListener((r) => {
    if (isReady) open(r);
    else waiting.push(r);
  });

  return {
    async ready() {
      const last = await notifications.getLastNotificationResponseAsync().catch(() => null);
      isReady = true;
      if (last) waiting.push(last);
      waiting.splice(0).forEach(open);
      if (last) await notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    },
    dispose: () => subscription.remove(),
  };
}
