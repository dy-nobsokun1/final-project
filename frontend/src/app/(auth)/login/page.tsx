import { LoginForm } from "@/components/forms/LoginForm";

export const metadata = { title: "Sign in | UniSwap" };

/** `?reset=1` is added by the reset-password form after a new password is saved. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { reset } = await searchParams;

  return (
    <div>
      <h1 className="mb-4 font-heading text-2xl tracking-tight">Sign in</h1>
      {reset === "1" ? (
        <p role="status" className="mb-4 rounded-lg border border-border bg-muted p-3 text-sm">
          Your password was changed. Sign in with the new one.
        </p>
      ) : null}
      <LoginForm />
    </div>
  );
}
