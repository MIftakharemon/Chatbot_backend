import LoginForm from "./login-form";

export const metadata = { title: "লগইন / Login" };

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const rawNext = searchParams?.next;
  const next = typeof rawNext === "string" && rawNext.startsWith("/") ? rawNext : "/dashboard";
  const error = typeof searchParams?.error === "string" ? searchParams.error : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <LoginForm next={next} error={error} />
    </main>
  );
}
