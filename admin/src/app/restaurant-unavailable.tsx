import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function RestaurantUnavailable() {
  return <main className="grid min-h-[65vh] place-items-center px-4">
    <Card className="w-full max-w-md gap-4 p-6">
      <h1 className="text-xl font-semibold">Restaurant temporarily unavailable</h1>
      <p className="text-sm text-muted-foreground">Please check back later or contact the restaurant directly.</p>
      <Button asChild variant="outline" className="w-fit"><Link href="/">Back to homepage</Link></Button>
    </Card>
  </main>;
}
