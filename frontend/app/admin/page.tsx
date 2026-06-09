import AdminTabs from "@/components/AdminTabs";

type Tab = "token" | "market";

function parseTab(value?: string): Tab {
  if (value === "token") {
    return value;
  }
  return "market";
}

export default function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  return <AdminTabs activeTab={parseTab(searchParams.tab)} />;
}
