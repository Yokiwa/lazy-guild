import type { Lang, Run } from '@lazy-guild/core';

// Placeholder surface; real implementation arrives with the push task.
export type PushStatus = 'synced' | 'pending' | 'off' | 'unsupported' | 'unconfigured' | 'denied';

export const pushClient = {
  async enable(): Promise<PushStatus> {
    return 'unconfigured';
  },
  async disable(): Promise<void> {},
  async syncSlots(): Promise<void> {},
  async scheduleConfirm(_run: Run): Promise<void> {},
  async cancelConfirm(_runId: string): Promise<void> {},
  async updateLang(_lang: Lang): Promise<void> {},
  async flush(): Promise<void> {},
  async status(): Promise<PushStatus> {
    return 'unconfigured';
  },
  async onStartup(): Promise<void> {},
};
