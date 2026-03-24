import Link from 'next/link';
import Image from 'next/image';

export function Logo() {
  return (
    <Link href="/" className="flex items-center">
      <Image
        src="/images/PRessPlay_logo_transparent.png"
        alt="PRessPlay"
        width={140}
        height={40}
        className="brightness-0 invert"
        priority
      />
    </Link>
  );
}
