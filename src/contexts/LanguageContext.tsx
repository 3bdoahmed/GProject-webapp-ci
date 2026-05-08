import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Lang = "en" | "ar";
type Dict = Record<string, { en: string; ar: string }>;

const dict: Dict = {
  // Nav
  "nav.home": { en: "Home", ar: "الرئيسية" },
  "nav.about": { en: "Overview", ar: "نظرة عامة" },
  "nav.flow": { en: "System", ar: "النظام" },
  "nav.features": { en: "Features", ar: "المميزات" },
  "nav.team": { en: "Team", ar: "الفريق" },
  "nav.contact": { en: "Contact", ar: "تواصل" },
  "nav.signin": { en: "Sign In", ar: "تسجيل الدخول" },
  "nav.dashboard": { en: "Dashboard", ar: "لوحة التحكم" },

  // Hero
  "hero.badge": { en: "Faculty of Engineering · Minia University", ar: "كلية الهندسة · جامعة المنيا" },
  "hero.title.smart": { en: "Smart", ar: "ذكية" },
  "hero.title.energy": { en: "Energy", ar: "طاقة" },
  "hero.title.monitoring": { en: "Monitoring &", ar: "مراقبة و" },
  "hero.title.operation": { en: "Operation System", ar: "تشغيل النظام" },
  "hero.sub": {
    en: "An IoT-powered platform that monitors, analyzes and operates solar power systems in real time — from the panel to the cloud, with AI insights and enterprise-grade network security.",
    ar: "منصة مدعومة بإنترنت الأشياء لمراقبة وتحليل وتشغيل أنظمة الطاقة الشمسية في الوقت الحقيقي — من اللوح الشمسي إلى السحابة، مع رؤى الذكاء الاصطناعي وأمان شبكة بمستوى المؤسسات."
  },
  "hero.cta.launch": { en: "Launch Dashboard", ar: "افتح لوحة التحكم" },
  "hero.cta.how": { en: "See How It Works", ar: "شاهد كيف يعمل" },
  "hero.pill.live": { en: "Live Telemetry", ar: "بيانات لحظية" },
  "hero.pill.cloud": { en: "AWS Cloud Sync", ar: "مزامنة AWS السحابية" },
  "hero.pill.iot": { en: "IoT Edge Devices", ar: "أجهزة إنترنت الأشياء" },
  "hero.pill.alerts": { en: "Smart Alerts", ar: "تنبيهات ذكية" },
  "hero.pill.security": { en: "Enterprise Security", ar: "أمان مؤسسي" },
  "hero.pill.ai": { en: "AI Insights", ar: "رؤى الذكاء الاصطناعي" },
  "hero.float.live": { en: "Live", ar: "مباشر" },
  "hero.float.ai": { en: "AI", ar: "الذكاء" },
  "hero.float.healthy": { en: "All Healthy", ar: "النظام سليم" },
  "hero.dashboard.alt": { en: "Smart Solar dashboard preview", ar: "معاينة لوحة تحكم الطاقة الشمسية الذكية" },

  // About
  "about.tag": { en: "About the Project", ar: "عن المشروع" },
  "about.title1": { en: "Engineering the", ar: "نهندس" },
  "about.title2": { en: "Future of Energy", ar: "مستقبل الطاقة" },
  "about.desc": {
    en: "A unified smart system that fuses IoT, AI and embedded tech to monitor solar stations in real time.",
    ar: "نظام ذكي موحّد يدمج إنترنت الأشياء والذكاء الاصطناعي والأنظمة المدمجة لمراقبة محطات الطاقة الشمسية لحظياً."
  },
  "about.short": {
    en: "A unified smart system that fuses IoT, AI and embedded tech to monitor solar stations in real time.",
    ar: "نظام ذكي موحّد يدمج إنترنت الأشياء والذكاء الاصطناعي والأنظمة المدمجة لمراقبة محطات الطاقة الشمسية لحظياً."
  },
  "about.excellence": { en: "Engineering Excellence", ar: "تميّز هندسي" },
  "about.live": { en: "Live Dashboard", ar: "لوحة تحكم مباشرة" },
  "about.live.sub": { en: "Real-time monitoring interface", ar: "واجهة مراقبة في الوقت الحقيقي" },
  "about.f1.title": { en: "IoT Integration", ar: "تكامل إنترنت الأشياء" },
  "about.f1.desc": { en: "Real-time sensor data collection and device control", ar: "جمع بيانات المستشعرات والتحكم في الأجهزة لحظياً" },
  "about.f2.title": { en: "AI-Powered", ar: "مدعوم بالذكاء الاصطناعي" },
  "about.f2.desc": { en: "Smart predictions and fault detection algorithms", ar: "توقعات ذكية وخوارزميات اكتشاف الأعطال" },
  "about.f3.title": { en: "Cloud Connected", ar: "متصل بالسحابة" },
  "about.f3.desc": { en: "Secure cloud storage and remote monitoring", ar: "تخزين سحابي آمن ومراقبة عن بُعد" },
  "about.f4.title": { en: "Secure System", ar: "نظام آمن" },
  "about.f4.desc": { en: "End-to-end encryption and protected communication", ar: "تشفير شامل واتصالات محمية" },

  // Flow
  "flow.tag": { en: "How It Works", ar: "كيف يعمل" },
  "flow.title1": { en: "System", ar: "تدفق" },
  "flow.title2": { en: "Flow", ar: "النظام" },
  "flow.desc": { en: "From solar panels to your dashboard — seamless data flow", ar: "من الألواح الشمسية إلى لوحة التحكم — تدفق بيانات سلس" },
  "flow.s1.title": { en: "Solar Panels", ar: "ألواح شمسية" },
  "flow.s1.desc": { en: "Energy generation", ar: "توليد الطاقة" },
  "flow.s2.title": { en: "Sensors", ar: "مستشعرات" },
  "flow.s2.desc": { en: "Data collection", ar: "جمع البيانات" },
  "flow.s3.title": { en: "IoT Gateway", ar: "بوابة إنترنت الأشياء" },
  "flow.s3.desc": { en: "Transmission", ar: "النقل" },
  "flow.s4.title": { en: "Cloud", ar: "السحابة" },
  "flow.s4.desc": { en: "Processing", ar: "المعالجة" },
  "flow.s5.title": { en: "Dashboard", ar: "لوحة التحكم" },
  "flow.s5.desc": { en: "Monitoring", ar: "المراقبة" },

  // Team
  "team.tag": { en: "Meet The Team", ar: "تعرّف على الفريق" },
  "team.title1": { en: "The Minds", ar: "العقول" },
  "team.title2": { en: "Behind It", ar: "وراء المشروع" },
  "team.supervisor": { en: "Supervisor", ar: "المشرف" },
  "team.members": { en: "Team Members", ar: "أعضاء الفريق" },
  "team.role.supervisor": { en: "Project Supervisor", ar: "مشرفة المشروع" },
  "team.role.web": { en: "Full-Stack Web & Cloud Developer", ar: "مطوّر ويب فول-ستاك وكلاود" },
  "team.role.embedded": { en: "Network & Cybersecurity Engineer", ar: "مهندس الشبكات والأمن السيبراني" },
  "team.role.security": { en: "Network & Cybersecurity Engineer", ar: "مهندس الشبكات والأمن السيبراني" },
  "team.role.cloud": { en: "DevOps & Cloud Engineer", ar: "مهندس DevOps والسحابة" },
  "team.role.control": { en: "Solar Hardware", ar: "هاردوير الطاقة الشمسية" },
  "team.role.networks": { en: "Networks", ar: "الشبكات" },

  // Features
  "features.tag": { en: "Capabilities", ar: "الإمكانيات" },
  "features.title1": { en: "Key", ar: "أبرز" },
  "features.title2": { en: "Features", ar: "المميزات" },
  "features.desc": { en: "Everything you need to monitor, analyze and operate a modern solar plant.", ar: "كل ما تحتاجه لمراقبة وتحليل وتشغيل محطة طاقة شمسية حديثة." },
  "features.f1.title": { en: "Real-time Monitoring", ar: "مراقبة في الوقت الحقيقي" },
  "features.f1.desc": { en: "Track voltage, current, power & temperature live across all branches.", ar: "تتبع الجهد والتيار والقدرة ودرجة الحرارة لحظياً عبر جميع الفروع." },
  "features.f2.title": { en: "Data Analytics & Insights", ar: "تحليلات ورؤى البيانات" },
  "features.f2.desc": { en: "Per-panel power, efficiency evaluation, fault detection & cost reports.", ar: "قدرة كل لوح، تقييم الكفاءة، اكتشاف الأعطال وتقارير التكلفة." },
  "features.f3.title": { en: "Smart Email Alerts", ar: "تنبيهات بريد ذكية" },
  "features.f3.desc": { en: "Instant notifications when battery drops, panels overheat or inverters fail.", ar: "إشعارات فورية عند هبوط البطارية أو ارتفاع حرارة الألواح أو تعطل المحولات." },
  "features.f4.title": { en: "AI Assistant", ar: "مساعد الذكاء الاصطناعي" },
  "features.f4.desc": { en: "Ask anything about your system — total power, panel efficiency, battery state.", ar: "اسأل أي شيء عن نظامك — إجمالي القدرة، كفاءة الألواح، حالة البطارية." },
  "features.f5.title": { en: "Secure Network", ar: "شبكة آمنة" },
  "features.f5.desc": { en: "Next-gen Fortinet firewalls, Active Directory & access dashboard.", ar: "جدران حماية Fortinet متطورة وActive Directory ولوحة وصول." },
  "features.f6.title": { en: "AWS Cloud Backbone", ar: "بنية AWS السحابية" },
  "features.f6.desc": { en: "S3, DynamoDB and real-time processing — secure, scalable, reliable.", ar: "S3 وDynamoDB ومعالجة لحظية — آمنة وقابلة للتوسع وموثوقة." },
  "features.f7.title": { en: "Automatic Data Backup", ar: "نسخ احتياطي تلقائي" },
  "features.f7.desc": { en: "Each branch's data is mirrored to the Control Center S3 bucket automatically.", ar: "تُنسخ بيانات كل فرع تلقائياً إلى مخزن S3 لمركز التحكم." },
  "features.f8.title": { en: "Hardware Module (IoT)", ar: "وحدة عتاد (IoT)" },
  "features.f8.desc": { en: "Mini solar panel, V/A & temperature sensors, microcontroller, Wi-Fi.", ar: "لوح شمسي مصغر، مستشعرات جهد وتيار وحرارة، متحكم دقيق، واي فاي." },
  "features.f9.title": { en: "Clean Energy Future", ar: "مستقبل طاقة نظيفة" },
  "features.f9.desc": { en: "Reduce downtime, lower maintenance cost, support green energy transition.", ar: "تقليل التوقف وخفض تكلفة الصيانة ودعم التحول للطاقة الخضراء." },
  "features.audience.plants": { en: "Solar Power Plants", ar: "محطات الطاقة الشمسية" },
  "features.audience.factories": { en: "Factories & Industries", ar: "المصانع والصناعات" },
  "features.audience.farms": { en: "Farms & Small Businesses", ar: "المزارع والأعمال الصغيرة" },

  // Contact
  "contact.tag": { en: "Get In Touch", ar: "تواصل معنا" },
  "contact.title1": { en: "Contact", ar: "تواصل" },
  "contact.title2": { en: "Us", ar: "معنا" },
  "contact.desc": { en: "Have questions about our project? We'd love to hear from you.", ar: "لديك أسئلة حول مشروعنا؟ يسعدنا سماع رأيك." },
  "contact.info.email": { en: "Email", ar: "البريد الإلكتروني" },
  "contact.info.location": { en: "Location", ar: "الموقع" },
  "contact.info.location.value": { en: "Minia University, Egypt", ar: "جامعة المنيا، مصر" },
  "contact.info.phone": { en: "Phone", ar: "الهاتف" },
  "contact.bio": { en: "We're a team of engineering students at Minia University working on innovative IoT & AI solutions for solar energy management.", ar: "نحن فريق من طلاب الهندسة بجامعة المنيا نعمل على حلول مبتكرة لإدارة الطاقة الشمسية باستخدام إنترنت الأشياء والذكاء الاصطناعي." },
  "contact.form.name": { en: "Name", ar: "الاسم" },
  "contact.form.name.ph": { en: "Your name", ar: "اسمك" },
  "contact.form.email": { en: "Email", ar: "البريد الإلكتروني" },
  "contact.form.email.ph": { en: "your@email.com", ar: "your@email.com" },
  "contact.form.message": { en: "Message", ar: "الرسالة" },
  "contact.form.message.ph": { en: "Write your message...", ar: "اكتب رسالتك..." },
  "contact.form.send": { en: "Send Message", ar: "إرسال الرسالة" },
  "contact.toast.title": { en: "Message sent!", ar: "تم إرسال الرسالة!" },
  "contact.toast.desc": { en: "We received your message and will get back to you soon.", ar: "استلمنا رسالتك وسنرد عليك قريباً." },
  "contact.toast.invalid": { en: "Invalid input", ar: "بيانات غير صحيحة" },
  "contact.toast.error": { en: "Failed to send", ar: "تعذر الإرسال" },

  // Footer
  "footer.tagline": { en: "An intelligent IoT & AI platform for solar power management.", ar: "منصة ذكية لإدارة الطاقة الشمسية بإنترنت الأشياء والذكاء الاصطناعي." },
  "footer.quick": { en: "Quick Links", ar: "روابط سريعة" },
  "footer.connect": { en: "Connect", ar: "تواصل" },
  "footer.faculty": { en: "Faculty of Engineering", ar: "كلية الهندسة" },
  "footer.university": { en: "Minia University", ar: "جامعة المنيا" },
  "footer.copyright": { en: "Smart Energy Monitoring & Operation System. All rights reserved.", ar: "نظام مراقبة وتشغيل الطاقة الذكي. جميع الحقوق محفوظة." },
  "footer.designed": { en: "Designed by", ar: "تصميم" },
  "footer.link.home": { en: "Home", ar: "الرئيسية" },
  "footer.link.project": { en: "Project", ar: "المشروع" },
  "footer.link.flow": { en: "Flow", ar: "التدفق" },
  "footer.link.team": { en: "Team", ar: "الفريق" },
  "footer.link.features": { en: "Features", ar: "المميزات" },

  // Chat widget
  "chat.greeting": { en: "👋 Hi! I'm **SolarBot**. How can I help you today?", ar: "👋 أهلاً! أنا **SolarBot**. كيف أقدر أساعدك؟" },
  "chat.title": { en: "SolarBot Assistant", ar: "مساعد SolarBot" },
  "chat.online": { en: "Always online · AR / EN", ar: "متاح دائماً · عربي / إنجليزي" },
  "chat.placeholder": { en: "Ask anything about the project…", ar: "اسأل أي حاجة عن المشروع…" },
  "chat.error": { en: "Something went wrong, try again.", ar: "حصل خطأ، جرب تاني." },
  "chat.network": { en: "Network error. Try again.", ar: "خطأ في الشبكة، حاول مرة أخرى." },

  // Auth
  "auth.welcome": { en: "Welcome back", ar: "أهلاً بعودتك" },
  "auth.create": { en: "Create account", ar: "إنشاء حساب" },
  "auth.signin": { en: "Sign In", ar: "تسجيل الدخول" },
  "auth.signup": { en: "Sign Up", ar: "إنشاء حساب" },
  "auth.email": { en: "Email", ar: "البريد الإلكتروني" },
  "auth.password": { en: "Password (min 6 chars)", ar: "كلمة المرور (6 أحرف على الأقل)" },
  "auth.fullname": { en: "Full name", ar: "الاسم الكامل" },
  "auth.phone": { en: "Phone", ar: "الهاتف" },
  "auth.country": { en: "Country", ar: "الدولة" },
  "auth.position": { en: "Position", ar: "المنصب" },
  "auth.department": { en: "Department", ar: "القسم" },
  "auth.forgot": { en: "Forgot password?", ar: "نسيت كلمة المرور؟" },
  "auth.signin.sub": { en: "Sign in to access the dashboard", ar: "سجّل الدخول للوصول إلى لوحة التحكم" },
  "auth.signup.sub": { en: "Create your account to get started.", ar: "أنشئ حسابك للبدء." },
  "auth.created": { en: "Account created", ar: "تم إنشاء الحساب" },
  "auth.error": { en: "Auth error", ar: "خطأ في المصادقة" },

  // Forgot/Reset
  "forgot.title": { en: "Reset password", ar: "استعادة كلمة المرور" },
  "forgot.desc": { en: "Enter your email and we'll send a reset link.", ar: "أدخل بريدك وسنرسل لك رابط إعادة التعيين." },
  "forgot.send": { en: "Send reset link", ar: "إرسال رابط الاستعادة" },
  "forgot.check": { en: "Check your inbox", ar: "تحقق من بريدك" },
  "forgot.sent": { en: "We sent a reset link to", ar: "أرسلنا رابط إعادة التعيين إلى" },
  "forgot.back": { en: "Back to sign in", ar: "العودة لتسجيل الدخول" },
  "reset.title": { en: "Set new password", ar: "تعيين كلمة مرور جديدة" },
  "reset.choose": { en: "Choose a strong password.", ar: "اختر كلمة مرور قوية." },
  "reset.validating": { en: "Validating reset link...", ar: "جارٍ التحقق من الرابط..." },
  "reset.new": { en: "New password", ar: "كلمة المرور الجديدة" },
  "reset.confirm": { en: "Confirm password", ar: "تأكيد كلمة المرور" },
  "reset.update": { en: "Update password", ar: "تحديث كلمة المرور" },
  "reset.mismatch": { en: "Passwords don't match", ar: "كلمتا المرور غير متطابقتين" },
  "reset.updated": { en: "Password updated", ar: "تم تحديث كلمة المرور" },

  // Dashboard layout
  "dash.control": { en: "Control Panel", ar: "لوحة التحكم" },
  "dash.workspace": { en: "Workspace", ar: "مساحة العمل" },
  "dash.signout": { en: "Sign out", ar: "تسجيل الخروج" },
  "dash.brand": { en: "Smart Energy", ar: "الطاقة الذكية" },
  "dash.brand.sub": { en: "Monitoring System", ar: "نظام المراقبة" },
  "dash.menu.overview": { en: "Overview", ar: "نظرة عامة" },
  "dash.menu.team": { en: "Team", ar: "الفريق" },
  "dash.menu.messages": { en: "Messages", ar: "الرسائل" },
  "dash.menu.notifications": { en: "Notifications", ar: "الإشعارات" },
 "dash.menu.weather": { en: "Weather", ar: "الطقس" },
 "dash.menu.batteries": { en: "Batteries", ar: "البطاريات" },
 "dash.menu.inverters": { en: "Inverters", ar: "المحولات" },
"dash.menu.realtime": { en: "Real-Time", ar: "المراقبة اللحظية" },
"dash.menu.reports": { en: "Reports", ar: "التقارير" },
  "dash.menu.notes": { en: "Notes", ar: "الملاحظات" },
  "dash.menu.assistant": { en: "AI Assistant", ar: "مساعد AI" },
  "dash.menu.settings": { en: "Settings", ar: "الإعدادات" },

  // Messages page
  "msg.title": { en: "Messages", ar: "الرسائل" },
  "msg.sub": { en: "Inbox from the contact form", ar: "الوارد من نموذج التواصل" },
  "msg.unread": { en: "unread", ar: "غير مقروءة" },
  "msg.empty": { en: "No messages yet.", ar: "لا توجد رسائل بعد." },
  "msg.loading": { en: "Loading...", ar: "جارٍ التحميل..." },
  "msg.new": { en: "New", ar: "جديد" },
  "msg.markread": { en: "Mark as read", ar: "تعليم كمقروء" },
  "msg.delete": { en: "Delete", ar: "حذف" },
  "msg.view": { en: "View details", ar: "عرض التفاصيل" },
  "msg.reply": { en: "Reply via email", ar: "الرد بالبريد" },

  // Notifications
  "notif.title": { en: "Notifications", ar: "الإشعارات" },
  "notif.unread": { en: "unread", ar: "غير مقروء" },
  "notif.markall": { en: "Mark all as read", ar: "تعليم الكل كمقروء" },
  "notif.empty": { en: "You're all caught up.", ar: "لا توجد إشعارات." },
  "notif.filter.all": { en: "All", ar: "الكل" },
  "notif.filter.unread": { en: "Unread", ar: "غير المقروء" },

  // Overview
  "ov.welcome": { en: "Welcome back 👋", ar: "أهلاً بعودتك 👋" },
  "ov.sub": { en: "Here's what's happening across your solar plant.", ar: "إليك ما يحدث في محطتك الشمسية." },
  "ov.stat.power": { en: "Total Power", ar: "إجمالي القدرة" },
  "ov.stat.energy": { en: "Energy Today", ar: "طاقة اليوم" },
  "ov.stat.eff": { en: "Efficiency", ar: "الكفاءة" },
  "ov.stat.batt": { en: "Battery SOC", ar: "حالة البطارية" },
  "ov.stat.stable": { en: "stable", ar: "ثابت" },
  "ov.panels": { en: "Solar Panels Status", ar: "حالة الألواح الشمسية" },
  "ov.alerts": { en: "System Alerts", ar: "تنبيهات النظام" },
  "ov.alert1": { en: "Battery 2 Low Voltage", ar: "البطارية 2 جهد منخفض" },
  "ov.alert2": { en: "Panel 3 High Temp", ar: "اللوح 3 حرارة مرتفعة" },
  "ov.alert3": { en: "All Systems Normal", ar: "كل الأنظمة طبيعية" },

  // Team page
  "tp.title": { en: "Team", ar: "الفريق" },
  "tp.sub": { en: "All registered members.", ar: "كل الأعضاء المسجلين." },
  "tp.empty": { en: "No members yet.", ar: "لا يوجد أعضاء بعد." },
  "tp.removed": { en: "Profile removed", ar: "تم حذف الحساب" },
  "tp.delete.title": { en: "Delete my profile", ar: "حذف ملفي الشخصي" },

  // Settings
  "set.title": { en: "Settings", ar: "الإعدادات" },
  "set.sub": { en: "Manage your profile and account.", ar: "إدارة ملفك الشخصي وحسابك." },
  "set.upload": { en: "Upload photo", ar: "رفع صورة" },
  "set.fullname": { en: "Full name", ar: "الاسم الكامل" },
  "set.phone": { en: "Phone", ar: "الهاتف" },
  "set.position": { en: "Position", ar: "المنصب" },
  "set.department": { en: "Department", ar: "القسم" },
  "set.country": { en: "Country", ar: "الدولة" },
  "set.email": { en: "Email", ar: "البريد الإلكتروني" },
  "set.bio": { en: "Bio", ar: "نبذة" },
  "set.save": { en: "Save changes", ar: "حفظ التغييرات" },
  "set.changepw": { en: "Change password", ar: "تغيير كلمة المرور" },
  "set.newpw": { en: "New password (min 6)", ar: "كلمة مرور جديدة (6+)" },
  "set.updatepw": { en: "Update password", ar: "تحديث كلمة المرور" },
  "set.avatar.updated": { en: "Avatar updated", ar: "تم تحديث الصورة" },
  "set.profile.updated": { en: "Profile updated", ar: "تم تحديث الملف" },
  "set.pw.updated": { en: "Password updated", ar: "تم تحديث كلمة المرور" },
  "set.pw.min": { en: "Min 6 characters", ar: "6 أحرف على الأقل" },

  // Assistant
  "as.title": { en: "AI Assistant", ar: "مساعد الذكاء الاصطناعي" },
  "as.sub": { en: "Trained on the Smart Solar project — ask in Arabic or English.", ar: "مدرّب على مشروع الطاقة الشمسية الذكية — اسأل بالعربية أو الإنجليزية." },
  "as.greeting": { en: "Hi! I'm SolarBot 🤖 — ask me anything about the Smart Solar project, the team, or how the system works.", ar: "أهلاً! أنا SolarBot 🤖 — اسألني أي شيء عن مشروع الطاقة الشمسية الذكية أو الفريق أو كيفية عمل النظام." },
  "as.placeholder": { en: "Ask anything...", ar: "اسأل أي شيء..." },
  "as.error": { en: "Sorry, something went wrong.", ar: "عذراً، حدث خطأ ما." },

  // Notes
  "notes.title": { en: "Team Notes", ar: "ملاحظات الفريق" },
  "notes.sub": { en: "Share updates, maintenance logs and ideas — everyone gets notified instantly.", ar: "شارك التحديثات وسجلات الصيانة والأفكار — يصل الإشعار للجميع فوراً." },
  "notes.title.ph": { en: "Note title", ar: "عنوان الملاحظة" },
  "notes.content.ph": { en: "Write your note...", ar: "اكتب ملاحظتك..." },
  "notes.publish": { en: "Publish", ar: "نشر" },
  "notes.empty": { en: "No notes yet — be the first to share.", ar: "لا توجد ملاحظات بعد — كن أول من يشارك." },
  "notes.filter.all": { en: "All", ar: "الكل" },
  "notes.cat.general": { en: "General", ar: "عام" },
  "notes.cat.maintenance": { en: "Maintenance", ar: "صيانة" },
  "notes.cat.incident": { en: "Incident", ar: "حادث" },
  "notes.cat.task": { en: "Task", ar: "مهمة" },
  "notes.cat.idea": { en: "Idea", ar: "فكرة" },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string; dir: "ltr" | "rtl" };
const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("lang") as Lang) || "en");
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem("lang", lang);
  }, [lang]);
  const t = (k: string) => (dict[k]?.[lang] ?? dict[k]?.en ?? k);
  return (
    <LanguageContext.Provider value={{ lang, setLang: setLangState, t, dir: lang === "ar" ? "rtl" : "ltr" }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
