import { LoginForm } from "@/components/forms/LoginForm";

export const metadata = { title: "Sign in | UniSwap" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Sign in</h1>
      <LoginForm />
    </div>
  );
}

