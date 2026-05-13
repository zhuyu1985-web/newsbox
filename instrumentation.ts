// instrumentation.ts —— Next.js 15 的启动 hook
// docs: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startVideoWorker } = await import('@/lib/workers');
    await startVideoWorker();
  }
}
