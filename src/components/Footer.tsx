import { Github, Linkedin, Mail } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import logoMark from "@/assets/logo-mark.png";

export function Footer() {
  const { t } = useLanguage();
  const socialLinks = [
    { icon: Linkedin, href: "#", label: "LinkedIn" },
    { icon: Github, href: "#", label: "GitHub" },
    { icon: Mail, href: "mailto:team@smartsolar.edu", label: "Email" },
  ];
  const navLinks = [
    { k: "footer.link.home", href: "#home" },
    { k: "footer.link.project", href: "#about" },
    { k: "footer.link.team", href: "#team" },
    { k: "footer.link.features", href: "#features" },
  ];

  return (
    <footer id="contact" className="relative overflow-hidden">
      <div className="h-px w-full gradient-hero opacity-30" />
      <div className="py-16 relative">
        <div className="absolute inset-0 gradient-mesh pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-12 mb-12">
              <div>
                <a href="#home" className="flex items-center mb-4 group">
                  <img src={logoMark} alt="Logo" className="h-12 w-12 object-contain" />
                </a>
                <p className="text-sm text-muted-foreground leading-relaxed">{t("footer.tagline")}</p>
              </div>
              <div>
                <h4 className="font-bold text-sm uppercase tracking-widest mb-4 text-primary">{t("footer.quick")}</h4>
                <div className="space-y-2">
                  {navLinks.map(link => (
                    <a key={link.k} href={link.href} className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                      {t(link.k)}
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-bold text-sm uppercase tracking-widest mb-4 text-primary">{t("footer.connect")}</h4>
                <div className="flex gap-3">
                  {socialLinks.map((link, i) => (
                    <a key={i} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label}
                      className="w-10 h-10 rounded-xl glass-card flex items-center justify-center hover:gradient-hero hover:shadow-glow hover:text-primary-foreground transition-all duration-300 hover:scale-110">
                      <link.icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  {t("footer.faculty")}<br />{t("footer.university")}
                </p>
              </div>
            </div>

            <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {t("footer.copyright")}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap justify-center">
                {t("footer.designed")} <span className="font-bold text-primary">Eslam Shaban Gomaa</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
