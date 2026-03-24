import Link from 'next/link';
import Image from 'next/image';

export function Logo() {
  return (
    <Link href="/" className="flex items-center">
      <Image
        src="/images/PRessPlay_logo_transparent.png"
        alt="PRessPlay"
        width={180}
        height={50}
        className="h-9 w-auto"
        priority
      />
    </Link>
  );
}
