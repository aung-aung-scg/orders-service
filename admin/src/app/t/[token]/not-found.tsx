import { useTranslations } from "next-intl";
import { QrCode } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function TableNotFound() {
  const t = useTranslations();
  return (
    <div data-customer className="grid min-h-dvh place-items-center px-5 py-12">
      <Card className="w-full max-w-sm gap-3 rounded-2xl p-6 shadow-sm">
        <QrCode className="size-8 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">{t("customer.tableUnavailable")}</h1>
        <p className="text-sm text-muted-foreground">{t("customer.scanTheQrCodeOnYourTable")}</p>
      </Card>
    </div>
  );
}
