import { LoginForm } from "@/components/forms/LoginForm";

export const metadata = { title: "Sign in | UniSwap" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="mb-4 font-heading text-2xl tracking-tight">Sign in</h1>
      <LoginForm />
    </div>
  );
}

