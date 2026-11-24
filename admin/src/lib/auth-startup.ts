import { exit } from "node:process";
import { sessionSecret } from "./auth-secret";

export function validateStartupSecret() {
  try {
    sessionSecret();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid JWT configuration");
    exit(1);
  }
}
