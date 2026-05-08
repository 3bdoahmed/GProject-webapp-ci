import { useEffect, useState } from "react";
import { Loader2, Upload, Save, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

const Field = ({ label, value, onChange, max = 100, type = "text" }: any) => (
  <div>
    <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} maxLength={max}
      className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm focus:ring-2 focus:ring-ring focus:outline-none" />
  </div>
);

export default function Settings() {
  const { user } = useAuth(); const { toast } = useToast(); const { t } = useLanguage();
  const [fullName, setFullName] = useState(""); const [bio, setBio] = useState("");
  const [phone, setPhone] = useState(""); const [position, setPosition] = useState("");
  const [department, setDepartment] = useState(""); const [country, setCountry] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false); const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState(""); const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from("profiles").select("*").eq("id", user.id).maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setFullName(data.full_name || ""); setBio(data.bio || "");
          setAvatarUrl(data.avatar_url); setPhone(data.phone || "");
          setPosition(data.position || ""); setDepartment(data.department || "");
          setCountry(data.country || "");
        }
      });
  }, [user]);

  const uploadAvatar = async (file: File) => {
    if (!user) return; setUploading(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const safeExt = ext || "png";
    const path = `${user.id}/${Date.now()}.${safeExt}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast({ variant: "destructive", title: error.message }); setUploading(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    const { error: updErr } = await (supabase as any).rpc("update_my_avatar", {
      _user_id: user.id, _url: data.publicUrl,
    });
    if (updErr) toast({ variant: "destructive", title: updErr.message });
    else toast({ title: t("set.avatar.updated") });
    setUploading(false);
  };

  const save = async () => {
    if (!user) return; setSaving(true);
    const { error } = await (supabase as any).rpc("update_my_profile", {
      _user_id: user.id,
      _full_name: fullName, _bio: bio, _phone: phone,
      _position: position, _department: department, _country: country,
    });
    if (error) toast({ variant: "destructive", title: error.message });
    else toast({ title: t("set.profile.updated") });
    setSaving(false);
  };

  const changePassword = async () => {
    if (newPassword.length < 6) return toast({ variant: "destructive", title: t("set.pw.min") });
    if (!user) return;
    setPwLoading(true);
    const { error } = await (supabase as any).rpc("change_my_password", {
      _user_id: user.id, _new_password: newPassword,
    });
    if (error) toast({ variant: "destructive", title: error.message });
    else { toast({ title: t("set.pw.updated") }); setNewPassword(""); }
    setPwLoading(false);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div><h1 className="text-3xl font-black mb-1">{t("set.title")}</h1><p className="text-muted-foreground text-sm">{t("set.sub")}</p></div>

      <div className="glass rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-5">
          {avatarUrl ? <img src={avatarUrl} className="w-20 h-20 rounded-full object-cover border-2 border-border" alt="" /> :
            <div className="w-20 h-20 rounded-full gradient-hero flex items-center justify-center text-primary-foreground text-2xl font-black">{(fullName || user?.email || "U")[0].toUpperCase()}</div>}
          <label className="cursor-pointer px-4 py-2.5 rounded-xl border border-border text-sm font-semibold flex items-center gap-2 hover:bg-muted transition-smooth">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {t("set.upload")}
            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t("set.fullname")} value={fullName} onChange={setFullName} />
          <Field label={t("set.phone")} value={phone} onChange={setPhone} max={30} />
          <Field label={t("set.position")} value={position} onChange={setPosition} max={80} />
          <Field label={t("set.department")} value={department} onChange={setDepartment} max={80} />
          <Field label={t("set.country")} value={country} onChange={setCountry} max={50} />
          <div>
            <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">{t("set.email")}</label>
            <input value={user?.email || ""} disabled className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-sm text-muted-foreground" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">{t("set.bio")}</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={500} rows={3}
            className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm focus:ring-2 focus:ring-ring focus:outline-none resize-none" />
        </div>

        <button onClick={save} disabled={saving} className="px-5 py-3 rounded-xl gradient-hero text-primary-foreground font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-smooth">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("set.save")}
        </button>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" /><h2 className="font-bold">{t("set.changepw")}</h2></div>
        <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder={t("set.newpw")}
          className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm focus:ring-2 focus:ring-ring focus:outline-none" />
        <button onClick={changePassword} disabled={pwLoading} className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold flex items-center gap-2 hover:bg-muted transition-smooth">
          {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("set.updatepw")}
        </button>
      </div>
    </div>
  );
}
