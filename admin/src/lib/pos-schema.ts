import { z } from "zod";

export const tableStatus = z.enum(["OPEN", "SUBMITTED", "PREPARING", "READY", "SERVED", "CANCELLED"]);
export const tableLine = z.object({
  id: z.string(),
  nameSnapshot: z.string(),
  unitPriceMinor: z.number().int(),
  quantity: z.number().int(),
  note: z.string().nullable(),
});
const tableOrder = z.object({ id: z.string(), version: z.number().int(), totalMinor: z.number().int(), items: z.array(tableLine) });
export const ticketStatus = z.object({ id: z.string(), status: tableStatus });
export const submittedOrder = z.object({
  id: z.string(), submittedAt: z.iso.datetime(), totalMinor: z.number().int(), items: z.array(tableLine),
  status: z.enum(["SUBMITTED", "PREPARING", "READY", "SERVED", "CANCELLED"]),
});
export type SubmittedOrder = z.infer<typeof submittedOrder>;
export const orderLabels: Record<SubmittedOrder["status"], string> = {
  SUBMITTED: "Received", PREPARING: "Preparing", READY: "Ready", SERVED: "Served", CANCELLED: "Cancelled",
};
export const customerTable = z.object({
  sessionId: z.uuid().nullable(),
  tableNumber: z.number().int(),
  menu: z.array(z.object({ id: z.string(), name: z.string(), priceMinor: z.number().int(), imageKey: z.string().nullish() })),
  order: tableOrder.nullable(),
  ticket: ticketStatus.nullable(),
  submittedOrders: z.array(submittedOrder),
  sessionTotalMinor: z.number().int(),
  sessionEnded: z.boolean(),
});
export const tickets = z.array(z.object({
  id: z.string(),
  status: z.enum(["SUBMITTED", "PREPARING", "READY"]),
  submittedAt: z.iso.datetime(),
  previousSeating: z.boolean(),
  table: z.object({ number: z.number().int() }),
  items: z.array(tableLine),
}));
export type Ticket = z.infer<typeof tickets>[number];
export type CustomerTable = z.infer<typeof customerTable>;

const thbFormatter = new Intl.NumberFormat("en-TH", { style: "currency", currency: "THB" });

export function baht(satang: number) {
  return thbFormatter.format(satang / 100);
}
