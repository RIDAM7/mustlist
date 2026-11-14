import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-semibold">Card not found</h1>
      <p className="text-muted-foreground">There is no card at this address yet.</p>
      <Link href="/" className="underline underline-offset-4">
        Browse the library
      </Link>
    </div>
  );
}
