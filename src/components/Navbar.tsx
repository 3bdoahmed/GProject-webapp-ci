import { useState, useEffect } from "react";
import { Menu, X, LogIn, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logoMark from "@/assets/logo-mark.png";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { key: "nav.home", href: "#home" },
    { key: "nav.about", href: "#about" },
    { key: "nav.features", href: "#features" },
    { key: "nav.team", href: "#team" },
    { key: "nav.contact", href: "#contact" },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }} animate={{ y: 0 }} transition={{ duration: 0.6 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled ? "glass-strong shadow-card py-2" : "bg-transparent py-4"
      }`}
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative">
              <div className="absolute inset-0 bg-accent/40 blur-xl group-hover:bg-accent/60 transition-all" />
              <img src={logoMark} alt="Logo" width={44} height={44}
                className="relative h-11 w-11 object-contain drop-shadow-lg" />
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1 glass rounded-full px-2 py-1.5">
            {navLinks.map((link, i) => (
              <motion.a key={link.key} href={link.href}
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full hover:bg-primary hover:text-primary-foreground transition-all"
              >{t(link.key)}</motion.a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            {user ? (
              <Link to="/dashboard">
                <Button size="sm" className="hidden sm:inline-flex gap-2 gradient-hero border-0 shadow-glow text-primary-foreground rounded-full px-5">
                  <LayoutDashboard className="h-4 w-4" /> {t("nav.dashboard")}
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button size="sm" className="hidden sm:inline-flex gap-2 gradient-hero border-0 shadow-glow text-primary-foreground rounded-full px-5">
                  <LogIn className="h-4 w-4" /> {t("nav.signin")}
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden">
              <div className="py-4 space-y-1 mt-2 glass-strong rounded-2xl px-2">
                {navLinks.map((link) => (
                  <a key={link.key} href={link.href}
                    className="block py-3 px-4 text-sm font-medium rounded-lg hover:bg-primary/10"
                    onClick={() => setIsOpen(false)}>{t(link.key)}</a>
                ))}
                <Link to={user ? "/dashboard" : "/auth"}>
                  <Button size="sm" className="w-full mt-3 gradient-hero border-0 text-primary-foreground">
                    {user ? t("nav.dashboard") : t("nav.signin")}
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
}
