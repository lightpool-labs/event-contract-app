import AdminTabs from "@/components/AdminTabs";

type Tab = "token" | "event";

function parseTab(value?: string): Tab {
  if (value === "token") {
    return value;
  }
  return "event";
}

export default function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  return <AdminTabs activeTab={parseTab(searchParams.tab)} />;
}
