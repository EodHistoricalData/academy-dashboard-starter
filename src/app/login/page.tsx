import { LoginForm } from "@/app/login/LoginForm";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Market tool starter" };

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 sm:py-14">
      <main className="mx-auto flex w-full max-w-sm flex-col gap-8">
        <header className="flex flex-col gap-1">
          <Nav here="/login" />
          <h1 className="mt-4 text-lg font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            One owner. Your saved screens, shortlist, notes and layouts are kept
            on the server under your sign-in.
          </p>
        </header>
        <LoginForm />
      </main>
    </div>
  );
}
