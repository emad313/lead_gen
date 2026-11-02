declare module 'node-cron' {
  export function schedule(
    expression: string,
    task: () => void | Promise<void>
  ): { stop: () => void };
}
