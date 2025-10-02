"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PrivacyContent } from "@/components/legal/PrivacyContent";
import { TermsContent } from "@/components/legal/TermsContent";

export const Footer = () => {
  const year = new Date().getFullYear();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <footer className="border-t border-border bg-background/90">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Split4me</p>
          <p className="max-w-md">
            Split bills fairly across Southeast Asia. Built with privacy in mind; everything stays on your device.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setPrivacyOpen(true)}
            className="transition hover:text-foreground hover:underline"
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="transition hover:text-foreground hover:underline"
          >
            Terms of Use
          </button>
        </div>
        <p className="text-xs sm:text-right">
          © {year} Split4me. All rights reserved.
        </p>
      </div>

      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Privacy Policy</DialogTitle>
            <DialogDescription>
              Split4me keeps your receipts and people list on your device. Review the details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pr-1">
            <PrivacyContent />
          </div>
          <DialogFooter className="flex justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Terms of Use</DialogTitle>
            <DialogDescription>
              Understand your responsibilities and how Split4me is provided.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pr-1">
            <TermsContent />
          </div>
          <DialogFooter className="flex justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </footer>
  );
};
