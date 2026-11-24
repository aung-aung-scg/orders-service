export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateStartupSecret } = await import("./lib/auth-startup");
    validateStartupSecret();
  }
}
