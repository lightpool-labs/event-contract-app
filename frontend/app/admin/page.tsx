import AdminTabs from "@/components/AdminTabs";

type Tab = "token" | "event" | "metadata";

function parseTab(value?: string): Tab {
  if (value === "token" || value === "event") {
    return value;
  }
  return "metadata";
}

export default function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  return <AdminTabs activeTab={parseTab(searchParams.tab)} />;
}
