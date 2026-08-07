import { Link, createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/AuthCard";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your account · Task CRM" },
      {
        name: "description",
        content:
          "Create a Task CRM account with Google and set up a workspace for your team in a minute.",
      },
      { property: "og:title", content: "Create your account · Task CRM" },
      {
        property: "og:description",
        content:
          "Create a Task CRM account with Google and set up a workspace for your team in a minute.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthCard
      heading="Create your account"
      subheading="Sign up with Google, then name your workspace. It takes about a minute."
      buttonLabel="Sign up with Google"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    />
  );
}
