import { Link, createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/AuthCard";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · Task CRM" },
      {
        name: "description",
        content: "Sign in to Task CRM with your Google account to manage your team's tasks.",
      },
      { property: "og:title", content: "Sign in · Task CRM" },
      {
        property: "og:description",
        content: "Sign in to Task CRM with your Google account to manage your team's tasks.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <AuthCard
      heading="Sign in"
      subheading="Welcome back. Use the Google account you signed up with."
      buttonLabel="Continue with Google"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    />
  );
}
