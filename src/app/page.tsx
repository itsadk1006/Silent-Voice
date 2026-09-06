import SignLanguageTranslator from "@/components/SignLanguageTranslator";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8 sm:p-24 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-50">
      <SignLanguageTranslator />
    </main>
  );
}
