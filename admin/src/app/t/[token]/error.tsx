"use client";

import { useTranslations } from "next-intl";
import { CircleAlert, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function TableError({ reset }: { reset: () => void }) {
  const t = useTranslations();
  return (
    <div data-customer className="grid min-h-dvh place-items-center px-5 py-12">
      <Card className="w-full max-w-sm gap-3 rounded-2xl p-6 shadow-sm">
        <CircleAlert className="size-8 text-destructive" />
        <h1 className="text-2xl font-semibold tracking-tight">{t("customer.couldnTLoadTheMenu")}</h1>
        <p className="text-sm text-muted-foreground">{t("customer.tryAgainInAMomentOrAsk")}</p>
        <Button type="button" onClick={reset} className="mt-2 w-fit"><RotateCw />{" "}{t("common.tryAgain")}</Button>
      </Card>
    </div>
  );
}
