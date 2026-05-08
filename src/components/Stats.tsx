import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

export function Stats() {
  const stats = [
    { value: 98, suffix: "%", label: "Monitoring Accuracy" },
    { value: 1, suffix: "s", label: "Data Delay", prefix: "<" },
    { value: 24, suffix: "/7", label: "Remote Access" },
  ];

  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className="p-8 text-center hover:shadow-xl transition-smooth hover:-translate-y-2 animate-fade-in"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="text-5xl md:text-6xl font-bold gradient-solar bg-clip-text text-transparent mb-2">
                {stat.prefix}
                <AnimatedCounter end={stat.value} duration={2000} />
                {stat.suffix}
              </div>
              <p className="text-muted-foreground font-medium">{stat.label}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function AnimatedCounter({
  end,
  duration,
}: {
  end: number;
  duration: number;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration]);

  return <>{count}</>;
}
