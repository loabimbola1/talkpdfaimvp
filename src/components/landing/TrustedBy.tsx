const TrustedBy = () => {
  // TechCabal-style trusted by section with logo placeholders
  const partners = [
    { name: "TechCabal", initials: "TC" },
    { name: "Paystack", initials: "PS" },
    { name: "Flutterwave", initials: "FW" },
    { name: "Andela", initials: "AN" },
    { name: "Cowrywise", initials: "CW" },
  ];

  return (
    <section className="py-12 md:py-16 border-y border-border bg-secondary/30">
      <div className="container mx-auto px-4">
        <p className="text-center text-sm text-muted-foreground mb-8 font-medium uppercase tracking-wider">
          Featured & Trusted By
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="flex items-center gap-2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                <span className="font-bold text-xs">{partner.initials}</span>
              </div>
              <span className="font-display font-semibold text-lg">{partner.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustedBy;
