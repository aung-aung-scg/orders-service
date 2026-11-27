import { redirect } from "next/navigation";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { ChangePasswordForm } from "./form";

export default async function ChangePasswordPage({ params }: PageProps<"/r/[slug]/change-password">) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("/r/" + encodeURIComponent(slug) + "/login");
  if (session.restaurantSlug !== slug) redirect("/r/" + session.restaurantSlug + "/change-password");
  if (!session.mustChangePassword) redirect(session.role === "ADMIN" ? "/menu" : "/kitchen");
  return <main className="grid min-h-[70vh] place-items-center px-4">
    <Card className="w-full max-w-sm gap-4 p-6">
      <h1 className="text-xl font-semibold">Change your temporary password</h1>
      <ChangePasswordForm slug={slug} />
      <form action={logout}><Button variant="outline">Sign out</Button></form>
    </Card>
  </main>;
}
