import { z } from "zod";

export const tableStatus = z.enum(["OPEN", "SUBMITTED", "PREPARING", "READY", "SERVED", "CANCELLED"]);
export const tableLine = z.object({
  id: z.string(),
  nameSnapshot: z.string(),
  unitPriceMinor: z.number().int(),
  quantity: z.number().int(),
  note: z.string().nullable(),
});
const tableOrder = z.object({ id: z.string(), totalMinor: z.number().int(), items: z.array(tableLine) });
export const ticketStatus = z.object({ id: z.string(), status: tableStatus });
export const customerTable = z.object({
  tableNumber: z.number().int(),
  menu: z.array(z.object({ id: z.string(), name: z.string(), priceMinor: z.number().int() })),
  order: tableOrder.nullable(),
  ticket: ticketStatus.nullable(),
});
export const tickets = z.array(z.object({
  id: z.string(),
  status: z.enum(["SUBMITTED", "PREPARING", "READY"]),
  submittedAt: z.iso.datetime(),
  table: z.object({ number: z.number().int() }),
  items: z.array(tableLine),
}));
export type Ticket = z.infer<typeof tickets>[number];
export type CustomerTable = z.infer<typeof customerTable>;

export function baht(satang: number) {
  const digits = String(Math.abs(satang)).padStart(3, "0");
  return `${satang < 0 ? "-" : ""}฿${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
