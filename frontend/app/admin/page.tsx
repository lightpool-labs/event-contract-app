import AdminTabs from "@/components/AdminTabs";

type Tab = "token" | "market";

function parseTab(value?: string): Tab {
  if (value === "market") {
    return value;
  }
  return "token";
}

export default function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  return <AdminTabs activeTab={parseTab(searchParams.tab)} />;
}
