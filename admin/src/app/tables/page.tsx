import Image from "next/image";
import { connection } from "next/server";
import { adminRoles, requireRole } from "@/lib/auth";
import { listTables } from "@/lib/pos-api";
import "../pos.css";

export default async function TablesPage() {
  await requireRole(adminRoles, { next: "/tables" });
  await connection();
  const tables = await listTables();
  return (
    <div className="table-print">
      <h1>Table QR codes</h1>
      {tables.length ? (
        <ul className="pos-list qr-grid">
          {tables.map(table => (
            <li className="pos-card qr-card" key={table.id}>
              <h2>Table {table.number}</h2>
              <Image unoptimized width={200} height={200} src={`/tables/${table.id}/qr`} alt={`QR code for table ${table.number}`} />
              {!table.active && <p>Inactive</p>}
            </li>
          ))}
        </ul>
      ) : <p>No tables yet.</p>}
    </div>
  );
}
