import { NewListingForm } from "@/components/forms/NewListingForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Sell an item | UniSwap" };

export default function NewListingPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Create a listing</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Be honest about condition. Clear listings sell faster.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Item details</CardTitle>
        </CardHeader>
        <CardContent>
          <NewListingForm />
        </CardContent>
      </Card>
    </div>
  );
}

