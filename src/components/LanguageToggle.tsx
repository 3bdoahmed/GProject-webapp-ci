import { Languages } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <Button
      variant="ghost" size="icon"
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
      aria-label="Toggle language"
      className="rounded-full"
      title={lang === "en" ? "العربية" : "English"}
    >
      <span className="text-xs font-black">{lang === "en" ? "ع" : "EN"}</span>
    </Button>
  );
}