import { redirect } from "next/navigation";

export async function GET(_request: Request, { params }: RouteContext<"/booking/[code]/calendar">) {
  redirect("/r/default/booking/" + encodeURIComponent((await params).code) + "/calendar");
}
