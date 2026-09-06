import { googleEnabled } from "@/lib/auth";
import { SignupForm } from "@/components/SignupForm";

export const metadata = { title: "Create an account — Stat Padder" };

export default function SignupPage() {
  return <SignupForm googleEnabled={googleEnabled} />;
}
