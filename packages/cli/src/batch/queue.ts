import { randomUUID } from 'node:crypto';
import type { BatchTaskInput, BatchTaskSnapshot } from './types.js';

export interface BatchTaskResult {
  outputPath: string;
  logPath?: string;
  storyboardSource?: BatchTaskSnapshot['storyboardSource'];
  storyboardWarning?: string;
}

export type BatchTaskUpdate = Partial<
  Pick<
    BatchTaskSnapshot,
    'progress' | 'stage' | 'logPath' | 'storyboardSource' | 'storyboardWarning'
  >
>;

export type BatchProcessor = (
  input: BatchTaskInput,
  taskId: string,
  update: (patch: BatchTaskUpdate) => void,
) => Promise<BatchTaskResult>;

export class BatchQueue {
  private readonly tasks: BatchTaskSnapshot[] = [];
  private draining = false;
  private idleWaiters: Array<() => void> = [];
  private readonly processor: BatchProcessor;

  constructor(processor: BatchProcessor) {
    this.processor = processor;
  }

  enqueue(inputs: BatchTaskInput[]): BatchTaskSnapshot[] {
    const created = inputs.map((input) => {
      const task: BatchTaskSnapshot = {
        ...input,
        id: `batch_${randomUUID().slice(0, 12)}`,
        status: 'waiting',
        progress: 0,
        stage: '等待处理',
        attempts: 0,
        maxAttempts: 2,
        createdAt: new Date().toISOString(),
      };
      this.tasks.push(task);
      return task;
    });
    void this.drain();
    return created.map(cloneTask);
  }

  list(): BatchTaskSnapshot[] {
    return this.tasks.map(cloneTask);
  }

  async waitForIdle(): Promise<void> {
    if (
      !this.draining &&
      !this.tasks.some((task) => task.status === 'waiting' || task.status === 'processing')
    )
      return;
    await new Promise<void>((resolve) => this.idleWaiters.push(resolve));
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      let task = this.tasks.find((item) => item.status === 'waiting');
      while (task) {
        await this.processOne(task);
        task = this.tasks.find((item) => item.status === 'waiting');
      }
    } finally {
      this.draining = false;
      for (const resolve of this.idleWaiters.splice(0)) resolve();
    }
  }

  private async processOne(task: BatchTaskSnapshot): Promise<void> {
    while (task.attempts < task.maxAttempts) {
      task.attempts += 1;
      task.status = 'processing';
      task.startedAt ??= new Date().toISOString();
      task.stage = task.attempts === 1 ? '正在启动' : '正在自动重试';
      task.progress = 0;
      task.error = undefined;
      try {
        const result = await this.processor(task, task.id, (patch) => Object.assign(task, patch));
        task.status = 'success';
        task.progress = 100;
        task.stage = '已完成';
        task.outputPath = result.outputPath;
        if (result.logPath) task.logPath = result.logPath;
        if (result.storyboardSource) task.storyboardSource = result.storyboardSource;
        if (result.storyboardWarning) task.storyboardWarning = result.storyboardWarning;
        task.endedAt = new Date().toISOString();
        return;
      } catch (error) {
        task.error = error instanceof Error ? error.message : String(error);
        if (task.attempts < task.maxAttempts) {
          task.status = 'waiting';
          task.stage = '首次处理失败，准备自动重试一次';
        }
      }
    }
    task.status = 'failed';
    task.stage = '重试后仍然失败';
    task.endedAt = new Date().toISOString();
  }
}

function cloneTask(task: BatchTaskSnapshot): BatchTaskSnapshot {
  return { ...task };
}
