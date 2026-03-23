import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">PRessPlay</h1>
      <p className="text-lg text-gray-600 mb-8">Auto-generated demo videos for every pull request</p>
      <Link
        href="/dashboard"
        className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition"
      >
        Get Started
      </Link>
    </main>
  );
}
