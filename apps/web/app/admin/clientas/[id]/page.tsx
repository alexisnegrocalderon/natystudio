import { CustomerDetail } from "@/components/admin/CustomerDetail";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <CustomerDetail customerId={Number(id)} />;
}
