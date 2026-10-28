import { ForgotPasswordForm } from "@/components/forms/ForgotPasswordForm";

export const metadata = { title: "Forgot password | UniSwap" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="mb-2 font-heading text-2xl tracking-tight">Forgot your password?</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Enter your campus email and we will send you a link to choose a new password.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
