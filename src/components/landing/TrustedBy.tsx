const TrustedBy = () => {
  const stats = [
    { value: "10K+", label: "Students" },
    { value: "50K+", label: "Hours Listened" },
    { value: "4.9", label: "Rating" },
  ];

  const universities = [
    { name: "UNILAG", initials: "UL" },
    { name: "UI Ibadan", initials: "UI" },
    { name: "OAU", initials: "OA" },
    { name: "UNIBEN", initials: "UB" },
  ];

  return (
    <section className="py-16 md:py-20 border-y border-border bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-3xl mx-auto mb-12 md:mb-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <span className="block font-display text-4xl md:text-5xl font-bold text-foreground">
                {stat.value}
              </span>
              <span className="text-sm md:text-base text-muted-foreground">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* University Logos */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-6 uppercase tracking-wider font-medium">
            Trusted by students from top Nigerian universities
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12">
            {universities.map((uni) => (
              <div
                key={uni.name}
                className="flex items-center gap-2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <span className="font-bold text-sm">{uni.initials}</span>
                </div>
                <span className="font-display font-semibold text-lg hidden sm:inline">
                  {uni.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustedBy;
