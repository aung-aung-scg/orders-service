import { LoginForm } from "./login-form";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ThemeToggle } from "../theme-toggle";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] place-items-center px-5 py-12">
      <Card className="w-full max-w-sm rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Staff sign in</h1>
          <ThemeToggle />
        </CardHeader>
        <CardContent>
          <LoginForm next={typeof next === "string" ? next.slice(0, 2048) : ""} />
          <Link href="/book" prefetch={false} className="mt-4 block text-center text-sm font-medium text-primary underline-offset-4 hover:underline">Book a table</Link>
        </CardContent>
      </Card>
    </div>
  );
}
