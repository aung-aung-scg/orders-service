"use client";

import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  const t = useTranslations();
  return <Button type="button" onClick={() => window.print()}><Printer />{" "}{t("tables.print")}</Button>;
}
