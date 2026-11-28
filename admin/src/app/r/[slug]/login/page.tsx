import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";
import { publicRestaurant } from "@/lib/restaurant-api";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ThemeToggle } from "@/app/theme-toggle";

export default async function LoginPage({ params, searchParams }: PageProps<"/r/[slug]/login">) {
  const t = await getTranslations();
  const { slug } = await params;
  const session = await getSession();
  if (session && session.restaurantSlug !== slug) redirect("/r/" + session.restaurantSlug + "/login");
  if (session?.mustChangePassword) redirect("/r/" + slug + "/change-password");
  const { name } = await publicRestaurant(slug);
  const { next } = await searchParams;
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] place-items-center px-5 py-12">
      <Card className="w-full max-w-sm rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{t("booking.staffSignInAtName", { name })}</h1>
          <ThemeToggle />
        </CardHeader>
        <CardContent>
          <LoginForm slug={slug} next={typeof next === "string" ? next.slice(0, 2048) : ""} />
          <Link href={"/r/" + slug + "/book"} prefetch={false} className="mt-4 block text-center text-sm font-medium text-primary underline-offset-4 hover:underline">{t("common.bookATable")}</Link>
        </CardContent>
      </Card>
    </div>
  );
}
