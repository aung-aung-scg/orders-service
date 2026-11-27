import { Card } from "@/components/ui/card";
import { PlatformLoginForm } from "../forms";

export default function PlatformLoginPage() {
  return <main className="grid min-h-[75vh] place-items-center px-4">
    <Card className="w-full max-w-sm gap-5 p-6">
      <h1 className="text-xl font-semibold">Platform sign in</h1>
      <PlatformLoginForm />
    </Card>
  </main>;
}
