import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <>
      <h1>Staff sign in</h1>
      <LoginForm next={typeof next === "string" ? next.slice(0, 2048) : ""} />
    </>
  );
}
