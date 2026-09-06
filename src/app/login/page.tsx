import { Suspense } from "react";
import { googleEnabled } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Sign in — Stat Padder" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
