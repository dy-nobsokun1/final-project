import { RegisterForm } from "@/components/forms/RegisterForm";

export const metadata = { title: "Create account | UniSwap" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Create account</h1>
      <RegisterForm />
    </div>
  );
}

