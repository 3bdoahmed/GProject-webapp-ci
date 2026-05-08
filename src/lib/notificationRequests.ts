const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export type DashboardNotification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  related_id: string | null;
  kind: string;
  is_read: boolean;
  created_at: string;
  user_id: string;
};

const authHeaders = (accessToken: string) => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
});

export async function fetchNotifications(userId: string, accessToken: string) {
  const params = new URLSearchParams({
    select: "*",
    user_id: `eq.${userId}`,
    order: "created_at.desc",
    limit: "200",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications?${params}`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as DashboardNotification[];
}

export async function fetchUnreadNotificationsCount(userId: string, accessToken: string) {
  const params = new URLSearchParams({
    select: "id",
    user_id: `eq.${userId}`,
    is_read: "eq.false",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications?${params}`, {
    method: "HEAD",
    headers: {
      ...authHeaders(accessToken),
      Prefer: "count=exact",
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return Number(res.headers.get("content-range")?.split("/").pop() || 0);
}

export async function markNotificationsRead(userId: string, accessToken: string) {
  const params = new URLSearchParams({ user_id: `eq.${userId}`, is_read: "eq.false" });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications?${params}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(accessToken),
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ is_read: true }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function markNotificationRead(id: string, accessToken: string) {
  const params = new URLSearchParams({ id: `eq.${id}` });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications?${params}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(accessToken),
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ is_read: true }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteNotification(id: string, accessToken: string) {
  const params = new URLSearchParams({ id: `eq.${id}` });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications?${params}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(accessToken),
      Prefer: "return=minimal",
    },
  });
  if (!res.ok) throw new Error(await res.text());
}