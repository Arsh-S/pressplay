import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-500">
        <span className="text-[11px] font-bold text-white">▶</span>
      </div>
      <span className="text-[15px] font-semibold tracking-tight text-zinc-50">PRessPlay</span>
    </Link>
  );
}
