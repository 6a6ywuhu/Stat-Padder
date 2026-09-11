import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const metadata = { title: "Choose a new password — Stat Padder" };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
