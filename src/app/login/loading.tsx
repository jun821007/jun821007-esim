export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm animate-pulse rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="h-6 w-32 rounded bg-zinc-200" />
        <div className="mt-4 h-4 w-full rounded bg-zinc-100" />
        <div className="mt-4 h-10 w-full rounded-lg bg-zinc-100" />
        <div className="mt-3 h-10 w-full rounded-lg bg-zinc-100" />
        <div className="mt-4 h-10 w-full rounded-lg bg-zinc-200" />
      </div>
    </div>
  );
}