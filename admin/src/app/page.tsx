import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <section className="mx-auto max-w-xl px-4 py-12 sm:py-20">
      <Card className="gap-4 p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight">Restaurant reservations</h1>
        <p className="text-muted-foreground">Find a time and reserve a table online.</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link prefetch={false} href="/r/default/book">Book a table</Link></Button>
          <Button asChild variant="outline"><Link href="/r/default/my-reservations">My Reservations</Link></Button>
          <Button asChild variant="outline"><Link href="/r/default/login">Staff sign in</Link></Button>
          <Button asChild variant="ghost"><Link href="/platform/login">Platform sign in</Link></Button>
        </div>
      </Card>
    </section>
  );
}
