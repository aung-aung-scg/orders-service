import { QrCode } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function TableNotFound() {
  return (
    <div data-customer className="grid min-h-dvh place-items-center px-5 py-12">
      <Card className="w-full max-w-sm gap-3 rounded-2xl p-6 shadow-sm">
        <QrCode className="size-8 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Table unavailable</h1>
        <p className="text-sm text-muted-foreground">Scan the QR code on your table again or ask a staff member for help.</p>
      </Card>
    </div>
  );
}
