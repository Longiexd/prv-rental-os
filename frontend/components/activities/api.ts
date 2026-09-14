export { apiFetch as activityRequest } from "@/lib/api";

export function noteText(html: string | false) {
  return (html || "").replace(/<br\s*\/?\s*>|<\/p>/gi, "\n").replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'").replace(/&amp;/g, "&").trim();
}

export type Activity = {
  id: number; res_id: number; res_model?: string; res_name: string; summary: string | false; note: string | false;
  date_deadline: string; activity_type_id: [number, string] | false;
  activity_category: string; user_id: [number, string] | false; state: string;
};


export function activityHref(item: Activity) {
  return `${item.res_model === "sale.order" ? "/dashboard/rentals" : "/crm/leads"}/${item.res_id}?activity=${item.id}`;
}
