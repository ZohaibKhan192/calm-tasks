import { Link, useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, ListChecks, Settings, UserPlus, Users, Copy } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return ref;
}

function OrgSwitcher() {
  const { orgs, org, setOrgId } = useOrg();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm font-medium text-foreground hover:bg-hover"
      >
        <span className="truncate">{org?.name ?? "No workspace"}</span>
        <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-md border border-border bg-surface p-1">
          {orgs.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setOrgId(o.id);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm text-foreground hover:bg-hover"
            >
              <span className="truncate">{o.name}</span>
              {o.id === org?.id && <Check size={14} className="text-muted-foreground" />}
            </button>
          ))}
          <Link
            to="/setup"
            onClick={() => setOpen(false)}
            className="block rounded-sm px-2 py-2 text-xs text-muted-foreground hover:bg-hover"
          >
            Create or join a workspace
          </Link>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  const name = (user?.user_metadata?.["full_name"] as string) ?? user?.email ?? "";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-md p-1 hover:bg-hover"
      >
        <Avatar
          name={name}
          email={user?.email}
          url={user?.user_metadata?.["avatar_url"] as string}
          size={24}
        />
        <ChevronDown size={14} className="text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-border bg-surface p-1">
          <div className="border-b border-border px-3 py-2">
            <div className="truncate text-sm text-foreground">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
          </div>
          <Link
            to="/dashboard/settings"
            onClick={() => setOpen(false)}
            className="block rounded-sm px-3 py-2 text-sm text-foreground hover:bg-hover"
          >
            Settings
          </Link>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/login" });
            }}
            className="block w-full rounded-sm px-3 py-2 text-left text-sm text-foreground hover:bg-hover"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function InvitePanel() {
  const { org } = useOrg();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div className="border-t border-border p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-hover"
      >
        <UserPlus size={16} className="text-muted-foreground" />
        Invite
      </button>
      {open && org && (
        <div className="mt-2 rounded-md border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">
            Share this workspace code. Teammates sign in, then join with the code.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-sm border border-border bg-surface px-2 py-1 text-xs text-foreground">
              {org.id}
            </code>
            <button
              type="button"
              aria-label="Copy workspace code"
              onClick={() => {
                void navigator.clipboard.writeText(org.id);
                setCopied(true);
              }}
              className="rounded-sm border border-border p-1 text-muted-foreground hover:bg-hover"
            >
              <Copy size={14} />
            </button>
          </div>
          {copied && <p className="mt-2 text-xs text-muted-foreground">Copied.</p>}
        </div>
      )}
    </div>
  );
}

const NAV = [
  { to: "/dashboard/tasks", label: "Tasks", icon: ListChecks },
  { to: "/dashboard/team", label: "Team", icon: Users },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { org } = useOrg();

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background px-6">
        <div className="flex items-center gap-8">
          <Link to="/dashboard/tasks" className="text-sm font-semibold text-foreground">
            Task CRM
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{org?.name}</span>
          <UserMenu />
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-14 z-10 flex w-[280px] flex-col border-r border-border bg-surface">
        <div className="border-b border-border p-3">
          <OrgSwitcher />
        </div>
        <nav className="flex-1 p-3">
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground hover:bg-hover"
                  activeProps={{ className: "bg-hover font-medium" }}
                >
                  <item.icon size={16} className="text-muted-foreground" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <InvitePanel />
      </aside>

      <main className="pl-[280px] pt-14">
        <div className="mx-auto max-w-[1400px] p-8">{children}</div>
      </main>
    </div>
  );
}
