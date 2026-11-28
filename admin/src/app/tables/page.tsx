import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { WorkspaceEmpty } from "@/app/restaurant-admin/workspace-state";
import { adminRoles, requireRole } from "@/lib/auth";
import { listTables } from "@/lib/pos-api";
import { PrintButton } from "./print-button";

export default async function TablesPage() {
  const t = await getTranslations();
  await requireRole(adminRoles, { next: "/tables" });
  await connection();
  const tables = await listTables();
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("tables.tableQrCodes")}</h1>
        {tables.length > 0 && <PrintButton />}
      </header>
      {tables.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:block">
          {tables.map(table => (
            <li className="print:break-inside-avoid print:break-after-page print:last:break-after-auto" key={table.id}>
              <Card className="h-full items-center gap-4 rounded-2xl p-5 text-center shadow-sm print:mx-auto print:mt-16 print:w-[4in] print:border-black print:bg-white print:p-8 print:text-black print:shadow-none print:ring-0">
                <h2 className="break-all text-2xl font-semibold tracking-tight print:text-4xl">{t("customer.tableNumber", { number: table.number })}</h2>
                <div className="rounded-xl border bg-white p-2 print:border-0">
                  <Image unoptimized loading="eager" width={200} height={200} src={`/tables/${table.id}/qr`} alt={t("tables.qrCodeForTableP0", { p0: table.number })} className="size-44 print:size-64" />
                </div>
                {!table.active && <Badge variant="outline" className="print:text-black">{t("tables.inactive")}</Badge>}
              </Card>
            </li>
          ))}
        </ul>
      ) : <WorkspaceEmpty title={t("tables.noTablesYet")} />}
    </div>
  );
}
