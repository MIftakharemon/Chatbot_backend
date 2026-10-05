import type { OrderStatus } from "@/lib/types"

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "পেন্ডিং",
  confirmed: "কনফার্মড",
  shipped: "শিপড",
  delivered: "ডেলিভারড",
  cancelled: "বাতিল",
}

export const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "পেন্ডিং / Pending" },
  { value: "confirmed", label: "কনফার্মড / Confirmed" },
  { value: "shipped", label: "শিপড / Shipped" },
  { value: "delivered", label: "ডেলিভারড / Delivered" },
  { value: "cancelled", label: "বাতিল / Cancelled" },
]

export const money = (n: number | string) => `৳${Number(n || 0).toLocaleString("en-BD")}`

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-BD", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
