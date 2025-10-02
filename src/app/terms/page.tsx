import { TermsContent } from "@/components/legal/TermsContent";

export const metadata = {
  title: "Split4me – Terms",
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6 lg:px-10">
      <h1 className="text-3xl font-semibold">Terms of Use</h1>
      <TermsContent />
    </main>
  );
}
