"use client";

import { CheckCircle2, Download, Printer, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ListingWithSeller } from "@/types";

interface InvoiceReceiptCardProps {
  invoiceNo: string;
  listing: ListingWithSeller;
}

export function InvoiceReceiptCard({ invoiceNo, listing }: InvoiceReceiptCardProps) {
  const currentDate = new Date().toLocaleDateString("en-US", {
    dateStyle: "medium",
  });

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-card p-6 shadow-md transition-all">
      {/* Close button to dismiss invoice view */}
      <Link
        href={`/listings/${listing.id}`}
        className="absolute top-4 right-4 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground print:hidden"
        title="Close receipt view"
      >
        <X className="size-5" />
        <span className="sr-only">Close invoice view</span>
      </Link>

      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-lg font-bold tracking-tight text-foreground">
                  Official Payment Receipt
                </h2>
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Paid Online
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                UniSwap Campus Marketplace • Order Confirmation
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Invoice Number
            </span>
            <code className="font-mono text-sm font-bold text-foreground">
              {invoiceNo}
            </code>
          </div>
        </div>

        {/* Invoice Summary Details */}
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <span className="block text-xs text-muted-foreground">Date Issued</span>
            <span className="font-medium text-foreground">{currentDate}</span>
          </div>
          <div>
            <span className="block text-xs text-muted-foreground">Seller</span>
            <span className="font-medium text-foreground">{listing.seller.name}</span>
          </div>
          <div>
            <span className="block text-xs text-muted-foreground">Category</span>
            <span className="font-medium capitalize text-foreground">{listing.category}</span>
          </div>
          <div>
            <span className="block text-xs text-muted-foreground">Total Paid</span>
            <span className="font-mono text-base font-bold text-primary">
              ${Number(listing.price).toFixed(2)} USD
            </span>
          </div>
        </div>

        {/* Item description bar */}
        <div className="rounded-xl border border-border bg-muted/50 p-4">
          <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Purchased Item
          </span>
          <p className="mt-1 font-heading text-base font-semibold text-foreground">
            {listing.title}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {listing.description || "Campus student transaction via UniSwap."}
          </p>
        </div>

        {/* Actions bar (hidden during print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 print:hidden">
          <p className="text-xs text-muted-foreground">
            Keep this receipt for your records or campus meetup handover.
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5"
            >
              <Printer className="size-4" />
              <span>Print / Save as PDF</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5"
            >
              <Download className="size-4" />
              <span>Download</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
